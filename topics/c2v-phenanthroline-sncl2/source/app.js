// app.js — 页面交互。build.mjs 把它和 sym.js 内联进同一个 <script type="module">，sym.js 的函数在这里直接可用。

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const DEG = Math.PI / 180;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? Math.min(ms, 400) : ms));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const n1 = (x) => x.toFixed(1);

// ───────── 记号 ─────────
const pgHTML = (g) => { const m = g.match(/^([A-Z])(.*)$/); return `<span class="pg"><i>${m[1]}</i>${m[2] ? `<sub>${m[2]}</sub>` : ""}</span>`; };
const tsym = (main, sub = "", rest = "") =>
  `<tspan font-style="italic">${main}</tspan>${sub ? `<tspan baseline-shift="sub" font-size="72%">${sub}</tspan>` : ""}${rest}`;
const SUB = { 1: "₁", 2: "₂" };

const OPS = {
  E: { kind: "E", html: "<i>E</i>", sub: "恒等：什么都不做", cls: "e" },
  C2z: { kind: "rot", axis: [0, 0, 1], ang: Math.PI, html: "<i>C</i><sub>2</sub>", sub: "绕主轴 z 转 180°", cls: "c2" },
  sxz: { kind: "refl", n: [0, 1, 0], html: "<i>σ</i><sub>v</sub>(<i>xz</i>)", sub: "⊥ 分子平面、含 C₂", cls: "sxz" },
  syz: { kind: "refl", n: [1, 0, 0], html: "<i>σ</i><sub>v</sub>′(<i>yz</i>)", sub: "分子平面本身", cls: "syz" },
  C2x: { kind: "rot", axis: [1, 0, 0], ang: Math.PI, html: "<i>C</i><sub>2</sub>(<i>x</i>)", sub: "垂直于分子平面", cand: true },
  C2y: { kind: "rot", axis: [0, 1, 0], ang: Math.PI, html: "<i>C</i><sub>2</sub>(<i>y</i>)", sub: "平面内、⊥ 主轴", cand: true },
  inv: { kind: "inv", html: "<i>i</i>", sub: "质心处反演", cand: true },
  sxy: { kind: "refl", n: [0, 0, 1], html: "<i>σ</i>(<i>xy</i>)", sub: "⊥ 主轴（σ<sub>h</sub> 候选）", cand: true },
  Cinf: { kind: "rot", axis: [0, 1, 0], ang: Math.PI / 3, html: "<i>C</i><sub>∞</sub>(<i>y</i>)", sub: "绕分子轴转任意角（演示 60°）", cand: true, linearOnly: true },
};
const GROUP_OPS = ["E", "C2z", "sxz", "syz"];
const CAND_OPS = ["C2x", "C2y", "inv", "sxy", "Cinf"];
function matAt(op, t) {
  if (op.kind === "E") return I3;
  if (op.kind === "rot") return rot(op.axis, op.ang * t);
  if (op.kind === "inv") { const k = 1 - 2 * t; return [k, 0, 0, 0, k, 0, 0, 0, k]; }
  const [x, y, z] = unit(op.n), k = 2 * t; // 反映：原子沿法向匀速穿过镜面
  return [1 - k * x * x, -k * x * y, -k * x * z, -k * x * y, 1 - k * y * y, -k * y * z, -k * x * z, -k * y * z, 1 - k * z * z];
}
const fullMat = (op) => matAt(op, 1);
const inverseOp = (op) => (op.kind === "rot" ? { ...op, ang: -op.ang } : op);

// ───────── 分子与状态 ─────────
const MOLINFO = {
  phen: { S: 42, xh: 3.0 },
  sncl2: { S: 64, xh: 2.4 },
};
const ATEXT = { H: "#2b2e33", C: "#ffffff", N: "#ffffff", Cl: "#0d2d16", Sn: "#ffffff", Hg: "#ffffff" };
const st = {
  mol: "phen", angle: SNCL_ANGLE, M: null, P: [], base: [], att: [], B: null, pg: null,
  net: I3, hist: [], cand: null, miss: [], fixed: [], tried: {},
  yaw: -36 * DEG, pitch: 17 * DEG,
  show: { el: true, lab: true, p: false, lp: true },
  busy: false, demo: false, dirty: true,
};

const lobeR = (el) => Math.max(0.27, 0.5 * ELEMENTS[el].r); // p 轨道一瓣的示意半径 (Å)
const atomName = (a) => (st.mol === "phen" ? (a.el === "H" ? a.label : a.el + a.label) : a.el === "Sn" ? "Sn" : "Cl" + SUB[a.label.slice(-1)]);
const atomShort = (a) => (st.mol === "phen" ? a.label : a.el === "Sn" ? "Sn" : `Cl<tspan baseline-shift="sub" font-size="70%">${a.label.slice(-1)}</tspan>`);

