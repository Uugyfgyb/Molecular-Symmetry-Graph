// 独立核验：用 sym.js 从坐标出发重新找对称元素、判点群、约化 3N 表示，并与页面上写死的结论逐条比对。
// 运行：deno run -A source/verify.mjs   （或 node source/verify.mjs）；结果写到 ../verification.json，有一条不符就以非零码退出。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as S from "./sym.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const checks = [];
const check = (name, ok, detail = "") => checks.push({ name, ok: !!ok, detail: typeof detail === "string" ? detail : JSON.stringify(detail) });
const near = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;
const eqArr = (a, b) => a.length === b.length && a.every((x, i) => near(x, b[i], 1e-9));

// ── 1. 几何本身：键长、平面性 ──
const phen = S.phenanthreneFamily(["1", "10"]);
const formula = phen.atoms.reduce((m, a) => ((m[a.el] = (m[a.el] || 0) + 1), m), {});
check("邻二氮菲分子式 C12H8N2", formula.C === 12 && formula.H === 8 && formula.N === 2, formula);
const bl = phen.bonds.map(([i, j]) => [phen.atoms[i].el + phen.atoms[j].el, S.len(S.sub(phen.atoms[i].pos, phen.atoms[j].pos))]);
check("环键长全部 = 1.40 Å", bl.filter(([e]) => !e.includes("H")).every(([, d]) => near(d, 1.4)), bl.length + " 根键");
check("C–H 全部 = 1.08 Å", bl.filter(([e]) => e.includes("H")).every(([, d]) => near(d, 1.08)));
check("邻二氮菲为平面分子（全部 x = 0）", phen.atoms.every((a) => near(a.pos[0], 0)));
check("质心在原点", S.len(phen.atoms.reduce((c, a) => S.add(c, S.scale(a.pos, S.ELEMENTS[a.el].mass)), [0, 0, 0])) < 1e-9);
const n1 = phen.atoms.find((a) => a.label === "1"), n10 = phen.atoms.find((a) => a.label === "10");
check("N1···N10 距离（理想化）", near(S.len(S.sub(n1.pos, n10.pos)), 2.8), S.len(S.sub(n1.pos, n10.pos)).toFixed(3) + " Å");

// ── 2. 点群 ──
const elementsOf = (mol) => S.findElements(mol.atoms);
const pg = (mol) => S.classify(mol.atoms).group;
const Ep = elementsOf(phen), Cp = S.classify(phen.atoms, Ep);
check("邻二氮菲 → C2v", Cp.group === "C2v", Cp.group);
check("邻二氮菲：恰好 1 条 C2 轴，沿 z", Ep.axes.length === 1 && Ep.axes[0].n === 2 && near(Math.abs(Ep.axes[0].dir[2]), 1), Ep.axes);
check("邻二氮菲：恰好 2 个镜面，法向 x 与 y", Ep.planes.length === 2 && Ep.planes.some((p) => near(Math.abs(p.normal[0]), 1)) && Ep.planes.some((p) => near(Math.abs(p.normal[1]), 1)), Ep.planes);
check("邻二氮菲：无反演中心、无 σh、无 ⊥C2", !Ep.inversion && !Cp.sigmaH && Cp.perpC2 === 0);

const sn = S.triatomic("Sn", "Cl", S.SNCL_ANGLE, S.SNCL);
const Es = elementsOf(sn), Cs = S.classify(sn.atoms, Es);
check("SnCl2（98.1°）→ C2v", Cs.group === "C2v", Cs.group);
check("SnCl2：1 条 C2、2 个镜面、无 i", Es.axes.length === 1 && Es.planes.length === 2 && !Es.inversion);
check("SnCl2 键角回算 = 98.1°", near(Math.acos(S.dot(S.unit(S.sub(sn.atoms[1].pos, sn.atoms[0].pos)), S.unit(S.sub(sn.atoms[2].pos, sn.atoms[0].pos)))) * 180 / Math.PI, 98.1, 1e-9));

// 滑块：除 180° 外都是 C2v
const sweep = {};
for (let a = 60; a <= 180; a = Math.round((a + 0.1) * 10) / 10) sweep[a] = pg(S.triatomic("Sn", "Cl", a, S.SNCL));
const bad = Object.entries(sweep).filter(([a, g]) => (+a === 180 ? g !== "D∞h" : g !== "C2v"));
check("SnCl2 键角 60°–179.9°（步长 0.1°）全为 C2v，180° 为 D∞h", bad.length === 0, bad.length ? bad.slice(0, 5) : `${Object.keys(sweep).length} 个角度`);
check("179.9° 仍判为 C2v（容差不吞掉弯曲）", pg(S.triatomic("Sn", "Cl", 179.9, S.SNCL)) === "C2v");
check("HgCl2（线形）→ D∞h", pg(S.triatomic("Hg", "Cl", 180, S.HGCL)) === "D∞h");

// 对比画廊
const gallery = {
  anthracene: [S.anthracene(), "D2h"],
  phenanthrene: [S.phenanthreneFamily([]), "C2v"],
  "1,10-phenanthroline": [phen, "C2v"],
  "1,7-phenanthroline": [S.phenanthreneFamily(["1", "7"]), "Cs"],
};
for (const [name, [mol, want]] of Object.entries(gallery)) check(`画廊：${name} → ${want}`, pg(mol) === want, pg(mol));
const anth = S.anthracene();
check("蒽 C14H10", anth.atoms.filter((a) => a.el === "C").length === 14 && anth.atoms.filter((a) => a.el === "H").length === 10);

