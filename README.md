# 胶片摄影知识库 / Film Photography KB

从感光原理到混合式冲洗机，从放大配方到各型号扫描仪设置的离线知识库。
正文按 80% ASD-STE100（Simplified Technical English，IEC 61082）体例写成，每条知识附权威来源。

## 快速开始

站点是纯静态的：没有后端依赖，也没有外部 CDN 请求（字体已自托管子集化）。
直接用浏览器打开 `web/index.html` 即可使用。

若想更接近线上环境，用任意静态服务器：

```bash
cd web && python3 -m http.server 8899
# 然后访问 http://127.0.0.1:8899
```

线上站点：https://bobhhu97.github.io/film-kb/

## 目录结构

```
shards/                     数据源，唯一真源
  SCHEMA.md                 JSON Schema（draft-07），定义 entry/block/ref 结构
  AUTHORING.md              写作与增补规范 v1（STE100 规则 + blocks 写法 + 流程）
  00-meta/modules.json      8 个模块定义、entry type、难度等级
  00-meta/pending.json      已规划但尚未撰写的 entry id 白名单（正常情况下为空）
  <module>.<nn>.json        内容分片，每片 4–14 条 entry

tools/
  validate.mjs              校验：结构、必填字段、id 唯一性、STE100 违禁、跨片引用
  repair.mjs                修复：剔除悬空链接、把无效 $ref 降级为纯文本、删感叹号
  pending.mjs               重建 pending.json（扫描全库已引用但未落地的 id）
  build.mjs                 打包：生成 web/data/bundle.{json,js} 与 guide.js
  build-fonts.py            子集化字体：扫描全项目用字，输出 web/fonts/*.woff2
  imgwork/                  插图收集流水线（一次性工具，见其 README）

web/
  index.html                站点外壳
  styles.css                暗房主题样式
  app.js                    应用层：搜索、图谱、进度、间隔重复
  fonts/                    自托管子集字体（由 tools/build-fonts.py 生成）
  img/                      插图，逐张授权与出处见 ATTRIBUTION.md
  data/                     由 build.mjs 生成，不要手工编辑

.github/workflows/pages.yml 校验 + 构建 + 发布到 GitHub Pages
LICENSE                     知识内容许可（CC BY-SA 4.0）与双许可说明
LICENSE-CODE                程序代码许可（MIT）
ATTRIBUTION.md              54 张插图的逐张授权与出处
```

## 重新生成字体

`web/fonts/` 已提交成品，日常无需重建。只有在改动字体选型或需要扩大字符集时才跑：

```bash
python3 -m pip install fonttools brotli    # 唯一的外部依赖
python3 tools/build-fonts.py               # 只含项目实际用字，约 0.7 MB
python3 tools/build-fonts.py --safe        # 额外并入 GB2312 一级字库，约 2.0 MB
```

默认字符集是扫描全项目文本得到的项目用字。用户自己在笔记或搜索框键入的生僻字
不预置，由 `font-family` 回退链交给系统中文字体渲染；要让任意输入也用同一字体，
用 `--safe`。上游 TTF 缓存于 `tools/.fontsrc/`（已 gitignore）。

## 部署

推送到 `main` 即触发 `.github/workflows/pages.yml`：先运行 `tools/validate.mjs` 校验数据源，
再运行 `tools/build.mjs` 从 `shards/` 重新生成 `web/data/`，最后把 `web/` 发布到 GitHub Pages。
校验不通过则不部署。构建是幂等的，所以每次发布都以 `shards/` 为准。

## 日常增补三步

1. 编辑 `shards/<module>.<nn>.json`，新条目追加到对应分片的 `entries` 数组，按 id 字母序。
2. 运行 `node tools/validate.mjs`，必须 0 错误。
3. 运行 `node tools/build.mjs` 并刷新网页。

跨模块内容用新分片，不要塞进别的模块。

## 站点功能

| 页面 | 功能 |
|---|---|
| 首页 | 统计数字、8 个模块卡片与各自掌握率、4 条起步路径 |
| 浏览 | 按模块 / 类型 / 难度 / 状态 / 标签筛选，关键词全文检索与输入建议 |
| 词条页 | 正文、配方、设置表、对比表、故障排查、自测题、来源清单、关联导航、导出 Markdown |
| 知识图谱 | 力导向图，184 节点 / 1012 连线，按模块着色，可按模块与难度过滤 |
| 学习进度 | Leitner 间隔重复（盒子 0–5，间隔 0/1/2/4/8/16 天）、笔记、进度 JSON 导入导出 |
| 增补指南 | 本文的写作规范全文，含 blocks 写法对照表 |

学习进度只存在浏览器 localStorage（键名 `filmkb:v1`）。换设备时用「进度」页的导出 / 导入迁移。

## 体例约定

- 正文简体中文。设备型号、药液代号、配方名、文件名保留英文原文。
- 术语首次出现写成「中文（English Term, 缩写）」。
- 数值一律用数字加单位，例如 `20 °C`、`3 分 30 秒`、`ISO 400`、`f/5.6`。
- 不用感叹号，不用「我们」，一句一义。
- 配方类条目必须给：原液成分 g/L + 工作液稀释 + 温度 + 时间 + 保存期 + refs。
- 设备机型类条目必须给：厂商 / 型号 / 年代区间 / 原理 / 规格 / 故障 / 是否在产。不做无依据的优劣评价。
- 正文交叉引用写 `$entry-id`；`links.*` 只指向真实存在的 entry id，**不能填模块名**。
- `status` 是条目级字段：`draft` 表示有明确的待考证项，`reviewed` 表示已核实，`stable` 表示长期稳定。
  已充分考证的主体不要因为局部缺口就整条标 draft。

## 维护工具的已知限制

- `repair.mjs` 与 `pending.mjs` 的 `$ref` 正则已排除货币写法（如 `US$44.17`），金额建议直接写「44.17 美元」。
- `ul` / `ol` 块只读 `text` 字段，不支持 `items` 数组。
- `calc` / `formula` 块只有 `caption` 与 `text`。
- `table` 的表头写在 `rows[0].head`，写在 block 层会被渲染器忽略。
- `compare` 块至少 2 行，每行用 `c1` … `c5`。

## 当前规模

26 个分片 · 184 条词条 · 2361 个内容块 · 688 条来源 · 1012 条交叉引用 · 623 道自测题。

模块分布：胶片与相纸 37 · 拍摄与曝光 15 · 黑白冲洗化学 21 · 彩色冲洗 25 ·
冲洗设备与工艺沿革 24 · 放大与印放 17 · 扫描与数字化 28 · 保存与档案 17。

## 许可

本项目采用双许可：

- **知识内容**（`shards/`、`web/` 中的正文与数据）：[CC BY-SA 4.0](LICENSE)
- **程序代码**（`tools/`、`web/app.js`、`web/styles.css`、`web/index.html`）：[MIT](LICENSE-CODE)

`web/img/` 中的 54 张插图来自 Wikimedia Commons 等公开来源，各自有独立授权
（CC0 / 公有领域 / CC BY / CC BY-SA），逐张的作者与出处见 [ATTRIBUTION.md](ATTRIBUTION.md)。
其中 30 张为 CC BY-SA，转载时须以相同方式共享。