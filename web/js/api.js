/**
 * API Module
 * 处理所有的LLM API调用，支持多个提供商
 */
const NovelAPI = (function() {
  /**
   * 发起LLM API调用
   * @param {Array} messages - 消息列表
   * @param {Array} tools - 工具列表（可选）
   * @param {String} model - 模型名称
   * @param {String} apiKey - API密钥
   * @param {String} baseUrl - API基础URL
   * @param {String} provider - 提供商ID（可选，用于特殊处理）
   * @param {Number} temperature - 温度参数
   * @param {Number} maxTokens - 最大token数
   * @param {Object} responseFormat - 响应格式（可选）
   */
  function call(messages, tools, model, apiKey, baseUrl, provider, temperature, maxTokens, responseFormat) {
    // 处理参数顺序兼容性
    if (typeof provider === 'number') {
      // 旧版API调用格式：没有provider参数
      maxTokens = temperature;
      temperature = provider;
      provider = null;
    }

    // Claude API需要特殊处理
    if (provider === 'claude' || baseUrl?.includes('anthropic')) {
      return callClaudeAPI(messages, model, apiKey, baseUrl, temperature, maxTokens);
    }

    // 标准OpenAI格式的API调用
    return callOpenAICompatible(messages, tools, model, apiKey, baseUrl, temperature, maxTokens, responseFormat);
  }

  /**
   * 调用 OpenAI 兼容的 API（DashScope, OpenAI 等）
   */
  function callOpenAICompatible(messages, tools, model, apiKey, baseUrl, temperature, maxTokens, responseFormat) {
    const body = {
      model: model,
      messages: messages.map(m => {
        // 处理 tool 角色的消息
        if (m.role === 'tool') {
          return {
            role: 'tool',
            tool_call_id: m.tool_call_id,
            content: m.content
          };
        }
        
        // 处理普通消息和 assistant 消息
        const obj = { role: m.role, content: m.content };
        
        // 处理 tool_calls（assistant 消息中的工具调用）
        if (m.tool_calls) {
          obj.tool_calls = m.tool_calls;
        }
        
        return obj;
      }),
      temperature: temperature || 0.8,
      max_tokens: maxTokens || 1000
    };

    if (responseFormat) body.response_format = responseFormat;
    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    NovelUtils.log('LLM 调用 (' + model + ')...', 'phase');

    return fetch(baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }).then(res => {
      if (!res.ok) {
        return res.text().then(err => {
          const errorMsg = 'API ' + res.status + ': ' + err.slice(0, 300);
          throw new Error(errorMsg);
        });
      }
      return res.json();
    });
  }

  /**
   * 调用Claude API（Anthropic专用格式）
   */
  function callClaudeAPI(messages, model, apiKey, baseUrl, temperature, maxTokens) {
    // Claude API使用不同的消息格式，无需system角色在消息中
    const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
    const userMessages = messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role,
      content: m.content
    }));

    const body = {
      model: model || 'claude-opus',
      max_tokens: maxTokens || 1000,
      temperature: temperature || 0.8,
      messages: userMessages
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    NovelUtils.log('Claude API调用 (' + model + ')...', 'phase');

    return fetch(baseUrl + '/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify(body)
    }).then(res => {
      if (!res.ok) {
        return res.text().then(err => {
          const errorMsg = 'Claude API错误 ' + res.status + ': ' + err.slice(0, 300);
          throw new Error(errorMsg);
        });
      }
      return res.json().then(data => {
        // 转换Claude响应为OpenAI兼容格式
        return {
          choices: [{
            message: {
              content: data.content?.[0]?.text || '',
              role: 'assistant'
            }
          }],
          usage: {
            prompt_tokens: data.usage?.input_tokens || 0,
            completion_tokens: data.usage?.output_tokens || 0
          }
        };
      });
    });
  }

  /**
   * 测试API连接
   */
  function testConnection(apiKey, baseUrl, model, provider) {
    // Claude特殊处理
    if (provider === 'claude' || baseUrl?.includes('anthropic')) {
      return fetch(baseUrl + '/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: model || 'claude-opus',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'Say OK.' }]
        })
      }).then(res => {
        if (!res.ok) {
          return res.json().then(err => {
            throw new Error(err.error?.message || res.statusText);
          });
        }
        return res.json();
      });
    }

    // OpenAI兼容API
    return callOpenAICompatible(
      [{ role: 'system', content: 'Reply only with OK.' }, { role: 'user', content: 'Say OK.' }],
      null,
      model,
      apiKey,
      baseUrl,
      0.1,
      5,
      null
    );
  }

  return {
    call,
    testConnection
  };
})();
