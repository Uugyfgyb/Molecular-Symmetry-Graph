// sym.js — 分子几何与对称性引擎。页面（build.mjs 内联）与 verify.mjs 共用同一份代码，不碰 DOM。
//
// 坐标约定（Mulliken 1955，平面 C2v 分子）：z = C2 主轴，竖直向上；分子平面 = yz 平面；x 垂直于分子平面。
// 所有分子在建好后都把质心平移到原点：任何对称元素都必须穿过质心。

export const BOND = 1.40;        // 理想化芳环键长 (Å)，C–C 与 C–N 取同一值：教学示意
export const CH = 1.08;          // C–H (Å)：教学示意
export const SNCL = 2.34;        // 绘图用 Sn–Cl (Å)；文献值集中在 2.33–2.39 Å
export const SNCL_ANGLE = 98.1;  // 气相电子衍射 Cl–Sn–Cl (°)，Nasarenko 等 1985
export const HGCL = 2.25;        // 绘图用 Hg–Cl (Å)：示意

export const ELEMENTS = {
  H: { mass: 1.008, r: 0.25 },
  C: { mass: 12.011, r: 0.40 },
  N: { mass: 14.007, r: 0.39 },
  Cl: { mass: 35.45, r: 0.66 },
  Sn: { mass: 118.71, r: 0.82 },
  Hg: { mass: 200.59, r: 0.80 },
};

// ───────── 向量与 3×3 矩阵（行优先，长度 9 的数组） ─────────
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const unit = (a) => scale(a, 1 / len(a));

export const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export const apply = (M, p) => [
  M[0] * p[0] + M[1] * p[1] + M[2] * p[2],
  M[3] * p[0] + M[4] * p[1] + M[5] * p[2],
  M[6] * p[0] + M[7] * p[1] + M[8] * p[2],
];
export function mul(A, B) {
  const C = new Array(9).fill(0);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) for (let k = 0; k < 3; k++) C[r * 3 + c] += A[r * 3 + k] * B[k * 3 + c];
  return C;
}
export const trace = (M) => M[0] + M[4] + M[8];
export const det = (M) => M[0] * (M[4] * M[8] - M[5] * M[7]) - M[1] * (M[3] * M[8] - M[5] * M[6]) + M[2] * (M[3] * M[7] - M[4] * M[6]);
export const matClose = (A, B, tol = 1e-9) => A.every((x, i) => Math.abs(x - B[i]) < tol);

/** 绕单位轴 u 转 θ（Rodrigues） */
export function rot(u, th) {
  const [x, y, z] = unit(u), c = Math.cos(th), s = Math.sin(th), t = 1 - c;
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y,
          t * x * y + s * z, t * y * y + c, t * y * z - s * x,
          t * x * z - s * y, t * y * z + s * x, t * z * z + c];
}
/** 对法向为 n、过原点的平面作反映：I − 2nnᵀ */
export function refl(n) {
  const [x, y, z] = unit(n);
  return [1 - 2 * x * x, -2 * x * y, -2 * x * z, -2 * x * y, 1 - 2 * y * y, -2 * y * z, -2 * x * z, -2 * y * z, 1 - 2 * z * z];
}
export const INV = [-1, 0, 0, 0, -1, 0, 0, 0, -1];
/** 旋转反映 Sn：先绕 u 转 θ，再对垂直于 u 的平面反映 */
export const improper = (u, th) => mul(refl(u), rot(u, th));

// ───────── 分子 ─────────
// 分子对象：{ atoms: [{ el, label, pos }], bonds: [[i, j]], rings?: [{ center, members }] }

/** 把质心移到原点（就地修改），返回分子本身 */
export function centerMolecule(mol) {
  let M = 0, c = [0, 0, 0];
  for (const a of mol.atoms) { const m = ELEMENTS[a.el].mass; M += m; c = add(c, scale(a.pos, m)); }
  c = scale(c, 1 / M);
  for (const a of mol.atoms) a.pos = sub(a.pos, c);
  for (const r of mol.rings || []) r.center = sub(r.center, c);
  mol.com = c;
  return mol;
}

