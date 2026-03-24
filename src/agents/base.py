"""Agent 基类 — 公共工具注册 & tool-call 封装"""
import time
from typing import Callable, Dict, List, Optional
from src.client import get_client
from src.config import DEFAULT_MODEL, DEFAULT_TEMPERATURE
from src.debug import get_logger


class AgentBase:
    """所有 Agent 的公共基类"""

    def __init__(self, model: str = DEFAULT_MODEL, temperature: float = DEFAULT_TEMPERATURE):
        self.model = model
        self.temperature = temperature
        self.client = get_client()
        self._tools: Dict[str, dict] = {}   # name -> {description, parameters, handler}

    # ── 工具注册 ────────────────────────────────────────────────

    def register_tool(
        self,
        tool_name: str,
        description: str,
        parameters: dict,
        handler: Callable,
    ):
        self._tools[tool_name] = {
            "description": description,
            "parameters": parameters,
            "handler": handler,
        }

    def get_openai_tools(self) -> List[dict]:
        """OpenAI tool-calling 格式定义"""
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

    def execute_tool(self, tool_name: str, arguments: dict) -> str:
        """执行已注册的 tool"""
        if tool_name not in self._tools:
            return f"未知的工具: {tool_name}"
        try:
            return self._tools[tool_name]["handler"](**arguments)
        except Exception as e:
            return f"工具执行错误: {e}"

    # ── 生成 ────────────────────────────────────────────────────

    def generate_with_tools(
        self,
        system_prompt: str,
        user_content: str,
        max_tokens: int = 1000,
    ) -> dict:
        """调用 LLM，支持 tool-calling；返回 {"content": ..., "tool_calls": ...}"""
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]
        return self.generate_with_tools_raw(messages, max_tokens)

    def generate_with_tools_raw(self, messages: List[dict], max_tokens: int = 1000,
                                 response_format: Optional[dict] = None) -> dict:
        """直接传入消息列表，支持多轮对话循环（tool-calling 模式）。"""
        log = get_logger()
        t0 = time.time()

        # ── 记录请求 ─────────────────────────────────────────
        req_entry = log.log_request(
            model=self.model,
            system_prompt="",           # system 在 messages[0]
            messages=messages,
            tools=self.get_openai_tools(),
            temperature=self.temperature,
            max_tokens=max_tokens,
            response_format=response_format,
        )

        # ── 调用 API ─────────────────────────────────────────
        error_msg = None
        response = None
        try:
            extra = {}
            if response_format:
                extra["response_format"] = response_format
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=self.get_openai_tools() or None,
                temperature=self.temperature,
                max_tokens=max_tokens,
                **extra,
            )
            response = completion
        except Exception as e:
            error_msg = str(e)
            log.log_error("llm_api", error_msg,
                          context={"model": self.model})

        duration_ms = (time.time() - t0) * 1000

        # ── 记录响应 ─────────────────────────────────────────
        log.log_response(req_entry, response, duration_ms, error=error_msg)

        if error_msg:
            return {"content": f"[生成失败: {error_msg}]", "tool_calls": None}

        msg = completion.choices[0].message
        return {"content": msg.content, "tool_calls": msg.tool_calls}

    def generate(self, system_prompt: str, user_content: str, max_tokens: int = 500) -> str:
        """纯文本生成（无 tool-calling）"""
        log = get_logger()
        t0 = time.time()
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]
        req_entry = log.log_request(
            model=self.model,
            system_prompt=system_prompt,
            messages=messages,
            tools=None,
            temperature=self.temperature,
            max_tokens=max_tokens,
        )
        error_msg = None
        try:
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=max_tokens,
            )
            response = completion
        except Exception as e:
            error_msg = str(e)
            log.log_error("llm_api", error_msg)
            response = None

        log.log_response(req_entry, response, (time.time() - t0) * 1000, error=error_msg)

        if error_msg:
            return f"[生成失败: {error_msg}]"
        return completion.choices[0].message.content.strip()
