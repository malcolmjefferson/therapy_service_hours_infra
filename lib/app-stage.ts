import { Aspects, Stage, StageProps, Tags } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { APP_NAME, EnvConfig, resourcePrefix } from '../config';
import { AppStack } from './app/app-stack';
import { DataStack } from './app/data-stack';
import { WebStack } from './app/web-stack';
import { LambdaArtifacts } from './artifacts';
import { BudgetGuard } from './guards/budget-guard';

/** Props for {@link TherapyServiceHoursStage}. */
export interface TherapyServiceHoursStageProps extends StageProps {
  readonly config: EnvConfig;
  /** Lambda code from the backend build (the same binaries for every environment). */
  readonly artifacts: LambdaArtifacts;
}

/**
 * One complete environment (dev or prod). The pipeline (S0-14) deploys the same stage class
 * to both environments, so they differ only by their {@link EnvConfig} (ARC-47).
 */
export class TherapyServiceHoursStage extends Stage {
  readonly dataStack: DataStack;
  readonly appStack: AppStack;
  readonly webStack: WebStack;

  constructor(scope: Construct, id: string, props: TherapyServiceHoursStageProps) {
    super(scope, id, props);
    const { config } = props;
    const prefix = resourcePrefix(config);

    // Mandatory tags on every taggable resource in the environment (ARC-31).
    Tags.of(this).add('app', APP_NAME);
    Tags.of(this).add('env', config.envName);
    Tags.of(this).add('owner', config.owner);
    // Synth fails if the environment declares a resource the budget forbids (ARC-29).
    Aspects.of(this).add(new BudgetGuard());

    this.dataStack = new DataStack(this, 'Data', { config, artifacts: props.artifacts, stackName: `${prefix}data` });
    this.appStack = new AppStack(this, 'App', {
      config,
      artifacts: props.artifacts,
      data: this.dataStack,
      stackName: `${prefix}app`,
    });
    this.appStack.addStackDependency(this.dataStack, 'App resources use the network and database');
    this.webStack = new WebStack(this, 'Web', {
      config,
      apiDomainName: this.appStack.api.domainName,
      stackName: `${prefix}web`,
    });
    this.webStack.addStackDependency(this.appStack, 'CloudFront routes /api/* to the API');
  }
}
