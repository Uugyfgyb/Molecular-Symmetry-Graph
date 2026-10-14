// 浏览器验收：在真实的 Chromium 里打开 ../index.html，逐个执行对称操作并核对判定结果，检查画廊、特征标表、
// 三种宽度下的横向溢出、脚本报错与网络请求（必须为零），并生成 preview.png / preview-mobile.png 与 qa-browser.json。
// 运行：deno run -A source/qa-browser.mjs [--shots 目录]   （或 node …；需要 playwright-core 和本机 Chromium / Edge / Chrome）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const url = pathToFileURL(path.join(root, "index.html")).href;
const shotsDir = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : null;
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });

async function launch() {
  const home = process.env.LOCALAPPDATA || "";
  const pw = path.join(home, "ms-playwright");
  const candidates = [
    process.env.CHROMIUM_PATH,
    ...(fs.existsSync(pw) ? fs.readdirSync(pw).filter((d) => d.startsWith("chromium_headless_shell-")).map((d) => path.join(pw, d, "chrome-headless-shell-win64", "chrome-headless-shell.exe")) : []),
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  ].filter((p) => p && fs.existsSync(p));
  for (const executablePath of candidates) { try { return [await chromium.launch({ executablePath }), path.basename(executablePath)]; } catch { /* 换下一个 */ } }
  for (const channel of ["msedge", "chrome"]) { try { return [await chromium.launch({ channel }), channel]; } catch { /* 换下一个 */ } }
  return [await chromium.launch(), "playwright 默认"];
}

const checks = [];
const check = (name, ok, detail = "") => checks.push({ name, ok: !!ok, detail: String(detail) });
const [browser, engine] = await launch();
const errors = [], online = [];

