# MirrorExamples

Example implementations and TLA+ corpora for the Mirrors ecosystem. Start new
application integration with the [framework map](../Mirrors/Docs/framework-map.md)
and [application guide](../Mirrors/Docs/application-integration-guide.md).
This repository supplies examples and model/trace data, not a client SDK or
sandbox controller.

## Contents

- [Counter model](specs/Counter/Counter.tla) and [test](test/counter.test.ts).
- [RBT model](specs/RBT/RBT.tla), [configuration](specs/RBT/RBT.cfg), and
  [test](test/rbt.test.ts).
- Retained ITF traces under `specs/RBT/traces_max_step_4/`; preserve their model
  provenance when using them as compiler or replay evidence.
- [Bazel targets](BUILD.bazel), including `//:check` and `//:rbt_e2e_test`.

Inspect [scripts/check](scripts/check) and [scripts/run_rbt_test](scripts/run_rbt_test)
before running the legacy targets: they expect Bazel runfiles, adapt materialized
dependencies and contain machine-specific tool assumptions. Select `MIRROR_BIN`
explicitly for direct tests; the RBT test has a historical fallback binary path.
These examples were not rerun during this documentation audit.

The default current Node onboarding examples are
[MirrorECMA application suites](../MirrorECMA/examples/application-validation/README.md).
For restricted execution, use [Gate client/worker selection](../MirrorGate/docs/client-language-support.md).
The TLA+ files here model application domains, not the Mirrors compiler itself.
