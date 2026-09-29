# /gsd-bend:map-codebase or /gsd-bend-map-codebase

Scan codebase architecture, catalog system modules, and pinpoint critical state variables requiring mathematical invariants.

## Usage
```bash
/gsd-bend:map-codebase
# or
/gsd-bend-map-codebase
# or via CLI
gsd-bend map-codebase
```

## What it does
1. **Architecture Discovery**: Analyzes directory trees, source files, and polyglot dependencies (Bend, JS/TS, Python, Rust, Solidity).
2. **Invariant Target Detection**: Scans for state variables subject to Goodhart exploits (balances, escrows, permissions, counters, transfers).
3. **Generates Architecture Map**: Writes `.planning/CODEBASE_MAP.md` listing critical invariant candidate modules.
4. **Guides Specification**: Prepares the architect/agent to draft precise laws during `/gsd-bend:discuss` and `/gsd-bend:plan`.
