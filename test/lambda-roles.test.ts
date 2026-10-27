import { describe, expect, test } from 'vitest';
import { Template } from 'aws-cdk-lib/assertions';
import { ENVIRONMENTS } from '../config';
import { buildStage } from './helpers';

type Resource = { Type: string; Properties: Record<string, unknown> };

/** Our explicitly named functions (prefix therapy-service-hours-<env>-) and their role logical IDs. */
function namedFunctionRoles(t: Template, prefix: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const fn of Object.values(t.findResources('AWS::Lambda::Function')) as Resource[]) {
    const name = fn.Properties.FunctionName;
    if (typeof name !== 'string' || !name.startsWith(prefix)) continue;
    const role = (fn.Properties.Role as { 'Fn::GetAtt': [string, string] })['Fn::GetAtt'][0];
    out.set(name, role);
  }
  return out;
}

type Statement = { Effect: string; Action: string | string[]; Resource: unknown };

/** Statements of the AWS::IAM::Policy resources attached to a role. */
function statementsOf(t: Template, roleId: string): Statement[] {
  return (Object.values(t.findResources('AWS::IAM::Policy')) as Resource[])
    .filter((p) => JSON.stringify(p.Properties.Roles).includes(`"${roleId}"`))
    .flatMap((p) => (p.Properties.PolicyDocument as { Statement: Statement[] }).Statement);
}

describe('Lambda execution roles cannot recreate their log groups', () => {
  test.each(Object.values(ENVIRONMENTS).map((c) => [c.envName, c] as const))('%s', (_env, config) => {
    const stage = buildStage(config);
    const prefix = `therapy-service-hours-${config.envName}-`;
    const seen: string[] = [];
    for (const stack of [stage.dataStack, stage.appStack]) {
      const t = Template.fromStack(stack);
      for (const [name, roleId] of namedFunctionRoles(t, prefix)) {
        seen.push(name);
        // The managed execution policies allow logs:CreateLogGroup on *; an explicit Deny on the
        // function's own log group (with and without the :* suffix) overrides it.
        const deny = statementsOf(t, roleId).find((s) => s.Effect === 'Deny' && [s.Action].flat().includes('logs:CreateLogGroup'));
        expect(deny, `${name}: no Deny for logs:CreateLogGroup`).toBeDefined();
        const resources = JSON.stringify(deny?.Resource);
        expect(resources).toContain(`log-group:/aws/lambda/${name}"`);
        expect(resources).toContain(`log-group:/aws/lambda/${name}:*"`);
      }
    }
    expect(seen.map((n) => n.slice(prefix.length)).sort()).toEqual(['api', 'db-bootstrap', 'db-bootstrap-provider', 'idempotency-purge', 'migrate', 'presignup', 'seed']);
  });
});
