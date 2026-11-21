#!/usr/bin/env python3
"""The learned witness (owner, 2026-11-21): a small classifier trained on the trick library that says, for a move the rules
called trick X, how much it looks like the confirmed examples of X. One more soft vote in the Watcher (`votes.learned`), never a
veto and never a namer: the rules stay the judge.

    python3 tools/witness.py            # train, test, print the report
    python3 tools/witness.py --write    # … and write community/witness.json (shipped by build.py) + community/WITNESS.md

Training data: library/library.json (tools/library.js): the demo GIFs and pilots' confirmed tricks, as signatures (rotation per
axis along the move, up.y, duration, passes, sticks). Tricks with fewer than MIN confirmed examples are left out (no vote there).
Small data is padded with NOISE (`augment`): each real example also trains as several slightly different copies of itself, the ways
one pilot's rep differs from the next: the label's ends a little early or late, time stretched unevenly, a bit more or less
rotation, some roll read as yaw (camera tilt), wandering sticks. Rejected calls are never trained on: they are the test.
The model is extra-trees (numpy + scikit-learn to train; the game reads the trees as plain arrays: `witnessProb` in src/sim.js,
whose features must match `feats` here: test/witness.js checks both give the same answers).
"""
import json, sys, pathlib, datetime
import numpy as np
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.metrics import roc_auc_score

ROOT = pathlib.Path(__file__).resolve().parent.parent
MIN, TREES, DEPTH, LEAF, AUG, SEED = 4, 60, 10, 2, 6, 7
VOTE_MIN, VOTE_FOUND = 8, 0.7
PS = 'UOG'
NF = 24 * 3 + 24 + 1 + 3 + 3 + 4 + 9


def feats(c, u, d, ps, k):
    """One signature as numbers. Mirrored by witFeats in src/sim.js: change both together."""
    c = np.asarray(c, float).reshape(24, 3) / 360.0
    u = (np.asarray(u, float) if u is not None else np.full(24, 100.0)) / 100.0
    d = max(float(d), 0.1)
    tot = np.abs(c[-1])
    rate = np.abs(np.diff(c, axis=0)).sum(0) / d
    # the passes (unknown, as for a demo GIF, reads as none). No "is it known" flag and no sticks: both told the model where an
    # example came from (demo or pilot) rather than what the move was (a clean synthetic roll got 8 %).
    p = np.zeros(9)
    if isinstance(ps, str):
        p[0] = min(len(ps), 6) / 6
        for i, ch in enumerate(PS):
            p[1 + i] = min(ps.count(ch), 3) / 3
        if ps and ps[0] in PS:
            p[4 + PS.index(ps[0])] = 1
        p[7] = 1 if 'OU' in ps else 0
        p[8] = 1 if 'UO' in ps else 0
    return np.concatenate([c.ravel(), u, [np.log(d)], tot, rate, [u.min(), u.mean(), u[-1], (u < -0.3).mean()], p])


def resamp(a, x):
    i = np.clip(np.floor(x).astype(int), 0, 22)
    fr = (x - i)[:, None]
    return a[i] * (1 - fr) + a[i + 1] * fr


def augment(e, rng):
    """A noisy copy of one example: the same trick as another rep of it might have been measured."""
    c = np.asarray(e['c'], float).reshape(24, 3)
    u = (np.asarray(e['u'], float) if e.get('u') else np.full(24, 100.0))[:, None]
    t = np.linspace(0, 1, 24)
    a, b = rng.uniform(0, 0.08), 1 - rng.uniform(0, 0.08)                      # the label starts / ends a little off
    w = a + (b - a) * (t + rng.uniform(-0.12, 0.12) * np.sin(np.pi * t) / np.pi)   # time stretched unevenly
    x = np.clip(w, 0, 1) * 23
    c2 = resamp(c, x)
    c2 = c2 - c2[0]
    u2 = resamp(u, x)[:, 0]
    c2 = c2 * rng.uniform(0.88, 1.12, 3)                                       # a bit more or less rotation per axis
    m = rng.uniform(-0.15, 0.15)                                               # camera tilt reads some roll as yaw
    r, y = c2[:, 0].copy(), c2[:, 2].copy()
    c2[:, 0] = r + m * y
    c2[:, 2] = y - m * r
    nz = np.cumsum(rng.normal(0, 2.5, (24, 3)), axis=0)                        # wandering sticks
    c2 = c2 + nz - nz[0]
    u2 = np.clip(u2 + rng.normal(0, 5, 24), -100, 100)
    return feats(c2.ravel(), u2, e['d'] * (b - a) * rng.uniform(0.85, 1.2), e.get('ps'), e.get('k'))


