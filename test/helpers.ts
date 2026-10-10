import { App, CfnResource, Stack, TagManager } from 'aws-cdk-lib/core';
import { IConstruct } from 'constructs';
import { EnvConfig } from '../config';
import { PLACEHOLDER_ACCOUNT } from '../lib/account';
import { TherapyServiceHoursStage } from '../lib/app-stage';
import { placeholderArtifacts } from '../lib/artifacts';

/** Builds one environment's stage with no AWS credentials, as CI does. */
export function buildStage(config: EnvConfig, app: App = new App()): TherapyServiceHoursStage {
  return new TherapyServiceHoursStage(app, config.envName, {
    config,
    artifacts: placeholderArtifacts(),
    env: { account: PLACEHOLDER_ACCOUNT, region: config.region },
  });
}

/** Every stack in a stage, in creation order. */
export function stacksOf(stage: TherapyServiceHoursStage): Stack[] {
  return [stage.dataStack, stage.appStack, stage.webStack];
}

/**
 * Returns the paths of taggable resources under `scope` that are missing any of `keys`.
 * Call after synth, because tags are applied by an aspect during synthesis.
 */
export function untaggedResources(scope: IConstruct, keys: readonly string[]): string[] {
  return scope.node
    .findAll()
    .filter((c): c is CfnResource => CfnResource.isCfnResource(c))
    .filter((r) => {
      const manager = TagManager.of(r);
      if (manager === undefined) {
        return false;
      }
      const tags = manager.tagValues();
      return keys.some((k) => tags[k] === undefined);
    })
    .map((r) => r.node.path);
}
