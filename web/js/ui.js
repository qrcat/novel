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
        // 显示中间区域的 novel-panel，隐藏 outline-panel
        const novelPanel = document.getElementById('novel-panel');
        const outlinePanel = document.getElementById('outline-panel');
        if (novelPanel) {
          novelPanel.classList.remove('hidden');
          novelPanel.style.display = '';
        }
        if (outlinePanel) {
          outlinePanel.classList.add('hidden');
          outlinePanel.style.display = 'none';
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

    NovelProject.addCharacter(project.id, character);
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

    char.character_name = newName;
    char.name = newName;
    char.personality = newPersonality || char.personality;
    char.initial_state = newPersonality || char.initial_state;

    NovelProject.updateProject(project.id, { characters: project.characters });
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

    project.characters.splice(index, 1);
    NovelProject.updateProject(project.id, { characters: project.characters });
    NovelNav.applyProjectToUI();
    NovelUtils.toast('已删除角色');
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
    showAddCharModal
  };
})();
