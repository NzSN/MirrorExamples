import type { State, Value } from "mirrorecma";
import { Drivable } from "./driver";
import { asInt, getParam } from "mirrorecma";

const NIL = 0;

interface RBNode {
  key: number;
  color: "R" | "B";
  left: number;
  right: number;
  bh: number;
}

function emptyNode(): RBNode {
  return { key: 0, color: "B", left: NIL, right: NIL, bh: 0 };
}

export class RedBlackTree implements Drivable {
  private nodes: RBNode[];
  private root_: number;
  private stepCount: number;

  constructor() {
    this.nodes = [emptyNode()];
    this.root_ = NIL;
    this.stepCount = 0;
  }

  init(params: State): State {
    const nodesRec = params.nodes;
    let maxId = 0;
    if (nodesRec && nodesRec.tag === "record") {
      for (const k of Object.keys(nodesRec.val)) {
        const id = Number(k);
        if (id > maxId) maxId = id;
      }
    }
    this.nodes = [];
    for (let i = 0; i <= maxId; i++) {
      this.nodes[i] = emptyNode();
    }
    this.root_ = NIL;
    this.stepCount = 0;
    return this.toState();
  }

  private findUnused(): number {
    for (let i = 1; i < this.nodes.length; i++) {
      if (this.nodes[i] && this.nodes[i].key === 0) return i;
    }
    const id = this.nodes.length;
    this.nodes.push(emptyNode());
    return id;
  }

  private parentOf(id: number): number {
    if (id === NIL || id === this.root_) return NIL;
    for (let p = 0; p < this.nodes.length; p++) {
      const n = this.nodes[p];
      if (n && n.key !== 0 && (n.left === id || n.right === id)) {
        return p;
      }
    }
    return NIL;
  }

  private bstFind(key: number): number {
    let cur = this.root_;
    while (cur !== NIL) {
      if (this.nodes[cur].key === key) return cur;
      cur = key < this.nodes[cur].key
        ? this.nodes[cur].left
        : this.nodes[cur].right;
    }
    return NIL;
  }

  private bstParent(key: number): number {
    let cur = this.root_;
    if (cur === NIL) return NIL;
    while (true) {
      if (key < this.nodes[cur].key) {
        if (this.nodes[cur].left === NIL) return cur;
        cur = this.nodes[cur].left;
      } else {
        if (this.nodes[cur].right === NIL) return cur;
        cur = this.nodes[cur].right;
      }
    }
  }

  private successor(id: number): number {
    let r = this.nodes[id].right;
    if (r === NIL) return NIL;
    while (this.nodes[r].left !== NIL) {
      r = this.nodes[r].left;
    }
    return r;
  }

  private rotLeft(x: number): void {
    const n = this.nodes;
    const y = n[x].right;
    if (y === NIL) return;
    const p = this.parentOf(x);

    n[x].right = n[y].left;
    n[y].left = x;

    if (p === NIL) {
      this.root_ = y;
    } else if (n[p].left === x) {
      n[p].left = y;
    } else {
      n[p].right = y;
    }
  }

  private rotRight(x: number): void {
    const n = this.nodes;
    const y = n[x].left;
    if (y === NIL) return;
    const p = this.parentOf(x);

    n[x].left = n[y].right;
    n[y].right = x;

    if (p === NIL) {
      this.root_ = y;
    } else if (n[p].left === x) {
      n[p].left = y;
    } else {
      n[p].right = y;
    }
  }

  private fixInsert(z: number): void {
    while (true) {
      const par = this.parentOf(z);
      if (par === NIL || this.nodes[par].color === "B") break;
      const gp = this.parentOf(par);
      if (gp === NIL) break;

      const pLeft = this.nodes[gp].left === par;
      const uncle = pLeft ? this.nodes[gp].right : this.nodes[gp].left;
      const uRed = uncle !== NIL && this.nodes[uncle].color === "R";

      if (uRed) {
        this.nodes[par].color = "B";
        this.nodes[uncle].color = "B";
        this.nodes[gp].color = "R";
        z = gp;
        continue;
      }

      if (pLeft) {
        if (z === this.nodes[par].right) {
          this.rotLeft(par);
          z = par;
          continue;
        }
        this.nodes[par].color = "B";
        this.nodes[gp].color = "R";
        this.rotRight(gp);
      } else {
        if (z === this.nodes[par].left) {
          this.rotRight(par);
          z = par;
          continue;
        }
        this.nodes[par].color = "B";
        this.nodes[gp].color = "R";
        this.rotLeft(gp);
      }
      break;
    }
  }

  private insert(key: number): void {
    if (this.bstFind(key) !== NIL) return;

    const newId = this.findUnused();

    this.nodes[newId] = {
      key,
      color: "R",
      left: NIL,
      right: NIL,
      bh: 0,
    };

    const parent = this.bstParent(key);
    if (parent === NIL) {
      this.root_ = newId;
    } else if (key < this.nodes[parent].key) {
      this.nodes[parent].left = newId;
    } else {
      this.nodes[parent].right = newId;
    }

    this.fixInsert(newId);
    if (this.root_ !== NIL) {
      this.nodes[this.root_].color = "B";
    }
    this.recomputeBH();
  }