function buildMol() {
  st.M = st.mol === "phen" ? phenanthreneFamily(["1", "10"]) : triatomic("Sn", "Cl", st.angle, SNCL);
  const P = st.M.atoms.map((a) => a.pos.slice()), att = [];
  st.M.atoms.forEach((a, i) => {
    if (a.el === "H") return;
    const off = ELEMENTS[a.el].r + 0.9 * lobeR(a.el);
    for (const s of [1, -1]) { att.push({ type: "p", sign: s, atom: i, k: P.length }); P.push(add(a.pos, [s * off, 0, 0])); }
  });
  if (st.mol === "phen") {
    st.M.atoms.forEach((a, i) => {
      if (a.el !== "N") return;
      const ring = st.M.rings.find((r) => r.members.includes(i));
      att.push({ type: "lp", atom: i, k: P.length });
      P.push(add(a.pos, scale(unit(sub(a.pos, ring.center)), 1.05)));
    });
  } else if (st.angle < 180) {
    att.push({ type: "lp", atom: 0, k: P.length });
    P.push(add(st.M.atoms[0].pos, [0, 0, 1.3]));
  }
  st.base = P.map((p) => p.slice());
  st.P = P;
  st.att = att;
  // 画对称元素用的范围：取全部点的外包，再留边；SnCl2 保证有一定高度
  let ymax = 0, z0 = Infinity, z1 = -Infinity;
  P.forEach((p) => { ymax = Math.max(ymax, Math.abs(p[1])); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); });
  const m = st.mol === "phen" ? 0.85 : 0.95;
  z0 -= m; z1 += m;
  const minH = st.mol === "phen" ? 0 : 4.2;
  if (z1 - z0 < minH) { const c = (z0 + z1) / 2; z0 = c - minH / 2; z1 = c + minH / 2; }
  st.B = { y: ymax + m + 0.35, z0, z1, x: MOLINFO[st.mol].xh };
  st.pg = classify(st.M.atoms);
  st.net = I3; st.hist = []; st.cand = null; st.miss = []; st.fixed = [];
  st.dirty = true;
}

// ───────── 3D 舞台 ─────────
const stage = $("#stage"), Litems = $("#L-items"), Lover = $("#L-over");
const PERSP = 26;
let S = 42, labelK = 1;

function proj(p) {
  const cy = Math.cos(st.yaw), sy = Math.sin(st.yaw), cp = Math.cos(st.pitch), sp = Math.sin(st.pitch);
  const x1 = p[0] * cy - p[1] * sy, y1 = p[0] * sy + p[1] * cy, z1 = p[2];
  const d = x1 * cp + z1 * sp, z2 = -x1 * sp + z1 * cp;
  const f = PERSP / (PERSP - d);
  return [y1 * S * f, -z2 * S * f, d, f];
}
const xy = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

function pushPlane(items, cls, e1, e2, a0, a1, b0, b1, na = 6, nb = 5) {
  const g = [];
  for (let i = 0; i <= na; i++) {
    g.push([]);
    for (let j = 0; j <= nb; j++) g[i].push(proj(add(scale(e1, a0 + ((a1 - a0) * i) / na), scale(e2, b0 + ((b1 - b0) * j) / nb))));
  }
  for (let i = 0; i < na; i++) for (let j = 0; j < nb; j++) {
    const q = [g[i][j], g[i + 1][j], g[i + 1][j + 1], g[i][j + 1]];
    items.push([(q[0][2] + q[1][2] + q[2][2] + q[3][2]) / 4, `<polygon class="pl ${cls}" points="${q.map(xy).join(" ")}"/>`]);
  }
  const edge = (p, q) => items.push([(p[2] + q[2]) / 2 + 0.002, `<line class="pe ${cls}" x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}"/>`]);
  for (let i = 0; i < na; i++) { edge(g[i][0], g[i + 1][0]); edge(g[i][nb], g[i + 1][nb]); }
  for (let j = 0; j < nb; j++) { edge(g[0][j], g[0][j + 1]); edge(g[na][j], g[na][j + 1]); }
}

function pushAxis(items, cls, a, b, marker) {
  const N = 16;
  for (let k = 0; k < N; k++) {
    const p = proj(lerp3(a, b, k / N)), q = proj(lerp3(a, b, (k + 1) / N));
    items.push([(p[2] + q[2]) / 2 + 0.003, `<line class="ax ${cls}" x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}"/>`]);
  }
  if (!marker) return;
  const pa = proj(a), pb = proj(b);
  let dx = pb[0] - pa[0], dy = pb[1] - pa[1];
  const L = Math.hypot(dx, dy);
  if (L < 1e-3) { dx = 0; dy = 1; } else { dx /= L; dy /= L; }
  for (const P of [pa, pb]) {
    if (marker === "dot") { items.push([P[2] + 0.004, `<circle class="axm ${cls}" cx="${P[0].toFixed(1)}" cy="${P[1].toFixed(1)}" r="5"/>`]); continue; }
    const w = 7.5, h = 4.4, e1 = [P[0] + dy * w, P[1] - dx * w], e2 = [P[0] - dy * w, P[1] + dx * w];
    const c1 = [P[0] + dx * h * 2, P[1] + dy * h * 2], c2 = [P[0] - dx * h * 2, P[1] - dy * h * 2];
    items.push([P[2] + 0.004, `<path class="axm ${cls}" d="M${xy(e1)}Q${xy(c1)} ${xy(e2)}Q${xy(c2)} ${xy(e1)}Z"/>`]);
  }
}

