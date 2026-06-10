import { Drivable } from "./driver.js";
import type { State, Value } from "mirrorecma";
import { getParam, asInt } from "mirrorecma";

interface RBNode {
  key: number;
  color: "R" | "B";
  left: number;
  right: number;
  bh: number;
}

const NIL = 0;
const MAX_NODES = 5;

export class RedBlackTree implements Drivable {
  private nodes: RBNode[] = [];
  private root: number = NIL;

  constructor() {
    this.reset();
  }

  private reset(): void {
    this.nodes = [];
    for (let i = 0; i <= MAX_NODES; i++) {
      this.nodes.push({ key: 0, color: "B", left: NIL, right: NIL, bh: 0 });
    }
    this.root = NIL;
  }

  private findUnused(): number {
    for (let id = 1; id <= MAX_NODES; id++) {
      if (this.nodes[id].key === 0) return id;
    }
    throw new Error("no unused node");
  }

  private parent(id: number): number {
    if (id === this.root) return NIL;
    for (let p = 1; p <= MAX_NODES; p++) {
      const n = this.nodes[p];
      if (n.key !== 0 && (n.left === id || n.right === id)) return p;
    }
    return NIL;
  }

  init(params: State): State {
    this.reset();
    return this.toState();
  }

  step(action: string, params: State): void {
    const rec = getParam(params, "parameters");
    if (!rec) return;
    const keyVal = asInt(rec.keyParam!);
    if (keyVal === null) return;
    const key = Number(keyVal);
    if (action === "insert") this.insert(key);
    else if (action === "delete") this.delete(key);
    this.stepCount++;
  }

  private stepCount: number = 0;

  toState(): State {
    const nodeRecords: Record<string, Value> = {};
    for (let i = 0; i <= MAX_NODES; i++) {
      const n = this.nodes[i];
      nodeRecords[String(i)] = {
        tag: "record",
        val: {
          key: { tag: "int", val: BigInt(n.key) },
          color: { tag: "str", val: n.color },
          left: { tag: "int", val: BigInt(n.left) },
          right: { tag: "int", val: BigInt(n.right) },
          bh: { tag: "int", val: BigInt(n.bh) },
        },
      };
    }
    return {
      root: { tag: "int", val: BigInt(this.root) },
      nodes: { tag: "record", val: nodeRecords },
      step_count: { tag: "int", val: BigInt(this.stepCount) },
    };
  }

  private insert(key: number): void {
    if (this.bstFind(key) !== NIL) return;

    const z = this.findUnused();
    this.nodes[z].key = key;
    this.nodes[z].color = "R";
    this.nodes[z].left = NIL;
    this.nodes[z].right = NIL;
    this.nodes[z].bh = 0;

    const parent = this.bstParent(key);
    if (parent === NIL) {
      this.root = z;
    } else if (key < this.nodes[parent].key) {
      this.nodes[parent].left = z;
    } else {
      this.nodes[parent].right = z;
    }

    this.insertFixup(z);
    this.nodes[this.root].color = "B";
    this.recomputeBH();
  }

  private insertFixup(z: number): void {
    let done = false;
    while (!done) {
      const p = this.parent(z);
      if (p === NIL || this.nodes[p].color === "B") {
        done = true;
        break;
      }
      const gp = this.parent(p);
      if (gp === NIL) { done = true; break; }

      const pLeft = this.nodes[gp].left === p;
      const uncle = pLeft ? this.nodes[gp].right : this.nodes[gp].left;
      const uRed = uncle !== NIL && this.nodes[uncle].color === "R";

      if (uRed) {
        this.nodes[p].color = "B";
        this.nodes[uncle].color = "B";
        this.nodes[gp].color = "R";
        z = gp;
      } else if (pLeft) {
        if (z === this.nodes[p].right) {
          this.rotateLeft(p);
          z = p;
        }
        const p2 = this.parent(z);
        const gp2 = this.parent(p2);
        this.nodes[p2].color = "B";
        this.nodes[gp2].color = "R";
        this.rotateRight(gp2);
        done = true;
      } else {
        if (z === this.nodes[p].left) {
          this.rotateRight(p);
          z = p;
        }
        const p2 = this.parent(z);
        const gp2 = this.parent(p2);
        this.nodes[p2].color = "B";
        this.nodes[gp2].color = "R";
        this.rotateLeft(gp2);
        done = true;
      }
    }
  }

  private rotateLeft(x: number): void {
    const y = this.nodes[x].right;
    if (y === NIL) return;
    const p = this.parent(x);
    this.nodes[x].right = this.nodes[y].left;
    this.nodes[y].left = x;
    if (x === this.root) {
      this.root = y;
    } else if (this.nodes[p].left === x) {
      this.nodes[p].left = y;
    } else {
      this.nodes[p].right = y;
    }
  }

