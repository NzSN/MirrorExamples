import { runClient, runClientWithTraces, runClientGenTraces, type ApalacheConfig, type TraceGenerationConfig } from "mirrorecma";
import { CounterComputer } from "../src/counter.js";
import { existsSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const BIN = process.env.MIRROR_BIN ?? "";
const SPEC = "./specs/Counter.tla";

const runSmoke = BIN ? test : test.skip;

const apalacheConfig: ApalacheConfig = {
  specPath: SPEC,
  invariant: "TraceComplete",
  lengthBound: 6,
  constInit: "CInit",
  paramVars: "parameters",
};

const traceConfig: TraceGenerationConfig = {
  numTraces: 10,
  view: "CounterView"
};

const TRACES_DIR = "./traces";

describe("Counter", () => {
  runSmoke("end-to-end against Counter.tla", async () => {
    const start = Date.now();
    const computer = new CounterComputer();
    await runClient(BIN, apalacheConfig, traceConfig, computer.compute.bind(computer));
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(60000);
  }, 120000);

  runSmoke("model-based testing with traces", async () => {
    const start = Date.now();
    const computer = new CounterComputer();

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
