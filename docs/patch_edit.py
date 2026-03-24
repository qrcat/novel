"""追加编辑功能到 index.js"""
with open('index.js') as f:
    js = f.read()
with open('index.html') as f:
    html = f.read()

# ── HTML ─────────────────────────────────────────────────────────
html = html.replace(
    '<div class="novel-text hidden" id="novel-panel"></div>',
    '<textarea class="novel-text hidden" id="novel-panel" placeholder="正文将在此显示，支持直接编辑..."></textarea>'
)
html = html.replace(
    '<button class="btn btn-ghost" id="btn-novel-tab">正文</button>',
    '<button class="btn btn-ghost" id="btn-novel-tab">正文</button>\n      <button class="btn btn-ghost" id="btn-save-text">保存正文</button>'
)
with open('index.html', 'w') as f:
    f.write(html)
print('HTML done')

# ── JS ────────────────────────────────────────────────────────────
new_code = '''
  // ── Save Novel Text ─────────────────────────────────────────────
  function saveNovelText() {
    if (!currentProject) return;
    var text = document.getElementById('novel-panel').value || '';
    currentProject.novel_text = text;
    currentProject.updated_at = new Date().toISOString();
    save();
    toast('正文已保存');
  }

  // ── Text / JSON Editor Overlay ───────────────────────────────────
  function openTextEditor(title, currentValue, onSave) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:500;display:flex;align-items:center;justify-content:center;padding:2rem;box-sizing:border-box';
    var box = document.createElement('div');
    box.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:12px;width:min(680px,95vw);max-height:85vh;overflow:auto;padding:1.5rem;box-sizing:border-box;display:flex;flex-direction:column';
    var hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-shrink:0';
    var ttl = document.createElement('span');
    ttl.style.cssText = 'font-size:1rem';
    ttl.textContent = title;
    var closeBtn = document.createElement('button');
    closeBtn.textContent = String.fromCharCode(215);
    closeBtn.style.cssText = 'background:none;border:none;color:var(--muted);cursor:pointer;font-size:1.5rem;line-height:1';
    hdr.appendChild(ttl);
    hdr.appendChild(closeBtn);
    var ta = document.createElement('textarea');
    ta.style.cssText = 'width:100%;min-height:240px;flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:"DM Mono",monospace;font-size:.8rem;padding:.5rem;resize:vertical;box-sizing:border-box';
    ta.value = currentValue || '';
    var acts = document.createElement('div');
    acts.style.cssText = 'display:flex;gap:.5rem;margin-top:.75rem;justify-content:flex-end;flex-shrink:0';
    var cnl = document.createElement('button');
    cnl.textContent = '取消';
    cnl.className = 'btn btn-ghost';
    var sv = document.createElement('button');
    sv.textContent = '保存';
    sv.className = 'btn btn-primary';
    acts.appendChild(cnl);
    acts.appendChild(sv);
    box.appendChild(hdr);
    box.appendChild(ta);
    box.appendChild(acts);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    ta.focus();
    function cleanup() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
    closeBtn.addEventListener('click', cleanup);
    cnl.addEventListener('click', cleanup);
    sv.addEventListener('click', function() { cleanup(); onSave(ta.value); });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) cleanup(); });
  }

  function openJsonEditor(currentJson, onSave) {
    openTextEditor('编辑 JSON（自动校验格式）', currentJson || '{}', function(val) {
      try { JSON.parse(val); onSave(val); }
      catch(e) { toast('JSON格式错误: ' + e.message, 'error'); }
    });
  }

  // ── Editable Outline Renderer ────────────────────────────────────
  function renderOutlineEdit(o) {
    if (!currentProject) return;
    var main = document.getElementById('outline-content');
    var side = document.getElementById('outline-sidebar-content');
    if (!main || !side) return;
    var m = '', s = '';

    var t = o.theme || {};
    m += '<div class="theme-block">';
    m += '<div style="display:flex;align-items:center;margin-bottom:.5rem">';
    m += '<div class="panel-title" style="margin:0;flex-shrink:0">核心主旨</div>';
    m += '<button class="btn btn-ghost" id="btn-edit-theme" style="margin-left:auto;font-size:.7rem;padding:.2rem .5rem;flex-shrink:0">编辑</button></div>';
    m += '<div class="theme-text" id="val-theme">' + esc(t.theme || '') + '</div>';
    if (t.purpose) m += '<div class="theme-purpose">' + esc(t.purpose) + '</div>';
    m += '</div>';

    m += '<div style="margin-bottom:1.25rem">';
    m += '<div style="display:flex;align-items:center;margin-bottom:.5rem">';
    m += '<div class="panel-title" style="margin:0;flex-shrink:0">段落剧情</div>';
    m += '<button class="btn btn-ghost" id="btn-edit-plot" style="margin-left:auto;font-size:.7rem;padding:.2rem .5rem;flex-shrink:0">编辑</button></div>';
    m += '<p id="val-plot" style="font-size:.88rem;line-height:1.8">' + esc(o.plot_paragraph || '') + '</p></div>';

    var w = o.world_building || {};
    if (w.location || w.time_period) {
      m += '<div style="margin-bottom:1.25rem">';
      m += '<div style="display:flex;align-items:center;margin-bottom:.75rem">';
      m += '<div class="panel-title" style="margin:0;flex-shrink:0">世界观</div>';
      m += '<button class="btn btn-ghost" id="btn-edit-world" style="margin-left:auto;font-size:.7rem;padding:.2rem .5rem;flex-shrink:0">编辑</button></div>';
      m += '<div class="info-block" id="val-world">';
      if (w.time_period) m += '<div class="info-row"><span class="info-label">时间</span><span class="info-value">' + esc(w.time_period) + '</span></div>';
      if (w.location) m += '<div class="info-row"><span class="info-label">地点</span><span class="info-value">' + esc(w.location) + '</span></div>';
      if (w.atmosphere) m += '<div class="info-row"><span class="info-label">氛围</span><span class="info-value">' + esc(w.atmosphere) + '</span></div>';
      (w.rules_of_world || []).forEach(function(r) { m += '<div style="padding:.25rem 0;font-size:.82rem">&#9702; ' + esc(r) + '</div>'; });
      m += '</div></div>';
    }

    var arcs = o.character_arcs || [];
    if (arcs.length) {
      m += '<div style="display:flex;align-items:center;margin-bottom:.75rem">';
      m += '<div class="panel-title" style="margin:0;flex-shrink:0">角色弧线</div>';
      m += '<button class="btn btn-ghost" id="btn-edit-arcs" style="margin-left:auto;font-size:.7rem;padding:.2rem .5rem;flex-shrink:0">编辑</button></div>';
      arcs.forEach(function(a) {
        m += '<div class="arc-block"><div class="arc-name">' + esc(a.character_name || '') + '</div>';
        m += '<div class="arc-arrow">' + esc(a.initial_state || '') + ' &#8594; ' + esc(a.final_state || '') + '</div>';
        (a.key_changes || []).forEach(function(c) { m += '<div class="arc-arrow" style="color:var(--muted)">&#8226; ' + esc(c) + '</div>'; });
        m += '</div>';
      });
      s += arcs.map(function(a) {
        return '<div style="margin-bottom:.75rem"><strong style="color:var(--accent2)">' + esc(a.character_name||'') + '</strong><br><span style="color:var(--muted)">' + esc(a.initial_state||'') + ' &#8594; ' + esc(a.final_state||'') + '</span></div>';
      }).join('');
    }

    var chapters = o.chapters || [];
    var cur = (currentProject && currentProject.writing_chapter) || 1;
    if (chapters.length) {
      m += '<div style="display:flex;align-items:center;margin-bottom:.75rem">';
      m += '<div class="panel-title" style="margin:0;flex-shrink:0">章节规划</div>';
      m += '<button class="btn btn-ghost" id="btn-edit-chapters" style="margin-left:auto;font-size:.7rem;padding:.2rem .5rem;flex-shrink:0">编辑</button></div>';
      chapters.forEach(function(ch) {
        var isCur = ch.chapter_number === cur;
        m += '<div class="chapter-block' + (isCur ? ' current' : '') + '">';
        m += '<div class="chapter-num">第 ' + ch.chapter_number + ' 章</div>';
        m += '<div class="chapter-title">' + esc(ch.chapter_title || '') + '</div>';
        if (ch.one_sentence) m += '<div class="chapter-one-sentence">' + esc(ch.one_sentence) + '</div>';
        if (ch.expanded_paragraph) m += '<p style="font-size:.8rem;color:var(--muted);margin:.4rem 0;line-height:1.6">' + esc(ch.expanded_paragraph) + '</p>';
        var names = (ch.characters_involved || []).map(function(c) { return '<span>' + esc(c) + '</span>'; }).join('');
        if (isCur) names += '<span style="color:var(--accent)">&#9668; 当前</span>';
        m += '<div class="chapter-meta">' + names + '</div></div>';
      });
      s += '<div class="panel-title" style="margin-bottom:.5rem">章节</div>';
      s += chapters.map(function(ch) {
        return '<div style="padding:.3rem 0;border-bottom:1px solid var(--border)"><span style="color:var(--accent)">' + ch.chapter_number + '.</span> ' + esc(ch.chapter_title||'') + '</div>';
      }).join('');
    }

    main.innerHTML = m || '<div style="color:var(--muted);text-align:center;padding:3rem">大纲内容为空</div>';
    side.innerHTML = s || '<div style="color:var(--muted);font-size:.85rem">暂无大纲概要</div>';

    var btnTh = document.getElementById('btn-edit-theme');
    if (btnTh) btnTh.addEventListener('click', function() {
      openJsonEditor(JSON.stringify(currentProject.outline || {}, null, 2), function(val) {
        try {
          currentProject.outline = JSON.parse(val);
          currentProject.updated_at = new Date().toISOString();
          save();
          applyProject();
        } catch(e) { toast('JSON格式错误', 'error'); }
      });
    });

    var btnPl = document.getElementById('btn-edit-plot');
    if (btnPl) btnPl.addEventListener('click', function() {
      var cur = (currentProject.outline && currentProject.outline.plot_paragraph) || '';
      openTextEditor('段落剧情', cur, function(val) {
        if (!currentProject.outline) currentProject.outline = {};
        currentProject.outline.plot_paragraph = val;
        currentProject.updated_at = new Date().toISOString();
        save();
        applyProject();
      });
    });

    var btnWo = document.getElementById('btn-edit-world');
    if (btnWo) btnWo.addEventListener('click', function() {
      var world = (currentProject.outline && currentProject.outline.world_building) || {};
      openJsonEditor(JSON.stringify(world, null, 2), function(val) {
        try {
          if (!currentProject.outline) currentProject.outline = {};
          currentProject.outline.world_building = JSON.parse(val);
          currentProject.updated_at = new Date().toISOString();
          save();
          applyProject();
        } catch(e) { toast('JSON格式错误', 'error'); }
      });
    });

    var btnAr = document.getElementById('btn-edit-arcs');
    if (btnAr) btnAr.addEventListener('click', function() {
      var arcs2 = (currentProject.outline && currentProject.outline.character_arcs) || [];
      openJsonEditor(JSON.stringify(arcs2, null, 2), function(val) {
        try {
          if (!currentProject.outline) currentProject.outline = {};
          var p = JSON.parse(val);
          currentProject.outline.character_arcs = p;
          currentProject.characters = p;
          currentProject.updated_at = new Date().toISOString();
          save();
          applyProject();
        } catch(e) { toast('JSON格式错误', 'error'); }
      });
    });

    var btnCh = document.getElementById('btn-edit-chapters');
    if (btnCh) btnCh.addEventListener('click', function() {
      var chs = (currentProject.outline && currentProject.outline.chapters) || [];
      openJsonEditor(JSON.stringify(chs, null, 2), function(val) {
        try {
          if (!currentProject.outline) currentProject.outline = {};
          currentProject.outline.chapters = JSON.parse(val);
          currentProject.updated_at = new Date().toISOString();
          save();
          applyProject();
        } catch(e) { toast('JSON格式错误', 'error'); }
      });
    });
  }
'''

