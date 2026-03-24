"""角色配置页补丁"""
with open('index.js') as f:
    js = f.read()
with open('index.html') as f:
    html = f.read()

# ── HTML ─────────────────────────────────────────────────────────
# 添加角色管理页
char_page = '''
<div class="main hidden" id="page-chars">
  <div class="section-header" style="display:flex;align-items:center;gap:.75rem;margin-bottom:1.5rem">
    <button class="btn btn-ghost" id="btn-back-from-chars" style="padding:.4rem .6rem">&#8592;</button>
    <div>
      <h1 class="section-title" style="margin:0">&#128100; 角色管理</h1>
      <div style="font-size:.8rem;color:var(--muted);margin-top:.2rem" id="chars-project-name"></div>
    </div>
    <button class="btn btn-primary" id="btn-add-char" style="margin-left:auto">+ 添加角色</button>
  </div>
  <div id="char-list-container" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1rem"></div>
</div>'''

# 角色编辑弹窗
char_modal = '''
<div class="modal-overlay hidden" id="char-modal-overlay">
  <div class="modal" id="char-modal-box" style="max-width:680px;width:95vw;max-height:90vh;overflow:auto">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
      <span class="modal-title" id="char-modal-title">添加角色</span>
      <button class="modal-close" id="char-modal-close">&#8592; 返回</button>
    </div>
    <div id="char-form-container"></div>
  </div>
</div>'''

if 'id="page-chars"' not in html:
    html = html.replace('<script src="index.js">', char_page + '\n' + char_modal + '\n<script src="index.js">')

# header 添加角色管理按钮（在设置按钮旁边）
if 'btn-chars-header' not in html:
    html = html.replace(
        '<button class="btn btn-ghost" id="btn-settings-header">',
        '<button class="btn btn-ghost" id="btn-chars-header">&#128100; 角色</button>\n    <button class="btn btn-ghost" id="btn-settings-header">'
    )

with open('index.html', 'w') as f:
    f.write(html)

# ── JS ────────────────────────────────────────────────────────────
new_code = '''
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
'''

# 插入到 Event Binding 前
js = js.replace(
    '  // ── Event Binding ─────────────────────────────────────────────',
    new_code + '\n  // ── Event Binding ─────────────────────────────────────────────'
)

# ── bindEvents: 角色按钮 + 模态框关闭 ─────────────────────────────
# btn-back-from-chars
js = js.replace(
    "    var btnSave = document.getElementById('btn-save-project');",
    "    var btnBackChars = document.getElementById('btn-back-from-chars');\n    if (btnBackChars) btnBackChars.addEventListener('click', function() {\n      document.getElementById('page-chars').classList.add('hidden');\n      document.getElementById('page-project').classList.remove('hidden');\n      updateHeaderActions();\n    });\n    var btnAddChar = document.getElementById('btn-add-char');\n    if (btnAddChar) btnAddChar.addEventListener('click', function() { openCharModal(null); });\n    var btnCharHdr = document.getElementById('btn-chars-header');\n    if (btnCharHdr) btnCharHdr.addEventListener('click', goCharPage);\n    var btnCharHdr2 = document.getElementById('btn-chars-header2');\n    if (btnCharHdr2) btnCharHdr2.addEventListener('click', goCharPage);\n    var btnCharClose = document.getElementById('char-modal-close');\n    if (btnCharClose) btnCharClose.addEventListener('click', closeCharModal);\n    var btnCharOverlay = document.getElementById('char-modal-overlay');\n    if (btnCharOverlay) btnCharOverlay.addEventListener('click', function(e) { if (e.target === btnCharOverlay) closeCharModal(); });\n    var btnSave = document.getElementById('btn-save-project');"
)

with open('index.js', 'w') as f:
    f.write(js)

# 验证
js2 = open('index.js').read()
for fn in ['openCharPage', 'renderCharList', 'openCharModal', 'closeCharModal', 'goCharPage', 'getCharFormHTML']:
    print(('OK' if 'function ' + fn in js2 else 'MISSING'), fn)
html2 = open('index.html').read()
for needle in ['page-chars', 'btn-chars-header', 'char-modal-overlay', 'btn-add-char']:
    print(('OK' if needle in html2 else 'MISSING'), needle)
print('Done. JS:', len(js2), 'chars')
