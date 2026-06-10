import type { State, Value } from "mirrorecma";
import { asInt, getParam } from "mirrorecma";
import { Drivable } from "./driver.js";

const NIL = 0n;
const MAX_ID = 5n;

interface RbtNode {
  key: bigint;
  color: "R" | "B";
  left: bigint;
  right: bigint;
  bh: bigint;
}

function nilNode(): RbtNode {
  return { key: 0n, color: "B", left: NIL, right: NIL, bh: 0n };
}

function intVal(n: bigint): Value {
  return { tag: "int", val: n };
}

function strVal(s: string): Value {
  return { tag: "str", val: s };
}

function nodeVal(node: RbtNode): Value {
  return {
    tag: "record",
    val: {
      bh: intVal(node.bh),
      color: strVal(node.color),
      key: intVal(node.key),
      left: intVal(node.left),
      right: intVal(node.right),
    },
  };
}

export class RedBlackTree implements Drivable {
  private nodes: Map<bigint, RbtNode>;
  private root: bigint;
  private action: string;
  private stepCount: bigint;
  private keyParam: bigint;

  constructor() {
    this.nodes = new Map();
    this.root = NIL;
    this.action = "init";
    this.stepCount = 0n;
    this.keyParam = 0n;
  }

  private resetNodes(): void {
    this.nodes.clear();
    for (let i = 0n; i <= MAX_ID; i++) {
      this.nodes.set(i, nilNode());
    }
  }

  toState(): State {
    const pairs: Value[] = [];
    for (let i = 0n; i <= MAX_ID; i++) {
      const node = this.nodes.get(i) ?? nilNode();
      pairs.push({
        tag: "set",
        val: [intVal(i), nodeVal(node)],
      });
    }
    return {
      nodes: {
        tag: "record",
        val: {
          "#map": {
            tag: "set",
            val: pairs,
          },
        },
      },
      root: intVal(this.root),
      action_taken: strVal(this.action),
      step_count: intVal(this.stepCount),
      parameters: {
        tag: "record",
        val: {
          keyParam: intVal(this.keyParam),
        },
      },
    };
  }

  init(_params: State): State {
    this.resetNodes();
    this.root = NIL;
    this.action = "init";
    this.stepCount = 0n;
    this.keyParam = 0n;
    return this.toState();
  }

  step(action: string, params: State): void {
    const keyRec = getParam(params, "parameters");
    const key = keyRec?.keyParam ? asInt(keyRec.keyParam) ?? 0n : 0n;
    this.keyParam = key;

    if (action === "Insert" || action === "insert") {
      this.action = "insert";
      this.insert(key);
    } else if (action === "Delete" || action === "delete") {
      this.action = "delete";
      this.delete(key);
    }
  }

  private findUnused(): bigint {
    let best = NIL;
    for (let i = 1n; i <= MAX_ID; i++) {
      const node = this.nodes.get(i);
      if (node && node.key === 0n) {
        best = i;
        break;
      }
    }
    return best;
  }

  private parentOf(id: bigint): bigint {
    if (id === this.root) return NIL;
    for (const [pId, pNode] of this.nodes) {
      if (pNode.left === id || pNode.right === id) return pId;
    }
    return NIL;
  }

  private bstFind(key: bigint): bigint {
    let cur = this.root;
    while (cur !== NIL) {
      const node = this.nodes.get(cur);
      if (!node) return NIL;
      if (node.key === key) return cur;
      if (key < node.key) {
        cur = node.left;
      } else {
        cur = node.right;
      }
    }
    return NIL;
  }

  private successor(id: bigint): bigint {
    const node = this.nodes.get(id);
    if (!node) return NIL;
    let cur = node.right;
    if (cur === NIL) return NIL;
    while (true) {
      const curNode = this.nodes.get(cur);
      if (!curNode) return NIL;
      if (curNode.left === NIL) return cur;
      cur = curNode.left;
    }
  }

  private rotateLeft(x: bigint): void {
    const xNode = this.nodes.get(x);
    if (!xNode) return;
    const y = xNode.right;
    if (y === NIL) return;
    const yNode = this.nodes.get(y);
    if (!yNode) return;

    xNode.right = yNode.left;
    this.nodes.set(x, xNode);

    yNode.left = x;
    this.nodes.set(y, yNode);

    const p = this.parentOf(x);
    if (x === this.root) {
      this.root = y;
    } else {
      const pNode = this.nodes.get(p);
      if (pNode) {
        if (pNode.left === x) {
          pNode.left = y;
        } else {
          pNode.right = y;
        }
        this.nodes.set(p, pNode);
      }
    }
  }

