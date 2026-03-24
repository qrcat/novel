# 🎨 UI改进指南 - 多提供商支持

本文档说明了对Novel Agents前端UI的推荐改进，以更好地支持多个LLM提供商。

## 📋 改进概览

### 当前状态
- ✅ 后端支持多提供商
- ✅ 存储系统支持多Key管理
- ⏳ 前端UI仍需改进

### 改进目标
- 🎯 清晰的提供商选择界面
- 🎯 为每个提供商独立保存API Key
- 🎯 快速提供商切换
- 🎯 改进的错误提示

---

## 🖼️ UI改进方案

### 1. 设置页面的提供商选择区域

**推荐布局：**

```
┌─────────────────────────────────────────┐
│  LLM提供商配置                            │
├─────────────────────────────────────────┤
│                                          │
│  选择提供商: [v]  当前: 🤖 DashScope    │
│                                          │
│  □ 🤖 阿里云通义千问                     │
│    中文优化，成本低 [配置]               │
│                                          │
│  □ 🔷 OpenAI                            │
│    全球最强，稳定可靠 [配置]             │
│                                          │
│  □ 🎯 Anthropic Claude                  │
│    创意生成，长文本优秀 [配置]           │
│                                          │
│  □ ⚙️ 自定义提供商                      │
│    本地或其他服务 [配置]                 │
│                                          │
└─────────────────────────────────────────┘
```

### 2. 提供商配置面板（折叠式）

点击 [配置] 后展开该提供商的配置：

```
┌──── 🤖 阿里云通义千问 ─────────────┐
│                                      │
│ API Key:                             │
│ [输入框: sk-xxxx...]                 │
│                                      │
│ Base URL:                            │
│ [自动填充] https://dashscope...     │
│                                      │
│ 模型:                                │
│ [下拉] qwen-plus (推荐)              │
│       qwen-max                       │
│       qwen-turbo                     │
│                                      │
│ [✓ 测试连接]  [保存]               │
│                                      │
│ 帮助: [文档] [DashScope官网]        │
│                                      │
└──────────────────────────────────────┘
```

### 3. 快速切换按钮

在顶部Header显示当前提供商，点击可快速切换：

```
头部栏:
┌──────────────────────────────────────────┐
│ [Logo] Novel Agents    当前: 🤖 DashScope │  
│                        [切换提供商 ↓]     │
└──────────────────────────────────────────┘

点击后的菜单:
┌──────────────────────┐
│ 🤖 DashScope  ✓      │  (当前)
│ 🔷 OpenAI            │
│ 🎯 Claude            │
│ ⚙️ 自定义            │
├──────────────────────┤
│ [⚙️ 所有设置...]      │
└──────────────────────┘
```

### 4. 创建项目时的选择

在"新建小说"弹窗中添加提供商选择：

```
┌────── 新建小说 ──────┐
│                      │
│ 标题:                │
│ [输入框]             │
│                      │
│ 类型:                │
│ [下拉菜单]           │
│                      │
│ 初始设定:            │
│ [文本框]             │
│                      │
│ 使用提供商:          │
│ [v] 🤖 DashScope    │
│     或使用全局设置   │
│                      │
│ [创建]  [取消]      │
└──────────────────────┘
```

---

## 🛠️ HTML改进代码片段

### 提供商选择容器

```html
<!-- 设置页面的提供商配置区域 -->
<div class="settings-providers-section">
  <h3 class="section-title">LLM提供商配置</h3>
  
  <div class="active-provider-display">
    <span>当前提供商:</span>
    <button id="switch-provider-btn" class="btn btn-outline">
      <span id="current-provider-name">🤖 阿里云通义千问</span>
    </button>
  </div>

  <div class="providers-list">
    <div class="provider-card" data-provider="dashscope">
      <div class="provider-header">
        <span class="provider-icon">🤖</span>
        <span class="provider-name">阿里云通义千问</span>
        <span class="provider-hint">中文优化，成本低</span>
      </div>
      <button class="btn btn-ghost configure-btn">配置</button>
      <div class="provider-config hidden" id="config-dashscope">
        <input type="password" placeholder="API Key" class="api-key-input" data-provider="dashscope">
        <select class="model-select" data-provider="dashscope">
          <option value="qwen-plus">通义千问Plus (推荐)</option>
          <option value="qwen-max">通义千问Max</option>
          <option value="qwen-turbo">通义千问Turbo</option>
        </select>
        <button class="btn btn-primary test-connection-btn" data-provider="dashscope">
          ✓ 测试连接
        </button>
      </div>
    </div>

    <!-- 其他提供商卡片类似 -->
  </div>
</div>
```