async function open(width, height, { colorScheme = "light", reducedMotion = "no-preference" } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme, reducedMotion, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(`[${width}] console: ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`[${width}] pageerror: ${e.message}`));
  page.on("request", (r) => { if (!/^(file|data|blob):/.test(r.url())) online.push(r.url()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__sym && document.querySelector("#L-items").childElementCount > 0);
  await page.addStyleTag({ content: "html{scroll-behavior:auto!important}" }); // 截图前的跳转要立即到位
  return page;
}
const idle = (page) => page.waitForFunction(() => !window.__sym.st.busy && !window.__sym.st.demo, null, { timeout: 20000 });
const txt = (page, sel) => page.$eval(sel, (el) => el.textContent.replace(/\s+/g, " ").trim());
async function op(page, id) {
  await page.click(`.op[data-op="${id}"]`);
  await page.waitForTimeout(30);
  await idle(page);
  return page.$eval("#result", (el) => ({ cls: el.className, text: el.textContent.replace(/\s+/g, " ").trim() }));
}

// ───────── 功能：减少动态效果，让动画瞬间完成 ─────────
const page = await open(1440, 900, { reducedMotion: "reduce" });
check("初始点群读数 = C2v（邻二氮菲）", (await txt(page, "#ro-pg")) === "C2v", await txt(page, "#ro-pg"));
const expect = { E: "ok", C2z: "ok", sxz: "ok", syz: "ok", C2x: "bad", C2y: "bad", inv: "bad", sxy: "bad" };
for (const [id, want] of Object.entries(expect)) {
  await page.click("#reset");
  const r = await op(page, id);
  check(`邻二氮菲：${id} → ${want === "ok" ? "成立" : "不成立"}`, r.cls.includes(want), r.text.slice(0, 90));
}
await page.click("#reset");
let r = await op(page, "C2z");
check("C2 结果列出 N1 ⇄ N10 与 8 个 H 交换、不动原子 0", /N1 ⇄ N10/.test(r.text) && /8 个 H/.test(r.text) && /不动的原子：0/.test(r.text), r.text);
r = await op(page, "sxz");
check("累计：C2 → σv(xz) ＝ σv′(yz)", /＝ 只做一次 σv′\(yz\)/.test(await txt(page, "#net")), await txt(page, "#net"));
await page.click("#reset");
r = await op(page, "syz");
check("σv′(yz)：22 个原子全部不动", /不动的原子：22/.test(r.text) && /p 轨道/.test(r.text), r.text);
check("p 轨道开关默认关闭，打开后出现 28 个瓣", await (async () => {
  const before = await page.$$eval("#stage .lobe", (l) => l.length);
  await page.check('[data-show="p"]');
  await page.waitForTimeout(80);
  const after = await page.$$eval("#stage .lobe", (l) => l.length);
  await page.uncheck('[data-show="p"]');
  return before === 0 && after === 28;
})());
check("孤对电子：邻二氮菲 2 个", (await page.$$eval("#stage .lp", (l) => l.length)) === 2);

// 演示按钮（流程第 4 步）：两条候选都失败
await page.click("#reset");
await page.click('[data-demo="C2x,C2y"]');
await page.waitForTimeout(50);
await idle(page);
check("流程演示：C2(x)、C2(y) 都标为 ✗", (await txt(page, '.op[data-op="C2x"] .op-st')) === "✗" && (await txt(page, '.op[data-op="C2y"] .op-st')) === "✗");

// SnCl2
await page.click('.seg [data-mol-tab="sncl2"]');
await idle(page);
check("切换到 SnCl₂：读数 C2v、键角 98.1°", (await txt(page, "#ro-pg")) === "C2v" && (await txt(page, "#ang-out")) === "98.1°", (await txt(page, "#ro-pg")) + " " + (await txt(page, "#ang-out")));
for (const [id, want] of Object.entries(expect)) {
  await page.click("#reset");
  const rr = await op(page, id);
  check(`SnCl₂：${id} → ${want === "ok" ? "成立" : "不成立"}`, rr.cls.includes(want), rr.text.slice(0, 90));
}
await page.click("#reset");
r = await op(page, "C2z");
check("SnCl₂ C2：Cl₁ ⇄ Cl₂，Sn 不动", /Cl₁ ⇄ Cl₂/.test(r.text) && /不动的原子：1/.test(r.text), r.text);
const setAng = (v) => page.$eval("#ang", (el, v) => { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }, v);
await setAng(120);
check("键角 120° 仍是 C2v", (await txt(page, "#ro-pg")) === "C2v");
await setAng(179.9);
check("键角 179.9° 仍是 C2v", (await txt(page, "#ro-pg")) === "C2v", await txt(page, "#ro-pg"));
await setAng(180);
check("键角 180° → D∞h", (await txt(page, "#ro-pg")) === "D∞h", await txt(page, "#ro-pg"));
check("180° 时出现 C∞ 按钮", await page.isVisible('.op[data-op="Cinf"]'));
for (const id of ["C2x", "C2y", "inv", "sxy", "Cinf"]) {
  await page.click("#reset");
  const rr = await op(page, id);
  check(`180°：${id} 成立`, rr.cls.includes("ok"), rr.text.slice(0, 80));
}
await page.click('[data-ang="98.1"]');
check("回到 98.1° → C2v，C∞ 按钮隐藏", (await txt(page, "#ro-pg")) === "C2v" && !(await page.isVisible('.op[data-op="Cinf"]')));

// 特征标表（跟随分子切换）
const row = (id) => page.$$eval(`#${id} td.v`, (tds) => tds.map((t) => t.textContent).join(","));
check("SnCl₂ 表：不动原子 3,1,1,3；Γ3N 9,−1,1,3", (await row("t-un")) === "3,1,1,3" && (await row("t-g")) === "9,−1,1,3", (await row("t-un")) + " | " + (await row("t-g")));
check("SnCl₂ Γvib = 2A1 + B2", /Γ振动 = 2A1 \+ B2/.test(await txt(page, "#t-sum")), await txt(page, "#t-sum"));
await page.click('.mol-switch [data-mol-tab="phen"]');
check("邻二氮菲表：不动原子 22,0,0,22；Γ3N 66,0,0,22", (await row("t-un")) === "22,0,0,22" && (await row("t-g")) === "66,0,0,22");
check("邻二氮菲 Γvib = 21A1 + 10A2 + 9B1 + 20B2，60 个", /Γ振动 = 21A1 \+ 10A2 \+ 9B1 \+ 20B2/.test(await txt(page, "#t-sum")) && /共 60/.test(await txt(page, "#t-sum")), await txt(page, "#t-sum"));
check("切换表格分子时实验台同步", (await txt(page, "#ro-pg")) === "C2v" && (await page.$eval("body", (b) => b.dataset.mol)) === "phen");

// 画廊
const pgs = await page.$$eval("#gallery .g-card", (cs) => cs.map((c) => c.dataset.pg));
check("画廊点群：蒽 D2h、菲 C2v、1,10 C2v、1,7 Cs、SnCl2 C2v、HgCl2 D∞h", pgs.join(",") === "D2h,C2v,C2v,Cs,C2v,D∞h", pgs.join(","));
check("MathML 约化公式存在", (await page.$$eval("math", (m) => m.length)) === 1);

// 溢出（三种宽度）
for (const [w, h] of [[1440, 900], [768, 1024], [390, 844]]) {
  const p = w === 1440 ? page : await open(w, h, { reducedMotion: "reduce" });
  const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  check(`宽 ${w}px 无横向溢出`, o.sw <= o.cw, `${o.sw} / ${o.cw}`);
  if (w === 390) {
    const sticky = await p.$eval(".stage-col", (el) => getComputedStyle(el).position);
    check("手机宽度下 3D 舞台不吸顶", sticky === "static", sticky);
  }
}

// ───────── 截图：正常动画 ─────────
const shot = async (p, file, opts = {}) => p.screenshot({ path: file, ...opts });
const desk = await open(1280, 800);
await desk.evaluate(() => document.querySelector("#lab").scrollIntoView());
await desk.evaluate(() => window.scrollBy(0, -12));
await desk.click('.op[data-op="C2z"]');
await desk.waitForTimeout(700); // 动画进行到一半
await shot(desk, path.join(root, "preview.png"));
await idle(desk);
if (shotsDir) {
  await shot(desk, path.join(shotsDir, "lab-after-c2.png"));
  await desk.evaluate(() => window.scrollTo(0, 0));
  await shot(desk, path.join(shotsDir, "hero.png"));
  for (const id of ["compare", "vsepr", "table", "sources"]) {
    await desk.evaluate((id) => document.getElementById(id).scrollIntoView(), id);
    await shot(desk, path.join(shotsDir, `sec-${id}.png`));
  }
  await desk.evaluate(() => document.querySelector("#lab").scrollIntoView());
  await desk.click('.op[data-op="C2x"]');
  await desk.waitForTimeout(1700);
  await shot(desk, path.join(shotsDir, "lab-c2x-fail.png"));
  await idle(desk);
  await desk.click('.seg [data-mol-tab="sncl2"]');
  await desk.check('[data-show="p"]');
  await desk.click('.op[data-op="syz"]');
  await idle(desk);
  await shot(desk, path.join(shotsDir, "lab-sncl2-syz-p.png"));
  const dark = await open(1280, 800, { colorScheme: "dark" });
  await dark.evaluate(() => document.querySelector("#lab").scrollIntoView());
  await shot(dark, path.join(shotsDir, "lab-dark.png"));
  await dark.evaluate(() => window.scrollTo(0, 0));
  await shot(dark, path.join(shotsDir, "hero-dark.png"));
}
const mob = await open(390, 844);
await shot(mob, path.join(root, "preview-mobile.png"));
if (shotsDir) {
  await mob.evaluate(() => document.querySelector("#lab").scrollIntoView());
  await shot(mob, path.join(shotsDir, "mobile-lab.png"));
  await mob.evaluate(() => window.scrollBy(0, 700));
  await shot(mob, path.join(shotsDir, "mobile-panel.png"));
  await mob.evaluate(() => document.querySelector("#table").scrollIntoView());
  await shot(mob, path.join(shotsDir, "mobile-table.png"));
}

check("没有脚本报错", errors.length === 0, errors.join(" | "));
check("零网络请求（页面完全离线）", online.length === 0, online.join(" | "));
await browser.close();

const failed = checks.filter((c) => !c.ok);
fs.writeFileSync(path.join(root, "qa-browser.json"), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), engine, passed: checks.length - failed.length, failed: failed.length, checks }, null, 2) + "\n");
for (const c of checks) console.log(`${c.ok ? "✓" : "✗"} ${c.name}${c.ok ? "" : "  → " + c.detail}`);
console.log(`\n${checks.length - failed.length}/${checks.length} 通过（${engine}）`);
if (failed.length) process.exit(1);
