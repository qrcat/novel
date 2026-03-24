/**
 * Novelist Generation Module
 * 处理小说内容的生成（基于大纲）
 */
const NovelWriter = (function() {
  let isGenerating = false;

  /**
   * 生成小说内容（一段或多段）
   * @param {Number} rounds - 生成轮次（1 或 3）
   */
  function generateRound(rounds = 1) {
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
    NovelUtils.log(`开始生成小说内容（${rounds}轮）...`, 'phase');
    NovelUtils.setProgress(5);

    const title = project.title || '';
    const genre = project.genre || '';
    const initialPrompt = project.initial_prompt || '';
    const currentNovel = project.novel_text || '';
    
    // 确定要写哪一章（简单逻辑：找第一个还未生成的章节，或继续最后一章）
    const generatedCount = currentNovel ? (currentNovel.match(/^第\s*\d+\s*章/gm) || []).length : 0;
    const targetChapters = outline.chapters.slice(generatedCount, generatedCount + rounds);

    if (!targetChapters.length) {
      NovelUtils.toast('所有章节已生成完毕', 'success');
      isGenerating = false;
      NovelUtils.setButtonsDisabled(false);
      return;
    }

    NovelUtils.log(`将生成第 ${generatedCount + 1} - ${generatedCount + targetChapters.length} 章`, 'phase');

    // 依次生成每一章
    let novelContent = currentNovel;
    let progressStep = Math.floor(90 / targetChapters.length);
    let currentProgress = 5;

    return Promise.resolve()
      .then(() => {
        // 逐章生成
        return targetChapters.reduce((chain, chapter, index) => {
          return chain.then(() => {
            return generateChapterContent(
              title, genre, initialPrompt, outline, chapter, novelContent, settings
            ).then(content => {
              novelContent += (novelContent ? '\n\n' : '') + content;
              currentProgress += progressStep;
              NovelUtils.setProgress(currentProgress);
              NovelUtils.log(`第 ${generatedCount + index + 1} 章完成`, 'success');
            });
          });
        }, Promise.resolve());
      })
      .then(() => {
        // 保存生成的内容
        NovelUtils.setProgress(95);
        NovelStorage.updateProject(project.id, {
          novel_text: novelContent,
          writing_chapter: generatedCount + targetChapters.length
        });
        
        // 更新UI
        NovelNav.applyProjectToUI();
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
    generateChapterContent
  };
})();

// 全局函数供 HTML onclick 使用
function generateRound() {
  const btn = event?.target;
  const rounds = btn?.id === 'btn-round2' ? 3 : 1;
  NovelWriter.generateRound(rounds);
}
