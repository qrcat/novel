"""OutlineAgent — 大纲生成 Agent（自顶向下阶段版）"""
import json
from typing import Dict, List, Callable, Optional
from src.agents.base import AgentBase
from src.config import DEFAULT_MODEL


# ─────────────────────────────────────────────────────────────────
#  各阶段提示词 & 配置
# ─────────────────────────────────────────────────────────────────

PHASES = {

    # ── 阶段 0：主旨 ─────────────────────────────────────────────
    "theme": {
        "system": "你是小说创作顾问，负责提炼故事的核心。你的任务是根据基本信息，提炼小说的主题和创作意图。只输出 JSON。",
        "user_template": """小说标题：{title}
类型：{genre}
初始设定：{initial_prompt}

请提炼这本小说的核心主题，返回 JSON：
{{
  "theme": str,           // 核心主题（一句话，如"真相与谎言的边界"）
  "purpose": str,         // 创作意图（你想让读者思考什么，1-2句）
  "tone": str,            // 整体基调（如"压抑、悬疑、黑色幽默"）
  "target_audience": str  // 目标读者（简述）
}}""",
        "max_tokens": 800,
    },

    # ── 阶段 1：段落级剧情 ──────────────────────────────────────
    "plot_paragraph": {
        "system": "你是小说家，负责用一段完整的文字概括整本小说的故事线。只输出 JSON。",
        "user_template": """小说标题：{title}
类型：{genre}
核心主题：{theme}
基调：{tone}
初始设定：{initial_prompt}

请用一段连贯的文字（约200-400字）概述整本小说的剧情，要求：
- 涵盖起（开局）、承（发展）、转（高潮）、合（结局）
- 揭示主要冲突和核心悬念
- 不要列出章节，只是一段叙事性文字

返回 JSON：
{{
  "plot_paragraph": str    // 段落级剧情描述
}}""",
        "max_tokens": 1200,
    },

    # ── 阶段 2：一句话章节大纲 ─────────────────────────────────
    "chapter_outlines": {
        "system": "你是小说结构师。你的任务是把一段剧情拆分为有限个章节，每个章节只用一句话描述。只输出 JSON。",
        "user_template": """小说标题：{title}
类型：{genre}
核心主题：{theme}
段落剧情：
{plot_paragraph}

请将上述剧情拆分为 N 个章节（N 建议 8-16，保持节奏紧凑），每个章节用一句话描述，返回 JSON：
{{
  "total_chapters": int,
  "chapters": [
    {{"chapter_number": int, "one_sentence": str}}
  ]
}}""",
        "max_tokens": 1500,
    },

    # ── 阶段 3：章节扩写 ───────────────────────────────────────
    "chapter_expansion": {
        "system": "你是小说家。你的任务是将一个章节的一句话扩展为一个完整段落（约100-200字），包含场景、关键事件和转折。只输出 JSON。",
        "user_template": """小说标题：{title}
类型：{genre}
核心主题：{theme}
完整剧情（参考）：{plot_paragraph}

前一章：第{prev_num}章「{prev_title}」（{prev_one_sentence}）
当前章：第{chapter_num}章「{chapter_title}」（一句话：{one_sentence}）
下一章：第{next_num}章「{next_title}」（{next_one_sentence}）

请将当前章节的一句话扩展为一个完整段落，返回 JSON：
{{
  "chapter_number": int,
  "chapter_title": str,
  "one_sentence": str,
  "expanded_paragraph": str,    // 扩写段落（100-200字）
  "scene_setting": str,          // 场景环境（1句）
  "key_events": [str],          // 关键事件（2-3条）
  "characters_involved": [str], // 登场角色
  "plot_progression": str       // 本章如何推进主线（1句）
}}""",
        "max_tokens": 1200,
    },

    # ── 阶段 4：角色弧线 ───────────────────────────────────────
    "character_arcs": {
        "system": "你是角色塑造师。你的任务是根据故事主题和剧情，为所有角色设计发展弧线。只输出 JSON。",
        "user_template": """小说标题：{title}
类型：{genre}
核心主题：{theme}
段落剧情：{plot_paragraph}

角色列表：
{character_list}

请为每个角色设计发展弧线，返回 JSON：
{{
  "character_arcs": [
    {{
      "character_name": str,
      "personality": str,
      "background": str,
      "initial_state": str,      // 初始状态（1句）
      "final_state": str,        // 最终状态（1句）
      "key_changes": [str],      // 关键转变节点（2-3条）
      "conflicts": [str]         // 主要内心冲突（2-3条）
    }}
  ]
}}""",
        "max_tokens": 2000,
    },

    # ── 阶段 5：世界观 ─────────────────────────────────────────
    "world_building": {
        "system": "你是世界观架构师。你的任务是根据故事主题，设计一个与主题呼应的世界。只输出 JSON。",
        "user_template": """小说标题：{title}
类型：{genre}
核心主题：{theme}
段落剧情：{plot_paragraph}

请设计世界观，返回 JSON：
{{
  "time_period": str,           // 时间背景
  "location": str,              // 主要地点
  "social_context": str,       // 社会背景（1-2句）
  "rules_of_world": [str],     // 与主题相关的世界运行规则（3-5条）
  "key_locations": [
    {{"name": str, "description": str, "significance": str}}
  ],
  "atmosphere": str             // 整体氛围（1句）
}}""",
        "max_tokens": 1500,
    },

}


