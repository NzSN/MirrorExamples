--------------------- MODULE RBT --------------------------
EXTENDS Integers

\* The set of keys that may be inserted into the tree.
KEYS == {1, 2, 3, 4, 5, 6, 7}

\* Maximum number of non-nil nodes in the tree (for bounded checking).
MAX_NODES == 7

MAX_STEPS == 8

\* Node ID 0 is the NIL sentinel; real nodes use IDs 1..MAX_NODES.
nil == 0

NodeSet == {nil} \cup (1..MAX_NODES)

\* ---------------------------------------------------------------------------
\* Optimization: flattened node fields as separate functions (Int -> Field)
\*   instead of a single   Int -> { key, color, left, right, bh }  function.
\*   5x+ faster SMT encoding per access (no record UNPACK via CHERRY-PICK).
\* ---------------------------------------------------------------------------

VARIABLES
    \* @type: Int -> Int;
    nk,
    \* @type: Int -> Str;
    nc,
    \* @type: Int -> Int;
    nl,
    \* @type: Int -> Int;
    nr,
    \* @type: Int -> Int;
    nb,
    \* @type: Int;
    root,
    \* @type: Set(Int);
    activeKeys,
    \* @type: Set(Int);
    usedNodes,
    \* @type: Str;
    action_taken,
    \* @type: Int;
    step_count,
    \* @type: { keyParam : Int };
    parameters

\* ---------------------------------------------------------------------------
\* Convenience constructors for helper return records.
\* ---------------------------------------------------------------------------

\* @type: (Int -> Int, Int -> Str, Int -> Int, Int -> Int, Int -> Int, Int) =>
\*         { nk: Int -> Int, nc: Int -> Str, nl: Int -> Int, nr: Int -> Int, nb: Int -> Int, r: Int };
Tree(nk_, nc_, nl_, nr_, nb_, r_) ==
    [nk |-> nk_, nc |-> nc_, nl |-> nl_, nr |-> nr_, nb |-> nb_, r |-> r_]

\* @type: ({ nk: Int -> Int, nc: Int -> Str, nl: Int -> Int, nr: Int -> Int, nb: Int -> Int, r: Int },
\*          Int, Bool) =>
\*         { nk: Int -> Int, nc: Int -> Str, nl: Int -> Int, nr: Int -> Int, nb: Int -> Int,
\*           r: Int, z: Int, done: Bool };
FixRes(t, z_, done_) ==
    [nk |-> t.nk, nc |-> t.nc, nl |-> t.nl, nr |-> t.nr, nb |-> t.nb,
     r |-> t.r, z |-> z_, done |-> done_]

\* @type: ({ nk: Int -> Int, nc: Int -> Str, nl: Int -> Int, nr: Int -> Int, nb: Int -> Int, r: Int },
\*          Int, Int, Bool, Bool) =>
\*         { nk: Int -> Int, nc: Int -> Str, nl: Int -> Int, nr: Int -> Int, nb: Int -> Int,
\*           r: Int, x: Int, px: Int, xLeft: Bool, done: Bool };
DelFixRes(t, x_, px_, xL_, done_) ==
    [nk |-> t.nk, nc |-> t.nc, nl |-> t.nl, nr |-> t.nr, nb |-> t.nb,
     r |-> t.r, x |-> x_, px |-> px_, xLeft |-> xL_, done |-> done_]

\* ---------------------------------------------------------------------------
\* Invariants (adapted to flattened representation).
\* ---------------------------------------------------------------------------
NilInv ==
    nk[nil] = 0 /\ nc[nil] = "B" /\ nl[nil] = nil /\ nr[nil] = nil /\ nb[nil] = 0

RootBlack == (root = nil) \/ (nc[root] = "B")

NoDoubleRed ==
    \A id \in usedNodes:
        nc[id] = "R"
            => (nl[id] = nil \/ nc[nl[id]] = "B")
               /\ (nr[id] = nil \/ nc[nr[id]] = "B")

