import { runClient, runClientWithTraces, runClientGenTraces, type ApalacheConfig, type TraceGenerationConfig, type State, asInt, getParam } from "mirrorecma";
import { RedBlackTree } from "../src/rbt.js";
import { Driver } from "../src/driver.js";
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

const TRACES_DIR_MAX_STEP_4 = "./specs/RBT/traces_max_step_4";
const TRACES_DIR_MAX_STEP_6 = "./specs/RBT/traces_max_step_6";

const newRbtComputer = () => new Driver(() => {
  const tree = new RedBlackTree();
  return tree;
});

describe("RedBlackTree", () => {
  const USED_TRACES = TRACES_DIR_MAX_STEP_6;

  // Cost very very much of time, LLM should just used
  // mbt below of current.
  test.skip("end-to-end against RBT.tla", async () => {
    const start = Date.now();
    const driver = newRbtComputer();
    await runClient(BIN, apalacheConfig, traceConfig, driver.compute.bind(driver));
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(60000);
  }, 120000);

  runSmoke("model-based testing with traces", async () => {
    const start = Date.now();
    const driver = newRbtComputer();

    let traceFiles: string[] = [];
    if (existsSync(USED_TRACES)) {
      traceFiles = readdirSync(USED_TRACES)
        .filter(f => f.endsWith(".itf.json"))
        .map(f => join(USED_TRACES, f));
    }

    if (traceFiles.length === 0) {
      if (!existsSync(USED_TRACES)) mkdirSync(USED_TRACES, { recursive: true });
      await runClientGenTraces(BIN, apalacheConfig, USED_TRACES, traceConfig);
      traceFiles = readdirSync(USED_TRACES)
        .filter(f => f.endsWith(".itf.json"))
        .map(f => join(USED_TRACES, f));
    }

    await runClientWithTraces(BIN, apalacheConfig, traceFiles, driver.compute.bind(driver));
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(60000);
  }, 120000);
});
