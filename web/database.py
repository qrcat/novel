"""Web 后端 — FastAPI + SQLAlchemy (SQLite)"""
import os
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, List

from sqlalchemy import create_engine, Column, String, Text, Float, Integer, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from dotenv import load_dotenv

# ── 路径 ──────────────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).parent.parent
DB_PATH    = BASE_DIR / "db" / "novel.db"
TEMPLATES  = BASE_DIR / "web" / "templates"
STATIC     = BASE_DIR / "web" / "static"

DB_PATH.parent.mkdir(exist_ok=True)
load_dotenv()

# ── 数据库 ────────────────────────────────────────────────────────────────
engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False,
)
Session = sessionmaker(bind=engine)
Base = declarative_base()


class ProjectModel(Base):
    __tablename__ = "projects"

    id            = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title         = Column(String, default="未命名小说")
    genre         = Column(String, default="")
    initial_prompt = Column(Text, default="")
    outline       = Column(Text, default="{}")       # JSON 字符串
    characters    = Column(Text, default="[]")        # JSON 字符串
    novel_text    = Column(Text, default="")
    api_key       = Column(String, default="")        # 单独存储，不暴露
    model         = Column(String, default="qwen-plus")
    base_url      = Column(String, default="https://dashscope.aliyuncs.com/compatible-mode/v1")
    temperature   = Column(Float, default=0.8)
    created_at    = Column(DateTime, default=datetime.now)
    updated_at    = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    writing_chapter = Column(Integer, default=1)
    current_scene = Column(Text, default="")
    conv_history  = Column(Text, default="[]")        # JSON 字符串


Base.metadata.create_all(bind=engine)


def get_session():
    return Session()


# ── FastAPI ───────────────────────────────────────────────────────────────
app = FastAPI(title="Novel Agents Web")
templates = Jinja2Templates(directory=str(TEMPLATES))
app.mount("/static", StaticFiles(directory=str(STATIC)), name="static")


# ── 路由：页面 ───────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/project/{project_id}", response_class=HTMLResponse)
def project_page(project_id: str, request: Request):
    session = get_session()
    proj = session.query(ProjectModel).filter_by(id=project_id).first()
    session.close()
    if not proj:
        raise HTTPException(404, "项目不存在")
    return templates.TemplateResponse("project.html", {
        "request": request,
        "project_id": project_id,
    })


# ── 路由：项目 CRUD ───────────────────────────────────────────────────────

class CreateProjectIn(BaseModel):
    title: str = "未命名小说"
    genre: str = ""
    initial_prompt: str = ""
    api_key: str = ""
    model: str = "qwen-plus"
    base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"


@app.post("/api/projects")
def create_project(data: CreateProjectIn):
    session = get_session()
    proj = ProjectModel(
        title=data.title,
        genre=data.genre,
        initial_prompt=data.initial_prompt,
        api_key=data.api_key,
        model=data.model,
        base_url=data.base_url,
    )
    session.add(proj)
    session.commit()
    session.refresh(proj)
    session.close()
    return {"id": proj.id, "title": proj.title}


@app.get("/api/projects")
def list_projects():
    session = get_session()
    projects = session.query(ProjectModel).order_by(ProjectModel.updated_at.desc()).all()
    result = [{
        "id": p.id,
        "title": p.title,
        "genre": p.genre,
        "initial_prompt": p.initial_prompt,
        "model": p.model,
        "created_at": p.created_at.isoformat(),
        "updated_at": p.updated_at.isoformat(),
        "writing_chapter": p.writing_chapter,
    } for p in projects]
    session.close()
    return result