  private fixDelete(x: number, px: number | null, xIsLeft: boolean | null): void {
    while (true) {
      let par: number;
      let isLeft: boolean;

      if (px !== null) {
        par = px;
        isLeft = xIsLeft!;
      } else {
        par = this.parentOf(x);
        isLeft = par !== NIL && this.nodes[par].left === x;
      }

      const n = this.nodes;

      if (x === this.root_ || (x !== NIL && n[x].color === "R")) {
        if (x !== NIL) {
          n[x].color = "B";
        }
        break;
      }

      if (par === NIL) break;

      const w = isLeft ? n[par].right : n[par].left;
      const wRed = w !== NIL && n[w].color === "R";

      if (wRed) {
        n[w].color = "B";
        n[par].color = "R";
        if (isLeft) {
          this.rotLeft(par);
        } else {
          this.rotRight(par);
        }
        px = par;
        continue;
      }

      const wL = n[w].left;
      const wR = n[w].right;
      const wLB = wL === NIL || n[wL].color === "B";
      const wRB = wR === NIL || n[wR].color === "B";

      if (wLB && wRB) {
        n[w].color = "R";
        x = par;
        px = null;
        xIsLeft = null;
        continue;
      }

      if (isLeft) {
        if (wR !== NIL && n[wR].color === "R") {
          n[w].color = n[par].color;
          n[par].color = "B";
          n[wR].color = "B";
          this.rotLeft(par);
          break;
        } else {
          const nearC = wL;
          n[nearC].color = "B";
          n[w].color = "R";
          this.rotRight(w);
          const w2 = n[par].right;
          const w2R = n[w2].right;
          n[w2].color = n[par].color;
          n[par].color = "B";
          n[w2R].color = "B";
          this.rotLeft(par);
          break;
        }
      } else {
        if (wL !== NIL && n[wL].color === "R") {
          n[w].color = n[par].color;
          n[par].color = "B";
          n[wL].color = "B";
          this.rotRight(par);
          break;
        } else {
          const nearC = wR;
          n[nearC].color = "B";
          n[w].color = "R";
          this.rotLeft(w);
          const w2 = n[par].left;
          const w2L = n[w2].left;
          n[w2].color = n[par].color;
          n[par].color = "B";
          n[w2L].color = "B";
          this.rotRight(par);
          break;
        }
      }
    }
  }

  private delete(key: number): void {
    const z = this.bstFind(key);
    if (z === NIL) return;

    const hasTwo = this.nodes[z].left !== NIL && this.nodes[z].right !== NIL;
    let y: number;

    if (hasTwo) {
      y = this.successor(z);
      this.nodes[z].key = this.nodes[y].key;
    } else {
      y = z;
    }

    let x = this.nodes[y].left !== NIL ? this.nodes[y].left : this.nodes[y].right;

    const yOldParent = this.parentOf(y);
    const yIsLeft = yOldParent !== NIL && this.nodes[yOldParent].left === y;
    const yColor = this.nodes[y].color;

    if (yOldParent === NIL) {
      this.root_ = x;
    } else if (yIsLeft) {
      this.nodes[yOldParent].left = x;
    } else {
      this.nodes[yOldParent].right = x;
    }

    this.nodes[y].key = 0;

    if (yColor === "B") {
      this.fixDelete(x, x === NIL ? yOldParent : null, x === NIL ? yIsLeft : null);
    }

    if (this.root_ !== NIL) {
      this.nodes[this.root_].color = "B";
    }
    this.recomputeBH();
  }

  private recomputeBH(): void {
    const seen = new Set<number>();
    const stack: number[] = [this.root_];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (id === NIL || seen.has(id)) continue;
      seen.add(id);
      const n = this.nodes[id];
      stack.push(n.left, n.right);
    }

    for (let pass = 0; pass < 3; pass++) {
      for (const id of seen) {
        const n = this.nodes[id];
        n.bh = this.nodes[n.left].bh +
          (n.color === "B" ? 1 : 0);
      }
    }
  }

  step(action: string, params: State): void {
    const rec = getParam(params, "parameters");
    if (!rec) return;
    const keyVal = asInt(rec.keyParam!);
    if (keyVal === null) return;
    const key = Number(keyVal);

    if (action === "insert") {
      if (this.bstFind(key) === NIL) {
        this.insert(key);
        this.stepCount++;
      }
    } else if (action === "delete") {
      if (this.bstFind(key) !== NIL) {
        this.delete(key);
        this.stepCount++;
      }
    }
  }

  toState(): State {
    const nodesRec: Record<string, Value> = {};
    for (let id = 0; id < this.nodes.length; id++) {
      const n = this.nodes[id];
      nodesRec[String(id)] = {
        tag: "record",
        val: {
          key: { tag: "int", val: BigInt(n.key) } as Value,
          color: { tag: "str", val: n.color } as Value,
          left: { tag: "int", val: BigInt(n.left) } as Value,
          right: { tag: "int", val: BigInt(n.right) } as Value,
          bh: { tag: "int", val: BigInt(n.bh) } as Value,
        },
      } as Value;
    }

    return {
      nodes: { tag: "record", val: nodesRec } as Value,
      root: { tag: "int", val: BigInt(this.root_) } as Value,
      step_count: { tag: "int", val: BigInt(this.stepCount) } as Value,
    };
  }
}
