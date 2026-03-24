# 多Agent自动化小说生成工具

一个基于OpenAI框架的多角色对话小说生成系统，通过旁白Agent协调多个角色Agent自动创作小说。

## 功能特点

- **多角色对话**：多个角色Agent根据各自的人设和背景进行对话
- **智能旁白**：旁白Agent负责推动剧情、描述场景、指定下一个发言者
- **灵活配置**：支持自定义小说类型、角色设定、初始场景等
- **多类型支持**：适用于悬疑推理、都市言情、武侠、科幻等多种小说类型
- **自动保存**：支持JSON和TXT两种格式保存生成内容

## 安装依赖

```bash
pip install -r requirements.txt
```

## 配置API Key

在 `.env` 文件中配置你的API Key：

```
DASHSCOPE_API_KEY=your_api_key_here
```

## 使用方法

### 快速开始

运行默认示例（生成一本名为"午夜书店"的悬疑小说）：

```bash
python novel_agents.py
```

### 运行示例

运行内置的多种类型示例：

```bash
python example_usage.py
```

可选示例：
1. 悬疑推理小说 - 《雨夜谋杀案》
2. 都市言情 - 《咖啡馆的偶遇》
3. 武侠小说 - 《剑影江湖》
4. 自定义小说 - 交互式创建

### 自定义创作

```python
from novel_agents import NovelGenerator

# 创建小说生成器
generator = NovelGenerator(
    title="你的小说标题",
    genre="小说类型",
    initial_prompt="故事梗概"
)

# 添加角色
generator.add_character(
    name="角色名",
    personality="角色性格",
    background="角色背景"
)

# 设置初始场景
generator.current_scene = "场景描述"

# 生成多轮对话
for i in range(生成轮数):
    print(generator.generate_round())

# 保存结果
generator.save_as_text("你的小说.txt")
```

## 核心类说明

### NovelAgent
角色Agent基类，负责：
- 维护角色的人设和背景
- 根据对话历史生成符合角色性格的回应

### NarratorAgent  
旁白Agent，负责：
- 描述场景和环境
- 推动剧情发展
- 决定下一个发言的角色

### NovelGenerator
小说生成器主类，负责：
- 协调所有Agent的创作过程
- 管理对话历史
- 保存生成的内容

## 参数说明

- `model`: 使用的模型，默认为 "qwen-plus"
- `temperature`: 生成温度，控制创造性，0-1之间
- `max_tokens`: 最大生成token数
- `rounds`: 生成轮数

## 输出格式

生成的小说包含：
- 标题和类型
- 初始设定
- 角色介绍
- 正文（旁白描述 + 角色对话）

## 技术特点

- 基于OpenAI兼容API
- 支持百炼阿里云DashScope
- 模块化设计，易于扩展
- 完整的对话历史管理
- 智能角色调度

## 注意事项

1. 确保API Key有效且有足够的配额
2. 生成轮数过多可能需要较长时间
3. 角色人设越详细，对话越符合预期
4. 旁白描述会自动指定下一个发言者

## 扩展建议

- 添加情感分析模块
- 支持章节分段生成
- 集成更多写作风格
- 添加剧情分支选择功能