@app.get("/api/project/{project_id}")
def get_project(project_id: str):
    session = get_session()
    proj = session.query(ProjectModel).filter_by(id=project_id).first()
    session.close()
    if not proj:
        raise HTTPException(404, "项目不存在")
    return {
        "id": proj.id,
        "title": proj.title,
        "genre": proj.genre,
        "initial_prompt": proj.initial_prompt,
        "outline": json.loads(proj.outline or "{}"),
        "characters": json.loads(proj.characters or "[]"),
        "novel_text": proj.novel_text,
        "api_key": proj.api_key,
        "model": proj.model,
        "base_url": proj.base_url,
        "temperature": proj.temperature,
        "writing_chapter": proj.writing_chapter,
        "current_scene": proj.current_scene,
        "conv_history": json.loads(proj.conv_history or "[]"),
    }


@app.patch("/api/project/{project_id}")
def update_project(project_id: str, data: dict):
    session = get_session()
    proj = session.query(ProjectModel).filter_by(id=project_id).first()
    if not proj:
        session.close()
        raise HTTPException(404, "项目不存在")

    # 安全字段白名单
    SAFE = {
        "title", "genre", "initial_prompt", "outline", "characters",
        "novel_text", "api_key", "model", "base_url", "temperature",
        "writing_chapter", "current_scene", "conv_history",
    }
    for key, value in data.items():
        if key in SAFE:
            if key in ("outline", "characters", "conv_history"):
                setattr(proj, key, json.dumps(value, ensure_ascii=False))
            else:
                setattr(proj, key, value)

    proj.updated_at = datetime.now()
    session.commit()
    session.close()
    return {"ok": True}


@app.delete("/api/project/{project_id}")
def delete_project(project_id: str):
    session = get_session()
    proj = session.query(ProjectModel).filter_by(id=project_id).first()
    if proj:
        session.delete(proj)
        session.commit()
    session.close()
    return {"ok": True}


# ── 路由：角色 CRUD ───────────────────────────────────────────────────────

class CreateCharacterIn(BaseModel):
    name: str
    personality: str = ""
    background: str = ""
    role: str = ""          # 主角/配角/反派/工具人
    appearance: str = ""     # 外貌特征


@app.post("/api/project/{project_id}/character")
def add_character(project_id: str, data: CreateCharacterIn):
    session = get_session()
    proj = session.query(ProjectModel).filter_by(id=project_id).first()
    if not proj:
        session.close()
        raise HTTPException(404, "项目不存在")

    chars = json.loads(proj.characters or "[]")
    # 检查重名
    if any(c.get("name") == data.name for c in chars):
        session.close()
        raise HTTPException(400, f"角色「{data.name}」已存在")

    chars.append({
        "name": data.name,
        "personality": data.personality,
        "background": data.background,
        "role": data.role,
        "appearance": data.appearance,
    })
    proj.characters = json.dumps(chars, ensure_ascii=False)
    proj.updated_at = datetime.now()
    session.commit()
    session.close()
    return {"ok": True, "character": data.model_dump()}


@app.put("/api/project/{project_id}/character/{char_name}")
def update_character(project_id: str, char_name: str, data: CreateCharacterIn):
    session = get_session()
    proj = session.query(ProjectModel).filter_by(id=project_id).first()
    if not proj:
        session.close()
        raise HTTPException(404, "项目不存在")

    chars = json.loads(proj.characters or "[]")
    updated = False
    for i, c in enumerate(chars):
        if c.get("name") == char_name:
            # 如果改了名字，先检查新名字是否冲突
            if data.name != char_name and any(x.get("name") == data.name for x in chars):
                session.close()
                raise HTTPException(400, f"角色「{data.name}」已存在")
            chars[i] = {
                "name": data.name,
                "personality": data.personality,
                "background": data.background,
                "role": data.role,
                "appearance": data.appearance,
            }
            updated = True
            break

    if not updated:
        session.close()
        raise HTTPException(404, f"角色「{char_name}」不存在")

    proj.characters = json.dumps(chars, ensure_ascii=False)
    proj.updated_at = datetime.now()
    session.commit()
    session.close()
    return {"ok": True, "character": data.model_dump()}