// ── 3. 页面上的操作结果 ──
const OP = { C2z: S.rot([0, 0, 1], Math.PI), sxz: S.refl([0, 1, 0]), syz: S.refl([1, 0, 0]), C2x: S.rot([1, 0, 0], Math.PI), C2y: S.rot([0, 1, 0], Math.PI), inv: S.INV, sxy: S.refl([0, 0, 1]) };
const valid = (mol) => Object.fromEntries(Object.entries(OP).map(([k, M]) => [k, S.isSymmetry(mol.atoms, M)]));
const vp = valid(phen), vs = valid(sn), vl = valid(S.triatomic("Sn", "Cl", 180, S.SNCL));
check("邻二氮菲：C2z、σxz、σyz 成立；C2x、C2y、i、σxy 不成立", vp.C2z && vp.sxz && vp.syz && !vp.C2x && !vp.C2y && !vp.inv && !vp.sxy, vp);
check("SnCl2：同上", vs.C2z && vs.sxz && vs.syz && !vs.C2x && !vs.C2y && !vs.inv && !vs.sxy, vs);
check("SnCl2 拉直到 180°：七个操作全部成立", Object.values(vl).every(Boolean), vl);
check("180° 时绕 y 轴转 60°（C∞ 演示）成立", S.isSymmetry(S.triatomic("Sn", "Cl", 180, S.SNCL).atoms, S.rot([0, 1, 0], Math.PI / 3)));

// C2 作用下的原子交换（页面文字写的是 N1⇄N10, C2⇄C9, C3⇄C8, C4⇄C7, C4a⇄C6a, C5⇄C6, C10a⇄C10b）
const pairs = phen.atoms.map((a) => [a.label, phen.atoms[S.siteOf(S.apply(OP.C2z, a.pos), a.el, phen.atoms)].label]);
const want = { 1: "10", 2: "9", 3: "8", 4: "7", "4a": "6a", 5: "6", "10a": "10b" };
check("C2 的原子交换表", Object.entries(want).every(([a, b]) => pairs.find(([x]) => x === a)[1] === b && pairs.find(([x]) => x === b)[1] === a), pairs.filter(([a]) => !a.startsWith("H")));
check("σv(xz) 与 C2 交换方式相同", phen.atoms.every((a) => S.siteOf(S.apply(OP.sxz, a.pos), a.el, phen.atoms) === S.siteOf(S.apply(OP.C2z, a.pos), a.el, phen.atoms)));

// 群乘法（页面"累计效果"）：C2·σv(xz) = σv′(yz)，σv·σv′ = C2，C2·C2 = E
check("σv(xz)∘C2 = σv′(yz)", S.matClose(S.mul(OP.sxz, OP.C2z), OP.syz));
check("σv′(yz)∘σv(xz) = C2", S.matClose(S.mul(OP.syz, OP.sxz), OP.C2z));
check("C2∘C2 = E", S.matClose(S.mul(OP.C2z, OP.C2z), S.I3));

// ── 4. 3N 表示的约化（页面"延伸"一节） ──
const ap = S.cartesianAnalysis(phen.atoms), as = S.cartesianAnalysis(sn.atoms);
check("邻二氮菲不动原子 22/0/0/22", eqArr(ap.unmoved, [22, 0, 0, 22]), ap.unmoved);
check("邻二氮菲 Γ3N 特征标 66/0/0/22", eqArr(ap.g3n, [66, 0, 0, 22]), ap.g3n);
check("邻二氮菲 Γ3N = 22A1+11A2+11B1+22B2", eqArr(ap.n3n, [22, 11, 11, 22]), ap.n3n);
check("Γtrans = A1+B1+B2，Γrot = A2+B1+B2", eqArr(ap.nT, [1, 0, 1, 1]) && eqArr(ap.nR, [0, 1, 1, 1]), [ap.nT, ap.nR]);
check("邻二氮菲 Γvib = 21A1+10A2+9B1+20B2（= 60 = 3·22−6）", eqArr(ap.nVib, [21, 10, 9, 20]) && ap.nVib.reduce((s, x) => s + x) === 60, ap.nVib);
check("SnCl2 不动原子 3/1/1/3，Γ3N 9/−1/1/3", eqArr(as.unmoved, [3, 1, 1, 3]) && eqArr(as.g3n, [9, -1, 1, 3]), [as.unmoved, as.g3n]);
check("SnCl2 Γ3N = 3A1+A2+2B1+3B2，Γvib = 2A1+B2", eqArr(as.n3n, [3, 1, 2, 3]) && eqArr(as.nVib, [2, 0, 0, 1]), [as.n3n, as.nVib]);
// 平面内 / 平面外：2N−3 = 41 = 21A1+20B2，N−3 = 19 = 10A2+9B1
check("邻二氮菲面内 41 = 21A1+20B2，面外 19 = 10A2+9B1", ap.nVib[0] + ap.nVib[3] === 41 && ap.nVib[1] + ap.nVib[2] === 19);
check("C2v 阶 h = 4，D2h 阶 8", S.groupOrder("C2v") === 4 && S.groupOrder("D2h") === 8 && S.groupOrder("Cs") === 2);

// ── 输出 ──
const failed = checks.filter((c) => !c.ok);
const out = { generated: new Date().toISOString().slice(0, 10), script: "source/verify.mjs", passed: checks.length - failed.length, failed: failed.length, checks };
fs.writeFileSync(path.join(here, "..", "verification.json"), JSON.stringify(out, null, 2) + "\n");
for (const c of checks) console.log(`${c.ok ? "✓" : "✗"} ${c.name}${c.ok ? "" : "  → " + c.detail}`);
console.log(`\n${out.passed}/${checks.length} 通过`);
if (failed.length) process.exit(1);
