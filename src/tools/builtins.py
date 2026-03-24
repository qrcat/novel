"""内置工具实现 — 所有在 tool-calling 中使用的工具 handler"""
from typing import TYPE_CHECKING, Dict, List

if TYPE_CHECKING:
    from src.generator import NovelGenerator


# ── 工具参数 Schema（与 OpenAI function-calling 格式一致） ──────────────────

TOOL_DEFINITIONS = {
    "get_character_dialogue": {
        "description": "让角色进行发言，生成符合其性格的对话",
        "parameters": {
            "type": "object",
            "properties": {
                "character_name": {
                    "type": "string",
                    "description": "角色名字",
                },
                "prompt": {
                    "type": "string",
                    "description": "给角色的提示，引导他/她的回应（可选）",
                },
            },
            "required": ["character_name"],
        },
    },
    "set_scene": {
        "description": "设置新的场景描述",
        "parameters": {
            "type": "object",
            "properties": {
                "scene_description": {
                    "type": "string",
                    "description": "场景描述",
                },
            },
            "required": ["scene_description"],
        },
    },
    "add_plot_twist": {
        "description": "添加剧情转折，制造戏剧性冲突",
        "parameters": {
            "type": "object",
            "properties": {
                "description": {
                    "type": "string",
                    "description": "转折描述",
                },
            },
            "required": ["description"],
        },
    },
    "end_chapter": {
        "description": "结束当前章节，可以添加章节总结",
        "parameters": {
            "type": "object",
            "properties": {
                "chapter_summary": {
                    "type": "string",
                    "description": "章节总结（可选）",
                },
            },
            "required": [],
        },
    },
    "consult_plot_agent": {
        "description": "向大纲Agent咨询当前章节信息和大纲内容",
        "parameters": {
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "description": "咨询的问题",
                },
            },
            "required": ["question"],
        },
    },
}


# ── Handler 工厂 — 需要传入 generator 实例 ─────────────────────────────────


def make_handlers(gen: "NovelGenerator") -> Dict[str, callable]:
    """为给定 generator 创建所有 tool handler"""

    def get_character_dialogue(character_name: str, prompt: str = "") -> str:
        if character_name in gen.characters:
            response = gen.characters[character_name].respond(
                prompt or "请回应", gen.current_scene
            )
            gen.conversation_history.append({
                "type": "dialogue",
                "character": character_name,
                "content": response,
            })
            return response
        return f"错误：角色 {character_name} 不存在"

    def set_scene(scene_description: str) -> str:
        gen.current_scene = scene_description
        gen.conversation_history.append({
            "type": "scene_change",
            "content": f"场景：{scene_description}",
        })
        return f"场景已设置：{scene_description}"

    def add_plot_twist(description: str) -> str:
        gen.conversation_history.append({
            "type": "plot_twist",
            "content": f"剧情转折：{description}",
        })
        return f"已添加剧情转折：{description}"

    def end_chapter(chapter_summary: str = "") -> str:
        gen.conversation_history.append({
            "type": "chapter_end",
            "content": f"章节结束：{chapter_summary}" if chapter_summary else "章节结束",
        })
        gen.writer.advance_position()
        return f"章节已结束{': ' + chapter_summary if chapter_summary else ''}"

    def consult_plot_agent(question: str) -> str:
        if gen.outline and gen.writer.outline:
            chapters = gen.outline.get("chapters", [])
            pos = gen.writer.get_current_position()
            idx = pos["chapter"] - 1
            if idx < len(chapters):
                ch = chapters[idx]
                return (
                    f"当前章节：第{pos['chapter']}章「{ch.get('chapter_title', '未命名')}」\n"
                    f"场景设定：{ch.get('scene_setting', '未设定')}\n"
                    f"关键事件：{ch.get('key_events', [])}"
                )
        return "暂无大纲信息"

    return {
        "get_character_dialogue": get_character_dialogue,
        "set_scene": set_scene,
        "add_plot_twist": add_plot_twist,
        "end_chapter": end_chapter,
        "consult_plot_agent": consult_plot_agent,
    }


def register_builtin_tools(registry, gen: "NovelGenerator"):
    """将内置工具注册到给定注册表"""
    handlers = make_handlers(gen)
    for name, handler in handlers.items():
        registry.register(
            name=name,
            description=TOOL_DEFINITIONS[name]["description"],
            parameters=TOOL_DEFINITIONS[name]["parameters"],
            handler=handler,
        )
