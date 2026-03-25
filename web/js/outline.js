/**
 * Outline Generation Module
 * 处理小说大纲的 AI 生成
 */
const NovelOutlineGen = (function() {
  let isGenerating = false;

  /**
   * 生成大纲的主函数
   */
  function generateOutline() {
    if (isGenerating) return;

    const project = NovelNav.getCurrentProject();
    if (!project) return;

    const settings = NovelNav.getActiveSettings();
    if (!settings.apiKey) {
      NovelUtils.toast('请先在设置中填入 API Key', 'error');
      return;
    }

    if (!project.initial_prompt) {
      NovelUtils.toast('请先填写初始设定', 'error');
      return;
    }

    isGenerating = true;
    NovelUtils.setButtonsDisabled(true);
    NovelNav.clearOutput();
    NovelUtils.log('开始生成大纲...', 'phase');
    NovelUtils.setProgress(5);

    // 禁用生成大纲按钮
    const btnOutline = document.getElementById('btn-outline');
    if (btnOutline) {
      btnOutline.disabled = true;
      btnOutline.style.opacity = '0.5';
      btnOutline.style.cursor = 'not-allowed';
    }

    const title = project.title;
    const genre = project.genre;
    
    // 【拆分】将 prompt 拆分为两个变量
    const basePrompt = project.initial_prompt;
    const contextPrompt = `小说标题：${title}\n类型：${genre}\n初始设定：${basePrompt}`;
    
    // 【DEBUG】输出 prompt 变量
    console.log('[OUTLINE] === 开始生成大纲 ===');
    console.log('[OUTLINE] basePrompt:', basePrompt);
    console.log('[OUTLINE] contextPrompt:', contextPrompt);
    console.log('[OUTLINE] title:', title);
    console.log('[OUTLINE] genre:', genre);

    const responseFormat = { type: 'json_object' };

    // Phase 1: Theme
    generateTheme(title, genre, basePrompt, contextPrompt, settings, responseFormat)
      .then(themeData => {
        NovelUtils.setProgress(15);
        return generatePlot(title, genre, themeData, basePrompt, contextPrompt, settings, responseFormat)
          .then(plotData => ({ themeData, plotData }));
      })
      .then(data => {
        NovelUtils.setProgress(25);
        return generateChapters(title, genre, data, basePrompt, contextPrompt, settings, responseFormat)
          .then(chapters => ({ ...data, chapters }));
      })
      .then(data => {
        NovelUtils.setProgress(35);
        return expandChapters(title, genre, data, basePrompt, contextPrompt, settings, responseFormat)
          .then(() => data);
      })
      .then(data => {
        NovelUtils.setProgress(68);
        return generateCharacterArcs(title, genre, data, basePrompt, contextPrompt, settings, responseFormat)
          .then(arcsData => ({ ...data, arcsData }));
      })
      .then(data => {
        NovelUtils.setProgress(80);
        return generateWorldBuilding(title, genre, data, basePrompt, contextPrompt, settings, responseFormat)
          .then(worldData => ({ ...data, worldData }));
      })
      .then(data => {
        assembleAndSaveOutline(project, data);
      })
      .catch(err => {
        NovelUtils.log('错误：' + err.message, 'error');
        NovelUtils.toast(err.message, 'error');
        console.error('[OUTLINE] 错误:', err);
      })
      .finally(() => {
        isGenerating = false;
        NovelUtils.setButtonsDisabled(false);
        setTimeout(() => {
          const bar = document.getElementById('progress-bar');
          if (bar) bar.style.display = 'none';
        }, 1500);
      });
  }

  /**
   * Phase 1: 生成主题
   */
  function generateTheme(title, genre, basePrompt, contextPrompt, settings, responseFormat) {
    NovelUtils.log('阶段 1/6 - 核心主旨...', 'phase');
    console.log('[OUTLINE] Phase 1: 生成主题');
    console.log('[OUTLINE] Prompt sent to API:', contextPrompt);
    
    return NovelAPI.call(
      [
        { role: 'system', content: '你是小说创作顾问，负责提炼故事的核心。只输出 JSON。' },
        { 
          role: 'user', 
          content: `${contextPrompt}\n\n提炼核心主题，返回 JSON：{"theme":"","purpose":"","tone":""}`
        }
      ],
      null,
      settings.model,
      settings.apiKey,
      settings.baseUrl,
      settings.provider,
      0.7,
      800,
      responseFormat
    ).then(r => {
      const data = JSON.parse(r.choices[0].message.content);
      console.log('[OUTLINE] Phase 1 响应:', data);
      NovelUtils.log('主旨：' + (data.theme || ''), 'success');
      return data;
    });
  }

  /**
   * Phase 2: 生成段落剧情
   */
  function generatePlot(title, genre, themeData, basePrompt, contextPrompt, settings, responseFormat) {
    NovelUtils.log('阶段 2/6 - 段落剧情...', 'phase');
    console.log('[OUTLINE] Phase 2: 生成段落剧情');
    console.log('[OUTLINE] Theme data:', themeData);
    
    return NovelAPI.call(
      [
        { role: 'system', content: '你是小说家，用一段连贯文字概述整本小说。只输出 JSON。' },
        { 
          role: 'user', 
          content: `标题：${title} 类型：${genre} 主题：${themeData.theme || ''} 基调：${themeData.tone || ''}\n设定：${basePrompt}\n\n用一段（约 200-400 字）概述剧情，返回 JSON：{"plot_paragraph":""}`
        }
      ],
      null,
      settings.model,
      settings.apiKey,
      settings.baseUrl,
      settings.provider,
      0.7,
      1200,
      responseFormat
    ).then(r => {
      const data = JSON.parse(r.choices[0].message.content);
      console.log('[OUTLINE] Phase 2 响应:', data);
      NovelUtils.log('段落剧情完成', 'success');
      return data;
    });
  }

  /**
   * Phase 3: 生成章节大纲
   */
  function generateChapters(title, genre, data, basePrompt, contextPrompt, settings, responseFormat) {
    NovelUtils.log('阶段 3/6 - 章节大纲...', 'phase');
    console.log('[OUTLINE] Phase 3: 生成章节大纲');
    console.log('[OUTLINE] Plot data:', data.plotData);
    
    return NovelAPI.call(
      [
        { role: 'system', content: '把一段剧情拆分为 N 个章节，每个只一句话描述。只输出 JSON。' },
        { 
          role: 'user', 
          content: `标题：${title} 类型：${genre} 主题：${data.themeData.theme || ''}\n剧情：${data.plotData.plot_paragraph || ''}\n\n拆分为章节（8-16 章），返回 JSON：{"total_chapters":0,"chapters":[{"chapter_number":1,"chapter_title":"","one_sentence":""}]}`
        }
      ],
      null,
      settings.model,
      settings.apiKey,
      settings.baseUrl,
      settings.provider,
      0.7,
      1500,
      responseFormat
    ).then(r => {
      const outlineData = JSON.parse(r.choices[0].message.content);
      const chapters = outlineData.chapters || [];
      console.log('[OUTLINE] Phase 3 响应:', outlineData);
      console.log('[OUTLINE] 章节数量:', chapters.length);
      NovelUtils.log('章节大纲（' + chapters.length + '章）', 'success');
      return chapters;
    });
  }

  /**
   * Phase 4: 扩写章节
   */
  function expandChapters(title, genre, data, basePrompt, contextPrompt, settings, responseFormat) {
    NovelUtils.log('阶段 4/6 - 章节扩写...', 'phase');
    console.log('[OUTLINE] Phase 4: 扩写章节');
    console.log('[OUTLINE] 待扩写章节数:', data.chapters.length);
    
    const promises = data.chapters.map((ch, i) => {
      const prev = i > 0 ? '第' + data.chapters[i - 1].chapter_number + '章「' + 
                         data.chapters[i - 1].chapter_title + '」' : '无';
      const next = i < data.chapters.length - 1 ? '第' + data.chapters[i + 1].chapter_number + 
                                                   '章「' + data.chapters[i + 1].chapter_title + '」' : '无';

      return NovelAPI.call(
        [
          { role: 'system', content: '将章节一句话扩展为完整段落。只输出 JSON。' },
          { 
            role: 'user', 
            content: `小说：${title} 类型：${genre} 主题：${data.themeData.theme || ''}\n剧情：${data.plotData.plot_paragraph || ''}\n前一章：${prev}\n本章：${ch.one_sentence || ch.chapter_title || ''}\n下一章：${next}\n\n扩写，返回 JSON：{"chapter_number":0,"chapter_title":"","one_sentence":"","expanded_paragraph":"","scene_setting":"","key_events":[],"characters_involved":[],"plot_progression":""}`
          }
        ],
        null,
        settings.model,
        settings.apiKey,
        settings.baseUrl,
        settings.provider,
        0.7,
        1200,
        responseFormat
      ).then(r => {
        NovelUtils.setProgress(40 + Math.round(i / data.chapters.length * 20));
        NovelUtils.log('第' + (i + 1) + '/' + data.chapters.length + '章「' + ch.chapter_title + '」', 'phase');
        try {
          const expanded = JSON.parse(r.choices[0].message.content);
          console.log(`[OUTLINE] Phase 4 - 第${i + 1}章扩写结果:`, expanded);
          data.chapters[i] = { ...ch, ...expanded };
        } catch (e) {
          console.error('[OUTLINE] Phase 4 - 解析章节扩写失败:', e);
        }
      });
    });

    return Promise.all(promises).then(() => {
      console.log('[OUTLINE] Phase 4 完成');
      NovelUtils.log('章节扩写完成', 'success');
    });
  }

  /**
   * Phase 5: 生成角色弧线
   */
  function generateCharacterArcs(title, genre, data, basePrompt, contextPrompt, settings, responseFormat) {
    NovelUtils.log('阶段 5/6 - 角色弧线...', 'phase');
    const charNames = data.chapters.flatMap(ch => ch.characters_involved || []);
    const unique = [...new Set(charNames)];
    
    console.log('[OUTLINE] Phase 5: 生成角色弧线');
    console.log('[OUTLINE] 检测到的角色:', unique);

    return NovelAPI.call(
      [
        { role: 'system', content: '根据故事为所有角色设计发展弧线。只输出 JSON。' },
        { 
          role: 'user', 
          content: `小说：${title} 类型：${genre} 主题：${data.themeData.theme || ''}\n剧情：${data.plotData.plot_paragraph || ''}\n角色：${unique.join(';')}\n\n角色弧线，返回 JSON：{"character_arcs":[{"character_name":"","initial_state":"","final_state":"","key_changes":[],"conflicts":[]}]}`
        }
      ],
      null,
      settings.model,
      settings.apiKey,
      settings.baseUrl,
      settings.provider,
      0.7,
      2000,
      responseFormat
    ).then(r => {
      try {
        const arcsData = JSON.parse(r.choices[0].message.content).character_arcs || [];
        console.log('[OUTLINE] Phase 5 响应:', arcsData);
        NovelUtils.log('角色弧线（' + arcsData.length + '条）', 'success');
        return arcsData;
      } catch (e) {
        console.error('[OUTLINE] Phase 5 - 解析角色弧线失败:', e);
        return [];
      }
    });
  }

  /**
   * Phase 6: 生成世界观
   */
  function generateWorldBuilding(title, genre, data, basePrompt, contextPrompt, settings, responseFormat) {
    NovelUtils.log('阶段 6/6 - 世界观...', 'phase');
    console.log('[OUTLINE] Phase 6: 生成世界观');
    console.log('[OUTLINE] 主题:', data.themeData.theme);
    
    return NovelAPI.call(
      [
        { role: 'system', content: '根据故事主题设计世界观。只输出 JSON。' },
        { 
          role: 'user', 
          content: `小说：${title} 类型：${genre} 主题：${data.themeData.theme || ''}\n剧情：${data.plotData.plot_paragraph || ''}\n\n世界观，返回 JSON：{"time_period":"","location":"","rules_of_world":[],"atmosphere":""}`
        }
      ],
      null,
      settings.model,
      settings.apiKey,
      settings.baseUrl,
      settings.provider,
      0.7,
      1500,
      responseFormat
    ).then(r => {
      try {
        const worldData = JSON.parse(r.choices[0].message.content);
        console.log('[OUTLINE] Phase 6 响应:', worldData);
        NovelUtils.log('世界观完成', 'success');
        return worldData;
      } catch (e) {
        console.error('[OUTLINE] Phase 6 - 解析世界观失败:', e);
        return {};
      }
    });
  }

  /**
   * 组装并保存大纲
   */
  function assembleAndSaveOutline(project, data) {
    NovelUtils.setProgress(95);
    console.log('[OUTLINE] 开始组装大纲');
    console.log('[OUTLINE] 最终数据:', JSON.stringify(data, null, 2));

    const outline = {
      theme: data.themeData || {},
      plot_paragraph: data.plotData.plot_paragraph || '',
      structure: { total_chapters: data.chapters.length, main_plot: data.plotData.plot_paragraph || '' },
      chapters: data.chapters || [],
      character_arcs: data.arcsData || [],
      world_building: data.worldData || {}
    };

    console.log('[OUTLINE] 组装后的大纲:', outline);

    NovelProject.updateOutline(project.id, outline);
    
    // 【修复】通过智能匹配更新角色，避免重复
    if (data.arcsData && data.arcsData.length) {
      NovelUtils.log('开始处理角色弧线...', 'phase');
      
      // 获取当前项目中的角色列表
      const currentProject = NovelNav.getCurrentProject();
      const existingCharacters = currentProject.characters || [];
      
      console.log('[OUTLINE] 现有角色:', existingCharacters);
      console.log('[OUTLINE] 角色弧线数据:', data.arcsData);
      
      // 遍历角色弧线数据
      (data.arcsData || []).forEach((arc, index) => {
        setTimeout(() => {
          // 智能匹配现有角色（基于名字包含关系）
          const matchedChar = existingCharacters.find(char => {
            const charName = char.character_name || char.name;
            const arcName = arc.character_name;
            // 精确匹配或包含匹配
            return charName === arcName || 
                   charName.includes(arcName) || 
                   arcName.includes(charName);
          });
          
          if (matchedChar) {
            // 更新现有角色
            NovelUtils.log(`更新角色「${arc.character_name}」...`, 'info');
            console.log('[OUTLINE] 更新角色:', matchedChar.id, arc);
            NovelProject.updateCharacter(currentProject.id, matchedChar.id, {
              initial_state: arc.initial_state,
              final_state: arc.final_state,
              key_changes: arc.key_changes || [],
              conflicts: arc.conflicts || [],
              personality: arc.personality || matchedChar.personality,
              background: arc.background || matchedChar.background,
              role_in_story: arc.role_in_story || matchedChar.role_in_story
            });
          } else {
            // 创建新角色
            NovelUtils.log(`创建新角色「${arc.character_name}」...`, 'info');
            console.log('[OUTLINE] 创建新角色:', arc);
            NovelProject.addCharacter(currentProject.id, {
              character_name: arc.character_name,
              name: arc.character_name,
              initial_state: arc.initial_state,
              final_state: arc.final_state,
              key_changes: arc.key_changes || [],
              conflicts: arc.conflicts || [],
              personality: arc.personality || '',
              background: arc.background || '',
              role_in_story: arc.role_in_story || '配角',
              enabled: true
            });
          }
        }, index * 100); // 错开处理时间，避免并发冲突
      });
    }

    // 重新加载项目数据
    const updatedProject = NovelStorage.getProjectById(project.id);
    NovelNav.setCurrentProject(updatedProject);
    NovelNav.applyProjectToUI();

    NovelUtils.setProgress(100);
    NovelUtils.log('大纲生成完成!', 'success');
    NovelNav.showTab('outline');
    NovelUtils.toast('大纲生成完成!');
    console.log('[OUTLINE] === 大纲生成流程结束 ===');
    
    // 大纲已就绪，保持生成按钮禁用状态
    const btnOutline = document.getElementById('btn-outline');
    if (btnOutline) {
      btnOutline.disabled = true;
      btnOutline.style.opacity = '0.5';
      btnOutline.style.cursor = 'not-allowed';
    }
  }

  return {
    generateOutline
  };
})();