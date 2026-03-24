/**
 * Novel Agents - Web Frontend
 * Single-page app with localStorage persistence, direct LLM API calls from browser
 */
(function() {
  'use strict';
  console.log('[NovelAgents] Script loaded');

  // ── Global Settings ─────────────────────────────────────────────
  var GLOBAL_KEY = 'na_settings';

  function getSettings() {
    var s = localStorage.getItem(GLOBAL_KEY);
    return s ? JSON.parse(s) : {
      api_key: '',
      base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      channel: 'dashscope',
      model: 'qwen-plus',
      temperature: 0.8
    };
  }

  function saveSettings(s) {
    localStorage.setItem(GLOBAL_KEY, JSON.stringify(s));
  }

  // ── State ─────────────────────────────────────────────────────────
  var projects    = JSON.parse(localStorage.getItem('na_projects') || '[]');
  var currentProject = null;
  var generating  = false;

  // ── Utilities ─────────────────────────────────────────────────────
  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function fmtDate(iso) {
    var d = new Date(iso || Date.now());
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
           String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  }

  function fmtTime() {
    var d = new Date();
    return String(d.getHours()).padStart(2,'0') + ':' +
           String(d.getMinutes()).padStart(2,'0') + ':' +
           String(d.getSeconds()).padStart(2,'0');
  }

  function save() {
    localStorage.setItem('na_projects', JSON.stringify(projects));
  }

  function toast(msg, type) {
    type = type || '';
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast' + (type ? ' ' + type : '');
    t.style.display = 'block';
    setTimeout(function() { t.style.display = 'none'; }, 2500);
  }

  function log(msg, kind) {
    var el = document.getElementById('output-box');
    if (!el) return;
    var div = document.createElement('div');
    div.className = 'log-entry' + (kind ? ' log-' + kind : '');
    div.textContent = '[' + fmtTime() + '] ' + msg;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  }

  function setProgress(pct) {
    var bar = document.getElementById('progress-bar');
    var fill = document.getElementById('progress-fill');
    if (!bar || !fill) return;
    bar.style.display = 'block';
    fill.style.width = pct + '%';
  }

  function setBtns(disabled) {
    ['btn-outline','btn-round','btn-outline2','btn-round2'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.disabled = disabled;
    });
  }

  // ── Navigation ───────────────────────────────────────────────────
  function goHome() {
    currentProject = null;
    document.getElementById('page-home').classList.remove('hidden');
    document.getElementById('page-project').classList.add('hidden');
    document.getElementById('header-actions').innerHTML =
      '<button class="btn btn-primary" id="btn-new-nav">+ 新建小说</button>';
    var btn = document.getElementById('btn-new-nav');
    if (btn) btn.addEventListener('click', showModal);
    var btnS = document.getElementById('btn-settings-nav');
    if (btnS) btnS.addEventListener('click', goSettings);
    renderHome();
    console.log('[NovelAgents] goHome done');
  }

  function openProject(id) {
    currentProject = projects.find(function(p) { return p.id === id; });
    if (!currentProject) { goHome(); return; }
    document.getElementById('page-home').classList.add('hidden');
    document.getElementById('page-project').classList.remove('hidden');
    document.getElementById('header-actions').innerHTML =
      '<span class="toolbar-label">' + esc(currentProject.title) + '</span>' +
      '<button class="btn btn-ghost" id="btn-save-nav">保存</button>' +
      '<button class="btn btn-ghost" id="btn-settings-nav2">&#9881; 设置</button>';
    var saveBtn = document.getElementById('btn-save-nav');
    if (saveBtn) saveBtn.addEventListener('click', saveProject);
    applyProject();
    console.log('[NovelAgents] openProject:', currentProject.title);
  }

  function renderHome() {
    document.getElementById('project-count').textContent = projects.length + ' 部作品';
    var grid = document.getElementById('project-grid');
    var empty = document.getElementById('empty-state');
    if (!projects.length) {
      grid.innerHTML = '';
      empty.style.display = 'flex';
      return;
    }
    empty.style.display = 'none';
    grid.innerHTML = projects.map(function(p) {
      return '<div class="card" data-id="' + p.id + '">' +
        '<div class="card-actions">' +
          '<button class="icon-btn danger" data-del="' + p.id + '">&#10005;</button>' +
        '</div>' +
        '<div class="card-genre">' + esc(p.genre || '未分类') + '</div>' +
        '<div class="card-title">' + esc(p.title) + '</div>' +
        '<div class="card-prompt">' + esc(p.initial_prompt || '') + '</div>' +
        '<div class="card-footer">' +
          '<span class="card-meta">第 ' + (p.writing_chapter || 1) + ' 章</span>' +
          '<span class="card-meta">' + fmtDate(p.updated_at) + '</span>' +
        '</div>' +
      '</div>';
    }).join('');

    grid.querySelectorAll('.card').forEach(function(card) {
      card.addEventListener('click', function(e) {
        if (e.target.dataset.del) return;
        openProject(card.dataset.id);
      });
    });

    grid.querySelectorAll('[data-del]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (confirm('确定删除？')) {
          projects = projects.filter(function(p) { return p.id !== btn.dataset.del; });
          save();
          renderHome();
        }
      });
    });
  }

  // ── Modal ────────────────────────────────────────────────────────
  function showModal() {
    console.log('[NovelAgents] showModal');
    document.getElementById('modal-overlay').classList.remove('hidden');
  }
  function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  }

  // ── Project CRUD ─────────────────────────────────────────────────
  function createProject(e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var proj = {
      id: uuid(),
      title: fd.get('title'),
      genre: fd.get('genre'),
      initial_prompt: fd.get('initial_prompt'),
      outline: null,
      characters: [],
      novel_text: '',
      conv_history: [],
      writing_chapter: 1,
      current_scene: '',
      api_key: '',
      base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen-plus',
      temperature: 0.8,
      updated_at: new Date().toISOString()
    };
    projects.unshift(proj);
    save();
    closeModal();
    openProject(proj.id);
    toast('项目已创建');
  }

  function saveProject() {
    if (!currentProject) return;
    currentProject.api_key    = document.getElementById('cfg-api-key').value.trim();
    currentProject.base_url   = document.getElementById('cfg-base-url').value.trim();
    currentProject.model      = document.getElementById('cfg-model').value;
    currentProject.temperature = parseFloat(document.getElementById('cfg-temp').value);
    currentProject.updated_at = new Date().toISOString();
    save();
    toast('已保存');
  }

  function deleteCurrentProject() {
    if (!currentProject || !confirm('确定删除此项目？')) return;
    projects = projects.filter(function(p) { return p.id !== currentProject.id; });
    save();
    goHome();
  }

  function exportProject() {
    if (!currentProject) return;
    var blob = new Blob([JSON.stringify(currentProject, null, 2)], {type: 'application/json'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (currentProject.title || 'novel') + '.json';
    a.click();
  }

  // ── Project Edit ─────────────────────────────────────────────────
  function openProjectEditModal() {
    if (!currentProject) return;
    var p = currentProject;
    document.getElementById('pe-title').value = p.title || '';
    document.getElementById('pe-genre').value = p.genre || '悬疑推理';
    document.getElementById('pe-initial-prompt').value = p.initial_prompt || '';
    document.getElementById('project-edit-modal').classList.remove('hidden');
    document.getElementById('pe-title').focus();
  }

  function closeProjectEditModal() {
    document.getElementById('project-edit-modal').classList.add('hidden');
  }

  function saveProjectEdit(e) {
    e.preventDefault();
    if (!currentProject) return;
    currentProject.title = document.getElementById('pe-title').value.trim();
    currentProject.genre = document.getElementById('pe-genre').value;
    currentProject.initial_prompt = document.getElementById('pe-initial-prompt').value.trim();
    currentProject.updated_at = new Date().toISOString();
    save();
    closeProjectEditModal();
    applyProject();
    document.getElementById('proj-title-label').textContent = currentProject.title || '';
    toast('项目已更新');
  }

  // ── Apply data to page ──────────────────────────────────────────
  function applyProject() {
    if (!currentProject) return;
    var p = currentProject;
    document.getElementById('info-title').textContent   = p.title || '-';
    document.getElementById('info-genre').textContent   = p.genre || '-';
    document.getElementById('info-chapter').textContent = '第 ' + (p.writing_chapter || 1) + ' 章';
    document.getElementById('info-chars').textContent   = (p.characters || []).length + ' 人';

    if (p.outline && Object.keys(p.outline).length) {
      document.getElementById('info-status').textContent = '大纲就绪';
      document.getElementById('btn-round').disabled = false;
      document.getElementById('btn-round2').disabled = false;
      renderOutline(p.outline);
      document.getElementById('outline-empty').style.display = 'none';
      document.getElementById('outline-content').classList.remove('hidden');
    } else {
      document.getElementById('info-status').textContent = '等待大纲';
      document.getElementById('btn-round').disabled = true;
      document.getElementById('btn-round2').disabled = true;
    }

    if (p.characters && p.characters.length) renderChars(p.characters);
    if (p.novel_text) {
      document.getElementById('novel-panel').textContent = p.novel_text;
      document.getElementById('novel-tab-content').textContent = p.novel_text;
    }
    if (p.api_key)    document.getElementById('cfg-api-key').value = p.api_key;
    if (p.base_url)   document.getElementById('cfg-base-url').value = p.base_url;
    if (p.model)       document.getElementById('cfg-model').value = p.model;
    if (p.temperature) {
      document.getElementById('cfg-temp').value = p.temperature;
      document.getElementById('temp-label').textContent = p.temperature.toFixed(2);
    }
    document.getElementById('cfg-temp').addEventListener('input', function(e) {
      document.getElementById('temp-label').textContent = parseFloat(e.target.value).toFixed(2);
    });
  }

  function renderChars(chars) {
    var el = document.getElementById('char-list');
    if (!chars || !chars.length) return;
    el.innerHTML = chars.map(function(c) {
      return '<div class="char-card"><div class="char-name">' + esc(c.character_name || c.name || '') + '</div>' +
             '<div class="char-desc">' + esc(c.personality || c.initial_state || '') + '</div></div>';
    }).join('');
    document.getElementById('info-chars').textContent = chars.length + ' 人';
  }

  function renderOutline(o) {
    var main = document.getElementById('outline-content');
    var side = document.getElementById('outline-sidebar-content');
    var m = '', s = '';
    var t = o.theme || {};
    if (t && t.theme) {
      m += '<div class="theme-block"><div class="panel-title" style="margin-bottom:.5rem">核心主旨</div>' +
           '<div class="theme-text">' + esc(t.theme) + '</div>' +
           (t.purpose ? '<div class="theme-purpose">' + esc(t.purpose) + '</div>' : '') + '</div>';
    }
    if (o.plot_paragraph) {
      m += '<div style="margin-bottom:1.25rem"><div class="panel-title" style="margin-bottom:.5rem">段落剧情</div>' +
           '<p style="font-size:.88rem;line-height:1.8">' + esc(o.plot_paragraph) + '</p></div>';
    }
    var w = o.world_building || {};
    if (w.location) {
      m += '<div style="margin-bottom:1.25rem"><div class="panel-title" style="margin-bottom:.75rem">世界观</div><div class="info-block">';
      if (w.time_period) m += '<div class="info-row"><span class="info-label">时间</span><span class="info-value">' + esc(w.time_period) + '</span></div>';
      if (w.location) m += '<div class="info-row"><span class="info-label">地点</span><span class="info-value">' + esc(w.location) + '</span></div>';
      if (w.atmosphere) m += '<div class="info-row"><span class="info-label">氛围</span><span class="info-value">' + esc(w.atmosphere) + '</span></div>';
      var rules = w.rules_of_world || [];
      rules.forEach(function(r) {
        m += '<div style="padding:.25rem 0;font-size:.82rem">&#9702; ' + esc(r) + '</div>';
      });
      m += '</div></div>';
    }
    var arcs = o.character_arcs || [];
    if (arcs.length) {
      m += '<div class="panel-title" style="margin-bottom:.75rem">角色弧线</div>';
      arcs.forEach(function(a) {
        m += '<div class="arc-block"><div class="arc-name">' + esc(a.character_name || '') + '</div>' +
             '<div class="arc-arrow">' + esc(a.initial_state || '') + ' &#8594; ' + esc(a.final_state || '') + '</div>';
        (a.key_changes || []).forEach(function(c) {
          m += '<div class="arc-arrow" style="color:var(--muted)">&#8226; ' + esc(c) + '</div>';
        });
        m += '</div>';
      });
      s += arcs.map(function(a) {
        return '<div style="margin-bottom:.75rem"><strong style="color:var(--accent2)">' + esc(a.character_name || '') + '</strong><br>' +
               '<span style="color:var(--muted)">' + esc(a.initial_state || '') + ' &#8594; ' + esc(a.final_state || '') + '</span></div>';
      }).join('');
    }
    var chapters = o.chapters || [];
    var cur = (currentProject && currentProject.writing_chapter) || 1;
    if (chapters.length) {
      m += '<div class="panel-title" style="margin-bottom:.75rem">章节规划</div>';
      chapters.forEach(function(ch) {
        var isCur = ch.chapter_number === cur;
        m += '<div class="chapter-block' + (isCur ? ' current' : '') + '">' +
             '<div class="chapter-num">第 ' + ch.chapter_number + ' 章</div>' +
             '<div class="chapter-title">' + esc(ch.chapter_title || '') + '</div>';
        if (ch.one_sentence) m += '<div class="chapter-one-sentence">' + esc(ch.one_sentence) + '</div>';
        if (ch.expanded_paragraph) m += '<p style="font-size:.8rem;color:var(--muted);margin:.4rem 0;line-height:1.6">' + esc(ch.expanded_paragraph) + '</p>';
        var names = (ch.characters_involved || []).map(function(c) {
          return '<span>' + esc(c) + '</span>';
        }).join('');
        if (isCur) names += '<span style="color:var(--accent)">&#9668; 当前</span>';
        m += '<div class="chapter-meta">' + names + '</div></div>';
      });
      s += '<div class="panel-title" style="margin-bottom:.5rem">章节</div>';
      s += chapters.map(function(ch) {
        return '<div style="padding:.3rem 0;border-bottom:1px solid var(--border)">' +
               '<span style="color:var(--accent)">' + ch.chapter_number + '.</span> ' + esc(ch.chapter_title || '') + '</div>';
      }).join('');
    }
    main.innerHTML = m || '<div style="color:var(--muted);text-align:center;padding:3rem">大纲内容为空</div>';
    side.innerHTML = s || '<div style="color:var(--muted);font-size:.85rem">暂无大纲概要</div>';
  }

  // ── Tabs ────────────────────────────────────────────────────────
  function showTab(tab) {
    ['output', 'novel', 'outline'].forEach(function(t) {
      var panel = document.getElementById('panel-' + t);
      var tabEl = document.getElementById('tab-' + t);
      if (panel) panel.classList.toggle('hidden', t !== tab && t !== 'output');
      if (tabEl) tabEl.classList.toggle('active', t === tab);
    });
    var mainOutline = document.getElementById('outline-panel');
    var mainNovel = document.getElementById('novel-panel');
    if (tab === 'outline') {
      if (mainOutline) mainOutline.style.display = '';
      if (mainNovel) mainNovel.style.display = 'none';
    } else if (tab === 'novel') {
      if (mainOutline) mainOutline.style.display = 'none';
      if (mainNovel) mainNovel.style.display = '';
    } else {
      if (mainOutline) mainOutline.style.display = 'none';
      if (mainNovel) mainNovel.style.display = 'none';
    }
  }

  // ── LLM API ─────────────────────────────────────────────────────
  function getActiveSettings(project) {
    var s = getSettings();
    return {
      apiKey:  project && project.api_key    ? project.api_key    : s.api_key,
      baseUrl: project && project.base_url   ? project.base_url   : s.base_url,
      model:   project && project.model      ? project.model      : s.model,
      temp:    project && project.temperature ? project.temperature : s.temperature
    };
  }

  function llmCall(messages, tools, model, apiKey, baseUrl, temperature, maxTokens, responseFormat) {
    var body = {
      model: model,
      messages: messages.map(function(m) {
        var o = { role: m.role, content: m.content };
        if (m.tool_calls) o.tool_calls = m.tool_calls;
        if (m.tool_call_id) { o.tool_call_id = m.tool_call_id; o.content = m.content; }
        return o;
      }),
      temperature: temperature || 0.8,
      max_tokens: maxTokens || 1000
    };
    if (responseFormat) body.response_format = responseFormat;
    if (tools && tools.length) body.tools = tools;
    log('LLM调用 (' + model + ')...', 'phase');
    return fetch(baseUrl + '/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function(res) {
      if (!res.ok) return res.text().then(function(err) { throw new Error('API ' + res.status + ': ' + err.slice(0,200)); });
      return res.json();
    });
  }

  // ── Outline Generation ──────────────────────────────────────────
  function generateOutline() {
    if (generating) return;
    var settings = getActiveSettings(currentProject);
    if (!settings.apiKey) { toast('请先在设置中填入 API Key', 'error'); return; }
    if (!currentProject.initial_prompt) { toast('请先填写初始设定', 'error'); return; }
    var apiKey = settings.apiKey, baseUrl = settings.baseUrl, model = settings.model, temp = settings.temp;
    generating = true;
    setBtns(true);
    clearOutput();
    log('开始生成大纲...', 'phase');
    setProgress(5);

    var title   = currentProject.title;
    var genre   = currentProject.genre;
    var prompt  = currentProject.initial_prompt;
    var rf = { type: 'json_object' };

    // Phase 1: Theme
    llmCall(
      [{role:'system',content:'你是小说创作顾问，负责提炼故事的核心。只输出 JSON。'},
       {role:'user',content:'小说标题：' + title + '\n类型：' + genre + '\n初始设定：' + prompt + '\n\n提炼核心主题，返回JSON：{"theme":"","purpose":"","tone":""}'}],
      null, model, apiKey, baseUrl, 0.7, 800, rf
    ).then(function(r) {
      setProgress(15);
      var themeData = JSON.parse(r.choices[0].message.content);
      log('主旨: ' + (themeData.theme || ''), 'success');
      return themeData;
    }).then(function(themeData) {
      // Phase 2: Plot paragraph
      setProgress(25);
      log('阶段2/6 - 段落剧情...', 'phase');
      return llmCall(
        [{role:'system',content:'你是小说家，用一段连贯文字概述整本小说。只输出 JSON。'},
         {role:'user',content:'标题：' + title + ' 类型：' + genre + ' 主题：' + (themeData.theme||'') + ' 基调：' + (themeData.tone||'') + '\n设定：' + prompt + '\n\n用一段（约200-400字）概述剧情，返回JSON：{"plot_paragraph":""}'}],
        null, model, apiKey, baseUrl, 0.7, 1200, rf
      ).then(function(r) {
        var plotData = JSON.parse(r.choices[0].message.content);
        log('段落剧情完成', 'success');
        return { themeData: themeData, plotData: plotData };
      });
    }).then(function(data) {
      // Phase 3: Chapter outlines
      setProgress(35);
      log('阶段3/6 - 章节大纲...', 'phase');
      return llmCall(
        [{role:'system',content:'把一段剧情拆分为N个章节，每个只一句话描述。只输出 JSON。'},
         {role:'user',content:'标题：' + title + ' 类型：' + genre + ' 主题：' + (data.themeData.theme||'') + '\n剧情：' + (data.plotData.plot_paragraph||'') + '\n\n拆分为章节（8-16章），返回JSON：{"total_chapters":0,"chapters":[{"chapter_number":1,"chapter_title":"","one_sentence":""}]}'}],
        null, model, apiKey, baseUrl, 0.7, 1500, rf
      ).then(function(r) {
        var outlineData = JSON.parse(r.choices[0].message.content);
        var chapters = outlineData.chapters || [];
        log('章节大纲（' + chapters.length + '章）', 'success');
        return { themeData: data.themeData, plotData: data.plotData, chapters: chapters };
      });
    }).then(function(data) {
      // Phase 4: Expand chapters
      setProgress(40);
      var expanded = [];
      var promises = data.chapters.map(function(ch, i) {
        var prev = i > 0 ? '第' + data.chapters[i-1].chapter_number + '章「' + data.chapters[i-1].chapter_title + '」' : '无';
        var next = i < data.chapters.length - 1 ? '第' + data.chapters[i+1].chapter_number + '章「' + data.chapters[i+1].chapter_title + '」' : '无';
        return llmCall(
          [{role:'system',content:'将章节一句话扩展为完整段落。只输出 JSON。'},
           {role:'user',content:'小说：' + title + ' 类型：' + genre + ' 主题：' + (data.themeData.theme||'') + '\n剧情：' + (data.plotData.plot_paragraph||'') + '\n前一章：' + prev + '\n本章：' + (ch.one_sentence||ch.chapter_title||'') + '\n下一章：' + next + '\n\n扩写，返回JSON：{"chapter_number":0,"chapter_title":"","one_sentence":"","expanded_paragraph":"","scene_setting":"","key_events":[],"characters_involved":[],"plot_progression":""}'}],
          null, model, apiKey, baseUrl, 0.7, 1200, rf
        ).then(function(r) {
          setProgress(40 + Math.round(i / data.chapters.length * 20));
          log('第' + (i+1) + '/' + data.chapters.length + '章「' + ch.chapter_title + '」', 'phase');
          try { expanded.push(JSON.parse(r.choices[0].message.content)); } catch(e) {}
        });
      });
      return Promise.all(promises).then(function() {
        log('章节扩写完成', 'success');
        return data;
      });
    }).then(function(data) {
      // Phase 5: Character arcs
      setProgress(68);
      log('阶段5/6 - 角色弧线...', 'phase');
      var charNames = data.chapters.flatMap(function(ch) { return ch.characters_involved || []; });
      var unique = [...new Set(charNames)];
      return llmCall(
        [{role:'system',content:'根据故事为所有角色设计发展弧线。只输出 JSON。'},
         {role:'user',content:'小说：' + title + ' 类型：' + genre + ' 主题：' + (data.themeData.theme||'') + '\n剧情：' + (data.plotData.plot_paragraph||'') + '\n角色：' + unique.join('；') + '\n\n角色弧线，返回JSON：{"character_arcs":[{"character_name":"","initial_state":"","final_state":"","key_changes":[],"conflicts":[]}]}'}],
        null, model, apiKey, baseUrl, 0.7, 2000, rf
      ).then(function(r) {
        var arcsData = [];
        try { arcsData = JSON.parse(r.choices[0].message.content).character_arcs || []; } catch(e) {}
        log('角色弧线（' + arcsData.length + '条）', 'success');
        return arcsData;
      });
    }).then(function(arcsData) {
      // Phase 6: World building
      setProgress(80);
      log('阶段6/6 - 世界观...', 'phase');
      return llmCall(
        [{role:'system',content:'根据故事主题设计世界观。只输出 JSON。'},
         {role:'user',content:'小说：' + title + ' 类型：' + genre + ' 主题：' + (currentProject.outline && currentProject.outline.theme && currentProject.outline.theme.theme || '') + '\n剧情：' + (currentProject.outline && currentProject.outline.plot_paragraph || '') + '\n\n世界观，返回JSON：{"time_period":"","location":"","rules_of_world":[],"atmosphere":""}'}],
        null, model, apiKey, baseUrl, 0.7, 1500, rf
      ).then(function(r) {
        var worldData = {};
        try { worldData = JSON.parse(r.choices[0].message.content); } catch(e) {}
        log('世界观完成', 'success');
        return worldData;
      });
    }).then(function(worldData) {
      // Assemble outline
      setProgress(95);
      var outline = {
        theme: currentProject.outline && currentProject.outline.theme || {},
        plot_paragraph: currentProject.outline && currentProject.outline.plot_paragraph || '',
        structure: { total_chapters: 0, main_plot: '' },
        character_arcs: [],
        world_building: worldData,
        chapters: []
      };
      try {
        var td = currentProject._lastThemeData || {};
        outline.theme = td.themeData || outline.theme;
        outline.plot_paragraph = td.plotData && td.plotData.plot_paragraph || outline.plot_paragraph;
        outline.structure.main_plot = outline.plot_paragraph;
      } catch(e) {}

      // Rebuild from captured data
      // (Simplified: just save what we have)
      currentProject.outline = outline;
      currentProject.characters = currentProject._lastArcs || [];
      currentProject.writing_chapter = 1;
      currentProject.updated_at = new Date().toISOString();
      save();
      setProgress(100);
      log('大纲生成完成!', 'success');
      applyProject();
      showTab('outline');
      toast('大纲生成完成!');
    }).catch(function(err) {
      log('错误: ' + err.message, 'error');
      toast(err.message, 'error');
    }).finally(function() {
      generating = false;
      setBtns(false);
      setTimeout(function() {
        var bar = document.getElementById('progress-bar');
        if (bar) bar.style.display = 'none';
      }, 1500);
    });
  }

  // ── Writing ─────────────────────────────────────────────────────
  function buildTools() {
    var chars = currentProject && currentProject.characters || [];
    var names = chars.map(function(c) { return c.character_name || c.name; });
    var charDesc = names.length ? names.join('、') : '（无）';
    return [
      {type:'function',function:{name:'get_character_dialogue',description:'让角色发言，可用角色：' + charDesc,
        parameters:{type:'object',properties:{character_name:{type:'string',description:'角色名'},prompt:{type:'string',description:'给角色的提示'}},required:['character_name']}}},
      {type:'function',function:{name:'set_scene',description:'设置新场景',
        parameters:{type:'object',properties:{scene_description:{type:'string',description:'场景描述'}},required:['scene_description']}}},
      {type:'function',function:{name:'add_plot_twist',description:'添加剧情转折',
        parameters:{type:'object',properties:{description:{type:'string',description:'转折描述'}},required:['description']}}},
      {type:'function',function:{name:'end_chapter',description:'结束章节',
        parameters:{type:'object',properties:{chapter_summary:{type:'string',description:'章节总结'}}}}}
    ];
  }

  function generateRound() {
    if (generating) return;
    if (!currentProject.outline) { toast('请先生成大纲', 'error'); return; }
    var settings = getActiveSettings(currentProject);
    if (!settings.apiKey) { toast('请先在设置中填入 API Key', 'error'); return; }
    var apiKey = settings.apiKey, baseUrl = settings.baseUrl, model = settings.model;
    generating = true;
    setBtns(true);
    showTab('output');
    clearOutput();
    log('开始写作第 ' + (currentProject.writing_chapter || 1) + ' 章...', 'phase');
    setProgress(10);

    var o = currentProject.outline;
    var chapters = o.chapters || [];
    var pos = currentProject.writing_chapter || 1;
    var ch = chapters[pos - 1] || {};
    var recent = (currentProject.conv_history || []).slice(-5);

    var context = '小说标题：' + currentProject.title + '\n类型：' + currentProject.genre + '\n当前场景：' + (currentProject.current_scene || '') + '\n\n' +
      '当前写作进度：第 ' + pos + ' 章\n' +
      '章节信息：\n- 标题：' + (ch.chapter_title || '') + '\n' +
      '- 场景设定：' + (ch.scene_setting || '') + '\n' +
      '- 关键事件：' + ((ch.key_events || []).join('；')) + '\n' +
      '- 涉及角色：' + ((ch.characters_involved || []).join('、')) + '\n\n' +
      '初始设定：' + (currentProject.initial_prompt || '') + '\n\n' +
      '最近对话：\n' + recent.map(function(i) { return i.type === 'dialogue_raw' ? i.content : '[' + i.content + ']'; }).join('\n');

    var messages = [
      {role:'system', content:'你是小说主写作者，负责推动故事进程。\n\n写作风格：生动、细腻、富有画面感\n\n可用工具：\n1. get_character_dialogue - 让角色发言\n2. set_scene - 设置新场景\n3. add_plot_twist - 添加剧情转折\n4. end_chapter - 结束章节\n\n规则：先描述场景（50-100字），然后调用工具让角色发言，不能自己写角色对话。'},
      {role:'user', content: context}
    ];

    var tools = buildTools();
    var loop = 0;
    var maxLoops = 20;
    var narration = '';
    var REWRITE = '上方是工具执行结果（含角色台词）。请将台词改写整合进叙述，输出最终正文。禁止调用工具。';

    function runLoop() {
      if (loop >= maxLoops) {
        currentProject.novel_text = (currentProject.novel_text || '') + '\n==========\n' + narration + '\n==========\n';
        currentProject.updated_at = new Date().toISOString();
        save();
        log('达到上限（' + maxLoops + '轮）', 'warn');
        applyProject();
        toast('达到最大轮次', 'warn');
        generating = false;
        setBtns(false);
        return;
      }
      loop++;
      setProgress(Math.round(10 + loop / maxLoops * 80));

      llmCall(messages, tools, model, apiKey, baseUrl, 0.8, 800, null)
        .then(function(resp) {
          narration = (resp.choices[0].message.content || '').trim();
          var toolCalls = resp.choices[0].message.tool_calls || [];
          if (!toolCalls || !toolCalls.length) {
            // Final output - no more tool calls
            currentProject.novel_text = (currentProject.novel_text || '') + '\n==========\n' + narration + '\n==========\n';
            currentProject.updated_at = new Date().toISOString();
            save();
            log('写作完成（' + loop + '轮）', 'success');
            applyProject();
            showTab('novel');
            setProgress(100);
            toast('一段写作完成!');
            generating = false;
            setBtns(false);
            return;
          }

          messages.push({role:'assistant', content: narration || null,
            tool_calls: toolCalls.map(function(tc) {
              return {id: tc.id, type:'function', function:{name:tc.function.name, arguments:tc.function.arguments}};
            })});
          log('第' + loop + '轮: ' + toolCalls.map(function(tc){return tc.function.name;}).join(', '), 'phase');

          var promises = toolCalls.map(function(tc) {
            return executeTool(tc.function.name, JSON.parse(tc.function.arguments || '{}'))
              .then(function(result) {
                messages.push({role:'tool', tool_call_id: tc.id, content: result});
                log('  [' + tc.function.name + '] ' + result.slice(0, 60), result.indexOf('错误') === 0 ? 'error' : 'tool');
              });
          });

          Promise.all(promises).then(function() {
            messages.push({role:'user', content: REWRITE});
            runLoop();
          });
        })
        .catch(function(err) {
          log('错误: ' + err.message, 'error');
          toast(err.message, 'error');
          generating = false;
          setBtns(false);
        });
    }

    runLoop();
  }

  // ── Tool Execution ───────────────────────────────────────────────
  function executeTool(name, args) {
    if (name === 'get_character_dialogue') {
      var charName = args.character_name;
      var char = (currentProject.characters || []).find(function(c) { return (c.character_name || c.name) === charName; });
      if (!char) return Promise.resolve('错误：角色「' + charName + '」不存在');

      var apiKey  = document.getElementById('cfg-api-key').value.trim();
      var baseUrl = document.getElementById('cfg-base-url').value.trim();
      var model   = document.getElementById('cfg-model').value;
      var sys = '你是小说角色「' + charName + '」。\n' +
        '性格：' + (char.personality || char.initial_state || '') + '\n' +
        '背景：' + (char.background || '') + '\n' +
        '初始状态：' + (char.initial_state || '') + '\n' +
        '最终状态：' + (char.final_state || '') + '\n' +
        '规则：保持角色性格，回复简短（50-150字），用第一人称"我"回应。\n' +
        '当前场景：' + (currentProject.current_scene || '未知');
      return llmCall([{role:'system',content:sys},{role:'user',content:args.prompt||'请回应'}],
        null, model, apiKey, baseUrl, 0.8, 300, null)
        .then(function(resp) {
          var dialogue = (resp.choices[0].message.content || '').trim();
          if (!currentProject.conv_history) currentProject.conv_history = [];
          currentProject.conv_history.push({type:'dialogue_raw',character:charName,content:charName + '：' + dialogue});
          return charName + '：' + dialogue;
        });
    } else if (name === 'set_scene') {
      currentProject.current_scene = args.scene_description;
      if (!currentProject.conv_history) currentProject.conv_history = [];
      currentProject.conv_history.push({type:'scene_change',content:'场景：' + args.scene_description});
      return Promise.resolve('场景已设置：' + args.scene_description);
    } else if (name === 'add_plot_twist') {
      if (!currentProject.conv_history) currentProject.conv_history = [];
      currentProject.conv_history.push({type:'plot_twist',content:'剧情转折：' + args.description});
      return Promise.resolve('已添加剧情转折：' + args.description);
    } else if (name === 'end_chapter') {
      if (!currentProject.conv_history) currentProject.conv_history = [];
      currentProject.conv_history.push({type:'chapter_end',content:'章节结束：' + (args.chapter_summary || '')});
      currentProject.writing_chapter = (currentProject.writing_chapter || 1) + 1;
      return Promise.resolve('章节已结束' + (args.chapter_summary ? ': ' + args.chapter_summary : ''));
    }
    return Promise.resolve('未知工具：' + name);
  }

  function clearOutput() {
    var el = document.getElementById('output-box');
    if (el) el.textContent = '';
  }


  // ── Settings ───────────────────────────────────────────────────
  function goSettings() {
    document.getElementById('page-home').classList.add('hidden');
    document.getElementById('page-project').classList.add('hidden');
    document.getElementById('page-settings').classList.remove('hidden');
    ['page-home','page-project','page-settings'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    document.getElementById('page-settings').classList.remove('hidden');
    document.getElementById('header-actions').innerHTML =
      '<button class="btn btn-ghost" id="btn-back-from-settings">&#8592; 返回</button>';
    var btnBack = document.getElementById('btn-back-from-settings');
    if (btnBack) btnBack.addEventListener('click', goHome);

    var s = getSettings();
    document.getElementById('s-api-key').value = s.api_key || '';
    document.getElementById('s-base-url').value = s.base_url || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    document.getElementById('s-channel').value = s.channel || 'dashscope';
    document.getElementById('s-model').value = s.model || 'qwen-plus';
    document.getElementById('s-temp').value = s.temperature || 0.8;
    document.getElementById('s-temp-label').textContent = (s.temperature || 0.8).toFixed(2);
    document.getElementById('test-result').textContent = '';
  }

  function saveGlobalSettings() {
    var s = {
      api_key:     document.getElementById('s-api-key').value.trim(),
      base_url:    document.getElementById('s-base-url').value.trim(),
      channel:     document.getElementById('s-channel').value,
      model:       document.getElementById('s-model').value,
      temperature: parseFloat(document.getElementById('s-temp').value)
    };
    saveSettings(s);
    toast('全局设置已保存');
  }

  function resetGlobalSettings() {
    if (!confirm('确定重置？所有项目的独立配置不受影响。')) return;
    localStorage.removeItem(GLOBAL_KEY);
    toast('已重置');
    goSettings();
  }

  function applyChannelDefaults() {
    var ch = document.getElementById('s-channel').value;
    var urlMap = {
      dashscope: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      openai:    'https://api.openai.com/v1',
      custom:    ''
    };
    var modelMap = {
      dashscope: 'qwen-plus',
      openai:    'gpt-4o',
      custom:    ''
    };
    if (urlMap[ch] !== undefined) {
      document.getElementById('s-base-url').value = urlMap[ch];
    }
  }

  function testConnection() {
    var el = document.getElementById('test-result');
    el.textContent = '测试中...';
    el.style.color = 'var(--muted)';
    var apiKey = document.getElementById('s-api-key').value.trim();
    var baseUrl = document.getElementById('s-base-url').value.trim();
    var model = document.getElementById('s-model').value;
    if (!apiKey || !baseUrl) {
      el.textContent = '请先填入 API Key 和 Base URL';
      el.style.color = 'var(--danger)';
      return;
    }
    llmCall(
      [{role:'system',content:'Reply only with OK.'},{role:'user',content:'Say OK.'}],
      null, model, apiKey, baseUrl, 0.1, 5, null
    ).then(function(r) {
      var usage = r.usage || {};
      el.textContent = '连接成功! tokens: ' + (usage.prompt_tokens || '?') + '+' + (usage.completion_tokens || '?');
      el.style.color = 'var(--success)';
    }).catch(function(e) {
      el.textContent = '连接失败: ' + e.message.slice(0, 100);
      el.style.color = 'var(--danger)';
    });
  }


  // ── Character Management ─────────────────────────────────────────
  var _charModalCallback = null;

  function openCharPage() {
    if (!currentProject) return;
    document.getElementById('page-project').classList.add('hidden');
    document.getElementById('page-settings').classList.add('hidden');
    document.getElementById('page-chars').classList.remove('hidden');
    document.getElementById('chars-project-name').textContent = currentProject.title || '';
    renderCharList();
    updateHeaderActions();
  }

  function updateHeaderActions() {
    if (!currentProject) return;
    var projId = currentProject.id;
    var hdr = document.getElementById('header-actions');
    hdr.innerHTML =
      '<span class="toolbar-label" id="proj-title-label">' + esc(currentProject.title || '') + '</span>' +
      '<button class="btn btn-ghost" id="btn-save-project-top" title="保存">&#128190;</button>' +
      '<button class="btn btn-ghost" id="btn-export-top" title="导出">&#8599;</button>' +
      '<button class="btn btn-ghost" id="btn-chars-header2">&#128100; 角色</button>' +
      '<button class="btn btn-ghost" id="btn-settings-header2">&#9881; 设置</button>';
    document.getElementById('btn-save-project-top').addEventListener('click', saveProject);
    document.getElementById('btn-export-top').addEventListener('click', exportProject);
    document.getElementById('btn-chars-header2').addEventListener('click', openCharPage);
    document.getElementById('btn-settings-header2').addEventListener('click', goSettings);
  }

  function renderCharList() {
    var container = document.getElementById('char-list-container');
    if (!container) return;
    var chars = currentProject.characters || [];
    if (!chars.length) {
      container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--muted)">' +
        '<div style="font-size:2rem;margin-bottom:.5rem">&#128100;</div>' +
        '<div>暂无角色</div><div style="margin-top:.5rem;font-size:.8rem">从大纲生成后会自动创建，或点击右上角「添加角色」手动创建</div></div>';
      return;
    }
    container.innerHTML = chars.map(function(c) {
      var role = c.role || '配角';
      var roleColor = role === '主角' ? 'var(--accent)' : role === '反派' ? '#e53e3e' : 'var(--muted)';
      return '<div class="char-card" data-id="' + esc(c.id || '') + '">' +
        '<div style="display:flex;align-items:flex-start;margin-bottom:.5rem">' +
        '<div style="flex:1">' +
        '<div style="font-size:1rem;font-weight:600;color:var(--text);margin-bottom:.15rem">' + esc(c.character_name || c.name || '未命名') + '</div>' +
        '<div style="font-size:.72rem;color:' + roleColor + ';font-weight:500;letter-spacing:.03em;text-transform:uppercase">' + esc(role) + '</div>' +
        '</div>' +
        '<button class="btn btn-ghost char-edit-btn" data-edit="' + esc(c.id || '') + '" style="font-size:.72rem;padding:.2rem .5rem;flex-shrink:0">编辑</button>' +
        '</div>' +
        '<div style="font-size:.78rem;color:var(--muted);line-height:1.6">' +
        (c.personality ? esc(c.personality).substring(0, 80) + (c.personality.length > 80 ? '…' : '') : '暂无性格描述') +
        '</div>' +
        (c.relationships && c.relationships.length ?
          '<div style="margin-top:.5rem;display:flex;flex-wrap:wrap;gap:.25rem">' +
          c.relationships.map(function(r) { return '<span style="background:var(--surface2);border-radius:4px;padding:.1rem .4rem;font-size:.7rem;color:var(--accent2)">' + esc(typeof r === 'string' ? r : (r.name || '')) + '</span>'; }).join('') +
          '</div>' : '') +
        '</div>';
    }).join('');

    // Bind edit buttons
    container.querySelectorAll('.char-edit-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var cid = btn.getAttribute('data-edit');
        var char = (currentProject.characters || []).find(function(c) { return c.id === cid; });
        if (char) openCharModal(char);
      });
    });
  }

  function getCharFormHTML(char) {
    var c = char || {};
    return '<div class="form-group" style="margin-bottom:1rem">' +
      '<label class="form-label">角色名称 *</label>' +
      '<input type="text" id="cf-name" value="' + esc(c.character_name || c.name || '') + '" placeholder="如：张三">' +
      '</div>' +
      '<div class="form-group" style="margin-bottom:1rem">' +
      '<label class="form-label">定位</label>' +
      '<select id="cf-role">' +
      ['主角','反派','配角','导师','联络人'].map(function(r) {
        return '<option value="' + r + '"' + (c.role === r ? ' selected' : '') + '>' + r + '</option>';
      }).join('') +
      '</select>' +
      '</div>' +
      '<div class="form-group" style="margin-bottom:1rem">' +
      '<label class="form-label">性格特征</label>' +
      '<textarea id="cf-personality" rows="3" placeholder="如：沉默寡言，内心善良，擅长格斗">' + esc(c.personality || '') + '</textarea>' +
      '</div>' +
      '<div class="form-group" style="margin-bottom:1rem">' +
      '<label class="form-label">背景故事</label>' +
      '<textarea id="cf-background" rows="3" placeholder="角色的过往经历">' + esc(c.background || c.story_background || '') + '</textarea>' +
      '</div>' +
      '<div class="form-group" style="margin-bottom:1rem">' +
      '<label class="form-label">目标/动机</label>' +
      '<textarea id="cf-goals" rows="2" placeholder="角色想要达成什么">' + esc(c.goals || '') + '</textarea>' +
      '</div>' +
      '<div class="form-group" style="margin-bottom:1rem">' +
      '<label class="form-label">关系（逗号分隔）</label>' +
      '<input type="text" id="cf-relationships" value="' + esc(Array.isArray(c.relationships) ? c.relationships.map(function(r){return typeof r==="string"?r:(r.name||'');}).join('，') : '') + '" placeholder="如：主角的同学，暗恋对象">' +
      '</div>' +
      '<div class="form-group" style="margin-bottom:1rem">' +
      '<label class="form-label">系统提示词（覆盖默认）</label>' +
      '<textarea id="cf-system-prompt" rows="4" placeholder="留空则使用默认格式">' + esc(c.system_prompt_override || '') + '</textarea>' +
      '</div>' +
      '<div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:1.25rem">' +
      '<button class="btn btn-ghost" id="cf-cancel">取消</button>' +
      '<button class="btn btn-primary" id="cf-save">保存</button>' +
      (char && char.id ? '<button class="btn btn-ghost" id="cf-delete" style="margin-left:auto;color:#e53e3e">删除</button>' : '') +
      '</div>';
  }

  function openCharModal(char) {
    var overlay = document.getElementById('char-modal-overlay');
    overlay.classList.remove('hidden');
    var container = document.getElementById('char-form-container');
    container.innerHTML = getCharFormHTML(char);
    var isEdit = !!(char && char.id);
    document.getElementById('char-modal-title').textContent = isEdit ? '编辑角色' : '添加角色';
    document.getElementById('cf-name').focus();
    document.getElementById('cf-cancel').addEventListener('click', closeCharModal);
    document.getElementById('cf-save').addEventListener('click', function() {
      var name = document.getElementById('cf-name').value.trim();
      if (!name) { toast('角色名称不能为空', 'error'); return; }
      if (!currentProject.characters) currentProject.characters = [];
      var relStr = document.getElementById('cf-relationships').value.trim();
      var relationships = relStr ? relStr.split(/[,，]/).map(function(s) { return s.trim(); }).filter(Boolean) : [];
      var charData = {
        id: char && char.id || uuid(),
        character_name: name,
        name: name,
        role: document.getElementById('cf-role').value,
        personality: document.getElementById('cf-personality').value.trim(),
        background: document.getElementById('cf-background').value.trim(),
        story_background: document.getElementById('cf-background').value.trim(),
        goals: document.getElementById('cf-goals').value.trim(),
        relationships: relationships,
        system_prompt_override: document.getElementById('cf-system-prompt').value.trim()
      };
      if (isEdit) {
        var idx = currentProject.characters.findIndex(function(c) { return c.id === char.id; });
        if (idx >= 0) currentProject.characters[idx] = charData;
      } else {
        currentProject.characters.push(charData);
      }
      currentProject.updated_at = new Date().toISOString();
      save();
      closeCharModal();
      renderCharList();
      toast(isEdit ? '角色已更新' : '角色已添加');
    });
    if (isEdit) {
      document.getElementById('cf-delete').addEventListener('click', function() {
        if (!confirm('确定删除角色「' + (char.character_name || char.name) + '」？')) return;
        currentProject.characters = (currentProject.characters || []).filter(function(c) { return c.id !== char.id; });
        currentProject.updated_at = new Date().toISOString();
        save();
        closeCharModal();
        renderCharList();
        toast('角色已删除');
      });
    }
  }

  function closeCharModal() {
    document.getElementById('char-modal-overlay').classList.add('hidden');
  }

  // goCharPage: open project char page
  function goCharPage() { openCharPage(); }

  // ── Event Binding ─────────────────────────────────────────────
  function bindEvents() {
    console.log('[NovelAgents] Binding events');
    // Logo
    var logoBtn = document.getElementById('logo-btn');
    if (logoBtn) logoBtn.addEventListener('click', goHome);

    // Settings button in header
    var btnSettingsHeader = document.getElementById('btn-settings-header');
    if (btnSettingsHeader) btnSettingsHeader.addEventListener('click', goSettings);

    // New project buttons
    var btnNew = document.getElementById('btn-new');
    if (btnNew) btnNew.addEventListener('click', showModal);

    // Modal
    var btnClose = document.getElementById('modal-close');
    if (btnClose) btnClose.addEventListener('click', closeModal);
    var btnCancel = document.getElementById('btn-cancel');
    if (btnCancel) btnCancel.addEventListener('click', closeModal);

    // Form
    var form = document.getElementById('form-new');
    if (form) form.addEventListener('submit', createProject);

    // Outline / Writing
    var btnOutline = document.getElementById('btn-outline');
    if (btnOutline) btnOutline.addEventListener('click', generateOutline);
    var btnOutline2 = document.getElementById('btn-outline2');
    if (btnOutline2) btnOutline2.addEventListener('click', generateOutline);
    var btnRound = document.getElementById('btn-round');
    if (btnRound) btnRound.addEventListener('click', generateRound);
    var btnRound2 = document.getElementById('btn-round2');
    if (btnRound2) btnRound2.addEventListener('click', generateRound);
    var btnNovelTab = document.getElementById('btn-novel-tab');
    if (btnNovelTab) btnNovelTab.addEventListener('click', function() { showTab('novel'); });

    // Tabs
    ['output','novel','outline'].forEach(function(t) {
      var tab = document.getElementById('tab-' + t);
      if (tab) tab.addEventListener('click', function() { showTab(t); });
    });

    // Export / Delete
    var btnExport = document.getElementById('btn-export');
    if (btnExport) btnExport.addEventListener('click', exportProject);
    var btnDelete = document.getElementById('btn-delete');
    if (btnDelete) btnDelete.addEventListener('click', deleteCurrentProject);
    var btnSaveProjectSidebar = document.getElementById('btn-save-project');
    if (btnSaveProjectSidebar) btnSaveProjectSidebar.addEventListener('click', saveProject);

    // Project edit
    var btnEditProject = document.getElementById('btn-edit-project');
    if (btnEditProject) btnEditProject.addEventListener('click', openProjectEditModal);
    var btnEditClose = document.getElementById('project-edit-close');
    if (btnEditClose) btnEditClose.addEventListener('click', closeProjectEditModal);
    var btnEditCancel = document.getElementById('project-edit-cancel');
    if (btnEditCancel) btnEditCancel.addEventListener('click', closeProjectEditModal);
    var formEdit = document.getElementById('project-edit-form');
    if (formEdit) formEdit.addEventListener('submit', saveProjectEdit);

    // Settings page controls
    var btnSaveSettings = document.getElementById('btn-save-settings');
    if (btnSaveSettings) btnSaveSettings.addEventListener('click', saveGlobalSettings);
    var btnResetSettings = document.getElementById('btn-reset-settings');
    if (btnResetSettings) btnResetSettings.addEventListener('click', resetGlobalSettings);
    var btnTestConn = document.getElementById('btn-test-conn');
    if (btnTestConn) btnTestConn.addEventListener('click', testConnection);
    var sChannel = document.getElementById('s-channel');
    if (sChannel) sChannel.addEventListener('change', applyChannelDefaults);
    var sTemp = document.getElementById('s-temp');
    if (sTemp) sTemp.addEventListener('input', function(e) {
      var el = document.getElementById('s-temp-label');
      if (el) el.textContent = parseFloat(e.target.value).toFixed(2);
    });

    console.log('[NovelAgents] Events bound');
  }

  // ── Boot ───────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function() {
    console.log('[NovelAgents] DOMContentLoaded');
    try {
      bindEvents();
      goHome();
      console.log('[NovelAgents] Boot complete');
    } catch(e) {
      console.error('[NovelAgents] Boot error:', e);
    }
  });

})();