function render() {
  st.dirty = false;
  S = MOLINFO[st.mol].S;
  const items = [], P = st.P, B = st.B, linear = !!st.pg.linear;
  // 对称元素
  if (st.show.el) {
    pushPlane(items, "syz", [0, 1, 0], [0, 0, 1], -B.y, B.y, B.z0, B.z1);
    pushPlane(items, "sxz", [1, 0, 0], [0, 0, 1], -B.x, B.x, B.z0, B.z1, 4, 5);
    pushAxis(items, "c2", [0, 0, B.z0 - 0.5], [0, 0, B.z1 + 0.5], "lens");
    if (linear) pushAxis(items, "cinf", [0, -B.y - 0.3, 0], [0, B.y + 0.3, 0], "dot");
  }
  if (st.cand === "sxy") pushPlane(items, "cand", [1, 0, 0], [0, 1, 0], -B.x, B.x, -B.y, B.y, 4, 6);
  if (st.cand === "C2x") pushAxis(items, "cand", [-B.x - 0.6, 0, 0], [B.x + 0.6, 0, 0], "lens");
  if (st.cand === "C2y" || (st.cand === "Cinf" && !st.show.el)) pushAxis(items, "cand", [0, -B.y - 0.3, 0], [0, B.y + 0.3, 0], "lens");
  // 键：拆成两半，各取所连原子的颜色
  for (const [i, j] of st.M.bonds) {
    const A = proj(P[i]), Bq = proj(P[j]), Mq = proj(lerp3(P[i], P[j], 0.5));
    const w = (0.17 * S * (A[3] + Bq[3])) / 2;
    const ei = st.M.atoms[i].el, ej = st.M.atoms[j].el;
    items.push([Math.min(A[2], Mq[2]) - 0.05, `<line class="bd b-${ei}" x1="${A[0].toFixed(1)}" y1="${A[1].toFixed(1)}" x2="${Mq[0].toFixed(1)}" y2="${Mq[1].toFixed(1)}" stroke-width="${w.toFixed(1)}"/>`]);
    items.push([Math.min(Bq[2], Mq[2]) - 0.05, `<line class="bd b-${ej}" x1="${Mq[0].toFixed(1)}" y1="${Mq[1].toFixed(1)}" x2="${Bq[0].toFixed(1)}" y2="${Bq[1].toFixed(1)}" stroke-width="${w.toFixed(1)}"/>`]);
  }
  // 原子
  st.M.atoms.forEach((a, i) => {
    const p = proj(P[i]), r = ELEMENTS[a.el].r * S * p[3];
    let s = `<circle class="at" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${r.toFixed(1)}" fill="url(#g-${a.el})"/>`;
    if (st.show.lab && a.el !== "H") {
      const fs = Math.min(r * (a.label.length > 2 ? 0.72 : 0.9), 13 * labelK, st.mol === "phen" ? 99 : r * 0.62);
      s += `<text class="al" x="${p[0].toFixed(1)}" y="${p[1].toFixed(1)}" dy=".36em" font-size="${fs.toFixed(1)}" fill="${ATEXT[a.el]}">${atomShort(a)}</text>`;
    }
    items.push([p[2], s]);
  });
  // 附件：p 轨道两瓣、孤对电子
  for (const t of st.att) {
    if (t.type === "p" && st.show.p) {
      const p = proj(P[t.k]), r = lobeR(st.M.atoms[t.atom].el) * S * p[3];
      items.push([p[2], `<circle class="lobe ${t.sign > 0 ? "lplus" : "lminus"}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${r.toFixed(1)}"/>` +
        (r > 6 ? `<text class="lobe-t" x="${p[0].toFixed(1)}" y="${p[1].toFixed(1)}" dy=".34em" font-size="${(r * 1.2).toFixed(1)}">${t.sign > 0 ? "+" : "−"}</text>` : "")]);
    }
    if (t.type === "lp" && st.show.lp) {
      const A = proj(P[t.atom]), T = proj(P[t.k]);
      let dx = T[0] - A[0], dy = T[1] - A[1];
      const L = Math.hypot(dx, dy), ry = 0.34 * S * A[3];
      if (L > 1e-3) { dx /= L; dy /= L; } else { dx = 1; dy = 0; }
      const cx = A[0] + dx * L * 0.66, cy = A[1] + dy * L * 0.66, rx = Math.max(L * 0.5, ry);
      const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      const d1 = [cx - dy * ry * 0.4, cy + dx * ry * 0.4], d2 = [cx + dy * ry * 0.4, cy - dx * ry * 0.4];
      items.push([(A[2] + T[2]) / 2, `<g class="lp"><ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" transform="rotate(${ang.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})"/><circle cx="${d1[0].toFixed(1)}" cy="${d1[1].toFixed(1)}" r="2.3"/><circle cx="${d2[0].toFixed(1)}" cy="${d2[1].toFixed(1)}" r="2.3"/></g>`]);
    }
  }
  items.sort((a, b) => a[0] - b[0]);
  Litems.innerHTML = items.map((i) => i[1]).join("");

  // 叠加层：原位置虚线圈、落空 / 不动标记、元素名
  let o = "";
  if (st.hist.length || st.busy || st.cand) {
    st.M.atoms.forEach((a, i) => {
      const p = proj(st.base[i]);
      o += `<circle class="ghost" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${(ELEMENTS[a.el].r * S * p[3] + 1.5).toFixed(1)}"/>`;
    });
  }
  for (const i of st.fixed) { const p = proj(P[i]); o += `<circle class="fixedring" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${(ELEMENTS[st.M.atoms[i].el].r * S * p[3] + 4).toFixed(1)}"/>`; }
  for (const i of st.miss) { const p = proj(P[i]); o += `<circle class="missring" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${(ELEMENTS[st.M.atoms[i].el].r * S * p[3] + 4.5).toFixed(1)}"/>`; }
  const lab = (p3, cls, html, dx = 8, dy = -6) => {
    const p = proj(p3), fs = 15 * labelK;
    // 标签大约 5 个字宽；放不下就翻到锚点左侧，避免在窄屏上被舞台边缘裁掉
    const flip = p[0] + dx + fs * 3.6 > 296;
    const x = flip ? p[0] - Math.abs(dx) : p[0] + dx;
    return `<text class="el-lab ${cls}" x="${x.toFixed(1)}" y="${(p[1] + dy).toFixed(1)}" text-anchor="${flip ? "end" : "start"}" font-size="${fs.toFixed(1)}">${html}</text>`;
  };
  if (st.show.el) {
    o += lab([0, 0, B.z1 + 0.5], "c2", linear ? tsym("C", "2", "′") : tsym("C", "2"), 10, -4);
    o += lab([B.x, 0, B.z0], "sxz", linear ? tsym("σ", "h") : tsym("σ", "v", "(xz)"), 6, 18);
    o += lab([0, B.y, B.z1], "syz", linear ? tsym("σ", "v") : tsym("σ", "v", "′(yz)"), 6, -6);
    if (linear) o += lab([0, B.y + 0.3, 0], "cinf", tsym("C", "∞"), 10, 16);
  }
  if (st.cand && st.cand !== "Cinf") {
    const where = { C2x: [B.x + 0.6, 0, 0], C2y: [0, B.y + 0.3, 0], sxy: [B.x, -B.y, 0], inv: [0, 0, 0] }[st.cand];
    const html = { C2x: tsym("C", "2", "(x)"), C2y: tsym("C", "2", "(y)"), sxy: tsym("σ", "", "(xy)"), inv: tsym("i") }[st.cand];
    o += lab(where, "cand", html, 10, st.cand === "inv" ? -12 : 16);
  }
  if (st.cand === "inv" || (linear && st.show.el)) {
    const p = proj([0, 0, 0]);
    o += `<g class="invc"><circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="6.5"/><circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2"/></g>`;
  }
  Lover.innerHTML = o;
}

