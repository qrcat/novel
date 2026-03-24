"""WriterAgent — 主写作 Agent，负责协调所有 Agent 并推进写作进度"""
from typing import Dict, TYPE_CHECKING

from src.agents.base import AgentBase
from src.config import DEFAULT_MODEL

if TYPE_CHECKING:
    from src.agents.novel_character import NovelAgent


class WriterAgent(AgentBase):
    """主写作者 Agent，通过工具调用协调角色、旁白和大纲"""

    SYSTEM_PROMPT_TEMPLATE = """你是小说的主写作者，负责推动整个故事的进程。

写作风格：{writing_style}

可用工具：
1. get_character_dialogue - 让角色发言
2. set_scene - 设置新场景
3. add_plot_twist - 添加剧情转折
4. end_chapter - 结束章节
5. consult_plot_agent - 咨询大纲Agent获取信息

主要职责：
1. 描述场景、环境、氛围（直接生成文本）
2. 推动剧情发展，制造冲突和转折
3. 通过工具调用让角色进行对话
4. 必须使用工具调用，不能直接生成角色对话
5. 根据大纲确定写作方向

重要规则：
1. 先描述场景（50-100字），然后调用工具
2. 旁白描述要简洁有力
3. 必须使用工具调用让角色发言，不能自己写角色对话
4. 保持剧情连贯性和逻辑性
5. 适当制造戏剧性冲突
6. 根据大纲推进故事

每轮你应该：
1. 生成一段场景描述
2. 调用get_character_dialogue让一个角色发言
3. 可选：调用set_scene切换场景
4. 可选：调用add_plot_twist添加转折
5. 可选：调用consult_plot_agent查询大纲"""

    def __init__(
        self,
        writing_style: str = "生动、细腻、富有画面感",
        model: str = DEFAULT_MODEL,
        **kwargs,
    ):
        super().__init__(model=model, **kwargs)
        self.writing_style = writing_style

        # 进度追踪
        self.current_chapter = 1
        self.current_scene_index = 0
        self.outline: Dict = {}

        # 角色字典（由 NovelGenerator 注入）
        self._characters: Dict[str, "NovelAgent"] = {}

    # ── 角色管理 ────────────────────────────────────────────────

    def set_characters(self, characters: Dict[str, "NovelAgent"]):
        self._characters = characters

    def update_dialogue_tool_description(self):
        """当角色列表变化时，更新 get_character_dialogue 的描述"""
        if "get_character_dialogue" in self._tools:
            char_list = ", ".join(self._characters.keys())
            self._tools["get_character_dialogue"]["description"] = (
                f"让角色进行发言，生成符合其性格的对话。可用角色：{char_list}"
            )

    # ── 大纲 & 进度 ─────────────────────────────────────────────

    def load_outline(self, outline: Dict):
        self.outline = outline

    def get_current_position(self) -> Dict:
        if not self.outline:
            return {"chapter": self.current_chapter, "scene": self.current_scene_index}
        chapters = self.outline.get("chapters", [])
        if self.current_chapter <= len(chapters):
            ch = chapters[self.current_chapter - 1]
            return {
                "chapter": self.current_chapter,
                "chapter_title": ch.get("chapter_title", ""),
                "scene": self.current_scene_index,
                "total_chapters": len(chapters),
            }
        return {"chapter": self.current_chapter, "scene": self.current_scene_index}

    def advance_position(self):
        """推进写作位置（章节/场景）"""
        self.current_scene_index += 1
        chapters = self.outline.get("chapters", [])
        scenes_per_chapter = 3  # 每章默认3个场景点
        if self.current_scene_index >= scenes_per_chapter:
            self.current_scene_index = 0
            if self.current_chapter < len(chapters):
                self.current_chapter += 1

    # ── 构建系统提示词 ─────────────────────────────────────────

    def build_system_prompt(self) -> str:
        return self.SYSTEM_PROMPT_TEMPLATE.format(writing_style=self.writing_style)

    # ── 配置序列化 ──────────────────────────────────────────────

    def to_dict(self) -> dict:
        return {
            "type": "writer",
            "writing_style": self.writing_style,
            "model": self.model,
        }
