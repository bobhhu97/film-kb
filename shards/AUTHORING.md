# 胶片知识库 · 写作与增补规范 v1

本规范约束 `shards/*.json` 中每一条知识的写法。目标是 80% 符合 ASD-STE100
（Simplified Technical English，国际标准 IEC 61082）。达不到 100% 是因为需要大量
技术术语和化学式，这些词在 STE100 受控词表之外。

---

## 1. 语言与体例

- 正文语言：简体中文。设备型号、药液代号、配方名、文件名保留英文原文。
- 每个术语首次出现时写成「中文（English Term, 缩写）」，之后可用中文或缩写。
- 单位与数值：用数字加单位，例：`20 °C`、`3 分 30 秒`、`ISO 400`、`f/5.6`。
- 语气：陈述性技术文体。不用感叹号，不用营销语，不用「我们」。
- 每一句只表达一个意思。一段不超过 5 句。

### STE100 核心规则（作者必查）

| 规则 | 要求 | 正例 | 反例 |
|---|---|---|---|
| 主动语态 | 用主语做动作 | 「显影液还原银盐。」 | 「银盐被显影液还原。」 |
| 祈使句 | 操作用祈使句 | 「把温度调到 20 °C。」 | 「你应该把温度调到 20 °C。」 |
| 无否定 | 能正说就正说 | 「使用新药液。」 | 「不要使用旧药液。」→ 改「使用新药液。」 |
| 缩略语 | 首次给全称 | 「有效孔径（effective aperture）。省略值 f/5.6。」 | 「f/5.6 就那样。」 |
| 动词时态 | 说明文用现在时 | 「药液在 5 °C 时变慢。」 | 「药液将会变慢。」 |
| 避免专名 | 说设备类别 | 「旋转式冲洗机（rotator）」 | 「某某牌机器更好。」 |
| 条件句 | 一个句子一个条件 | 「如果温度是 20 °C，那么时间是 3 分 30 秒。」 | 嵌套多个 if |
| 数量 | 给具体数 | 「冲洗 3 次。」 | 「冲洗几次。」 |

例外：直接引用厂商规格、论坛说法、书籍原文时，允许保留原文并加引号，
在 `note` 中说明「原文如此」。

## 2. 词条结构

```
id / title / title_en / aliases / type / level / era / tags / summary / blocks / refs / links / quiz / checklist
```

- `id`：小写、a-z0-9、点分单词。全库唯一。一经发布不改，改名时在旧 id 加 `aliases`。
- `type`：`concept / process / equipment / chemical / film / setting / timeline / technique / pitfall / comparison / table`。
- `level`：1 入门 → 5 考据。5 级条目必须给具体年份、型号或具体数值。
- `era`：适用年代，如 `1962-1994`、`1998 至今`。与本条目相关的才填。
- `summary`：1–3 句，写清「是什么」和「为什么重要」。读者只读 summary 也要能判断是否相关。
- `blocks`：正文，至少 3 块。
- `refs`：至少 1 条。配方、型号、数值类条目必须有权威来源。
- `links`：全部指向真实存在的 entry id（跨分片）。

### blocks 的 kind 与写法

| kind | 用途 | 关键字段 |
|---|---|---|
| `h2` | 小节标题 | `text` |
| `p` | 段落 | `text` |
| `ul` / `ol` | 要点 / 有序列表 | `text`（每行 `- ` 或 `1. `） |
| `steps` | 操作步骤 | `items`：`[{t:"步骤标题", d:"说明"}]` |
| `defs` | 定义 | `term` + `text` |
| `note` | 补充说明 | `text` |
| `warn` | 警告（安全、损坏风险） | `text` |
| `tip` | 经验技巧 | `text` |
| `table` | 速查表 | `caption` + `rows`（每行 `{c1..c5}`，`c1` 为行标题） |
| `compare` | 两项对比 | `caption` + 恰好 2 行 `{c1..c5}` |
| `formula` | 配方的计算公式 | `caption` + `text`（Markdown） |
| `calc` | 稀释/用量的算例 | `caption` + `text` |
| `timeline` | 年代沿革 | `caption` + `rows`（`{c1:"年份", c2:"事件", c3:"意义"}`，按时间升序） |
| `settings` | 设备设置方案 | `caption` + `items`（`{t:"参数", d:"推荐值"}`） |
| `troubleshoot` | 故障排查 | `caption` + `items`（`{t:"症状", d:"原因与处理"}`） |
| `glossary` | 术语表条目 | `term` + `text` |
| `image` | 插图 | `src`（`img/<文件名>`）+ `alt`（无障碍替代文本）+ `caption` + `license` + `source` + `credit` |

### 文本中的交叉引用

正文里引用别的词条，写 `$entry-id`。例如：

```
参见 $bw-process.kodak-d-76 了解工作液配方。
```

渲染时自动变成可点击链接。写成 `$不存在的-id` 视为错误。

## 3. 配方类条目的硬性要求

配方用 `formula` 或 `table` 块，条件与数值必须完整：

1. **原液（stock）组成**：成分名 + 含量（g/L 或 %）。
2. **工作液（working）稀释**：例如 1+1、1+2，注明是体积比。
3. **温度 / 时间 / 显影类型**。
4. **可存放时间**：原液与工作液分开写。
5. **容量与搅拌**。
6. `refs` 必须指向厂商配方页、公开实验记录或书籍 ISBN。
7. 明确标注哪些数值是「标准值」、哪些是「常见变体」。不确定的写
   `status: "draft"` 并在 note 中说明「数值需自行以厂商说明书为准」。

## 4. 设备 / 机型类条目的硬性要求

- 写明：厂商、型号、推出年代、生产年代区间、核心原理、相对上一代的变化、
  关键规格（容量、温控方式、精度）、常见故障、是否仍在产。
- **不做无依据的优劣评价**。评价必须写成「在 A 条件下更合适」。
- 已停产型号写 `status: "stable"`，并注明停产年份（不确定就不写年份）。
- 型号级条目把该型号的实际设置建议放 `settings` 块，不要散落在正文。

## 5. 自测题与学习进度

`quiz` 建议 2–4 题。`answer` 是选项下标（0 起）。`bool` 用 options `["是","否"]`。
`cloze` 用 options 给出待填词。判定标准：4 题对 4 = 掌握，3/4 = 复习，≤2 = 重学。

## 6. 增补流程（作者）

1. 新建分片文件：`shards/<module>.<nn>.json`，`nn` 两位递增，不复用旧号。
2. 或直接往现有分片里加 entry（保持 `entries` 数组按 `id` 字母序）。
3. 跑校验：`node tools/validate.mjs`。必须无 error。warning 逐条看。
4. 跑打包：`node tools/build.mjs`。生成 `web/data/bundle.json` 与 `web/index.html`。
5. 改完刷新网页确认条目可搜索、可打开、图谱连线正常。
6. 重要修订更新 `updated` 字段，把 `status` 从 `draft` 提到 `reviewed` 或 `stable`。

## 7. 目录约定

```
shards/
  00-meta/modules.json      模块表
  <module>.<nn>.json         内容分片
web/
  index.html                 站点外壳（引用 data/bundle.json）
  app.js  styles.css
  data/bundle.json           build.mjs 生成，不要手改
tools/
  validate.mjs  build.mjs
```

## 8. 语言门槛（读者英语水平）

正文用常用词。生僻词第一次出现时给英文原文。避免比喻。
避免「唯有……才」「其实」「基本上」「建议大家」这类口语。