  private rotateRight(x: bigint): void {
    const xNode = this.nodes.get(x);
    if (!xNode) return;
    const y = xNode.left;
    if (y === NIL) return;
    const yNode = this.nodes.get(y);
    if (!yNode) return;

    xNode.left = yNode.right;
    this.nodes.set(x, xNode);

    yNode.right = x;
    this.nodes.set(y, yNode);

    const p = this.parentOf(x);
    if (x === this.root) {
      this.root = y;
    } else {
      const pNode = this.nodes.get(p);
      if (pNode) {
        if (pNode.left === x) {
          pNode.left = y;
        } else {
          pNode.right = y;
        }
        this.nodes.set(p, pNode);
      }
    }
  }

  private recolor(id: bigint, color: "R" | "B"): void {
    const node = this.nodes.get(id);
    if (node) {
      node.color = color;
      this.nodes.set(id, node);
    }
  }

  private recomputeBH(): void {
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0n; i <= MAX_ID; i++) {
        const node = this.nodes.get(i);
        if (!node || i === NIL || node.key === 0n) continue;
        const leftNode = this.nodes.get(node.left);
        const leftBh = leftNode ? leftNode.bh : 0n;
        node.bh = leftBh + (node.color === "B" ? 1n : 0n);
        this.nodes.set(i, node);
      }
    }
  }

  private insertFixup(z: bigint): void {
    for (let iter = 0; iter < 5; iter++) {
      const par = this.parentOf(z);
      if (par === NIL) break;
      const parNode = this.nodes.get(par);
      if (!parNode || parNode.color === "B") break;

      const gp = this.parentOf(par);
      if (gp === NIL) break;
      const gpNode = this.nodes.get(gp);
      if (!gpNode) break;

      const pLeft = gpNode.left === par;
      const uncle = pLeft ? gpNode.right : gpNode.left;
      const uncleNode = this.nodes.get(uncle);
      const uRed = uncle !== NIL && uncleNode !== undefined && uncleNode.color === "R";

      if (uRed) {
        this.recolor(par, "B");
        this.recolor(uncle, "B");
        this.recolor(gp, "R");
        z = gp;
        continue;
      }

      if (pLeft) {
        const parNode2 = this.nodes.get(par)!;
        if (z === parNode2.right) {
          this.rotateLeft(par);
          z = par;
        }
        const par2 = this.parentOf(z);
        const gp2 = this.parentOf(par2);
        this.recolor(par2, "B");
        this.recolor(gp2, "R");
        this.rotateRight(gp2);
        break;
      } else {
        const parNode2 = this.nodes.get(par)!;
        if (z === parNode2.left) {
          this.rotateRight(par);
          z = par;
        }
        const par2 = this.parentOf(z);
        const gp2 = this.parentOf(par2);
        this.recolor(par2, "B");
        this.recolor(gp2, "R");
        this.rotateLeft(gp2);
        break;
      }
    }
  }

  private insert(key: bigint): void {
    const existing = this.bstFind(key);
    if (existing !== NIL) return;

    const newId = this.findUnused();
    if (newId === NIL) return;

    const newNode: RbtNode = { key, color: "R", left: NIL, right: NIL, bh: 0n };
    this.nodes.set(newId, newNode);

    if (this.root === NIL) {
      this.root = newId;
    } else {
      let cur = this.root;
      while (true) {
        const curNode = this.nodes.get(cur);
        if (!curNode) break;
        if (key < curNode.key) {
          if (curNode.left === NIL) {
            curNode.left = newId;
            this.nodes.set(cur, curNode);
            break;
          }
          cur = curNode.left;
        } else {
          if (curNode.right === NIL) {
            curNode.right = newId;
            this.nodes.set(cur, curNode);
            break;
          }
          cur = curNode.right;
        }
      }
    }

    this.insertFixup(newId);
    this.recolor(this.root, "B");
    this.stepCount += 1n;
    this.recomputeBH();
  }

  private deleteFixup(x: bigint, px: bigint, xLeft: boolean): void {
    for (let iter = 0; iter < 5; iter++) {
      let par = px !== NIL ? px : this.parentOf(x);
      let isLeft = px !== NIL ? xLeft : false;
      if (px === NIL) {
        const parNode = this.nodes.get(par);
        isLeft = parNode !== undefined && parNode.left === x;
      }

      if (x === this.root) break;
      const xNode = this.nodes.get(x);
      if (x !== NIL && xNode && xNode.color === "R") {
        this.recolor(x, "B");
        break;
      }

      if (par === NIL) break;

      const parNode = this.nodes.get(par);
      if (!parNode) break;

      const w = isLeft ? parNode.right : parNode.left;
      const wNode = this.nodes.get(w);
      const wRed = w !== NIL && wNode !== undefined && wNode.color === "R";

      if (wRed) {
        this.recolor(w, "B");
        this.recolor(par, "R");
        if (isLeft) {
          this.rotateLeft(par);
        } else {
          this.rotateRight(par);
        }
        px = par;
        continue;
      }

      if (!wNode) break;
      const wL = wNode.left;
      const wR = wNode.right;
      const wLNode = this.nodes.get(wL);
      const wRNode = this.nodes.get(wR);
      const wLB = wL === NIL || (wLNode ? wLNode.color === "B" : true);
      const wRB = wR === NIL || (wRNode ? wRNode.color === "B" : true);

      if (wLB && wRB) {
        this.recolor(w, "R");
        x = par;
        px = NIL;
        continue;
      }

      if (isLeft) {
        if (wR !== NIL && wRNode && wRNode.color === "R") {
          this.recolor(w, parNode.color);
          this.recolor(par, "B");
          this.recolor(wR, "B");
          this.rotateLeft(par);
          break;
        } else {
          this.recolor(wL, "B");
          this.recolor(w, "R");
          this.rotateRight(w);
          const parNode2 = this.nodes.get(par)!;
          const w2 = parNode2.right;
          const w2Node = this.nodes.get(w2);
          const w2R = w2Node ? w2Node.right : NIL;
          this.recolor(w2, parNode2.color);
          this.recolor(par, "B");
          this.recolor(w2R, "B");
          this.rotateLeft(par);
          break;
        }
      } else {
        if (wL !== NIL && wLNode && wLNode.color === "R") {
          this.recolor(w, parNode.color);
          this.recolor(par, "B");
          this.recolor(wL, "B");
          this.rotateRight(par);
          break;
        } else {
          this.recolor(wR, "B");
          this.recolor(w, "R");
          this.rotateLeft(w);
          const parNode2 = this.nodes.get(par)!;
          const w2 = parNode2.left;
          const w2Node = this.nodes.get(w2);
          const w2L = w2Node ? w2Node.left : NIL;
          this.recolor(w2, parNode2.color);
          this.recolor(par, "B");
          this.recolor(w2L, "B");
          this.rotateRight(par);
          break;
        }
      }
    }
  }

  private delete(key: bigint): void {
    const z = this.bstFind(key);
    if (z === NIL) return;

    const zNode = this.nodes.get(z);
    if (!zNode) return;

    const hasTwoChildren = zNode.left !== NIL && zNode.right !== NIL;
    const y = hasTwoChildren ? this.successor(z) : z;

    const yNode = this.nodes.get(y);
    if (!yNode) return;

    const x = yNode.left !== NIL ? yNode.left : yNode.right;
    const yColor = hasTwoChildren ? yNode.color : zNode.color;

    if (hasTwoChildren) {
      zNode.key = yNode.key;
      this.nodes.set(z, zNode);
    }

    const yOldParent = this.parentOf(y);
    const yOldParentNode = yOldParent !== NIL ? this.nodes.get(yOldParent) : undefined;
    const yIsLeft = yOldParentNode !== undefined && yOldParentNode.left === y;

    if (yOldParent === NIL) {
      // y was root — this shouldn't happen if z had a parent, but handle it
    } else if (yIsLeft) {
      yOldParentNode!.left = x;
      this.nodes.set(yOldParent, yOldParentNode!);
    } else {
      yOldParentNode!.right = x;
      this.nodes.set(yOldParent, yOldParentNode!);
    }

    yNode.key = 0n;
    this.nodes.set(y, yNode);

    if (y === this.root) {
      this.root = x;
    }

    if (yColor === "B") {
      const fx = x;
      const fxPx = x === NIL ? yOldParent : NIL;
      const fxLeft = yIsLeft;
      this.deleteFixup(fx, fxPx, fxLeft);
    }

    this.recolor(this.root, "B");
    this.stepCount += 1n;
    this.recomputeBH();
  }
}
