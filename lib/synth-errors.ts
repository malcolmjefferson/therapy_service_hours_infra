import { CloudAssembly, SynthesisMessageLevel } from 'aws-cdk-lib/cx-api';

/**
 * Lists every error annotation in the assembly, including stacks inside stages.
 *
 * `cdk synth` without a stack selector only reports errors for top-level stacks, and every
 * stack in this app lives in a stage, so guard errors (ARC-29) would otherwise pass silently.
 */
export function synthesisErrors(assembly: CloudAssembly): string[] {
  return assembly.stacksRecursively.flatMap((stack) =>
    stack.messages
      .filter((m) => m.level === SynthesisMessageLevel.ERROR)
      .map((m) => `${m.id}: ${String(m.entry.data)}`),
  );
}
