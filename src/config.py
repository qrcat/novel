"""项目配置"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# 路径配置
PROJECT_ROOT = Path(__file__).parent.parent
OUTPUT_DIR = PROJECT_ROOT / "output"
AGENT_DIR = OUTPUT_DIR / "agent"

# 模型配置
DEFAULT_MODEL = "qwen-plus"
DEFAULT_TEMPERATURE = 0.8

# API 配置
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY")
DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"

def ensure_output_dirs():
    """确保输出目录存在"""
    OUTPUT_DIR.mkdir(exist_ok=True)
    AGENT_DIR.mkdir(parents=True, exist_ok=True)
