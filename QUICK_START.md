# ⚡ API配置快速参考

## 🎯 最快5分钟配置

### 选项1：使用DashScope（推荐用于中文）

```
1. 访问: https://dashscope.aliyuncs.com
   
2. 注册并登录
   
3. 获取API Key:
   导航 → API Key管理 → 创建API Key → 复制
   
4. 在Novel Agents中配置：
   ⚙️ 设置 
   → 选择: 🤖 阿里云通义千问
   → 粘贴 API Key
   → 模型: qwen-plus
   → 点击 ✓ 测试连接
   
✅ 完成！
```

**成本:** ¥0.001-0.008 per 1K tokens （非常便宜）

---

### 选项2：使用OpenAI（全球通用）

```
1. 访问: https://platform.openai.com
   
2. 注册并充值（需信用卡 💳）
   
3. 获取API Key:
   Account → API Keys → Create new secret key → 复制
   
4. 在Novel Agents中配置：
   ⚙️ 设置
   → 选择: 🔷 OpenAI
   → 粘贴 API Key
   → 模型: gpt-4o
   → 点击 ✓ 测试连接
   
✅ 完成！
```

**成本:** $0.015+ per 1K tokens （相对较贵）

---

### 选项3：使用Claude（创意最强）

```
1. 访问: https://console.anthropic.com
   
2. 注册并充值
   
3. 获取API Key:
   Settings → API Keys → Create key → 复制
   
4. 在Novel Agents中配置：
   ⚙️ 设置
   → 选择: 🎯 Anthropic Claude
   → 粘贴 API Key
   → 模型: claude-opus
   → 点击 ✓ 测试连接
   
✅ 完成！
```

**成本:** $0.015+ per 1K tokens

---

## 🔧 配置验证清单

- [ ] API Key已复制（前后无空格）
- [ ] 选择了正确的提供商
- [ ] Base URL自动正确填充（或手动输入）
- [ ] 模型名称在列表中可选
- [ ] 点击"测试连接"成功
- [ ] 显示 "连接成功! tokens: X+Y"

---

## ❌ 常见问题速查

| 问题 | 检查清单 |
|------|--------|
| **401 API Key错误** | □ Key前后无空格 □ 选对提供商 □ Key未过期 □ 账户有余额 |
| **Network错误** | □ 网络连接正常 □ VPN/代理访问 □ 防火墙配置 |
| **模型不可用** | □ 模型名拼写正确 □ 账户支持该模型 □ 试用推荐模型 |
| **超时** | □ 提供商网站正常 □ 等待后重试 □ 更换网络 |

---

## 🆚 提供商快速对比

| | DashScope | OpenAI | Claude |
|---|----------|--------|--------|
| 💬 中文 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| 💰 便宜 | ✅ 最便宜 | ❌ 较贵 | ❌ 较贵 |
| 📝 创意 | ✅ 很好 | ✅✅ 最强 | ✅✅ 最强 |
| ⚡ 快速 | ✅ 快 | ✅ 很快 | ✅ 快 |

**建议:** 
- 中文创作 → DashScope
- 英文创作 → OpenAI或Claude
- 经费有限 → DashScope
- 质量至上 → OpenAI或Claude

---

## 📍 各提供商官网链接

| 提供商 | 网站 | API Key位置 |
|--------|------|-----------|
| 🤖 DashScope | https://dashscope.aliyuncs.com | 左菜单 → API Key管理 |
| 🔷 OpenAI | https://platform.openai.com | Account → API Keys |
| 🎯 Claude | https://console.anthropic.com | Settings → API Keys |

---

## 💡 Tips

1. **同时配置2个提供商** - 一个主用，一个备用
2. **测试连接很重要** - 确保配置无误后再生成
3. **定期检查账户** - 监控使用量和余额
4. **导出重要项目** - 防止浏览器数据丢失
5. **选择合适的模型** - Plus足够好，Max和Opus用于关键任务

---

**需要帮助?** 

- 详细配置: 查看 [PROVIDERS.md](PROVIDERS.md)
- 遇到报错: 参考 [README.md#故障排除](README.md#-故障排除)
- 开发相关: 查看 [DEVELOPER.md](DEVELOPER.md)

