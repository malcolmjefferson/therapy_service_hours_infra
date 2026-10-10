import { describe, expect, test } from 'vitest';
import { PLACEHOLDER_ACCOUNT, resolveAccount } from '../lib/account';

// Fictional account IDs: AWS's documented example and an obviously made-up second one.
const EXPECTED = '123456789012';
const OTHER = '210987654321';

describe('resolveAccount (ARC-32)', () => {
  test('accepts credentials for the expected account', () => {
    expect(resolveAccount({ expectedAccount: EXPECTED, cdkDefaultAccount: EXPECTED })).toEqual({
      account: EXPECTED,
      source: 'verified',
    });
  });

  test('refuses credentials for another account', () => {
    expect(() => resolveAccount({ expectedAccount: EXPECTED, cdkDefaultAccount: OTHER })).toThrow(
      /belong to account 210987654321, but EXPECTED_AWS_ACCOUNT is 123456789012.*ARC-32/,
    );
  });

  test('refuses active credentials when EXPECTED_AWS_ACCOUNT is not set, so a deploy cannot skip the check', () => {
    expect(() => resolveAccount({ expectedAccount: undefined, cdkDefaultAccount: OTHER })).toThrow(
      /EXPECTED_AWS_ACCOUNT is not set/,
    );
  });

  test.each([undefined, '', '  '])('uses the placeholder for credential-less synth (%p)', (value) => {
    expect(resolveAccount({ expectedAccount: value, cdkDefaultAccount: value })).toEqual({
      account: PLACEHOLDER_ACCOUNT,
      source: 'placeholder',
    });
  });

  test('uses the expected account for synth when no credentials are active', () => {
    expect(resolveAccount({ expectedAccount: EXPECTED, cdkDefaultAccount: undefined })).toEqual({
      account: EXPECTED,
      source: 'expected-without-credentials',
    });
  });

  test.each(['12345', '1234567890123', 'abcdefghijkl'])('rejects a malformed EXPECTED_AWS_ACCOUNT (%p)', (value) => {
    expect(() => resolveAccount({ expectedAccount: value, cdkDefaultAccount: undefined })).toThrow(/12-digit/);
  });

  test('the placeholder is AWS’s documented example account', () => {
    expect(PLACEHOLDER_ACCOUNT).toBe('123456789012');
  });
});
