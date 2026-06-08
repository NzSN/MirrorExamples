import type { State, StateComputer } from "mirrorecma";
import { asInt, getParam } from "mirrorecma";

export class Counter {
  count: bigint;

  constructor() {
    this.count = 0n;
  }

  tick(stride: bigint): void {
      this.count += stride;
  }

  toState(): State {
    return {
      count: { tag: "int", val: this.count },
    };
  }
}

export class CounterComputer {
  private counter = new Counter();

  compute(action: string, params: State, prevState: State): State {
    if (action === "Init" || prevState.count === undefined) {
      this.counter = new Counter();
      return this.counter.toState();
    }

    const rec = getParam(params, "parameters");
    const stride = rec ? asInt(rec.stride!) ?? 0n : 0n;

    this.counter.tick(stride);
    return this.counter.toState();
  }
}
