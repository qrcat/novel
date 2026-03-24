/**
 * Character Agents Module
 * 管理小说中的角色 Agent，每个角色都有独立的 AI 代理
 * 用于模拟角色在特定情景下的动作、行为、语言
 */
const NovelAgents = (function() {
  // 缓存的角色 Agent 配置
  let agentCache = new Map();

  /**
   * 初始化角色 Agent
   * @param {Object} project - 项目对象
   * @param {Array} characters - 角色列表
   */
  function initAgents(project, characters) {
    if (!characters || !characters.length) {
      console.log('[NovelAgents] 没有角色需要初始化');
      return;
    }

    console.log(`[NovelAgents] 初始化 ${characters.length} 个角色 Agent`);
    
    characters.forEach(char => {
      const agentId = char.id || char.character_name || char.name;
      if (!agentCache.has(agentId)) {
        agentCache.set(agentId, createAgentConfig(project, char));
        console.log(`[NovelAgents] Agent 已创建：${char.character_name || char.name}`);
      }
    });
  }

  /**
   * 创建单个角色的 Agent 配置
   */
  function createAgentConfig(project, character) {
    const charName = character.character_name || character.name;
    
    // 构建角色的系统提示词
    const systemPrompt = buildCharacterSystemPrompt(project, character);
    
    return {
      id: character.id || NovelUtils.uuid(),
      name: charName,
      personality: character.personality || '',
      initialState: character.initial_state || '',
      finalState: character.final_state || '',
      keyChanges: character.key_changes || [],
      conflicts: character.conflicts || [],
      systemPrompt: systemPrompt,
      model: character.model || 'qwen-plus', // 可以为每个角色指定不同的模型
      enabled: character.enabled !== false // 默认启用
    };
  }

  /**
   * 构建角色的系统提示词
   */
  function buildCharacterSystemPrompt(project, character) {
    const charName = character.character_name || character.name;
    const personality = character.personality || character.initial_state || '';
    const genre = project.genre || '';
    const worldBuilding = JSON.stringify(project.outline?.world_building || {});
    
    return `你是一位专业的角色扮演助手，专门模拟小说中的角色「${charName}」。

【小说信息】
- 类型：${genre}
- 世界观：${worldBuilding}

【角色设定】
- 姓名：${charName}
- 性格特点：${personality}

你的任务是：
1. 根据给定的情景，模拟${charName}的动作、行为、语言和心理活动
2. 保持角色性格的一致性，让角色的反应符合其人格设定
3. 输出格式包括：动作描写、对话内容、心理活动、表情变化等
4. 考虑角色之间的关系和冲突，做出合理的互动反应

请以第一人称或第三人称限知视角进行描述，让读者能够深入了解这个角色的内心世界。`;
  }

  /**
   * 获取角色 Agent
   */
  function getAgent(characterId) {
    return agentCache.get(characterId);
  }

  /**
   * 获取所有启用的 Agent
   */
  function getEnabledAgents() {
    return Array.from(agentCache.values()).filter(agent => agent.enabled);
  }

  /**
   * 清除 Agent 缓存
   */
  function clearCache() {
    agentCache.clear();
    console.log('[NovelAgents] Agent 缓存已清除');
  }

  /**
   * 构建写作 Agent 的系统提示词
   * 专门用于过滤和整理工具调用结果，输出纯净的小说正文
   */
  function buildWriterAgentSystemPrompt(project, chapter) {
    const genre = project.genre || '';
    const theme = project.theme || '';
    
    return `你是一位专业的小说写作助手，负责将角色 Agent 的反馈整合成流畅的小说正文。

【小说信息】
- 类型：${genre}
- 主题：${theme}
- 当前章节：第${chapter.chapter_number}章 ${chapter.chapter_title}

【你的职责】
1. **过滤杂质**：移除所有工具调用的技术信息（如"好的，我来补充..."、"【其他参与者角色】"等）
2. **整合内容**：将角色的动作、对话、心理活动有机地融合到叙述中
3. **保持连贯**：确保段落之间过渡自然，情节流畅
4. **文学质量**：使用生动的描写、恰当的修辞，提升可读性
5. **视角统一**：保持叙述视角的一致性（建议使用第三人称限知视角）

【输入格式】
你会收到以下内容：
- 当前已写的正文内容
- 角色 Agent 的反馈（可能包含技术信息、角色列表等）
- 下一轮的写作方向或情景描述

【输出要求】
1. **只输出纯净的小说正文**，不要包含任何说明性文字
2. **不要重复**之前已经写过的内容
3. **每次推进 200-400 字**的情节
4. **自然衔接**角色之间的互动
5. **当情节完整时**，调用 \`complete_chapter\` 工具结束本章

【禁止事项】
❌ 不要输出"好的"、"我来..."、"现在继续写作"等技术性语言
❌ 不要列出角色名单或设定说明
❌ 不要解释你在做什么
❌ 不要重复之前的段落

请专注于创作高质量的小说内容。`;
  }

  /**
   * 清理技术信息残留
   * @param {string} content - AI 生成的内容
   * @returns {string} - 清理后的内容
   */
  function cleanTechnicalArtifacts(content) {
    let cleaned = content;

    // 移除常见的技术性短语
    const patterns = [
      /好的，?我来.*/g,
      /让我.*/g,
      /现在.*/g,
      /接下来.*/g,
      /\[.*\]/g,  // 方括号内容（如【角色名单】）
      /^.{0,50}(角色 | 参与者 | 名单 | 列表| 信息).{0,100}$/gm,
      /^\d+\..*:/gm,  // 编号列表
      /^【.*】$/gm,  // 【标题】格式
    ];

    patterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });

    // 清理多余空行
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    // 去除首尾空白
    cleaned = cleaned.trim();

    return cleaned;
  }

  /**
   * 使用写作 Agent 处理工具调用结果
   * @param {string} currentContent - 当前已写的正文内容
   * @param {Array} toolResults - 工具调用结果数组
   * @param {Object} project - 项目对象
   * @param {Object} chapter - 章节对象
   * @param {Object} settings - 全局设置
   * @returns {Promise<string>} - 处理后的纯净正文
   */
  async function processWithWriterAgent(currentContent, toolResults, project, chapter, settings) {
    // 【优化】提取工具结果中的有效内容，过滤技术信息
    const extractedContent = extractContentFromToolResults(toolResults);
    
    // 如果没有有效内容，返回空字符串
    if (!extractedContent.trim()) {
      NovelUtils.log('写作 Agent：未从工具结果中提取到有效内容', 'warn');
      return '';
    }

    // 构建用户消息
    const userMessage = `【当前正文】
${currentContent || '（尚未开始）'}

【角色反馈整理】
${extractedContent}

【任务】
请根据以上角色反馈，继续写作本章内容。推进情节发展，保持文学质量。只输出纯净的小说正文，不要包含任何技术性说明。`;

    // 调用写作 Agent
    const writerSystemPrompt = buildWriterAgentSystemPrompt(project, chapter);
    const conversation = [
      { role: 'system', content: writerSystemPrompt },
      { role: 'user', content: userMessage }
    ];

    try {
      const response = await NovelAPI.call(
        conversation,
        [], // 写作 Agent 不使用工具
        settings.model || 'qwen-plus',
        settings.temperature || 0.8,
        2000,
        { type: 'text' }
      );

      const processedContent = response.choices[0].message.content || '';
      
      // 清理可能的残留技术信息
      const cleanedContent = cleanTechnicalArtifacts(processedContent);
      
      NovelUtils.log('写作 Agent 处理完成', 'success');
      return cleanedContent;
    } catch (err) {
      NovelUtils.log(`写作 Agent 处理失败：${err.message}`, 'error');
      // 降级：直接返回提取的内容，不做 AI 处理
      return extractedContent;
    }
  }

  /**
   * 从工具调用结果中提取有效内容
   * @param {Array} toolResults - 工具调用结果数组
   * @returns {string} - 提取后的内容
   */
  function extractContentFromToolResults(toolResults) {
    const contents = [];

    toolResults.forEach(result => {
      if (result.type === 'character_tool' && result.result) {
        const charName = result.character || '未知角色';
        const toolResult = result.result;
        
        // 提取动作描述
        if (toolResult.action) {
          // 清理动作描述中的标记
          let action = toolResult.action;
          action = action.replace(/^\[.*?\]\s*/g, ''); // 移除 [主角] 前缀
          action = action.replace(/做出了符合其性格的动作反应/g, '');
          action = action.replace(/具体情况：/g, '');
          action = action.replace(/[()（）]/g, '');
          contents.push(`${charName}：${action.trim()}`);
        }
        
        // 提取对话
        if (toolResult.dialogue) {
          contents.push(`${charName}说："${toolResult.dialogue}"`);
        }
        
        // 提取情绪
        if (toolResult.emotion) {
          contents.push(`${charName}的情绪：${toolResult.emotion}`);
        }
      } else if (result.type === 'manage_character_result') {
        // 角色管理操作的结果不需要显示在正文中
        NovelUtils.log(`角色管理：${result.message}`, 'info');
      } else if (result.error) {
        // 错误信息不显示在正文中
        NovelUtils.log(`工具错误：${result.name} - ${result.error}`, 'error');
      }
    });

    return contents.join('\n\n');
  }

  /**
   * 更新 Agent 配置
   */
  function updateAgent(characterId, updates) {
    const agent = agentCache.get(characterId);
    if (agent) {
      Object.assign(agent, updates);
      agentCache.set(characterId, agent);
      console.log(`[NovelAgents] Agent 已更新：${agent.name}`);
      return true;
    }
    return false;
  }

  /**
   * 移除 Agent
   */
  function removeAgent(characterId) {
    const removed = agentCache.delete(characterId);
    if (removed) {
      console.log(`[NovelAgents] Agent 已移除：${characterId}`);
    }
    return removed;
  }

  /**
   * 同步 Agent 到项目数据
   */
  function syncToProject(project) {
    if (!project.characters) return;
    
    project.characters.forEach((char, index) => {
      const agentId = char.id || char.character_name || char.name;
      const agent = agentCache.get(agentId);
      if (agent) {
        // 将 Agent 的当前状态同步回项目数据
        project.characters[index].personality = agent.personality;
        project.characters[index].initial_state = agent.initialState;
        project.characters[index].final_state = agent.finalState;
        project.characters[index].key_changes = agent.keyChanges;
        project.characters[index].conflicts = agent.conflicts;
        project.characters[index].model = agent.model;
        project.characters[index].enabled = agent.enabled;
      }
    });
  }

  return {
    initAgents,
    getAgent,
    getEnabledAgents,
    clearCache,
    updateAgent,
    removeAgent,
    syncToProject,
    buildWriterAgentSystemPrompt,
    processWithWriterAgent,
    cleanTechnicalArtifacts
  };
})();
