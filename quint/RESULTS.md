# Quint reproducible experiment results

- [Stacked PR #2](https://github.com/roccho-dev/proofs/pull/2), parent [TLA+ PR #1](https://github.com/roccho-dev/proofs/pull/1).
- Experimental commit: `66655b326c16add3eb7bfa241f4971c7c3cd0a6a`.
- [Node / Bun successful run 41110155773](https://github.com/roccho-dev/proofs/actions/runs/41110155773): **13/13 + 13/13 = 26/26**.
- Node job `124249958058` (check API before trusting this field); Bun job also on same run. Use run URL as authoritative identifier.
- Node raw ZIP: [artifact 13003317340](https://github.com/roccho-dev/proofs/actions/runs/41110155773/artifacts/13003317340), SHA256 `8be9ff3bd26667fcb688604d1e36aea93d9594ab410d3fb91894f4cfb8d765b6`, 1,846,155 bytes.
- Bun raw ZIP: [artifact 13002938040](https://github.com/roccho-dev/proofs/actions/runs/41110155773/artifacts/13002938040), SHA256 `1e03be1515c68e6b49d74ece8dfde9ac4084196d274d7ef002b37d1a44464afc`, 1,846,060 bytes.

| Group | Cases per runtime | Observed dependency boundary |
|---|---:|---|
| Typecheck + TypeScript tests and simulation | 5 | No JVM, Rust executable or Apalache subprocess was launched |
| Rust test | 2 | Actual `quint_evaluator` executed; chmod-disabled executable caused failure |
| Apalache verify | 3 | JVM and Apalache launched; missing launcher caused failure; bad property produced trace |
| TLC verify | 2 | JVM launched with `tlc2.TLC`; bad property produced trace |
| JVM hidden | 1 | Fresh Apalache launcher could not verify |

Negative controls are expected failure paths **only when their expected diagnostic appears**. Timeouts are rejected. A silent `typecheck` exit 0 is a valid success for this CLI; both the passing and failing tests exercise the parser and evaluator.

### Known incompleteness

1. The Apalache-distribution JAR and Z3 native library were not independently disabled: source inspection establishes packaging and code dependencies, but no standalone removal result is claimed.
2. Direct dependency versions are fixed (Quint 0.33.1, Rust evaluator v0.7.1, Apalache 0.62.4, Java 21); transitive npm dependencies are not locked, and remote distribution payloads were not pre-verified by SHA.
3. The Apalache check has `--max-steps=4`. Neither this nor the Rust/TS simulator makes unbounded correctness claims.
4. Node/Bun results are independent CI executions, not bit-for-bit identical log files. The same input source SHA is recorded in both; runtime-specific logs have different hashes.
5. The first run was deliberately recorded as FAIL and its artifact was ~195 MB. Moving temporary distributions outside evidence shrunk the final artifacts. The old artifacts will expire.

Review and merge must keep #2 stacked on #1 and avoid treating 26 local controls as proof of general correctness.
