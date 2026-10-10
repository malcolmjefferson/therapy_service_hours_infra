import { App } from 'aws-cdk-lib/core';
import { ENVIRONMENTS } from '../config';
import { resolveAccount } from '../lib/account';
import { TherapyServiceHoursStage } from '../lib/app-stage';
import { resolveArtifacts } from '../lib/artifacts';
import { synthesisErrors } from '../lib/synth-errors';

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

const errors = synthesisErrors(app.synth());
if (errors.length > 0) {
  console.error(`Synthesis failed with ${errors.length} error(s):\n${errors.map((e) => `  ${e}`).join('\n')}`);
  process.exit(1);
}
