# Usage: extract frames to <dir>/NNN.png, then: python3 tools/gif_rotation.py <dir> [hfov_deg]
# Prints per-frame camera rotation (deg) and writes <dir>-rot.json. Blurred frames (fast flips) fail to match.
# Note: GIF frame timing is not real time. Use the goggle OSD clock to get real seconds per frame.
# Frame-to-frame camera rotation from FPV GIF frames (rotation-only model, equidistant fisheye).
import sys, glob, math, json
import numpy as np, cv2
d = sys.argv[1]; hfov = float(sys.argv[2]) if len(sys.argv) > 2 else 140
files = sorted(glob.glob(d + '/*.png'))
imgs = [cv2.imread(f, cv2.IMREAD_GRAYSCALE) for f in files]
H, W = imgs[0].shape; cx, cy = W / 2, H / 2; f = (W / 2) / math.radians(hfov / 2)
# mask OSD text rows at the bottom
mask = np.full((H, W), 255, np.uint8); mask[int(H * 0.88):, :] = 0
sift = cv2.SIFT_create(1500)
feats = [sift.detectAndCompute(cv2.equalizeHist(im), mask) for im in imgs]
def bearings(pts):
    x = (pts[:, 0] - cx) / f; y = (pts[:, 1] - cy) / f
    th = np.hypot(x, y); ph = np.arctan2(y, x)
    return np.stack([np.sin(th) * np.cos(ph), np.sin(th) * np.sin(ph), np.cos(th)], 1)  # cam: x right, y down, z fwd
def kabsch(a, b):
    Hm = a.T @ b; U, S, Vt = np.linalg.svd(Hm); dd = np.sign(np.linalg.det(Vt.T @ U.T))
    return Vt.T @ np.diag([1, 1, dd]) @ U.T   # b ≈ R a
bf = cv2.BFMatcher()
out = []
for i in range(len(imgs) - 1):
    (k1, d1), (k2, d2) = feats[i], feats[i + 1]
    res = None
    if d1 is not None and d2 is not None and len(k1) > 20 and len(k2) > 20:
        m = [a for a, b in bf.knnMatch(d1, d2, k=2) if a.distance < 0.75 * b.distance]
        if len(m) >= 12:
            A = bearings(np.float32([k1[x.queryIdx].pt for x in m])); B = bearings(np.float32([k2[x.trainIdx].pt for x in m]))
            best = None; rng = np.random.default_rng(0)
            for _ in range(300):
                s = rng.choice(len(m), 3, replace=False); R = kabsch(A[s], B[s])
                inl = np.linalg.norm((A @ R.T) - B, axis=1) < 0.02
                if best is None or inl.sum() > best[1].sum(): best = (R, inl)
            R, inl = best
            if inl.sum() >= 10 and inl.mean() > 0.3:
                R = kabsch(A[inl], B[inl])
                # world-from-cam rotation increment: camera rotates by R^T. axis-angle in camera frame
                rv, _ = cv2.Rodrigues(R.T)
                rv = rv.ravel() * 180 / math.pi
                # camera axes -> craft: roll about z(fwd), pitch about x(right), yaw about y(down)
                res = dict(roll=float(rv[2]), pitch=float(-rv[0]), yaw=float(-rv[1]), n=int(inl.sum()))
    out.append(res)
json.dump(out, open(d + '-rot.json', 'w'))
for i, r in enumerate(out):
    print(f'{i:3d}', 'FAIL' if r is None else f"roll {r['roll']:7.1f} pitch {r['pitch']:7.1f} yaw {r['yaw']:7.1f}  n={r['n']}")
