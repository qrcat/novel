/**
 * Storage Module
 * 处理本地存储的所有操作（全局设置、项目列表、多提供商配置）
 */
const NovelStorage = (function() {
  const GLOBAL_KEY = 'na_settings';
  const PROJECTS_KEY = 'na_projects';
  const PROVIDERS_KEY = 'na_providers';  // 存储多个提供商的API Key配置

  const DEFAULT_SETTINGS = {
    activeProvider: 'dashscope',  // 当前活跃的提供商
    temperature: 0.8,
    // 以下字段保留向后兼容
    api_key: '',
    base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    channel: 'dashscope',
    model: 'qwen-plus'
  };

  // 默认的提供商配置
  const DEFAULT_PROVIDERS = {
    dashscope: { apiKey: '', model: 'qwen-plus' },
    openai: { apiKey: '', model: 'gpt-4o' },
    claude: { apiKey: '', model: 'claude-opus' },
    custom: { apiKey: '', baseUrl: '', model: 'custom-model' }
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

    // ========== 多提供商管理 ==========

    // 获取所有提供商配置
    getAllProviderConfigs() {
      const stored = localStorage.getItem(PROVIDERS_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_PROVIDERS;
    },

    // 获取特定提供商配置
    getProviderConfig(providerId) {
      const configs = this.getAllProviderConfigs();
      return configs[providerId] || DEFAULT_PROVIDERS[providerId] || {};
    },

    // 保存提供商配置
    saveProviderConfig(providerId, config) {
      const configs = this.getAllProviderConfigs();
      configs[providerId] = config;
      localStorage.setItem(PROVIDERS_KEY, JSON.stringify(configs));
    },

    // 设置活跃提供商
    setActiveProvider(providerId) {
      const settings = this.getSettings();
      settings.activeProvider = providerId;
      this.saveSettings(settings);
    },

    // 获取活跃提供商ID
    getActiveProvider() {
      const settings = this.getSettings();
      return settings.activeProvider || 'dashscope';
    },

    // 获取活跃提供商的当前配置
    getActiveProviderConfig() {
      const providerId = this.getActiveProvider();
      return this.getProviderConfig(providerId);
    },

    // ========== 项目管理 ==========

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
