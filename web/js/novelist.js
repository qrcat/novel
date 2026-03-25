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
        2000, // maxTokens，足够返回 JSON
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
      5000, // maxTokens，小说内容通常较长
      { type: 'text' }
    ).then(r => {
      const content = r.choices[0].message.content || '';
      
      // AI 已在 System Prompt 指导下添加了章节标记，直接返回即可
      return content;
    });
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