def _call(client, model: str, system: str, user: str, max_tokens: int) -> str:
    try:
        completion = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user",   "content": user},
            ],
            temperature=0.7,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
        )
        return completion.choices[0].message.content.strip()
    except Exception as e:
        raise RuntimeError(f"API 调用失败: {e}")


def _parse(raw: str, phase: str) -> dict:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        print(f"[OutlineAgent:{phase}] JSON 解析失败，预览: {raw[:200]}")
        return {}


# ─────────────────────────────────────────────────────────────────
#  OutlineAgent
# ─────────────────────────────────────────────────────────────────

class OutlineAgent(AgentBase):

    def __init__(self, model: str = DEFAULT_MODEL, **kwargs):
        super().__init__(model=model, **kwargs)

    # ── 主入口 ──────────────────────────────────────────────────

    def generate_outline(
        self,
        title: str,
        genre: str,
        initial_prompt: str,
        characters: Dict[str, "NovelAgent"],
        progress_callback: Optional[Callable] = None,
    ) -> Dict:
        """
        自顶向下生成大纲：
          0. 主旨 (theme)
          1. 段落级剧情 (plot_paragraph)
          2. 一句话章节大纲 (chapter_outlines)
          3. 每章扩写为段落 (chapter_expansion)
          4. 角色弧线 (character_arcs)
          5. 世界观 (world_building)
        """

        # ── 阶段 0：主旨 ──────────────────────────────────────
        phase = "theme"
        self._cb(progress_callback, phase, None)
        cfg = PHASES[phase]
        raw = _call(self.client, self.model,
                    cfg["system"],
                    cfg["user_template"].format(
                        title=title, genre=genre, initial_prompt=initial_prompt),
                    cfg["max_tokens"])
        theme_data = _parse(raw, phase)
        if not theme_data:
            theme_data = {"theme": "", "purpose": "", "tone": "未知"}
        print(f"[大纲] ✓ 阶段1/6：主旨 —「{theme_data.get('theme', '')}」")
        self._cb(progress_callback, phase, theme_data)

        # ── 阶段 1：段落级剧情 ────────────────────────────────
        phase = "plot_paragraph"
        self._cb(progress_callback, phase, None)
        cfg = PHASES[phase]
        raw = _call(self.client, self.model,
                    cfg["system"],
                    cfg["user_template"].format(
                        title=title, genre=genre,
                        theme=theme_data.get("theme", ""),
                        tone=theme_data.get("tone", ""),
                        initial_prompt=initial_prompt),
                    cfg["max_tokens"])
        plot_data = _parse(raw, phase)
        if not plot_data:
            plot_data = {"plot_paragraph": ""}
        print(f"[大纲] ✓ 阶段2/6：段落剧情")
        self._cb(progress_callback, phase, plot_data)

        # ── 阶段 2：一句话章节大纲 ─────────────────────────────
        phase = "chapter_outlines"
        self._cb(progress_callback, phase, None)
        cfg = PHASES[phase]
        raw = _call(self.client, self.model,
                    cfg["system"],
                    cfg["user_template"].format(
                        title=title, genre=genre,
                        theme=theme_data.get("theme", ""),
                        plot_paragraph=plot_data.get("plot_paragraph", "")),
                    cfg["max_tokens"])
        outline_data = _parse(raw, phase)
        if not outline_data:
            outline_data = {"total_chapters": 0, "chapters": []}
        print(f"[大纲] ✓ 阶段3/6：一句话章节大纲 ({outline_data.get('total_chapters', 0)} 章)")
        self._cb(progress_callback, phase, outline_data)

        # ── 阶段 3：逐章扩写 ──────────────────────────────────
        phase = "chapter_expansion"
        self._cb(progress_callback, phase, None)
        chapters = outline_data.get("chapters", [])
        expanded_chapters: List[dict] = []

        for i, ch in enumerate(chapters):
            prev = chapters[i - 1] if i > 0 else None
            nxt  = chapters[i + 1] if i < len(chapters) - 1 else None
            cfg = PHASES[phase]
            raw = _call(self.client, self.model,
                        cfg["system"],
                        cfg["user_template"].format(
                            title=title, genre=genre,
                            theme=theme_data.get("theme", ""),
                            plot_paragraph=plot_data.get("plot_paragraph", ""),
                            prev_num=prev["chapter_number"] if prev else 0,
                            prev_title=prev["one_sentence"] if prev else "无",
                            prev_one_sentence=prev["one_sentence"] if prev else "无",
                            chapter_num=ch["chapter_number"],
                            chapter_title=ch.get("chapter_title", ""),
                            one_sentence=ch.get("one_sentence", ""),
                            next_num=nxt["chapter_number"] if nxt else 0,
                            next_title=nxt["one_sentence"] if nxt else "无",
                            next_one_sentence=nxt["one_sentence"] if nxt else "无",
                        ),
                        cfg["max_tokens"])
            detail = _parse(raw, phase)
            if detail:
                expanded_chapters.append(detail)
            print(f"[大纲]   第{ch['chapter_number']}/{len(chapters)}章「{ch.get('chapter_title', '')}」✓")
            self._cb(progress_callback, phase,
                     {"index": i + 1, "total": len(chapters), "detail": detail})

        print(f"[大纲] ✓ 阶段4/6：章节扩写完成 ({len(expanded_chapters)} 章)")

        # ── 阶段 4：角色弧线 ──────────────────────────────────
        phase = "character_arcs"
        self._cb(progress_callback, phase, None)
        cfg = PHASES[phase]
        char_list = "\n".join(
            f"- {name}: 性格「{a.personality}」背景「{a.background}」"
            for name, a in characters.items()
        ) or "（暂无预设角色）"
        raw = _call(self.client, self.model,
                    cfg["system"],
                    cfg["user_template"].format(
                        title=title, genre=genre,
                        theme=theme_data.get("theme", ""),
                        plot_paragraph=plot_data.get("plot_paragraph", ""),
                        character_list=char_list),
                    cfg["max_tokens"])
        arcs_data = _parse(raw, phase)
        arcs = arcs_data.get("character_arcs", []) if arcs_data else []
        print(f"[大纲] ✓ 阶段5/6：角色弧线 ({len(arcs)} 条)")
        self._cb(progress_callback, phase, arcs)

        # ── 阶段 5：世界观 ──────────────────────────────────
        phase = "world_building"
        self._cb(progress_callback, phase, None)
        cfg = PHASES[phase]
        raw = _call(self.client, self.model,
                    cfg["system"],
                    cfg["user_template"].format(
                        title=title, genre=genre,
                        theme=theme_data.get("theme", ""),
                        plot_paragraph=plot_data.get("plot_paragraph", "")),
                    cfg["max_tokens"])
        world = _parse(raw, phase)
        if not world:
            world = {}
        print(f"[大纲] ✓ 阶段6/6：世界观设定")
        self._cb(progress_callback, phase, world)

        # ── 组装最终大纲 ──────────────────────────────────────
        outline = {
            "theme":            theme_data,
            "plot_paragraph":   plot_data.get("plot_paragraph", ""),
            "structure": {
                "total_chapters": len(expanded_chapters),
                "main_plot":     plot_data.get("plot_paragraph", ""),
                "climax":        "",
                "sub_plots":     [],
            },
            "character_arcs": arcs,
            "world_building":  world,
            "chapters":        expanded_chapters,
        }

        print(f"\n[大纲] ✓✓✓ 大纲生成完成！")
        return outline

    # ── 工具方法 ────────────────────────────────────────────────

    def query_chapter(self, chapter_number: int, outline: Dict) -> str:
        for ch in outline.get("chapters", []):
            if ch.get("chapter_number") == chapter_number:
                return (
                    f"章节标题：{ch.get('chapter_title')}\n"
                    f"一句话概述：{ch.get('one_sentence', '')}\n"
                    f"扩写段落：{ch.get('expanded_paragraph', '')}\n"
                    f"场景设定：{ch.get('scene_setting', '')}\n"
                    f"关键事件：{ch.get('key_events', [])}\n"
                    f"涉及角色：{ch.get('characters_involved', [])}"
                )
        return "未找到该章节信息"

    def query_outline(self, outline: Dict) -> str:
        theme = outline.get("theme", {})
        chapters = outline.get("chapters", [])
        return (
            f"主题：{theme.get('theme', '未设定')}\n"
            f"创作意图：{theme.get('purpose', '')}\n"
            f"剧情段落：{outline.get('plot_paragraph', '')[:200]}...\n"
            f"章节数：{len(chapters)}"
        )

    # ── 内部 ────────────────────────────────────────────────────

    @staticmethod
    def _cb(cb, phase, data):
        if cb:
            cb(phase, data)
