/**
 * API Module
 * 处理所有的LLM API调用
 */
const NovelAPI = (function() {
  /**
   * 发起LLM API调用
   * @param {Array} messages - 消息列表
   * @param {Array} tools - 工具列表（可选）
   * @param {String} model - 模型名称
   * @param {String} apiKey - API密钥
   * @param {String} baseUrl - API基础URL
   * @param {Number} temperature - 温度参数
   * @param {Number} maxTokens - 最大token数
   * @param {Object} responseFormat - 响应格式（可选）
   */
  function call(messages, tools, model, apiKey, baseUrl, temperature, maxTokens, responseFormat) {
    const body = {
      model: model,
      messages: messages.map(m => {
        const obj = { role: m.role, content: m.content };
        if (m.tool_calls) obj.tool_calls = m.tool_calls;
        if (m.tool_call_id) {
          obj.tool_call_id = m.tool_call_id;
          obj.content = m.content;
        }
        return obj;
      }),
      temperature: temperature || 0.8,
      max_tokens: maxTokens || 1000
    };

    if (responseFormat) body.response_format = responseFormat;
    if (tools && tools.length) body.tools = tools;

    NovelUtils.log('LLM调用 (' + model + ')...', 'phase');

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
          throw new Error('API ' + res.status + ': ' + err.slice(0, 200));
        });
      }
      return res.json();
    });
  }

  /**
   * 测试API连接
   */
  function testConnection(apiKey, baseUrl, model) {
    return call(
      [
        { role: 'system', content: 'Reply only with OK.' },
        { role: 'user', content: 'Say OK.' }
      ],
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