const S3 = Math.sqrt(3);
// 菲 / 菲咯啉骨架，按 1,10-菲咯啉的编号；(u, w) 以 BOND 为单位，u 水平、w 竖直。
// 中环正六边形中心在原点，C5–C6 在上，C10a–C10b 在下；两个外环角形稠合在左下、右下。
const SKEL = [
  ["1", -1, -S3], ["2", -2, -S3], ["3", -2.5, -S3 / 2], ["4", -2, 0], ["4a", -1, 0],
  ["5", -0.5, S3 / 2], ["6", 0.5, S3 / 2], ["6a", 1, 0], ["7", 2, 0], ["8", 2.5, -S3 / 2],
  ["9", 2, -S3], ["10", 1, -S3], ["10a", 0.5, -S3 / 2], ["10b", -0.5, -S3 / 2],
];
const SKEL_BONDS = [
  ["1", "2"], ["2", "3"], ["3", "4"], ["4", "4a"], ["4a", "10b"], ["10b", "1"],
  ["4a", "5"], ["5", "6"], ["6", "6a"], ["6a", "10a"], ["10a", "10b"],
  ["6a", "7"], ["7", "8"], ["8", "9"], ["9", "10"], ["10", "10a"],
];
const SKEL_RINGS = [
  { c: [-1.5, -S3 / 2], m: ["1", "2", "3", "4", "4a", "10b"] },
  { c: [0, 0], m: ["4a", "5", "6", "6a", "10a", "10b"] },
  { c: [1.5, -S3 / 2], m: ["6a", "7", "8", "9", "10", "10a"] },
];

/** 菲骨架；nLocants 里的位置换成 N（例如 ["1","10"] 得到 1,10-菲咯啉）。分子放在 yz 平面。 */
export function phenanthreneFamily(nLocants = []) {
  const atoms = [], bonds = [], idx = {};
  for (const [loc, u, w] of SKEL) {
    idx[loc] = atoms.length;
    atoms.push({ el: nLocants.includes(loc) ? "N" : "C", label: loc, pos: [0, u * BOND, w * BOND] });
  }
  for (const [a, b] of SKEL_BONDS) bonds.push([idx[a], idx[b]]);
  const rings = SKEL_RINGS.map((r) => ({ center: [0, r.c[0] * BOND, r.c[1] * BOND], members: r.m.map((l) => idx[l]) }));
  for (const [loc, u, w] of SKEL) {
    const a = atoms[idx[loc]];
    if (a.el !== "C") continue;
    const own = SKEL_RINGS.filter((r) => r.m.includes(loc));
    if (own.length !== 1) continue; // 稠合碳没有 H
    const dir = unit([0, u - own[0].c[0], w - own[0].c[1]]);
    bonds.push([idx[loc], atoms.length]);
    atoms.push({ el: "H", label: "H" + loc, pos: add(a.pos, scale(dir, CH)) });
  }
  return centerMolecule({ atoms, bonds, rings });
}

/** 蒽：三个六元环线形稠合。 */
export function anthracene() {
  const centers = [[-S3, 0], [0, 0], [S3, 0]];
  const verts = [], rings = [];
  for (const c of centers) {
    const m = [];
    for (let k = 0; k < 6; k++) {
      const a = (30 + 60 * k) * Math.PI / 180, p = [c[0] + Math.cos(a), c[1] + Math.sin(a)];
      let j = verts.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-6);
      if (j < 0) { j = verts.length; verts.push(p); }
      m.push(j);
    }
    rings.push({ c, m });
  }
  const atoms = verts.map((p, i) => ({ el: "C", label: "c" + i, pos: [0, p[0] * BOND, p[1] * BOND] }));
  const bonds = [], seen = new Set();
  for (const r of rings) for (let k = 0; k < 6; k++) {
    const a = r.m[k], b = r.m[(k + 1) % 6], key = Math.min(a, b) + "-" + Math.max(a, b);
    if (!seen.has(key)) { seen.add(key); bonds.push([a, b]); }
  }
  verts.forEach((p, i) => {
    const own = rings.filter((r) => r.m.includes(i));
    if (own.length !== 1) return;
    const dir = unit([0, p[0] - own[0].c[0], p[1] - own[0].c[1]]);
    bonds.push([i, atoms.length]);
    atoms.push({ el: "H", label: "h" + i, pos: add(atoms[i].pos, scale(dir, CH)) });
  });
  return centerMolecule({ atoms, bonds, rings: rings.map((r) => ({ center: [0, r.c[0] * BOND, r.c[1] * BOND], members: r.m })) });
}

