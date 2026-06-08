import type { State } from "mirrorecma";

const NIL_ID = 0;

type Color = "R" | "B";

interface NodeRec {
  key: number;
  color: Color;
  left: number;
  right: number;
  bh: number;
}

function nilRec(): NodeRec {
  return { key: 0, color: "B", left: NIL_ID, right: NIL_ID, bh: 0 };
}

export class RedBlackTree {
  nodes: Map<number, NodeRec> = new Map();
  root: number = NIL_ID;
  stepCount: number = 0;

  constructor() {
    this.nodes.set(NIL_ID, nilRec());
  }

  private findUnused(): number {
    let best: number | null = null;
    let maxId = NIL_ID;
    for (const [id, n] of this.nodes) {
      if (id > maxId) maxId = id;
      if (id > NIL_ID && n.key === 0) {
        if (best === null || id < best) best = id;
      }
    }
    if (best !== null) return best;
    const newId = maxId + 1;
    this.nodes.set(newId, nilRec());
    return newId;
  }

  private bstParent(key: number): number {
    let curr = this.root;
    while (curr !== NIL_ID) {
      const n = this.nodes.get(curr)!;
      if (key < n.key) {
        if (n.left === NIL_ID) return curr;
        curr = n.left;
      } else {
        if (n.right === NIL_ID) return curr;
        curr = n.right;
      }
    }
    return NIL_ID;
  }

  private pof(id: number): number {
    if (id === this.root) return NIL_ID;
    for (const [pid, pn] of this.nodes) {
      if (pn.left === id || pn.right === id) return pid;
    }
    return NIL_ID;
  }

  private bstFind(key: number): number {
    let curr = this.root;
    while (curr !== NIL_ID) {
      const n = this.nodes.get(curr)!;
      if (n.key === key) return curr;
      curr = key < n.key ? n.left : n.right;
    }
    return NIL_ID;
  }

  private successor(id: number): number {
    let r = this.nodes.get(id)!.right;
    if (r === NIL_ID) return NIL_ID;
    while (true) {
      const n = this.nodes.get(r)!;
      if (n.left === NIL_ID) return r;
      r = n.left;
    }
  }

  private rotLeft(x: number): void {
    const n = this.nodes.get(x)!;
    const y = n.right;
    if (y === NIL_ID) return;
    const yn = this.nodes.get(y)!;
    const p = this.pof(x);

    n.right = yn.left;
    yn.left = x;
    if (x === this.root) this.root = y;
    else {
      const pn = this.nodes.get(p)!;
      if (pn.left === x) pn.left = y;
      else pn.right = y;
    }
  }

  private rotRight(x: number): void {
    const n = this.nodes.get(x)!;
    const y = n.left;
    if (y === NIL_ID) return;
    const yn = this.nodes.get(y)!;
    const p = this.pof(x);

    n.left = yn.right;
    yn.right = x;
    if (x === this.root) this.root = y;
    else {
      const pn = this.nodes.get(p)!;
      if (pn.left === x) pn.left = y;
      else pn.right = y;
    }
  }

  private fixup(z: number): void {
    while (true) {
      const par = this.pof(z);
      if (par === NIL_ID || this.nodes.get(par)!.color === "B") break;
      const gp = this.pof(par);
      if (gp === NIL_ID) break;
      const gpN = this.nodes.get(gp)!;
      const pLeft = gpN.left === par;
      const uncle = pLeft ? gpN.right : gpN.left;
      const uRed = uncle !== NIL_ID && this.nodes.get(uncle)!.color === "R";

      if (uRed) {
        this.nodes.get(par)!.color = "B";
        this.nodes.get(uncle)!.color = "B";
        gpN.color = "R";
        z = gp;
        continue;
      }

      if (pLeft) {
        if (z === this.nodes.get(par)!.right) {
          this.rotLeft(par);
          z = par;
        }
        const parN = this.nodes.get(this.pof(z))!;
        const gpN2 = this.nodes.get(this.pof(this.pof(z)))!;
        parN.color = "B";
        gpN2.color = "R";
        this.rotRight(this.pof(this.pof(z)));
      } else {
        if (z === this.nodes.get(par)!.left) {
          this.rotRight(par);
          z = par;
        }
        const parN = this.nodes.get(this.pof(z))!;
        const gpN2 = this.nodes.get(this.pof(this.pof(z)))!;
        parN.color = "B";
        gpN2.color = "R";
        this.rotLeft(this.pof(this.pof(z)));
      }
      break;
    }
    this.nodes.get(this.root)!.color = "B";
  }

  private recomputeBH(): void {
    for (let pass = 0; pass < 3; pass++) {
      for (const [id, n] of this.nodes) {
        if (id === NIL_ID || n.key === 0) continue;
        const lbh = this.nodes.get(n.left)!.bh;
        n.bh = lbh + (n.color === "B" ? 1 : 0);
      }
    }
  }

