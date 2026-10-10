import { App } from 'aws-cdk-lib/core';
import { ENVIRONMENTS } from '../config';
import { resolveAccount } from '../lib/account';
import { TherapyServiceHoursStage } from '../lib/app-stage';

const app = new App();

const { account, source } = resolveAccount({
  expectedAccount: process.env.EXPECTED_AWS_ACCOUNT,
  cdkDefaultAccount: process.env.CDK_DEFAULT_ACCOUNT,
});
if (source !== 'verified') {
  console.warn(`No AWS credentials found: synthesizing with ${source === 'placeholder' ? 'the placeholder' : 'the expected'} account (synth only).`);
}

for (const config of Object.values(ENVIRONMENTS)) {
  new TherapyServiceHoursStage(app, config.envName, {
    config,
    env: { account, region: config.region },
  });
}
