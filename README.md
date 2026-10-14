# Molecular Symmetry Graph｜分子对称性图解

分子对称性与点群的交互图解。每一页都在可拖动的 3D 模型上**亲手执行对称操作**：做完以后同种原子全部落回原来的位置，才算对称操作；有原子落空就不是。点群结论由脚本从原子坐标重新穷举对称元素来核验。

在线阅读：<https://uugyfgyb.github.io/Molecular-Symmetry-Graph/>

## 专题

| 专题 | 内容 | 关键词 |
|---|---|---|
| [`c2v-phenanthroline-sncl2`](./topics/c2v-phenanthroline-sncl2/) | 题 1-22：邻二氮菲（1,10-菲咯啉）与 SnCl₂ 的点群判定，两者都是 C2v | Schoenflies 流程、C2、σv、VSEPR、特征标表、Γ3N 约化 |

## 结构

```
Molecular-Symmetry-Graph/
├── index.html                                  目录页（浅色／深色自适应）
├── README.md
├── .nojekyll
└── topics/
    └── c2v-phenanthroline-sncl2/
        ├── index.html                          单文件专题页，可离线打开（由 source/build.mjs 生成）
        ├── README.md                           内容、分层、来源与核验
        ├── preview.png / preview-mobile.png
        ├── verification.json                   source/verify.mjs 的 39 项对称性核验
        ├── qa-browser.json                     source/qa-browser.mjs 的 48 项浏览器验收
        ├── package.json                        构建 / 核验脚本依赖（playwright-core）
        └── source/
            ├── problem.png                     用户原图（题目照片）
            ├── page.html                       页面模板（样式与正文）
            ├── sym.js                          几何与对称性引擎，页面与核验脚本共用
            ├── app.js                          3D 舞台与交互
            ├── build.mjs                       合成 index.html，拒绝任何在线资源
            ├── verify.mjs                      从坐标重新判定点群、约化表示
            └── qa-browser.mjs                  真实浏览器里逐个执行操作并核对
```

## 本库规则

1. **页面不得依赖在线资源**：不引用 CDN、在线字体或第三方库（中文使用本地字体栈，公式用浏览器原生 MathML）。单个 `index.html` 下载后即可离线阅读；参考文献外链除外。`build.mjs` 发现外链资源会拒绝构建。
2. **点群结论必须可复算**：页面上写出的点群、操作是否成立、原子交换、表示约化，都要由 `verify.mjs` 从坐标独立算一遍。
3. **分层标注**：分清 用户原图 / 精确（脚本核验）/ 近似（文献值）/ 教学示意（理想化几何、原子大小、轨道示意），不把示意几何写成实测结构。
4. **术语中英对照**：名词与动词都标注，页末汇总为术语表。
5. **坐标约定写明**：主轴为 *z*；平面 C2v 分子按 Mulliken（1955）放在 *yz* 平面。换约定只会让 B1/B2 标签互换。
6. 只有 `main` 分支，每次提交直接推送到 `main`。

## 本地构建与核验

本机只需 [Deno](https://deno.com) 2（或 Node ≥ 18）：

```bash
cd topics/c2v-phenanthroline-sncl2
deno install
deno run -A source/verify.mjs      # 对称性核验 → verification.json
deno run -A source/build.mjs       # 生成 index.html
deno run -A source/qa-browser.mjs  # 浏览器验收 → qa-browser.json、preview*.png（需本机 Chromium / Chrome / Edge）
```