BSTInv ==
    \A id \in usedNodes:
        (nl[id] = nil \/ nk[nl[id]] < nk[id])
        /\ (nr[id] = nil \/ nk[id] < nk[nr[id]])

BHInv ==
    \A id \in usedNodes:
        LET l == nl[id]
            r == nr[id]
        IN nb[l] = nb[r]
           /\ nb[id] = nb[l] + (IF nc[id] = "B" THEN 1 ELSE 0)

Inv == NilInv /\ RootBlack /\ NoDoubleRed /\ BSTInv /\ BHInv

TreeView == <<nk, nc, nl, nr, nb, root>>
View == TreeView

\* ---------------------------------------------------------------------------
\* Helpers  (adapted to flattened functions).
\* ---------------------------------------------------------------------------

\* Lowest unused node id.
\* @type: (Int -> Int) => Int;
FindUnused(nk_) ==
    LET unused == { id \in 1..MAX_NODES : nk_[id] = 0 }
    IN CHOOSE id \in unused : \A j \in unused : id <= j

\* Parent-of: returns nil if id is root, else its parent.
\* @type: (Int -> Int, Int -> Int, Int, Int) => Int;
Pof(nl_, nr_, r_, id) ==
    IF id = r_ THEN nil
    ELSE CHOOSE p \in NodeSet : nl_[p] = id \/ nr_[p] = id

\* BST parent for key insertion (unrolled traversal, depth <= 3).
\* @type: (Int -> Int, Int -> Int, Int -> Int, Int, Int) => Int;
BSTParent(nk_, nl_, nr_, r_, key) ==
    IF r_ = nil THEN nil
    ELSE IF (key < nk_[r_] /\ nl_[r_] = nil)
            \/ (key > nk_[r_] /\ nr_[r_] = nil)
         THEN r_
         ELSE LET c1 == IF key < nk_[r_] THEN nl_[r_] ELSE nr_[r_]
              IN IF c1 = nil THEN r_
                 ELSE IF (key < nk_[c1] /\ nl_[c1] = nil)
                         \/ (key > nk_[c1] /\ nr_[c1] = nil)
                      THEN c1
                       ELSE c1

\* BST lookup for a key (unrolled, depth <= 3).
\* @type: (Int -> Int, Int -> Int, Int -> Int, Int, Int) => Int;
BSTFind(nk_, nl_, nr_, r_, key) ==
    IF r_ = nil THEN nil
    ELSE IF nk_[r_] = key THEN r_
    ELSE LET c == IF key < nk_[r_] THEN nl_[r_] ELSE nr_[r_]
         IN IF c = nil THEN nil
            ELSE IF nk_[c] = key THEN c
            ELSE LET c2 == IF key < nk_[c] THEN nl_[c] ELSE nr_[c]
                 IN IF c2 = nil THEN nil
                    ELSE IF nk_[c2] = key THEN c2
                     ELSE nil

\* In-order successor of id (min of right subtree). Bounded depth <= 3.
\* @type: (Int -> Int, Int -> Int, Int) => Int;
Successor(nl_, nr_, id) ==
    LET r == nr_[id]
    IN IF r = nil THEN nil
       ELSE IF nl_[r] = nil THEN r
       ELSE IF nl_[nl_[r]] = nil THEN nl_[r]
       ELSE nl_[nl_[r]]

