"""OpenAI-compatible client 单例封装"""
from openai import OpenAI
from src.config import DASHSCOPE_API_KEY, DASHSCOPE_BASE_URL

_client = None

def get_client() -> OpenAI:
    """获取全局 client 实例"""
    global _client
    if _client is None:
        _client = OpenAI(
            api_key=DASHSCOPE_API_KEY,
            base_url=DASHSCOPE_BASE_URL,
        )
    return _client
