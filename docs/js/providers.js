/**
 * LLM Providers Configuration Module
 * 管理多个LLM提供商的配置和切换
 */
const NovelProviders = (function() {
  // 预定义的LLM提供商配置
  const PROVIDERS = {
    dashscope: {
      id: 'dashscope',
      name: '🤖 阿里云通义千问',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      models: [
        { id: 'qwen-plus', name: '通义千问 Plus (推荐)' },
        { id: 'qwen-max', name: '通义千问 Max (更强)' },
        { id: 'qwen-turbo', name: '通义千问 Turbo (快速)' }
      ],
      defaultModel: 'qwen-plus',
      docUrl: 'https://help.aliyun.com/zh/model-studio/'
    },
    openai: {
      id: 'openai',
      name: '🔷 OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      models: [
        { id: 'gpt-4o', name: 'GPT-4O (最新)' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (更快)' }
      ],
      defaultModel: 'gpt-4o',
      docUrl: 'https://platform.openai.com/docs/api-reference'
    },
    claude: {
      id: 'claude',
      name: '🎯 Anthropic Claude',
      baseUrl: 'https://api.anthropic.com/v1',
      models: [
        { id: 'claude-opus', name: 'Claude 3 Opus' },
        { id: 'claude-sonnet', name: 'Claude 3 Sonnet' },
        { id: 'claude-haiku', name: 'Claude 3 Haiku' }
      ],
      defaultModel: 'claude-opus',
      docUrl: 'https://docs.anthropic.com/claude/reference'
    },
    custom: {
      id: 'custom',
      name: '⚙️ 自定义提供商',
      baseUrl: '',
      models: [
        { id: 'custom-model', name: '自定义模型' }
      ],
      defaultModel: 'custom-model',
      docUrl: '#'
    }
  };

  // 获取所有提供商
  function getAllProviders() {
    return Object.values(PROVIDERS);
  }

  // 获取具体提供商配置
  function getProvider(providerId) {
    return PROVIDERS[providerId] || null;
  }

  // 获取提供商的所有模型
  function getModels(providerId) {
    const provider = getProvider(providerId);
    return provider ? provider.models : [];
  }

  // 验证API连接
  function validateConnection(providerId, apiKey, customBaseUrl) {
    const provider = getProvider(providerId);
    if (!provider) {
      return Promise.reject(new Error('未知的提供商: ' + providerId));
    }

    if (!apiKey) {
      return Promise.reject(new Error('API Key不能为空'));
    }

    const baseUrl = providerId === 'custom' ? customBaseUrl : provider.baseUrl;
    if (!baseUrl) {
      return Promise.reject(new Error('Base URL不能为空'));
    }

    // 使用第一个模型测试连接
    const testModel = provider.models[0]?.id || 'test-model';

    // 针对Claude特殊处理
    if (providerId === 'claude') {
      return validateClaudeConnection(baseUrl, apiKey);
    }

    // 标准OpenAI格式测试
    return NovelAPI.testConnection(apiKey, baseUrl, testModel, providerId);
  }

  // Claude API特殊验证
  function validateClaudeConnection(baseUrl, apiKey) {
    return fetch(baseUrl + '/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-opus',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'OK' }]
      })
    }).then(res => {
      if (!res.ok) {
        return res.json().then(err => {
          throw new Error('Claude API错误: ' + (err.error?.message || res.statusText));
        });
      }
      return res.json();
    });
  }

  // 获取提供商信息用于显示
  function getProviderInfo(providerId) {
    const provider = getProvider(providerId);
    if (!provider) return null;

    return {
      id: provider.id,
      name: provider.name,
      docUrl: provider.docUrl,
      models: provider.models.map(m => ({
        id: m.id,
        name: m.name
      }))
    };
  }

  // 获取提供商UI配置（用于前端展示）
  function getProviderUIConfig() {
    return {
      dashscope: {
        label: '🤖 阿里云通义千问',
        hint: '中文优化，文学创作推荐',
        color: '#FF6B6B'
      },
      openai: {
        label: '🔷 OpenAI',
        hint: '全球最强，稳定可靠',
        color: '#00D9FF'
      },
      claude: {
        label: '🎯 Anthropic Claude',
        hint: '创意生成，长文本友好',
        color: '#9B59B6'
      },
      custom: {
        label: '⚙️ 自定义提供商',
        hint: '使用本地或其他服务',
        color: '#F39C12'
      }
    };
  }

  return {
    getAllProviders,
    getProvider,
    getModels,
    getProviderInfo,
    getProviderUIConfig,
    validateConnection
  };
})();
