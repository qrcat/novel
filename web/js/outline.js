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

    // Phase 1 和 Phase 2 不需要 responseFormat（纯文本输出，代码层组装 JSON）
    // Phase 3-6 需要 responseFormat = { type: 'json_object' }
    
    // Phase 1: Theme (不需要 JSON 格式)
    generateTheme(title, genre, basePrompt, contextPrompt, settings, null)
    // Phase 1 和 Phase 2 不需要 responseFormat（纯文本输出，代码层组装 JSON）
    // Phase 3-6 需要 responseFormat = { type: 'json_object' }
    
    // Phase 1: Theme (不需要 JSON 格式)
    generateTheme(title, genre, basePrompt, contextPrompt, settings, null)
      .then(themeData => {
        NovelUtils.setProgress(15);
        // Phase 2: Plot (不需要 JSON 格式)
        return generatePlot(title, genre, themeData, basePrompt, contextPrompt, settings, null)
        // Phase 2: Plot (不需要 JSON 格式)
        return generatePlot(title, genre, themeData, basePrompt, contextPrompt, settings, null)
          .then(plotData => ({ themeData, plotData }));
      })
      .then(data => {
        NovelUtils.setProgress(25);
        // Phase 3: Chapters (需要 JSON 格式)
        const responseFormat = { type: 'json_object' };
        // Phase 3: Chapters (需要 JSON 格式)
        const responseFormat = { type: 'json_object' };
        return generateChapters(title, genre, data, basePrompt, contextPrompt, settings, responseFormat)
          .then(chapters => ({ ...data, chapters }));
      })
      .then(data => {
        NovelUtils.setProgress(35);
        // Phase 4: Expand Chapters (需要 JSON 格式)
        const responseFormat = { type: 'json_object' };
        // Phase 4: Expand Chapters (需要 JSON 格式)
        const responseFormat = { type: 'json_object' };
        return expandChapters(title, genre, data, basePrompt, contextPrompt, settings, responseFormat)
          .then(() => data);
      })
      .then(data => {
        NovelUtils.setProgress(68);
        // Phase 5: Character Arcs (需要 JSON 格式)
        const responseFormat = { type: 'json_object' };
        // Phase 5: Character Arcs (需要 JSON 格式)
        const responseFormat = { type: 'json_object' };
        return generateCharacterArcs(title, genre, data, basePrompt, contextPrompt, settings, responseFormat)
          .then(arcsData => ({ ...data, arcsData }));
      })
      .then(data => {
        NovelUtils.setProgress(80);
        // Phase 6: World Building (需要 JSON 格式)
        const responseFormat = { type: 'json_object' };
        // Phase 6: World Building (需要 JSON 格式)
        const responseFormat = { type: 'json_object' };
        return generateWorldBuilding(title, genre, data, basePrompt, contextPrompt, settings, responseFormat)
          .then(worldData => ({ ...data, worldData }));
      })
      .then(data => {
        return assembleAndSaveOutline(project, data);
        return assembleAndSaveOutline(project, data);
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
    
    let theme, purpose; // 在函数作用域声明变量，供所有 Promise 链使用
    
    // 串行执行三次调用，每次都将之前的对话历史加入
    let theme, purpose; // 在函数作用域声明变量，供所有 Promise 链使用
    
    // 串行执行三次调用，每次都将之前的对话历史加入
    return NovelAPI.call(
      [
        {
          role: 'system', 
          content: '你是一名专业小说创作顾问，擅长提炼故事的核心表达。请用简洁、有概括力的一句话总结主题。只输出结果，不要解释、不要附加说明。' 
        },
        {
          role: 'system', 
          content: '你是一名专业小说创作顾问，擅长提炼故事的核心表达。请用简洁、有概括力的一句话总结主题。只输出结果，不要解释、不要附加说明。' 
        },
        { 
          role: 'user', 
                content: `${contextPrompt}

请基于以上信息，提炼故事的核心主题。

要求：
- 用一句话表达（20-50 字）
- 具有抽象性与概括性（如人性、命运、选择、成长等）
- 避免具体剧情细节
- 语言简洁有力

请直接输出主题：`
                content: `${contextPrompt}

请基于以上信息，提炼故事的核心主题。

要求：
- 用一句话表达（20-50 字）
- 具有抽象性与概括性（如人性、命运、选择、成长等）
- 避免具体剧情细节
- 语言简洁有力

请直接输出主题：`
        }
      ],
      null,
      settings.model,
      settings.apiKey,
      settings.baseUrl,
      settings.provider,
      1.5,
      1000,
      responseFormat
    ).then(themeResponse => {
      theme = themeResponse.choices[0].message.content.trim();
      console.log('[OUTLINE]Theme:', theme);
      
      // 第二次调用：加入第一次的对话历史
      return NovelAPI.call(
        [
          {
            role: 'system', 
            content: '你是一名专业小说创作顾问，擅长明确作品的表达意图。请用一句话说明故事的创作目的。只输出结果，不要解释或补充。' 
          },
          { 
            role: 'user', 
            content: `${contextPrompt}

已确定主题：
"${theme}"

请基于该主题，说明本故事的创作目的与想要传达的思想。

要求：
- 用一句话表达（20-50 字）
- 明确"为什么要写这个故事"
- 体现价值观或思想表达
- 避免重复主题原句

请直接输出创作目的：`
          }
        ],
        null,
        settings.model,
        settings.apiKey,
        settings.baseUrl,
        settings.provider,
        1.5,
        1000,
        responseFormat
      );
    }).then(purposeResponse => {
      purpose = purposeResponse.choices[0].message.content.trim();
      console.log('[OUTLINE]Purpose:', purpose);
      
      // 第三次调用：加入前两次的对话历史
      return NovelAPI.call(
        [
          {
            role: 'system', 
            content: '你是一名专业小说创作顾问，擅长提炼作品的整体氛围与风格。请用关键词概括基调。只输出结果，不要解释。' 
          },
          { 
            role: 'user', 
            content: `${contextPrompt}

已确定：
主题："${theme}"
创作目的："${purpose}"

请概括故事的整体基调与氛围。

要求：
- 使用 2-3 个关键词或短语（10-30 字）
- 关键词之间用顿号或逗号分隔
- 风格清晰（如：压抑、史诗、温暖、黑暗、荒诞等）
- 与主题和目的保持一致

请直接输出基调：`
          }
        ],
        null,
        settings.model,
        settings.apiKey,
        settings.baseUrl,
        settings.provider,
        1.5,
        1000,
        responseFormat
      );
    }).then(toneResponse => {
      const tone = toneResponse.choices[0].message.content.trim();
      console.log('[OUTLINE]Tone:', tone);
      
      const data = {
        theme: theme,
        purpose: purpose,
        tone: tone
      };
      console.log('[OUTLINE]Phase 1:', data);
      NovelUtils.log('主旨：' + theme, 'success');
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
        { 
          role: 'system', 
      content: '你是一位专业小说家，擅长构建完整故事结构与情节脉络。请用精炼、连贯的一段文字概述整本小说剧情。只输出正文内容，不要使用JSON或任何额外说明。' 
        },
        { 
          role: 'system', 
      content: '你是一位专业小说家，擅长构建完整故事结构与情节脉络。请用精炼、连贯的一段文字概述整本小说剧情。只输出正文内容，不要使用JSON或任何额外说明。' 
        },
        { 
          role: 'user', 
          content: `请根据以下信息生成小说整体剧情概述：

标题：${title}
类型：${genre}
主题：${themeData.theme || '未指定'}
基调：${themeData.tone || '未指定'}
设定：${basePrompt}

要求：
- 用一段完整文字（约200-400字）
- 包含清晰的起承转合（开端、发展、高潮、结局）
- 突出核心冲突与人物命运变化
- 风格与“类型”和“基调”保持一致
- 不要分段、不要列点、不要解释说明

请直接输出最终概述：`
          content: `请根据以下信息生成小说整体剧情概述：

标题：${title}
类型：${genre}
主题：${themeData.theme || '未指定'}
基调：${themeData.tone || '未指定'}
设定：${basePrompt}

要求：
- 用一段完整文字（约200-400字）
- 包含清晰的起承转合（开端、发展、高潮、结局）
- 突出核心冲突与人物命运变化
- 风格与“类型”和“基调”保持一致
- 不要分段、不要列点、不要解释说明

请直接输出最终概述：`
        }
      ],
      null,
      settings.model,
      settings.apiKey,
      settings.baseUrl,
      settings.provider,
      1.5,
      2000,
      1.5,
      2000,
      responseFormat
    ).then(r => {
      // 将 AI 输出的纯文本组装为 JSON 格式
      const plotText = r.choices[0].message.content.trim();
      const data = { plot_paragraph: plotText };
      console.log('[OUTLINE] Phase 2 Plot:', plotText);
      // 将 AI 输出的纯文本组装为 JSON 格式
      const plotText = r.choices[0].message.content.trim();
      const data = { plot_paragraph: plotText };
      console.log('[OUTLINE] Phase 2 Plot:', plotText);
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
        {
          role: 'system', 
          content: '你是一名专业小说结构策划师，擅长将完整剧情拆解为清晰的章节结构。请严格按照指定JSON格式输出，不要添加任何解释、说明或多余文本。' 
        },
        {
          role: 'system', 
          content: '你是一名专业小说结构策划师，擅长将完整剧情拆解为清晰的章节结构。请严格按照指定JSON格式输出，不要添加任何解释、说明或多余文本。' 
        },
        { 
          role: 'user', 
      content: `请根据以下信息，将剧情拆分为章节大纲：

标题：${title}
类型：${genre}
主题：${data.themeData.theme || '未指定'}
剧情：${data.plotData.plot_paragraph || ''}

要求：
- 拆分为 6-24 章
- 每章包含：章节编号、章节标题、剧情一句话概述
- 每章“一句话”需简洁（15-40字），但包含关键事件或推进
- 章节之间应具有连贯性与递进关系（起承转合清晰）
- 标题需简短有吸引力（避免重复或泛化，如“新的开始”）
- 避免空洞描述（如“发生了一些事情”）

输出格式（必须严格一致）：
{
  "total_chapters": 数字,
  "chapters": [
    {
      "chapter_number": 1,
      "chapter_title": "标题",
      "one_sentence": "一句话剧情"
    }
  ]
}

请直接输出JSON结果：`
      content: `请根据以下信息，将剧情拆分为章节大纲：

标题：${title}
类型：${genre}
主题：${data.themeData.theme || '未指定'}
剧情：${data.plotData.plot_paragraph || ''}

要求：
- 拆分为 6-24 章
- 每章包含：章节编号、章节标题、剧情一句话概述
- 每章“一句话”需简洁（15-40字），但包含关键事件或推进
- 章节之间应具有连贯性与递进关系（起承转合清晰）
- 标题需简短有吸引力（避免重复或泛化，如“新的开始”）
- 避免空洞描述（如“发生了一些事情”）

输出格式（必须严格一致）：
{
  "total_chapters": 数字,
  "chapters": [
    {
      "chapter_number": 1,
      "chapter_title": "标题",
      "one_sentence": "一句话剧情"
    }
  ]
}

请直接输出JSON结果：`
        }
      ],
      null,
      settings.model,
      settings.apiKey,
      settings.baseUrl,
      settings.provider,
      1.0,
      10000,
      responseFormat
    ).then(r => {
      console.log('[LLM Response]', r.choices[0].message.content);

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
          {
            role: 'system', 
            content: '你是一名专业小说作者，擅长将章节梗概扩展为完整内容，并输出结构化信息。请严格按照指定JSON格式输出，不要添加任何解释、说明或额外文本。' 
          },
          {
            role: 'system', 
            content: '你是一名专业小说作者，擅长将章节梗概扩展为完整内容，并输出结构化信息。请严格按照指定JSON格式输出，不要添加任何解释、说明或额外文本。' 
          },
          { 
            role: 'user', 
            content: `请根据以下信息，对章节进行扩写：

小说标题：${title}
类型：${genre}
主题：${data.themeData.theme || '未指定'}

整体剧情概要：
${data.plotData.plot_paragraph || ''}

上下文：
- 前一章：${prev}
- 本章：${ch.one_sentence || ch.chapter_title || ''}
- 下一章：${next}

要求：
- expanded_paragraph：扩写为一段完整剧情（100-300字），包含场景、人物行为、冲突或推进
- scene_setting：简要描述本章主要场景（时间/地点/环境，10-30字）
- key_events：列出2-4个关键事件（简洁短语）
- characters_involved：列出涉及角色名称（无则空数组）
- plot_progression：说明本章在整体剧情中的推进作用（20-50字）

约束：
- 内容需与上下章逻辑连贯，不得自相矛盾
- 必须体现剧情推进，避免重复或无效描写
- 不要扩展出设定之外的新主线
- 所有字段必须填写（可为空数组，但不能缺失）

输出格式（必须严格一致）：
{
  "chapter_number": ${ch.chapter_number || 0},
  "chapter_title": "${ch.chapter_title || ''}",
  "one_sentence": "${ch.one_sentence || ''}",
  "expanded_paragraph": "",
  "scene_setting": "",
  "key_events": [],
  "characters_involved": [],
  "plot_progression": ""
}

请直接输出JSON结果：`
            content: `请根据以下信息，对章节进行扩写：

小说标题：${title}
类型：${genre}
主题：${data.themeData.theme || '未指定'}

整体剧情概要：
${data.plotData.plot_paragraph || ''}

上下文：
- 前一章：${prev}
- 本章：${ch.one_sentence || ch.chapter_title || ''}
- 下一章：${next}

要求：
- expanded_paragraph：扩写为一段完整剧情（100-300字），包含场景、人物行为、冲突或推进
- scene_setting：简要描述本章主要场景（时间/地点/环境，10-30字）
- key_events：列出2-4个关键事件（简洁短语）
- characters_involved：列出涉及角色名称（无则空数组）
- plot_progression：说明本章在整体剧情中的推进作用（20-50字）

约束：
- 内容需与上下章逻辑连贯，不得自相矛盾
- 必须体现剧情推进，避免重复或无效描写
- 不要扩展出设定之外的新主线
- 所有字段必须填写（可为空数组，但不能缺失）

输出格式（必须严格一致）：
{
  "chapter_number": ${ch.chapter_number || 0},
  "chapter_title": "${ch.chapter_title || ''}",
  "one_sentence": "${ch.one_sentence || ''}",
  "expanded_paragraph": "",
  "scene_setting": "",
  "key_events": [],
  "characters_involved": [],
  "plot_progression": ""
}

请直接输出JSON结果：`
          }
        ],
        null,
        settings.model,
        settings.apiKey,
        settings.baseUrl,
        settings.provider,
        1.0,
        4000,
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
        { 
          role: 'system', 
          content: '你是一名专业小说人物策划师，擅长设计角色成长弧线与人物关系。请严格按照指定JSON格式输出，不要添加任何解释、说明或额外文本。' 
        },
        { 
          role: 'system', 
          content: '你是一名专业小说人物策划师，擅长设计角色成长弧线与人物关系。请严格按照指定JSON格式输出，不要添加任何解释、说明或额外文本。' 
        },
        { 
          role: 'user', 
          content: `请根据以下信息，为小说中的主要角色设计完整的发展弧线：

小说标题：${title}
类型：${genre}
主题：${data.themeData.theme || '未指定'}

整体剧情概要：
${data.plotData.plot_paragraph || ''}

角色列表：
${unique.join('；') || '无'}

要求：
- 为每个角色分别设计成长弧线（不要遗漏）
- initial_state：角色在故事开端的状态（性格/处境/信念，20-50字）
- final_state：角色在结局时的变化结果（成长/堕落/觉醒等，20-50字）
- key_changes：列出2-4个关键转折或变化节点（简洁短语）
- conflicts：列出2-4个核心冲突（内在冲突或人与人/世界冲突）

约束：
- 所有角色弧线需围绕“主题”展开，体现主题表达
- 不同角色之间应存在差异（避免重复或模板化）
- 弧线应与剧情发展合理对应，不得脱离主线
- 避免空洞描述（如“逐渐成长”“经历困难”）
- 所有字段必须填写（可为空数组，但不能缺失）

输出格式（必须严格一致）：
{
  "character_arcs": [
    {
      "character_name": "",
      "initial_state": "",
      "final_state": "",
      "key_changes": [],
      "conflicts": []
    }
  ]
}

请直接输出JSON结果：`
          content: `请根据以下信息，为小说中的主要角色设计完整的发展弧线：

小说标题：${title}
类型：${genre}
主题：${data.themeData.theme || '未指定'}

整体剧情概要：
${data.plotData.plot_paragraph || ''}

角色列表：
${unique.join('；') || '无'}

要求：
- 为每个角色分别设计成长弧线（不要遗漏）
- initial_state：角色在故事开端的状态（性格/处境/信念，20-50字）
- final_state：角色在结局时的变化结果（成长/堕落/觉醒等，20-50字）
- key_changes：列出2-4个关键转折或变化节点（简洁短语）
- conflicts：列出2-4个核心冲突（内在冲突或人与人/世界冲突）

约束：
- 所有角色弧线需围绕“主题”展开，体现主题表达
- 不同角色之间应存在差异（避免重复或模板化）
- 弧线应与剧情发展合理对应，不得脱离主线
- 避免空洞描述（如“逐渐成长”“经历困难”）
- 所有字段必须填写（可为空数组，但不能缺失）

输出格式（必须严格一致）：
{
  "character_arcs": [
    {
      "character_name": "",
      "initial_state": "",
      "final_state": "",
      "key_changes": [],
      "conflicts": []
    }
  ]
}

请直接输出JSON结果：`
        }
      ],
      null,
      settings.model,
      settings.apiKey,
      settings.baseUrl,
      settings.provider,
      1.0,
      4000,
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
        {
          role: 'system', 
          content: '你是一名专业小说世界观设计师，擅长构建清晰、自洽且服务主题的世界设定。请严格按照指定JSON格式输出，不要添加任何解释、说明或额外文本。' 
        },
        { 
          role: 'user', 
          content: `请根据以下信息，为小说设计完整且自洽的世界观设定：

小说标题：${title}
类型：${genre}
主题：${data.themeData.theme || '未指定'}

整体剧情概要：
${data.plotData.plot_paragraph || ''}

要求：
- time_period：明确时间背景（如具体时代/未来阶段/架空纪元，10-30字）
- location：主要舞台或世界结构（如城市、国家、星球、异世界等，20-50字）
- rules_of_world：列出3-5条世界运行规则（如社会制度、科技/魔法体系、资源限制等，必须具体）
- atmosphere：整体氛围（20-50字，需与类型和主题一致）

约束：
- 世界观必须服务“主题”和“剧情”，不得脱离主线
- rules_of_world 必须具有“约束力”（能影响角色行为或剧情发展）
- 避免空洞描述（如“一个神秘的世界”）
- 各字段之间需逻辑一致，不得自相矛盾
- 所有字段必须填写（rules_of_world 至少3条）

输出格式（必须严格一致）：
{
  "time_period": "",
  "location": "",
  "rules_of_world": [],
  "atmosphere": ""
}

请直接输出JSON结果：`
        }
      ],
      null,
      settings.model,
      settings.apiKey,
      settings.baseUrl,
      settings.provider,
      1.0,
      4000,
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
  async function assembleAndSaveOutline(project, data) {
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
    // 使用 async/await + for 循环确保角色全部创建完成后再刷新 UI
    if (outline.character_arcs && outline.character_arcs.length) {
      NovelUtils.log(`开始处理 ${outline.character_arcs.length} 个角色...`, 'info');
      
      // 获取当前项目中的角色列表
      const currentProject = NovelNav.getCurrentProject();
      // 注意：这里需要重新获取最新的项目数据，因为 updateOutline 可能刚写入
      const freshProject = NovelStorage.getProjectById(project.id);
      const existingCharacters = freshProject.characters || [];
      
      console.log('[OUTLINE] 现有角色:', existingCharacters);
      console.log('[OUTLINE] 角色弧线数据:', outline.character_arcs);
      
      // 串行处理每个角色，确保数据一致性
      for (let i = 0; i < outline.character_arcs.length; i++) {
        const arc = outline.character_arcs[i];
        
        // 每次循环前重新获取最新角色列表，确保能匹配到刚添加的角色
        const latestProject = NovelStorage.getProjectById(project.id);
        const latestCharacters = latestProject.characters || [];

        // 智能匹配现有角色（基于名字包含关系）
        const matchedChar = latestCharacters.find(char => {
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
          NovelProject.updateCharacter(project.id, matchedChar.id, {
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
          NovelProject.addCharacter(project.id, {
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
        
        // 短暂延迟，避免连续写入 localStorage 的性能问题
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      NovelUtils.log(`角色处理完成，共处理 ${outline.character_arcs.length} 个角色`, 'success');
    }

    // 重新加载项目数据（确保所有角色已保存）
    const updatedProject = NovelStorage.getProjectById(project.id);
    NovelNav.setCurrentProject(updatedProject);
    NovelNav.applyProjectToUI();

    NovelUtils.setProgress(100);
    NovelUtils.log('大纲生成完成!', 'success');
    
    NovelUI.renderCharactersList();

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