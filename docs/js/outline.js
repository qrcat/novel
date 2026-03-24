/**
 * Outline Generation Module
 * 处理小说大纲的AI生成
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

    const title = project.title;
    const genre = project.genre;
    const prompt = project.initial_prompt;
    const responseFormat = { type: 'json_object' };

    // Phase 1: Theme
    generateTheme(title, genre, prompt, settings, responseFormat)
      .then(themeData => {
        NovelUtils.setProgress(15);
        return generatePlot(title, genre, themeData, prompt, settings, responseFormat)
          .then(plotData => ({ themeData, plotData }));
      })
      .then(data => {
        NovelUtils.setProgress(25);
        return generateChapters(title, genre, data, prompt, settings, responseFormat)
          .then(chapters => ({ ...data, chapters }));
      })
      .then(data => {
        NovelUtils.setProgress(35);
        return expandChapters(title, genre, data, prompt, settings, responseFormat)
          .then(() => data);
      })
      .then(data => {
        NovelUtils.setProgress(68);
        return generateCharacterArcs(title, genre, data, prompt, settings, responseFormat)
          .then(arcsData => ({ ...data, arcsData }));
      })
      .then(data => {
        NovelUtils.setProgress(80);
        return generateWorldBuilding(title, genre, data, prompt, settings, responseFormat)
          .then(worldData => ({ ...data, worldData }));
      })
      .then(data => {
        assembleAndSaveOutline(project, data);
      })
      .catch(err => {
        NovelUtils.log('错误: ' + err.message, 'error');
        NovelUtils.toast(err.message, 'error');
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
  function generateTheme(title, genre, prompt, settings, responseFormat) {
    NovelUtils.log('阶段1/6 - 核心主旨...', 'phase');
    return NovelAPI.call(
      [
        { role: 'system', content: '你是小说创作顾问，负责提炼故事的核心。只输出 JSON。' },
        { 
          role: 'user', 
          content: `小说标题：${title}\n类型：${genre}\n初始设定：${prompt}\n\n提炼核心主题，返回JSON：{"theme":"","purpose":"","tone":""}`
        }
      ],
      null,
      settings.model,
      settings.apiKey,
      settings.baseUrl,
      0.7,
      800,
      responseFormat
    ).then(r => {
      const data = JSON.parse(r.choices[0].message.content);
      NovelUtils.log('主旨: ' + (data.theme || ''), 'success');
      return data;
    });
  }

  /**
   * Phase 2: 生成段落剧情
   */
  function generatePlot(title, genre, themeData, prompt, settings, responseFormat) {
    NovelUtils.log('阶段2/6 - 段落剧情...', 'phase');
    return NovelAPI.call(
      [
        { role: 'system', content: '你是小说家，用一段连贯文字概述整本小说。只输出 JSON。' },
        { 
          role: 'user', 
          content: `标题：${title} 类型：${genre} 主题：${themeData.theme || ''} 基调：${themeData.tone || ''}\n设定：${prompt}\n\n用一段（约200-400字）概述剧情，返回JSON：{"plot_paragraph":""}`
        }
      ],
      null,
      settings.model,
      settings.apiKey,
      settings.baseUrl,
      0.7,
      1200,
      responseFormat
    ).then(r => {
      const data = JSON.parse(r.choices[0].message.content);
      NovelUtils.log('段落剧情完成', 'success');
      return data;
    });
  }

  /**
   * Phase 3: 生成章节大纲
   */
  function generateChapters(title, genre, data, prompt, settings, responseFormat) {
    NovelUtils.log('阶段3/6 - 章节大纲...', 'phase');
    return NovelAPI.call(
      [
        { role: 'system', content: '把一段剧情拆分为N个章节，每个只一句话描述。只输出 JSON。' },
        { 
          role: 'user', 
          content: `标题：${title} 类型：${genre} 主题：${data.themeData.theme || ''}\n剧情：${data.plotData.plot_paragraph || ''}\n\n拆分为章节（8-16章），返回JSON：{"total_chapters":0,"chapters":[{"chapter_number":1,"chapter_title":"","one_sentence":""}]}`
        }
      ],
      null,
      settings.model,
      settings.apiKey,
      settings.baseUrl,
      0.7,
      1500,
      responseFormat
    ).then(r => {
      const outlineData = JSON.parse(r.choices[0].message.content);
      const chapters = outlineData.chapters || [];
      NovelUtils.log('章节大纲（' + chapters.length + '章）', 'success');
      return chapters;
    });
  }

  /**
   * Phase 4: 扩写章节
   */
  function expandChapters(title, genre, data, prompt, settings, responseFormat) {
    NovelUtils.log('阶段4/6 - 章节扩写...', 'phase');
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
            content: `小说：${title} 类型：${genre} 主题：${data.themeData.theme || ''}\n剧情：${data.plotData.plot_paragraph || ''}\n前一章：${prev}\n本章：${ch.one_sentence || ch.chapter_title || ''}\n下一章：${next}\n\n扩写，返回JSON：{"chapter_number":0,"chapter_title":"","one_sentence":"","expanded_paragraph":"","scene_setting":"","key_events":[],"characters_involved":[],"plot_progression":""}`
          }
        ],
        null,
        settings.model,
        settings.apiKey,
        settings.baseUrl,
        0.7,
        1200,
        responseFormat
      ).then(r => {
        NovelUtils.setProgress(40 + Math.round(i / data.chapters.length * 20));
        NovelUtils.log('第' + (i + 1) + '/' + data.chapters.length + '章「' + ch.chapter_title + '」', 'phase');
        try {
          const expanded = JSON.parse(r.choices[0].message.content);
          data.chapters[i] = { ...ch, ...expanded };
        } catch (e) {
          console.error('Failed to parse chapter expansion:', e);
        }
      });
    });

    return Promise.all(promises).then(() => {
      NovelUtils.log('章节扩写完成', 'success');
    });
  }

  /**
   * Phase 5: 生成角色弧线
   */
  function generateCharacterArcs(title, genre, data, prompt, settings, responseFormat) {
    NovelUtils.log('阶段5/6 - 角色弧线...', 'phase');
    const charNames = data.chapters.flatMap(ch => ch.characters_involved || []);
    const unique = [...new Set(charNames)];

    return NovelAPI.call(
      [
        { role: 'system', content: '根据故事为所有角色设计发展弧线。只输出 JSON。' },
        { 
          role: 'user', 
          content: `小说：${title} 类型：${genre} 主题：${data.themeData.theme || ''}\n剧情：${data.plotData.plot_paragraph || ''}\n角色：${unique.join('；')}\n\n角色弧线，返回JSON：{"character_arcs":[{"character_name":"","initial_state":"","final_state":"","key_changes":[],"conflicts":[]}]}`
        }
      ],
      null,
      settings.model,
      settings.apiKey,
      settings.baseUrl,
      0.7,
      2000,
      responseFormat
    ).then(r => {
      try {
        const arcsData = JSON.parse(r.choices[0].message.content).character_arcs || [];
        NovelUtils.log('角色弧线（' + arcsData.length + '条）', 'success');
        return arcsData;
      } catch (e) {
        console.error('Failed to parse character arcs:', e);
        return [];
      }
    });
  }

  /**
   * Phase 6: 生成世界观
   */
  function generateWorldBuilding(title, genre, data, prompt, settings, responseFormat) {
    NovelUtils.log('阶段6/6 - 世界观...', 'phase');
    return NovelAPI.call(
      [
        { role: 'system', content: '根据故事主题设计世界观。只输出 JSON。' },
        { 
          role: 'user', 
          content: `小说：${title} 类型：${genre} 主题：${data.themeData.theme || ''}\n剧情：${data.plotData.plot_paragraph || ''}\n\n世界观，返回JSON：{"time_period":"","location":"","rules_of_world":[],"atmosphere":""}`
        }
      ],
      null,
      settings.model,
      settings.apiKey,
      settings.baseUrl,
      0.7,
      1500,
      responseFormat
    ).then(r => {
      try {
        const worldData = JSON.parse(r.choices[0].message.content);
        NovelUtils.log('世界观完成', 'success');
        return worldData;
      } catch (e) {
        console.error('Failed to parse world building:', e);
        return {};
      }
    });
  }

  /**
   * 组装并保存大纲
   */
  function assembleAndSaveOutline(project, data) {
    NovelUtils.setProgress(95);

    const outline = {
      theme: data.themeData || {},
      plot_paragraph: data.plotData.plot_paragraph || '',
      structure: { total_chapters: data.chapters.length, main_plot: data.plotData.plot_paragraph || '' },
      chapters: data.chapters || [],
      character_arcs: data.arcsData || [],
      world_building: data.worldData || {}
    };

    NovelProject.updateOutline(project.id, outline);
    
    // 更新角色列表
    if (data.arcsData && data.arcsData.length) {
      (data.arcsData || []).forEach(arc => {
        NovelProject.addCharacter(project.id, {
          character_name: arc.character_name,
          name: arc.character_name,
          initial_state: arc.initial_state,
          final_state: arc.final_state,
          key_changes: arc.key_changes || [],
          conflicts: arc.conflicts || []
        });
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
  }

  return {
    generateOutline
  };
})();
