/**
 * Storage Module
 * 处理本地存储的所有操作（全局设置、项目列表）
 */
const NovelStorage = (function() {
  const GLOBAL_KEY = 'na_settings';
  const PROJECTS_KEY = 'na_projects';

  const DEFAULT_SETTINGS = {
    api_key: '',
    base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    channel: 'dashscope',
    model: 'qwen-plus',
    temperature: 0.8
  };

  return {
    // 获取全局设置
    getSettings() {
      const stored = localStorage.getItem(GLOBAL_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
    },

    // 保存全局设置
    saveSettings(settings) {
      localStorage.setItem(GLOBAL_KEY, JSON.stringify(settings));
    },

    // 重置全局设置
    resetSettings() {
      localStorage.removeItem(GLOBAL_KEY);
    },

    // 获取所有项目
    getProjects() {
      const stored = localStorage.getItem(PROJECTS_KEY) || '[]';
      return JSON.parse(stored);
    },

    // 保存项目列表
    saveProjects(projects) {
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    },

    // 根据ID获取项目
    getProjectById(id) {
      const projects = this.getProjects();
      return projects.find(p => p.id === id);
    },

    // 更新项目
    updateProject(id, updates) {
      const projects = this.getProjects();
      const project = projects.find(p => p.id === id);
      if (project) {
        Object.assign(project, updates, { updated_at: new Date().toISOString() });
        this.saveProjects(projects);
        return project;
      }
      return null;
    },

    // 删除项目
    deleteProject(id) {
      const projects = this.getProjects();
      const filtered = projects.filter(p => p.id !== id);
      this.saveProjects(filtered);
    },

    // 添加项目
    addProject(project) {
      const projects = this.getProjects();
      projects.unshift(project);
      this.saveProjects(projects);
    }
  };
})();