@app.delete("/api/project/{project_id}/character/{char_name}")
def delete_character(project_id: str, char_name: str):
    session = get_session()
    proj = session.query(ProjectModel).filter_by(id=project_id).first()
    if not proj:
        session.close()
        raise HTTPException(404, "项目不存在")

    chars = json.loads(proj.characters or "[]")
    before = len(chars)
    chars = [c for c in chars if c.get("name") != char_name]
    if len(chars) == before:
        session.close()
        raise HTTPException(404, f"角色「{char_name}」不存在")

    proj.characters = json.dumps(chars, ensure_ascii=False)
    proj.updated_at = datetime.now()
    session.commit()
    session.close()
    return {"ok": True}


# ── 路由：生成 ────────────────────────────────────────────────────────────

class GenerateOutlineIn(BaseModel):
    api_key: str
    model: str
    base_url: str


@app.post("/api/project/{project_id}/generate-outline")
def generate_outline_endpoint(project_id: str, data: GenerateOutlineIn):
    import sys, asyncio
    sys.path.insert(0, str(BASE_DIR / "src"))

    session = get_session()
    proj = session.query(ProjectModel).filter_by(id=project_id).first()
    if not proj:
        session.close()
        raise HTTPException(404, "项目不存在")

    characters = json.loads(proj.characters or "[]")
    characters_dict = {
        c["name"]: type("C", (), {"personality": c.get("personality",""), "background": c.get("background","")})()
        for c in characters
    }

    from src.agents.outline import OutlineAgent
    from src.debug import init_logger, _NoOpLogger

    init_logger(run_id=f"outline_{project_id[:8]}")

    agent = OutlineAgent(model=data.model)
    agent.client = type("C", (), {
        "chat": type("C", (), {
            "completions": type("C", (), {
                "create": lambda **kw: _mock_completion(
                    kw, data.api_key, data.base_url, "outline"
                )
            })()
        })()
    })()

    outline = agent.generate_outline(
        title=proj.title,
        genre=proj.genre,
        initial_prompt=proj.initial_prompt,
        characters=characters_dict,
    )

    proj.outline = json.dumps(outline, ensure_ascii=False, indent=2)
    proj.updated_at = datetime.now()
    session.commit()
    session.close()
    return outline


class GenerateRoundIn(BaseModel):
    api_key: str
    model: str
    base_url: str


