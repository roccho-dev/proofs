# Quint reproducible experiment results

- [Stacked PR #2](https://github.com/roccho-dev/proofs/pull/2), parent [TLA+ PR #1](https://github.com/roccho-dev/proofs/pull/1).
- Experimental commit: `ab5b5a94668604d0477a1d8ea984eff33e377356`.
- [Node / Bun successful run 41111340301](https://github.com/roccho-dev/proofs/actions/runs/41111340301): **14/14 + 14/14 = 28/28**.
- Node job [124254105725](https://github.com/roccho-dev/proofs/actions/runs/41111340301/job/124254105725); Bun job [124254106004](https://github.com/roccho-dev/proofs/actions/runs/41111340301/job/124254106004). Their logs each end in 14/14.
- Node raw ZIP: [artifact 13004211753](https://github.com/roccho-dev/proofs/actions/runs/41111340301/artifacts/13004211753), SHA256 `f3b05738bd43833d1de0ae83e53e9f3aa2ea2026085ce34b4310b10faec149a1`, 1,848,030 bytes.
- Bun raw ZIP: [artifact 13003258337](https://github.com/roccho-dev/proofs/actions/runs/41111340301/artifacts/13003258337), SHA256 `a37ea223ded7d2859fb4d6661369803fabf7cab68781af532ce4488fa5a70ca0`, 1,848,105 bytes.

| Group | Cases per runtime | Observed dependency boundary |
|---|---:|---|
| Typecheck + TypeScript tests and simulation | 5 | No JVM, Rust executable or Apalache subprocess was launched |
| Rust test | 2 | Actual `quint_evaluator` executed; chmod-disabled executable caused failure |
| Apalache verify | 3 | JVM and Apalache launched; missing launcher caused failure; bad property produced trace |
| TLC verify | 3 | JVM launched with `tlc2.TLC`; real JAR was removed and verification failed; bad property produced trace |
| JVM hidden | 1 | Fresh Apalache launcher could not verify |

Negative controls are expected failure paths **only when their expected diagnostic appears**. Timeouts are rejected. A silent `typecheck` exit 0 is a valid success for this CLI; both the passing and failing tests exercise the parser and evaluator.

### Known incompleteness

1. The native Z3 library was not independently disabled. In contrast, the real `apalache/lib/apalache.jar` was renamed away for a TLC control: with the same specification, verification failed (exit 1) in both runtimes and the JAR was restored. This establishes the fixed execution path, not the uniqueness of the JAR's role.
2. Direct dependency versions are fixed (Quint 0.33.1, Rust evaluator v0.7.1, Apalache 0.62.4, Java 21); transitive npm dependencies are not locked, and remote distribution payloads were not pre-verified by SHA.
3. The Apalache check has `--max-steps=4`. Neither this nor the Rust/TS simulator makes unbounded correctness claims.
4. Node/Bun results are independent CI executions, not bit-for-bit identical log files. The same input source SHA is recorded in both; runtime-specific logs have different hashes.
5. The first run was deliberately recorded as FAIL and its artifact was ~195 MB. Moving temporary distributions outside evidence shrunk the final artifacts. The old artifacts will expire.

Review and merge must keep #2 stacked on #1 and avoid treating 26 local controls as proof of general correctness.

### Parent regression observation

[Parent run 41111340453](https://github.com/roccho-dev/proofs/actions/runs/41111340453) on the same executable head logged Node 25/25, Bun 25/25. Earlier [run 41111081623](https://github.com/roccho-dev/proofs/actions/runs/41111081623) logged Bun 24/25, solely `ls4-minimal`: TLAPM printed `All 2 obligations proved` but the captured subprocess list did not include `ls4`. This contradictory evidence was not reinterpreted as a proof failure or edited in the child PR. It remains an independent parent robustness gap.
