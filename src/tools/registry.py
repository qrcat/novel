"""工具注册表"""
from typing import Callable, Dict, Any


class ToolRegistry:
    """工具注册表，负责工具的注册、查询和执行"""

    def __init__(self):
        self._tools: Dict[str, dict] = {}

    def register(
        self,
        name: str,
        description: str,
        parameters: dict,
        handler: Callable,
    ):
        self._tools[name] = {
            "description": description,
            "parameters": parameters,
            "handler": handler,
        }

    def get_openai_tools(self) -> list:
        return [
            {
                "type": "function",
                "function": {
                    "name": name,
                    "description": info["description"],
                    "parameters": info["parameters"],
                },
            }
            for name, info in self._tools.items()
        ]

    def execute(self, name: str, arguments: dict) -> str:
        if name not in self._tools:
            return f"未知的工具: {name}"
        try:
            return self._tools[name]["handler"](**arguments)
        except Exception as e:
            return f"工具执行错误: {e}"

    def list_tools(self) -> list:
        return list(self._tools.keys())