  insert(key: number): void {
    if (this.bstFind(key) !== NIL_ID) return;

    const newId = this.findUnused();
    const n = this.nodes.get(newId)!;
    n.key = key;
    n.color = "R";
    n.left = NIL_ID;
    n.right = NIL_ID;
    n.bh = 0;

    const parent = this.bstParent(key);

    if (parent === NIL_ID) {
      this.root = newId;
    } else {
      const p = this.nodes.get(parent)!;
      if (key < p.key) p.left = newId;
      else p.right = newId;
    }

    this.fixup(newId);
    this.recomputeBH();
    this.stepCount++;
  }

  private deleteFixup(x: number, px: number, xLeft: boolean): void {
    let p = px;
    let isLeft = xLeft;
    while (true) {
      if (x === this.root) break;
      const par = x !== NIL_ID ? this.pof(x) : p;
      if (par === NIL_ID) break;
      if (x === NIL_ID) {
        isLeft = xLeft;
      } else {
        isLeft = this.nodes.get(par)!.left === x;
      }
      p = NIL_ID;

      if (x !== NIL_ID && this.nodes.get(x)!.color === "R") {
        this.nodes.get(x)!.color = "B";
        break;
      }

      const w = isLeft ? this.nodes.get(par)!.right : this.nodes.get(par)!.left;

      if (w === NIL_ID) break;

      const wN = this.nodes.get(w)!;
      if (wN.color === "R") {
        wN.color = "B";
        this.nodes.get(par)!.color = "R";
        if (isLeft) this.rotLeft(par);
        else this.rotRight(par);
        p = par;
        continue;
      }

      const wL = wN.left;
      const wR = wN.right;
      const wLB = wL === NIL_ID || this.nodes.get(wL)!.color === "B";
      const wRB = wR === NIL_ID || this.nodes.get(wR)!.color === "B";

      if (wLB && wRB) {
        wN.color = "R";
        x = par;
        continue;
      }

      if (isLeft) {
        if (wR !== NIL_ID && this.nodes.get(wR)!.color === "R") {
          wN.color = this.nodes.get(par)!.color;
          this.nodes.get(par)!.color = "B";
          this.nodes.get(wR)!.color = "B";
          this.rotLeft(par);
        } else {
          const nearC = wL;
          this.nodes.get(nearC)!.color = "B";
          wN.color = "R";
          this.rotRight(w);
          const parColor = this.nodes.get(par)!.color;
          const w2 = this.nodes.get(par)!.right;
          const w2R = this.nodes.get(w2)!.right;
          this.nodes.get(w2)!.color = parColor;
          this.nodes.get(par)!.color = "B";
          if (w2R !== NIL_ID) this.nodes.get(w2R)!.color = "B";
          this.rotLeft(par);
        }
        break;
      } else {
        if (wL !== NIL_ID && this.nodes.get(wL)!.color === "R") {
          wN.color = this.nodes.get(par)!.color;
          this.nodes.get(par)!.color = "B";
          this.nodes.get(wL)!.color = "B";
          this.rotRight(par);
        } else {
          const nearC = wR;
          this.nodes.get(nearC)!.color = "B";
          wN.color = "R";
          this.rotLeft(w);
          const parColor = this.nodes.get(par)!.color;
          const w2 = this.nodes.get(par)!.left;
          const w2L = this.nodes.get(w2)!.left;
          this.nodes.get(w2)!.color = parColor;
          this.nodes.get(par)!.color = "B";
          if (w2L !== NIL_ID) this.nodes.get(w2L)!.color = "B";
          this.rotRight(par);
        }
        break;
      }
    }
  }

  delete(key: number): void {
    const z = this.bstFind(key);
    if (z === NIL_ID) return;

    const zn = this.nodes.get(z)!;
    const hasTwoChildren = zn.left !== NIL_ID && zn.right !== NIL_ID;
    const y = hasTwoChildren ? this.successor(z) : z;
    const yn = this.nodes.get(y)!;
    const x = yn.left !== NIL_ID ? yn.left : yn.right;

    const yOldParent = this.pof(y);
    const yIsLeft = yOldParent !== NIL_ID && this.nodes.get(yOldParent)!.left === y;
    const yColor = hasTwoChildren ? yn.color : zn.color;

    if (hasTwoChildren) {
      zn.key = yn.key;
    }

    if (yOldParent === NIL_ID) {
      this.root = x;
    } else {
      if (yIsLeft) this.nodes.get(yOldParent)!.left = x;
      else this.nodes.get(yOldParent)!.right = x;
    }

    this.nodes.get(y)!.key = 0;

    if (yColor === "B") {
      const fx = x !== NIL_ID ? x : NIL_ID;
      const fxPx = x === NIL_ID ? yOldParent : NIL_ID;
      this.deleteFixup(fx, fxPx, yIsLeft);
    }

    this.nodes.get(this.root)!.color = "B";
    this.recomputeBH();
    this.stepCount++;
  }

  toState(): State {
    const nodesRec: Record<string, import("mirrorecma").Value> = {};
    for (const [id, n] of this.nodes) {
      nodesRec[String(id)] = {
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
      nodes: { tag: "record", val: nodesRec },
      root: { tag: "int", val: BigInt(this.root) },
      step_count: { tag: "int", val: BigInt(this.stepCount) },
    };
  }
}
