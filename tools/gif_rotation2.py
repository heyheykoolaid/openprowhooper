# Advanced pass: per-frame camera rotation from FPV demo frames, robust to motion blur.
#   python3 tools/gif_rotation2.py <frames_dir> [out.json]
# Differences from gif_rotation.py (v1, consecutive frames only):
#  1. Lens calibration: picks the equidistant-fisheye field of view that best explains the clip's motion.
#  2. Blur bridging: a clear frame is matched to the next clear frame up to 6 frames later; the rotation is spread over
#     the gap, and the 360-degree ambiguity of a long gap is resolved with the rotation rate just before it.
#  3. Loop closure: for each burst of fast rotation, a clear frame before it is matched directly to a clear frame after
#     it. That gives the exact net rotation, which snaps the chained total to the right number of whole turns.
# Output frames: [roll, pitch, yaw] degrees per frame (camera axes, as v1), null where nothing could be estimated.
import sys, glob, math, json
import numpy as np, cv2

def load(d):
    files = sorted(glob.glob(d + '/*.png'))
    ims = [cv2.imread(f, cv2.IMREAD_GRAYSCALE) for f in files]
    H, W = ims[0].shape
    mask = np.full((H, W), 255, np.uint8); mask[int(H * 0.88):, :] = 0; mask[:int(H * 0.06), :] = 0
    sift = cv2.SIFT_create(1500)
    feats = [sift.detectAndCompute(cv2.equalizeHist(im), mask) for im in ims]
    return ims, feats, W, H

def kabsch(a, b):
    U, S, Vt = np.linalg.svd(a.T @ b); d = np.sign(np.linalg.det(Vt.T @ U.T))
    return Vt.T @ np.diag([1, 1, d]) @ U.T                    # b ~ R a

class Pairs:
    def __init__(s, feats, W, H):
        s.feats, s.W, s.H, s.bf, s.cache = feats, W, H, cv2.BFMatcher(), {}
    def matches(s, i, j):
        k = (i, j)
        if k not in s.cache:
            (k1, d1), (k2, d2) = s.feats[i], s.feats[j]; out = None
            if d1 is not None and d2 is not None and len(k1) > 20 and len(k2) > 20:
                m = [a for a, b in s.bf.knnMatch(d1, d2, k=2) if a.distance < 0.75 * b.distance]
                if len(m) >= 12: out = (np.float32([k1[x.queryIdx].pt for x in m]), np.float32([k2[x.trainIdx].pt for x in m]))
            s.cache[k] = out
        return s.cache[k]
    def bearings(s, pts, f):
        x = (pts[:, 0] - s.W / 2) / f; y = (pts[:, 1] - s.H / 2) / f
        th = np.hypot(x, y); ph = np.arctan2(y, x)
        return np.stack([np.sin(th) * np.cos(ph), np.sin(th) * np.sin(ph), np.cos(th)], 1)
    def rot(s, i, j, f, thr=0.02):
        m = s.matches(i, j)
        if m is None: return None
        A, B = s.bearings(m[0], f), s.bearings(m[1], f)
        rng = np.random.default_rng(0); best = None
        for _ in range(250):
            idx = rng.choice(len(A), 3, replace=False); R = kabsch(A[idx], B[idx])
            inl = np.linalg.norm(A @ R.T - B, axis=1) < thr
            if best is None or inl.sum() > best[1].sum(): best = (R, inl)
        R, inl = best
        if inl.sum() < 10 or inl.mean() < 0.3: return None
        R = kabsch(A[inl], B[inl]); res = float(np.median(np.linalg.norm(A[inl] @ R.T - B[inl], axis=1)))
        rv, _ = cv2.Rodrigues(R.T)                                      # camera's own rotation
        return rv.ravel(), int(inl.sum()), res

def to_rpy(rv):  # camera frame (x right, y down, z fwd) -> [roll, pitch, yaw] degrees, same convention as v1
    v = rv * 180 / math.pi; return np.array([v[2], -v[0], -v[1]])