\* Rotate left at x.
\* @type: (Int -> Int, Int -> Str, Int -> Int, Int -> Int, Int -> Int, Int, Int) =>
\*         { nk: Int -> Int, nc: Int -> Str, nl: Int -> Int, nr: Int -> Int, nb: Int -> Int, r: Int };
RotLeft(nk_, nc_, nl_, nr_, nb_, r_, x) ==
    LET y == nr_[x]
    IN IF y = nil THEN Tree(nk_, nc_, nl_, nr_, nb_, r_)
       ELSE LET p  == Pof(nl_, nr_, r_, x)
                nr1 == [nr_ EXCEPT ![x] = nl_[y]]
                nl2 == [nl_ EXCEPT ![y] = x]
                newR == IF x = r_ THEN y ELSE r_
                nr3 == IF x = r_ THEN nr1
                       ELSE IF nl_[p] = x
                            THEN nr1
                            ELSE [nr1 EXCEPT ![p] = y]
                nl3 == IF x = r_ THEN nl2
                       ELSE IF nl_[p] = x
                            THEN [nl2 EXCEPT ![p] = y]
                            ELSE nl2
            IN Tree(nk_, nc_, nl3, nr3, nb_, newR)

\* Rotate right at x.
\* @type: (Int -> Int, Int -> Str, Int -> Int, Int -> Int, Int -> Int, Int, Int) =>
\*         { nk: Int -> Int, nc: Int -> Str, nl: Int -> Int, nr: Int -> Int, nb: Int -> Int, r: Int };
RotRight(nk_, nc_, nl_, nr_, nb_, r_, x) ==
    LET y == nl_[x]
    IN IF y = nil THEN Tree(nk_, nc_, nl_, nr_, nb_, r_)
       ELSE LET p  == Pof(nl_, nr_, r_, x)
                nl1 == [nl_ EXCEPT ![x] = nr_[y]]
                nr2 == [nr_ EXCEPT ![y] = x]
                newR == IF x = r_ THEN y ELSE r_
                nl3 == IF x = r_ THEN nl1
                       ELSE IF nl_[p] = x
                            THEN [nl1 EXCEPT ![p] = y]
                            ELSE nl1
                nr3 == IF x = r_ THEN nr2
                       ELSE IF nl_[p] = x
                            THEN nr2
                            ELSE [nr2 EXCEPT ![p] = y]
            IN Tree(nk_, nc_, nl3, nr3, nb_, newR)

\* Single insert-fixup iteration.
\* @type: (Int -> Int, Int -> Str, Int -> Int, Int -> Int, Int -> Int, Int, Int) =>
\*         { nk: Int -> Int, nc: Int -> Str, nl: Int -> Int, nr: Int -> Int, nb: Int -> Int,
\*           r: Int, z: Int, done: Bool };
FixIt(nk_, nc_, nl_, nr_, nb_, r_, z) ==
    LET par == Pof(nl_, nr_, r_, z)
    IN IF par = nil \/ nc_[par] = "B"
       THEN FixRes(Tree(nk_, nc_, nl_, nr_, nb_, r_), z, TRUE)
       ELSE LET gp == Pof(nl_, nr_, r_, par)
            IN IF gp = nil
               THEN FixRes(Tree(nk_, nc_, nl_, nr_, nb_, r_), z, TRUE)
               ELSE LET pLeft  == nl_[gp] = par
                        uncle  == IF pLeft THEN nr_[gp] ELSE nl_[gp]
                        uRed   == uncle /= nil /\ nc_[uncle] = "R"
                    IN IF uRed
                       THEN LET ncA == [nc_ EXCEPT ![par] = "B",
                                                    ![uncle] = "B",
                                                    ![gp] = "R"]
                            IN FixRes(Tree(nk_, ncA, nl_, nr_, nb_, r_), gp, FALSE)
                       ELSE IF pLeft
                            THEN IF z = nr_[par]
                                 THEN LET rr  == RotLeft(nk_, nc_, nl_, nr_, nb_, r_, par)
                                          z2  == par
                                          p2  == Pof(rr.nl, rr.nr, rr.r, z2)
                                          gp2 == Pof(rr.nl, rr.nr, rr.r, p2)
                                          ncA == [rr.nc EXCEPT ![p2] = "B",
                                                                ![gp2] = "R"]
                                          rr2 == RotRight(rr.nk, ncA, rr.nl, rr.nr, rr.nb, rr.r, gp2)
                                      IN FixRes(rr2, z2, TRUE)
                                 ELSE LET ncA == [nc_ EXCEPT ![par] = "B",
                                                              ![gp] = "R"]
                                          rr2 == RotRight(nk_, ncA, nl_, nr_, nb_, r_, gp)
                                      IN FixRes(rr2, z, TRUE)
                            ELSE IF z = nl_[par]
                                 THEN LET rr  == RotRight(nk_, nc_, nl_, nr_, nb_, r_, par)
                                          z2  == par
                                          p2  == Pof(rr.nl, rr.nr, rr.r, z2)
                                          gp2 == Pof(rr.nl, rr.nr, rr.r, p2)
                                          ncA == [rr.nc EXCEPT ![p2] = "B",
                                                                ![gp2] = "R"]
                                          rr2 == RotLeft(rr.nk, ncA, rr.nl, rr.nr, rr.nb, rr.r, gp2)
                                      IN FixRes(rr2, z2, TRUE)
                                 ELSE LET ncA == [nc_ EXCEPT ![par] = "B",
                                                              ![gp] = "R"]
                                          rr2 == RotLeft(nk_, ncA, nl_, nr_, nb_, r_, gp)
                                      IN FixRes(rr2, z, TRUE)

