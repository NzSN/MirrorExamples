import { runClient, runClientWithTraces, runClientGenTraces, type ApalacheConfig, type TraceGenerationConfig } from "mirrorecma";
import { Counter } from "../src/counter.js";
import { Driver } from "../src/driver.js";
import { existsSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const BIN = process.env.MIRROR_BIN ?? "";
const SPEC = "./specs/Counter/Counter.tla";

const runSmoke = BIN ? test : test.skip;

const apalacheConfig: ApalacheConfig = {
  specPath: SPEC,
  invariant: "TraceComplete",
  lengthBound: 4,
  constInit: "CInit",
  paramVars: "parameters",
};

const traceConfig: TraceGenerationConfig = {
  numTraces: 10,
  view: "CounterView"
};

const TRACES_DIR = "./traces";

const newCounterComputer = () => new Driver(() => new Counter());

describe("Counter", () => {
  runSmoke("end-to-end against Counter.tla", async () => {
    const start = Date.now();
    const driver = newCounterComputer();
    await runClient(BIN, apalacheConfig, traceConfig, driver.compute.bind(driver));
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(60000);
  }, 120000);

  runSmoke("model-based testing with traces", async () => {
    const start = Date.now();
    const driver = newCounterComputer();

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

    await runClientWithTraces(BIN, apalacheConfig, traceFiles, driver.compute.bind(driver));
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(60000);
  }, 120000);
});
