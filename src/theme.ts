// Temporary re-export shim (zombie-mermaid#625, umbrella #620).
//
// theme.ts moved to packages/core/src/theme.ts. This shim exists only so
// the demo/site-generator files that still import it by relative path
// (deferred to a follow-up PR, to keep this PR's file count under
// CodeRabbit's review limit) keep working unchanged. Every other consumer
// already imports from '@zombie-mermaid/core' directly.
//
// Delete this file once the demo migration PR flips those remaining
// imports over and removes it.
export * from '../packages/core/src/theme.ts'
