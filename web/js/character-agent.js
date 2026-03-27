/**
 * Character Agent Module
 * 负责分析本章涉及的角色
 */
const NovelWriterCharacterAgent = (function () {
  /**
   * AI Agent：分析本章涉及的角色详情
   * @param {Object} outline - 大纲对象（包含全量角色档案）
   * @param {Object} chapter - 章节对象（包含角色引用）
   * @param {Object} settings - API 设置
   * @returns {Promise<Array>} - 返回本章涉及角色的详细信息数组
   */
  async function analyzeCharactersAgent(outline, chapter, settings) {
    NovelUtils.log('分析本章涉及的角色...', 'phase');

    // 从项目级别的角色档案中读取（而非 outline.characters）
    const currentProject = NovelNav.getCurrentProject();
    const allCharacters = Array.isArray(currentProject?.characters) ? currentProject.characters : [];

    // 如果没有角色档案，使用 Fallback
    if (allCharacters.length === 0) {
      NovelUtils.log('项目中没有角色档案，使用本地提取方案', 'warning');
      return fallbackLocalExtraction({ characters: [] }, chapter);
    }

    // 构建格式化的角色档案列表（文本格式）
    const formattedCharacters = allCharacters.map(char => {
      const keyChangesText = Array.isArray(char.key_changes) && char.key_changes.length > 0 
        ? char.key_changes.join('; ') 
        : '无';
      const conflictsText = Array.isArray(char.conflicts) && char.conflicts.length > 0 
        ? char.conflicts.join('; ') 
        : '无';
      
      return `【${char.name || char.character_name}】(ID: ${char.id})
  - 性格：${char.personality || '未设定'}
  - 定位：${char.role_in_story || '未明确'}
  - 背景：${char.background || '无特殊背景'}`;
    }).join('\n\n');

    const charactersText = allCharacters.length > 0 
      ? `共有 ${allCharacters.length} 个角色：\n\n${formattedCharacters}`
      : '暂无角色档案';

    // 构建格式化的章节信息（文本格式）
    const keyEventsText = Array.isArray(chapter.key_events) && chapter.key_events.length > 0
      ? chapter.key_events.map((event, idx) => `   ${idx + 1}. ${event}`).join('\n')
      : '无';
    
    const charactersInvolvedText = (() => {
      const chars = chapter.characters_involved || chapter.characters || chapter.character_list || chapter.appearing_characters || [];
      return Array.isArray(chars) && chars.length > 0 ? chars.join(',') : '无';
    })();

    const formattedChapterInfo = `章节号：${chapter.chapter_number}
章节标题：${chapter.chapter_title}
一句话概要：${chapter.one_sentence || '无'}
扩展段落：${chapter.expanded_paragraph || '无'}
关键事件：
${keyEventsText}
涉及角色：${charactersInvolvedText}`;

    // System Prompt：定义 Agent 职责
    const systemPrompt = `你是一位专业的小说编辑和角色分析师。你的任务是基于"完整角色档案"和"当前章节信息"，精准识别本章中实际出场的角色。

【核心任务】
- 找出所有"在本章中真实出场或被明确提及"的角色
- 返回这些角色的 ID 列表

【分析规则】
1. 优先使用章节对象中的显式字段：
   - characters_involved
   - characters
   - character_list
   - appearing_characters

2. 若上述字段为空或缺失，则基于以下内容进行匹配：
   - one_sentence
   - expanded_paragraph
   - key_events

3. 匹配方式要求：
   - 仅当角色"明确出现或被直接提及"时才计入
   - 支持角色姓名的精确匹配或明显指代（如唯一代称）
   - 避免基于模糊语义或推测进行匹配

4. 选择原则：
   - 不遗漏关键出场角色
   - 不包含未实际出场的角色
   - 不根据背景设定或常识进行推断

【输出规则（严格）】
- 只输出 JSON
- 只包含字段：involved_character_ids
- 值必须为角色 ID 数组（string[]）
- 不输出解释、说明或任何额外文本

【边界情况】
- 若没有任何角色出场，返回空数组
- 不允许返回 null、undefined 或其他结构

记住：你只负责"识别角色 ID"，不需要输出角色信息或进行分析说明。`;

    // User Prompt：提供完整上下文
    const userPrompt = `【全量角色档案】
${charactersText}

【当前章节信息】
${formattedChapterInfo}

请识别本章中"实际出场或被明确提及"的角色，并返回如下 JSON：

{
  "involved_character_ids": ["角色 ID1", "角色 ID2"]
}

要求：
- 仅返回角色 ID
- 不包含任何额外字段
- 不输出解释或说明
- 若无角色出场，返回：
{
  "involved_character_ids": []
}`;

    try {
      // 构建消息数组
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      // 调用 LLM API 进行角色分析
      const response = await NovelAPI.call(
        messages,
        null,
        settings.model,
        settings.apiKey,
        settings.baseUrl,
        settings.provider,
        0.0,  // 低温度确保分析准确性
        4096, // maxTokens，足够返回 JSON
        { type: 'text' }
      );

      const content = response.choices[0].message.content || '';

      // 解析 AI 返回的 JSON 结果（兼容 Markdown 代码块格式）
      let result;
      try {
        // 清理可能的 Markdown 代码块标记
        let cleanContent = content.trim();

        // 移除开头的 ```json 或 ```
        cleanContent = cleanContent.replace(/^```(?:json)?\s*\n?/, '');

        // 移除结尾的 ```
        cleanContent = cleanContent.replace(/\n?```\s*$/, '');

        cleanContent = cleanContent.trim();

        result = JSON.parse(cleanContent);
      } catch (parseError) {
        NovelUtils.log('角色 Agent 返回格式解析失败，使用备用方案', 'warning');

        // Fallback：本地提取方案
        return fallbackLocalExtraction({ characters: allCharacters }, chapter);
      }

      // 从 ID 列表中提取完整的角色档案信息（保持数组格式）
      const involvedIds = Array.isArray(result.involved_character_ids) ? result.involved_character_ids : [];

      const involvedCharacters = involvedIds.map(id => {
        // 根据 ID 查找对应的完整角色档案
        const char = allCharacters.find(c => c.id === id);
        if (!char) return null;

        // 返回标准化格式的角色详情（包含 ID，保持数组字段）
        return {
          id: char.id,  // ✅ 添加角色唯一 ID
          name: char.name || char.character_name,
          personality: char.personality || '未设定',
          background: char.background || '无特殊背景',
          role_in_story: char.role_in_story || '未明确',
          initial_state: char.initial_state || '无',
          current_state: char.current_state || '无',
          final_state: char.final_state || '无',
          key_changes: Array.isArray(char.key_changes) ? char.key_changes : [],  // ✅ 保持数组格式
          conflicts: Array.isArray(char.conflicts) ? char.conflicts : []  // ✅ 保持数组格式
        };
      }).filter(Boolean); // 过滤掉未找到的角色

      NovelUtils.log(`AI Agent 分析出本章涉及 ${involvedCharacters.length} 个角色`, 'success');

      return involvedCharacters;

    } catch (error) {
      NovelUtils.log('AI Agent 角色分析失败，使用本地提取方案', 'error');

      // Fallback：本地提取方案
      return fallbackLocalExtraction({ characters: allCharacters }, chapter);
    }
  }

  /**
   * 备用方案：本地角色提取（当 AI Agent 失败时使用）
   */
  function fallbackLocalExtraction(outline, chapter) {
    // 收集本章涉及的角色名称（兼容多种字段名）
    const involvedNames = new Set();
    if (Array.isArray(chapter.characters_involved)) {
      involvedNames.add(...chapter.characters_involved);
    }
    if (Array.isArray(chapter.characters)) {
      involvedNames.add(...chapter.characters);
    }
    if (Array.isArray(chapter.character_list)) {
      involvedNames.add(...chapter.character_list);
    }
    if (Array.isArray(chapter.appearing_characters)) {
      involvedNames.add(...chapter.appearing_characters);
    }

    // 如果没有明确指定角色，尝试从关键事件和剧情描述中提取
    if (involvedNames.size === 0) {
      const allCharacters = Array.isArray(outline.characters) ? outline.characters : [];
      const characterNames = allCharacters.map(char => char.name || char.character_name).filter(Boolean);

      // 简单匹配：检查章节描述中是否包含角色名
      const chapterText = `${chapter.one_sentence || ''} ${chapter.expanded_paragraph || ''} ${Array.isArray(chapter.key_events) ? chapter.key_events.join(' ') : ''}`;

      characterNames.forEach(name => {
        if (chapterText.includes(name)) {
          involvedNames.add(name);
        }
      });
    }

    // 从完整角色档案中提取详细信息（包含 ID，保持数组格式）
    const involvedCharacters = [];
    const allCharacters = Array.isArray(outline.characters) ? outline.characters : [];

    allCharacters.forEach(char => {
      const charName = char.name || char.character_name;
      if (charName && involvedNames.has(charName)) {
        involvedCharacters.push({
          id: char.id,  // ✅ 添加角色唯一 ID
          name: charName,
          personality: char.personality || '未设定',
          background: char.background || '无特殊背景',
          role_in_story: char.role_in_story || '未明确',
          initial_state: char.initial_state || '无',
          current_state: char.current_state || '无',
          final_state: char.final_state || '无',
          key_changes: Array.isArray(char.key_changes) ? char.key_changes : [],  // ✅ 保持数组格式
          conflicts: Array.isArray(char.conflicts) ? char.conflicts : []  // ✅ 保持数组格式
        });
      }
    });

    NovelUtils.log(`本地提取出本章涉及 ${involvedCharacters.length} 个角色`, 'phase');

    return involvedCharacters;
  }

  return {
    analyzeCharactersAgent,
    fallbackLocalExtraction
  };
})();