@app.post("/api/project/{project_id}/generate-round")
def generate_round_endpoint(project_id: str, data: GenerateRoundIn):
    import sys
    sys.path.insert(0, str(BASE_DIR / "src"))

    session = get_session()
    proj = session.query(ProjectModel).filter_by(id=project_id).first()
    if not proj:
        session.close()
        raise HTTPException(404, "项目不存在")

    outline = json.loads(proj.outline or "{}")
    characters_raw = json.loads(proj.characters or "[]")
    conv_history = json.loads(proj.conv_history or "[]")

    from src.agents.novel_character import NovelAgent
    from src.agents.writer import WriterAgent
    from src.tools.builtins import register_builtin_tools
    from src.tools.registry import ToolRegistry
    from src.debug import init_logger, get_logger
    from src.agents.base import AgentBase

    init_logger(run_id=f"round_{project_id[:8]}")

    # 创建角色
    characters = {}
    for c in characters_raw:
        agent = NovelAgent(name=c["name"], personality=c.get("personality",""), background=c.get("background",""))
        agent.client = _make_client(data.api_key, data.base_url)
        characters[c["name"]] = agent

    # 创建 Writer
    writer = WriterAgent()
    writer.client = _make_client(data.api_key, data.base_url)
    writer.model = data.model

    # 注册工具
    registry = ToolRegistry()
    gen = type("MockGen", (), {
        "characters": characters,
        "conversation_history": conv_history,
        "current_scene": proj.current_scene,
        "outline": outline,
        "writer": writer,
    })()

    register_builtin_tools(registry, gen)
    for name, info in registry._tools.items():
        writer.register_tool(
            tool_name=name,
            description=info["description"],
            parameters=info["parameters"],
            handler=info["handler"],
        )

    writer.set_characters(characters)
    writer.load_outline(outline)

    # 尝试推进章节
    chapters = outline.get("chapters", [])
    if proj.writing_chapter <= len(chapters):
        ch = chapters[proj.writing_chapter - 1]
        writer.current_chapter = proj.writing_chapter

    # 执行一轮
    context = _build_context(writer, proj, outline)
    messages = [
        {"role": "system", "content": writer.build_system_prompt()},
        {"role": "user", "content": context},
    ]

    max_loops = 20
    loop = 0
    REWRITE_HINT = (
        "上方是工具执行结果（含角色台词）。"
        "请将台词改写整合进叙述，输出最终正文。禁止调用工具。"
    )

    while loop < max_loops:
        loop += 1
        result = writer.generate_with_tools_raw(messages, max_tokens=800)
        narration = result.get("content", "") or ""
        tool_calls = result.get("tool_calls")

        if not tool_calls:
            final_text = narration.strip()
            # 保存
            proj.novel_text = (proj.novel_text or "") + f"\n{'='*60}\n{final_text}\n{'='*60}\n"
            proj.current_scene = ""
            proj.updated_at = datetime.now()
            session.commit()
            session.close()
            return {"text": final_text, "loops": loop}

        messages.append({
            "role": "assistant",
            "content": narration.strip() or None,
            "tool_calls": [
                {"id": tc.id, "type": "function",
                 "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                for tc in tool_calls
            ],
        })
        for tc in tool_calls:
            import json as _json
            args = _json.loads(tc.function.arguments)
            tool_result = writer.execute_tool(tc.function.name, args)
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": tool_result})
            if tc.function.name == "get_character_dialogue":
                conv_history.append({
                    "type": "dialogue_raw",
                    "character": args.get("character_name", ""),
                    "content": tool_result,
                })

        messages.append({"role": "user", "content": REWRITE_HINT})

    # 达到上限
    proj.novel_text = (proj.novel_text or "") + f"\n{'='*60}\n{narration.strip()}\n{'='*60}\n"
    proj.updated_at = datetime.now()
    session.commit()
    session.close()
    return {"text": narration.strip(), "loops": loop, "truncated": True}


# ── 辅助 ──────────────────────────────────────────────────────────────────

def _make_client(api_key: str, base_url: str):
    from openai import OpenAI
    return OpenAI(api_key=api_key, base_url=base_url)


def _mock_completion(kw, api_key, base_url, kind):
    """开发调试用：直接调真实 API"""
    client = _make_client(api_key, base_url)
    return client.chat.completions.create(**kw)


def _build_context(writer, proj, outline):
    pos = writer.get_current_position()
    context = f"""小说标题：{proj.title}
类型：{proj.genre}
当前场景：{proj.current_scene}

当前写作进度：
- 第 {pos['chapter']} 章
- 场景进度：{pos['scene']}

初始设定：{proj.initial_prompt}

最近的对话/事件：
{_format_history(json.loads(proj.conv_history or "[]"))}"""

    chapters = outline.get("chapters", [])
    if pos["chapter"] <= len(chapters):
        ch = chapters[pos["chapter"] - 1]
        context += f"""
当前章节信息：
- 标题：{ch.get('chapter_title', '未命名')}
- 场景设定：{ch.get('scene_setting', '未设定')}
- 关键事件：{ch.get('key_events', [])}
- 涉及角色：{ch.get('characters_involved', [])}"""
    return context


def _format_history(history: list) -> str:
    if not history:
        return "暂无"
    parts = []
    for item in history[-5:]:
        if item.get("type") in ("dialogue", "dialogue_raw"):
            parts.append(item.get("content", ""))
        elif item.get("type") in ("scene_change", "plot_twist", "chapter_end"):
            parts.append(f"[{item.get('content', '')}]")
    return "\n".join(parts) if parts else "暂无"