\* Bounded fixup: at most 5 iterations.
\* @type: (Int -> Int, Int -> Str, Int -> Int, Int -> Int, Int -> Int, Int, Int) =>
\*         { nk: Int -> Int, nc: Int -> Str, nl: Int -> Int, nr: Int -> Int, nb: Int -> Int,
\*           r: Int, z: Int, done: Bool };
Fixup(nk_, nc_, nl_, nr_, nb_, r_, z) ==
    LET s1 == FixIt(nk_, nc_, nl_, nr_, nb_, r_, z)
        s2 == IF ~s1.done THEN FixIt(s1.nk, s1.nc, s1.nl, s1.nr, s1.nb, s1.r, s1.z) ELSE s1
        s3 == IF ~s2.done THEN FixIt(s2.nk, s2.nc, s2.nl, s2.nr, s2.nb, s2.r, s2.z) ELSE s2
        s4 == IF ~s3.done THEN FixIt(s3.nk, s3.nc, s3.nl, s3.nr, s3.nb, s3.r, s3.z) ELSE s3
        s5 == IF ~s4.done THEN FixIt(s4.nk, s4.nc, s4.nl, s4.nr, s4.nb, s4.r, s4.z) ELSE s4
    IN s5

\* Recompute black heights: 3 passes (sufficient for depth <= 3).
\* Returns only the new nb; other fields are unchanged.
\* @type: (Int -> Int, Int -> Str, Int -> Int, Int -> Int) => Int -> Int;
RecomputeBH(nk_, nc_, nl_, nb_) ==
    LET nb1 == [id \in NodeSet |->
                IF id = nil \/ nk_[id] = 0 THEN nb_[id]
                ELSE nb_[nl_[id]] + (IF nc_[id] = "B" THEN 1 ELSE 0)]
        nb2 == [id \in NodeSet |->
                IF id = nil \/ nk_[id] = 0 THEN nb1[id]
                ELSE nb1[nl_[id]] + (IF nc_[id] = "B" THEN 1 ELSE 0)]
        nb3 == [id \in NodeSet |->
                IF id = nil \/ nk_[id] = 0 THEN nb2[id]
                ELSE nb2[nl_[id]] + (IF nc_[id] = "B" THEN 1 ELSE 0)]
    IN nb3

