#!/bin/bash
# 启动 Novel Agents Web
cd "$(dirname "$0")"
export PYTHONPATH="$(dirname "$0"):$PYTHONPATH"
echo "Starting Novel Agents Web at http://localhost:8765"
uvicorn web.database:app --host 0.0.0.0 --port 8765 --reload
