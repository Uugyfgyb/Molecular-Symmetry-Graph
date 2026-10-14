// 把 page.html + sym.js + app.js 合成一个可直接打开的 ../index.html。
// 运行：deno run -A source/build.mjs   （或 node source/build.mjs）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(here, f), "utf8");

let html = read("page.html");
// sym.js 是 ES 模块（verify.mjs 要 import 它）；内联进页面时去掉 export，和 app.js 共用一个模块作用域
const sym = read("sym.js").replace(/^export (?=const|function)/gm, "");
if (/^\s*export\b/m.test(sym)) throw new Error("sym.js 里还有没去掉的 export");
const app = read("app.js");

const put = (mark, text) => {
  if (!html.includes(mark)) throw new Error("模板缺少占位符 " + mark);
  html = html.replace(mark, () => text);
};
put("/*@@SYM@@*/", sym);
put("/*@@APP@@*/", app);

// 仓库规则：页面不得依赖在线资源。外链脚本、样式、图片、字体、@import 一律拒绝构建；<a href> 指向的参考文献除外。
const external = [...html.matchAll(/<(?:script|link|img|source|iframe|video|audio)\b[^>]*\b(?:src|href)="(https?:[^"]+)"|url\(\s*["']?(https?:[^)"']+)|@import\s+["']?(https?:[^"';]+)/g)]
  .map((m) => m[1] || m[2] || m[3]);
if (external.length) throw new Error("页面引用了在线资源：" + external.join(", "));
if (/\/\*@@\w+@@\*\//.test(html)) throw new Error("还有没替换的占位符");

// 每个演示按钮引用的操作都必须存在
const opIds = new Set([...app.matchAll(/^\s{2}(\w+): \{ kind:/gm)].map((m) => m[1]));
for (const m of html.matchAll(/data-demo="([^"]+)"/g)) {
  const spec = m[1];
  if (spec === "angle180" || spec.startsWith("view:")) continue;
  for (const id of spec.split(",")) if (!opIds.has(id)) throw new Error("演示按钮引用了不存在的操作：" + id);
}

fs.writeFileSync(path.join(here, "..", "index.html"), html);
console.log(JSON.stringify({ bytes: Buffer.byteLength(html), ops: [...opIds], demos: [...html.matchAll(/data-demo="([^"]+)"/g)].map((m) => m[1]) }, null, 2));
