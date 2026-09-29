# /gsd-bend:audit or /gsd-bend-audit

Scan the repository for Goodhart's Law cheating patterns, test falsification, and unproven shortcuts.

## Usage
```bash
/gsd-bend:audit
# or
/gsd-bend-audit
# or via CLI
gsd-bend audit
```

## Detected Anti-Patterns
- **Axiomatic Bypasses**: Using `axiom cheat:` to avoid proving induction.
- **Skipped Proof Goals**: Annotations like `@skip` or `@ignore`.
- **Mock Contamination**: Injecting mocking libraries (`jest.mock`, `sinon.stub`, `vi.mock`) into verified core logic.
- **Vacuous Proof Statements**: Writing imperative return statements instead of formal proof trees.
