# /gsd-bend:discuss or /gsd-bend-discuss

Facilitate structured requirements discussion between the user/architect and the agent to formalize safety properties and invariant requirements before coding.

## Usage
```bash
/gsd-bend:discuss [topic]
# or
/gsd-bend-discuss [topic]
# or via CLI
gsd-bend discuss "Vault Invariants & State Safety"
```

## What it does
1. **Domain Boundary Elicitation**: Proactively questions edge cases, overflow risks, unauthorized state changes, and solvency invariants.
2. **Anti-Goodhart Pre-emption**: Pinpoints areas where simple unit tests would create false security or allow agent gaming.
3. **Formulates Invariant Directives**: Logs mathematical constraints and safety expectations into `.planning/DISCUSS.md`.
4. **Prepares Plan Phase**: Transitions GSD lifecycle state to `discuss` (`in_progress`), priming the project for `/gsd-bend:plan`.
