"""
Debug Logger — 完整记录 LLM 请求、Prompt、Tool Use 等所有关键数据
"""
import json
import time
import traceback
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from src.config import OUTPUT_DIR

# ─────────────────────────────────────────────────────────────────
#  日志根目录
# ─────────────────────────────────────────────────────────────────

LOG_DIR = OUTPUT_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

# ─────────────────────────────────────────────────────────────────
#  序列化工具
# ─────────────────────────────────────────────────────────────────

def _serialize(obj: Any) -> Any:
    """尽量把不可序列化的对象转成可打印字符串"""
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_serialize(x) for x in obj]
    if isinstance(obj, (str, int, float, bool, type(None))):
        return obj
    # openai 类型
    try:
        return str(obj)
    except Exception:
        return f"<{type(obj).__name__}>"


def _safe_json(obj: Any, indent: int = 2) -> str:
    return json.dumps(_serialize(obj), ensure_ascii=False, indent=indent)


# ─────────────────────────────────────────────────────────────────
#  DebugLogger
# ─────────────────────────────────────────────────────────────────

class DebugLogger:
    """
    统一日志记录器，写入 output/logs/ 下的多个文件。

    输出文件：
      logs/
      ├── run_<yyyyMMdd_HHMMSS>.json          ← 本次运行所有条目（JSONL）
      ├── llm_requests.jsonl                  ← 所有 LLM 请求
      ├── tool_calls.jsonl                    ← 所有工具调用
      └── errors.jsonl                        ← 所有错误
    """

    def __init__(self, run_id: Optional[str] = None):
        if run_id is None:
            run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.run_id = run_id

        self.run_log  = LOG_DIR / f"run_{run_id}.jsonl"
        self.req_log = LOG_DIR / "llm_requests.jsonl"
        self.tool_log = LOG_DIR / "tool_calls.jsonl"
        self.err_log  = LOG_DIR / "errors.jsonl"

        # 内存中的 session 上下文（方便跨函数附加字段）
        self._ctx: dict = {"run_id": run_id, "phase": "init"}

        self._seq = 0  # 条目序号

    # ── 内部 ────────────────────────────────────────────────────

    def _stamp(self) -> dict:
        self._seq += 1
        return {
            "seq":      self._seq,
            "ts":       datetime.now().isoformat(),
            "run_id":   self.run_id,
            "phase":    self._ctx.get("phase", ""),
        }

    def _write(self, log_file: Path, entry: dict):
        try:
            log_file.parent.mkdir(parents=True, exist_ok=True)
            with open(log_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        except Exception:
            pass   # 静默失败，不影响主流程

    def _log(self, kind: str, **fields):
        entry = {**self._stamp(), "kind": kind, **fields}
        self._write(self.run_log, entry)
        return entry

    # ── 上下文设置 ─────────────────────────────────────────────

    def set_phase(self, phase: str):
        """设置当前阶段（init / outline / writing 等），方便过滤"""
        self._ctx["phase"] = phase

    def set_ctx(self, **kwargs):
        self._ctx.update(kwargs)

    # ── LLM 请求 ───────────────────────────────────────────────

    def log_request(
        self,
        model: str,
        system_prompt: str,
        messages: list,
        tools: Optional[list] = None,
        temperature: float = 0.8,
        max_tokens: int = 1000,
        response_format: Optional[dict] = None,
        **extra,
    ):
        """记录每次 LLM API 请求（request）"""
        entry = self._log(
            "llm_request",
            model=model,
            system_prompt=system_prompt,
            messages=_serialize(messages),
            tools=_serialize(tools) if tools else None,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format=response_format,
            **extra,
        )
        self._write(self.req_log, entry)

    def log_response(
        self,
        request_entry: dict,
        response: Any,
        duration_ms: float,
        error: Optional[str] = None,
    ):
        """记录每次 LLM API 响应（直接提取 API 返回的 usage）"""
        raw_text = None
        finish_reason = None
        usage = None
        model = None
        req_seq = request_entry.get("seq") if request_entry else None

        try:
            raw_text        = response.choices[0].message.content
            finish_reason   = response.choices[0].finish_reason
            # 直接取 API 原生 usage（包含 prompt_tokens / completion_tokens / total_tokens）
            usage_raw = getattr(response, "usage", None)
            if usage_raw:
                usage = {
                    "prompt_tokens":     getattr(usage_raw, "prompt_tokens",     None),
                    "completion_tokens":  getattr(usage_raw, "completion_tokens",  None),
                    "total_tokens":       getattr(usage_raw, "total_tokens",       None),
                }
            model = getattr(response, "model", None)
        except Exception:
            pass

        entry = self._log(
            "llm_response",
            request_seq=req_seq,
            duration_ms=round(duration_ms, 2),
            error=error,
            finish_reason=finish_reason,
            raw_text=raw_text,
            usage=usage,
            model=model,
        )
        self._write(self.req_log, entry)

        if error:
            self.log_error(
                source="llm_response",
                message=error,
                context={"request_seq": req_seq},
            )

    # ── 工具调用 ───────────────────────────────────────────────

    def log_tool_call(
        self,
        tool_name: str,
        arguments: dict,
        result: Any,
        error: Optional[str] = None,
        phase: str = "",
    ):
        """记录单次工具调用"""
        entry = self._log(
            "tool_call",
            tool_name=tool_name,
            arguments=_serialize(arguments),
            result=_serialize(result) if not error else None,
            error=error,
            phase=phase or self._ctx.get("phase", ""),
        )
        self._write(self.tool_log, entry)

        if error:
            self.log_error(
                source="tool_call",
                message=error,
                context={"tool_name": tool_name, "arguments": arguments},
            )

    # ── 写作轮次 ──────────────────────────────────────────────

    def log_round_start(self, round_num: int, chapter: int, scene: int):
        entry = self._log(
            "round_start",
            round_num=round_num,
            chapter=chapter,
            scene=scene,
        )
        return entry

    def log_round_end(
        self,
        round_num: int,
        final_text: str,
        loops: int,
        total_tokens_estimate: int,
    ):
        entry = self._log(
            "round_end",
            round_num=round_num,
            final_text_preview=final_text[:200] if final_text else "",
            loops=loops,
            total_tokens_estimate=total_tokens_estimate,
        )
        self._write(self.run_log, entry)
        return entry

    # ── 大纲阶段 ───────────────────────────────────────────────

    def log_outline_phase(self, phase: str, status: str, result: Any = None,
                          error: str = None):
        entry = self._log(
            "outline_phase",
            outline_phase=phase,
            status=status,
            result_summary=_serialize(result) if result else None,
            error=error,
        )
        return entry

    # ── 错误 ───────────────────────────────────────────────────

    def log_error(
        self,
        source: str,
        message: str,
        context: Optional[dict] = None,
        exc: Optional[Exception] = None,
    ):
        tb = None
        if exc:
            tb = traceback.format_exception(type(exc), exc, exc.__traceback__)

        entry = self._log(
            "error",
            source=source,
            message=message,
            context=_serialize(context) if context else None,
            traceback=tb,
        )
        self._write(self.err_log, entry)
        return entry

    # ── 摘要报告 ───────────────────────────────────────────────

    def summary(self) -> dict:
        """返回本次运行的统计摘要"""
        counters = {"llm_request": 0, "llm_response": 0,
                    "tool_call": 0, "error": 0}
        for log_file in [self.run_log]:
            try:
                with open(log_file, encoding="utf-8") as f:
                    for line in f:
                        try:
                            obj = json.loads(line)
                            counters[obj.get("kind", "")] = counters.get(obj.get("kind", ""), 0) + 1
                        except Exception:
                            pass
            except FileNotFoundError:
                pass

        return {
            "run_id":        self.run_id,
            "log_file":      str(self.run_log),
            "total_entries": self._seq,
            **counters,
        }

    def print_summary(self):
        s = self.summary()
        print("\n" + "=" * 60)
        print(f"Debug Summary — run_id: {s['run_id']}")
        print(f"  LLM 请求：  {s.get('llm_request', 0)}")
        print(f"  LLM 响应：  {s.get('llm_response', 0)}")
        print(f"  工具调用：  {s.get('tool_call', 0)}")
        print(f"  错误：      {s.get('error', 0)}")
        print(f"  完整日志：  {s['log_file']}")
        print("=" * 60)


# ─────────────────────────────────────────────────────────────────
#  全局单例
# ─────────────────────────────────────────────────────────────────

_logger: Optional[DebugLogger] = None

class _NoOpLogger(DebugLogger):
    """Logger 未初始化时使用的空操作替代，避免所有调用处都要判空"""
    def __init__(self):
        super().__init__()
        self._noop = True

    def _write(self, *_args, **_kwargs):
        pass

    def log_request(self, **kwargs):  pass
    def log_response(self, **kwargs): pass
    def log_tool_call(self, **kwargs): pass
    def log_round_start(self, **kwargs): pass
    def log_round_end(self, **kwargs): pass
    def log_outline_phase(self, **kwargs): pass
    def log_error(self, **kwargs): pass
    def log(self, **kwargs): pass
    def set_phase(self, *_args): pass
    def set_ctx(self, **_kwargs): pass
    def summary(self): return {}
    def print_summary(self): pass


def get_logger() -> DebugLogger:
    global _logger
    if _logger is None:
        _logger = _NoOpLogger()
    return _logger

def init_logger(run_id: Optional[str] = None) -> DebugLogger:
    global _logger
    _logger = DebugLogger(run_id=run_id)
    return _logger
