/**
 * Novelist Generation Module (Main Entry)
 * 处理小说内容的生成（基于大纲）
 * 
 * 依赖模块:
 * - NovelWriterCharacterAgent: 角色分析 Agent
 * - NovelWriterCharacterReaction: 角色反应收集
 * - NovelWriterCharacterUpdate: 角色档案更新
 * - NovelWriterOutlineModification: 大纲修改 Agent
 * - NovelWriterGenerator: 小说正文生成
 * - NovelWriterChapterDetection: 章节检测
 */
const NovelWriter = (function () {
  let isGenerating = false;

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
    const startChapter = await NovelWriterChapterDetection.detectCurrentChapter(project);

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

        if (settings.allowAgentEditCharacter) {
          NovelUtils.log('=== 分析正文并调整后续大纲 ===', 'phase');
          NovelWriterOutlineModification.modifyOutlineFromNovel(
            content,
            outline,
            chapter,
            settings
          );
        }

        novelContent += (novelContent ? '\n\n' : '') + content;
        currentProgress += progressStep;
        NovelUtils.setProgress(currentProgress);
        NovelUtils.log(`第${actualChapterNumber}章「${chapter.chapter_title}」完成`, 'success');
      }
    } catch (err) {
      NovelUtils.log('生成失败：' + err.message, 'error');
      NovelUtils.toast('生成失败：' + err.message, 'error');
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
    // 获取当前项目信息
    const currentProject = NovelNav.getCurrentProject();

    // 使用专门的 Agent 分析本章涉及的角色详情
    const involvedCharacters = await NovelWriterCharacterAgent.analyzeCharactersAgent(outline, chapter, settings);

    // 如果启用了角色 Agent，则使用 tool call 模式
    if (settings.characterAgentEnabled) {
      return NovelWriterGenerator.generateWithCharacterAgent(
        involvedCharacters,
        chapter,
        previousContent,
        settings
      );
    } else {
      // 不使用 tool call，直接生成
      return NovelWriterGenerator.generateNovelDirectly(
        involvedCharacters, 
        chapter, 
        previousContent, 
        settings
      );
    }
  }

  return {
    generateRound,
    generateChapterContent,
    detectCurrentChapter: NovelWriterChapterDetection.detectCurrentChapter
  };
})();

// 全局函数供 HTML onclick 使用
window.generateRound = function () {
  const btn = event?.target;
  const rounds = btn?.id === 'btn-round2' ? 3 : 1;
  NovelWriter.generateRound(rounds);
};
