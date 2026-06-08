import { runClient, runClientWithTraces, runClientGenTraces, type ApalacheConfig, type TraceGenerationConfig } from "mirrorecma";
import { RedBlackTreeComputer } from "../src/rbt.js";
import { existsSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const BIN = process.env.MIRROR_BIN ?? "/home/nzsn/Repos/ModelMirros/dist-newstyle/build/x86_64-linux/ghc-9.14.1/ModelMirrors-0.1.0.0/x/ModelMirrors/build/ModelMirrors/ModelMirrors";
const SPEC = "./specs/RBT/RBT.tla";

const runSmoke = BIN ? test : test.skip;

const apalacheConfig: ApalacheConfig = {
  specPath: SPEC,
  invariant: "TraceComplete",
  lengthBound: 4,
  paramVars: "parameters",
};

const traceConfig: TraceGenerationConfig = {
  numTraces: 10,
  view: "TreeView",
};

const TRACES_DIR = "./specs/RBT/traces";

describe("RedBlackTree", () => {
  runSmoke("end-to-end against RBT.tla", async () => {
    const start = Date.now();
    const computer = new RedBlackTreeComputer();
    await runClient(BIN, apalacheConfig, traceConfig, computer.compute.bind(computer));
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(60000);
  }, 120000);

  runSmoke("model-based testing with traces", async () => {
    const start = Date.now();
    const computer = new RedBlackTreeComputer();

    let traceFiles: string[] = [];
    if (existsSync(TRACES_DIR)) {
      traceFiles = readdirSync(TRACES_DIR)
        .filter(f => f.endsWith(".itf.json"))
        .map(f => join(TRACES_DIR, f));
    }

    if (traceFiles.length === 0) {
      if (!existsSync(TRACES_DIR)) mkdirSync(TRACES_DIR, { recursive: true });
      await runClientGenTraces(BIN, apalacheConfig, TRACES_DIR, traceConfig);
      traceFiles = readdirSync(TRACES_DIR)
        .filter(f => f.endsWith(".itf.json"))
        .map(f => join(TRACES_DIR, f));
    }

    await runClientWithTraces(BIN, apalacheConfig, traceFiles, computer.compute.bind(computer));
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(60000);
  }, 120000);
});
