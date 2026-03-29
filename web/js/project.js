/**
 * Project Management Module
 * 处理项目的CRUD操作
 */
const NovelProject = (function() {
  /**
   * 创建新项目
   */
  function createProject(data) {
    // 获取全局设置中的 API 配置
    const settings = NovelStorage.getSettings();
    const activeProvider = NovelStorage.getActiveProvider();
    const providerConfig = NovelStorage.getProviderConfig(activeProvider);
    const provider = NovelProviders.getProvider(activeProvider);
    
    // 优先从多提供商配置读取，否则回退到旧设置
    const apiKey = providerConfig.apiKey || settings.api_key || '';
    const baseUrl = providerConfig.baseUrl || settings.base_url || (provider ? provider.baseUrl : 'https://dashscope.aliyuncs.com/compatible-mode/v1');
    const model = providerConfig.model || settings.model || (provider ? provider.defaultModel : 'qwen-plus');
    const temperature = settings.temperature || 0.8;

    const project = {
      id: NovelUtils.uuid(),
      title: data.title,
      genre: data.genre,
      initial_prompt: data.initial_prompt,
      outline: null,
      characters: [],
      novel_text: '',
      conv_history: [],
      writing_chapter: 1,
      current_scene: '',
      updated_at: new Date().toISOString()
    };

    NovelStorage.addProject(project);
    return project;
  }

  /**
   * 编辑项目基本信息
   */
  function editProject(projectId, data) {
    return NovelStorage.updateProject(projectId, {
      title: data.title,
      genre: data.genre,
      initial_prompt: data.initial_prompt
    });
  }

  /**
   * 删除项目
   */
  function deleteProject(projectId) {
    NovelStorage.deleteProject(projectId);
  }

  /**
   * 导出项目为 JSON
   */
  function exportProject(project) {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (project.title || 'novel') + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * 保存正文为 TXT 文件
   */
  function saveNovelTextAsTxt(project) {
    if (!project) return;
    if (!project.novel_text) {
      NovelUtils.toast('还没有正文内容', 'error');
      return;
    }
    const blob = new Blob([project.novel_text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (project.title || 'novel') + '.txt';
    a.click();
    URL.revokeObjectURL(url);
    NovelUtils.toast('正文已保存为 TXT 文件');
  }

  /**
   * 添加字符到项目
   */
  function addCharacter(projectId, character) {
    const project = NovelStorage.getProjectById(projectId);
    if (!project) return;

    if (!project.characters) project.characters = [];
    character.id = character.id || NovelUtils.uuid();
    project.characters.push(character);
    NovelStorage.updateProject(projectId, { characters: project.characters });
    return character;
  }

  /**
   * 更新字符
   */
  function updateCharacter(projectId, characterId, updates) {
    const project = NovelStorage.getProjectById(projectId);
    if (!project) return;

    const index = (project.characters || []).findIndex(c => 
      (c.id || c.character_name || c.name) === characterId
    );
    if (index >= 0) {
      project.characters[index] = { ...project.characters[index], ...updates };
      NovelStorage.updateProject(projectId, { characters: project.characters });
      return project.characters[index];
    }
    return null;
  }

  /**
   * 删除字符
   */
  function deleteCharacter(projectId, characterId) {
    const project = NovelStorage.getProjectById(projectId);
    if (!project) return;

    project.characters = (project.characters || []).filter(c => 
      (c.id || c.character_name || c.name) !== characterId
    );
    NovelStorage.updateProject(projectId, { characters: project.characters });
  }

  /**
   * 更新项目大纲
   */
  function updateOutline(projectId, outline) {
    return NovelStorage.updateProject(projectId, { outline });
  }

  /**
   * 更新项目小说文本
   */
  function appendNovelText(projectId, text) {
    const project = NovelStorage.getProjectById(projectId);
    if (!project) return;
    project.novel_text = (project.novel_text || '') + '\n==========\n' + text + '\n==========\n';
    return NovelStorage.updateProject(projectId, { novel_text: project.novel_text });
  }

  /**
   * 推进章节
   */
  function nextChapter(projectId) {
    const project = NovelStorage.getProjectById(projectId);
    if (!project) return;
    project.writing_chapter = (project.writing_chapter || 1) + 1;
    return NovelStorage.updateProject(projectId, { writing_chapter: project.writing_chapter });
  }

  /**
   * 添加对话记录
   */
  function addConversationHistory(projectId, entry) {
    const project = NovelStorage.getProjectById(projectId);
    if (!project) return;
    if (!project.conv_history) project.conv_history = [];
    project.conv_history.push(entry);
    NovelStorage.updateProject(projectId, { conv_history: project.conv_history });
  }

  return {
    createProject,
    editProject,
    deleteProject,
    exportProject,
    saveNovelTextAsTxt,
    addCharacter,
    updateCharacter,
    deleteCharacter,
    updateOutline,
    appendNovelText,
    nextChapter,
    addConversationHistory
  };
})();
