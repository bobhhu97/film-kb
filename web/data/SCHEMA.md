{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "film-kb/shards/entry.schema.json",
  "title": "胶片知识库 · 词条分片 Schema v1",
  "type": "object",
  "required": ["module", "shard", "shard_zh", "entries"],
  "additionalProperties": false,
  "properties": {
    "module": {
      "type": "string",
      "description": "模块稳定 ID，与 modules.json 的 id 一致。",
      "enum": ["film-stock", "capture", "bw-process", "color-process", "process-equipment", "printing", "scanning", "archive"]
    },
    "shard": { "type": "string", "description": "分片 ID，形如 film-stock.01，全库唯一。", "pattern": "^[a-z-]+\\.[0-9]{2}$" },
    "shard_zh": { "type": "string", "description": "分片中文名。"},
    "note": { "type": "string", "description": "可选：分片说明/编者按。" },
    "entries": { "type": "array", "minItems": 1, "items": { "$ref": "#/definitions/entry" } }
  },
  "definitions": {
    "entry": {
      "type": "object",
      "required": ["id", "title", "title_en", "aliases", "type", "level", "tags", "summary", "blocks", "refs"],
      "additionalProperties": false,
      "properties": {
        "id": { "type": "string", "description": "全库唯一，形如 film-stock.kodak-tri-x-400，a-z0-9 与 . - 允许。", "pattern": "^[a-z0-9][a-z0-9.\\-]*$" },
        "title": { "type": "string" },
        "title_en": { "type": "string", "description": "英文标题或英文检索名。" },
        "aliases": { "type": "array", "items": { "type": "string" }, "description": "别名/常见叫法，含英文、型号、俗称。"},
        "type": { "type": "string", "enum": ["concept", "process", "equipment", "chemical", "film", "setting", "timeline", "technique", "pitfall", "comparison", "table"] },
        "level": { "type": "integer", "minimum": 1, "maximum": 5, "description": "1=入门 2=基础 3=进阶 4=专业 5=专家/年代考据。" },
        "era": { "type": "string", "description": "适用年代或时间跨度，如 1940s-1980s / 至今 / 1998-2006。可空串。" },
        "tags": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
        "summary": { "type": "string", "description": "1–3 句，说清这是什么/为什么重要。STE100 风格：主动语态、短句、一句一义。" },
        "blocks": { "type": "array", "minItems": 3, "items": { "$ref": "#/definitions/block" } },
        "refs": { "type": "array", "items": { "$ref": "#/definitions/ref" }, "minItems": 1 },
        "links": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "prereq": { "type": "array", "items": { "type": "string" }, "description": "先学（entry id）。" },
            "next": { "type": "array", "items": { "type": "string" } },
            "related": { "type": "array", "items": { "type": "string" } },
            "contrast": { "type": "array", "items": { "type": "string" }, "description": "对比/替代条目。" },
            "part_of": { "type": "array", "items": { "type": "string" }, "description": "所属上位概念条目。" }
          }
        },
        "quiz": {
          "type": "array",
          "description": "自测题，0–4 题。用于学习进度判定。",
          "items": {
            "type": "object",
            "required": ["q", "type"],
            "additionalProperties": false,
            "properties": {
              "q": { "type": "string" },
              "type": { "type": "string", "enum": ["single", "multi", "bool", "cloze"] },
              "options": { "type": "array", "items": { "type": "string" } },
              "answer": { "type": "array", "items": { "type": "integer" } },
              "why": { "type": "string" }
            }
          }
        },
        "checklist": { "type": "array", "items": { "type": "string" }, "description": "操作检查清单条目。" },
        "updated": { "type": "string", "description": "YYYY-MM-DD 最近修订日期。" },
        "status": { "type": "string", "enum": ["draft", "reviewed", "stable"], "description": "draft=待考证, reviewed=已核实, stable=多次核实。" }
      }
    },
    "block": {
      "type": "object",
      "required": ["kind", "text"],
      "additionalProperties": false,
      "properties": {
        "kind": {
          "type": "string",
          "enum": ["h2", "p", "ul", "ol", "steps", "note", "warn", "tip", "table", "defs", "calc", "formula", "compare", "timeline", "troubleshoot", "settings", "glossary", "image"]
        },
        "text": { "type": "string", "description": "Markdown，$id 引用条目，见写作体例规范。" },
        "src": { "type": "string", "description": "kind=image 时的图片路径，必须是 img/<文件名>，文件位于 web/img/。" },
        "alt": { "type": "string", "description": "kind=image 时的无障碍替代文本，描述图片内容。" },
        "credit": { "type": "string", "description": "kind=image 时的作者署名。" },
        "license": { "type": "string", "description": "kind=image 时的许可名称，如 CC BY-SA 4.0。" },
        "source": { "type": "string", "description": "kind=image 时的来源页 URL。" },
        "caption": { "type": "string", "description": "表格/时间线的标题。" },
        "rows": {
          "type": "array",
          "description": "kind=table/compare/timeline/settings 时的数据行。compare 为 2 行（双栏对比）；3 行以上自动按表格渲染。timeline 按年代升序；settings 为 {param, recommend, why, alt}。",
          "items": {
            "type": "object",
            "additionalProperties": true,
            "required": ["c1"],
            "properties": {
              "c1": { "type": "string" },
              "c2": { "type": "string" },
              "c3": { "type": "string" },
              "c4": { "type": "string" },
              "c5": { "type": "string" },
              "head": { "type": "array", "items": { "type": "string" } },
              "param": { "type": "string" },
              "recommend": { "type": "string" },
              "why": { "type": "string" },
              "alt": { "type": "string" }
            }
          }
        },
        "term": { "type": "string", "description": "kind=defs/glossary 时的术语。" },
        "items": {
          "type": "array",
          "description": "kind=steps/troubleshoot 时的步骤项；kind=settings 时为参数名列表。",
          "items": {
            "type": "object",
            "additionalProperties": true,
            "properties": {
              "t": { "type": "string", "description": "标题/症状/参数名。" },
              "d": { "type": "string", "description": "说明。" }
            }
          }
        }
      }
    },
    "ref": {
      "type": "object",
      "required": ["name", "url"],
      "additionalProperties": false,
      "properties": {
        "name": { "type": "string" },
        "url": { "type": "string", "description": "http(s) 链接；若为书籍填 ISBN/出版信息页。" },
        "kind": { "type": "string", "enum": ["manufacturer", "standard", "book", "manual", "forum", "video", "article", "archive", "measurement"] },
        "note": { "type": "string" }
      }
    }
  }
}