import type { State } from "mirrorecma";

export interface Drivable {
  toState(): State;
  step(action: string, params: State): void;
}

export abstract class StateDriver {
  abstract compute(action: string, params: State, prevState: State): State;
}

export class Driver<T extends Drivable> extends StateDriver {
  private instance: T;

  constructor(private factory: () => T) {
    super();
    this.instance = factory();
  }

  compute(action: string, params: State, prevState: State): State {
    if (action === "init" || action === "Init") {
      this.instance = this.factory();
      return this.instance.toState();
    }
    this.instance.step(action, params);
    return this.instance.toState();
  }
}
