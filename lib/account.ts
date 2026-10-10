/**
 * AWS's documented example account ID. Used for synth without credentials (CI, local checks).
 * Nothing can be deployed to it, because no credentials can ever belong to it.
 */
export const PLACEHOLDER_ACCOUNT = '123456789012';

/** Inputs to {@link resolveAccount}, read from the environment by `bin/app.ts`. */
export interface AccountInputs {
  /** `EXPECTED_AWS_ACCOUNT`: the account this app may deploy to. Kept out of the repo on purpose. */
  readonly expectedAccount: string | undefined;
  /** `CDK_DEFAULT_ACCOUNT`: set by the CDK CLI from the active AWS credentials. */
  readonly cdkDefaultAccount: string | undefined;
}

/** How the account was chosen. */
export type AccountSource =
  /** Credentials are active and belong to the expected account. */
  | 'verified'
  /** The expected account is set but no credentials are active, so nothing can deploy. */
  | 'expected-without-credentials'
  /** Neither is set: synth-only placeholder. */
  | 'placeholder';

/** The account to synthesize for, and why. */
export interface ResolvedAccount {
  readonly account: string;
  readonly source: AccountSource;
}

/**
 * Chooses the account to synthesize for, refusing anything that could deploy to the wrong account (ARC-32).
 *
 * The expected account comes from `EXPECTED_AWS_ACCOUNT` (set locally and in the pipeline), not from
 * committed config, so the account ID is not published with the code.
 * - Credentials active without `EXPECTED_AWS_ACCOUNT`: refuse, so a deploy cannot skip the check.
 * - Credentials for a different account: refuse.
 * - No credentials: synth only. Use the expected account if set, otherwise the placeholder.
 */
export function resolveAccount({ expectedAccount, cdkDefaultAccount }: AccountInputs): ResolvedAccount {
  const expected = blankToUndefined(expectedAccount);
  const active = blankToUndefined(cdkDefaultAccount);

  if (expected !== undefined && !/^\d{12}$/.test(expected)) {
    throw new Error('EXPECTED_AWS_ACCOUNT must be a 12-digit AWS account ID.');
  }
  if (active === undefined) {
    return expected === undefined
      ? { account: PLACEHOLDER_ACCOUNT, source: 'placeholder' }
      : { account: expected, source: 'expected-without-credentials' };
  }
  if (expected === undefined) {
    throw new Error(
      `AWS credentials for account ${active} are active, but EXPECTED_AWS_ACCOUNT is not set. ` +
        'Set it to the project account so synth can confirm the target (ARC-32).',
    );
  }
  if (active !== expected) {
    throw new Error(
      `Refusing to synthesize: the active AWS credentials belong to account ${active}, but ` +
        `EXPECTED_AWS_ACCOUNT is ${expected}. Switch to the right AWS profile (ARC-32).`,
    );
  }
  return { account: active, source: 'verified' };
}

function blankToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}
