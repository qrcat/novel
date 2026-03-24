"""NovelGenerator — 顶层编排器，协调所有 Agent"""
import json
import re
from pathlib import Path
from typing import Dict, List, Optional, TYPE_CHECKING

from src.agents import NovelAgent, NarratorAgent, OutlineAgent, WriterAgent
from src.tools import ToolRegistry, register_builtin_tools
from src.config import OUTPUT_DIR, AGENT_DIR, ensure_output_dirs
from src.debug import init_logger, get_logger

if TYPE_CHECKING:
    from src.agents.novel_character import NovelAgent


class NovelGenerator:
    """小说生成器，通过 WriterAgent 协调所有 Agent"""

    # ── 初始化 ───────────────────────────────────────────────────

    def __init__(
        self,
        title: str = "",
        genre: str = "",
        initial_prompt: str = "",
    ):
        self.title = title
        self.genre = genre
        self.initial_prompt = initial_prompt

        # Agent 实例
        self.writer = WriterAgent()
        self.narrator = NarratorAgent()
        self.outline_agent = OutlineAgent()

        # 角色字典
        self.characters: Dict[str, NovelAgent] = {}

        # 工具注册表
        self._tool_registry = ToolRegistry()
        register_builtin_tools(self._tool_registry, self)
        for name, info in self._tool_registry._tools.items():
            self.writer.register_tool(
                tool_name=name,
                description=info["description"],
                parameters=info["parameters"],
                handler=info["handler"],
            )

        # 数据状态
        self.conversation_history: List[Dict] = []
        self.current_scene = ""
        self.outline: Dict = {}

        ensure_output_dirs()
        self._logger = init_logger()

    # ── 工厂：从 output 目录还原现场 ──────────────────────────────

    @classmethod
    def from_output(
        cls,
        output_dir: Path = OUTPUT_DIR,
        agent_dir: Path = AGENT_DIR,
    ) -> "NovelGenerator":
        """从 output 目录读取文件，还原完整的生成器状态。"""
        output_dir = Path(output_dir)
        agent_dir = Path(agent_dir)

        gen = cls()
        gen._logger = init_logger()

        # 1. 读取大纲
        outline_path = output_dir / "outline.json"
        if outline_path.exists():
            with open(outline_path, encoding="utf-8") as f:
                gen.outline = json.load(f)
            gen.writer.load_outline(gen.outline)
            print(f"✓ 已加载大纲：{outline_path}")

        # 2. 读取 metadata + conversation_history
        novel_path = output_dir / "novel.txt"
        if novel_path.exists():
            meta, history, last_scene = cls._parse_novel_txt(novel_path)
            # 用文件中的 metadata 覆盖空字符串的默认值
            if meta.get("title"):
                gen.title = meta["title"]
            if meta.get("genre"):
                gen.genre = meta["genre"]
            if meta.get("initial_prompt"):
                gen.initial_prompt = meta["initial_prompt"]
            gen.conversation_history = history
            gen.current_scene = last_scene
            print(f"✓ 已加载正文历史：{len(history)} 条记录")
            print(f"  当前场景：{gen.current_scene[:50]}..." if gen.current_scene else "  当前场景：（空）")

            # 推进 writer 位置到最新章节
            if history:
                last_ch_end = None
                for i, item in enumerate(history):
                    if item["type"] == "chapter_end":
                        last_ch_end = i
                # 根据已有记录条数估算进度
                gen.writer.current_scene_index = len(history) % 3
                ch_count = len([h for h in history if h["type"] == "chapter_end"])
                if gen.outline and gen.outline.get("chapters"):
                    gen.writer.current_chapter = min(
                        ch_count + 1,
                        len(gen.outline["chapters"]),
                    )

        # 3. 读取角色 Agent 配置
        if agent_dir.exists():
            for cf in sorted(agent_dir.glob("agent_*.json")):
                with open(cf, encoding="utf-8") as f:
                    cfg = json.load(f)
                if cfg.get("type") == "character":
                    char = NovelAgent(
                        name=cfg["name"],
                        personality=cfg["personality"],
                        background=cfg["background"],
                        model=cfg.get("model", "qwen-plus"),
                    )
                    gen.characters[cfg["name"]] = char
                    print(f"✓ 已加载角色：{cfg['name']}")

            gen.writer.set_characters(gen.characters)
            gen.writer.update_dialogue_tool_description()

        # 4. 读取 writer / narrator 配置（覆盖默认值）
        writer_cfg_path = agent_dir / "writer.json"
        if writer_cfg_path.exists():
            with open(writer_cfg_path, encoding="utf-8") as f:
                cfg = json.load(f)
            gen.writer.writing_style = cfg.get("writing_style", gen.writer.writing_style)
            print(f"✓ 已加载 Writer 配置")

        narrator_cfg_path = agent_dir / "narrator.json"
        if narrator_cfg_path.exists():
            with open(narrator_cfg_path, encoding="utf-8") as f:
                cfg = json.load(f)
            gen.narrator.writing_style = cfg.get("writing_style", gen.narrator.writing_style)
            print(f"✓ 已加载 Narrator 配置")

        return gen

    # ── 正文解析 ─────────────────────────────────────────────────

    _RE_DIALOGUE = re.compile(r"^([^\[\]=].*?)：(.*)", re.DOTALL)
    _RE_SCENE    = re.compile(r"^\[场景[：:](.*)\]$")
    _RE_TWIST    = re.compile(r"^\[剧情转折[：:](.*)\]$")
    _RE_CH_END   = re.compile(r"^\[章节结束[：:](.*)\]$")
    _RE_META     = re.compile(r"^(title|类型|类型：|初始设定|## 角色介绍|## 小说大纲)\s*[:：]\s*(.*)", re.IGNORECASE)

    @classmethod
    def _parse_novel_txt(cls, path: Path) -> tuple:
        """解析 novel.txt，返回 (metadata_dict, conversation_history, last_scene)"""
        text = path.read_text(encoding="utf-8")
        metadata: Dict[str, str] = {}
        history: List[Dict] = []
        last_scene = ""

        # 状态机
        section = "meta"   # meta | characters | outline | body
        current_char: Optional[str] = None

        for raw_line in text.splitlines():
            line = raw_line.strip()
            if not line:
                continue

            # 切换 section：遇到 ===== 分隔线
            if re.match(r"={10,}", line):
                if section == "meta" and metadata:
                    pass   # 还没进入正文，保持原状态
                else:
                    section = "body"
                continue

            # meta 区：解析键值对
            if section == "meta":
                m = cls._RE_META.match(line)
                if m:
                    key = m.group(1).lower().replace("类型", "genre").replace("初始设定", "initial_prompt").replace("## 角色介绍", "").replace("## 小说大纲", "")
                    val = m.group(2).strip()
                    if key == "title":
                        metadata["title"] = val
                    elif key in ("genre", "类型"):
                        metadata["genre"] = val
                    elif key in ("initial_prompt",):
                        metadata["initial_prompt"] = val
                elif line.startswith("## 角色介绍"):
                    section = "characters"
                elif line.startswith("## 小说大纲"):
                    section = "outline"

            elif section == "characters":
                if line.startswith("### "):
                    current_char = line[4:].strip()

            elif section == "body":
                # 对话行：角色名：内容
                dm = cls._RE_DIALOGUE.match(line)
                if dm:
                    character = dm.group(1).strip()
                    content = dm.group(2).strip()
                    # 取最新一条作 last_scene（场景切换）
                    if character == "场景描述" or character == "旁白":
                        last_scene = content
                    history.append({"type": "dialogue", "character": character, "content": line})
                    continue

                # 场景切换
                sm = cls._RE_SCENE.match(line)
                if sm:
                    last_scene = sm.group(1).strip()
                    history.append({"type": "scene_change", "content": f"场景：{last_scene}"})
                    continue

                # 剧情转折
                tm = cls._RE_TWIST.match(line)
                if tm:
                    history.append({"type": "plot_twist", "content": f"剧情转折：{tm.group(1).strip()}"})
                    continue

                # 章节结束
                cm = cls._RE_CH_END.match(line)
                if cm:
                    summary = cm.group(1).strip() if cm.group(1) else ""
                    history.append({"type": "chapter_end", "content": f"章节结束：{summary}"})
                    continue

        return metadata, history, last_scene

    # ── 角色管理 ────────────────────────────────────────────────

    def add_character(self, name: str, personality: str, background: str):
        character = NovelAgent(name=name, personality=personality, background=background)
        self.characters[name] = character
        self.writer.set_characters(self.characters)
        self.writer.update_dialogue_tool_description()
        print(f"✓ 已添加角色：{name}")

    def _sync_characters_from_outline(
        self,
        arcs_map: Dict,
        world: dict,
    ) -> List[str]:
        """
        根据大纲的角色弧线列表，自动创建缺失的 NovelAgent，
        并同步弧线与世界观的上下文。
        返回新创建的角色名列表。
        """
        created = []
        for arc in arcs_map.values():
            name = arc.get("character_name", "")
            if not name or name in self.characters:
                continue

            # 从弧线中提取角色描述
            personality = arc.get("personality", "性格待定")
            background = arc.get("background", "背景待定")
            if not arc.get("personality") and not arc.get("background"):
                # fallback：用初始/最终状态拼一个基本描述
                initial = arc.get("initial_state", "")
                final   = arc.get("final_state", "")
                personality = f"{initial} → {final}" if initial or final else "性格待定"

            char = NovelAgent(
                name=name,
                personality=personality,
                background=background,
            )
            char.sync_from_outline(arc=arc, world=world)
            self.characters[name] = char
            created.append(name)

        # 更新 writer 角色列表和工具描述
        if created:
            self.writer.set_characters(self.characters)
            self.writer.update_dialogue_tool_description()

        return created

    # ── 大纲 ────────────────────────────────────────────────────

    def generate_outline(self) -> Dict:
        print(f"\n{'='*60}")
        print(f"开始生成《{self.title}》大纲...")
        print(f"{'='*60}\n")

        def on_phase(phase: str, result):
            log = self._logger
            log.set_phase(f"outline_{phase}")
            log.log_outline_phase(phase, "done", result)

        self.outline = self.outline_agent.generate_outline(
            self.title,
            self.genre,
            self.initial_prompt,
            self.characters,
            progress_callback=on_phase,
        )
        self.writer.load_outline(self.outline)
        self.writer.set_characters(self.characters)

        # ── 同步大纲到所有角色 Agent ──────────────────────────
        arcs_map = {a.get("character_name"): a for a in self.outline.get("character_arcs", [])}
        world = self.outline.get("world_building", {})

        # 根据大纲自动创建/更新角色
        created = self._sync_characters_from_outline(arcs_map, world)
        for name in created:
            print(f"  ✓「{name}」已创建并同步")

        # 对已有角色（手工添加的）也同步世界观
        for name, agent in self.characters.items():
            if name not in created:
                agent.sync_from_outline(arc={}, world=world)
                print(f"  ✓「{name}」（手工）已同步世界观")

        return self.outline

    def display_outline(self):
        if not self.outline:
            print("还没有生成大纲！")
            return

        print(f"\n{'='*60}")
        print(f"《{self.title}》小说大纲")
        print(f"{'='*60}\n")

        # 主旨
        theme = self.outline.get("theme", {})
        if theme:
            print("【核心主旨】")
            print(f"  主题：{theme.get('theme', '未设定')}")
            print(f"  意图：{theme.get('purpose', '')}")
            print(f"  基调：{theme.get('tone', '')}\n")

        # 段落剧情
        plot_para = self.outline.get("plot_paragraph", "")
        if plot_para:
            print("【段落剧情】")
            print(f"  {plot_para[:300]}...\n")

        # 整体结构
        structure = self.outline.get("structure", {})
        print("【章节列表】")
        chapters = self.outline.get("chapters", [])
        print(f"  总章节数：{structure.get('total_chapters', len(chapters))}章")
        for ch in chapters:
            one_sen = ch.get("one_sentence", "")
            one_sen_short = (one_sen[:40] + "…") if len(one_sen) > 40 else one_sen
            print(f"  第{ch.get('chapter_number', '?')}章「{ch.get('chapter_title', '未命名')}」— {one_sen_short}")

        # 扩写段落（每章一行）
        if chapters and any(ch.get("expanded_paragraph") for ch in chapters):
            print("\n【章节扩写】")
            for ch in chapters:
                para = ch.get("expanded_paragraph", "")
                short = (para[:60] + "…") if len(para) > 60 else para
                print(f"  第{ch.get('chapter_number')}章：{short}")

        # 世界观
        world = self.outline.get("world_building", {})
        if world:
            print(f"\n【世界观】")
            print(f"  时间：{world.get('time_period', '未设定')}")
            print(f"  地点：{world.get('location', '未设定')}")
            print(f"  氛围：{world.get('atmosphere', '')}")
            if world.get("rules_of_world"):
                for rule in world["rules_of_world"]:
                    print(f"  规则：{rule}")

        # 角色弧线
        arcs = self.outline.get("character_arcs", [])
        if arcs:
            print(f"\n【角色弧线】")
            for arc in arcs:
                print(f"  {arc.get('character_name', '')}：{arc.get('initial_state', '')} → {arc.get('final_state', '')}")

        print(f"\n{'='*60}\n")

    # ── 写作轮次 ────────────────────────────────────────────────

    def _build_context(self) -> str:
        pos = self.writer.get_current_position()

        context = f"""小说标题：{self.title}
类型：{self.genre}
当前场景：{self.current_scene}

当前写作进度：
- 第 {pos['chapter']} 章
- 场景进度：{pos['scene']}

初始设定：{self.initial_prompt}

最近的对话/事件：
{self._format_recent_history()}"""

        if self.outline:
            chapters = self.outline.get("chapters", [])
            if pos["chapter"] <= len(chapters):
                ch = chapters[pos["chapter"] - 1]
                context += f"""
当前章节信息：
- 标题：{ch.get('chapter_title', '未命名')}
- 场景设定：{ch.get('scene_setting', '未设定')}
- 关键事件：{ch.get('key_events', [])}
- 涉及角色：{ch.get('characters_involved', [])}"""

        return context

    def _format_recent_history(self) -> str:
        if not self.conversation_history:
            return "暂无"
        parts = []
        for item in self.conversation_history[-5:]:
            if item["type"] in ("dialogue", "dialogue_raw"):
                parts.append(item["content"])
            elif item["type"] in ("scene_change", "plot_twist", "chapter_end"):
                parts.append(f"[{item['content']}]")
        return "\n".join(parts) if parts else "暂无"

    def generate_round(self, max_loops: int = 20) -> str:
        """
        生成一段正文（多轮对话循环，自适应截断）。

        工作流程：
        1. Writer 生成 narration + tool_calls
        2. 若有 tool_calls：执行并把原始角色台词加入消息历史
        3. 把消息历史发回给 Writer，要求它改写整合
        4. 重复直到 Writer 输出不含 tool_calls 的最终正文

        自适应截断：当消息总 token 接近阈值时，
        保留 system + 最近 N 条，丢弃更早的中间消息。
        """
        # Token 阈值：qwen-plus context≈32k，保留 70% 给上下文
        MAX_TOKENS = 22_000
        # 角色台词摘要的 user 引导（较短）
        REWRITE_HINT = (
            "上方是工具执行结果（含角色台词）。"
            "请将台词改写整合进叙述，输出最终正文。禁止调用工具。"
        )

        system_prompt = self.writer.build_system_prompt()
        context = self._build_context()

        messages: List[dict] = [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": context},
        ]

        loop = 0
        total_tokens_est = 0
        log = self._logger

        # ── 轮次开始 ─────────────────────────────────────────
        pos = self.writer.get_current_position()
        log.log_round_start(round_num=0, chapter=pos["chapter"], scene=pos["scene"])

        while loop < max_loops:
            loop += 1

            # ── 自适应截断 ────────────────────────────────────
            total_tokens_est = self._count_tokens(messages)
            if total_tokens_est > MAX_TOKENS and len(messages) > 6:
                messages = self._truncate_messages(messages)
                print(f"  ⚡ 截断消息历史（≈{total_tokens_est} tokens），保留最近上下文")

            result = self.writer.generate_with_tools_raw(
                messages=messages,
                max_tokens=800,
            )

            narration = result.get("content", "") or ""
            tool_calls = result.get("tool_calls")

            # ── 没有 tool_calls：输出最终正文 ────────────────────
            if not tool_calls:
                final = narration.strip()
                output = f"\n{'='*60}\n{final}\n{'='*60}\n"
                self._append_to_text_file(output)
                log.log_round_end(0, final, loop, total_tokens_est)
                return output

            # ── 有 tool_calls：执行并加入消息历史 ────────────────
            print(f"  → 第{loop}轮 tool_calls:")
            messages.append({
                "role": "assistant",
                "content": narration.strip() or None,
                "tool_calls": [
                    {"id": tc.id, "type": "function",
                     "function": {"name": tc.function.name,
                                  "arguments": tc.function.arguments}}
                    for tc in tool_calls
                ],
            })

            for tc in tool_calls:
                tool_name = tc.function.name
                args = json.loads(tc.function.arguments)
                print(f"     [{tool_name}] {args}")

                error_msg = None
                tool_result = None
                try:
                    tool_result = self.writer.execute_tool(tool_name, args)
                except Exception as e:
                    error_msg = str(e)
                    tool_result = f"[工具执行错误: {e}]"

                log.log_tool_call(tool_name, args, tool_result, error=error_msg)

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": tool_result,
                })
                if tool_name == "get_character_dialogue":
                    self.conversation_history.append({
                        "type": "dialogue_raw",
                        "character": args.get("character_name", ""),
                        "content": tool_result,
                    })
                    print(f"     → 台词（待改写）: {tool_result[:60]}")
                else:
                    print(f"     → {tool_result}")

            messages.append({"role": "user", "content": REWRITE_HINT})

        # 达到 max_loops 仍无结果
        log.log_round_end(0, narration.strip(), loop, total_tokens_est)
        return f"\n{'='*60}\n{narration.strip()}\n{'='*60}\n"

    # ── Token 估计 & 截断 ──────────────────────────────────────

    @staticmethod
    def _count_tokens(messages: List[dict]) -> int:
        """粗略估算消息列表的 token 数（中文≈字/2，英文≈词×1.3）。"""
        import re
        total = 0
        for msg in messages:
            text = json.dumps(msg, ensure_ascii=False)
            # 中文字符
            chinese = len(re.findall(r"[\u4e00-\u9fff]", text))
            # 英文/数字词
            english = len(re.findall(r"[a-zA-Z0-9]+", text))
            # 其余（符号、空白）
            total += chinese // 2 + english * 1.3 + len(text) * 0.1
        return int(total)

    def _truncate_messages(self, messages: List[dict]) -> List[dict]:
        """
        截断：保留 system + 最近4条（足够保留场景上下文），
        在末尾补一句摘要 user 消息衔接。
        """
        system = messages[0]          # system 必留
        rest   = messages[2:]         # 去掉 system + 最早的 user

        # 摘要中间内容（保留场景和最近2轮）
        recent = rest[-4:]            # 最近4条
        summary_parts = []
        for m in rest[:-4]:
            if m["role"] == "tool" and len(m.get("content", "")) > 10:
                summary_parts.append(m["content"][:80])

        summary_text = (
            f"【前情摘要】{'；'.join(summary_parts[-6:]) if summary_parts else '（无'}）"
            if summary_parts else ""
        )

        kept = [system]
        if summary_text:
            kept.append({"role": "user", "content": summary_text})
        kept.extend(recent)
        return kept

    # ── 文件 I/O ────────────────────────────────────────────────

    def _write_header(self, f):
        f.write(f"# {self.title}\n")
        f.write(f"类型：{self.genre}\n\n")
        f.write(f"## 初始设定\n{self.initial_prompt}\n\n")
        f.write("## 角色介绍\n\n")
        for name, agent in self.characters.items():
            f.write(f"### {name}\n性格：{agent.personality}\n背景：{agent.background}\n\n")

        if self.outline:
            s = self.outline.get("structure", {})
            f.write(f"## 小说大纲\n\n总章节数：{s.get('total_chapters','未设定')}章\n")
            f.write(f"主线：{s.get('main_plot','未设定')}\n高潮：{s.get('climax','未设定')}\n\n")
            world = self.outline.get("world_building", {})
            if world:
                f.write(f"世界观：{world.get('location','未设定')}\n")
            f.write("章节规划：\n")
            for ch in self.outline.get("chapters", []):
                f.write(f"第{ch.get('chapter_number')}章：{ch.get('chapter_title')}\n")
            f.write(f"\n{'='*60}\n\n")

    def _append_to_text_file(self, content: str):
        novel_path = OUTPUT_DIR / "novel.txt"
        write_header = not novel_path.exists()
        with open(novel_path, "a", encoding="utf-8") as f:
            if write_header:
                self._write_header(f)
            f.write(content)

    def save_outline(self, filename: str = None):
        if not self.outline:
            print("还没有生成大纲！")
            return
        path = OUTPUT_DIR / (filename or "outline.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.outline, f, ensure_ascii=False, indent=2)
        print(f"✓ 大纲已保存到 {path}")

    def save_agent_configs(self):
        with open(AGENT_DIR / "writer.json", "w", encoding="utf-8") as f:
            json.dump(self.writer.to_dict(), f, ensure_ascii=False, indent=2)
        with open(AGENT_DIR / "narrator.json", "w", encoding="utf-8") as f:
            json.dump(self.narrator.to_dict(), f, ensure_ascii=False, indent=2)
        for i, (name, agent) in enumerate(self.characters.items(), 1):
            with open(AGENT_DIR / f"agent_{i}_{name}.json", "w", encoding="utf-8") as f:
                json.dump(agent.to_dict(), f, ensure_ascii=False, indent=2)
        print(f"✓ Agent 配置已保存到 {AGENT_DIR}")

    def save_as_text(self, filename: str = None, overwrite: bool = False):
        path = OUTPUT_DIR / (filename or "novel.txt")
        if not overwrite and path.exists():
            print(f"{path} 已存在，使用 overwrite=True 覆盖。")
            return
        with open(path, "w", encoding="utf-8") as f:
            self._write_header(f)
            for item in self.conversation_history:
                f.write(f"{item['content']}\n\n")
        print(f"✓ 小说已保存到 {path}")
