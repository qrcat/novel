# 🌐 多LLM提供商配置指南

Novel Agents 现在支持多个LLM提供商，您可以根据需要在不同的提供商之间灵活切换。

## 📋 支持的提供商

### 1. 🤖 阿里云通义千问 (DashScope)

**最适合：** 中文小说创作、成本控制

**优势：**
- 中文优化，对中文文学创作理解深厚
- 模型种类丰富（Plus/Max/Turbo）
- 成本相对较低
- API响应快速

**配置步骤：**

1. 访问 [阿里云DashScope](https://dashscope.aliyuncs.com)
2. 注册账户并登录
3. 创建API Key：
   - 进入 "API-Key管理"
   - 点击 "创建新的API Key"
   - 复制API Key

4. 在Novel Agents中：
   - 点击 "⚙️ 设置"
   - 选择提供商：**🤖 阿里云通义千问**
   - 粘贴API Key
   - 选择模型（推荐：通义千问Plus）
   - 点击 "测试连接"

**可用模型：**
```
qwen-plus    → 通义千问Plus（推荐用于文学创作）
qwen-max     → 通义千问Max（最强能力）
qwen-turbo   → 通义千问Turbo（快速响应）
```

**成本参考：** 约¥0.001-0.008 / 1000 tokens

---

### 2. 🔷 OpenAI

**最适合：** 高质量创意生成、多语言支持

**优势：**
- 全球最强的通用模型
- GPT-4性能优秀
- 支持多种语言
- 工具和扩展生态完整

**配置步骤：**

1. 访问 [OpenAI官网](https://platform.openai.com)
2. 注册账户（需要信用卡）
3. 获取API Key：
   - 进入 "API Keys"
   - 点击 "Create new secret key"
   - 复制密钥（仅显示一次）

4. 在Novel Agents中：
   - 点击 "⚙️ 设置"
   - 选择提供商：**🔷 OpenAI**
   - 粘贴API Key
   - 选择模型（推荐：GPT-4O）
   - 点击 "测试连接"

**可用模型：**
```
gpt-4o         → GPT-4 Omni（最新，推荐）
gpt-4-turbo    → GPT-4 Turbo（强大+快速）
gpt-3.5-turbo  → GPT-3.5 Turbo（经济快速）
```

**成本参考：** GPT-4O 约 $0.015 / 1K input tokens

**⚠️ 注意：** 
- 确保API Key有效且已充值
- 设置使用限额防止过度消费

---

### 3. 🎯 Anthropic Claude

**最适合：** 创意写作、长文本生成

**优势：**
- Claude 3系列性能强劲
- 对长文本的理解和生成优秀
- 创意写作效果突出
- 支持超长上下文

**配置步骤：**

1. 访问 [Anthropic Console](https://console.anthropic.com)
2. 注册账户
3. 获取API Key：
   - 进入 "API Keys" 或 "Account Settings"
   - 创建新API Key
   - 复制密钥

4. 在Novel Agents中：
   - 点击 "⚙️ 设置"
   - 选择提供商：**🎯 Anthropic Claude**
   - 粘贴API Key
   - 选择模型（推荐：Claude Opus）
   - 点击 "测试连接"

**可用模型：**
```
claude-opus    → Claude 3 Opus（最强，用于创意）
claude-sonnet  → Claude 3 Sonnet（均衡)
claude-haiku   → Claude 3 Haiku（快速经济）
```

**成本参考：** Claude Opus 约 $0.015 / 1K tokens

---

### 4. ⚙️ 自定义提供商

**用于：** 本地部署、私有服务、其他兼容OpenAI格式的API

**配置步骤：**

1. 在Novel Agents中：
   - 点击 "⚙️ 设置"
   - 选择提供商：**⚙️ 自定义提供商**
   - 输入完整Base URL（如 `http://localhost:8000/v1`）
   - 输入API Key（如果需要）
   - 输入模型名称
   - 点击 "测试连接"

**示例配置：**

本地Ollama：
```
Base URL: http://localhost:11434/v1
API Key: (留空)
模型: llama2
```

本地vLLM服务：
```
Base URL: http://localhost:8000/v1
API Key: (可选)
模型: your-model-name
```

---

## 🔄 在提供商之间切换

### 快速切换

1. 打开设置菜单（⚙️ 设置）
2. 在 "选择提供商" 部分选择不同的提供商
3. 确保该提供商已配置API Key
4. 点击 "测试连接" 验证
5. 新的设置会自动应用到后续的生成任务

### 每个项目独立配置

在创建项目时，可以为该项目设置特定的提供商和模型：

```
项目A使用 DashScope → 中文优化
项目B使用 OpenAI → 英文创作
项目C使用本地Claude → 隐私保护
```

---

## 🛠️ 故障排除

### ❌ "401错误：API Key不正确"

**原因：**
- API Key拼写错误
- API Key已过期或被删除
- API Key权限不足
- 复制时包含了多余的空格

**解决方案：**
```
1. 检查API Key是否完整（前后无空格）
2. 在相应提供商官网重新获取API Key
3. 确保账户有足够余额（OpenAI/Claude）
4. 检查API Key对应的是正确的提供商
```

### ❌ "Base URL无效"

**原因：**
- 输入了错误的URL
- 自定义服务未启动
- URL包含多余的路径

**解决方案：**
```
DashScope: https://dashscope.aliyuncs.com/compatible-mode/v1
OpenAI:    https://api.openai.com/v1
Claude:    https://api.anthropic.com/v1
自定义:     确保URL指向 /v1 目录
```

### ❌ "模型不可用"

**原因：**
- 模型名称拼写错误
- 该模型对您的账户不可用
- 提供商停止支持该模型

**解决方案：**
```
1. 确认模型名称拼写正确
2. 在提供商官网查看可用模型列表
3. 使用推荐的默认模型
4. 检查账户订阅等级
```

### ❌ "连接超时"

**原因：**
- 网络连接问题
- 提供商服务不可用
- 防火墙/代理阻止连接

**解决方案：**
```
1. 检查网络连接
2. 尝试在浏览器中访问提供商网站
3. 检查防火墙设置
4. 更换网络环境测试
5. 稍后重试
```

---

## 💡 最佳实践

### 1. **配置多个提供商备份**

建议配置至少2个提供商，以便在一个出现问题时切换：

```
主用: DashScope（中文优化，成本低）
备用: OpenAI（全球可靠，高质量）
测试: 自定义本地服务
```

### 2. **根据任务选择模型**

- **快速生成**: Turbo/Haiku（更快，成本低）
- **高质量**: Plus/Max/Opus（更强，成本高）
- **平衡**: Max/Sonnet（中等成本和质量）

### 3. **定期检查成本**

- OpenAI：在 Dashboard 查看使用量
- DashScope：在阿里云控制台查看消费
- Claude：在 Anthropic 中查看额度

### 4. **管理API Key安全**

```
✅ 需要做的：
- 定期轮换API Key
- 为不同项目使用不同的Key
- 在生产环境使用环境变量
- 启用API Key使用限制

❌ 不要做的：
- 在代码中硬编码API Key
- 在Git中提交API Key
- 与他人分享API Key
- 在公开源代码中显示API Key
```

### 5. **优化API调用**

```
温度设置建议：
- 创意写作:  0.7-0.9（更多变化）
- 普通生成:  0.7-0.8（推荐）
- 逻辑任务:  0.2-0.5（更一致）

Token限制：
- 大纲阶段1-2: 800-1200 tokens
- 章节展开:    1200-1500 tokens
- 角色设定:    2000 tokens
```

---

## 📊 提供商对比表

| 特性 | DashScope | OpenAI | Claude | 自定义 |
|------|-----------|--------|--------|-------|
| **中文支持** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | 取决于模型 |
| **创意生成** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 取决于模型 |
| **成本** | ⭐⭐⭐⭐ (低) | ⭐⭐ (高) | ⭐⭐ (高) | 取决于服务 |
| **速度** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | 取决于服务 |
| **稳定性** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 取决于部署 |
| **长文本** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 取决于模型 |

---

## 🔗 相关资源

- [阿里云DashScope文档](https://help.aliyun.com/zh/model-studio/)
- [OpenAI API文档](https://platform.openai.com/docs)
- [Anthropic Claude文档](https://docs.anthropic.com)
- [Ollama本地部署](https://ollama.com)
- [vLLM部署指南](https://docs.vllm.ai)

---

**最后更新**: 2026年3月24日

**如有任何问题，请参考错误信息和本指南的故障排除章节。**
