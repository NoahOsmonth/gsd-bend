# /gsd-bend:heal

Generate structured diagnostic feedback and a reflection prompt for the AI agent when mathematical proof verification fails.

## Usage
```bash
/gsd-bend:heal
# or via CLI
gsd-bend heal
```

## Functionality
- Extracts the exact unproven branches (e.g. `case False` missing) or invariant violation counterexample.
- Instructs the AI agent to update the implementation logic and proof branches.
- Enforces that `LAWS.bend` remains strictly immutable.
