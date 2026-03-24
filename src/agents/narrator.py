"""NarratorAgent — 旁白 Agent（通过工具调用与其他 Agent 通信）"""
from src.agents.base import AgentBase
from src.config import DEFAULT_MODEL


class NarratorAgent(AgentBase):
    """旁白 Agent，用于场景描述和叙事"""

    DEFAULT_STYLE = "生动、细腻、富有画面感"

    def __init__(
        self,
        writing_style: str = DEFAULT_STYLE,
        model: str = DEFAULT_MODEL,
        **kwargs,
    ):
        super().__init__(model=model, **kwargs)
        self.writing_style = writing_style

    # ── 场景/叙事生成 ────────────────────────────────────────────

    def describe_scene(self, scene: str, emphasis: str = "") -> str:
        """生成场景描写"""
        prompt = f"""描述以下场景，要求{self.writing_style}：
{scene}
{f"重点突出：{emphasis}" if emphasis else ""}"""
        return self.generate(
            system_prompt="你是小说旁白，负责场景描写。语言要生动、形象、有画面感。",
            user_content=prompt,
            max_tokens=300,
        )

    def narrate_action(self, action: str) -> str:
        """描述角色动作"""
        prompt = f"用简洁有力的语言描述以下动作：{action}"
        return self.generate(
            system_prompt="你是小说旁白。描述动作时要简洁、有力、富有动感。",
            user_content=prompt,
            max_tokens=150,
        )

    # ── 配置序列化 ──────────────────────────────────────────────

    def to_dict(self) -> dict:
        return {
            "type": "narrator",
            "writing_style": self.writing_style,
            "model": self.model,
        }
