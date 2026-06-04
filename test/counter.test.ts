import { runClient, type TraceGenerationConfig } from "mirrorecma";
import { CounterComputer } from "../src/counter.js";

const BIN = process.env.MIRROR_BIN ?? "";
const SPEC = "./specs/Counter.tla";

const runSmoke = BIN ? test : test.skip;

const config: TraceGenerationConfig = {
  invariant: "TraceComplete",
  lengthBound: 6,
  numTraces: 1,
  cinit: "CInit",
  paramVars: "parameters",
};

describe("Counter", () => {
  runSmoke("end-to-end against Counter.tla", async () => {
    const start = Date.now();
    const computer = new CounterComputer();
    await runClient(BIN, SPEC, config, computer.compute.bind(computer));
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(60000);
    console.log(`OK (${elapsed}ms)`);
  }, 120000);
});
