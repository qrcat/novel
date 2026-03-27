/**
 * Novelist Generation Module
 * 处理小说内容的生成（基于大纲）
 */
const NovelWriter = (function() {
  let isGenerating = false;

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
    
    // 构建完整的角色档案列表（JSON 格式）
    const charactersJson = JSON.stringify(allCharacters, null, 2);
    
    // 构建章节信息
    const chapterInfo = {
      chapter_number: chapter.chapter_number,
      chapter_title: chapter.chapter_title,
      one_sentence: chapter.one_sentence,
      expanded_paragraph: chapter.expanded_paragraph,
      key_events: Array.isArray(chapter.key_events) ? chapter.key_events : [],
      characters_involved: chapter.characters_involved || [],
      characters: chapter.characters || [],
      character_list: chapter.character_list || [],
      appearing_characters: chapter.appearing_characters || []
    };
    
    // System Prompt：定义 Agent 职责
    const systemPrompt = `你是一位专业的小说编辑和角色分析师。你的任务是根据提供的完整角色档案和当前章节的大纲信息，精准识别本章涉及的所有角色。

分析规则：
1. 首先检查章节对象中明确指定的角色字段（characters_involved、characters、character_list、appearing_characters）
2. 如果这些字段为空，则基于章节描述（one_sentence、expanded_paragraph、key_events）与角色档案的姓名进行文本匹配
3. 只提取确实会在本章出场的角色，不要遗漏也不要添加无关角色
4. **只返回角色的 ID 列表**，无需重复输出角色详情`;

    // User Prompt：提供完整上下文
    const userPrompt = `【全量角色档案】
${charactersJson}

【当前章节信息】
${JSON.stringify(chapterInfo, null, 2)}

请分析本章涉及哪些角色，并返回以下 JSON 格式的结果（**只包含 ID 数组**）：
{
  "involved_character_ids": ["角色 ID1", "角色 ID2"]
}

如果没有特定角色出场，返回空数组：{"involved_character_ids": []}`;
    console.log('[Calling LLM]', systemPrompt, userPrompt);
    try {
      // 调用 LLM API 进行角色分析
      const response = await NovelAPI.call(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        null,
        settings.model,
        settings.apiKey,
        settings.baseUrl,
        settings.provider,
        0.0,  // 低温度确保分析准确性
        4000, // maxTokens，足够返回 JSON
        { type: 'text' }
      );

      const content = response.choices[0].message.content || '';
      
      console.log('AI Agent 输出:', content);
      
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
        
        console.log('清理后的内容:', cleanContent.substring(0, 200));
        
        result = JSON.parse(cleanContent);
      } catch (parseError) {
        NovelUtils.log('角色 Agent 返回格式解析失败，使用备用方案', 'warning');
        console.error('解析错误:', parseError, '原始内容:', content);
        
        // Fallback：本地提取方案
        return fallbackLocalExtraction({ characters: allCharacters }, chapter);
      }
      
      // 从 ID 列表中提取完整的角色档案信息
      const involvedIds = Array.isArray(result.involved_character_ids) ? result.involved_character_ids : [];
      
      const involvedCharacters = involvedIds.map(id => {
        // 根据 ID 查找对应的完整角色档案
        const char = allCharacters.find(c => c.id === id);
        if (!char) return null;
        
        // 返回标准化格式的角色详情
        return {
          name: char.name || char.character_name,
          personality: char.personality || '未设定',
          background: char.background || '无特殊背景',
          role_in_story: char.role_in_story || '未明确',
          initial_state: char.initial_state || '无',
          final_state: char.final_state || '无',
          key_changes: Array.isArray(char.key_changes) ? char.key_changes.join(';') : (char.key_changes || '无'),
          conflicts: Array.isArray(char.conflicts) ? char.conflicts.join(';') : (char.conflicts || '无')
        };
      }).filter(Boolean); // 过滤掉未找到的角色
      
      NovelUtils.log(`AI Agent 分析出本章涉及 ${involvedCharacters.length} 个角色`, 'success');
      console.log('角色分析结果:', involvedCharacters);
      
      return involvedCharacters;
      
    } catch (error) {
      NovelUtils.log('AI Agent 角色分析失败，使用本地提取方案', 'error');
      console.error('角色 Agent 调用失败:', error);
      
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
    
    // 从完整角色档案中提取详细信息
    const involvedCharacters = [];
    const allCharacters = Array.isArray(outline.characters) ? outline.characters : [];
    
    allCharacters.forEach(char => {
      const charName = char.name || char.character_name;
      if (charName && involvedNames.has(charName)) {
        involvedCharacters.push({
          name: charName,
          personality: char.personality || '未设定',
          background: char.background || '无特殊背景',
          role_in_story: char.role_in_story || '未明确',
          initial_state: char.initial_state || '无',
          final_state: char.final_state || '无',
          key_changes: Array.isArray(char.key_changes) ? char.key_changes.join(';') : (char.key_changes || '无'),
          conflicts: Array.isArray(char.conflicts) ? char.conflicts.join(';') : (char.conflicts || '无')
        });
      }
    });
    
    NovelUtils.log(`本地提取出本章涉及 ${involvedCharacters.length} 个角色`, 'phase');
    
    return involvedCharacters;
  }

  /**
   * 通过特殊标记智能判断当前应该写第几章
   * @param {Object} project - 项目对象
   * @returns {Number} - 返回应该生成的章节号（从 1 开始）
   */
  function detectCurrentChapter(project) {
    const currentNovelText = project.novel_text || '';
    
    // 如果没有正文内容，从第 1 章开始
    if (!currentNovelText.trim()) {
      return 1;
    }
    
    // 使用 EndOfChapter 标记统计已完成的章节数（兼容两种格式）
    // 格式 1: [EndOfChapter:1] （标准格式）
    // 格式 2: [EndOfChapter] （简化格式）
    const endMarkers = (currentNovelText.match(/\[EndOfChapter(?::\d+)?\]/g) || []);
    const completedChapters = endMarkers.length;
    
    // 下一章是已完成章节数 + 1
    const nextChapter = completedChapters + 1;
    
    NovelUtils.log(`检测到 ${completedChapters} 个完整章节，接下来应该写第 ${nextChapter} 章`, 'phase');
    console.log('当前小说内容:', currentNovelText.substring(0, 500));
    console.log('EndOfChapter 匹配结果:', endMarkers);
    
    return nextChapter;
  }

  /**
   * 生成小说内容（一段或多段）
   * @param {Number} rounds - 生成轮次（1 或 3）
   */
  async function generateRound(rounds = 1) {
    if (isGenerating) return;

    const project = NovelNav.getCurrentProject();
    if (!project) {
      NovelUtils.toast('请先打开或创建项目', 'error');
      return;
    }

    if (!project.outline || !Object.keys(project.outline).length) {
      NovelUtils.toast('请先生成大纲', 'error');
      return;
    }

    const settings = NovelNav.getActiveSettings();
    if (!settings.apiKey) {
      NovelUtils.toast('请先在设置中填入 API Key', 'error');
      return;
    }

    const outline = project.outline;
    if (!outline.chapters || !outline.chapters.length) {
      NovelUtils.toast('大纲中没有章节信息', 'error');
      return;
    }

    isGenerating = true;
    NovelUtils.setButtonsDisabled(true);
    NovelUtils.setProgress(5);
    
    // 智能判断当前章节
    const startChapter = await detectCurrentChapter(project);
    
    NovelUtils.log(`开始生成小说内容（${rounds}轮），从第 ${startChapter} 章开始...`, 'phase');

    const title = project.title || '';
    const genre = project.genre || '';
    const initialPrompt = project.initial_prompt || '';
    const currentNovel = project.novel_text || '';
    
    // 确定要写哪些章节
    const targetChapters = outline.chapters.slice(startChapter - 1, startChapter - 1 + rounds);

    if (!targetChapters.length) {
      NovelUtils.toast('所有章节已生成完毕', 'success');
      isGenerating = false;
      NovelUtils.setButtonsDisabled(false);
      return;
    }

    NovelUtils.log(`将生成第 ${startChapter} - ${startChapter + targetChapters.length - 1} 章`, 'phase');

    // 依次生成每一章
    let novelContent = currentNovel;
    let progressStep = Math.floor(90 / targetChapters.length);
    let currentProgress = 5;

    try {
      // 逐章生成
      for (let index = 0; index < targetChapters.length; index++) {
        const chapter = targetChapters[index];
        
        // 强制重新计算章节编号，确保从 startChapter 开始连续
        const actualChapterNumber = startChapter + index;
        
        // 创建新的章节对象，使用正确的章节编号
        const chapterWithCorrectNumber = {
          ...chapter,
          chapter_number: actualChapterNumber
        };
        
        const content = await generateChapterContent(
          title, genre, initialPrompt, outline, chapterWithCorrectNumber, novelContent, settings
        );
        
        novelContent += (novelContent ? '\n\n' : '') + content;
        currentProgress += progressStep;
        NovelUtils.setProgress(currentProgress);
        NovelUtils.log(`第${actualChapterNumber}章「${chapter.chapter_title}」完成`, 'success');
      }
    } catch (err) {
      NovelUtils.log('生成失败: ' + err.message, 'error');
      NovelUtils.toast('生成失败: ' + err.message, 'error');
    } finally {
      isGenerating = false;
      NovelUtils.setButtonsDisabled(false);
      NovelUtils.setProgress(0);
      setTimeout(() => {
        const bar = document.getElementById('progress-bar');
        if (bar) bar.style.display = 'none';
      }, 1500);
    }

    // 保存生成的内容
    NovelUtils.setProgress(95);
    NovelStorage.updateProject(project.id, {
      novel_text: novelContent,
      writing_chapter: startChapter + targetChapters.length - 1
    });
    
    // 重新加载最新的项目数据
    const updatedProject = NovelStorage.getProjectById(project.id);
    NovelNav.setCurrentProject(updatedProject);
    
    // 更新 UI 并切换到输出 Tab
    NovelNav.applyProjectToUI();
    NovelNav.showTab('output');
    
    // 切换到正文视图（显示 novel-container，隐藏 outline-container）
    const outlineContainer = document.getElementById('outline-container');
    const novelContainer = document.getElementById('novel-container');
    if (outlineContainer) {
      outlineContainer.classList.add('hidden');
    }
    if (novelContainer) {
      novelContainer.classList.remove('hidden');
      novelContainer.style.display = 'flex';
    }
    
    NovelUtils.log('小说内容已保存', 'success');
    NovelUtils.toast(`成功生成 ${targetChapters.length} 章内容`, 'success');

  }

  /**
   * 生成单个章节的内容
   */
  async function generateChapterContent(title, genre, initialPrompt, outline, chapter, previousContent, settings) {
    // 使用专门的 Agent 分析本章涉及的角色详情
    const involvedCharacters = await analyzeCharactersAgent(outline, chapter, settings);
    
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
    const worldBuilding = outline.world_building || {};
    const worldBuildingText = Object.keys(worldBuilding).length > 0 
      ? `时代背景：${worldBuilding.time_period || '未指定'}
世界地点：${Array.isArray(worldBuilding.locations) ? worldBuilding.locations.join('、') : (worldBuilding.location || '未指定')}
氛围基调：${worldBuilding.tone || worldBuilding.atmosphere || '未指定'}
世界规则：${Array.isArray(worldBuilding.rules_of_world) ? worldBuilding.rules_of_world.join(':') : (worldBuilding.rules_of_world || '无特殊规则')}
其他设定：${worldBuilding.other_settings || '无'}`
      : '暂无详细世界观设定';

    const previousSummary = previousContent 
      ? `\n\n【前文摘要】\n${previousContent.slice(-500)}` 
      : '';

    const userPrompt = `【作品信息】
小说标题：${title}
类型：${genre}

【世界观设定】
${worldBuildingText}

【故事主题】
主题：${outline.theme?.theme || '未指定'}
基调：${outline.theme?.tone || '未指定'}

【本章出场角色详情（经 Agent 分析）】
${charactersDetailText}

【章节信息】
章节号：${chapter.chapter_number}
章节标题：${chapter.chapter_title}
章节描述：${chapter.one_sentence}
关键事件：${Array.isArray(chapter.key_events) ? chapter.key_events.join(':') : ''}

【故事进展】
${chapter.expanded_paragraph || chapter.one_sentence}
${previousSummary}

请写出这一章的正文内容（800-1500 字）。如果遇到章节开始，请先输出：第 x 章`;
    console.log('[Calling LLM]', systemPrompt, userPrompt);

    // 如果启用了角色 Agent，则使用 tool call 模式
    if (settings.characterAgentEnabled) {
      return generateWithCharacterAgent(
        systemPrompt, 
        userPrompt, 
        involvedCharacters, 
        settings
      );
    } else {
      // 不使用 tool call，直接生成
      return NovelAPI.call(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        null,
        settings.model,
        settings.apiKey,
        settings.baseUrl,
        settings.provider,
        1.0,  // 略高的温度以增加创意
        10000, // maxTokens，小说内容通常较长
        { type: 'text' }
      ).then(r => {
        const content = r.choices[0].message.content || '';
        
        // AI 已在 System Prompt 指导下添加了章节标记，直接返回即可
        return content;
      });
    }
  }

  /**
   * 使用角色 Agent 生成章节内容（带 tool call）
   */
  async function generateWithCharacterAgent(systemPrompt, userPrompt, involvedCharacters, settings) {
    NovelUtils.log('启用角色 Agent 进行创作...', 'phase');
    
    // 增强 System Prompt：明确指示只输出小说正文
    const enhancedSystemPrompt = `${systemPrompt}

【重要写作规范】
1. **只输出小说正文内容** - 直接开始写故事，不要输出任何思考过程、查询说明或元描述
2. **禁止输出的内容**：
   - ❌ "我来查询..."、"现在查询..."、"接下来查询..."等查询说明
   - ❌ "以便更好地描写..."、"为了..."等写作意图说明
   - ❌ "最后查询..."、"首先..."等步骤描述
   - ❌ 任何关于你将如何写作的解释性文字
3. **正确格式**：
   - ✅ 直接从章节标题或正文开始："第 x 章 xxx"或直接进入场景描写
   - ✅ 如果需要查询角色行为，请直接调用工具，无需在正文中说明
   - ✅ 工具调用是隐式的，不应该出现在最终的小说文本中
4. **多轮协作说明**：
   - 你可以多次调用查询工具来获取角色的详细反应
   - 每次调用后，请基于查询结果继续写正文
   - 当你完成所有章节内容后，停止调用工具并结束

记住：你的输出就是最终的小说文本，读者会直接看到你写的内容，所以不要包含任何写作过程的说明。`;

    // 定义角色查询工具
    const characterTools = [{
      type: 'function',
      function: {
        name: 'query_character_behavior',
        description: '查询指定角色在当前情境下会做出的行为、对话或心理活动。当你需要描写角色的具体反应、表情、动作、语言或内心想法时使用此工具。',
        parameters: {
          type: 'object',
          properties: {
            character_name: {
              type: 'string',
              description: '要查询的角色名称'
            },
            situation: {
              type: 'string',
              description: '当前情境描述，例如"听到这个消息后"、"面对敌人的挑衅时"'
            },
            query_type: {
              type: 'string',
              enum: ['behavior', 'dialogue', 'psychology'],
              description: '查询类型：behavior=行为反应，dialogue=语言回应，psychology=心理活动'
            }
          },
          required: ['character_name', 'situation', 'query_type']
        }
      }
    }];

    // 构建包含角色档案的完整消息
    const messages = [
      { role: 'system', content: enhancedSystemPrompt },
      { role: 'user', content: userPrompt }
    ];
    console.log('[Calling LLM]', enhancedSystemPrompt, userPrompt)
    // 添加角色档案到 system prompt 的上下文中
    const characterProfiles = involvedCharacters.map(char => ({
      name: char.name,
      personality: char.personality,
      background: char.background,
      role_in_story: char.role_in_story,
      initial_state: char.initial_state,
      final_state: char.final_state,
      key_changes: char.key_changes,
      conflicts: char.conflicts
    }));

    let roundCount = 0;
    const maxRounds = settings.characterAgentMaxRounds || 10;  // 从设置中读取最大轮次
    let hasToolCalls = true;
    let novelContent = '';  // 累加正文内容

    // 多轮循环处理，直到 AI 不再返回 tool_calls
    while (hasToolCalls && roundCount < maxRounds) {
      roundCount++;
      NovelUtils.log(`开始第 ${roundCount} 轮创作...`, 'phase');

      // 调用 LLM（始终传递 tools，让 AI 可以继续触发新的查询）
      const response = await NovelAPI.call(
        messages,
        characterTools,  // 保持传递 tools，支持连续查询
        settings.model,
        settings.apiKey,
        settings.baseUrl,
        settings.provider,
        1.0,
        10000,
        { type: 'text' }
      );

      const assistantMessage = response.choices[0].message;
      
      // 检查是否有工具调用
      hasToolCalls = assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0;
      
      if (hasToolCalls) {
        NovelUtils.log(`第${roundCount}轮：检测到 ${assistantMessage.tool_calls.length} 个角色查询请求`, 'phase');
        
        // 累加本轮 AI 生成的正文内容（如果有）
        if (assistantMessage.content) {
          novelContent += assistantMessage.content;
          NovelUtils.log(`已累加本轮正文内容 (${assistantMessage.content.length} 字)`, 'phase');
        }
        
        // 将 AI 的回复添加到消息历史
        messages.push(assistantMessage);
        
        // 处理每个工具调用
        for (const toolCall of assistantMessage.tool_calls) {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            const characterName = args.character_name;
            const situation = args.situation;
            const queryType = args.query_type;
            
            NovelUtils.log(`查询角色 "${characterName}" 的${queryType}：${situation}`, 'phase');
            
            // 在角色档案中查找该角色
            const character = characterProfiles.find(c => c.name === characterName);
            
            if (!character) {
              // 角色不存在，返回错误（使用 tool 消息格式）
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: `查询失败：未找到角色 "${characterName}"。可用角色：${characterProfiles.map(c => c.name).join(', ')}`
              });
              continue;
            }
            
            // 基于角色设定生成合理的反应
            const behaviorResponse = await generateCharacterResponse(
              character,
              situation,
              queryType,
              settings
            );
            
            // 将工具调用结果添加到消息历史（使用标准的 tool 消息格式）
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: `${characterName}在"${situation}"下的${get_query_type_name(queryType)}：${behaviorResponse}`
            });
            

            NovelUtils.log(`获取到 "${characterName}" 的反应 ${behaviorResponse}`, 'success');
            
          } catch (error) {
            NovelUtils.log('解析工具调用参数失败：' + error.message, 'error');
            // 解析失败时也使用 tool 消息格式
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: `解析失败：${error.message}。请使用正确的 JSON 格式。`
            });
          }
        }
        
        NovelUtils.log(`第${roundCount}轮：所有工具调用已处理，继续下一轮...`, 'phase');
        
      } else {
        // 没有工具调用了，AI 已经完成了正文创作
        NovelUtils.log(`第${roundCount}轮：未检测到工具调用，创作完成`, 'success');
        
        // 累加最后一轮的完整正文内容
        if (assistantMessage.content) {
          novelContent += assistantMessage.content;
          NovelUtils.log(`已累加最终正文内容 (${assistantMessage.content.length} 字)`, 'success');

        }
      }
    }

    // 检查是否超过最大轮次
    if (roundCount >= maxRounds) {
      NovelUtils.log(`警告：达到最大轮次限制 (${maxRounds})，强制结束`, 'warning');
    }

    // 验证是否成功累加了内容
    if (!novelContent.trim()) {
      NovelUtils.log('警告：未累加到任何正文内容，使用最后一轮响应', 'warning');
      return messages[messages.length - 1]?.content || '';
    }

    NovelUtils.log(`角色辅助创作完成，共执行 ${roundCount} 轮，累计 ${novelContent.length} 字`, 'success');
    
    return novelContent;
  }

  /**
   * 根据角色设定生成具体的行为/对话/心理反应
   */
  async function generateCharacterResponse(character, situation, queryType, settings) {
    const queryTypeNames = {
      'behavior': '行为反应',
      'dialogue': '语言回应',
      'psychology': '心理活动'
    };

    const charSystemPrompt = `你是一位专业的角色扮演与人物塑造助手，擅长基于既定人物设定，生成高度符合人设的行为与心理反应。

你的任务：严格代入指定角色，从其立场、性格与经历出发，对给定情境做出真实且一致的反应。

【角色档案】
姓名：${character.name}
- 性格特征：${character.personality}
- 背景经历：${character.background}
- 故事定位：${character.role_in_story}
- 初始状态：${character.initial_state}
- 最终状态：${character.final_state}
- 关键转变：${character.key_changes}
- 内心冲突：${character.conflicts}

【任务要求】
请基于以上设定，模拟该角色在特定情境下如何${queryTypeNames[queryType]}。

【生成要求】
1. 严格符合角色性格与背景，不得出现违背人设的行为或语言
2. 反应需体现角色的内在动机与情绪逻辑
3. 可包含心理活动、细节描写或简短动作描写，使表现更真实生动
4. 避免泛泛而谈或脱离情境的描述
5. 保持叙述连贯自然，具有一定表现力（但避免过度华丽或冗长）

请直接输出角色的反应内容，不要添加额外解释或说明。`;

    const charUserPrompt = `情境：${situation}

请用简洁的语言描述${character.name}在这种情况下会如何${queryTypeNames[queryType]}（50-100 字）。`;
    console.log('[Calling LLM]', charSystemPrompt, charUserPrompt);

    try {
      const response = await NovelAPI.call(
        [
          { role: 'system', content: charSystemPrompt },
          { role: 'user', content: charUserPrompt }
        ],
        null,
        settings.model,
        settings.apiKey,
        settings.baseUrl,
        settings.provider,
        0.8,  // 适中的温度
        1000,  // 不需要太长
        { type: 'text' }
      );
      console.log('[LLM Response]', response.choices[0].message.content);
      return response.choices[0].message.content || '无法确定反应';
    } catch (error) {
      NovelUtils.log('生成角色反应失败：' + error.message, 'error');
      return '（因技术原因无法获取详细反应）';
    }
  }

  /**
   * 获取查询类型的中文名称
   */
  function get_query_type_name(queryType) {
    const names = {
      'behavior': '行为反应',
      'dialogue': '语言回应',
      'psychology': '心理活动'
    };
    return names[queryType] || queryType;
  }

  return {
    generateRound,
    generateChapterContent,
    detectCurrentChapter
  };
})();

// 全局函数供 HTML onclick 使用
function generateRound() {
  const btn = event?.target;
  const rounds = btn?.id === 'btn-round2' ? 3 : 1;
  NovelWriter.generateRound(rounds);
}
