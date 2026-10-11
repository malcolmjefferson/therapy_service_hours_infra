import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const script = join(__dirname, '..', 'scripts', 'push-triggers.mjs');
const source = (name: string) => ({ name, actionTypeId: { provider: 'CodeStarSourceConnection' }, configuration: { DetectChanges: 'true', BranchName: 'main' } });
const trigger = (name: string) => ({ providerType: 'CodeStarSourceConnection', gitConfiguration: { sourceActionName: name, push: [{ branches: { includes: ['main'] } }] } });
const pipeline = {
  name: 'p',
  version: 7,
  stages: [{ name: 'Source', actions: [source('a'), source('b')] }, { name: 'Build', actions: [] }],
  triggers: [trigger('a'), trigger('b')],
};

function run(mode: string, definition: unknown) {
  const file = join(mkdtempSync(join(tmpdir(), 'triggers-')), 'p.json');
  writeFileSync(file, JSON.stringify(definition));
  return spawnSync(process.execPath, [script, mode, file], { encoding: 'utf8' });
}

describe('scripts/push-triggers.mjs (reregister-push-triggers.sh helper)', () => {
  test('check passes when every source has a push trigger on main', () => {
    expect(run('check', pipeline).status).toBe(0);
  });

  test('check fails and names a source without a trigger', () => {
    const r = run('check', { ...pipeline, triggers: [trigger('a')] });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('missing: b');
  });

  test('without drops the triggers and the version and turns change detection off', () => {
    const out = JSON.parse(run('without', pipeline).stdout);
    expect(out.triggers).toBeUndefined();
    expect(out.version).toBeUndefined();
    expect(out.stages[0].actions.map((a: { configuration: { DetectChanges: string } }) => a.configuration.DetectChanges)).toEqual(['false', 'false']);
  });

  test('restore keeps everything except the version', () => {
    const out = JSON.parse(run('restore', pipeline).stdout);
    const { version: _version, ...rest } = pipeline;
    expect(out).toEqual(rest);
  });
});