def main():
    write = '--write' in sys.argv
    lib = json.loads((ROOT / 'library' / 'library.json').read_text())
    E = [e for e in lib['examples'] if isinstance(e.get('c'), list) and len(e['c']) == 72]
    n = len(E)
    X = np.array([feats(e['c'], e.get('u'), e['d'], e.get('ps'), e.get('k')) for e in E])
    assert X.shape[1] == NF
    pos = np.array([not e.get('neg') for e in E])
    T = np.array([e['t'] for e in E])
    P = np.array([str(e.get('p') or 'demo') for e in E])
    W = np.array([float(np.clip(e.get('w', 1), 0.3, 1.5)) for e in E])
    cnt = {t: int(((T == t) & pos).sum()) for t in set(T)}
    cls = sorted(t for t in cnt if cnt[t] >= MIN)
    ci = {t: i for i, t in enumerate(cls)}
    idx = np.array([i for i in range(n) if pos[i] and T[i] in ci])
    neg = np.array([i for i in range(n) if not pos[i] and T[i] in ci])
    rng = np.random.default_rng(SEED)

    def train(tr, seed=1):
        Xt, yt, wt = [X[i] for i in tr], [ci[T[i]] for i in tr], [W[i] for i in tr]
        for i in tr:
            for _ in range(AUG * (2 if cnt[T[i]] < 10 else 1)):
                Xt.append(augment(E[i], rng))
                yt.append(ci[T[i]])
                wt.append(0.5 * W[i])
        return ExtraTreesClassifier(TREES, max_depth=DEPTH, min_samples_leaf=LEAF, random_state=seed,
                                    class_weight='balanced_subsample').fit(np.array(Xt), yt, sample_weight=wt)

    def proba(m, rows):
        out = np.zeros((len(rows), len(cls)))
        out[:, m.classes_] = m.predict_proba(X[rows])
        return out

    # --- tests: (A) every pilot in training, 5 folds; (B) a pilot the model never saw
    def test(folds):
        sp, top = {}, []
        for te in folds:
            te = [i for i in te if i in set(idx)]
            if not te:
                continue
            m = train(np.array([i for i in idx if i not in set(te)]))
            pr = proba(m, te)
            for r, i in enumerate(te):
                sp[i] = pr[r][ci[T[i]]]
                top.append(cls[int(pr[r].argmax())] == T[i])
        return sp, float(np.mean(top)), len(top)

    perm = rng.permutation(idx)
    folds, seen = [[] for _ in range(5)], {}
    for i in perm:
        k = seen.get(T[i], 0)
        folds[k % 5].append(i)
        seen[T[i]] = k + 1
    spA, topA, nA = test(folds)
    pilots = sorted(set(P[idx]) - {'demo'})
    spB, topB, nB = test([[i for i in idx if P[i] == p] for p in pilots])

    model = train(idx)
    pn = proba(model, neg) if len(neg) else np.zeros((0, len(cls)))
    sn = [pn[r][ci[T[i]]] for r, i in enumerate(neg)]

    def auc(sp):
        ii = [i for i in idx if i in sp]
        return roc_auc_score([1] * len(ii) + [0] * len(sn), [sp[i] for i in ii] + sn) if len(sn) and ii else float('nan')

    a = np.array([spA[i] for i in idx if i in spA])
    sn_a = np.array(sn)
    lines = [
        '# The learned witness', '',
        f'{datetime.datetime.utcnow():%Y-%m-%d %H:%M} UTC · trained on {len(idx)} confirmed examples of {len(cls)} tricks '
        f'({MIN}+ examples each) from the trick library, each with {AUG}-{AUG * 2} noisy copies · tested on {len(neg)} calls pilots rejected.', '',
        '| test | names the trick (top-1) | tells a confirmed call from a rejected one (AUC; 0.5 = a coin, 1 = perfect) |', '|---|---|---|',
        f'| every pilot in training (5 folds) | {topA * 100:.0f} % of {nA} | {auc(spA):.2f} |',
        f'| a pilot it never saw | {topB * 100:.0f} % of {nB} | {auc(spB):.2f} |', '',
        'As a doubt: a call the witness gives under 10 % is ' +
        (f'{np.mean(sn_a < 0.1) * 100:.0f} % of the rejected calls and {np.mean(a < 0.1) * 100:.0f} % of the confirmed ones.' if len(sn) else 'untested (no rejected calls).'),
        '', 'It votes in the Watcher (`votes.learned`, weight 1; the library 2) on the tricks marked below (8+ confirmed examples, 70 % of them found), never vetoes and never names a trick.', '',
        '| trick | confirmed examples | rejected calls | found (5 folds) | votes |', '|---|---|---|---|---|']
    vote = []   # it only votes on tricks it has shown it knows: VOTE_MIN+ confirmed examples, VOTE_FOUND of them given 10 % or more
    for t in sorted(cls, key=lambda t: -cnt[t]):
        ii = [i for i in idx if T[i] == t and i in spA]
        found = float(np.mean([spA[i] >= 0.1 for i in ii]))
        if cnt[t] >= VOTE_MIN and found >= VOTE_FOUND:
            vote.append(t)
        lines.append(f'| {t} | {cnt[t]} | {int(((T == t) & ~pos).sum())} | {found * 100:.0f} % | {"yes" if t in vote else "not yet"} |')
    report = '\n'.join(lines) + '\n'
    print(report)

    # --- the model as plain arrays: per tree f (feature, -1 = leaf), t (threshold), r (right child; the left child is the next
    # node; at a leaf: its index in v), v (per leaf: class, percent, class, percent …; under 3 % dropped)
    trees = []
    for est in model.estimators_:
        tr = est.tree_
        f, th, r, v = [], [], [], []
        for k in range(tr.node_count):
            if tr.children_left[k] < 0:
                val = tr.value[k][0]
                val = val / max(val.sum(), 1e-12)
                row = []
                for c in np.argsort(-val)[:4]:
                    if val[c] >= 0.03:
                        row += [int(model.classes_[c]), int(round(val[c] * 100))]
                f.append(-1); th.append(0); r.append(len(v)); v.append(row)
            else:
                assert tr.children_left[k] == k + 1
                f.append(int(tr.feature[k])); th.append(float(f'{tr.threshold[k]:.7g}')); r.append(int(tr.children_right[k]))
        trees.append({'f': f, 't': th, 'r': r, 'v': v})
    out = {'format': 'pro-whooper-witness/1', 'updated': f'{datetime.date.today()}', 'nf': NF, 'classes': cls, 'vote': vote, 'trees': trees,
           'stats': {'examples': int(len(idx)), 'rejected': int(len(neg)), 'top1': round(topA, 3), 'auc': round(float(auc(spA)), 3), 'aucNewPilot': round(float(auc(spB)), 3)}}
    # a few answers for test/witness.js: the JS reading of the trees and its features must give the same numbers
    pick = list(rng.choice(idx, 12, replace=False)) + list(neg[:6])
    pr = proba(model, pick)
    check = [{'t': str(T[i]), 'sig': {'c': E[i]['c'], 'u': E[i].get('u'), 'd': E[i]['d'], 'ps': E[i].get('ps'), 'k': E[i].get('k')},
              'p': round(float(pr[r][ci[T[i]]]), 4)} for r, i in enumerate(pick)]
    out['check'] = check
    txt = json.dumps(out, separators=(',', ':'))
    print(f'model: {len(trees)} trees, {sum(len(t["v"]) for t in trees)} leaves, {len(txt) / 1024:.0f} KB')
    if write:
        (ROOT / 'community' / 'witness.json').write_text(txt)
        (ROOT / 'community' / 'WITNESS.md').write_text(report)
        print('wrote community/witness.json, community/WITNESS.md')


if __name__ == '__main__':
    main()