/** AX₂ 三原子分子：中心原子在 z 轴上，两个配体在 yz 平面内、向 −z 张开 angleDeg。 */
export function triatomic(central, ligand, angleDeg, r) {
  const h = angleDeg * Math.PI / 360;
  const atoms = [
    { el: central, label: central, pos: [0, 0, 0] },
    { el: ligand, label: ligand + "1", pos: [0, -r * Math.sin(h), -r * Math.cos(h)] },
    { el: ligand, label: ligand + "2", pos: [0, r * Math.sin(h), -r * Math.cos(h)] },
  ];
  return centerMolecule({ atoms, bonds: [[0, 1], [0, 2]] });
}

// ───────── 对称性检测 ─────────
// 本页所有坐标都是解析构造的精确值（误差 ~1e-12 Å），所以判定容差可以取得很紧；
// 取 0.01 Å 时，179° 的 SnCl2 会被误判成高阶群（Cl 几乎在轴上，转一下只挪动不到 0.01 Å）。
export const TOL = 1e-4;
/** 位置 p、元素 el 落在参考原子集 ref 的哪个原子上（找不到返回 −1） */
export function siteOf(p, el, ref, tol = 0.02) {
  for (let j = 0; j < ref.length; j++) if (ref[j].el === el && len(sub(p, ref[j].pos)) < tol) return j;
  return -1;
}
/** M 是否把分子映回自身：每个原子都落在同种原子原来的位置上 */
export function isSymmetry(atoms, M, tol = TOL) {
  for (const a of atoms) if (siteOf(apply(M, a.pos), a.el, atoms, tol) < 0) return false;
  return true;
}
/** M 作用后原地不动的原子数 */
export const unmoved = (atoms, M, tol = TOL) => atoms.filter((a) => len(sub(apply(M, a.pos), a.pos)) < tol).length;

/**
 * 穷举候选方向，找出全部对称元素（分子须已居中）。
 * 候选轴 / 法向：坐标轴、原子方向、同种原子对的中点方向与差方向、任意两原子位矢的叉积（平面分子的法向）。
 */
export function findElements(atoms, tol = TOL) {
  const P = atoms.map((a) => a.pos);
  const far = P.reduce((b, p) => (len(p) > len(b) ? p : b), [0, 0, 0]);
  const linear = atoms.length >= 2 && len(far) > tol && P.every((p) => len(cross(p, unit(far))) < tol);
  const dirs = [];
  const addDir = (d) => {
    const L = len(d);
    if (L < 1e-6) return;
    d = scale(d, 1 / L);
    for (const e of dirs) if (Math.abs(dot(d, e)) > 1 - 1e-7) return;
    dirs.push(d);
  };
  [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach(addDir);
  P.forEach(addDir);
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    if (atoms[i].el === atoms[j].el) { addDir(add(P[i], P[j])); addDir(sub(P[i], P[j])); }
    addDir(cross(P[i], P[j]));
  }
  const axes = [], planes = [];
  for (const d of dirs) {
    for (let n = 8; n >= 2; n--) if (isSymmetry(atoms, rot(d, 2 * Math.PI / n), tol)) { axes.push({ dir: d, n }); break; }
    if (isSymmetry(atoms, refl(d), tol)) planes.push({ normal: d });
  }
  return { linear, linearAxis: linear ? unit(far) : null, axes, planes, inversion: isSymmetry(atoms, INV, tol) };
}

