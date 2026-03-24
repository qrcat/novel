# Novel Agents 🚀

**AI驱动的小说创作助手**

Novel Agents 是一个创新的网页应用，帮助作家利用AI生成小说大纲、章节规划、角色设定和故事世界观。通过与大语言模型（LLM）的交互，快速产生创意和创作灵感。

## ✨ 核心功能

### 📚 项目管理
- **创建项目**：建立新的小说创作项目
- **项目列表**：浏览和管理所有项目
- **快速切换**：轻松在项目之间切换
- **导出功能**：将项目导出为JSON格式备份

### 🧠 AI驱动的大纲生成
使用6个阶段自动生成完整的小说大纲：

1. **核心主旨** - 提炼故事的主题和基调
2. **段落剧情** - 生成200-400字的故事梗概
3. **章节大纲** - 拆分为8-16个章节
4. **章节展开** - 为每章生成详细描述
5. **角色弧线** - 设计每个角色的成长轨迹
6. **世界观设定** - 构建故事的时间、地点和规则

### 👥 角色管理
- **自动生成**：从AI大纲中提取角色
- **手动创建**：添加自定义角色
- **详细设置**：定义性格、背景、目标和关系
- **系统提示**：为每个角色定制LLM提示词

### 💾 数据持久化
- **本地存储**：所有项目数据保存在浏览器localStorage中
- **离线使用**：创建和管理项目无需网络
- **跨会话保存**：关闭浏览器后数据不丢失

## 🏗️ 项目结构

```
Novel/
├── docs/                    # 前端文件
│   ├── index.html          # 主页面
│   ├── index.js            # 旧的未重构脚本（已废弃）
│   └── js/                 # 模块化JavaScript
│       ├── storage.js      # 存储管理模块
│       ├── utils.js        # 工具函数模块
│       ├── api.js          # API调用模块
│       ├── project.js      # 项目管理模块
│       ├── navigation.js   # 导航和页面管理
│       ├── ui.js           # UI操作和事件绑定
│       ├── outline.js      # 大纲生成模块
│       └── app.js          # 应用初始化入口
├── web/                    # 后端文件
│   ├── __init__.py         # Python包初始化
│   ├── database.py         # FastAPI应用
│   ├── run.sh              # 启动脚本
│   ├── static/             # 静态资源
│   │   └── css/
│   │       └── base.css    # 全局样式
│   └── templates/          # HTML模板
│       ├── base.html       # 样板
│       ├── index.html      # 首页（WebTemplate)
│       └── project.html    # 项目页（未使用）
├── requirements.txt        # Python依赖
└── README.md              # 本文件
```

## 🚀 快速开始

### 系统要求
- Python 3.8+
- 现代浏览器（Chrome, Firefox, Safari, Edge）
- 互联网连接（用于API调用）

### 安装步骤

1. **克隆或下载项目**
```bash
cd Novel
```

2. **创建Python虚拟环境**
```bash
python -m venv venv
source venv/bin/activate  # macOS/Linux
# 或
venv\Scripts\activate  # Windows
```

3. **安装依赖**
```bash
pip install -r requirements.txt
```

4. **配置环境变量**
创建 `.env` 文件：
```env
OPENAI_API_KEY=your-api-key-here
# 或使用其他LLM提供商
DASHSCOPE_API_KEY=your-dashscope-key
```

5. **启动应用**
```bash
# 使用提供的脚本
bash web/run.sh

# 或直接运行uvicorn
uvicorn web.database:app --host 0.0.0.0 --port 8765 --reload
```

6. **访问应用**
打开浏览器访问 `http://localhost:8765`

## 📖 使用指南

### 创建新项目

1. 点击 **"+ 新建小说"** 按钮
2. 填写基本信息：
   - **标题**：小说名称
   - **类型**：选择类型（悬疑推理、都市言情等）
   - **初始设定**：描述故事背景、人物关系、核心悬念
   - **模型、API配置**（可选）：使用项目特定的LLM配置

### 生成大纲

1. 从项目进入编辑界面
2. 确认已填写初始设定和API设置
3. 点击 **"生成大纲"** 按钮
4. 系统会依次执行6个阶段生成完整大纲
5. 在大纲页面查看生成的结果

### 管理角色

1. 点击 **"👤 角色"** 按钮打开角色管理
2. 可以：
   - 查看自动生成的角色
   - 编辑角色信息
   - 添加新角色
   - 为角色定制LLM提示词