function loop() {
  if (st.dirty) render();
  requestAnimationFrame(loop);
}

function tween(dur, step) {
  return new Promise((done) => {
    if (reduceMotion || dur <= 0) { step(1); st.dirty = true; return done(); }
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      step(ease(t));
      st.dirty = true;
      if (t < 1) requestAnimationFrame(tick); else done();
    };
    requestAnimationFrame(tick);
  });
}

// ───────── 执行操作并判定 ─────────
const resultEl = $("#result"), netEl = $("#net");

function sitePerm(start, end) {
  const A = st.M.atoms;
  const before = A.map((a, i) => siteOf(start[i], a.el, A, 0.02));
  const after = A.map((a, i) => siteOf(end[i], a.el, A, 0.02));
  return { before, after, miss: after.map((s, i) => (s < 0 ? i : -1)).filter((i) => i >= 0) };
}

async function runOp(id, fromDemo = false) {
  if (st.busy || (st.demo && !fromDemo)) return;
  const op = OPS[id];
  st.busy = true;
  setBusy();
  st.miss = []; st.fixed = [];
  st.cand = op.cand ? id : null;
  const start = st.P.map((p) => p.slice());
  resultEl.className = "result run";
  resultEl.innerHTML = `正在执行 ${op.html} …`;
  await tween(op.kind === "E" ? 450 : 1350, (t) => { const M = matAt(op, t); st.P = start.map((p) => apply(M, p)); });
  const { before, after, miss } = sitePerm(start, st.P);
  const A = st.M.atoms, n = A.length;
  if (miss.length) {
    st.miss = miss;
    st.tried[id] = false;
    const ex = miss.find((i) => A[i].el !== "H") ?? miss[0];
    resultEl.className = "result bad";
    resultEl.innerHTML = `<b>✗ ${op.html} 不是对称操作。</b>有 ${miss.length} 个原子落在没有同种原子的地方（红圈），例如 ${atomName(A[ex])}。做完以后分子和原来<em>可以区分</em>。<span class="soon">2 秒后自动还原</span>`;
    paintTried();
    st.dirty = true;
    await sleep(2100);
    st.miss = [];
    const back = st.P.map((p) => p.slice()), inv = inverseOp(op);
    await tween(800, (t) => { const M = matAt(inv, t); st.P = back.map((p) => apply(M, p)); });
    st.P = start;
    st.cand = null;
    resultEl.querySelector(".soon")?.replaceWith(Object.assign(document.createElement("span"), { className: "soon", textContent: "已还原" }));
  } else {
    st.tried[id] = true;
    st.net = mul(fullMat(op), st.net);
    st.hist.push(id);
    // 以"位置"为单位的置换：位置 before[i] 上的原子被送到位置 after[i]
    const fixed = [], pairs = [], seen = new Set();
    for (let i = 0; i < n; i++) {
      const s = before[i], t = after[i];
      if (s === t) { fixed.push(i); continue; }
      if (seen.has(s)) continue;
      seen.add(s); seen.add(t);
      pairs.push([s, t]);
    }
    st.fixed = fixed;
    const heavy = pairs.filter(([s]) => A[s].el !== "H"), hp = pairs.length - heavy.length;
    let msg = `<b>✓ ${op.html} 是对称操作：</b>每个原子都落在同种原子原来的位置上。`;
    if (heavy.length) msg += `<br>交换：${heavy.map(([s, t]) => `${atomName(A[s])} ⇄ ${atomName(A[t])}`).join(" · ")}${hp ? `；另外 ${hp * 2} 个 H 也两两交换` : ""}。`;
    msg += `<br>原地不动的原子：<b>${fixed.length}</b> 个${fixed.length === n ? "（全部）" : fixed.length ? `（${fixed.map((i) => atomName(A[i])).join("、")}，绿圈）` : ""}。`;
    if (id === "E") msg += "每个点群都必须含 E。";
    else if (fixed.length === n && op.kind === "refl") msg += `原子一个没动，但这<em>不是</em>“什么都没做”：垂直于分子平面的 p 轨道 +/− 两瓣被对调了${st.show.p ? "（看青色与橙色两瓣换了边）" : "（打开下方「p 轨道」开关再做一次就能看到）"}。`;
    resultEl.className = "result ok";
    resultEl.innerHTML = msg;
    st.cand = op.cand ? id : null;
    paintTried();
    paintNet();
  }
  st.busy = false;
  setBusy();
  st.dirty = true;
}

