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
   * 显示编辑项目的弹窗
   */
  function showEditModal() {
    const project = NovelNav.getCurrentProject();
    if (!project) {
      NovelUtils.toast('请先打开一个项目', 'error');
      return;
    }

    // 填充表单数据
    const titleInput = document.getElementById('pe-title');
    const genreSelect = document.getElementById('pe-genre');
    const promptTextarea = document.getElementById('pe-initial-prompt');

    if (titleInput) titleInput.value = project.title || '';
    if (genreSelect) genreSelect.value = project.genre || '其他';
    if (promptTextarea) promptTextarea.value = project.initial_prompt || '';

    // 显示弹窗
    const overlay = document.getElementById('project-edit-modal');
    if (overlay) overlay.classList.remove('hidden');
  }

  /**
   * 关闭编辑项目弹窗
   */
  function closeEditModal() {
    const overlay = document.getElementById('project-edit-modal');
    if (overlay) overlay.classList.add('hidden');
  }

  /**
   * 处理项目编辑表单提交
   */
  function handleEditProjectForm(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    handleEditProject(formData);
    closeEditModal();
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
      deepseek: 'https://api.deepseek.com',
      claude: 'https://api.anthropic.com/v1',
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
    
    // 动态更新模型列表
    updateModelOptions(channel, providerConfig.model || (provider ? provider.defaultModel : ''));

    NovelUtils.toast(`已切换到 ${provider ? provider.name : channel}`);
  }

  /**
   * 动态更新模型选择下拉框
   */
  function updateModelOptions(channel, selectedModel) {
    const modelSelect = document.getElementById('s-model');
    if (!modelSelect) {
      console.error('[updateModelOptions] s-model 元素不存在');
      return;
    }

    const models = NovelProviders.getModels(channel);
    console.log('[updateModelOptions] 渠道:', channel, '模型列表:', models);
    
    if (!models || models.length === 0) {
      console.warn('[updateModelOptions] 渠道', channel, '没有可用的模型');
      // 即使没有模型，也要清空选项
      modelSelect.innerHTML = '';
      return;
    }

    // 清空现有选项
    modelSelect.innerHTML = '';

    // 添加新选项
    models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.name;
      modelSelect.appendChild(option);
    });

    // 设置选中的模型
    if (selectedModel) {
      modelSelect.value = selectedModel;
      console.log('[updateModelOptions] 设置选中模型:', selectedModel);
    } else {
      // 如果没有指定选中模型，使用第一个
      const firstModel = models[0]?.id;
      if (firstModel) {
        modelSelect.value = firstModel;
        console.log('[updateModelOptions] 未指定选中模型，使用第一个:', firstModel);
      }
    }
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

    // 正文按钮：显示正文内容（隐藏 outline-container）
    const btnNovelTab = document.getElementById('btn-novel-tab');
    if (btnNovelTab) {
      btnNovelTab.addEventListener('click', () => {
        // 隐藏 outline-container，显示 novel-container
        const outlineContainer = document.getElementById('outline-container');
        const novelContainer = document.getElementById('novel-container');
        
        if (outlineContainer) {
          outlineContainer.classList.add('hidden');
        }
        if (novelContainer) {
          novelContainer.classList.remove('hidden');
          novelContainer.style.display = 'flex';
        }
      });
    }

    // 大纲显示按钮：切换回大纲视图（显示 outline-container）
    const btnShowOutline = document.getElementById('btn-show-outline');
    if (btnShowOutline) {
      btnShowOutline.addEventListener('click', () => {
        // 显示 outline-container，隐藏 novel-container
        const outlineContainer = document.getElementById('outline-container');
        const novelContainer = document.getElementById('novel-container');
        
        if (outlineContainer) {
          outlineContainer.classList.remove('hidden');
          outlineContainer.style.display = 'flex';
        }
        if (novelContainer) {
          novelContainer.classList.add('hidden');
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

    // 右侧面板 Tab 切换
    const tabOutput = document.getElementById('tab-output');
    const tabCharacters = document.getElementById('tab-characters');
    const panelOutput = document.getElementById('panel-output');
    const panelCharacters = document.getElementById('panel-characters');
    const tabOutline = document.getElementById('tab-outline');
    const panelOutline = document.getElementById('panel-outline');

    if (tabOutput && tabCharacters && panelOutput && panelCharacters) {
      tabOutput.addEventListener('click', () => {
        tabOutput.classList.add('active');
        tabCharacters.classList.remove('active');
        if (tabOutline) tabOutline.classList.remove('active');
        panelOutput.classList.remove('hidden');
        panelCharacters.classList.add('hidden');
        if (panelOutline) panelOutline.classList.add('hidden');
      });

      tabCharacters.addEventListener('click', () => {
        tabCharacters.classList.add('active');
        tabOutput.classList.remove('active');
        if (tabOutline) tabOutline.classList.remove('active');
        panelCharacters.classList.remove('hidden');
        panelOutput.classList.add('hidden');
        if (panelOutline) panelOutline.classList.add('hidden');
        // 切换到角色 Tab 时渲染角色列表
        renderCharactersList();
      });

      // 大纲 Tab 切换（如果存在）
      if (tabOutline && panelOutline) {
        tabOutline.addEventListener('click', () => {
          tabOutline.classList.add('active');
          tabOutput.classList.remove('active');
          tabCharacters.classList.remove('active');
          panelOutline.classList.remove('hidden');
          panelOutput.classList.add('hidden');
          panelCharacters.classList.add('hidden');
          // 切换到大纲 Tab 时渲染大纲内容
          const project = NovelNav.getCurrentProject();
          if (project && project.outline) {
            NovelNav.renderOutline(project.outline);
          }
        });
      }
    }

    // 角色列表操作按钮（动态绑定）
    function handleCharacterAction(e) {
      const target = e.target;
      const characterItem = target.closest('.character-item');
      if (!characterItem) return;

      const index = parseInt(characterItem.dataset.index);
      
      // 只处理删除按钮点击
      if (target.classList.contains('btn-delete-char')) {
        deleteCharacter(index);
      }
    }

    // 为角色列表容器添加事件委托
    const charactersList = document.getElementById('characters-list');
    if (charactersList) {
      charactersList.addEventListener('click', handleCharacterAction);
    }

    // 右侧面板"添加角色"按钮
    const btnAddCharacterPanel = document.getElementById('btn-add-character-panel');
    if (btnAddCharacterPanel) {
      btnAddCharacterPanel.addEventListener('click', () => {
        showAddCharModal();
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

    // 世界观新增规则按钮
    const btnAddWorldRule = document.getElementById('btn-add-world-rule');
    if (btnAddWorldRule) {
      btnAddWorldRule.addEventListener('click', () => {
        // 使用 NovelNav.getCurrentProject() 获取当前项目
        const project = NovelNav.getCurrentProject();
        if (!project || !project.outline) {
          NovelUtils.toast('请先生成大纲', 'error');
          return;
        }
        
        if (!project.outline.world_building) {
          project.outline.world_building = {};
        }
        if (!project.outline.world_building.rules_of_world) {
          project.outline.world_building.rules_of_world = [];
        }
        
        // 添加一个空规则项
        project.outline.world_building.rules_of_world.push('新规则');
        
        // 持久化并刷新 UI
        NovelStorage.updateProject(project.id, { outline: project.outline });
        // 使用 NovelNav.renderOutline 刷新大纲视图
        if (typeof NovelNav !== 'undefined' && typeof NovelNav.renderOutline === 'function') {
          NovelNav.renderOutline(project.outline);
        }
        NovelUtils.toast('已添加规则');
      });
    }

    // 大纲生成按钮（会在大纲生成模块中添加）
    // 写作按钮（会在写作模块中添加）

    // 项目编辑按钮
    const btnEditProject = document.getElementById('btn-edit-project');
    if (btnEditProject) {
      btnEditProject.addEventListener('click', showEditModal);
    }

    // 项目编辑表单提交
    const projectEditForm = document.getElementById('project-edit-form');
    if (projectEditForm) {
      projectEditForm.addEventListener('submit', handleEditProjectForm);
    }

    // 项目编辑取消按钮
    const projectEditCancel = document.getElementById('project-edit-cancel');
    if (projectEditCancel) {
      projectEditCancel.addEventListener('click', closeEditModal);
    }

    // 项目编辑关闭按钮
    const projectEditClose = document.getElementById('project-edit-close');
    if (projectEditClose) {
      projectEditClose.addEventListener('click', closeEditModal);
    }

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
   * 解析文本到大纲结构
   */
  function parseTextToOutline(text) {
    const outline = {
      theme: {},
      plot_paragraph: '',
      structure: { total_chapters: 0, main_plot: '' },
      chapters: [],
      character_arcs: [],
      world_building: {}
    };
    
    return outline;
  }

  /**
   * 渲染右侧面板的角色列表 - 增强版（支持内联编辑）
   */
  function renderCharactersList() {
    const project = NovelNav.getCurrentProject();
    const container = document.getElementById('characters-list');
    
    if (!container) return;
    
    // 如果没有项目或没有角色，显示空状态
    if (!project || !project.characters || project.characters.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;color:var(--muted);padding:2rem;font-size:.85rem">
          <p>暂无角色</p>
          <p style="margin-top:.5rem">点击"+添加角色"按钮创建第一个角色</p>
        </div>
      `;
      return;
    }

    // 渲染角色列表 - 增强版（显示更多详细信息）
    const html = project.characters.map((char, index) => {
      const name = char.character_name || char.name || '未命名';
      const personality = char.personality || '';
      const background = char.background || '';
      const initialState = char.initial_state || '';
      const finalState = char.final_state || '';
      const roleInStory = char.role_in_story || '配角';
      const keyChanges = char.key_changes || [];
      const conflicts = char.conflicts || [];
      
      // 计算角色信息丰富度标签
      let richnessTags = [];
      if (personality) richnessTags.push('性格特征');
      if (background) richnessTags.push('背景故事');
      if (initialState || finalState) {
        // 只要有初始或最终状态就显示成长弧线标签
        const arcLabels = [];
        if (initialState) arcLabels.push('初始');
        if (finalState) arcLabels.push('终态');
        richnessTags.push(`成长弧线 (${arcLabels.join('/')})`);
      }
      if (keyChanges.length > 0) richnessTags.push(`关键变化 (${keyChanges.length})`);
      if (conflicts.length > 0) richnessTags.push(`内心冲突 (${conflicts.length})`);
      
      return `
        <div class="character-item" data-index="${index}">
          <div class="character-header">
            <div class="character-name">${escapeHtml(name)}</div>
            <div class="character-actions">
              <button class="btn btn-ghost btn-delete-char danger" title="删除">🗑</button>
            </div>
          </div>
          
          ${roleInStory !== '配角' ? `<div class="character-role-tag">定位：${escapeHtml(roleInStory)}</div>` : ''}
          
          ${personality ? `<div class="character-section editable-field" data-field="personality" data-index="${index}"><strong class="section-label">性格：</strong><span class="section-content">${escapeHtml(personality)}</span></div>` : '<div class="character-section editable-field empty-hint" data-field="personality" data-index="' + index + '" style="font-style:italic;color:var(--border)">[点击添加性格描述]</div>'}
          
          ${background ? `<div class="character-section editable-field" data-field="background" data-index="${index}"><strong class="section-label">背景：</strong><span class="section-content">${escapeHtml(background)}</span></div>` : '<div class="character-section editable-field empty-hint" data-field="background" data-index="' + index + '" style="font-style:italic;color:var(--border)">[点击添加背景故事]</div>'}
          
          <div class="character-section arc-section">
            <strong class="section-label arc-label">成长轨迹：</strong>
            <div class="arc-content">
              ${initialState ? `<div class="arc-state initial editable-field" data-field="initial_state" data-index="${index}"><span class="state-icon">🌱</span><span class="state-label">初始：</span>${escapeHtml(initialState)}</div>` : '<div class="arc-state initial editable-field empty-hint" data-field="initial_state" data-index="' + index + '" style="font-style:italic;color:var(--border);cursor:pointer">[点击添加初始状态]</div>'}
              ${finalState ? `<div class="arc-state final editable-field" data-field="final_state" data-index="${index}"><span class="state-icon">✨</span><span class="state-label">终态：</span>${escapeHtml(finalState)}</div>` : '<div class="arc-state final editable-field empty-hint" data-field="final_state" data-index="' + index + '" style="font-style:italic;color:var(--border);cursor:pointer">[点击添加最终状态]</div>'}
            </div>
          </div>
          
          ${keyChanges.length > 0 ? `
            <div class="character-meta-field editable-field" data-field="key_changes" data-index="${index}">
              <span class="meta-label">关键变化：</span>
              <div class="meta-items">${keyChanges.map(item => `<span class="meta-item">${escapeHtml(item)}</span>`).join('')}</div>
            </div>
          ` : '<div class="character-meta-field editable-field empty-hint" data-field="key_changes" data-index="' + index + '" style="font-style:italic;color:var(--border);cursor:pointer">[点击添加关键变化]</div>'}
          
          ${conflicts.length > 0 ? `
            <div class="character-meta-field editable-field" data-field="conflicts" data-index="${index}">
              <span class="meta-label">内心冲突：</span>
              <div class="meta-items">${conflicts.map(item => `<span class="meta-item conflict">${escapeHtml(item)}</span>`).join('')}</div>
            </div>
          ` : '<div class="character-meta-field editable-field empty-hint" data-field="conflicts" data-index="' + index + '" style="font-style:italic;color:var(--border);cursor:pointer">[点击添加内心冲突]</div>'}
          
          <div class="character-meta">
            ${richnessTags.length > 0 ? richnessTags.map(tag => `<span class="character-tag info">${tag}</span>`).join('') : '<span class="character-tag empty">待完善</span>'}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
    
    // 为可编辑字段添加事件绑定
    bindCharacterEditEvents();
  }
  
  /**
   * 为角色可编辑字段添加内联编辑事件
   */
  function bindCharacterEditEvents() {
    const editableFields = document.querySelectorAll('.character-item .editable-field:not(.arc-state)');
    
    editableFields.forEach(field => {
      field.addEventListener('click', () => {
        enableCharacterInlineEdit(field);
      });
    });
    
    // 成长轨迹的特殊处理
    const arcStates = document.querySelectorAll('.arc-state.editable-field');
    arcStates.forEach(arc => {
      arc.addEventListener('click', () => {
        enableCharacterInlineEdit(arc);
      });
    });
  }
  
  /**
   * 启用角色内联编辑模式
   */
  function enableCharacterInlineEdit(fieldElement) {
    // 如果已经在编辑模式，不重复创建
    if (fieldElement.querySelector('input') || fieldElement.querySelector('textarea')) return;

    const index = parseInt(fieldElement.dataset.index);
    const fieldName = fieldElement.dataset.field;
    const project = NovelNav.getCurrentProject();
    
    if (!project || !project.characters || !project.characters[index]) return;

    const character = project.characters[index];
    const currentValue = character[fieldName] || '';
    
    // 根据字段类型创建不同的编辑器
    let editor;
    
    if (fieldName === 'key_changes' || fieldName === 'conflicts') {
      // 数组型字段：使用逗号分隔的输入框（类似大纲关键事件）
      const itemsArray = Array.isArray(character[fieldName]) ? character[fieldName] : [];
      editor = document.createElement('input');
      editor.type = 'text';
      editor.value = itemsArray.join(', ');
      editor.placeholder = fieldName === 'key_changes' 
        ? '用英文逗号分隔多个关键变化' 
        : '用英文逗号分隔多个内心冲突';
      editor.style.cssText = 'width:100%; padding:.3rem .5rem; font-size:.75rem; background:var(--surface2); border:1px solid var(--accent); border-radius:4px; color:var(--text); font-family:inherit;';
      
      editor.addEventListener('blur', () => {
        const newValue = editor.value.trim();
        // 使用英文逗号分割，并过滤空白项
        const itemsArray = newValue.split(/,/).map(s => s.trim()).filter(s => s);
        character[fieldName] = itemsArray;
        
        // 持久化到存储
        NovelStorage.updateProject(project.id, { characters: project.characters });
        
        // 重新渲染角色列表
        renderCharactersList();
        
        NovelUtils.toast('已更新' + (fieldName === 'key_changes' ? '关键变化' : '内心冲突'));
      });
    } else if (fieldName === 'personality' || fieldName === 'background') {
      // 多行文本框
      editor = document.createElement('textarea');
      editor.value = currentValue;
      editor.placeholder = fieldName === 'personality' ? '添加性格描述...' : '添加背景故事...';
      editor.rows = 3;
      editor.style.cssText = 'width:100%; padding:.3rem .5rem; font-size:.78rem; background:var(--surface2); border:1px solid var(--accent); border-radius:4px; color:var(--text); font-family:inherit; resize:vertical;';
      
      editor.addEventListener('blur', () => {
        const newValue = editor.value.trim();
        character[fieldName] = newValue;
        NovelStorage.updateProject(project.id, { characters: project.characters });
        renderCharactersList();
        NovelUtils.toast('已更新角色');
      });
    } else if (fieldName === 'initial_state' || fieldName === 'final_state') {
      // 单行输入框
      editor = document.createElement('input');
      editor.type = 'text';
      editor.value = currentValue;
      editor.placeholder = fieldName === 'initial_state' ? '初始状态...' : '最终状态...';
      editor.style.cssText = 'width:100%; padding:.3rem .5rem; font-size:.75rem; background:var(--surface2); border:1px solid var(--accent); border-radius:4px; color:var(--text); font-family:inherit;';
      
      editor.addEventListener('blur', () => {
        const newValue = editor.value.trim();
        character[fieldName] = newValue;
        NovelStorage.updateProject(project.id, { characters: project.characters });
        renderCharactersList();
        NovelUtils.toast('已更新角色');
      });
    } else {
      // 默认单行输入框
      editor = document.createElement('input');
      editor.type = 'text';
      editor.value = currentValue;
      editor.placeholder = '点击输入内容';
      editor.style.cssText = 'width:100%; padding:.3rem .5rem; font-size:.78rem; background:var(--surface2); border:1px solid var(--accent); border-radius:4px; color:var(--text); font-family:inherit;';
      
      editor.addEventListener('blur', () => {
        const newValue = editor.value.trim();
        character[fieldName] = newValue;
        NovelStorage.updateProject(project.id, { characters: project.characters });
        renderCharactersList();
        NovelUtils.toast('已更新角色');
      });
    }

    // 处理 Enter 键保存（多行文本除外）
    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && fieldName !== 'personality' && fieldName !== 'background') {
        e.preventDefault();
        editor.blur();
      }
      if (e.key === 'Escape') {
        renderCharactersList(); // 重新渲染，放弃修改
      }
    });

    // 替换原内容
    fieldElement.innerHTML = '';
    fieldElement.appendChild(editor);
    
    // 聚焦编辑器
    setTimeout(() => editor.focus(), 10);
  }

  /**
   * 初始化设置 UI
   */
  function initializeSettingsUI() {
    console.log('[initializeSettingsUI] 开始初始化设置 UI');
    
    const settings = NovelStorage.getSettings();
    const activeProvider = NovelStorage.getActiveProvider();
    const providerConfig = NovelStorage.getProviderConfig(activeProvider);
    const provider = NovelProviders.getProvider(activeProvider);

    console.log('[initializeSettingsUI] 活跃提供商:', activeProvider);
    console.log('[initializeSettingsUI] 提供商配置:', providerConfig);
    console.log('[initializeSettingsUI] 提供商信息:', provider);

    // 优先从多提供商配置读取，否则回退到旧设置
    const apiKey = providerConfig.apiKey || settings.api_key || '';
    const baseUrl = providerConfig.baseUrl || settings.base_url || (provider ? provider.baseUrl : '');
    const model = providerConfig.model || settings.model || (provider ? provider.defaultModel : 'qwen-plus');
    const temperature = settings.temperature || 0.8;

    console.log('[initializeSettingsUI] 最终模型:', model);

    // 步骤 1: 先设置渠道下拉框为用户配置的渠道（关键！）
    document.getElementById('s-channel').value = activeProvider || 'dashscope';
    
    // 步骤 2: 填充 API Key 和 Base URL
    document.getElementById('s-api-key').value = apiKey;
    document.getElementById('s-base-url').value = baseUrl;
    
    // 步骤 3: 根据已设置的渠道更新模型列表（此时渠道已经是用户配置的值）
    updateModelOptions(activeProvider, model);
    
    // 步骤 4: 设置温度
    document.getElementById('s-temp').value = temperature;
    document.getElementById('s-temp-label').textContent = temperature.toFixed(2);
    
    console.log('[initializeSettingsUI] 设置 UI 初始化完成');
  }

  /**
   * HTML 转义辅助函数
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  return {
    showCreateModal,
    closeModal,
    showEditModal,
    closeEditModal,
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
    parseTextToOutline,
    renderCharactersList
  };
})();
