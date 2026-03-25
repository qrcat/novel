/**
 * Novelist Generation Module
 * 处理小说内容的生成（基于大纲）
 */
const NovelWriter = (function() {
  let isGenerating = false;

  /**
   * 智能判断当前应该写第几章
   * @param {Object} project - 项目对象
   * @returns {Promise<Number>} - 返回应该生成的章节号（从 1 开始）
   */
  async function detectCurrentChapter(project) {
    const outline = project.outline;
    const currentNovelText = project.novel_text || '';
    
    // 如果没有正文内容，从第 1 章开始
    if (!currentNovelText.trim()) {
      return 1;
    }
    
    // 如果有大纲但没有正文，尝试通过 AI 判断
    const settings = NovelNav.getActiveSettings();
    if (!settings.apiKey) {
      // 没有 API Key，使用简单的章节匹配
      const chapters = currentNovelText.match(/^第\s*\d+\s*章/gm) || [];
      return chapters.length + 1;
    }
    
    try {
      // 截取最后 500 字作为上下文（增加上下文长度以提高判断准确性）
      const contextText = currentNovelText.length > 500 
        ? currentNovelText.substring(currentNovelText.length - 500)
        : currentNovelText;
      
      // 构建章节信息摘要
      const chapterSummaries = outline.chapters.map((ch, idx) => 
        `第${idx + 1}章：${ch.one_sentence || ch.chapter_title || ''}`
      ).join('\n');
      
      NovelUtils.log('AI 分析当前章节进度...', 'phase');
      
      const response = await NovelAPI.call(
        [
          { 
            role: 'system', 
            content: '你是一个小说章节分析助手。根据已生成的正文内容和大纲章节概要，判断当前已经写到了第几章。只返回一个数字。' 
          },
          { 
            role: 'user', 
            content: `小说标题：${project.title}\n类型：${project.genre}\n\n大纲章节概要：\n${chapterSummaries}\n\n已生成的正文内容（最后 500 字）：\n${contextText}\n\n请判断当前已经完成了多少章？接下来应该写第几章？只回答一个数字。`
          }
        ],
        null,
        settings.model,
        settings.apiKey,
        settings.baseUrl,
        settings.provider,
        0.3,
        50
      );
      
      const result = response.choices[0].message.content.trim();
      const detectedChapter = parseInt(result.replace(/\D/g, ''));
      
      if (!isNaN(detectedChapter) && detectedChapter > 0 && detectedChapter <= outline.chapters.length) {
        NovelUtils.log(`AI 判断：当前应写第 ${detectedChapter} 章`, 'success');
        return detectedChapter;
      }
      
      // AI 判断失败，降级到简单匹配
      const chapters = currentNovelText.match(/^第\s*\d+\s*章/gm) || [];
      NovelUtils.log(`降级：检测到 ${chapters.length} 章，下一章是第 ${chapters.length + 1} 章`, 'phase');
      return chapters.length + 1;
      
    } catch (err) {
      NovelUtils.log('AI 判断失败，使用默认逻辑：' + err.message, 'error');
      const chapters = currentNovelText.match(/^第\s*\d+\s*章/gm) || [];
      return chapters.length + 1;
    }
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

    return Promise.resolve()
      .then(() => {
        // 逐章生成
        return targetChapters.reduce((chain, chapter, index) => {
          return chain.then(() => {
            // 强制重新计算章节编号，确保从 startChapter 开始连续
            const actualChapterNumber = startChapter + index;
            
            // 创建新的章节对象，使用正确的章节编号
            const chapterWithCorrectNumber = {
              ...chapter,
              chapter_number: actualChapterNumber
            };
            
            return generateChapterContent(
              title, genre, initialPrompt, outline, chapterWithCorrectNumber, novelContent, settings
            ).then(content => {
              novelContent += (novelContent ? '\n\n' : '') + content;
              currentProgress += progressStep;
              NovelUtils.setProgress(currentProgress);
              NovelUtils.log(`第${actualChapterNumber}章「${chapter.chapter_title}」完成`, 'success');
            });
          });
        }, Promise.resolve());
      })
      .then(() => {
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
      })
      .catch(err => {
        NovelUtils.log('生成失败: ' + err.message, 'error');
        NovelUtils.toast('生成失败: ' + err.message, 'error');
      })
      .finally(() => {
        isGenerating = false;
        NovelUtils.setButtonsDisabled(false);
        NovelUtils.setProgress(0);
        setTimeout(() => {
          const bar = document.getElementById('progress-bar');
          if (bar) bar.style.display = 'none';
        }, 1500);
      });
  }

  /**
   * 生成单个章节的内容
   */
  function generateChapterContent(title, genre, initialPrompt, outline, chapter, previousContent, settings) {
    const systemPrompt = `你是一位专业的网络小说作家。
小说标题：${title}
类型：${genre}
世界观：${JSON.stringify(outline.world_building || {})}
主题：${outline.theme?.theme || ''}
基调：${outline.theme?.tone || ''}

请根据章节大纲和前文内容，写出充满情感、生动有趣、符合网络文学风格的正文内容。
字数要求：800-1500字`;

    const previousSummary = previousContent 
      ? `\n\n【前文摘要】\n${previousContent.slice(-500)}` 
      : '';

    const userPrompt = `【章节信息】
章节号：${chapter.chapter_number}
章节标题：${chapter.chapter_title}
章节描述：${chapter.one_sentence}
关键事件：${Array.isArray(chapter.key_events) ? chapter.key_events.join('；') : ''}
涉及角色：${Array.isArray(chapter.characters_involved) ? chapter.characters_involved.join('；') : ''}

【故事进展】
${chapter.expanded_paragraph || chapter.one_sentence}
${previousSummary}

请写出这一章的正文内容（800-1500字）。`;

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
      0.8,  // 略高的温度以增加创意
      2000, // maxTokens，小说内容通常较长
      { type: 'text' }
    ).then(r => {
      const content = r.choices[0].message.content || '';
      
      // 格式化为章节格式
      const chapterText = `第${chapter.chapter_number}章 ${chapter.chapter_title}\n\n${content}`;
      return chapterText;
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
