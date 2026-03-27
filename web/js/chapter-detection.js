/**
 * Chapter Detection Module
 * 负责检测当前章节进度
 */
const NovelWriterChapterDetection = (function () {
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

    return nextChapter;
  }

  return {
    detectCurrentChapter
  };
})();
