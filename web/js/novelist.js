/**
 * Novelist Generation Module
 * 处理小说内容的生成（基于大纲）
 * 支持多 Agent 协作模式：每个角色都有独立的 Agent
 * 
 * 智能工作流：
 * 1. 通过工具调用自动识别章节涉及的角色
 * 2. 在写作过程中实时调用角色 Agent 获取行为、语言描写
 */
const NovelWriter = (function() {
  let isGenerating = false;
  let useMultiAgent = true; // 是否启用多 Agent 协作模式

  /**
   * 设置是否使用多 Agent 模式
   */
  function setMultiAgentMode(enabled) {
    useMultiAgent = enabled;
    NovelUtils.toast(`多 Agent 模式已${enabled ? '开启' : '关闭'}`);
  }

  /**
   * 生成小说内容（一段或多段）
   * @param {Number} rounds - 生成轮次（1 或 3）
   */
  function generateRound(rounds = 1) {
    if (isGenerating) return;

    const project = NovelNav.getCurrentProject();
    if (!project) {
      NovelUtils.toast('请先打开或创建项目', 'error');
      return;
    }

    if (!project.outline || !Object.keys(project.outline).length) {
      NovelUtils.toast('请先生成大纲', 'error');
      return;
    }

    const settings = NovelNav.getActiveSettings();
    if (!settings.apiKey) {
      NovelUtils.toast('请先在设置中填入 API Key', 'error');
      return;
    }

    const outline = project.outline;
    if (!outline.chapters || !outline.chapters.length) {
      NovelUtils.toast('大纲中没有章节信息', 'error');
      return;
    }

    // 初始化角色 Agents
    if (useMultiAgent && project.characters && project.characters.length > 0) {
      NovelAgents.initAgents(project, project.characters);
      NovelUtils.log(`已加载 ${project.characters.length} 个角色 Agent`, 'phase');
    }

    isGenerating = true;
    NovelUtils.setButtonsDisabled(true);
    NovelUtils.setProgress(5);

    const title = project.title || '';
    const genre = project.genre || '';
    const initialPrompt = project.initial_prompt || '';
    const currentNovel = project.novel_text || '';
    
    // 确定要写哪一章（简单逻辑：找第一个还未生成的章节，或继续最后一章）
    const generatedCount = currentNovel ? (currentNovel.match(/^第\s*\d+\s*章/gm) || []).length : 0;
    const targetChapters = outline.chapters.slice(generatedCount, generatedCount + rounds);

    if (!targetChapters.length) {
      NovelUtils.toast('所有章节已生成完毕', 'success');
      isGenerating = false;
      NovelUtils.setButtonsDisabled(false);
      return;
    }

    NovelUtils.log(`将生成第 ${generatedCount + 1} - ${generatedCount + targetChapters.length} 章`, 'phase');

    // 依次生成每一章
    let novelContent = currentNovel;
    let progressStep = Math.floor(90 / targetChapters.length);
    let currentProgress = 5;

    return Promise.resolve()
      .then(() => {
        // 逐章生成
        return targetChapters.reduce((chain, chapter, index) => {
          return chain.then(() => {
            if (useMultiAgent && project.characters && project.characters.length > 0) {
              // 多 Agent 协作模式 - 智能工作流
              return generateChapterWithSmartAgents(
                title, genre, initialPrompt, outline, chapter, 
                novelContent, settings, project.characters
              ).then(content => {
                novelContent += (novelContent ? '\n\n' : '') + content;
                currentProgress += progressStep;
                NovelUtils.setProgress(currentProgress);
                NovelUtils.log(`第 ${generatedCount + index + 1} 章完成（智能多 Agent 协作）`, 'success');
              });
            } else {
              // 单 Agent 模式（原有逻辑）
              return generateChapterContent(
                title, genre, initialPrompt, outline, chapter, novelContent, settings
              ).then(content => {
                novelContent += (novelContent ? '\n\n' : '') + content;
                currentProgress += progressStep;
                NovelUtils.setProgress(currentProgress);
                NovelUtils.log(`第 ${generatedCount + index + 1} 章完成`, 'success');
              });
            }
          });
        }, Promise.resolve());
      })
      .then(() => {
        // 保存生成的内容
        NovelUtils.setProgress(95);
        NovelStorage.updateProject(project.id, {
          novel_text: novelContent,
          writing_chapter: generatedCount + targetChapters.length
        });
        
        // 同步 Agent 状态到项目数据
        if (useMultiAgent) {
          NovelAgents.syncToProject(project);
        }
        
        // 重新加载最新的项目数据
        const updatedProject = NovelStorage.getProjectById(project.id);
        NovelNav.setCurrentProject(updatedProject);
        
        // 更新 UI 并切换到输出 Tab
        NovelNav.applyProjectToUI();
        NovelNav.showTab('output');
        NovelUtils.log('小说内容已保存', 'success');
        NovelUtils.toast(`成功生成 ${targetChapters.length} 章内容`, 'success');
      })
      .catch(err => {
        NovelUtils.log('生成失败：' + err.message, 'error');
        NovelUtils.toast('生成失败：' + err.message, 'error');
      })
      .finally(() => {
        isGenerating = false;
        NovelUtils.setButtonsDisabled(false);
        NovelUtils.setProgress(0);
        setTimeout(() => {
          const bar = document.getElementById('progress-bar');
          if (bar) bar.style.display = 'none';
        }, 1500);
      });
  }

  /**
   * 使用智能多 Agent 协作生成章节
   * 工作流程：
   * 1. 先分析章节场景，自动识别应该出场的角色
   * 2. 在写作过程中，每当需要描写角色时，实时调用该角色的 Agent
   */
  function generateChapterWithSmartAgents(title, genre, initialPrompt, outline, chapter, previousContent, settings, allCharacters) {
    NovelUtils.log(`【智能多 Agent】开始生成第${chapter.chapter_number}章`, 'phase');
    
    const situation = buildSituationDescription(chapter, previousContent);
    
    // 步骤 1: 使用工具调用自动识别本章涉及的角色
    NovelUtils.log('正在分析章节场景，识别出场角色...', 'phase');
    
    return CharacterTools.analyzeSceneAndIdentifyCharacters(allCharacters, situation, chapter)
      .then(involvedChars => {
        if (!involvedChars || involvedChars.length === 0) {
          NovelUtils.log('未能识别出角色，使用普通模式生成', 'info');
          return generateChapterContent(title, genre, initialPrompt, outline, chapter, previousContent, settings);
        }
        
        NovelUtils.log(`识别出 ${involvedChars.length} 个角色：${involvedChars.map(c => c.name).join('、')}`, 'success');
        
        // 步骤 2: 使用识别出的角色进行智能协作写作
        return generateWithRealTimeAgents(
          title, genre, outline, chapter, previousContent, 
          settings, involvedChars
        );
      })
      .catch(err => {
        NovelUtils.log('角色识别失败，降级为普通模式：' + err.message, 'error');
        return generateChapterContent(title, genre, initialPrompt, outline, chapter, previousContent, settings);
      });
  }

  /**
   * 实时多 Agent 协作写作
   * 在写作过程中，每当需要描写角色时，实时调用该角色的 Agent
   * 
   * 循环写作机制：
   * 1. 持续生成内容并处理工具调用
   * 2. 直到检测到 complete_chapter 工具调用
   * 3. 或达到最大循环次数
   */
  function generateWithRealTimeAgents(title, genre, outline, chapter, previousContent, settings, characters) {
    NovelUtils.log('开始实时协作写作...', 'phase');
    
    // 构建系统提示词，包含工具调用能力
    const systemPrompt = `你是一位专业的网络小说作家，擅长多角色协作的叙事写作。
小说标题：${title}
类型：${genre}
世界观：${JSON.stringify(outline.world_building || {})}
主题：${outline.theme?.theme || ''}
基调：${outline.theme?.tone || ''}

你的任务是写出充满情感、生动有趣的正文。

重要写作指南：
1. 每次回复请写 300-500 字的连贯内容
2. 当你需要描写某个角色的动作、语言、心理活动时，请使用工具调用来获取该角色的真实反应
3. 可用工具：
   - get_character_action: 获取角色的动作和行为
   - get_character_dialogue: 获取角色的对话
   - get_character_emotion: 获取角色的情绪变化
   - complete_chapter: 当你认为本章已经完整时调用此工具结束章节

4. 情节推进要自然，不要急于结束
5. 充分运用角色 Agent 的反馈来丰富细节

字数要求：整章 800-1500 字`;

    const previousSummary = previousContent 
      ? `\n\n【前文摘要】\n${previousContent.slice(-500)}` 
      : '';

    // 构建角色列表供 AI 参考
    const characterList = characters.map(char => {
      const name = char.character_name || char.name;
      const personality = char.personality || char.initial_state || '性格未设定';
      return `- ${name}: ${personality}`;
    }).join('\n');

    const userPrompt = `【章节信息】
章节号：${chapter.chapter_number}
章节标题：${chapter.chapter_title}
章节描述：${chapter.one_sentence}
关键事件：${Array.isArray(chapter.key_events) ? chapter.key_events.join('; ') : ''}

【出场角色】
${characterList}

【故事进展】
${chapter.expanded_paragraph || chapter.one_sentence}
${previousSummary}

请开始写作这一章的正文内容。
要求：
1. 准确呈现每个角色的性格和行为
2. 场景描写生动，对话自然
3. 情节推进合理，有吸引力
4. 在描写角色时，使用工具调用获取真实的角色反应
5. 写满 300-500 字后，如果情节还未完整，继续写下一段
6. 当情节完整时，调用 complete_chapter 工具结束本章`;

    // 获取角色工具定义
    const tools = CharacterTools.getCharacterTools();

    NovelUtils.log('开始循环写作...', 'phase');

    // 循环写作控制 - 从设置中读取最大循环次数
    const MAX_LOOPS = settings.maxLoops || 100; // 默认 100 次
    let currentLoop = 0;
    let chapterContent = '';
    let isChapterComplete = false;
    let conversationHistory = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    // 递归循环写作函数
    function writeLoop() {
      if (currentLoop >= MAX_LOOPS) {
        NovelUtils.log('已达到最大循环次数，强制结束章节', 'info');
        isChapterComplete = true;
        return Promise.resolve(formatChapterText(chapter, chapterContent));
      }

      if (isChapterComplete) {
        NovelUtils.log('章节已完成', 'success');
        return Promise.resolve(formatChapterText(chapter, chapterContent));
      }

      currentLoop++;
      NovelUtils.log(`开始第 ${currentLoop} 轮写作...`, 'phase');

      return NovelAPI.call(
        conversationHistory,
        tools,
        settings.model,
        settings.apiKey,
        settings.baseUrl,
        settings.provider,
        0.8,
        2000,
        { type: 'text' }
      ).then(response => {
        const message = response.choices[0].message;
        const assistantContent = message.content || '';
        
        // 关键修复：无论是否有工具调用，都要累积文本内容
        if (assistantContent.trim().length > 0) {
          chapterContent += (chapterContent ? '\n\n' : '') + assistantContent.trim();
          const wordCount = Math.round(chapterContent.length / 3);
          NovelUtils.log(`已累积 ${wordCount} 字`, 'info');
          
          // 实时显示进度到输出框
          updateGenerationProgress(currentLoop, MAX_LOOPS, wordCount, assistantContent);
        }
        
        // 添加到对话历史
        conversationHistory.push({
          role: 'assistant',
          content: assistantContent
        });

        // 检查是否有工具调用
        if (message.tool_calls && message.tool_calls.length > 0) {
          NovelUtils.log(`检测到 ${message.tool_calls.length} 次工具调用`, 'tool');
          
          // 处理工具调用并等待结果
          return handleWritingToolCalls(message, characters, settings)
            .then(toolResults => {
              // toolResults 现在是数组了
              NovelUtils.log(`收到 ${toolResults.length} 个工具调用结果`, 'info');
              
              // 检查是否有 complete_chapter 调用
              const completeCall = toolResults.find(result => result.type === 'complete_chapter');
              
              if (completeCall) {
                NovelUtils.log('检测到章节完成信号', 'success');
                const args = completeCall.args || {};
                NovelUtils.log(`章节摘要：${args.chapter_summary || '无'}`, 'info');
                isChapterComplete = true;
                
                // 返回已积累的内容
                return formatChapterText(chapter, chapterContent);
              }
              
              // 将工具结果反馈给 AI
              toolResults.forEach(result => {
                if (result.result) {
                  NovelUtils.log(`工具结果已添加：${result.name} → ${result.character}`, 'info');
                } else if (result.error) {
                  NovelUtils.log(`工具调用错误：${result.name} - ${result.error}`, 'error');
                }
              });
              
              // 构建包含工具结果的下一条用户消息
              const toolResultMessage = buildToolResultUserMessage(toolResults);
              conversationHistory.push({
                role: 'user',
                content: toolResultMessage
              });
              
              NovelUtils.log(`第 ${currentLoop} 轮工具调用处理完成`, 'success');
              
              // 继续下一轮写作
              return writeLoop();
            })
            .catch(err => {
              NovelUtils.log(`工具调用处理异常：${err.message}`, 'error');
              // 即使出错也继续
              return writeLoop();
            });
        } else {
          // 没有工具调用，直接检查是否继续
          NovelUtils.log(`第 ${currentLoop} 轮无工具调用，继续写作`, 'info');
          
          // 检查内容是否足够长
          if (chapterContent.length >= 3000) { // 约 1500 字
            NovelUtils.log('内容长度已足够，结束章节', 'success');
            isChapterComplete = true;
            return formatChapterText(chapter, chapterContent);
          }
          
          // 继续下一轮
          return writeLoop();
        }
      });
    }

    // 开始循环写作
    return writeLoop();
  }

  /**
   * 处理写作过程中的工具调用
   * @param {Object} message - LLM 返回的消息对象
   * @param {Array} characters - 角色列表
   * @param {Object} settings - API 设置
   * @returns {Promise<Array>} 工具调用结果数组
   */
  function handleWritingToolCalls(message, characters, settings) {
    const toolCalls = message.tool_calls;
    
    NovelUtils.log(`处理 ${toolCalls.length} 个工具调用...`, 'phase');
    
    // 依次处理每个工具调用
    const processCalls = toolCalls.map(toolCall => {
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments || '{}');
      
      NovelUtils.log(`工具调用：${functionName} (ID: ${toolCall.id})`, 'tool');
      
      // 根据工具类型执行对应的处理
      switch (functionName) {
        case 'get_character_action':
        case 'get_character_dialogue':
        case 'get_character_emotion':
          // 找到对应的角色
          const charName = functionArgs.character_name;
          const character = characters.find(c => 
            (c.character_name || c.name) === charName
          );
          
          if (character) {
            // 实时调用角色 Agent
            return CharacterTools.querySingleCharacterTool(character, functionName, functionArgs)
              .then(result => ({
                toolCallId: toolCall.id,  // 必须保留 tool_call_id
                name: functionName,
                result: result,
                character: charName
              }))
              .catch(err => {
                NovelUtils.log(`角色 ${charName} 查询失败：${err.message}`, 'error');
                return {
                  toolCallId: toolCall.id,
                  name: functionName,
                  error: err.message,
                  character: charName
                };
              });
          } else {
            NovelUtils.log(`未找到角色：${charName}`, 'error');
            return Promise.resolve({
              toolCallId: toolCall.id,
              name: functionName,
              error: '角色不存在',
              character: charName
            });
          }
          
        case 'complete_chapter':
          // 章节完成信号
          NovelUtils.log('检测到章节完成信号', 'success');
          return Promise.resolve({
            toolCallId: toolCall.id,
            type: 'complete_chapter',
            name: functionName,
            args: functionArgs
          });
          
        default:
          return Promise.resolve({
            toolCallId: toolCall.id,
            name: functionName,
            error: '未知工具'
          });
      }
    });
    
    // 等待所有工具调用完成
    return Promise.all(processCalls)
      .then(results => {
        NovelUtils.log(`工具调用处理完成，共 ${results.length} 个结果`, 'success');
        return results; // 返回结果数组
      })
      .catch(err => {
        NovelUtils.log(`工具调用处理失败：${err.message}`, 'error');
        return []; // 返回空数组避免崩溃
      });
  }

  /**
   * 实时显示生成进度到输出框
   */
  function updateGenerationProgress(currentLoop, maxLoops, wordCount, newContent) {
    const outputBox = document.getElementById('output-box');
    if (!outputBox) return;

    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const progressInfo = `[${timestamp}] 第${currentLoop}/${maxLoops}轮 | 已生成 ${wordCount} 字`;
    
    // 截取最新内容的预览（最多 200 字）
    const contentPreview = newContent.length > 600 
      ? newContent.slice(0, 600) + '\n...' 
      : newContent;
    
    // 构建进度信息
    const progressText = `${progressInfo}\n新生成内容:\n${contentPreview}\n${'━'.repeat(60)}\n`;
    
    // 追加到输出框（保留之前的内容）
    const existingContent = outputBox.textContent || '';
    outputBox.textContent = existingContent + progressText + '\n';
    
    // 滚动到底部
    outputBox.scrollTop = outputBox.scrollHeight;
  }

  /**
   * 格式化为章节文本
   */
  function formatChapterText(chapter, content) {
    return `第${chapter.chapter_number}章 ${chapter.chapter_title}\n\n${content}`;
  }

  /**
   * 构建包含工具调用结果的用户消息
   * @param {Array} toolResults - 工具调用结果数组
   * @returns {String} 用户消息内容
   */
  function buildToolResultUserMessage(toolResults) {
    let message = '【工具调用结果】\n\n';
    
    toolResults.forEach((result, index) => {
      if (result.error) {
        message += `${index + 1}. ${result.name}(${result.character || '未知'}): 调用失败 - ${result.error}\n`;
      } else if (result.result) {
        const charName = result.character || '角色';
        const toolName = result.name;
        
        // 根据工具类型格式化结果
        if (toolName === 'get_character_action') {
          message += `${index + 1}. ${charName}的动作：${result.result.action || result.result.content || '无具体动作'}\n`;
        } else if (toolName === 'get_character_dialogue') {
          message += `${index + 1}. ${charName}的对话：${result.result.dialogue || result.result.content || '无对话内容'}\n`;
        } else if (toolName === 'get_character_emotion') {
          message += `${index + 1}. ${charName}的情绪：${result.result.emotion || result.result.content || '无情绪描述'}\n`;
        } else {
          message += `${index + 1}. ${charName}的${toolName.replace('get_character_', '')}: ${JSON.stringify(result.result)}\n`;
        }
      }
    });
    
    message += '\n请根据以上角色反馈，继续写作本章内容（300-500 字）。';
    
    return message;
  }

  /**
   * 构建情景描述
   */
  function buildSituationDescription(chapter, previousContent) {
    const previousSummary = previousContent 
      ? `\n【前文摘要】${previousContent.slice(-500)}` 
      : '';
    
    const keyEvents = Array.isArray(chapter.key_events) 
      ? chapter.key_events.join('; ') 
      : (chapter.expanded_paragraph || chapter.one_sentence);
    
    return `【章节信息】
章节号：${chapter.chapter_number}
章节标题：${chapter.chapter_title}
章节描述：${chapter.one_sentence}

【关键事件】
${keyEvents}

【故事进展】
${chapter.expanded_paragraph || chapter.one_sentence}
${previousSummary}`;
  }

  /**
   * 综合所有角色的反馈生成章节内容（旧方法，保留用于兼容性）
   */
  function synthesizeChapterContent(title, genre, outline, chapter, previousContent, agentResults, settings, characters) {
    NovelUtils.log('开始综合角色反馈生成正文...', 'phase');
    
    // 构建综合的系统提示词
    const systemPrompt = `你是一位专业的网络小说作家，擅长多角色协作的叙事写作。
小说标题：${title}
类型：${genre}
世界观：${JSON.stringify(outline.world_building || {})}
主题：${outline.theme?.theme || ''}
基调：${outline.theme?.tone || ''}

你的任务是：
1. 根据多个角色 Agent 的反馈，综合写出充满情感、生动有趣的正文
2. 准确呈现每个角色的性格特点和行为方式
3. 保持故事的连贯性和吸引力
4. 字数要求：800-1500 字`;

    // 构建用户提示词，包含所有角色的反馈
    const characterFeedback = buildCharacterFeedback(agentResults);
    
    const userPrompt = `【章节信息】
章节号：${chapter.chapter_number}
章节标题：${chapter.chapter_title}
章节描述：${chapter.one_sentence}
关键事件：${Array.isArray(chapter.key_events) ? chapter.key_events.join('；') : ''}

【角色反馈】
${characterFeedback}

【前文摘要】
${previousContent ? previousContent.slice(-500) : '无前文'}

请根据以上角色 Agent 的反馈，写出这一章的正文内容（800-1500 字）。
要求：
1. 准确呈现每个角色的性格和行为
2. 场景描写生动，对话自然
3. 情节推进合理，有吸引力`;

    return NovelAPI.call(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      null,
      settings.model,
      settings.apiKey,
      settings.baseUrl,
      settings.provider,
      0.8,
      2000,
      { type: 'text' }
    ).then(r => {
      const content = r.choices[0].message.content || '';
      
      // 格式化为章节格式
      const chapterText = `第${chapter.chapter_number}章 ${chapter.chapter_title}\n\n${content}`;
      NovelUtils.log('正文生成完成', 'success');
      return chapterText;
    });
  }

  /**
   * 构建角色反馈文本（旧方法，保留用于兼容性）
   */
  function buildCharacterFeedback(agentResults) {
    const feedbackParts = [];
    
    agentResults.forEach(result => {
      if (result.type === 'error') {
        feedbackParts.push(`【${result.character}】查询失败：${result.error}`);
        return;
      }
      
      const charName = result.character;
      
      if (result.type === 'direct_response') {
        // 直接回复的情况
        feedbackParts.push(`【${charName}】
${result.content}`);
      } else if (result.type === 'tool_results') {
        // 工具调用的情况
        const toolTexts = result.results.map(toolResult => {
          const toolName = toolResult.tool;
          let content = '';
          
          if (toolName === 'get_character_action') {
            content = `动作：${toolResult.action}\n原因：${toolResult.reasoning}`;
          } else if (toolName === 'get_character_dialogue') {
            content = `对话：${toolResult.dialogue}\n语气：${toolResult.tone}`;
          } else if (toolName === 'get_character_emotion') {
            content = `情绪：${toolResult.emotion}\n强度：${toolResult.intensity}\n触发：${toolResult.trigger}`;
          } else if (toolName === 'get_character_background') {
            content = `背景：${toolResult.background}`;
          }
          
          return content;
        });
        
        feedbackParts.push(`【${charName}】
${toolTexts.join('\n')}`);
      }
    });
    
    return feedbackParts.join('\n\n');
  }

  /**
   * 生成单个章节的内容（原有方法，用于向后兼容）
   */
  function generateChapterContent(title, genre, initialPrompt, outline, chapter, previousContent, settings) {
    const systemPrompt = `你是一位专业的网络小说作家。
小说标题：${title}
类型：${genre}
世界观：${JSON.stringify(outline.world_building || {})}
主题：${outline.theme?.theme || ''}
基调：${outline.theme?.tone || ''}

请根据章节大纲和前文内容，写出充满情感、生动有趣、符合网络文学风格的正文内容。
字数要求：800-1500 字`;

    const previousSummary = previousContent 
      ? `\n\n【前文摘要】\n${previousContent.slice(-500)}` 
      : '';

    const userPrompt = `【章节信息】
章节号：${chapter.chapter_number}
章节标题：${chapter.chapter_title}
章节描述：${chapter.one_sentence}
关键事件：${Array.isArray(chapter.key_events) ? chapter.key_events.join('；') : ''}
涉及角色：${Array.isArray(chapter.characters_involved) ? chapter.characters_involved.join('；') : ''}

【故事进展】
${chapter.expanded_paragraph || chapter.one_sentence}
${previousSummary}

请写出这一章的正文内容（800-1500 字）。`;

    return NovelAPI.call(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      null,
      settings.model,
      settings.apiKey,
      settings.baseUrl,
      settings.provider,
      0.8,  // 略高的温度以增加创意
      2000, // maxTokens，小说内容通常较长
      { type: 'text' }
    ).then(r => {
      const content = r.choices[0].message.content || '';
      
      // 格式化为章节格式
      const chapterText = `第${chapter.chapter_number}章 ${chapter.chapter_title}\n\n${content}`;
      return chapterText;
    });
  }

  return {
    generateRound,
    generateChapterContent,
    generateChapterWithAgents: generateChapterWithSmartAgents, // 别名
    generateWithRealTimeAgents,
    setMultiAgentMode
  };
})();

// 全局函数供 HTML onclick 使用
function generateRound() {
  const btn = event?.target;
  const rounds = btn?.id === 'btn-round2' ? 3 : 1;
  NovelWriter.generateRound(rounds);
}
