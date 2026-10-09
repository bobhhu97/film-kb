# imgwork — 插图收集流水线

给 `shards/*.json` 里的 `image` 块寻找、下载、缩放并登记配图。这些脚本是**一次性收集工具**，
不是站点运行依赖；网页只用 `web/img/` 里已落地的成品，不需要重跑它们。

## 实际数据流

分两个阶段。

**阶段一：候选发现**（模糊检索，产出候选池供人工挑选）

```
targets.json / targets3.json        待配图清单（关键词）
   ↓  sweep.py / sweep3.py
sweep_results.json / sweep_results3.json   候选图 + 元数据 + 评分
```

**阶段二：定稿落地**（当前有效入口）

```
selection.py       人工从候选池挑选后的定稿清单：SELECTION = [(slug, commons title, fmt), ...]
   ↓  fetch3.py（import selection / common）
fetched3.json      实际下载结果
   ↓  scale.py
web/img/*.jpg|png  落地成品
   ↓  manifest.py
web/img/MANIFEST.json   元数据真源：来源页、作者、授权、尺寸、中英文说明、verified
```

仓库根目录的 `ATTRIBUTION.md` 由 `MANIFEST.json` 汇总而来；页面里逐图显示的
`credit` / `license` 则来自 `shards/` 中对应 `image` 块的字段。

## 授权要求

只收录 **CC0 / 公有领域 / CC BY / CC BY-SA** 的图片。每张必须留下作者、来源页 URL、授权标识。
CC BY-SA 有传染性：混入一张授权不明的图，整个配图集就无法合规转载，所以
`manifest.py` 用了 `verified` 字段做人工核验标记。

## 已知问题

- `common.py` 被多数脚本 import，改动它会影响整条流水线。
- 多版本残留：`sweep.py` / `sweep2.py` / `sweep3.py`、`fetch_one.py` / `fetch_one2.py`、
  `collect.py` 是迭代过程的不同尝试，保留用于追溯当时的检索策略。**当前有效的是
  `selection.py` → `fetch3.py`。**
- 脚本用的是相对路径（`open("targets3.json")`），**必须在 `tools/imgwork/` 下运行**。
- `orig_cache/` 是原始下载缓存（约 17M，已 gitignore），删掉后需重新下载才能重跑 `scale.py`。
- 部分脚本里写死了 `/Users/claw/Documents/film-kb/...` 绝对路径，换机器需替换。