/** 按 Schoenflies 判定流程给出点群，并记下每一步的答案（页面上的流程图用同一套逻辑）。 */
export function classify(atoms, E = findElements(atoms)) {
  if (E.linear) return { group: E.inversion ? "D∞h" : "C∞v", linear: true, inversion: E.inversion };
  const high = E.axes.filter((a) => a.n >= 3);
  if (high.length >= 2) {
    const m = Math.max(...high.map((a) => a.n));
    const group = m === 5 ? (E.inversion ? "Ih" : "I") : m === 4 ? (E.inversion ? "Oh" : "O")
      : E.inversion ? "Th" : E.planes.length >= 6 ? "Td" : "T";
    return { group, cubic: true };
  }
  if (!E.axes.length) return { group: E.planes.length ? "Cs" : E.inversion ? "Ci" : "C1", n: 1, nAxes: 0, nPlanes: E.planes.length, inversion: E.inversion };
  const n = Math.max(...E.axes.map((a) => a.n));
  const perpOf = (ax) => E.axes.filter((b) => b !== ax && Math.abs(dot(b.dir, ax.dir)) < 1e-6 && b.n % 2 === 0).length;
  const principal = E.axes.filter((a) => a.n === n).reduce((best, a) => (perpOf(a) > perpOf(best) ? a : best));
  const perpC2 = perpOf(principal);
  const sigmaH = E.planes.some((p) => Math.abs(dot(p.normal, principal.dir)) > 1 - 1e-6);
  const sigmaV = E.planes.filter((p) => Math.abs(dot(p.normal, principal.dir)) < 1e-6).length;
  const s2n = isSymmetry(atoms, improper(principal.dir, Math.PI / n));
  let group;
  if (perpC2 >= n) group = sigmaH ? `D${n}h` : sigmaV >= n ? `D${n}d` : `D${n}`;
  else if (sigmaH) group = `C${n}h`;
  else if (sigmaV >= n) group = `C${n}v`;
  else if (s2n) group = `S${2 * n}`;
  else group = `C${n}`;
  return { group, n, principal, perpC2, sigmaH, sigmaV, s2n, inversion: E.inversion, nAxes: E.axes.length, nPlanes: E.planes.length };
}

/** 点群的阶 h */
export function groupOrder(g) {
  if (g.includes("∞")) return Infinity;
  if (g === "C1") return 1;
  if (g === "Cs" || g === "Ci") return 2;
  const m = g.match(/^([CDS])(\d+)([vhd]?)$/);
  if (!m) return { T: 12, Td: 24, Th: 24, O: 24, Oh: 48, I: 60, Ih: 120 }[g];
  const n = +m[2];
  if (m[1] === "S") return n;
  if (m[1] === "C") return m[3] ? 2 * n : n;
  return m[3] ? 4 * n : 2 * n;
}

// ───────── C2v 特征标表与约化 ─────────
export const C2V = {
  h: 4,
  ops: [
    { id: "E", M: I3 },
    { id: "C2", M: rot([0, 0, 1], Math.PI) },
    { id: "sxz", M: refl([0, 1, 0]) },
    { id: "syz", M: refl([1, 0, 0]) },
  ],
  irreps: [
    { name: "A1", chi: [1, 1, 1, 1], lin: "z", quad: "x², y², z²" },
    { name: "A2", chi: [1, 1, -1, -1], lin: "Rz", quad: "xy" },
    { name: "B1", chi: [1, -1, 1, -1], lin: "x, Ry", quad: "xz" },
    { name: "B2", chi: [1, -1, -1, 1], lin: "y, Rx", quad: "yz" },
  ],
};
/** 约化公式 nᵢ = (1/h) Σ_R χ(R) χᵢ(R)；C2v 每类只有一个操作 */
export const reduce = (chars, table = C2V) => table.irreps.map((ir) => ir.chi.reduce((s, c, k) => s + c * chars[k], 0) / table.h);

/** 3N 笛卡尔位移表示：χ(R) = 不动原子数 × tr(R)；平动 χ = tr(R)，转动 χ = det(R)·tr(R) */
export function cartesianAnalysis(atoms, table = C2V) {
  const un = table.ops.map((o) => unmoved(atoms, o.M));
  const perAtom = table.ops.map((o) => trace(o.M));
  const g3n = un.map((u, k) => u * perAtom[k]);
  const gTrans = perAtom;
  const gRot = table.ops.map((o) => det(o.M) * trace(o.M));
  const n3n = reduce(g3n, table), nT = reduce(gTrans, table), nR = reduce(gRot, table);
  const nVib = n3n.map((x, k) => x - nT[k] - nR[k]);
  return { unmoved: un, perAtom, g3n, gTrans, gRot, n3n, nT, nR, nVib };
}