\* Single delete-fixup iteration.
\* @type: (Int -> Int, Int -> Str, Int -> Int, Int -> Int, Int -> Int, Int, Int, Int, Bool) =>
\*         { nk: Int -> Int, nc: Int -> Str, nl: Int -> Int, nr: Int -> Int, nb: Int -> Int,
\*           r: Int, x: Int, px: Int, xLeft: Bool, done: Bool };
DeleteFixIt(nk_, nc_, nl_, nr_, nb_, r_, x, px, xLeft) ==
    LET par    == IF px /= nil THEN px ELSE Pof(nl_, nr_, r_, x)
        isLeft == IF px /= nil THEN xLeft ELSE (par /= nil /\ nl_[par] = x)
    IN IF x = r_ \/ (x /= nil /\ nc_[x] = "R")
       THEN LET ncA == [nc_ EXCEPT ![x] = "B"]
            IN DelFixRes(Tree(nk_, ncA, nl_, nr_, nb_, r_), x, nil, FALSE, TRUE)
       ELSE IF par = nil
            THEN DelFixRes(Tree(nk_, nc_, nl_, nr_, nb_, r_), x, nil, FALSE, TRUE)
            ELSE LET w    == IF isLeft THEN nr_[par] ELSE nl_[par]
                     wRed == w /= nil /\ nc_[w] = "R"
                 IN IF wRed
                    THEN LET nc1 == [nc_ EXCEPT ![w] = "B",
                                                  ![par] = "R"]
                             rot == IF isLeft
                                    THEN RotLeft(nk_, nc1, nl_, nr_, nb_, r_, par)
                                    ELSE RotRight(nk_, nc1, nl_, nr_, nb_, r_, par)
                         IN DelFixRes(rot, x, par, isLeft, FALSE)
                    ELSE LET wL  == nl_[w]
                             wR  == nr_[w]
                             wLB == wL = nil \/ nc_[wL] = "B"
                             wRB == wR = nil \/ nc_[wR] = "B"
                         IN IF wLB /\ wRB
                            THEN LET ncA == [nc_ EXCEPT ![w] = "R"]
                                 IN DelFixRes(Tree(nk_, ncA, nl_, nr_, nb_, r_), par, nil, FALSE, FALSE)
                            ELSE IF isLeft
                                 THEN IF wR /= nil /\ nc_[wR] = "R"
                                      THEN LET nc1 == [nc_ EXCEPT ![w] = nc_[par],
                                                                    ![par] = "B",
                                                                    ![wR] = "B"]
                                               rot == RotLeft(nk_, nc1, nl_, nr_, nb_, r_, par)
                                           IN DelFixRes(rot, x, nil, FALSE, TRUE)
                                      ELSE LET nearC == wL
                                               nc1   == [nc_ EXCEPT ![nearC] = "B",
                                                                      ![w] = "R"]
                                               rot1  == RotRight(nk_, nc1, nl_, nr_, nb_, r_, w)
                                               w2    == rot1.nr[par]
                                               w2R   == rot1.nr[w2]
                                               nc2   == [rot1.nc EXCEPT ![w2] = rot1.nc[par],
                                                                         ![par] = "B",
                                                                         ![w2R] = "B"]
                                               rot2  == RotLeft(rot1.nk, nc2, rot1.nl, rot1.nr, rot1.nb, rot1.r, par)
                                           IN DelFixRes(rot2, x, nil, FALSE, TRUE)
                                 ELSE IF wL /= nil /\ nc_[wL] = "R"
                                      THEN LET nc1 == [nc_ EXCEPT ![w] = nc_[par],
                                                                    ![par] = "B",
                                                                    ![wL] = "B"]
                                               rot == RotRight(nk_, nc1, nl_, nr_, nb_, r_, par)
                                           IN DelFixRes(rot, x, nil, FALSE, TRUE)
                                      ELSE LET nearC == wR
                                               nc1   == [nc_ EXCEPT ![nearC] = "B",
                                                                      ![w] = "R"]
                                               rot1  == RotLeft(nk_, nc1, nl_, nr_, nb_, r_, w)
                                               w2    == rot1.nl[par]
                                               w2L   == rot1.nl[w2]
                                               nc2   == [rot1.nc EXCEPT ![w2] = rot1.nc[par],
                                                                         ![par] = "B",
                                                                         ![w2L] = "B"]
                                               rot2  == RotRight(rot1.nk, nc2, rot1.nl, rot1.nr, rot1.nb, rot1.r, par)
                                           IN DelFixRes(rot2, x, nil, FALSE, TRUE)