function paintNet() {
  if (!st.hist.length) { netEl.innerHTML = ""; return; }
  const names = { E: OPS.E, C2z: OPS.C2z, sxz: OPS.sxz, syz: OPS.syz, C2x: OPS.C2x, C2y: OPS.C2y, inv: OPS.inv, sxy: OPS.sxy };
  const eq = Object.entries(names).find(([, op]) => matClose(fullMat(op), st.net, 1e-6));
  const chain = st.hist.map((h) => OPS[h].html).join(" → ");
  netEl.innerHTML = `<span class="net-k">累计</span> ${chain}${st.hist.length > 1 ? ` <span class="net-eq">＝ 只做一次 ${eq ? eq[1].html : "（一个绕分子轴的转动）"}</span>` : ""}` +
    (st.hist.length > 1 && eq ? `<span class="net-why">两个操作接连做，结果仍是群里的一个操作：这就是“封闭性”。</span>` : "");
}

function paintTried() {
  $$(".op").forEach((b) => {
    const v = st.tried[b.dataset.op];
    b.querySelector(".op-st").textContent = v === true ? "✓" : v === false ? "✗" : "";
    b.classList.toggle("is-ok", v === true);
    b.classList.toggle("is-bad", v === false);
  });
}
const locked = () => st.busy || st.demo;
function setBusy() { $$(".op, [data-demo], #reset, [data-mol-tab], #ang, [data-ang]").forEach((b) => (b.disabled = locked())); }

function resetPose(msg = true) {
  if (st.busy) return;
  st.P = st.base.map((p) => p.slice());
  st.net = I3; st.hist = []; st.cand = null; st.miss = []; st.fixed = [];
  paintNet();
  if (msg) { resultEl.className = "result"; resultEl.innerHTML = "已复位到原始取向。"; }
  st.dirty = true;
}

// ───────── 读数、开关、分子切换 ─────────
function paintReadout() {
  const g = st.pg.group;
  $("#ro-pg").innerHTML = pgHTML(g);
  const desc = {
    C2v: `<i>E</i> · 1 条 <i>C</i><sub>2</sub> · 2 个 <i>σ</i><sub>v</sub> · 无 <i>i</i> · 阶 <i>h</i> = 4`,
    "D∞h": `<i>E</i> · <i>C</i><sub>∞</sub> · ∞<i>σ</i><sub>v</sub> · <i>σ</i><sub>h</sub> · <i>i</i> · ∞<i>C</i><sub>2</sub> · 阶 <i>h</i> = ∞`,
  }[g] || `${st.pg.nAxes} 条转轴 · ${st.pg.nPlanes} 个镜面${st.pg.inversion ? " · 有 i" : ""}`;
  $("#ro-el").innerHTML = desc;
  const linear = !!st.pg.linear;
  $("#ops-cand-h").innerHTML = linear
    ? "试一试的候选：<b>键角 180° 时全部成立</b>"
    : "试一试：这些<b>不</b>在本群里";
  $$(".op[data-op=Cinf]").forEach((b) => (b.hidden = !linear));
  if (st.mol === "sncl2") {
    const a = st.angle;
    $("#ang-out").textContent = (Math.abs(a - 180) < 1e-9 ? "180" : n1(a)) + "°";
    $("#ang-note").innerHTML = linear
      ? "线形（假想的 SnCl₂，或真实的 HgCl₂）：<i>z</i> 轴上的 <i>C</i><sub>2</sub> 降级为无穷多条 ⊥<i>C</i><sub>2</sub> 之一，<i>y</i> 轴升格为 <i>C</i><sub>∞</sub>，<i>σ</i><sub>v</sub>(<i>xz</i>) 变成 <i>σ</i><sub>h</sub>。点群升为 " + pgHTML("D∞h") + "。"
      : Math.abs(a - SNCL_ANGLE) < 0.05
        ? "气相电子衍射实测 98.1°（Nasarenko 等 1985）。"
        : `假想几何：只要不是 180°，点群就仍是 ${pgHTML("C2v")}——点群只问“有哪些对称元素”，不问角度具体多大。`;
  }
}

