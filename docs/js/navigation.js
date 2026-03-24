/**
 * Navigation Module
 * 处理页面导航和视图切换
 */
const NovelNav = (function() {
  let currentProject = null;

  /**
   * 获取当前项目
   */
  function getCurrentProject() {
    return currentProject;
  }

  /**
   * 设置当前项目
   */
  function setCurrentProject(project) {
    currentProject = project;
  }

  /**
   * 返回首页
   */
  function goHome() {
    currentProject = null;
    const pageHome = document.getElementById('page-home');
    const pageProject = document.getElementById('page-project');
    const pageSettings = document.getElementById('page-settings');
    const pageChars = document.getElementById('page-chars');

    if (pageHome) pageHome.classList.remove('hidden');
    if (pageProject) pageProject.classList.add('hidden');
    if (pageSettings) pageSettings.classList.add('hidden');
    if (pageChars) pageChars.classList.add('hidden');

    updateHeaderForHome();
    renderProjectList();
    console.log('[NovelAgents] Navigated to home');
  }

  /**
   * 打开项目
   */
  function openProject(projectId) {
    currentProject = NovelStorage.getProjectById(projectId);
    if (!currentProject) {
      goHome();
      return;
    }

    const pageHome = document.getElementById('page-home');
    const pageProject = document.getElementById('page-project');
    const pageSettings = document.getElementById('page-settings');
    const pageChars = document.getElementById('page-chars');

    if (pageHome) pageHome.classList.add('hidden');
    if (pageProject) pageProject.classList.remove('hidden');
    if (pageSettings) pageSettings.classList.add('hidden');
    if (pageChars) pageChars.classList.add('hidden');

    updateHeaderForProject();
    applyProjectToUI();
    console.log('[NovelAgents] Opened project:', currentProject.title);
  }

  /**
   * 打开项目设置页面
   */
  function goSettings(fromProject = false) {
    const pageHome = document.getElementById('page-home');
    const pageProject = document.getElementById('page-project');
    const pageSettings = document.getElementById('page-settings');
    const pageChars = document.getElementById('page-chars');

    if (pageHome) pageHome.classList.add('hidden');
    if (pageProject) pageProject.classList.add('hidden');
    if (pageSettings) pageSettings.classList.remove('hidden');
    if (pageChars) pageChars.classList.add('hidden');

    updateHeaderForSettings(fromProject);
    initializeSettingsUI();
  }

  /**
   * 打开角色管理页面
   */
  function openCharPage() {
    if (!currentProject) return;

    const pageHome = document.getElementById('page-home');
    const pageProject = document.getElementById('page-project');
    const pageSettings = document.getElementById('page-settings');
    const pageChars = document.getElementById('page-chars');

    if (pageHome) pageHome.classList.add('hidden');
    if (pageProject) pageProject.classList.add('hidden');
    if (pageSettings) pageSettings.classList.add('hidden');
    if (pageChars) pageChars.classList.remove('hidden');

    updateHeaderForProject();
    renderCharList();
  }

  /**
   * 显示指定标签页
   */
  function showTab(tabName) {
    const tabMap = {
      'output': ['panel-output', 'tab-output'],
      'novel': ['panel-novel', 'tab-novel'],
      'outline': ['panel-outline', 'tab-outline']
    };

    ['output', 'novel', 'outline'].forEach(t => {
      const panel = document.getElementById('panel-' + t);
      const tab = document.getElementById('tab-' + t);
      if (panel) panel.classList.toggle('hidden', t !== tabName && t !== 'output');
      if (tab) tab.classList.toggle('active', t === tabName);
    });
  }

  /**
   * 更新首页的header
   */
  function updateHeaderForHome() {
    const actions = document.getElementById('header-actions');
    if (!actions) return;
    actions.innerHTML = '<button class="btn btn-primary" id="btn-new-nav">+ 新建小说</button>';
    const btn = document.getElementById('btn-new-nav');
    if (btn) btn.addEventListener('click', () => NovelUI.showCreateModal());
  }

  /**
   * 更新项目页面的header
   */
  function updateHeaderForProject() {
    if (!currentProject) return;
    const actions = document.getElementById('header-actions');
    if (!actions) return;
    
    actions.innerHTML = `
      <span class="toolbar-label">${NovelUtils.escape(currentProject.title)}</span>
      <button class="btn btn-ghost" id="btn-save-nav">保存</button>
      <button class="btn btn-ghost" id="btn-export-nav">导出</button>
      <button class="btn btn-ghost" id="btn-chars-nav">👤 角色</button>
      <button class="btn btn-ghost" id="btn-settings-nav">⚙️ 设置</button>
    `;

    document.getElementById('btn-save-nav')?.addEventListener('click', () => saveCurrentProject());
    document.getElementById('btn-export-nav')?.addEventListener('click', () => NovelUI.exportProject());
    document.getElementById('btn-chars-nav')?.addEventListener('click', () => openCharPage());
    document.getElementById('btn-settings-nav')?.addEventListener('click', () => goSettings(true));
  }

  /**
   * 更新设置页面的header
   */
  function updateHeaderForSettings(fromProject = false) {
    const actions = document.getElementById('header-actions');
    if (!actions) return;
    actions.innerHTML = '<button class="btn btn-ghost" id="btn-back-from-settings">← 返回</button>';
    document.getElementById('btn-back-from-settings')?.addEventListener('click', () => {
      if (fromProject && currentProject) {
        openProject(currentProject.id);
      } else {
        goHome();
      }
    });
  }

  /**
   * 保存当前项目
   */
  function saveCurrentProject() {
    if (!currentProject) return;
    NovelStorage.updateProject(currentProject.id, currentProject);
    NovelUtils.toast('已保存');
  }

  /**
   * 渲染项目列表
   */
  function renderProjectList() {
    const projects = NovelStorage.getProjects();
    const grid = document.getElementById('project-grid');
    const empty = document.getElementById('empty-state');
    const count = document.getElementById('project-count');

    if (!grid || !empty || !count) return;

    count.textContent = projects.length + ' 部作品';

    if (!projects.length) {
      grid.innerHTML = '';
      empty.style.display = 'flex';
      return;
    }

    empty.style.display = 'none';
    grid.innerHTML = projects.map(p => `
      <div class="card" data-id="${p.id}">
        <div class="card-actions">
          <button class="icon-btn danger" data-del="${p.id}">✕</button>
        </div>
        <div class="card-genre">${NovelUtils.escape(p.genre || '未分类')}</div>
        <div class="card-title">${NovelUtils.escape(p.title)}</div>
        <div class="card-prompt">${NovelUtils.escape(p.initial_prompt || '')}</div>
        <div class="card-footer">
          <span class="card-meta">第 ${p.writing_chapter || 1} 章</span>
          <span class="card-meta">${NovelUtils.formatDate(p.updated_at)}</span>
        </div>
      </div>
    `).join('');

    // 绑定点击事件
    grid.querySelectorAll('.card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.dataset.del) return;
        openProject(card.dataset.id);
      });
    });

    // 绑定删除事件
    grid.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('确定删除？')) {
          NovelStorage.deleteProject(btn.dataset.del);
          renderProjectList();
          NovelUtils.toast('已删除');
        }
      });
    });
  }

  /**
   * 将项目数据应用到UI
   */
  function applyProjectToUI() {
    if (!currentProject) return;

    // 更新基本信息
    const infoTitle = document.getElementById('info-title');
    const infoGenre = document.getElementById('info-genre');
    const infoChapter = document.getElementById('info-chapter');
    const infoStatus = document.getElementById('info-status');

    if (infoTitle) infoTitle.textContent = currentProject.title || '-';
    if (infoGenre) infoGenre.textContent = currentProject.genre || '-';
    if (infoChapter) infoChapter.textContent = '第 ' + (currentProject.writing_chapter || 1) + ' 章';

    // 检查大纲状态
    if (currentProject.outline && Object.keys(currentProject.outline).length) {
      if (infoStatus) infoStatus.textContent = '大纲就绪';
      document.getElementById('btn-round')?.removeAttribute('disabled');
      document.getElementById('btn-round2')?.removeAttribute('disabled');
      renderOutline(currentProject.outline);
    } else {
      if (infoStatus) infoStatus.textContent = '等待大纲';
      document.getElementById('btn-round')?.setAttribute('disabled', 'disabled');
      document.getElementById('btn-round2')?.setAttribute('disabled', 'disabled');
    }

    // 渲染角色列表
    if (currentProject.characters && currentProject.characters.length) {
      renderCharListPreview(currentProject.characters);
    }

    // 渲染小说文本
    if (currentProject.novel_text) {
      const novelPanel = document.getElementById('novel-panel');
      if (novelPanel) novelPanel.textContent = currentProject.novel_text;
    }
  }

  /**
   * 渲染大纲内容
   */
  function renderOutline(outline) {
    const main = document.getElementById('outline-content');
    const side = document.getElementById('outline-sidebar-content');
    if (!main || !side) return;

    let mainHTML = '';
    let sideHTML = '';

    // 主题信息
    const theme = outline.theme || {};
    if (theme.theme) {
      mainHTML += `<div class="theme-block">
        <div class="panel-title" style="margin-bottom:.5rem">核心主旨</div>
        <div class="theme-text">${NovelUtils.escape(theme.theme)}</div>
        ${theme.purpose ? '<div class="theme-purpose">' + NovelUtils.escape(theme.purpose) + '</div>' : ''}
      </div>`;
    }

    // 段落剧情
    if (outline.plot_paragraph) {
      mainHTML += `<div style="margin-bottom:1.25rem">
        <div class="panel-title" style="margin-bottom:.5rem">段落剧情</div>
        <p style="font-size:.88rem;line-height:1.8">${NovelUtils.escape(outline.plot_paragraph)}</p>
      </div>`;
    }

    main.innerHTML = mainHTML || '<div style="color:var(--muted);text-align:center;padding:3rem">大纲内容为空</div>';
    sideHTML = sideHTML || '<div style="color:var(--muted);font-size:.85rem">暂无大纲概要</div>';
    side.innerHTML = sideHTML;
  }

  /**
   * 渲染角色列表预览
   */
  function renderCharListPreview(characters) {
    const el = document.getElementById('char-list');
    if (!el) return;
    el.innerHTML = characters.map(c => `
      <div class="char-card">
        <div class="char-name">${NovelUtils.escape(c.character_name || c.name || '')}</div>
        <div class="char-desc">${NovelUtils.escape(c.personality || c.initial_state || '')}</div>
      </div>
    `).join('');
  }

  /**
   * 初始化设置UI
   */
  function initializeSettingsUI() {
    const settings = NovelStorage.getSettings();
    document.getElementById('s-api-key').value = settings.api_key || '';
    document.getElementById('s-base-url').value = settings.base_url || '';
    document.getElementById('s-channel').value = settings.channel || 'dashscope';
    document.getElementById('s-model').value = settings.model || 'qwen-plus';
    document.getElementById('s-temp').value = settings.temperature || 0.8;
    document.getElementById('s-temp-label').textContent = (settings.temperature || 0.8).toFixed(2);
  }

  /**
   * 清空输出框
   */
  function clearOutput() {
    const el = document.getElementById('output-box');
    if (el) el.textContent = '';
  }

  /**
   * 获取当前活跃的设置（项目设置优先于全局设置）
   */
  function getActiveSettings() {
    const globalSettings = NovelStorage.getSettings();
    if (!currentProject) return globalSettings;

    return {
      apiKey: currentProject.api_key || globalSettings.api_key,
      baseUrl: currentProject.base_url || globalSettings.base_url,
      model: currentProject.model || globalSettings.model,
      temperature: currentProject.temperature || globalSettings.temperature
    };
  }

  return {
    getCurrentProject,
    setCurrentProject,
    goHome,
    openProject,
    goSettings,
    openCharPage,
    showTab,
    saveCurrentProject,
    renderProjectList,
    applyProjectToUI,
    clearOutput,
    getActiveSettings
  };
})();
