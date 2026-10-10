import { App } from 'aws-cdk-lib/core';
import { ENVIRONMENTS } from '../config';
import { resolveAccount } from '../lib/account';
import { TherapyServiceHoursStage } from '../lib/app-stage';
import { resolveArtifacts } from '../lib/artifacts';
import { PipelineStack } from '../lib/pipeline/pipeline-stack';
import { synthesisErrors } from '../lib/synth-errors';
import { APP_NAME, APP_REGION, prodConfig } from '../config';

const app = new App();

const { account, source } = resolveAccount({
  expectedAccount: process.env.EXPECTED_AWS_ACCOUNT,
  cdkDefaultAccount: process.env.CDK_DEFAULT_ACCOUNT,
});
if (source !== 'verified') {
  console.warn(`No AWS credentials found: synthesizing with ${source === 'placeholder' ? 'the placeholder' : 'the expected'} account (synth only).`);
}

const artifacts = resolveArtifacts(process.env.BACKEND_DIST, source === 'verified');
if (artifacts.placeholder) {
  console.warn('BACKEND_DIST is not set: using placeholder Lambda code (synth only).');
}

for (const config of Object.values(ENVIRONMENTS)) {
  new TherapyServiceHoursStage(app, config.envName, {
    config,
    artifacts,
    env: { account, region: config.region },
  });
}

// The release pipeline (S0-14, ADR-0005). The standalone stages above stay for manual deploys of a
// single stack (scripts/deploy.sh); the pipeline deploys the same stacks by the same names.
new PipelineStack(app, 'Pipeline', {
  stackName: `${APP_NAME}-pipeline`,
  env: { account, region: APP_REGION },
  account,
  artifacts,
  notificationEmail: prodConfig.alerts.email,
});

const errors = synthesisErrors(app.synth());
if (errors.length > 0) {
  console.error(`Synthesis failed with ${errors.length} error(s):\n${errors.map((e) => `  ${e}`).join('\n')}`);
  process.exit(1);
}