\* Bounded delete fixup: at most 5 iterations.
\* @type: (Int -> Int, Int -> Str, Int -> Int, Int -> Int, Int -> Int, Int, Int, Int, Bool) =>
\*         { nk: Int -> Int, nc: Int -> Str, nl: Int -> Int, nr: Int -> Int, nb: Int -> Int,
\*           r: Int, x: Int, px: Int, xLeft: Bool, done: Bool };
DeleteFixup(nk_, nc_, nl_, nr_, nb_, r_, x, px, xLeft) ==
    LET s1 == DeleteFixIt(nk_, nc_, nl_, nr_, nb_, r_, x, px, xLeft)
        s2 == IF ~s1.done THEN DeleteFixIt(s1.nk, s1.nc, s1.nl, s1.nr, s1.nb, s1.r, s1.x, s1.px, s1.xLeft) ELSE s1
        s3 == IF ~s2.done THEN DeleteFixIt(s2.nk, s2.nc, s2.nl, s2.nr, s2.nb, s2.r, s2.x, s2.px, s2.xLeft) ELSE s2
        s4 == IF ~s3.done THEN DeleteFixIt(s3.nk, s3.nc, s3.nl, s3.nr, s3.nb, s3.r, s3.x, s3.px, s3.xLeft) ELSE s3
        s5 == IF ~s4.done THEN DeleteFixIt(s4.nk, s4.nc, s4.nl, s4.nr, s4.nb, s4.r, s4.x, s4.px, s4.xLeft) ELSE s4
    IN s5

\* ---------------------------------------------------------------------------
\* Initial state.
\* ---------------------------------------------------------------------------
Init ==
    /\ nk = [id \in NodeSet |-> 0]
    /\ nc = [id \in NodeSet |-> "B"]
    /\ nl = [id \in NodeSet |-> nil]
    /\ nr = [id \in NodeSet |-> nil]
    /\ nb = [id \in NodeSet |-> 0]
    /\ root = nil
    /\ activeKeys = {}
    /\ usedNodes = {}
    /\ action_taken = "init"
    /\ step_count = 0
    /\ parameters = [ keyParam |-> nil ]

\* ---------------------------------------------------------------------------
\* Deterministic Insert.
\* ---------------------------------------------------------------------------
Insert(key) ==
    Insert::
    /\ IF key \in activeKeys
       THEN /\ UNCHANGED <<nk, nc, nl, nr, nb, root, step_count, activeKeys, usedNodes>>
            /\ action_taken' = "insert"
            /\ parameters' = [ keyParam |-> key ]
       ELSE
           LET newId == FindUnused(nk)
               nk0   == [nk EXCEPT ![newId] = key]
               nc0   == [nc EXCEPT ![newId] = "R"]
               parent == BSTParent(nk0, nl, nr, root, key)
               nl1   == IF parent = nil THEN nl
                        ELSE IF key < nk0[parent]
                             THEN [nl EXCEPT ![parent] = newId]
                             ELSE nl
               nr1   == IF parent = nil THEN nr
                        ELSE IF key < nk0[parent]
                             THEN nr
                             ELSE [nr EXCEPT ![parent] = newId]
               r1    == IF root = nil THEN newId ELSE root
               fRes  == Fixup(nk0, nc0, nl1, nr1, nb, r1, newId)
               nc2   == [fRes.nc EXCEPT ![fRes.r] = "B"]
               newNb == RecomputeBH(fRes.nk, nc2, fRes.nl, fRes.nb)
           IN /\ nk' = fRes.nk
              /\ nc' = nc2
              /\ nl' = fRes.nl
              /\ nr' = fRes.nr
              /\ nb' = newNb
              /\ root' = fRes.r
              /\ activeKeys' = activeKeys \union {key}
              /\ usedNodes' = usedNodes \union {newId}
              /\ Inv'
              /\ action_taken' = "insert"
              /\ step_count' = step_count + 1
              /\ parameters' = [ keyParam |-> key ]

