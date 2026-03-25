/**
 * UI Module
 * 处理所有UI操作和事件绑定
 */
const NovelUI = (function() {
  /**
   * 显示创建项目的弹窗
   */
  function showCreateModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.remove('hidden');
  }

  /**
   * 关闭弹窗
   */
  function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  /**
   * 处理新项目创建表单提交
   */
  function handleCreateProject(formData) {
    const project = NovelProject.createProject({
      title: formData.get('title'),
      genre: formData.get('genre'),
      initial_prompt: formData.get('initial_prompt'),
      api_key: formData.get('api_key') || '',
      base_url: formData.get('base_url') || '',
      model: formData.get('model') || '',
      temperature: parseFloat(formData.get('temperature') || 0.8)
    });

    NovelUtils.toast('项目已创建');
    closeModal();
    NovelNav.openProject(project.id);
  }

  /**
   * 处理项目编辑
   */
  function handleEditProject(formData) {
    const project = NovelNav.getCurrentProject();
    if (!project) return;

    NovelProject.editProject(project.id, {
      title: formData.get('title'),
      genre: formData.get('genre'),
      initial_prompt: formData.get('initial_prompt')
    });

    NovelUtils.toast('项目已更新');
    NovelNav.applyProjectToUI();
  }

  /**
   * 导出项目
   */
  function exportProject() {
    const project = NovelNav.getCurrentProject();
    if (!project) return;
    NovelProject.exportProject(project);
    NovelUtils.toast('已导出');
  }

  /**
   * 删除当前项目
   */
  function deleteCurrentProject() {
    const project = NovelNav.getCurrentProject();
    if (!project || !confirm('确定删除此项目？')) return;
    
    NovelProject.deleteProject(project.id);
    NovelUtils.toast('已删除');
    NovelNav.goHome();
  }

  /**
   * 保存全局设置
   */
  function saveGlobalSettings() {
    const apiKey = document.getElementById('s-api-key').value.trim();
    const baseUrl = document.getElementById('s-base-url').value.trim();
    const channel = document.getElementById('s-channel').value;
    const model = document.getElementById('s-model').value;
    const temperature = parseFloat(document.getElementById('s-temp').value);

    // 保存全局设置（向后兼容）
    const settings = {
      api_key: apiKey,
      base_url: baseUrl,
      channel: channel,
      model: model,
      temperature: temperature
    };
    NovelStorage.saveSettings(settings);

    // 同时保存到多提供商存储（使用用户刚选择的 channel，而不是旧的 activeProvider）
    const providerConfig = {
      apiKey: apiKey,
      model: model
    };
    if (baseUrl) {
      providerConfig.baseUrl = baseUrl;
    }
    NovelStorage.saveProviderConfig(channel, providerConfig);
    
    // 更新活跃提供商
    NovelStorage.setActiveProvider(channel);

    NovelUtils.toast('全局设置已保存');
  }

  /**
   * 重置全局设置
   */
  function resetGlobalSettings() {
    if (!confirm('确定重置？所有项目的独立配置不受影响。')) return;
    NovelStorage.resetSettings();
    NovelUtils.toast('已重置');
    NovelNav.goSettings();
  }

  /**
   * 测试API连接
   */
  function testConnection() {
    const el = document.getElementById('test-result');
    if (!el) return;

    el.textContent = '测试中...';
    el.style.color = 'var(--muted)';

    const apiKey = document.getElementById('s-api-key').value.trim();
    const baseUrl = document.getElementById('s-base-url').value.trim();
    const channel = document.getElementById('s-channel').value;
    const model = document.getElementById('s-model').value;

    if (!apiKey || !baseUrl) {
      el.textContent = '请先填入 API Key 和 Base URL';
      el.style.color = 'var(--danger)';
      return;
    }

    NovelAPI.testConnection(apiKey, baseUrl, model, channel)
      .then(r => {
        const usage = r.usage || {};
        el.textContent = '连接成功! tokens: ' + (usage.prompt_tokens || '?') + 
                        '+' + (usage.completion_tokens || '?');
        el.style.color = 'var(--success)';
      })
      .catch(e => {
        el.textContent = '连接失败: ' + e.message.slice(0, 100);
        el.style.color = 'var(--danger)';
      });
  }

  /**
   * 应用页道默认设置并切换提供商
   */
  function applyChannelDefaults() {
    const channel = document.getElementById('s-channel').value;
    const urlMap = {
      dashscope: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      openai: 'https://api.openai.com/v1',
      custom: ''
    };

    if (urlMap[channel] !== undefined) {
      document.getElementById('s-base-url').value = urlMap[channel];
    }

    // 切换活跃的提供商
    NovelStorage.setActiveProvider(channel);

    // 加载新提供商的配置
    const providerConfig = NovelStorage.getProviderConfig(channel);
    const provider = NovelProviders.getProvider(channel);

    // 更新表单字段显示
    document.getElementById('s-api-key').value = providerConfig.apiKey || '';
    document.getElementById('s-model').value = providerConfig.model || (provider ? provider.defaultModel : '');

    NovelUtils.toast(`已切换到 ${provider ? provider.name : channel}`);
  }

  /**
   * 更新温度标签
   */
  function updateTemperatureLabel(value) {
    const el = document.getElementById('s-temp-label');
    if (el) el.textContent = parseFloat(value).toFixed(2);
  }

  /**
   * 绑定所有事件
   */
  function bindAllEvents() {
    console.log('[NovelAgents] Binding UI events');

    // Logo点击返回首页
    const logoBtn = document.getElementById('logo-btn');
    if (logoBtn) logoBtn.addEventListener('click', () => NovelNav.goHome());

    // 新建项目按钮
    const btnNew = document.getElementById('btn-new');
    if (btnNew) btnNew.addEventListener('click', showCreateModal);

    // 弹窗关闭按钮
    const btnModalClose = document.getElementById('modal-close');
    if (btnModalClose) btnModalClose.addEventListener('click', closeModal);

    // 表单提交
    const formNew = document.getElementById('form-new');
    if (formNew) {
      formNew.addEventListener('submit', (e) => {
        e.preventDefault();
        handleCreateProject(new FormData(e.target));
      });
    }

    // 标签页切换
    ['output', 'outline'].forEach(tab => {
      const el = document.getElementById('tab-' + tab);
      if (el) el.addEventListener('click', () => NovelNav.showTab(tab));
    });

    // 正文按钮：显示正文内容（控制中间区域）
    const btnNovelTab = document.getElementById('btn-novel-tab');
    if (btnNovelTab) {
      btnNovelTab.addEventListener('click', () => {
        // 显示 novel-container，隐藏 outline-panel
        const novelContainer = document.getElementById('novel-container');
        const outlinePanel = document.getElementById('outline-panel');
        if (novelContainer) {
          novelContainer.classList.remove('hidden');
          novelContainer.style.display = '';
        }
        if (outlinePanel) {
          outlinePanel.classList.add('hidden');
          outlinePanel.style.display = 'none';
        }
      });
    }

    // 大纲显示按钮：切换大纲显示/隐藏
    const btnShowOutline = document.getElementById('btn-show-outline');
    if (btnShowOutline) {
      btnShowOutline.addEventListener('click', () => {
        // 显示 outline-panel，隐藏 novel-container
        const outlinePanel = document.getElementById('outline-panel');
        const novelContainer = document.getElementById('novel-container');
        if (outlinePanel) {
          outlinePanel.classList.remove('hidden');
          outlinePanel.style.display = '';
        }
        if (novelContainer) {
          novelContainer.classList.add('hidden');
          novelContainer.style.display = 'none';
        }
      });
    }

    // 保存正文按钮：下载为 txt 文件
    const btnSaveText = document.getElementById('btn-save-text');
    if (btnSaveText) {
      btnSaveText.addEventListener('click', () => {
        const project = NovelNav.getCurrentProject();
        NovelProject.saveNovelTextAsTxt(project);
      });
    }

    // 正文编辑按钮
    const btnEditNovel = document.getElementById('btn-edit-novel');
    if (btnEditNovel) {
      btnEditNovel.addEventListener('click', enableNovelEditMode);
    }

    const btnSaveNovel = document.getElementById('btn-save-novel');
    if (btnSaveNovel) {
      btnSaveNovel.addEventListener('click', saveNovelEdit);
    }

    const btnCancelNovel = document.getElementById('btn-cancel-novel');
    if (btnCancelNovel) {
      btnCancelNovel.addEventListener('click', cancelNovelEdit);
    }

    // 大纲保存按钮
    const btnSaveOutline = document.getElementById('btn-save-outline');
    if (btnSaveOutline) {
      btnSaveOutline.addEventListener('click', saveOutlineEdit);
    }

    // 大纲取消按钮
    const btnCancelOutline = document.getElementById('btn-cancel-outline');
    if (btnCancelOutline) {
      btnCancelOutline.addEventListener('click', cancelOutlineEdit);
    }

    // 大纲新增章节按钮
    const btnAddOutlineChapter = document.getElementById('btn-add-outline-chapter');
    if (btnAddOutlineChapter) {
      btnAddOutlineChapter.addEventListener('click', addOutlineChapter);
    }

    // 大纲生成按钮（会在大纲生成模块中添加）
    // 写作按钮（会在写作模块中添加）

    // 设置相关按钮
    const btnSaveSettings = document.getElementById('btn-save-settings');
    if (btnSaveSettings) {
      btnSaveSettings.addEventListener('click', saveGlobalSettings);
    }

    const btnResetSettings = document.getElementById('btn-reset-settings');
    if (btnResetSettings) {
      btnResetSettings.addEventListener('click', resetGlobalSettings);
    }

    const btnTestConn = document.getElementById('btn-test-conn');
    if (btnTestConn) {
      btnTestConn.addEventListener('click', testConnection);
    }

    const sChannel = document.getElementById('s-channel');
    if (sChannel) {
      sChannel.addEventListener('change', applyChannelDefaults);
    }

    const sTemp = document.getElementById('s-temp');
    if (sTemp) {
      sTemp.addEventListener('input', (e) => updateTemperatureLabel(e.target.value));
    }

    // 角色新增按钮
    const btnAddChar = document.getElementById('btn-add-char');
    if (btnAddChar) {
      btnAddChar.addEventListener('click', showAddCharModal);
    }

    console.log('[NovelAgents] UI events bound');
  }

  /**
   * 显示新增角色的弹窗
   */
  function showAddCharModal() {
    const project = NovelNav.getCurrentProject();
    if (!project) return;

    const name = prompt('请输入角色名称：');
    if (!name) return;

    const personality = prompt('请输入角色性格或描述：');
    const character = {
      character_name: name,
      name: name,
      personality: personality || '',
      initial_state: personality || '',
      final_state: '',
      key_changes: [],
      conflicts: []
    };

    // 直接添加到内存中的项目对象
    if (!project.characters) project.characters = [];
    character.id = character.id || NovelUtils.uuid();
    project.characters.push(character);
    
    // 持久化到存储
    NovelStorage.updateProject(project.id, { characters: project.characters });
    
    // 刷新 UI（立即更新显示）
    NovelNav.applyProjectToUI();
    
    NovelUtils.toast('已添加角色：' + name);
  }

  /**
   * 编辑角色
   */
  function editCharacter(index) {
    const project = NovelNav.getCurrentProject();
    if (!project || !project.characters || !project.characters[index]) return;

    const char = project.characters[index];
    const newName = prompt('编辑角色名称：', char.character_name || char.name);
    if (!newName) return;

    const newPersonality = prompt('编辑角色描述：', char.personality || char.initial_state);

    // 更新内存中的对象
    char.character_name = newName;
    char.name = newName;
    char.personality = newPersonality || char.personality;
    char.initial_state = newPersonality || char.initial_state;

    // 持久化到存储
    NovelStorage.updateProject(project.id, { characters: project.characters });
    
    // 刷新 UI（立即更新显示）
    NovelNav.applyProjectToUI();
    
    NovelUtils.toast('已更新角色：' + newName);
  }

  /**
   * 删除角色
   */
  function deleteCharacter(index) {
    const project = NovelNav.getCurrentProject();
    if (!project || !project.characters || !project.characters[index]) return;

    const char = project.characters[index];
    if (!confirm('确定删除角色「' + (char.character_name || char.name) + '」吗？')) return;

    // 从内存中移除（直接修改数组）
    project.characters.splice(index, 1);
    
    // 持久化到存储
    NovelStorage.updateProject(project.id, { characters: project.characters });
    
    // 刷新 UI（立即更新显示）
    NovelNav.applyProjectToUI();
    
    NovelUtils.toast('已删除角色');
  }

  /**
   * 启用正文编辑模式
   */
  function enableNovelEditMode() {
    const project = NovelNav.getCurrentProject();
    if (!project) return;

    const novelPanel = document.getElementById('novel-panel');
    const novelEditor = document.getElementById('novel-editor');
    const btnEdit = document.getElementById('btn-edit-novel');
    const btnSave = document.getElementById('btn-save-novel');
    const btnCancel = document.getElementById('btn-cancel-novel');

    if (!novelPanel || !novelEditor) return;

    // 加载内容到编辑器
    novelEditor.value = project.novel_text || '';

    // 切换显示/编辑模式 - 同时使用 classList 和内联样式确保生效
    novelPanel.classList.add('hidden');
    novelPanel.style.display = 'none';
    novelEditor.classList.remove('hidden');
    novelEditor.style.display = '';

    // 切换按钮状态
    if (btnEdit) btnEdit.style.display = 'none';
    if (btnSave) btnSave.style.display = '';
    if (btnCancel) btnCancel.style.display = '';

    // 聚焦编辑器
    novelEditor.focus();
  }

  /**
   * 保存正文编辑
   */
  function saveNovelEdit() {
    const project = NovelNav.getCurrentProject();
    if (!project) return;

    const novelEditor = document.getElementById('novel-editor');
    const novelPanel = document.getElementById('novel-panel');
    const btnEdit = document.getElementById('btn-edit-novel');
    const btnSave = document.getElementById('btn-save-novel');
    const btnCancel = document.getElementById('btn-cancel-novel');

    if (!novelEditor || !novelPanel) return;

    // 获取编辑后的内容
    const editedText = novelEditor.value.trim();

    // 更新项目数据
    project.novel_text = editedText;

    // 持久化到存储
    NovelStorage.updateProject(project.id, { novel_text: project.novel_text });

    // 切换回显示模式 - 同时使用 classList 和内联样式确保生效
    novelEditor.classList.add('hidden');
    novelEditor.style.display = 'none';
    novelPanel.classList.remove('hidden');
    novelPanel.style.display = '';
    novelPanel.textContent = editedText;

    // 切换按钮状态
    if (btnEdit) btnEdit.style.display = '';
    if (btnSave) btnSave.style.display = 'none';
    if (btnCancel) btnCancel.style.display = 'none';

    NovelUtils.toast('正文已保存');
  }

  /**
   * 取消正文编辑
   */
  function cancelNovelEdit() {
    const project = NovelNav.getCurrentProject();
    if (!project) return;

    const novelEditor = document.getElementById('novel-editor');
    const novelPanel = document.getElementById('novel-panel');
    const btnEdit = document.getElementById('btn-edit-novel');
    const btnSave = document.getElementById('btn-save-novel');
    const btnCancel = document.getElementById('btn-cancel-novel');

    if (!novelEditor || !novelPanel) return;

    // 不保存，直接切换回显示模式 - 同时使用 classList 和内联样式确保生效
    novelEditor.classList.add('hidden');
    novelEditor.style.display = 'none';
    novelPanel.classList.remove('hidden');
    novelPanel.style.display = '';
    novelPanel.textContent = project.novel_text || '';

    // 切换按钮状态
    if (btnEdit) btnEdit.style.display = '';
    if (btnSave) btnSave.style.display = 'none';
    if (btnCancel) btnCancel.style.display = 'none';

    NovelUtils.toast('已取消编辑');
  }

  /**
   * 启用大纲编辑模式（文本编辑器）
   */
  function enableOutlineEditMode() {
    const project = NovelNav.getCurrentProject();
    if (!project || !project.outline) return;

    // 将大纲对象转换为文本格式
    const outlineText = formatOutlineToText(project.outline);
    
    // 创建或获取编辑器元素
    let editor = document.getElementById('outline-editor');
    if (!editor) {
      editor = document.createElement('textarea');
      editor.id = 'outline-editor';
      editor.className = 'hidden';
      editor.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;box-sizing:border-box;padding:2rem 3rem;font-size:1.05rem;line-height:2.2;white-space:pre-wrap;word-break:break-word;max-width:800px;margin:0 auto;border:none;outline:none;background:transparent;color:var(--text);font-family:"Noto Serif SC",serif;resize:none;display:none';
      
      const contentWrapper = document.querySelector('.outline-scroll');
      if (contentWrapper) {
        contentWrapper.appendChild(editor);
      }
    }

    const outlineContent = document.getElementById('outline-content');
    const btnSave = document.getElementById('btn-save-outline');
    const btnCancel = document.getElementById('btn-cancel-outline');

    if (!outlineContent || !editor) return;

    // 加载内容到编辑器
    editor.value = outlineText;

    // 切换显示/编辑模式
    outlineContent.classList.add('hidden');
    outlineContent.style.display = 'none';
    editor.classList.remove('hidden');
    editor.style.display = '';

    // 切换按钮状态
    if (btnSave) btnSave.style.display = '';
    if (btnCancel) btnCancel.style.display = '';

    // 聚焦编辑器
    editor.focus();
  }

  /**
   * 保存大纲编辑
   */
  function saveOutlineEdit() {
    const project = NovelNav.getCurrentProject();
    if (!project) return;

    const editor = document.getElementById('outline-editor');
    const outlineContent = document.getElementById('outline-content');
    const btnSave = document.getElementById('btn-save-outline');
    const btnCancel = document.getElementById('btn-cancel-outline');

    if (!editor || !outlineContent) return;

    // 获取编辑后的文本并解析为大纲对象
    const editedText = editor.value.trim();
    const parsedOutline = parseTextToOutline(editedText);

    // 更新项目数据
    project.outline = parsedOutline;

    // 持久化到存储
    NovelStorage.updateProject(project.id, { outline: project.outline });

    // 切换回显示模式
    editor.classList.add('hidden');
    editor.style.display = 'none';
    outlineContent.classList.remove('hidden');
    outlineContent.style.display = '';

    // 刷新 UI
    NovelNav.applyProjectToUI();

    // 切换按钮状态
    if (btnSave) btnSave.style.display = 'none';
    if (btnCancel) btnCancel.style.display = 'none';

    NovelUtils.toast('大纲已保存');
  }

  /**
   * 取消大纲编辑
   */
  function cancelOutlineEdit() {
    const project = NovelNav.getCurrentProject();
    if (!project) return;

    const editor = document.getElementById('outline-editor');
    const outlineContent = document.getElementById('outline-content');
    const btnSave = document.getElementById('btn-save-outline');
    const btnCancel = document.getElementById('btn-cancel-outline');

    if (!editor || !outlineContent) return;

    // 不保存，直接切换回显示模式
    editor.classList.add('hidden');
    editor.style.display = 'none';
    outlineContent.classList.remove('hidden');
    outlineContent.style.display = '';

    // 切换按钮状态
    if (btnSave) btnSave.style.display = 'none';
    if (btnCancel) btnCancel.style.display = 'none';

    NovelUtils.toast('已取消编辑');
  }

  /**
   * 添加新章节
   */
  function addOutlineChapter() {
    const project = NovelNav.getCurrentProject();
    if (!project || !project.outline) return;

    const chapterTitle = prompt('请输入新章节标题：');
    if (!chapterTitle) return;

    const oneSentence = prompt('请用一句话概括本章内容：') || '';

    if (!project.outline.chapters) {
      project.outline.chapters = [];
    }

    // 计算新章节编号
    const maxChapterNum = project.outline.chapters.reduce((max, ch) => {
      return Math.max(max, ch.chapter_number || 0);
    }, 0);

    const newChapter = {
      chapter_number: maxChapterNum + 1,
      chapter_title: chapterTitle,
      one_sentence: oneSentence,
      key_events: [],
      characters_involved: []
    };

    project.outline.chapters.push(newChapter);

    // 持久化到存储
    NovelStorage.updateProject(project.id, { outline: project.outline });

    // 刷新 UI
    NovelNav.applyProjectToUI();

    NovelUtils.toast('已添加章节：' + chapterTitle);
  }

  /**
   * 编辑大纲中的章节（备用方案：直接点击字段即可编辑）
   */
  function editOutlineChapter(index) {
    const project = NovelNav.getCurrentProject();
    if (!project || !project.outline || !project.outline.chapters || !project.outline.chapters[index]) return;

    // 显示提示信息
    NovelUtils.toast('💡 提示：直接点击卡片上的文字即可快速编辑', 'info');
    
    // 滚动到对应章节并高亮
    const chapterBlocks = document.querySelectorAll('.chapter-block');
    if (chapterBlocks[index]) {
      chapterBlocks[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
      chapterBlocks[index].classList.add('current');
      setTimeout(() => {
        chapterBlocks[index].classList.remove('current');
      }, 2000);
    }
  }

  /**
   * 删除大纲中的章节
   */
  function deleteOutlineChapter(index) {
    const project = NovelNav.getCurrentProject();
    if (!project || !project.outline || !project.outline.chapters || !project.outline.chapters[index]) return;

    const chapter = project.outline.chapters[index];
    if (!confirm('确定删除章节「' + (chapter.chapter_title || '第' + chapter.chapter_number + '章') + '」吗？')) return;

    // 从内存中移除
    project.outline.chapters.splice(index, 1);

    // 重新编号所有章节
    project.outline.chapters.forEach((ch, idx) => {
      ch.chapter_number = idx + 1;
    });

    // 持久化到存储
    NovelStorage.updateProject(project.id, { outline: project.outline });

    // 刷新 UI
    NovelNav.applyProjectToUI();

    NovelUtils.toast('章节已删除');
  }

  /**
   * 将大纲对象格式化为文本（用于编辑）
   */
  function formatOutlineToText(outline) {
    if (!outline) return '';
    
    let text = '';
    
    // 主题信息
    if (outline.theme && outline.theme.theme) {
      text += '【核心主旨】\n';
      text += outline.theme.theme + '\n\n';
      if (outline.theme.purpose) {
        text += '目的：' + outline.theme.purpose + '\n\n';
      }
    }
    
    // 段落剧情
    if (outline.plot_paragraph) {
      text += '【段落剧情】\n';
      text += outline.plot_paragraph + '\n\n';
    }
    
    // 章节列表
    if (outline.chapters && outline.chapters.length > 0) {
      text += '【章节列表】\n';
      outline.chapters.forEach(ch => {
        text += '\n第' + ch.chapter_number + '章 ' + (ch.chapter_title || '') + '\n';
        text += '概括：' + (ch.one_sentence || '') + '\n';
        if (ch.expanded_paragraph) {
          text += '详情：' + ch.expanded_paragraph + '\n';
        }
        if (ch.key_events && ch.key_events.length > 0) {
          text += '关键事件：' + ch.key_events.join('、') + '\n';
        }
      });
    }
    
    // 角色弧线
    if (outline.character_arcs && outline.character_arcs.length > 0) {
      text += '\n【角色弧线】\n';
      outline.character_arcs.forEach(arc => {
        text += '\n' + (arc.character_name || '') + '\n';
        text += '初始：' + (arc.initial_state || '') + '\n';
        text += '终态：' + (arc.final_state || '') + '\n';
      });
    }
    
    // 世界观
    if (outline.world_building) {
      const wb = outline.world_building;
      if (Object.keys(wb).length > 0) {
        text += '\n【世界观】\n';
        if (wb.time_period) text += '时代：' + wb.time_period + '\n';
        if (wb.location) text += '地点：' + wb.location + '\n';
        if (wb.atmosphere) text += '氛围：' + wb.atmosphere + '\n';
        if (wb.rules_of_world && wb.rules_of_world.length > 0) {
          text += '规则：\n' + wb.rules_of_world.map(r => '• ' + r).join('\n') + '\n';
        }
      }
    }
    
    return text;
  }

  /**
   * 将文本解析为大纲对象
   */
  function parseTextToOutline(text) {
    const outline = {
      theme: {},
      chapters: [],
      character_arcs: [],
      world_building: {}
    };
    
    if (!text) return outline;
    
    const lines = text.split('\n');
    let currentSection = '';
    let currentChapter = null;
    let currentArc = null;
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      
      // 检测段落标记
      if (trimmed.startsWith('【')) {
        if (trimmed.includes('核心主旨')) {
          currentSection = 'theme';
        } else if (trimmed.includes('段落剧情')) {
          currentSection = 'plot';
        } else if (trimmed.includes('章节列表')) {
          currentSection = 'chapters';
        } else if (trimmed.includes('角色弧线')) {
          currentSection = 'arcs';
        } else if (trimmed.includes('世界观')) {
          currentSection = 'world';
        }
        return;
      }
      
      // 处理主题部分
      if (currentSection === 'theme') {
        if (trimmed.startsWith('目的：')) {
          outline.theme.purpose = trimmed.replace('目的：', '');
        } else if (!trimmed.startsWith('[')) {
          outline.theme.theme = trimmed;
        }
      }
      
      // 处理段落剧情
      if (currentSection === 'plot' && !trimmed.startsWith('[')) {
        outline.plot_paragraph = (outline.plot_paragraph || '') + trimmed + '\n';
      }
      
      // 处理章节
      if (currentSection === 'chapters') {
        if (trimmed.match(/^第\d+ 章/)) {
          // 新章节开始
          if (currentChapter) {
            outline.chapters.push(currentChapter);
          }
          const match = trimmed.match(/^第(\d+) 章\s*(.*)/);
          currentChapter = {
            chapter_number: parseInt(match[1]),
            chapter_title: match[2] || ''
          };
        } else if (currentChapter) {
          if (trimmed.startsWith('概括：')) {
            currentChapter.one_sentence = trimmed.replace('概括：', '');
          } else if (trimmed.startsWith('详情：')) {
            currentChapter.expanded_paragraph = trimmed.replace('详情：', '');
          } else if (trimmed.startsWith('关键事件：')) {
            currentChapter.key_events = trimmed.replace('关键事件：', '').split(/[,,]/);
          }
        }
      }
      
      // 处理角色弧线
      if (currentSection === 'arcs') {
        if (trimmed.startsWith('初始：')) {
          if (currentArc) currentArc.initial_state = trimmed.replace('初始：', '');
        } else if (trimmed.startsWith('终态：')) {
          if (currentArc) currentArc.final_state = trimmed.replace('终态：', '');
        } else if (!trimmed.startsWith('[') && !trimmed.startsWith('初') && !trimmed.startsWith('终')) {
          // 角色名
          if (currentArc) outline.character_arcs.push(currentArc);
          currentArc = { character_name: trimmed };
        }
      }
      
      // 处理世界观
      if (currentSection === 'world') {
        if (trimmed.startsWith('时代：')) {
          outline.world_building.time_period = trimmed.replace('时代：', '');
        } else if (trimmed.startsWith('地点：')) {
          outline.world_building.location = trimmed.replace('地点：', '');
        } else if (trimmed.startsWith('氛围：')) {
          outline.world_building.atmosphere = trimmed.replace('氛围：', '');
        } else if (trimmed.startsWith('规则：')) {
          outline.world_building.rules_of_world = [];
        } else if (trimmed.startsWith('•')) {
          if (!outline.world_building.rules_of_world) {
            outline.world_building.rules_of_world = [];
          }
          outline.world_building.rules_of_world.push(trimmed.substring(2));
        }
      }
    });
    
    // 添加最后一个章节和角色弧线
    if (currentChapter) {
      outline.chapters.push(currentChapter);
    }
    if (currentArc) {
      outline.character_arcs.push(currentArc);
    }
    
    // 清理空行
    if (outline.plot_paragraph) {
      outline.plot_paragraph = outline.plot_paragraph.trim();
    }
    
    return outline;
  }

  return {
    showCreateModal,
    closeModal,
    handleCreateProject,
    handleEditProject,
    exportProject,
    deleteCurrentProject,
    saveGlobalSettings,
    resetGlobalSettings,
    testConnection,
    applyChannelDefaults,
    updateTemperatureLabel,
    bindAllEvents,
    editCharacter,
    deleteCharacter,
    showAddCharModal,
    enableNovelEditMode,
    saveNovelEdit,
    cancelNovelEdit,
    enableOutlineEditMode,
    saveOutlineEdit,
    cancelOutlineEdit,
    addOutlineChapter,
    editOutlineChapter,
    deleteOutlineChapter,
    formatOutlineToText,
    parseTextToOutline
  };
})();