def calibrate(P, n):
    pairs = [i for i in range(n - 1) if P.matches(i, i + 1) is not None and len(P.matches(i, i + 1)[0]) > 60][:40]
    if len(pairs) < 5: return 140.0
    def score(h):
        f = (P.W / 2) / math.radians(h / 2); rs = [r[2] for r in (P.rot(i, i + 1, f, thr=0.03) for i in pairs) if r]
        return (np.median(rs) if rs else 9) / max(1, len(rs)) ** 0.25
    hs = list(range(100, 181, 10)); best = min(hs, key=score)
    fine = [best - 5, best - 2.5, best, best + 2.5, best + 5]
    return float(min([h for h in fine if 90 <= h <= 190], key=score))

def measure(d):
    ims, feats, W, H = load(d); n = len(ims); P = Pairs(feats, W, H)
    hfov = calibrate(P, n); f = (W / 2) / math.radians(hfov / 2)
    per = [None] * (n - 1); src = [None] * (n - 1); last_rate = np.zeros(3); i = 0
    while i < n - 1:
        got = None
        for j in range(i + 1, min(n, i + 7)):
            r = P.rot(i, j, f)
            if r: got = (j, r); break
        if not got: i += 1; continue
        j, (rv, inl, res) = got; gap = j - i
        if gap > 1:   # 360 ambiguity: the other solution turns the opposite way round the same axis
            th = np.linalg.norm(rv)
            if th > 1e-6:
                alt = rv - rv / th * 2 * math.pi; pred = last_rate * gap * math.pi / 180
                if np.linalg.norm(pred) > 0.5 and np.linalg.norm(alt - pred) < np.linalg.norm(rv - pred): rv = alt
        step = to_rpy(rv) / gap
        for k in range(i, j): per[k] = step; src[k] = 'bridged' if gap > 1 else 'direct'
        last_rate = step * 1.0
        # remember the camera-frame rate (deg/frame) for the next ambiguity test
        last_rate = np.array([-step[1], -step[2], step[0]])   # back to rotation-vector axes (x, y, z) in degrees
        i = j
    # loop closure over bursts of fast rotation
    mag = np.array([np.linalg.norm(p) if p is not None else 0 for p in per])
    fixes = []
    k = 0
    while k < len(per):
        if mag[k] < 6 and per[k] is not None: k += 1; continue
        a = k
        while k < len(per) and (per[k] is None or mag[k] >= 3): k += 1
        b = k                                         # burst = frames a..b-1
        if b - a < 3: continue
        pre = [x for x in range(max(0, a - 6), a + 1) if per[x - 1 if x > 0 else 0] is not None][::-1]
        post = [x for x in range(b, min(n, b + 7))]
        closed = None
        for x in pre[:4]:
            for y in post[:5]:
                r = P.rot(x, y, f, thr=0.025)
                if r: closed = (x, y, to_rpy(r[0])); break
            if closed: break
        if not closed: continue
        x, y, net = closed
        chain = np.sum([per[q] for q in range(x, y) if per[q] is not None], axis=0)
        ax = int(np.argmax(np.abs(chain)))            # dominant axis of the burst
        if abs(chain[ax]) < 120: continue
        turns = round((chain[ax] - net[ax]) / 360.0)
        total = net[ax] + 360.0 * turns
        if abs(total - chain[ax]) > 120: continue     # closure disagrees too much: keep the chain
        scale = total / chain[ax]
        for q in range(x, y):
            if per[q] is not None: per[q] = per[q].copy(); per[q][ax] *= scale
        fixes.append({'frames': [x, y], 'axis': 'rpy'[ax], 'chained': round(float(chain[ax]), 1), 'closed': round(float(total), 1)})
    frames = [None if p is None else [round(float(v), 1) for v in p] for p in per]
    return {'hfov': hfov, 'frames': frames, 'source': src, 'closures': fixes,
            'tracked': sum(1 for p in per if p is not None), 'total': len(per)}

if __name__ == '__main__':
    out = measure(sys.argv[1])
    path = sys.argv[2] if len(sys.argv) > 2 else sys.argv[1] + '-rot2.json'
    json.dump(out, open(path, 'w'))
    print(f"{sys.argv[1]}: hfov {out['hfov']}, tracked {out['tracked']}/{out['total']}, closures {len(out['closures'])}: {out['closures'][:3]}")
