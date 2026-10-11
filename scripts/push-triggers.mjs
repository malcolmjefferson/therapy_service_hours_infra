// Helper for reregister-push-triggers.sh: reads a pipeline definition (get-pipeline --query pipeline).
//   check <file>    fails unless every connection source action has a push trigger on main
//   without <file>  prints the definition without triggers and with change detection off
//   restore <file>  prints the definition unchanged, for the second update
// Both outputs drop "version": CodePipeline assigns it.
import { readFileSync } from 'node:fs';

const [mode, file] = process.argv.slice(2);
const pipeline = JSON.parse(readFileSync(file, 'utf8'));
const sources = pipeline.stages[0].actions.filter((a) => a.actionTypeId.provider === 'CodeStarSourceConnection');

if (mode === 'check') {
  const triggered = new Set(
    (pipeline.triggers ?? [])
      .filter((t) => t.gitConfiguration?.push?.some((p) => p.branches?.includes?.includes('main')))
      .map((t) => t.gitConfiguration.sourceActionName),
  );
  const missing = sources.map((a) => a.name).filter((n) => !triggered.has(n));
  if (sources.length === 0 || missing.length > 0) {
    console.error(`Expected a push trigger on main for every source; missing: ${missing.join(', ') || '(no sources)'}`);
    process.exit(1);
  }
  console.error(`ok: ${sources.length} sources have push triggers on main`);
} else if (mode === 'without' || mode === 'restore') {
  const copy = structuredClone(pipeline);
  delete copy.version;
  if (mode === 'restore') {
    process.stdout.write(JSON.stringify(copy));
    process.exit(0);
  }
  delete copy.triggers;
  for (const a of copy.stages[0].actions) {
    if (a.actionTypeId.provider === 'CodeStarSourceConnection') a.configuration.DetectChanges = 'false';
  }
  process.stdout.write(JSON.stringify(copy));
} else {
  console.error('usage: push-triggers.mjs check|without|restore <pipeline.json>');
  process.exit(2);
}