function setMol(id) {
  if (locked()) return;
  st.mol = id;
  document.body.dataset.mol = id;
  $$("[data-mol-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.molTab === id)));
  st.tried = {};
  buildMol();
  paintReadout();
  paintTried();
  paintNet();
  resultEl.className = "result";
  resultEl.innerHTML = id === "phen"
    ? "点一个操作按钮。分子会真的转过去、或穿过镜面；虚线圈是原来的位置。"
    : "SnCl₂ 只有 3 个原子，更容易看清每个操作把谁送到了哪里。拖动下方滑块可以改变键角。";
  fillTable();
}

function setAngle(a) {
  st.angle = Math.min(180, Math.max(60, a));
  $("#ang").value = st.angle;
  buildMol();
  paintReadout();
  st.tried = {};
  paintTried();
  paintNet();
}

// ───────── 视角 ─────────
const VIEWS = { oblique: [-36, 17], face: [0, 0], top: [0, 89.9], side: [90, 0] };
async function goView(name) {
  const [y1, p1] = VIEWS[name].map((d) => d * DEG), y0 = st.yaw, p0 = st.pitch;
  let dy = y1 - y0;
  dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  await tween(550, (t) => { st.yaw = y0 + dy * t; st.pitch = p0 + (p1 - p0) * t; });
}
function initDrag() {
  let drag = null;
  stage.addEventListener("pointerdown", (e) => { drag = [e.clientX, e.clientY, st.yaw, st.pitch, e.pointerType]; stage.setPointerCapture(e.pointerId); });
  stage.addEventListener("pointermove", (e) => {
    if (!drag) return;
    st.yaw = drag[2] + (e.clientX - drag[0]) * 0.6 * DEG;
    if (drag[4] === "mouse" || drag[4] === "pen") st.pitch = Math.max(-89.9 * DEG, Math.min(89.9 * DEG, drag[3] + (e.clientY - drag[1]) * 0.6 * DEG));
    st.dirty = true;
  });
  const end = () => (drag = null);
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);
  stage.addEventListener("keydown", (e) => {
    const k = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] }[e.key];
    if (!k) return;
    e.preventDefault();
    st.yaw += k[0] * DEG;
    st.pitch = Math.max(-89.9 * DEG, Math.min(89.9 * DEG, st.pitch + k[1] * DEG));
    st.dirty = true;
  });
  const fit = () => { const w = stage.getBoundingClientRect().width || 600; labelK = Math.min(1.7, Math.max(1, 600 / w)); st.dirty = true; };
  new ResizeObserver(fit).observe(stage);
  fit();
}

