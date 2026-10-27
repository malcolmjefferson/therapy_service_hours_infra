import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as lambda from 'aws-cdk-lib/aws-lambda';

/** The Go Lambdas the backend repo builds (one binary per `cmd/<name>`, ARC-05). */
export type BackendLambda = 'api' | 'migrate' | 'dbbootstrap' | 'dbbootstrap-provider' | 'presignup' | 'seed' | 'idempotency-purge';

/** Supplies Lambda code to the stacks. */
export interface LambdaArtifacts {
  /** True when the code is a placeholder that must never be deployed. */
  readonly placeholder: boolean;
  /** Build identifier reported by /healthz: the backend commit SHA from `<dir>/VERSION`. */
  readonly version: string;
  code(name: BackendLambda): lambda.Code;
}

const PLACEHOLDER_DIR = join(__dirname, 'artifacts', 'placeholder');

/**
 * Lambda code from the backend build, laid out as `<dir>/<name>/bootstrap` (provided.al2023, arm64).
 * The pipeline sets BACKEND_DIST to the backend build artifact, so every environment deploys the
 * same binaries (ADR-0005).
 */
export function backendArtifacts(dir: string): LambdaArtifacts {
  const versionFile = join(dir, 'VERSION');
  return {
    placeholder: false,
    version: existsSync(versionFile) ? readFileSync(versionFile, 'utf8').trim() || 'unversioned' : 'unversioned',
    code(name) {
      const bootstrap = join(dir, name, 'bootstrap');
      if (!existsSync(bootstrap)) {
        throw new Error(`BACKEND_DIST has no ${name}/bootstrap (looked for ${bootstrap}).`);
      }
      return lambda.Code.fromAsset(join(dir, name));
    },
  };
}

/** A stand-in asset so tests and credential-less CI can synth without a backend build. */
export function placeholderArtifacts(): LambdaArtifacts {
  return { placeholder: true, version: 'placeholder', code: () => lambda.Code.fromAsset(PLACEHOLDER_DIR) };
}

/**
 * Chooses the artifacts for this synth. With AWS credentials active (`canDeploy`), real binaries are
 * required, so a placeholder can never reach an environment.
 */
export function resolveArtifacts(backendDist: string | undefined, canDeploy: boolean): LambdaArtifacts {
  const dir = backendDist?.trim();
  if (dir) {
    return backendArtifacts(dir);
  }
  if (canDeploy) {
    throw new Error('BACKEND_DIST is not set. Point it at the backend build (<dir>/<lambda>/bootstrap) before synthesizing with AWS credentials.');
  }
  return placeholderArtifacts();
}
