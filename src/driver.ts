import type { State } from "mirrorecma";

export interface Drivable {
  toState(): State;
}

export abstract class StateDriver {
  abstract compute(action: string, params: State, prevState: State): State;
}