  private rotateRight(x: number): void {
    const y = this.nodes[x].left;
    if (y === NIL) return;
    const p = this.parent(x);
    this.nodes[x].left = this.nodes[y].right;
    this.nodes[y].right = x;
    if (x === this.root) {
      this.root = y;
    } else if (this.nodes[p].left === x) {
      this.nodes[p].left = y;
    } else {
      this.nodes[p].right = y;
    }
  }

  private delete(key: number): void {
    const z = this.bstFind(key);
    if (z === NIL) return;

    const hasTwo = this.nodes[z].left !== NIL && this.nodes[z].right !== NIL;
    const y = hasTwo ? this.successor(z) : z;
    const x = this.nodes[y].left !== NIL ? this.nodes[y].left : this.nodes[y].right;
    const yColor = hasTwo ? this.nodes[y].color : this.nodes[z].color;
    const yOldParent = this.parent(y);
    const yIsLeft = yOldParent !== NIL && this.nodes[yOldParent].left === y;

    if (hasTwo) {
      this.nodes[z].key = this.nodes[y].key;
    }

    if (yOldParent === NIL) {
      this.root = x;
    } else if (yIsLeft) {
      this.nodes[yOldParent].left = x;
    } else {
      this.nodes[yOldParent].right = x;
    }

    this.nodes[y].key = 0;

    if (y === this.root) {
      this.root = x;
    } else if (yColor === "B") {
      const fx = x !== NIL ? x : NIL;
      const fxPx = x === NIL ? yOldParent : NIL;
      this.deleteFixup(fx, fxPx, yIsLeft);
    }

    this.nodes[this.root].color = "B";
    this.recomputeBH();
  }

  private deleteFixup(x: number, px: number, xLeft: boolean): void {
    let done = false;
    while (!done) {
      if (x === this.root || (x !== NIL && this.nodes[x].color === "R")) {
        if (x !== NIL) this.nodes[x].color = "B";
        done = true;
        break;
      }

      const par = px !== NIL ? px : this.parent(x);
      if (par === NIL) { done = true; break; }

      const isLeft = px !== NIL ? xLeft : (par !== NIL && this.nodes[par].left === x);
      let w = isLeft ? this.nodes[par].right : this.nodes[par].left;

      if (w !== NIL && this.nodes[w].color === "R") {
        this.nodes[w].color = "B";
        this.nodes[par].color = "R";
        if (isLeft) this.rotateLeft(par);
        else this.rotateRight(par);
        continue;
      }

      const wL = w !== NIL ? this.nodes[w].left : NIL;
      const wR = w !== NIL ? this.nodes[w].right : NIL;
      const wLB = wL === NIL || this.nodes[wL].color === "B";
      const wRB = wR === NIL || this.nodes[wR].color === "B";

      if (wLB && wRB) {
        if (w !== NIL) this.nodes[w].color = "R";
        x = par;
        px = NIL;
        xLeft = false;
      } else if (isLeft) {
        if (wR !== NIL && this.nodes[wR].color === "R") {
          this.nodes[w].color = this.nodes[par].color;
          this.nodes[par].color = "B";
          this.nodes[wR].color = "B";
          this.rotateLeft(par);
          x = this.root;
          done = true;
          break;
        } else {
          if (wL !== NIL) this.nodes[wL].color = "B";
          this.nodes[w].color = "R";
          this.rotateRight(w);
        }
      } else {
        if (wL !== NIL && this.nodes[wL].color === "R") {
          this.nodes[w].color = this.nodes[par].color;
          this.nodes[par].color = "B";
          this.nodes[wL].color = "B";
          this.rotateRight(par);
          x = this.root;
          done = true;
          break;
        } else {
          if (wR !== NIL) this.nodes[wR].color = "B";
          this.nodes[w].color = "R";
          this.rotateLeft(w);
        }
      }
    }
    if (x !== NIL) this.nodes[x].color = "B";
  }

  private recomputeBH(): void {
    for (let pass = 0; pass < 3; pass++) {
      for (let id = 0; id <= MAX_NODES; id++) {
        if (id === NIL || this.nodes[id].key === 0) continue;
        const l = this.nodes[id].left;
        this.nodes[id].bh = this.nodes[l].bh + (this.nodes[id].color === "B" ? 1 : 0);
      }
    }
  }

  private bstFind(key: number): number {
    let cur = this.root;
    while (cur !== NIL) {
      const k = this.nodes[cur].key;
      if (k === key) return cur;
      if (key < k) cur = this.nodes[cur].left;
      else cur = this.nodes[cur].right;
    }
    return NIL;
  }

  private bstParent(key: number): number {
    let cur = this.root;
    let parent = NIL;
    while (cur !== NIL) {
      parent = cur;
      if (key < this.nodes[cur].key) cur = this.nodes[cur].left;
      else cur = this.nodes[cur].right;
    }
    return parent;
  }

  private successor(id: number): number {
    let cur = this.nodes[id].right;
    if (cur === NIL) return NIL;
    while (this.nodes[cur].left !== NIL) {
      cur = this.nodes[cur].left;
    }
    return cur;
  }
}
