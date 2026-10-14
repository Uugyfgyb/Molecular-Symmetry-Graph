# 邻二氮菲与 SnCl₂ 的点群：都是 C2v

> [打开页面](./index.html) · 在线：<https://uugyfgyb.github.io/Molecular-Symmetry-Graph/topics/c2v-phenanthroline-sncl2/>

题 1-22：*Assign each molecule below to the proper point group.* a. *o*-phenanthroline（邻二氮菲，1,10-菲咯啉）；b. stannous chloride（氯化亚锡 SnCl₂）。原题照片见 [`source/problem.png`](./source/problem.png)。

| 分子 | 点群 | 对称元素 | 阶 |
|---|---|---|---|
| a. 邻二氮菲 C₁₂H₈N₂ | **C2v** | E、C2（平面内，穿过 C5–C6 与 C10a–C10b 两根键的中点）、σv(xz)（⊥ 分子平面）、σv′(yz)（分子平面） | 4 |
| b. SnCl₂（气相单分子，弯曲形） | **C2v** | E、C2（穿过 Sn，平分 Cl–Sn–Cl 角）、σv(xz)（⊥ 分子平面，只含 Sn）、σv′(yz)（分子平面） | 4 |

## 页面包含

| 区块 | 内容 |
|---|---|
| 01 五种对称操作 | E、Cn、σ、i、Sn 速查；判据“同种原子全部落回原位”；对称元素必须过质心 |
| 02 3D 实验台 | 手写 SVG 投影的可拖动模型。执行 4 个本群操作（成立，列出原子交换和不动原子）和 4 个候选操作 C2(x)、C2(y)、i、σ(xy)（失败，红圈标出落空原子后自动还原）；累计连续操作并指出等于哪一个群元素（封闭性）；p 轨道开关显示分子平面反映如何对调 +/− 两瓣；SnCl₂ 键角滑块 60°–180°，点群由坐标实时计算，180° 时升为 D∞h 并出现 C∞ |
| 02 判定流程 | Schoenflies 六步，每步给出两个分子各自的理由和“另一支”通往哪些点群，并带演示按钮；两个分子走完全相同的路径 |
| 03 对比画廊 | 蒽 D2h、菲 C2v、1,10-菲咯啉 C2v、1,7-菲咯啉 Cs、SnCl₂ C2v、HgCl₂ D∞h；小图上的对称元素由程序从坐标找出后画上 |
| 04 SnCl₂ 为什么是弯的 | 路易斯结构、VSEPR（AX₂E）、键角量角器（180° / 120° / 98.1°）、固态为氯桥链状结构的提醒 |
| 05 延伸（题目未要求） | C2v 特征标表；不动原子 × 每原子贡献 → Γ3N；逐项展开的约化公式（MathML）；Γ振动 与红外 / 拉曼活性计数 |
| 06 常见错误 | 7 条 |
| 07 术语表 | 30 条中英对照（含动词） |

## 分层

- **用户原图**：题目照片（`source/problem.png`）。原图把邻二氮菲竖着画，本页把 C2 轴放成竖直的 *z* 轴。
- **精确（脚本核验）**：两个分子及画廊中六个分子的点群；每个操作成立与否；C2 的原子交换表（N1⇄N10、C2⇄C9、C3⇄C8、C4⇄C7、C4a⇄C6a、C5⇄C6、C10a⇄C10b）；群乘法 σv(xz)·C2 = σv′(yz)；Γ3N 与 Γ振动：
  - 邻二氮菲：不动原子 22/0/0/22，Γ3N = 22A1 + 11A2 + 11B1 + 22B2，Γ振动 = 21A1 + 10A2 + 9B1 + 20B2（60 = 3N − 6；面内 41 = 2N − 3，面外 19 = N − 3）
  - SnCl₂：不动原子 3/1/1/3，Γ3N = 3A1 + A2 + 2B1 + 3B2，Γ振动 = 2A1 + B2
- **近似（文献值）**：SnCl₂ 气相键角 98.1°；绘图用 Sn–Cl 2.34 Å（文献值多在 2.33–2.39 Å）。点群与这两个数无关：60°–179.9° 每隔 0.1° 都验证为 C2v，只有 180° 是 D∞h。
- **教学示意**：邻二氮菲、菲、蒽用理想正六边形搭建（环键 1.40 Å，C–H 1.08 Å）；原子球、孤对电子、p 轨道瓣的大小；HgCl₂ 键长。

坐标约定按 Mulliken（1955）：*z* 为 C2 主轴，平面分子躺在 *yz* 平面，*x* 垂直于分子平面。把分子放在 *xz* 平面的教材里，B1 与 B2 标签互换。

## 核验

- `source/verify.mjs`：从坐标穷举候选轴与镜面（坐标轴、原子方向、同种原子对的中点与差、原子位矢叉积），找出全部对称元素后按流程判点群，再约化 3N 表示。39 项，全部通过，见 [`verification.json`](./verification.json)。判定容差 1e-4 Å：几何是解析构造的精确值；取 0.01 Å 时 179° 的 SnCl₂ 会被误判成高阶群。
- `source/qa-browser.mjs`：在 Chromium 里逐个点击操作按钮核对判定、原子交换、累计结果、键角滑块、特征标表、画廊点群，检查 1440 / 768 / 390 px 无横向溢出、无脚本报错、零网络请求。48 项，全部通过，见 [`qa-browser.json`](./qa-browser.json)。

## 参考文献

1. A. Ya. Nasarenko, V. P. Spiridonov, B. S. Butayev, E. Z. Zasorin, *J. Mol. Struct.* **119**, 263–270 (1985) — SnCl₂ 气相电子衍射几何。
2. arXiv:2402.12778, “First-Principle Characterization of Structural, Electronic, and Optical Properties of Tin-Halide Monomers” — 汇总 SnCl₂ 实验与计算几何：<https://arxiv.org/abs/2402.12778>
3. R. S. Mulliken, *J. Chem. Phys.* **23**, 1997 (1955) — 多原子分子光谱记号与坐标约定。
4. PubChem CID 1318（1,10-phenanthroline）、67473（1,7-phenanthroline）、995（phenanthrene）、8418（anthracene）— 连接方式核对。

## 技术

单文件 HTML（约 100 KB）：3D 舞台是手写的 SVG 正交 + 轻微透视投影，按深度排序绘制，镜面拆成网格以便与原子正确遮挡；无 WebGL、无第三方库、无 CDN、无在线字体；公式用原生 MathML。浅色 / 深色随系统；系统设置“减少动态效果”时动画直接跳到结果。
