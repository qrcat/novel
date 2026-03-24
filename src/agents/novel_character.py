"""NovelAgent — 小说角色（NPC）Agent"""
from src.agents.base import AgentBase


class NovelAgent(AgentBase):
    """小说角色 Agent，专注于角色扮演和对话生成"""

    SYSTEM_TEMPLATE = """你是小说中的一个角色，名字叫{name}。

角色性格：
{personality}

角色背景：
{background}

角色发展弧线：
{arc_block}

世界观设定：
{world_block}

重要规则：
1. 必须始终保持你角色的性格和语言风格
2. 回复要简短、生动，符合对话场景
3. 不要说明你是AI或角色扮演者
4. 直接以角色的身份回应
5. 使用第一人称"我"来表达
6. 回复长度控制在50-200字之间"""

    def __init__(self, name: str, personality: str, background: str, **kwargs):
        super().__init__(**kwargs)
        self.name = name
        self.personality = personality
        self.background = background
        # 大纲生成后会被 sync_from_outline() 填充
        self.arc: dict = {}
        self.world: dict = {}

    # ── 大纲同步 ────────────────────────────────────────────────

    def sync_from_outline(self, arc: dict, world: dict):
        """
        大纲生成后调用，用角色弧线和世界观信息更新自身上下文，
        保证对话生成与大纲一致。
        """
        self.arc = arc or {}
        self.world = world or {}

    def get_system_prompt(self) -> str:
        arc_block = self._format_arc()
        world_block = self._format_world()
        return self.SYSTEM_TEMPLATE.format(
            name=self.name,
            personality=self.personality,
            background=self.background,
            arc_block=arc_block,
            world_block=world_block,
        )

    def _format_arc(self) -> str:
        if not self.arc:
            return "（角色弧线待生成）"
        parts = []
        if self.arc.get("initial_state"):
            parts.append(f"初始状态：{self.arc['initial_state']}")
        if self.arc.get("final_state"):
            parts.append(f"最终状态：{self.arc['final_state']}")
        for i, ch in enumerate(self.arc.get("key_changes", []), 1):
            parts.append(f"关键转变{i}：{ch}")
        for i, cf in enumerate(self.arc.get("conflicts", []), 1):
            parts.append(f"主要冲突{i}：{cf}")
        return "\n".join(parts) if parts else "（暂无）"

    def _format_world(self) -> str:
        if not self.world:
            return "（世界观待生成）"
        parts = []
        if self.world.get("location"):
            parts.append(f"故事发生地：{self.world['location']}")
        if self.world.get("time_period"):
            parts.append(f"时间背景：{self.world['time_period']}")
        if self.world.get("atmosphere"):
            parts.append(f"整体氛围：{self.world['atmosphere']}")
        rules = self.world.get("rules_of_world", [])
        if rules:
            parts.append(f"世界规则：{'；'.join(rules)}")
        return "\n".join(parts) if parts else "（暂无）"

    def respond(self, prompt: str, context: str = "") -> str:
        """根据提示词生成角色的回应"""
        messages = [
            {"role": "system", "content": self.get_system_prompt()},
        ]
        if context:
            messages.append({"role": "system", "content": f"当前场景：{context}"})
        messages.append({"role": "user", "content": prompt})

        try:
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.8,
                max_tokens=500,
            )
            response = completion.choices[0].message.content.strip()
            return f"{self.name}：{response}"
        except Exception as e:
            return f"{self.name}：[生成失败 {e}]"

    def to_dict(self) -> dict:
        return {
            "type": "character",
            "name": self.name,
            "personality": self.personality,
            "background": self.background,
            "model": self.model,
            "arc": self.arc,
            "world": self.world,
        }