# 插入到 Event Binding 前
js = js.replace(
    '  // ── Event Binding ─────────────────────────────────────────────',
    new_code + '\n  // ── Event Binding ─────────────────────────────────────────────'
)

# applyProject: renderOutline → renderOutlineEdit
js = js.replace(
    '      renderOutline(p.outline);',
    '      renderOutlineEdit(p.outline);'
)

# novel-panel: textContent → value
js = js.replace(
    "      document.getElementById('novel-panel').textContent = p.novel_text;",
    "      document.getElementById('novel-panel').value = p.novel_text || '';"
)

# showTab('novel') 后同步
js = js.replace(
    "      document.getElementById('novel-tab-content').textContent = p.novel_text;\n    }",
    "      document.getElementById('novel-tab-content').textContent = p.novel_text;\n    } else {\n      var et = document.getElementById('novel-panel').value;\n      if (et) document.getElementById('novel-tab-content').textContent = et;"
)

# 事件绑定
js = js.replace(
    "    var btnNovelTab = document.getElementById('btn-novel-tab');\n    if (btnNovelTab) btnNovelTab.addEventListener('click', function() { showTab('novel'); });",
    "    var btnNovelTab = document.getElementById('btn-novel-tab');\n    if (btnNovelTab) btnNovelTab.addEventListener('click', function() { showTab('novel'); applyProject(); });\n    var btnSaveText = document.getElementById('btn-save-text');\n    if (btnSaveText) btnSaveText.addEventListener('click', saveNovelText);"
)

with open('index.js', 'w') as f:
    f.write(js)

# 验证
js2 = open('index.js').read()
for fn in ['saveNovelText', 'openTextEditor', 'openJsonEditor', 'renderOutlineEdit']:
    print(('OK' if 'function ' + fn in js2 else 'MISSING'), fn)
print('JS length:', len(js2))
print('Done')
