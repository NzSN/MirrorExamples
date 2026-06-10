import type { State } from "mirrorecma";
import { asInt, getParam } from "mirrorecma";
import { Drivable } from "./driver.js";

export class Counter implements Drivable {
  count: bigint;

  constructor() {
    this.count = 0n;
  }

  init(params: State): State {
    this.count = 0n;
    return this.toState();
  }

  tick(stride: bigint): void {
    this.count += stride;
  }

  step(action: string, params: State): void {
    const rec = getParam(params, "parameters");
    const stride = rec ? asInt(rec.stride!) ?? 0n : 0n;
    this.tick(stride);
  }

  toState(): State {
    return {
      count: { tag: "int", val: this.count },
    };
  }
}
