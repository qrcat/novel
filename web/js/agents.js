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
    syncToProject
  };
})();
