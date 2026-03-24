"""
Novel Agents Web Server
FastAPI 应用主文件

提供API端点支持前端应用的各类操作
"""

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import os
from pathlib import Path

# 创建FastAPI应用
app = FastAPI(
    title="Novel Agents",
    description="AI-Powered Novel Writing Assistant",
    version="1.0.0"
)

# 获取项目根目录
BASE_DIR = Path(__file__).parent.parent

# 挂载静态文件
static_dir = BASE_DIR / "docs"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/")
async def root():
    """返回主页"""
    index_file = static_dir / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "Welcome to Novel Agents"}


@app.get("/api/health")
async def health_check():
    """健康检查端点"""
    return {"status": "ok", "service": "Novel Agents"}


@app.get("/api/version")
async def get_version():
    """获取应用版本"""
    return {"version": "1.0.0", "name": "Novel Agents"}


# API文档
@app.get("/docs")
async def docs():
    """API文档"""
    return {"message": "API documentation available at /docs"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8765)
