import { Annotations, CfnResource, IAspect, Stack, Stage, Token } from 'aws-cdk-lib/core';
import { CfnVPCEndpoint } from 'aws-cdk-lib/aws-ec2';
import { CfnDBInstance } from 'aws-cdk-lib/aws-rds';
import { IConstruct } from 'constructs';

const REFERENCE = 'Remove it, or get the owner\'s approval and record it in an ADR (CLAUDE.md §0.6, ARC-29).';

/** One budget rule: a resource type that is never allowed, or allowed only under a condition. */
interface BudgetRule {
  readonly id: string;
  readonly description: string;
  readonly cfnType: string;
  /** Returns true when this resource breaks the rule. Absent means every resource of the type breaks it. */
  readonly violates?: (resource: CfnResource) => boolean;
}

/**
 * The resources CLAUDE.md §0.6 forbids without explicit approval, because each one alone
 * costs a large share of the $50/month budget. Gateway VPC endpoints are free and stay allowed.
 */
export const BUDGET_RULES: readonly BudgetRule[] = [
  { id: 'NAT_GATEWAY', description: 'NAT Gateway', cfnType: 'AWS::EC2::NatGateway' },
  { id: 'RDS_PROXY', description: 'RDS Proxy', cfnType: 'AWS::RDS::DBProxy' },
  {
    id: 'INTERFACE_ENDPOINT',
    description: 'interface VPC endpoint',
    cfnType: 'AWS::EC2::VPCEndpoint',
    // CloudFormation defaults VpcEndpointType to Gateway; anything else is billed hourly.
    violates: (r) => r instanceof CfnVPCEndpoint && r.vpcEndpointType !== undefined && r.vpcEndpointType !== 'Gateway',
  },
  { id: 'LOAD_BALANCER', description: 'load balancer (ALB/NLB)', cfnType: 'AWS::ElasticLoadBalancingV2::LoadBalancer' },
  { id: 'CLASSIC_LOAD_BALANCER', description: 'classic load balancer', cfnType: 'AWS::ElasticLoadBalancing::LoadBalancer' },
  {
    id: 'MULTI_AZ_DATABASE',
    description: 'Multi-AZ database',
    cfnType: 'AWS::RDS::DBInstance',
    // An unresolved token could become true at deploy time, so it is treated as Multi-AZ.
    violates: (r) => r instanceof CfnDBInstance && (r.multiAz === true || Token.isUnresolved(r.multiAz)),
  },
  { id: 'DB_CLUSTER', description: 'additional database (RDS/Aurora cluster)', cfnType: 'AWS::RDS::DBCluster' },
  { id: 'CUSTOMER_MANAGED_KMS_KEY', description: 'customer-managed KMS key', cfnType: 'AWS::KMS::Key' },
];

/** The most RDS instances one environment may contain (one db.t4g.micro, CLAUDE.md §2). */
export const MAX_DB_INSTANCES_PER_ENVIRONMENT = 1;

/**
 * CDK aspect that fails synthesis when a stage declares a resource the budget forbids.
 * Errors are attached to the offending construct, so `cdk synth` names its path.
 * Apply it to each environment's stage.
 */
export class BudgetGuard implements IAspect {
  private readonly dbInstancesByStage = new Map<string, string[]>();

  visit(node: IConstruct): void {
    if (!CfnResource.isCfnResource(node)) {
      return;
    }
    for (const rule of BUDGET_RULES) {
      if (node.cfnResourceType === rule.cfnType && (rule.violates === undefined || rule.violates(node))) {
        Annotations.of(node).addError(`Budget guard [${rule.id}]: a ${rule.description} is not allowed. ${REFERENCE}`);
      }
    }
    if (node.cfnResourceType === 'AWS::RDS::DBInstance') {
      this.countDbInstance(node);
    }
  }

  private countDbInstance(node: CfnResource): void {
    const stage = Stage.of(node);
    const key = stage?.node.path ?? Stack.of(node).node.path;
    const seen = this.dbInstancesByStage.get(key) ?? [];
    seen.push(node.node.path);
    this.dbInstancesByStage.set(key, seen);
    if (seen.length > MAX_DB_INSTANCES_PER_ENVIRONMENT) {
      Annotations.of(node).addError(
        `Budget guard [EXTRA_DATABASE]: environment already has ${MAX_DB_INSTANCES_PER_ENVIRONMENT} RDS instance ` +
          `(${seen[0]}); a second one is not allowed. ${REFERENCE}`,
      );
    }
  }
}
