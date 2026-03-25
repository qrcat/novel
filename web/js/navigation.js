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
   * 显示指定标签页
   */
  function showTab(tabName) {
    // 切换右侧 Tab 面板（仅 output 和 outline）
    ['output', 'outline'].forEach(t => {
      const panel = document.getElementById('panel-' + t);
      const tab = document.getElementById('tab-' + t);
      if (panel) panel.classList.toggle('hidden', t !== tabName);
      if (tab) tab.classList.toggle('active', t === tabName);
    });
    
    // 注意：中间区域的 novel-panel 和 outline-panel 不由右侧 Tab 控制
    // 它们由中间的"正文"和"大纲"按钮独立控制
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
   * 更新项目页面的 header
   */
  function updateHeaderForProject() {
    if (!currentProject) return;
    const actions = document.getElementById('header-actions');
    if (!actions) return;
    
    actions.innerHTML = `
      <span class="toolbar-label">${NovelUtils.escape(currentProject.title)}</span>
      <button class="btn btn-ghost" id="btn-save-nav">保存</button>
      <button class="btn btn-ghost" id="btn-export-nav">导出</button>
      <button class="btn btn-ghost" id="btn-settings-nav">⚙️ 设置</button>
    `;

    document.getElementById('btn-save-nav')?.addEventListener('click', () => saveCurrentProject());
    document.getElementById('btn-export-nav')?.addEventListener('click', () => NovelUI.exportProject());
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
    const outlineContainer = document.getElementById('outline-container');
    const outlineEmpty = document.getElementById('outline-empty');
    const outlineContent = document.getElementById('outline-content');
    
    if (currentProject.outline && Object.keys(currentProject.outline).length) {
      if (infoStatus) infoStatus.textContent = '大纲就绪';
      document.getElementById('btn-round')?.removeAttribute('disabled');
      document.getElementById('btn-round2')?.removeAttribute('disabled');
      
      // 大纲已就绪，禁用生成按钮
      const btnOutline = document.getElementById('btn-outline');
      if (btnOutline) {
        btnOutline.disabled = true;
        btnOutline.style.opacity = '0.5';
        btnOutline.style.cursor = 'not-allowed';
      }
      
      // 显示大纲容器和内容
      if (outlineContainer) {
        outlineContainer.classList.remove('hidden');
        outlineContainer.style.display = 'flex';
      }
      if (outlineEmpty) outlineEmpty.classList.add('hidden');
      if (outlineContent) outlineContent.classList.remove('hidden');
      
      renderOutline(currentProject.outline);
    } else {
      if (infoStatus) infoStatus.textContent = '等待大纲';
      document.getElementById('btn-round')?.setAttribute('disabled', 'disabled');
      document.getElementById('btn-round2')?.setAttribute('disabled', 'disabled');
      
      // 没有大纲，隐藏 + 章节按钮
      const btnAddOutlineChapter = document.getElementById('btn-add-outline-chapter');
      if (btnAddOutlineChapter) btnAddOutlineChapter.style.display = 'none';
      
      // 隐藏大纲容器，显示空状态
      if (outlineContainer) {
        outlineContainer.classList.add('hidden');
      }
      if (outlineEmpty) outlineEmpty.classList.remove('hidden');
      if (outlineContent) outlineContent.classList.add('hidden');
    }

    // 渲染角色列表（无论是否为空都调用）
    renderCharListPreview(currentProject.characters || []);
    
    // 同时渲染右侧面板的角色列表
    if (typeof NovelUI !== 'undefined' && typeof NovelUI.renderCharactersList === 'function') {
      NovelUI.renderCharactersList();
    }

    // 渲染小说文本（过滤章节标记）
    if (currentProject.novel_text) {
      const novelPanel = document.getElementById('novel-panel');
      const novelTabContent = document.getElementById('novel-tab-content');
      const novelEditor = document.getElementById('novel-editor');
      
      // 过滤掉 [StartOfChapter:x] 和 [EndOfChapter:x] 标记
      const filteredText = currentProject.novel_text
        .replace(/\[StartOfChapter:\d+\]/g, '')
        .replace(/\[EndOfChapter:\d+\]/g, '')
        .trim();
      
      if (novelPanel) novelPanel.textContent = filteredText;
      if (novelTabContent) novelTabContent.textContent = filteredText;
      // 同步到编辑器（隐藏状态下），编辑时保留原始标记以便保存
      if (novelEditor) novelEditor.value = currentProject.novel_text;
    }
  }

  /**
   * 渲染大纲内容
   */
  function renderOutline(outline) {
    const main = document.getElementById('outline-content');
    const side = document.getElementById('outline-sidebar-content');
    const outlineEmpty = document.getElementById('outline-empty');
    if (!main || !side) return;

    let mainHTML = '';
    let sideHTML = '';

    // 主题信息
    const theme = outline.theme || {};
    if (theme.theme) {
      mainHTML += `<div class="theme-block">
        <div class="panel-title" style="margin-bottom:.5rem">核心主旨</div>
        <div class="theme-text editable-field" data-field="theme_theme">${NovelUtils.escape(theme.theme)}</div>
        ${theme.purpose ? '<div class="theme-purpose editable-field" data-field="theme_purpose">' + NovelUtils.escape(theme.purpose) + '</div>' : '<div class="theme-purpose editable-field empty-hint" data-field="theme_purpose" style="font-style:italic;color:var(--border)">[点击添加目的]</div>'}
      </div>`;
    } else {
      mainHTML += `<div class="theme-block">
        <div class="panel-title" style="margin-bottom:.5rem">核心主旨</div>
        <div class="theme-text editable-field empty-hint" data-field="theme_theme" style="font-style:italic;color:var(--border)">[点击添加核心主旨]</div>
        <div class="theme-purpose editable-field empty-hint" data-field="theme_purpose" style="font-style:italic;color:var(--border)">[点击添加目的]</div>
      </div>`;
    }

    // 段落剧情
    if (outline.plot_paragraph) {
      mainHTML += `<div style="margin-bottom:1.25rem">
        <div class="panel-title" style="margin-bottom:.5rem">段落剧情</div>
        <p class="editable-field" data-field="plot_paragraph" style="font-size:.88rem;line-height:1.8;cursor:text">${NovelUtils.escape(outline.plot_paragraph)}</p>
      </div>`;
    } else {
      mainHTML += `<div style="margin-bottom:1.25rem">
        <div class="panel-title" style="margin-bottom:.5rem">段落剧情</div>
        <p class="editable-field empty-hint" data-field="plot_paragraph" style="font-size:.88rem;line-height:1.8;font-style:italic;color:var(--border);cursor:text">[点击添加段落剧情]</p>
      </div>`;
    }

    // 世界观（从右侧边栏移到中间区域）
    if (outline.world_building && Object.keys(outline.world_building).length) {
      const wb = outline.world_building;
      mainHTML += `<div style="margin-bottom:1.25rem">
        <div class="panel-title" style="margin-bottom:.5rem">世界观</div>
        <div class="info-block">
          ${wb.time_period ? `<div class="info-row"><span class="info-label">时代</span><span class="info-value editable-field" data-field="time_period">${NovelUtils.escape(wb.time_period)}</span></div>` : '<div class="info-row"><span class="info-label">时代</span><span class="info-value editable-field empty-hint" data-field="time_period" style="font-style:italic;color:var(--border)">[点击添加]</span></div>'}
          ${wb.location ? `<div class="info-row"><span class="info-label">地点</span><span class="info-value editable-field" data-field="location">${NovelUtils.escape(wb.location)}</span></div>` : '<div class="info-row"><span class="info-label">地点</span><span class="info-value editable-field empty-hint" data-field="location" style="font-style:italic;color:var(--border)">[点击添加]</span></div>'}
          ${wb.atmosphere ? `<div class="info-row"><span class="info-label">氛围</span><span class="info-value editable-field" data-field="atmosphere">${NovelUtils.escape(wb.atmosphere)}</span></div>` : '<div class="info-row"><span class="info-label">氛围</span><span class="info-value editable-field empty-hint" data-field="atmosphere" style="font-style:italic;color:var(--border)">[点击添加]</span></div>'}
          ${wb.rules_of_world && wb.rules_of_world.length ? `<div class="world-rules"><strong>规则</strong>${wb.rules_of_world.map(r => `<div class="editable-field" data-field="rule_item" style="padding:.25rem 0;font-size:.82rem">• ${NovelUtils.escape(r)}</div>`).join('')}</div>` : '<div class="world-rules"><strong>规则</strong><div class="editable-field empty-hint" data-field="add_rule" style="font-style:italic;color:var(--border)">[点击添加世界规则]</div></div>'}
        </div>
      </div>`;
    }

    // 章节列表
    if (outline.chapters && outline.chapters.length) {
      mainHTML += `<div style="margin-bottom:1.25rem">
        <div class="panel-title" style="margin-bottom:.5rem; display:flex; justify-content:space-between; align-items:center;">
          <span>章节列表</span>
          <span style="font-size:.75rem; color:var(--muted); font-family:'DM Mono',monospace">共 ${outline.chapters.length} 章 · 点击卡片右上角可编辑/删除</span>
        </div>
        ${outline.chapters.map((ch, idx) => `
          <div class="chapter-block chapter-editable" data-idx="${idx}" style="position:relative; cursor:pointer;">
            <div style="position:absolute;top:.5rem;right:.5rem;display:flex;gap:.25rem;opacity:0;transition:opacity .15s" class="chapter-actions">
              <button class="icon-btn chapter-edit-btn" data-idx="${idx}" title="编辑">✎</button>
              <button class="icon-btn danger chapter-del-btn" data-idx="${idx}" title="删除">✕</button>
            </div>
            <div class="chapter-num">第${ch.chapter_number}章</div>
            <div class="chapter-title editable-field" data-field="chapter_title">${NovelUtils.escape(ch.chapter_title || '')}</div>
            <div class="chapter-one-sentence editable-field" data-field="one_sentence" style="min-height:1.6em">${NovelUtils.escape(ch.one_sentence || '')}</div>
            ${ch.expanded_paragraph ? `<div class="editable-field" data-field="expanded_paragraph" style="font-size:.82rem;color:var(--muted);margin-top:.4rem;line-height:1.6">${NovelUtils.escape(ch.expanded_paragraph)}</div>` : '<div class="editable-field empty-hint" data-field="expanded_paragraph" style="font-size:.82rem;color:var(--border);margin-top:.4rem;line-height:1.6;font-style:italic">[点击添加详细内容]</div>'}
            ${ch.scene_setting ? `<div class="editable-field" data-field="scene_setting" style="font-size:.78rem;color:#8b5cf6;margin-top:.3rem"><span style="color:#a78bfa;font-weight:bold">场景：</span><span class="scene-content">${NovelUtils.escape(ch.scene_setting)}</span></div>` : '<div class="editable-field empty-hint" data-field="scene_setting" style="font-size:.78rem;color:var(--border);margin-top:.3rem;font-style:italic">[点击添加场景设定]</div>'}
            ${ch.key_events && ch.key_events.length ? `<div class="chapter-meta editable-field" data-field="key_events"><span class="cur">关键事件</span>${ch.key_events.map(e => `<span>${NovelUtils.escape(e)}</span>`).join('')}</div>` : '<div class="chapter-meta editable-field empty-hint" data-field="key_events" style="margin-top:.4rem"><span style="color:var(--border);font-size:.75rem;font-style:italic">[点击添加关键事件]</span></div>'}
          </div>
        `).join('')}
      </div>`;
    }

    // 角色弧线（用于右侧边栏）
    if (outline.character_arcs && outline.character_arcs.length) {
      sideHTML += `<div style="margin-bottom:1rem">
        <div class="panel-title" style="margin-bottom:.5rem">角色弧线</div>
        ${outline.character_arcs.map(arc => `
          <div class="arc-block">
            <div class="arc-name">${NovelUtils.escape(arc.character_name || '')}</div>
            <div style="font-size:.78rem;color:var(--muted);margin-top:.3rem;line-height:1.6">
              ${arc.initial_state ? '初始：' + NovelUtils.escape(arc.initial_state) + '<br>' : ''}
              ${arc.final_state ? '终态：' + NovelUtils.escape(arc.final_state) : ''}
            </div>
          </div>
        `).join('')}
      </div>`;
    }

    // 更新中间区域
    main.innerHTML = mainHTML || '<div style="color:var(--muted);text-align:center;padding:3rem">大纲内容为空</div>';
    
    // 更新右侧边栏
    sideHTML = sideHTML || '<div style="color:var(--muted);font-size:.85rem">暂无大纲概要</div>';
    side.innerHTML = sideHTML;

    // 显示/隐藏空状态提示
    if (outlineEmpty) {
      outlineEmpty.classList.add('hidden');
    }
    main.classList.remove('hidden');

    // 为章节的编辑和删除按钮绑定事件
    main.querySelectorAll('.chapter-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-idx'));
        NovelUI.editOutlineChapter(idx);
      });
    });
    
    main.querySelectorAll('.chapter-del-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-idx'));
        NovelUI.deleteOutlineChapter(idx);
      });
    });

    // 为可编辑字段添加点击编辑功能
    main.querySelectorAll('.editable-field').forEach(field => {
      field.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // 检查是否属于章节卡片
        const chapterBlock = field.closest('.chapter-editable');
        if (chapterBlock) {
          // 章节字段编辑
          const chapterIdx = parseInt(chapterBlock.getAttribute('data-idx'));
          const fieldName = field.getAttribute('data-field');
          const currentValue = field.classList.contains('empty-hint') ? '' : field.textContent.trim();
          
          // 创建编辑模式
          enableInlineEdit(field, chapterIdx, fieldName, currentValue);
        } else {
          // 全局字段编辑（主题、段落剧情、世界观）
          const fieldName = field.getAttribute('data-field');
          const isEmptyHint = field.classList.contains('empty-hint');
          const emptyHints = ['[点击添加核心主旨]', '[点击添加目的]', '[点击添加段落剧情]', '[点击添加]', '[点击添加世界规则]'];
          
          // 提取纯内容值，过滤掉特殊符号和提示文字
          let currentValue = '';
          if (!isEmptyHint && !emptyHints.some(hint => field.textContent.includes(hint))) {
            // 对于规则项，需要移除"• "前缀
            const text = field.textContent.trim();
            currentValue = text.startsWith('•') ? text.substring(1).trim() : text;
          }
          
          // 特殊处理"添加世界规则"
          if (fieldName === 'add_rule') {
            addWorldRule(project);
          } else {
            // 创建编辑模式
            enableGlobalFieldEdit(field, fieldName, currentValue);
          }
        }
      });
    });
  }

  /**
   * 启用内联编辑模式
   */
  function enableInlineEdit(fieldElement, chapterIndex, fieldName, currentValue) {
    // 如果已经在编辑模式，不重复创建
    if (fieldElement.querySelector('input') || fieldElement.querySelector('textarea')) return;

    const project = getCurrentProject();
    if (!project || !project.outline || !project.outline.chapters[chapterIndex]) return;

    const chapter = project.outline.chapters[chapterIndex];
    
    // 根据字段类型创建不同的编辑器
    let editor;
    if (fieldName === 'key_events') {
      // 关键事件使用逗号分隔的输入框
      const eventsArray = Array.isArray(chapter.key_events) ? chapter.key_events : [];
      editor = document.createElement('input');
      editor.type = 'text';
      editor.value = eventsArray.join(', ');
      editor.placeholder = '用英文逗号分隔多个事件';
      editor.style.cssText = 'width:100%; padding:.3rem .5rem; font-size:.75rem; background:var(--surface2); border:1px solid var(--accent); border-radius:4px; color:var(--text); font-family:inherit;';
      
      editor.addEventListener('blur', () => {
        const newValue = editor.value.trim();
        // 使用英文逗号分割，并过滤空白项
        const eventsArray = newValue.split(/,/).map(s => s.trim()).filter(s => s);
        chapter.key_events = eventsArray;
        saveAndRefresh(project);
      });
    } else if (fieldName === 'expanded_paragraph' || fieldName === 'scene_setting') {
      // 详细内容使用多行文本框
      editor = document.createElement('textarea');
      editor.value = currentValue;
      editor.placeholder = fieldName === 'expanded_paragraph' ? '添加本章详细内容...' : '添加场景设定...';
      editor.rows = 3;
      editor.style.cssText = 'width:100%; padding:.3rem .5rem; font-size:.82rem; background:var(--surface2); border:1px solid var(--accent); border-radius:4px; color:var(--text); font-family:inherit; resize:vertical;';
      
      editor.addEventListener('blur', () => {
        const newValue = editor.value.trim();
        chapter[fieldName] = newValue;
        saveAndRefresh(project);
      });
    } else {
      // 其他字段使用单行输入框
      editor = document.createElement('input');
      editor.type = 'text';
      editor.value = currentValue;
      editor.placeholder = '点击输入内容';
      editor.style.cssText = 'width:100%; padding:.3rem .5rem; font-size:.85rem; background:var(--surface2); border:1px solid var(--accent); border-radius:4px; color:var(--text); font-family:inherit;';
      
      editor.addEventListener('blur', () => {
        const newValue = editor.value.trim();
        chapter[fieldName] = newValue;
        saveAndRefresh(project);
      });
    }

    // 处理 Enter 键保存
    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && fieldName !== 'expanded_paragraph') {
        e.preventDefault();
        editor.blur();
      }
      if (e.key === 'Escape') {
        renderOutline(project.outline); // 重新渲染，放弃修改
      }
    });

    // 替换原内容
    const originalContent = fieldElement.innerHTML;
    fieldElement.setAttribute('data-original-html', originalContent);
    fieldElement.innerHTML = '';
    fieldElement.appendChild(editor);
    
    // 聚焦编辑器
    setTimeout(() => editor.focus(), 10);
  }

  /**
   * 启用全局字段编辑模式（主题、段落剧情）
   */
  function enableGlobalFieldEdit(fieldElement, fieldName, currentValue) {
    // 如果已经在编辑模式，不重复创建
    if (fieldElement.querySelector('input') || fieldElement.querySelector('textarea')) return;

    const project = getCurrentProject();
    if (!project || !project.outline) return;

    const outline = project.outline;
    
    // 根据字段类型创建不同的编辑器
    let editor;
    
    // 解析字段名，获取实际的数据路径
    if (fieldName === 'theme_theme' || fieldName === 'theme_purpose') {
      // 主题相关字段
      if (!outline.theme) outline.theme = {};
      
      if (fieldName === 'theme_purpose') {
        // 目的使用多行文本框
        editor = document.createElement('textarea');
        editor.value = currentValue;
        editor.placeholder = '添加主题的目的或用途...';
        editor.rows = 2;
        editor.style.cssText = 'width:100%; padding:.3rem .5rem; font-size:.82rem; background:var(--surface2); border:1px solid var(--accent); border-radius:4px; color:var(--text); font-family:inherit; resize:vertical;';
        
        editor.addEventListener('blur', () => {
          const newValue = editor.value.trim();
          outline.theme.purpose = newValue;
          saveAndRefresh(project);
        });
      } else {
        // 核心主旨使用单行输入框（类似 key_events）
        editor = document.createElement('input');
        editor.type = 'text';
        editor.value = currentValue;
        editor.placeholder = '添加故事的核心主旨...';
        editor.style.cssText = 'width:100%; padding:.3rem .5rem; font-size:.85rem; background:var(--surface2); border:1px solid var(--accent); border-radius:4px; color:var(--text); font-family:inherit;';
        
        editor.addEventListener('blur', () => {
          const newValue = editor.value.trim();
          outline.theme.theme = newValue;
          saveAndRefresh(project);
        });
      }
    } else if (fieldName === 'plot_paragraph') {
      // 段落剧情使用多行文本框
      editor = document.createElement('textarea');
      editor.value = currentValue;
      editor.placeholder = '用一段连贯的文字概述整体剧情...';
      editor.rows = 5;
      editor.style.cssText = 'width:100%; padding:.3rem .5rem; font-size:.88rem; background:var(--surface2); border:1px solid var(--accent); border-radius:4px; color:var(--text); font-family:inherit; resize:vertical; line-height:1.8;';
      
      editor.addEventListener('blur', () => {
        const newValue = editor.value.trim();
        outline.plot_paragraph = newValue;
        saveAndRefresh(project);
      });
    } else if (fieldName === 'time_period' || fieldName === 'location' || fieldName === 'atmosphere') {
      // 世界观字段使用单行输入框（类似 theme.theme）
      if (!outline.world_building) outline.world_building = {};
      
      editor = document.createElement('input');
      editor.type = 'text';
      editor.value = currentValue;
      editor.placeholder = fieldName === 'time_period' ? '添加时代背景...' : 
                         fieldName === 'location' ? '添加故事地点...' : 
                         '添加氛围基调...';
      editor.style.cssText = 'width:100%; padding:.3rem .5rem; font-size:.85rem; background:var(--surface2); border:1px solid var(--accent); border-radius:4px; color:var(--text); font-family:inherit;';
      
      editor.addEventListener('blur', () => {
        const newValue = editor.value.trim();
        outline.world_building[fieldName] = newValue;
        saveAndRefresh(project);
      });
    } else if (fieldName === 'rule_item') {
      // 世界规则列表项编辑
      if (!outline.world_building) outline.world_building = {};
      if (!outline.world_building.rules_of_world) outline.world_building.rules_of_world = [];
      
      // 找到当前规则项的索引
      const ruleIndex = fieldElement.textContent.replace('• ', '').trim();
      const index = outline.world_building.rules_of_world.indexOf(ruleIndex);
      
      editor = document.createElement('input');
      editor.type = 'text';
      editor.value = currentValue;
      editor.placeholder = '添加世界规则...';
      editor.style.cssText = 'width:100%; padding:.3rem .5rem; font-size:.82rem; background:var(--surface2); border:1px solid var(--accent); border-radius:4px; color:var(--text); font-family:inherit;';
      
      editor.addEventListener('blur', () => {
        const newValue = editor.value.trim();
        if (index >= 0) {
          outline.world_building.rules_of_world[index] = newValue;
        }
        saveAndRefresh(project);
      });
    }

    // 处理 Enter 键保存（多行文本需要 Ctrl+Enter）
    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && editor.tagName.toLowerCase() !== 'textarea') {
        // 单行输入框直接 Enter 保存
        e.preventDefault();
        editor.blur();
      } else if (e.key === 'Enter' && e.ctrlKey && editor.tagName.toLowerCase() === 'textarea') {
        // 多行文本框需要 Ctrl+Enter
        e.preventDefault();
        editor.blur();
      }
      if (e.key === 'Escape') {
        renderOutline(outline); // 重新渲染，放弃修改
      }
    });

    // 替换原内容
    const originalContent = fieldElement.innerHTML;
    fieldElement.setAttribute('data-original-html', originalContent);
    fieldElement.innerHTML = '';
    fieldElement.appendChild(editor);
    
    // 聚焦编辑器
    setTimeout(() => editor.focus(), 10);
  }

  /**
   * 保存并刷新 UI
   */
  function saveAndRefresh(project) {
    NovelStorage.updateProject(project.id, { outline: project.outline });
    renderOutline(project.outline);
    NovelUtils.toast('已保存');
  }

  /**
   * 添加世界规则
   */
  function addWorldRule(project) {
    if (!project || !project.outline) return;
    
    if (!project.outline.world_building) {
      project.outline.world_building = {};
    }
    if (!project.outline.world_building.rules_of_world) {
      project.outline.world_building.rules_of_world = [];
    }
    
    // 添加一个空规则项
    project.outline.world_building.rules_of_world.push('新规则');
    
    // 持久化并刷新
    saveAndRefresh(project);
  }

  /**
   * 渲染角色列表预览
   */
  function renderCharListPreview(characters) {
    const el = document.getElementById('char-list');
    if (!el) return;
    
    if (!characters || !characters.length) {
      // 空状态显示
      el.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--muted);font-size:.85rem">' +
        '<div style="margin-bottom:.5rem">💀</div>' +
        '<div>暂无角色</div>' +
        '<div style="margin-top:.25rem;font-size:.75rem">生成大纲后会自动创建</div></div>';
      return;
    }
    
    el.innerHTML = characters.map((c, idx) => `
      <div class="char-card" data-char-idx="${idx}" style="position:relative">
        <div style="position:absolute;top:.3rem;right:.3rem;display:flex;gap:.2rem">
          <button class="icon-btn char-edit-btn" data-idx="${idx}" title="编辑">✎</button>
          <button class="icon-btn danger char-del-btn" data-idx="${idx}" title="删除">✕</button>
        </div>
        <div class="char-name">${NovelUtils.escape(c.character_name || c.name || '')}</div>
        <div class="char-desc">${NovelUtils.escape(c.personality || c.initial_state || '')}</div>
      </div>
    `).join('');
    
    // 绑定编辑和删除按钮的事件
    el.querySelectorAll('.char-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-idx'));
        NovelUI.editCharacter(idx);
      });
    });
    
    el.querySelectorAll('.char-del-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-idx'));
        NovelUI.deleteCharacter(idx);
      });
    });
  }

  /**
   * 初始化设置 UI
   */
  function initializeSettingsUI() {
    const settings = NovelStorage.getSettings();
    const activeProvider = NovelStorage.getActiveProvider();
    const providerConfig = NovelStorage.getProviderConfig(activeProvider);
    const provider = NovelProviders.getProvider(activeProvider);

    // 优先从多提供商配置读取，否则回退到旧设置
    const apiKey = providerConfig.apiKey || settings.api_key || '';
    const baseUrl = providerConfig.baseUrl || settings.base_url || (provider ? provider.baseUrl : '');
    const model = providerConfig.model || settings.model || (provider ? provider.defaultModel : 'qwen-plus');
    const temperature = settings.temperature || 0.8;

    document.getElementById('s-api-key').value = apiKey;
    document.getElementById('s-base-url').value = baseUrl;
    document.getElementById('s-channel').value = activeProvider || 'dashscope';
    
    // 先根据当前渠道初始化模型列表
    if (typeof NovelUI !== 'undefined' && typeof NovelUI.updateModelOptions === 'function') {
      NovelUI.updateModelOptions(activeProvider || 'dashscope', model);
    } else {
      // 如果 NovelUI 还未加载，直接设置值（向后兼容）
      document.getElementById('s-model').value = model;
    }
    
    document.getElementById('s-temp').value = temperature;
    document.getElementById('s-temp-label').textContent = temperature.toFixed(2);
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
    const activeProvider = NovelStorage.getActiveProvider();
    const providerConfig = NovelStorage.getProviderConfig(activeProvider);
    const provider = NovelProviders.getProvider(activeProvider);

    if (!provider) {
      return getFallbackSettings();
    }

    const baseUrl = activeProvider === 'custom' 
      ? (providerConfig.baseUrl || '') 
      : provider.baseUrl;

    return {
      provider: activeProvider,
      apiKey: providerConfig.apiKey || '',
      baseUrl: baseUrl,
      model: providerConfig.model || provider.defaultModel,
      temperature: NovelStorage.getSettings().temperature || 0.8,
      providerInfo: provider
    };
  }

  /**
   * 获取备用设置（当活跃提供商配置不完整时）
   */
  function getFallbackSettings() {
    const settings = NovelStorage.getSettings();
    return {
      provider: 'dashscope',
      apiKey: settings.api_key || '',
      baseUrl: settings.base_url || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: settings.model || 'qwen-plus',
      temperature: settings.temperature || 0.8,
      providerInfo: NovelProviders.getProvider('dashscope')
    };
  }

  return {
    getCurrentProject,
    setCurrentProject,
    goHome,
    openProject,
    goSettings,
    showTab,
    saveCurrentProject,
    renderProjectList,
    applyProjectToUI,
    renderOutline,
    clearOutput,
    getActiveSettings
  };
})();