// ───────── 流程图里的"演示"按钮 ─────────
function stageInView() {
  const r = stage.getBoundingClientRect();
  return r.top >= -r.height * 0.3 && r.bottom <= innerHeight + r.height * 0.3;
}
async function demo(spec) {
  if (locked()) return;
  st.demo = true; // 整段演示期间（含步骤之间的停顿）锁住所有控件
  setBusy();
  try {
    if (!stageInView()) { stage.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" }); await sleep(650); }
    if (spec === "angle180") {
      const a0 = st.angle;
      await tween(1300, (t) => setAngle(a0 + (180 - a0) * t));
      resultEl.className = "result ok";
      resultEl.innerHTML = `<b>拉直到 180° 后：</b>点群变成 ${pgHTML("D∞h")}。真实的 SnCl₂ 做不到这一点——Sn 上那对孤对电子要占一个方向。2.5 秒后回到 98.1°。`;
      await sleep(2500);
      await tween(1100, (t) => setAngle(180 + (SNCL_ANGLE - 180) * t));
      setAngle(SNCL_ANGLE);
      return;
    }
    if (spec.startsWith("view:")) { await goView(spec.slice(5)); return; }
    if (st.hist.length) { resetPose(false); await sleep(250); }
    const ids = spec.split(",");
    for (const [k, id] of ids.entries()) {
      await runOp(id, true);
      if (k < ids.length - 1) await sleep(OPS[id].cand ? 500 : 1300);
    }
  } finally {
    st.demo = false;
    setBusy();
  }
}

// ───────── 2D 小图：画廊、答案卡 ─────────
function draw2D(mol, { s = 21, pad = 22, label = "", lp = false } = {}) {
  const E = findElements(mol.atoms), C = classify(mol.atoms, E);
  const heavy = mol.atoms.filter((a) => a.el !== "H");
  const pt = (p) => [p[1] * s, -p[2] * s];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const a of heavy) { const [x, y] = pt(a.pos); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const X = Math.max(Math.abs(x0), Math.abs(x1)) + pad, Y = Math.max(Math.abs(y0), Math.abs(y1)) + pad + (lp ? 10 : 0);
  const R = Math.hypot(X, Y);
  let o = "";
  const line = (d, cls) => { const [dx, dy] = [d[1], -d[2]], L = Math.hypot(dx, dy); return `<line class="${cls}" x1="${(-dx / L * R).toFixed(1)}" y1="${(-dy / L * R).toFixed(1)}" x2="${(dx / L * R).toFixed(1)}" y2="${(dy / L * R).toFixed(1)}"/>`; };
  if (C.linear) {
    o += line(E.linearAxis, "m-cinf");
    o += line(cross(E.linearAxis, [1, 0, 0]), "m-band");
  } else {
    for (const pl of E.planes) if (Math.abs(pl.normal[0]) < 0.999) o += line(cross(pl.normal, [1, 0, 0]), "m-band");
    for (const ax of E.axes) if (Math.abs(ax.dir[0]) < 0.999) o += line(ax.dir, "m-c2");
    for (const ax of E.axes) if (Math.abs(ax.dir[0]) >= 0.999) o += `<path class="m-lens" d="M-8,0Q0,-9 8,0Q0,9 -8,0Z"/>`;
  }
  if (E.inversion) o += `<circle class="m-inv" r="4.2"/>`;
  for (const [i, j] of mol.bonds) {
    const a = mol.atoms[i], b = mol.atoms[j];
    if (a.el === "H" || b.el === "H") continue;
    const p = pt(a.pos), q = pt(b.pos);
    o += `<line class="m-bond" x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}"/>`;
  }
  for (const r of mol.rings || []) { const c = pt(r.center); o += `<circle class="m-arom" cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${(0.56 * BOND * s).toFixed(1)}"/>`; }
  for (const a of heavy) {
    if (a.el === "C") continue;
    const [x, y] = pt(a.pos), w = a.el.length > 1 ? 11 : 7.5;
    o += `<circle class="m-knock" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${w + 1}"/><text class="m-at m-${a.el}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" dy=".36em">${a.el}</text>`;
    if (lp && (a.el === "Sn")) o += `<circle class="m-lpd" cx="${(x - 3.6).toFixed(1)}" cy="${(y - 15).toFixed(1)}" r="2.1"/><circle class="m-lpd" cx="${(x + 3.6).toFixed(1)}" cy="${(y - 15).toFixed(1)}" r="2.1"/>`;
  }
  return { svg: `<svg class="mini" viewBox="${(-X).toFixed(1)} ${(-Y).toFixed(1)} ${(2 * X).toFixed(1)} ${(2 * Y).toFixed(1)}" role="img" aria-label="${label}（点群 ${C.group}）">${o}</svg>`, C, E };
}

function elementSummary(C, E) {
  if (C.linear) return `<i>E</i> · <i>C</i><sub>∞</sub> · ∞<i>σ</i><sub>v</sub> · <i>σ</i><sub>h</sub> · <i>i</i> · ∞<i>C</i><sub>2</sub>`;
  const nC2 = E.axes.filter((a) => a.n === 2).length;
  const parts = ["<i>E</i>"];
  if (nC2) parts.push(`${nC2 > 1 ? nC2 + " 条 " : ""}<i>C</i><sub>2</sub>`);
  parts.push(`${E.planes.length > 1 ? E.planes.length + " 个 " : ""}<i>σ</i>`);
  if (E.inversion) parts.push("<i>i</i>");
  return parts.join(" · ") + ` · <i>h</i> = ${groupOrder(C.group)}`;
}

function buildGallery() {
  const cards = [
    ["anthracene", "蒽 anthracene", anthracene(), "三环<b>线形</b>稠合：多出两条 <i>C</i><sub>2</sub>、一个反演中心 <i>i</i>，升为 D 群。"],
    ["phenanthrene", "菲 phenanthrene", phenanthreneFamily([]), "三环<b>角形</b>稠合：和邻二氮菲同一个骨架，同一个点群。"],
    ["phen", "1,10-菲咯啉（本题 a）", phenanthreneFamily(["1", "10"]), "两个 N 正好是一对被 <i>C</i><sub>2</sub> 交换的位置，对称性没有降低。"],
    ["phen17", "1,7-菲咯啉", phenanthreneFamily(["1", "7"]), "把一个 N 挪到 7 位：<i>C</i><sub>2</sub> 和 <i>σ</i><sub>v</sub>(<i>xz</i>) 都消失，只剩分子平面。"],
    ["sncl2", "SnCl₂（本题 b，98.1°）", triatomic("Sn", "Cl", SNCL_ANGLE, SNCL), "AX₂E：Sn 上一对孤对电子把分子压弯。", true],
    ["hgcl2", "HgCl₂（线形）", triatomic("Hg", "Cl", 180, HGCL), "AX₂：Hg(II) 价层没有孤对电子，分子是直的。"],
  ];
  $("#gallery").innerHTML = cards.map(([id, name, mol, note, lp]) => {
    const { svg, C, E } = draw2D(mol, { label: name, lp, s: mol.atoms.length > 3 ? 19 : 26 });
    return `<figure class="g-card${id === "phen" || id === "sncl2" ? " is-q" : ""}" data-pg="${C.group}">${svg}<figcaption><span class="g-name">${name}</span><span class="g-pg">${pgHTML(C.group)}</span><span class="g-el">${elementSummary(C, E)}</span><span class="g-note">${note}</span></figcaption></figure>`;
  }).join("");
  // 题目答案卡里的小图
  $("#fig-a").innerHTML = draw2D(phenanthreneFamily(["1", "10"]), { label: "1,10-菲咯啉", s: 15, pad: 16 }).svg;
  $("#fig-b").innerHTML = draw2D(triatomic("Sn", "Cl", SNCL_ANGLE, SNCL), { label: "SnCl₂", s: 24, pad: 18, lp: true }).svg;
}

// 键角量角器（VSEPR 一节）
function buildProtractor() {
  const cx = 160, cy = 40, r = 120;
  const ray = (deg, cls, text, ty) => {
    const h = (deg / 2) * DEG;
    const a = [cx - r * Math.sin(h), cy + r * Math.cos(h)], b = [cx + r * Math.sin(h), cy + r * Math.cos(h)];
    return `<g class="${cls}"><polyline points="${a[0].toFixed(1)},${a[1].toFixed(1)} ${cx},${cy} ${b[0].toFixed(1)},${b[1].toFixed(1)}"/><text x="${(b[0] + 6).toFixed(1)}" y="${(b[1] + ty).toFixed(1)}">${text}</text></g>`;
  };
  $("#protractor").innerHTML =
    `<path class="pr-arc" d="M${cx - r},${cy} A${r},${r} 0 0 0 ${cx + r},${cy}"/>` +
    ray(180, "pr-180", "180° 线形 AX₂（HgCl₂）", -8) +
    ray(120, "pr-120", "120° AX₂E 的理想角", 4) +
    ray(SNCL_ANGLE, "pr-sn", "98.1° SnCl₂ 实测（气相）", 4) +
    `<circle class="pr-c" cx="${cx}" cy="${cy}" r="9"/><text class="pr-sn-t" x="${cx}" y="${cy}" dy=".35em">Sn</text>` +
    `<g class="pr-lp"><ellipse cx="${cx}" cy="${cy - 22}" rx="9" ry="14"/><circle cx="${cx - 3.3}" cy="${cy - 22}" r="1.9"/><circle cx="${cx + 3.3}" cy="${cy - 22}" r="1.9"/></g>`;
}

// ───────── 延伸：特征标表与 3N 表示 ─────────
function fillTable() {
  const mol = st.mol === "phen" ? phenanthreneFamily(["1", "10"]) : triatomic("Sn", "Cl", SNCL_ANGLE, SNCL);
  const r = cartesianAnalysis(mol.atoms), n = mol.atoms.length;
  const row = (id, vals) => $$(`#${id} td.v`).forEach((td, k) => (td.textContent = String(vals[k]).replace("-", "−")));
  row("t-un", r.unmoved);
  row("t-pa", r.perAtom);
  row("t-g", r.g3n);
  const names = C2V.irreps.map((i) => i.name);
  const irr = (nm) => `<i>${nm[0]}</i><sub>${nm[1]}</sub>`;
  const sum = (ns) => ns.map((x, k) => (x ? `${x === 1 ? "" : x}${irr(names[k])}` : "")).filter(Boolean).join(" + ");
  $("#t-mol").textContent = st.mol === "phen" ? "邻二氮菲（N = 22）" : "SnCl₂（N = 3）";
  $("#red-lines").innerHTML = C2V.irreps.map((ir, k) => {
    const terms = r.g3n.map((g, j) => `${g < 0 ? "(−" + -g + ")" : g}·${ir.chi[j] < 0 ? "(−1)" : "1"}`).join(" + ");
    return `<div class="red"><span class="red-k">${irr(ir.name)}</span><span class="red-f">¼ [ ${terms} ] = <b>${r.n3n[k]}</b></span></div>`;
  }).join("");
  const vib = r.nVib.reduce((a, b) => a + b, 0);
  const ir = r.nVib[0] + r.nVib[2] + r.nVib[3], raman = vib;
  $("#t-sum").innerHTML =
    `<p><span class="lhs">Γ<sub>3N</sub></span> = ${sum(r.n3n)} <span class="cnt">（共 ${3 * n} = 3N）</span></p>` +
    `<p><span class="lhs">− Γ<sub>平动</sub></span> = ${sum(r.nT)}　<span class="lhs">− Γ<sub>转动</sub></span> = ${sum(r.nR)}</p>` +
    `<p class="vib"><span class="lhs">Γ<sub>振动</sub></span> = ${sum(r.nVib)} <span class="cnt">（共 ${vib} = 3N − 6）</span></p>` +
    `<p class="act">红外活性（<i>A</i><sub>1</sub>、<i>B</i><sub>1</sub>、<i>B</i><sub>2</sub>，对应 <i>z</i>、<i>x</i>、<i>y</i>）：<b>${ir}</b> 个；拉曼活性（四种都有二次项）：<b>${raman}</b> 个${r.nVib[1] ? `；其中 ${r.nVib[1]} 个 <i>A</i><sub>2</sub> 只有拉曼活性` : "；三个振动都同时有红外和拉曼活性"}。</p>`;
}

// ───────── 启动 ─────────
function init() {
  const mk = (id) => `<button type="button" class="op op-${OPS[id].cls || "cand"}" data-op="${id}"${OPS[id].linearOnly ? " hidden" : ""}><span class="op-sym">${OPS[id].html}</span><span class="op-sub">${OPS[id].sub}</span><span class="op-st" aria-hidden="true"></span></button>`;
  $("#ops-true").innerHTML = GROUP_OPS.map(mk).join("");
  $("#ops-cand").innerHTML = CAND_OPS.map(mk).join("");
  $$(".op").forEach((b) => b.addEventListener("click", () => runOp(b.dataset.op)));
  $$("[data-mol-tab]").forEach((b) => b.addEventListener("click", () => setMol(b.dataset.molTab)));
  $$("[data-demo]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.demoMol && b.dataset.demoMol !== st.mol) setMol(b.dataset.demoMol);
    demo(b.dataset.demo);
  }));
  $$("[data-view]").forEach((b) => b.addEventListener("click", () => goView(b.dataset.view)));
  $("#reset").addEventListener("click", () => { if (!locked()) resetPose(); });
  $("#ang").addEventListener("input", (e) => { if (!locked()) setAngle(+e.target.value); });
  $$("[data-ang]").forEach((b) => b.addEventListener("click", () => { if (!locked()) setAngle(+b.dataset.ang); }));
  $$("[data-show]").forEach((c) => c.addEventListener("change", () => { st.show[c.dataset.show] = c.checked; st.dirty = true; }));
  initDrag();
  buildGallery();
  buildProtractor();
  setMol("phen");
  document.body.classList.add("js");
  requestAnimationFrame(loop);
  window.__sym = { st, runOp, setMol, setAngle, demo };
}
init();
