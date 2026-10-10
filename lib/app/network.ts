import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

/** Props for {@link Network}. */
export interface NetworkProps {
  /** Prefix for resource names, for example `therapy-service-hours-dev-`. */
  readonly prefix: string;
  /** Availability Zones for the isolated subnets. */
  readonly availabilityZones: readonly string[];
}

/**
 * The VPC for the database and the VPC Lambdas (CLAUDE.md §4.1, ARC-02).
 *
 * - Two AZs of **private isolated** subnets only: no public subnets, no internet gateway and no
 *   NAT Gateway (budget guard). VPC Lambdas can reach RDS and nothing else.
 * - A free **S3 gateway endpoint** for S3 access from inside the VPC.
 * - Security groups: the database accepts 5432 only from the app security group, and the app
 *   security group can only reach the database (SEC-65). No 0.0.0.0/0 ingress anywhere.
 */
export class Network extends Construct {
  readonly vpc: ec2.Vpc;
  /** Attached to the RDS instance. */
  readonly databaseSecurityGroup: ec2.SecurityGroup;
  /** Attached to every VPC Lambda (api, migrate, database bootstrap). */
  readonly appSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkProps) {
    super(scope, id);

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `${props.prefix}vpc`,
      ipAddresses: ec2.IpAddresses.cidr('10.40.0.0/16'),
      availabilityZones: [...props.availabilityZones],
      natGateways: 0,
      subnetConfiguration: [{ name: 'isolated', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 }],
      restrictDefaultSecurityGroup: true,
    });
    this.vpc.addGatewayEndpoint('S3', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      subnets: [{ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }],
    });

    this.databaseSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSg', {
      vpc: this.vpc,
      securityGroupName: `${props.prefix}db`,
      description: 'RDS PostgreSQL: 5432 from the app security group only',
      allowAllOutbound: false,
    });
    this.appSecurityGroup = new ec2.SecurityGroup(this, 'AppSg', {
      vpc: this.vpc,
      securityGroupName: `${props.prefix}app`,
      description: 'VPC Lambdas: may reach the database only',
      allowAllOutbound: false,
    });

    this.databaseSecurityGroup.addIngressRule(this.appSecurityGroup, ec2.Port.tcp(5432), 'PostgreSQL from VPC Lambdas');
    this.appSecurityGroup.addEgressRule(this.databaseSecurityGroup, ec2.Port.tcp(5432), 'PostgreSQL to RDS');
  }
}