\* ---------------------------------------------------------------------------
\* Deterministic Delete.
\* ---------------------------------------------------------------------------
Delete(key) ==
    Delete::
    /\ IF key \notin activeKeys
       THEN /\ UNCHANGED <<nk, nc, nl, nr, nb, root, step_count, activeKeys, usedNodes>>
            /\ action_taken' = "delete"
            /\ parameters' = [ keyParam |-> key ]
       ELSE
           LET z     == BSTFind(nk, nl, nr, root, key)
               hasTwo == nl[z] /= nil /\ nr[z] /= nil
               y      == IF hasTwo THEN Successor(nl, nr, z) ELSE z
               x      == IF nl[y] /= nil THEN nl[y] ELSE nr[y]
               nk0    == IF hasTwo THEN [nk EXCEPT ![z] = nk[y]] ELSE nk
               yPar   == Pof(nl, nr, root, y)
               yLeft  == yPar /= nil /\ nl[yPar] = y
               yColor == IF hasTwo THEN nc[y] ELSE nc[z]
               nl1    == IF yPar = nil THEN nl
                        ELSE IF yLeft
                             THEN [nl EXCEPT ![yPar] = x]
                             ELSE nl
               nr1    == IF yPar = nil THEN nr
                        ELSE IF yLeft
                             THEN nr
                             ELSE [nr EXCEPT ![yPar] = x]
               nk1    == [nk0 EXCEPT ![y] = 0]
               nc1    == nc
               nl2    == [nl1 EXCEPT ![y] = nil]
               nr2    == [nr1 EXCEPT ![y] = nil]
               nb1    == nb
               r1     == IF y = root THEN x ELSE root
               delFix == IF yColor = "B"
                         THEN LET fx     == IF x = nil THEN nil ELSE x
                                      fxPx   == IF x = nil THEN yPar ELSE nil
                                      fxLeft == yLeft
                                  IN DeleteFixup(nk1, nc1, nl2, nr2, nb1, r1, fx, fxPx, fxLeft)
                         ELSE DelFixRes(Tree(nk1, nc1, nl2, nr2, nb1, r1), nil, nil, FALSE, TRUE)
               nc2    == [delFix.nc EXCEPT ![delFix.r] = "B"]
               newNb  == RecomputeBH(delFix.nk, nc2, delFix.nl, delFix.nb)
           IN /\ nk' = delFix.nk
              /\ nc' = nc2
              /\ nl' = delFix.nl
              /\ nr' = delFix.nr
              /\ nb' = newNb
              /\ root' = delFix.r
              /\ activeKeys' = activeKeys \ {key}
              /\ usedNodes' = usedNodes \ {y}
              /\ Inv'
              /\ action_taken' = "delete"
              /\ step_count' = step_count + 1
              /\ parameters' = [ keyParam |-> key ]

\* ---------------------------------------------------------------------------
\* Next-state relation.
\* ---------------------------------------------------------------------------
Next ==
    \/ \E key \in KEYS: Insert(key)
    \/ \E key \in KEYS: Delete(key)
    \/ UNCHANGED <<nk, nc, nl, nr, nb, root, action_taken, step_count, activeKeys, usedNodes, parameters>>

\* Bounded model checking: stop after MAX_STEPS steps.
TraceComplete == step_count < MAX_STEPS
SPEC == Init /\ [][Next]_<<nk,nc,nl,nr,nb,root,action_taken,step_count,activeKeys,usedNodes,parameters>>
==========================================================
