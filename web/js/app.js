/**
 * Novel Agents Application
 * 主应用脚本 - 初始化并协调所有模块
 */

(function() {
  'use strict';

  /**
   * App 初始化
   */
  function initApp() {
    console.log('[NovelAgents] Initializing app...');

    // 绑定基础UI事件
    NovelUI.bindAllEvents();

    // 绑定大纲生成按钮事件
    const btnOutline = document.getElementById('btn-outline');
    const btnOutline2 = document.getElementById('btn-outline2');
    if (btnOutline) btnOutline.addEventListener('click', () => NovelOutlineGen.generateOutline());
    if (btnOutline2) btnOutline2.addEventListener('click', () => NovelOutlineGen.generateOutline());

    // 导航到首页
    NovelNav.goHome();

    console.log('[NovelAgents] App initialized');
  }

  // 在DOM加载完成后初始化应用
  document.addEventListener('DOMContentLoaded', function() {
    console.log('[NovelAgents] DOM loaded');
    try {
      initApp();
    } catch (e) {
      console.error('[NovelAgents] Initialization error:', e);
    }
  });
})();
