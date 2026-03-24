/**
 * Utils Module
 * 通用工具函数
 */
const NovelUtils = (function() {
  return {
    // HTML转义，防止XSS
    escape(str) {
      return String(str || '').replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    },

    // 生成UUID
    uuid() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    },

    // 格式化日期为 MM/DD HH:MM
    formatDate(iso) {
      const d = new Date(iso || Date.now());
      return (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
        String(d.getHours()).padStart(2, '0') + ':' + 
        String(d.getMinutes()).padStart(2, '0');
    },

    // 格式化时间为 HH:MM:SS
    formatTime() {
      const d = new Date();
      return String(d.getHours()).padStart(2, '0') + ':' +
        String(d.getMinutes()).padStart(2, '0') + ':' +
        String(d.getSeconds()).padStart(2, '0');
    },

    // 显示弹窗通知
    toast(message, type = '') {
      const el = document.getElementById('toast');
      if (!el) return;
      el.textContent = message;
      el.className = 'toast' + (type ? ' ' + type : '');
      el.style.display = 'block';
      setTimeout(() => { el.style.display = 'none'; }, 2500);
    },

    // 输出日志
    log(message, kind = '') {
      const el = document.getElementById('output-box');
      if (!el) return;
      const div = document.createElement('div');
      div.className = 'log-entry' + (kind ? ' log-' + kind : '');
      div.textContent = '[' + this.formatTime() + '] ' + message;
      el.appendChild(div);
      el.scrollTop = el.scrollHeight;
    },

    // 设置进度条
    setProgress(percentage) {
      const bar = document.getElementById('progress-bar');
      const fill = document.getElementById('progress-fill');
      if (!bar || !fill) return;
      bar.style.display = 'block';
      fill.style.width = percentage + '%';
    },

    // 设置按钮禁用状态
    setButtonsDisabled(disabled) {
      ['btn-outline', 'btn-round', 'btn-outline2', 'btn-round2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = disabled;
      });
    },

    // 清空输出框
    clearOutput() {
      const el = document.getElementById('output-box');
      if (el) el.textContent = '';
    }
  };
})();
