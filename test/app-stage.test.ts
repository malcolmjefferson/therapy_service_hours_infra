import { describe, expect, test } from 'vitest';
import { App } from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import { CfnTopic } from 'aws-cdk-lib/aws-sns';
import { ENVIRONMENTS, devConfig } from '../config';
import { PLACEHOLDER_ACCOUNT } from '../lib/account';
import { buildStage, stacksOf, untaggedResources } from './helpers';

const REQUIRED_TAGS = ['app', 'env', 'owner'] as const;

describe.each(Object.values(ENVIRONMENTS))('$envName stage', (config) => {
  test('synthesizes the data, app and web stacks with prefixed names', () => {
    const app = new App();
    const stage = buildStage(config, app);
    const assembly = stage.synth();
    expect(assembly.stacks.map((s) => s.stackName)).toEqual([
      `therapy-service-hours-${config.envName}-data`,
      `therapy-service-hours-${config.envName}-app`,
      `therapy-service-hours-${config.envName}-web`,
    ]);
    for (const stack of stacksOf(stage)) {
      expect(stack.region).toBe('us-west-2');
      expect(stack.account).toBe(PLACEHOLDER_ACCOUNT);
    }
  });

  test('every taggable resource carries the app, env and owner tags (ARC-31)', () => {
    const stage = buildStage(config);
    stage.synth();
    expect(untaggedResources(stage, REQUIRED_TAGS)).toEqual([]);
  });

  test('stacks deploy in lifecycle order: data, then app, then web', () => {
    const stage = buildStage(config);
    expect(stage.appStack.dependencies).toContain(stage.dataStack);
    expect(stage.webStack.dependencies).toContain(stage.appStack);
  });
});

describe('tag propagation', () => {
  test('a resource added to any stack receives all three tags with the environment values', () => {
    const stage = buildStage(devConfig);
    for (const stack of stacksOf(stage)) {
      new CfnTopic(stack, 'FixtureTopic');
    }
    stage.synth();
    expect(untaggedResources(stage, REQUIRED_TAGS)).toEqual([]);
    for (const stack of stacksOf(stage)) {
      Template.fromStack(stack).hasResourceProperties('AWS::SNS::Topic', {
        Tags: [
          { Key: 'app', Value: 'therapy-service-hours' },
          { Key: 'env', Value: 'dev' },
          { Key: 'owner', Value: 'malcolmjefferson' },
        ],
      });
    }
  });

  test('the untagged-resource check reports a resource that is missing a tag', () => {
    const stage = buildStage(devConfig);
    const topic = new CfnTopic(stage.dataStack, 'Untagged');
    topic.tags.removeTag('owner', 1000);
    stage.synth();
    expect(untaggedResources(stage, REQUIRED_TAGS)).toEqual([topic.node.path]);
  });
});
