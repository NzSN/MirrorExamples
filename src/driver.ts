import type { State } from "mirrorecma";

export interface Drivable {
  toState(): State;
  init(params: State): State;
  step(action: string, params: State): void;
}

export class Driver<T extends Drivable> {
  private instance: T;

  constructor(private factory: () => T) {
    this.instance = factory();
  }

  compute(action: string, params: State, prevState: State): State {
    if (action === "init" || action === "Init") {
      this.instance = this.factory();
      return this.instance.init(params);
    }
    this.instance.step(action, params);
    return this.instance.toState();
  }
}
