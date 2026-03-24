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
    const settings = {
      api_key: document.getElementById('s-api-key').value.trim(),
      base_url: document.getElementById('s-base-url').value.trim(),
      channel: document.getElementById('s-channel').value,
      model: document.getElementById('s-model').value,
      temperature: parseFloat(document.getElementById('s-temp').value)
    };
    NovelStorage.saveSettings(settings);
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
    const model = document.getElementById('s-model').value;

    if (!apiKey || !baseUrl) {
      el.textContent = '请先填入 API Key 和 Base URL';
      el.style.color = 'var(--danger)';
      return;
    }

    NovelAPI.testConnection(apiKey, baseUrl, model)
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
   * 应用页道默认设置
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
    ['output', 'novel', 'outline'].forEach(tab => {
      const el = document.getElementById('tab-' + tab);
      if (el) el.addEventListener('click', () => NovelNav.showTab(tab));
    });

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

    console.log('[NovelAgents] UI events bound');
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
    bindAllEvents
  };
})();
