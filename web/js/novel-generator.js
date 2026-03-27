/**
 * Novel Generator Module
 * 负责小说正文的生成（直接模式和角色 Agent 模式）
 */
const NovelWriterGenerator = (function () {
  /**
   * 直接生成小说正文（不使用工具调用）
   * @param {Array} involvedCharacters - 涉及的角色列表
   * @param {Object} chapter - 章节对象
   * @param {string} previousContent - 前文内容
   * @param {Object} settings - API 设置
   * @returns {Promise<string>} - 生成的小说正文内容
   */
  async function generateNovelDirectly(involvedCharacters, chapter, previousContent, settings) {
    NovelUtils.log('使用直接生成模式创作正文...', 'phase');

    // 获取当前项目信息
    const currentProject = NovelNav.getCurrentProject();

    // 格式化角色详情为易读的文本
    const charactersDetailText = involvedCharacters.length > 0
      ? involvedCharacters.map(char =>
        `【${char.name}】
• 性格：${char.personality}
• 背景：${char.background}
• 故事中的角色：${char.role_in_story}
• 初始状态：${char.initial_state}
• 最终状态：${char.final_state}
• 关键变化：${char.key_changes}
• 内心冲突：${char.conflicts}`
      ).join('\n\n')
      : '本章无特定角色出场';

    const systemPrompt = `你是一位专业的网络小说作家，擅长创作充满情感、生动有趣、符合网络文学风格的作品。

请根据提供的小说背景设定和章节大纲，写出充满情感、生动有趣、符合网络文学风格的正文内容。

写作要求：
1. 严格遵循提供的世界观设定和角色性格
2. 确保情节连贯，符合整体故事走向
3. 角色行为要符合其性格特征和动机
4. 字数要求：800-1500 字
5. 格式要求：请在章节内容的开头和结尾分别添加特殊标记 [StartOfChapter:N] 和 [EndOfChapter:N]（N 为章节号），用于系统自动识别章节边界`;

    // 格式化世界观信息为易读的文本
    const outline = currentProject?.outline || {};
    const worldBuilding = outline.world_building || {};
    const worldBuildingText = Object.keys(worldBuilding).length > 0
      ? `时代背景：${worldBuilding.time_period || '未指定'}
世界地点：${Array.isArray(worldBuilding.locations) ? worldBuilding.locations.join(',') : (worldBuilding.location || '未指定')}
氛围基调：${worldBuilding.tone || worldBuilding.atmosphere || '未指定'}
世界规则：${Array.isArray(worldBuilding.rules_of_world) ? worldBuilding.rules_of_world.join(':') : (worldBuilding.rules_of_world || '无特殊规则')}
其他设定：${worldBuilding.other_settings || '无'}`
      : '暂无详细世界观设定';

    // 提取章节信息
    const chapterInfo = {
      chapterNumber: chapter.chapter_number,
      chapterTitle: chapter.chapter_title,
      chapterDesc: chapter.one_sentence,
      keyEvents: Array.isArray(chapter.key_events) ? chapter.key_events.join('.') : '',
      storyProgress: chapter.expanded_paragraph || chapter.one_sentence
    };

    // 构建前文摘要（最后 500 字）
    const previousSummary = previousContent
      ? `\n【前文摘要】\n${previousContent.slice(-500)}`
      : '';

    // 创建全新的 User Prompt（完全重写，不依赖外部 userPrompt）
    const writeUserPrompt = `【作品信息】
小说标题：${currentProject?.title || settings.title || '未指定'}
类型：${settings.genre || '未指定'}

【世界观设定】
${worldBuildingText}

【故事主题】
主题：${outline.theme?.theme || '未指定'}
基调：${outline.theme?.tone || '未指定'}

【本章出场角色详情】
${charactersDetailText}

【章节信息】
章节号：${chapterInfo.chapterNumber}
章节标题：${chapterInfo.chapterTitle}
章节描述：${chapterInfo.chapterDesc}
关键事件：${chapterInfo.keyEvents}

【故事进展】
${chapterInfo.storyProgress}${previousSummary}

【创作任务】
请基于以上所有信息，撰写本章的小说正文（800-1500 字）。

【输出格式要求】
- 章节开始标记：[StartOfChapter:${chapterInfo.chapterNumber}]
- 紧接着输出：第${chapterInfo.chapterNumber}章 ${chapterInfo.chapterTitle}
- 然后直接开始正文内容
- 章节结束标记：[EndOfChapter:${chapterInfo.chapterNumber}]

【重要提示】
- 将收集到的角色反应自然融入情节发展，不要生硬插入
- 确保所有角色的行为、对话、心理活动符合其档案设定
- 保持叙事流畅，情感真挚，符合网络文学风格
- 如有前文摘要，请确保剧情连贯衔接`;

    // 构建消息数组
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: writeUserPrompt }
    ];

    return NovelAPI.call(
      messages,
      null,  // 不需要工具
      settings.model,
      settings.apiKey,
      settings.baseUrl,
      settings.provider,
      1.0,  // 略高的温度以增加创意
      8192, // maxTokens，小说内容通常较长
      { type: 'text' }
    ).then(r => {
      const content = r.choices[0].message.content || '';

      NovelUtils.log(`创作完成，生成 ${content.length} 字`, 'success');

      return content;
    });
  }

  /**
   * 第二阶段：基于收集到的角色反应创作正文
   * @param {Object} chapter - 章节对象
   * @param {Array} characterProfiles - 角色档案列表
   * @param {Array} characterReactions - 收集到的角色反应列表
   * @param {string} previousContent - 前文内容
   * @param {Object} settings - API 设置
   */
  async function writeNovelWithReactions(chapter, characterProfiles, characterReactions, previousContent, settings) {
    // 获取当前项目的完整信息（包括世界观、主题等）
    const currentProject = NovelNav.getCurrentProject();
    const outline = currentProject?.outline || {};

    // 格式化世界观信息
    const worldBuilding = outline.world_building || {};
    const worldBuildingText = Object.keys(worldBuilding).length > 0
      ? `时代背景：${worldBuilding.time_period || '未指定'}
世界地点：${Array.isArray(worldBuilding.locations) ? worldBuilding.locations.join(',') : (worldBuilding.location || '未指定')}
氛围基调：${worldBuilding.tone || worldBuilding.atmosphere || '未指定'}
世界规则：${Array.isArray(worldBuilding.rules_of_world) ? worldBuilding.rules_of_world.join(';') : (worldBuilding.rules_of_world || '无特殊规则')}
其他设定：${worldBuilding.other_settings || '无'}`
      : '暂无详细世界观设定';

    // 创建专门用于小说创作的 System Prompt
    const writeSystemPrompt = `你是一位专业的小说作家，负责基于已收集的角色反应信息创作小说正文。

【小说创作规范】
1. 只输出小说正文 - 直接开始写故事，不要输出任何思考过程或元描述
2. 利用角色反应 - 基于提供的角色反应信息，自然地融入正文
3. 禁止输出的内容：
   - ❌ "我来查询..."、"根据查询..."等说明性文字
   - ❌ 任何关于写作过程的解释
   - ✅ 直接从章节标题或场景描写开始
4. 创作要求：
   - 将收集到的角色反应自然地融入到情节发展中
   - 保持叙事流畅，不要生硬地插入反应
   - 确保角色的行为、对话、心理活动符合其设定
5. 格式要求：请在章节内容的开头和结尾分别添加特殊标记 [StartOfChapter:N] 和 [EndOfChapter:N]（N 为章节号），用于系统自动识别章节边界

记住：你的输出就是最终的小说文本，读者会直接看到。`;

    // 构建角色档案上下文（包含 ID）
    const charactersContext = characterProfiles.map(char => {
      const keyChangesText = Array.isArray(char.key_changes) && char.key_changes.length > 0
        ? `\n  - 关键成长：${char.key_changes.join(';')}`
        : '';

      const conflictsText = Array.isArray(char.conflicts) && char.conflicts.length > 0
        ? `\n  - 内心冲突：${char.conflicts.join(';')}`
        : '';

      return `【${char.name}】
  - 性格：${char.personality || '待补充'}
  - 背景：${char.background || '待补充'}
  - 故事定位：${char.role_in_story || '未明确'}
  - 初始状态：${char.initial_state || '未设定'}
  - 当前状态：${char.current_state || '未设定'}
  - 最终状态：${char.final_state || '未设定'}${keyChangesText}${conflictsText}`;
    }).join('\n\n');

    // 构建角色反应上下文
    const reactionsContext = characterReactions && characterReactions.length > 0
      ? `\n【已收集的角色反应】\n${characterReactions.map((r, i) =>
        `${i + 1}. **${r.characterName}** (${NovelWriterCharacterReaction.get_query_type_name(r.queryType)})在"${r.situation}"下：${r.response}`
      ).join('\n')}\n`
      : '\n【无额外角色反应，请基于角色档案自由创作】\n';

    // 提取章节信息
    const chapterInfo = {
      chapterNumber: chapter.chapter_number,
      chapterTitle: chapter.chapter_title,
      chapterDesc: chapter.one_sentence,
      keyEvents: Array.isArray(chapter.key_events) ? chapter.key_events.join('.') : '',
      storyProgress: chapter.expanded_paragraph || chapter.one_sentence
    };

    // 构建前文摘要（最后 500 字）
    const previousSummary = previousContent
      ? `\n【前文摘要】\n${previousContent.slice(-500)}`
      : '';

    // 创建全新的 User Prompt（完全重写，不依赖外部 userPrompt）
    const writeUserPrompt = `【作品信息】
小说标题：${currentProject?.title || settings.title || '未指定'}
类型：${settings.genre || '未指定'}

【世界观设定】
${worldBuildingText}

【故事主题】
主题：${outline.theme?.theme || '未指定'}
基调：${outline.theme?.tone || '未指定'}

【本章出场角色详情】
${charactersContext}

【章节信息】
章节号：${chapterInfo.chapterNumber}
章节标题：${chapterInfo.chapterTitle}
章节描述：${chapterInfo.chapterDesc}
关键事件：${chapterInfo.keyEvents}

【故事进展】
${chapterInfo.storyProgress}${previousSummary}

${reactionsContext}

【创作任务】
请基于以上所有信息，撰写本章的小说正文（800-1500 字）。

【输出格式要求】
- 章节开始标记：[StartOfChapter:${chapterInfo.chapterNumber}]
- 紧接着输出：第${chapterInfo.chapterNumber}章 ${chapterInfo.chapterTitle}
- 然后直接开始正文内容
- 章节结束标记：[EndOfChapter:${chapterInfo.chapterNumber}]

【重要提示】
- 将收集到的角色反应自然融入情节发展，不要生硬插入
- 确保所有角色的行为、对话、心理活动符合其档案设定
- 保持叙事流畅，情感真挚，符合网络文学风格
- 如有前文摘要，请确保剧情连贯衔接`;

    // 调用 LLM 进行创作（不需要工具）
    const messages = [
      { role: 'system', content: writeSystemPrompt },
      { role: 'user', content: writeUserPrompt }
    ];

    NovelUtils.log('开始基于角色反应创作正文...', 'phase');

    const response = await NovelAPI.call(
      messages,
      [],  // 不需要工具，纯创作
      settings.model,
      settings.apiKey,
      settings.baseUrl,
      settings.provider,
      1.5,
      8192,
      { type: 'text' }
    );

    const novelContent = response.choices[0].message.content || '';

    NovelUtils.log(`正文创作完成，共 ${novelContent.length} 字`, 'success');
    return novelContent;
  }

  /**
   * 使用角色 Agent 进行创作（包含两个阶段）：
   * 第一阶段：收集所有角色反应
   * 第二阶段：基于角色反应创作正文
   * 第三阶段：基于生成的正文更新角色档案
   */
  async function generateWithCharacterAgent(involvedCharacters, chapter, previousContent, settings) {
    NovelUtils.log('启用角色 Agent 进行创作...', 'phase');

    // 准备角色档案数据
    const characterProfiles = involvedCharacters.map(char => ({
      id: char.id,
      name: char.name,
      personality: char.personality,
      background: char.background,
      role_in_story: char.role_in_story,
      initial_state: char.initial_state,
      current_state: char.current_state,
      final_state: char.final_state,
      key_changes: char.key_changes,
      conflicts: char.conflicts
    }));

    // ========== 第一阶段：收集所有角色反应 ==========
    NovelUtils.log('=== 第一阶段：收集角色反应 ===', 'phase');

    let characterReactions = [];
    try {
      characterReactions = await NovelWriterCharacterReaction.collectCharacterReactions(
        chapter,
        characterProfiles,
        settings
      );
    } catch (error) {
      NovelUtils.log(`角色反应收集失败：${error.message}`, 'error');
      NovelUtils.log('跳过反应收集阶段，直接进入正文创作', 'warning');
      characterReactions = []; // 使用空数组继续执行
    }

    NovelUtils.log(`第一阶段完成，共收集 ${characterReactions.length} 个角色反应`, 'success');

    // ========== 第二阶段：基于角色反应进行创作 ==========
    NovelUtils.log('=== 第二阶段：基于角色反应创作正文 ===', 'phase');
    const novelContent = await writeNovelWithReactions(
      chapter,
      characterProfiles,
      characterReactions,
      previousContent,
      settings
    );

    NovelUtils.log(`创作完成，生成 ${novelContent.length} 字`, 'success');

    // ========== 第三阶段：基于生成的正文更新角色档案 ==========
    if (settings.allowAgentEditCharacter) {
      NovelUtils.log('=== 第三阶段：分析正文并更新角色档案 ===', 'phase');
      await NovelWriterCharacterUpdate.updateCharactersFromNovel(
        novelContent,
        characterProfiles,
        chapter,
        settings
      );
    } else {
      NovelUtils.log('未启用角色更新', 'phase');
    }

    return novelContent;
  }

  return {
    generateNovelDirectly,
    writeNovelWithReactions,
    generateWithCharacterAgent
  };
})();