### 切换提供商的JavaScript

```javascript
// 显示提供商选择菜单
NovelUI.showProviderSwitcher = function() {
  const menu = document.createElement('div');
  menu.className = 'provider-switcher-menu';
  
  NovelProviders.getAllProviders().forEach(provider => {
    const item = document.createElement('button');
    item.className = 'provider-menu-item';
    item.innerHTML = `${provider.name} ${
      provider.id === NovelStorage.getActiveProvider() ? '✓' : ''
    }`;
    item.addEventListener('click', () => {
      NovelStorage.setActiveProvider(provider.id);
      menu.remove();
      location.reload(); // 刷新以应用新提供商
    });
    menu.appendChild(item);
  });
  
  document.body.appendChild(menu);
};
```

---

## 🎨 CSS样式参考

```css
/* 提供商选择容器 */
.settings-providers-section {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.5rem;
  margin: 1.5rem 0;
  background: var(--surface);
}

/* 提供商卡片 */
.provider-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  margin: 0.5rem 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  transition: all 0.2s;
}

.provider-card:hover {
  border-color: var(--accent);
  background: var(--surface2);
}

.provider-card.active {
  border-color: var(--accent);
  box-shadow: 0 0 12px rgba(201,168,76,0.2);
}

.provider-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
}

.provider-icon {
  font-size: 1.5rem;
}

.provider-name {
  font-weight: 500;
  color: var(--text);
}

.provider-hint {
  font-size: 0.85rem;
  color: var(--muted);
}

/* 配置面板 */
.provider-config {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
  padding: 1rem 0;
  border-top: 1px solid var(--border);
}

.provider-config.hidden {
  display: none;
}

/* 快速切换菜单 */
.provider-switcher-menu {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.3);
  z-index: 300;
  min-width: 250px;
}

.provider-menu-item {
  display: block;
  width: 100%;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;
}

.provider-menu-item:hover {
  background: var(--surface2);
  color: var(--accent);
}
```

---

## 🔄 改进步骤（按优先级）

### Phase 1: 基础支持（优先级：高）
- [ ] 在设置页面添加提供商选择界面
- [ ] 实现提供商配置的保存和加载
- [ ] 添加提供商切换功能
- [ ] 改进错误提示信息

### Phase 2: 体验优化（优先级：中）
- [ ] 添加快速提供商切换按钮
- [ ] 实现配置预设和模板
- [ ] 添加提供商快速入门向导
- [ ] 优化UI布局和样式

### Phase 3: 高级功能（优先级：低）
- [ ] 支持项目级提供商配置
- [ ] 添加成本估计工具
- [ ] 实现使用量监控
- [ ] 本地化多语言支持

---

## 📝 实现清单

- [ ] 创建 `settings-providers.html` 模板片段
- [ ] 创建 `styles-providers.css` 样式文件
- [ ] 创建 `ui-providers.js` UI逻辑模块
- [ ] 集成到 `ui.js` 主模块
- [ ] 测试各提供商配置
- [ ] 编写用户文档
- [ ] 测试错误处理和验证

---

## 💻 前端资源

**相关类/函数：**
```javascript
NovelProviders.getAllProviders()      // 获取所有提供商
NovelProviders.getProvider(id)        // 获取特定提供商
NovelStorage.setActiveProvider(id)    // 设置活跃提供商
NovelStorage.getActiveProvider()      // 获取活跃提供商
NovelStorage.saveProviderConfig()     // 保存提供商配置
```

**相关存储键：**
```
na_providers     // 多个提供商的配置
na_settings      // 全局设置（包含activeProvider）
```

---

**本文档版本：** 1.0  
**最后更新：** 2026年3月24日  
**优先级标记：** 🔴 高 | 🟡 中 | 🟢 低