### 配置API设置

#### 全局设置
1. 点击 **"⚙️ 设置"** 访问全局配置
2. 输入API Key和Base URL
3. 选择LLM模型和其他参数
4. 点击 **"测试连接"** 验证配置

#### 项目个性化设置
在创建项目或编辑项目时，可以为该项目设置独立的API配置。

### 支持的LLM提供商

| 提供商 | Base URL | 默认模型 |
|------|----------|--------|
| **Aliyun DashScope** | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| **OpenAI** | `https://api.openai.com/v1` | `gpt-4o` |
| **自定义** | 自定义URL | 自定义模型 |

## 🔧 代码架构

### 模块化设计

前端代码完全模块化，每个模块职责分明：

#### `storage.js` - 存储管理
```javascript
NovelStorage.getSettings()      // 获取全局设置
NovelStorage.getProjects()      // 获取所有项目
NovelStorage.updateProject()    // 更新项目
NovelStorage.saveProjects()     // 保存项目列表
```

#### `utils.js` - 工具函数
```javascript
NovelUtils.escape()             // HTML转义
NovelUtils.uuid()               // 生成UUID
NovelUtils.formatDate()         // 格式化日期
NovelUtils.toast()              // 显示通知
NovelUtils.log()                // 输出日志
```

#### `api.js` - API调用
```javascript
NovelAPI.call()                 // 发起LLM API调用
NovelAPI.testConnection()       // 测试连接
```

#### `project.js` - 项目管理
```javascript
NovelProject.createProject()    // 创建项目
NovelProject.editProject()      // 编辑项目
NovelProject.addCharacter()     // 添加角色
NovelProject.updateOutline()    // 更新大纲
```

#### `navigation.js` - 导航和页面管理
```javascript
NovelNav.goHome()               // 返回首页
NovelNav.openProject()          // 打开项目
NovelNav.showTab()              // 切换标签页
NovelNav.getActiveSettings()    // 获取活跃设置
```

#### `ui.js` - 用户界面
```javascript
NovelUI.showCreateModal()       // 显示创建弹窗
NovelUI.saveGlobalSettings()    // 保存全局设置
NovelUI.testConnection()        // 测试连接
NovelUI.bindAllEvents()         // 绑定所有事件
```

#### `outline.js` - 大纲生成
```javascript
NovelOutlineGen.generateOutline()  // 生成大纲
```

#### `app.js` - 应用初始化
应用的启动入口，协调所有模块。

## 🔄 数据流

```
用户输入
    ↓
UI模块 (ui.js) - 捕获事件和输入
    ↓
导航模块 (navigation.js) - 协调页面转换
    ↓
项目/存储模块 (project.js, storage.js) - 数据操作
    ↓
API模块 (api.js) - 调用LLM
    ↓
结果显示 - 更新UI并保存数据
```

## 🔐 安全性注意事项

- **API密钥**：存储在浏览器localStorage中，请勿在公共设备上使用
- **建议使用环境变量**：在服务器端管理敏感的API密钥
- **HTTPS推荐**：部署到生产环境时使用HTTPS加密传输

## 🐛 故障排除

### API连接失败
- 检查API Key是否正确
- 验证Base URL是否完整
- 确保网络连接正常
- 使用"测试连接"功能诊断问题

### 项目数据丢失
- Novel Agents使用浏览器localStorage保存数据
- 清除浏览器缓存会删除所有项目
- 定期使用导出功能备份重要项目

### 大纲生成缓慢
- 检查网络速度
- 大纲生成涉及多个API调用（6个阶段 + 章节展开）
- 使用温度较低的设置可提高生成速度

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

## 📝 开发计划

- [ ] 支持角色对话生成
- [ ] 实现章节自动写作
- [ ] 添加小说导出功能（HTML/PDF）
- [ ] 实现协作编辑功能
- [ ] 集成更多LLM提供商
- [ ] 添加写作风格预设
- [ ] 实现剧情分支选择
- [ ] 添加版本控制和历史记录

## 📄 许可证

本项目采用 [MIT许可证](LICENSE) 发布。

## 🙏 致谢

感谢所有贡献者和用户的支持！

---

**最后更新**：2026年3月24日

**版本**：1.0.0

**联系方式**：[Your Contact Here]

