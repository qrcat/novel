/**
 * Character Tools Module
 * 实现工具调用机制，让 NovelWriter 可以与角色 Agent 交互
 * 通过 API 的工具调用功能，获取角色在特定情景下的反应
 * 
 * 智能工作流：
 * 1. 分析场景自动识别应该出场的角色
 * 2. 在写作过程中实时调用角色 Agent 获取行为、语言描写
 */
const CharacterTools = (function() {
  
  /**
   * 定义角色相关的工具
   */
  function getCharacterTools() {
    return [
      {
        type: 'function',
        function: {
          name: 'get_character_action',
          description: '获取角色在特定情景下的动作和行为反应。当你需要描写某个角色的具体动作、行为表现时使用。',
          parameters: {
            type: 'object',
            properties: {
              character_name: {
                type: 'string',
                description: '角色名称，必须是已知的角色'
              },
              situation: {
                type: 'string',
                description: '当前情景描述，包括环境、事件等'
              },
              other_characters: {
                type: 'array',
                items: { type: 'string' },
                description: '在场的其他角色列表'
              },
              emotion: {
                type: 'string',
                description: '角色当前的情绪状态'
              }
            },
            required: ['character_name', 'situation']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_character_dialogue',
          description: '获取角色在特定情景下会说的话。当你需要为某个角色生成对话内容时使用。',
          parameters: {
            type: 'object',
            properties: {
              character_name: {
                type: 'string',
                description: '角色名称'
              },
              context: {
                type: 'string',
                description: '对话的上下文，包括前面发生了什么'
              },
              target: {
                type: 'string',
                description: '对话的目标对象（对谁说话）'
              },
              intent: {
                type: 'string',
                description: '对话的目的或意图（想要达到什么效果）'
              }
            },
            required: ['character_name', 'context']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_character_emotion',
          description: '获取角色在特定情景下的情绪变化和心理活动。当你需要描写角色的内心戏、情感波动时使用。',
          parameters: {
            type: 'object',
            properties: {
              character_name: {
                type: 'string',
                description: '角色名称'
              },
              trigger_event: {
                type: 'string',
                description: '引发情绪变化的事件'
              },
              previous_emotion: {
                type: 'string',
                description: '之前的情绪状态'
              }
            },
            required: ['character_name', 'trigger_event']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_character_background',
          description: '获取角色的背景故事和相关信息。当你需要了解角色的过往经历、性格特点等背景信息时使用。',
          parameters: {
            type: 'object',
            properties: {
              character_name: {
                type: 'string',
                description: '角色名称'
              },
              info_type: {
                type: 'string',
                description: '需要的信息类型：外貌、性格、经历、关系等',
                enum: ['appearance', 'personality', 'background', 'relationships', 'skills', 'all']
              }
            },
            required: ['character_name']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'complete_chapter',
          description: '表示当前章节已经完成。当你认为已经写了足够的内容，情节已经完整，可以结束这一章时调用此工具。',
          parameters: {
            type: 'object',
            properties: {
              chapter_summary: {
                type: 'string',
                description: '本章内容摘要（50-100 字）'
              },
              word_count: {
                type: 'number',
                description: '预估字数'
              },
              next_chapter_hint: {
                type: 'string',
                description: '为下一章埋下的伏笔或提示（可选）'
              }
            },
            required: ['chapter_summary']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'manage_character',
          description: '管理角色信息：创建新角色、修改现有角色设定或在写作过程中动态调整角色属性。当你需要在写作过程中新增角色、修改角色性格/状态/关系时使用此工具。',
          parameters: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                description: '操作类型：create(创建新角色) 或 update(修改现有角色)',
                enum: ['create', 'update']
              },
              character_name: {
                type: 'string',
                description: '角色名称'
              },
              character_info: {
                type: 'object',
                properties: {
                  personality: {
                    type: 'string',
                    description: '性格特点'
                  },
                  initial_state: {
                    type: 'string',
                    description: '初始状态或出场时的情况'
                  },
                  final_state: {
                    type: 'string',
                    description: '最终状态或角色弧光终点'
                  },
                  relationships: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '与其他角色的关系描述'
                  },
                  key_changes: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '关键变化点'
                  },
                  conflicts: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '内心或外部冲突'
                  },
                  background: {
                    type: 'string',
                    description: '背景故事'
                  },
                  appearance: {
                    type: 'string',
                    description: '外貌描述'
                  },
                  role_in_story: {
                    type: 'string',
                    description: '在故事中的作用（主角、配角、反派等）'
                  }
                },
                description: '角色的详细信息'
              },
              reason: {
                type: 'string',
                description: '为什么需要创建/修改这个角色（剧情需要说明）'
              }
            },
            required: ['action', 'character_name', 'character_info']
          }
        }
      }
    ];
  }

  /**
   * 分析场景并自动识别应该出场的角色
   * @param {Array} allCharacters - 所有可用角色列表
   * @param {String} situation - 情景描述
   * @param {Object} chapter - 章节信息
   * @returns {Promise<Array>} 识别出的角色列表
   */
  function analyzeSceneAndIdentifyCharacters(allCharacters, situation, chapter) {
    const settings = NovelNav.getActiveSettings();
    
    // 构建系统提示词
    const systemPrompt = `你是一位专业的文学编辑，擅长分析小说场景和角色关系。

你的任务是：根据提供的章节信息和情景描述，分析哪些角色应该在这个场景中出场。

判断标准：
1. 章节大纲中明确提到的角色
2. 情节发展中必然涉及的角色
3. 与当前事件有直接关联的角色
4. 考虑故事的连续性和角色关系的合理性

请只返回角色名称列表，不要包含其他内容。`;

    // 构建角色列表供 AI 参考
    const characterList = allCharacters.map(char => {
      const name = char.character_name || char.name;
      const personality = char.personality || char.initial_state || '性格未设定';
      return `- ${name}: ${personality}`;
    }).join('\n');

    const userPrompt = `【章节信息】
章节号：${chapter.chapter_number}
章节标题：${chapter.chapter_title}
章节描述：${chapter.one_sentence}
关键事件：${Array.isArray(chapter.key_events) ? chapter.key_events.join('; ') : ''}

【所有可用角色】
${characterList}

【情景描述】
${situation}

请分析以上场景，列出应该出场的角色名称（只返回角色名字，用逗号分隔）。`;

    NovelUtils.log('正在分析场景并识别角色...', 'phase');

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
      0.5,  // 较低温度以保证判断准确性
      500,  // 只需要返回角色名，不需要太多字
      { type: 'text' }
    ).then(response => {
      const content = response.choices[0].message.content || '';
      
      // 解析返回的角色名列表
      const identifiedNames = parseCharacterNames(content);
      
      NovelUtils.log(`识别出角色名：${identifiedNames.join('、')}`, 'info');
      
      // 匹配实际的角色对象
      const matchedCharacters = matchCharacters(allCharacters, identifiedNames);
      
      if (matchedCharacters.length === 0) {
        NovelUtils.log('未能匹配到任何角色，使用默认策略', 'info');
        // 默认策略：如果有章节指定角色则使用，否则使用前 3 个
        if (chapter.characters_involved && Array.isArray(chapter.characters_involved)) {
          return allCharacters.filter(char => 
            chapter.characters_involved.includes(char.character_name || char.name)
          );
        }
        return allCharacters.slice(0, 3);
      }
      
      NovelUtils.log(`成功匹配 ${matchedCharacters.length} 个角色`, 'success');
      return matchedCharacters;
    });
  }

  /**
   * 解析 AI 返回的角色名文本
   */
  function parseCharacterNames(text) {
    // 清理文本，提取角色名
    // 可能的格式："角色 A, 角色 B, 角色 C" 或 "角色 A、角色 B"
    let names = text
      .replace(/[,\,,]/g, ',')  // 统一分隔符
      .split(',')
      .map(name => name.trim())
      .filter(name => name.length > 0);
    
    // 去重
    names = [...new Set(names)];
    
    NovelUtils.log(`解析到的角色名：${names.join('、')}`, 'info');
    return names;
  }

  /**
   * 将识别出的角色名匹配到实际的角色对象
   */
  function matchCharacters(allCharacters, names) {
    const matched = [];
    
    names.forEach(name => {
      const character = allCharacters.find(char => {
        const charName = char.character_name || char.name;
        // 模糊匹配：包含关系或完全相等
        return charName === name || charName.includes(name) || name.includes(charName);
      });
      
      if (character) {
        matched.push(character);
      } else {
        NovelUtils.log(`警告：未找到角色 "${name}"`, 'info');
      }
    });
    
    return matched;
  }

  /**
   * 实时查询单个角色的工具调用结果
   * @param {Object} character - 角色对象
   * @param {String} toolName - 工具名称
   * @param {Object} args - 工具参数
   * @returns {Promise<Object>} 工具调用结果
   */
  function querySingleCharacterTool(character, toolName, args) {
    const settings = NovelNav.getActiveSettings();
    const charModel = character.model || settings.model;
    const charApiKey = character.apiKey || settings.apiKey;
    const charBaseUrl = character.baseUrl || settings.baseUrl;
    const charName = character.character_name || character.name;
    
    NovelUtils.log(`实时调用角色 ${charName} 的工具：${toolName}`, 'tool');
    
    // 构建针对该角色的系统提示词
    const systemPrompt = buildCharacterSystemPrompt(character);
    
    // 根据工具类型构建用户提示词
    const userPrompt = buildToolUserPrompt(character, toolName, args);
    
    // 只调用当前请求的工具
    const specificTool = getCharacterTools().find(tool => 
      tool.function.name === toolName
    );
    
    return NovelAPI.call(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      specificTool ? [specificTool] : [],
      charModel,
      charApiKey,
      charBaseUrl,
      null,
      0.7,  // 适中温度保证一致性
      800,  // 工具调用不需要太多 token
      { type: 'text' }
    ).then(response => {
      const message = response.choices[0].message;
      
      // 如果有工具调用，执行工具
      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0];
        const result = executeSpecificTool(character, toolCall, args);
        return {
          type: 'tool_result',
          tool: toolName,
          result: result,
          character: charName
        };
      } else {
        // 直接返回内容
        return {
          type: 'direct_response',
          content: message.content || '',
          character: charName,
          tool: toolName
        };
      }
    });
  }

  /**
   * 构建角色的系统提示词
   */
  function buildCharacterSystemPrompt(character) {
    const charName = character.character_name || character.name;
    const personality = character.personality || character.initial_state || '';
    
    return `你是${charName}的角色扮演助手。
性格特点：${personality}

你的任务是根据情景描述，准确模拟${charName}的反应，包括动作、语言、心理活动等。

要求：
- 严格符合角色性格设定
- 反应真实自然
- 有细节描写
- 考虑与其他角色的互动关系`;
  }

  /**
   * 根据工具类型构建用户提示词
   */
  function buildToolUserPrompt(character, toolName, args) {
    const charName = character.character_name || character.name;
    const situation = args.situation || args.context || args.trigger_event || '当前情景';
    
    switch (toolName) {
      case 'get_character_action':
        return `${charName}，在以下情景中你会做什么动作？有什么行为反应？

情景：${situation}
在场角色：${args.other_characters ? args.other_characters.join('、') : '无'}
当前情绪：${args.emotion || '未知'}

请详细描述你的动作和行为。`;

      case 'get_character_dialogue':
        return `${charName}，在以下情景中你会说什么话？

情景：${situation}
对话对象：${args.target || '对方'}
你的目的：${args.intent || '表达想法'}

请写出你会说的具体话语，包括语气和情感。`;

      case 'get_character_emotion':
        return `${charName}，在以下情景中你的情绪如何变化？

触发事件：${situation}
之前情绪：${args.previous_emotion || '平静'}

请描述你的情绪变化过程和内心感受。`;

      case 'get_character_background':
        return `${charName}，请提供你的背景信息。

信息类型：${args.info_type || '全部'}

请分享相关的经历、性格形成原因、重要的人际关系等。`;

      default:
        return `请描述你在以下情景中的反应：${situation}`;
    }
  }

  /**
   * 执行特定的工具函数
   */
  function executeSpecificTool(character, toolCall, originalArgs) {
    const functionName = toolCall.function.name;
    const functionArgs = JSON.parse(toolCall.function.arguments || '{}');
    
    switch (functionName) {
      case 'get_character_action':
        return {
          tool: 'get_character_action',
          action: generateActionDescription(character, functionArgs),
          reasoning: `基于${character.character_name || character.name}的性格特征`
        };
      
      case 'get_character_dialogue':
        return {
          tool: 'get_character_dialogue',
          dialogue: '[AI 生成的对话内容]',
          tone: '[语气描述]',
          context: functionArgs.context || originalArgs.context
        };
      
      case 'get_character_emotion':
        return {
          tool: 'get_character_emotion',
          emotion: '[情绪名称]',
          intensity: 'medium',
          change: '[情绪变化描述]',
          trigger: functionArgs.trigger_event || originalArgs.trigger_event
        };
      
      case 'get_character_background':
        return {
          tool: 'get_character_background',
          infoType: functionArgs.info_type || 'all',
          background: character.personality || character.initial_state || '暂无详细背景'
        };
      
      default:
        return {
          tool: functionName,
          error: '未知工具'
        };
    }
  }

  /**
   * 生成动作描述（简化版本）
   */
  function generateActionDescription(character, args) {
    const personality = character.personality || '';
    const situation = args.situation || '当前情景';
    
    // 这里可以根据性格关键词生成更具体的动作
    // 目前返回一个通用的动作描述框架
    return `[${character.character_name || character.name}] 做出了符合其性格的动作反应（具体情况：${situation}）`;
  }

  /**
   * 批量查询多个角色（旧方法，保留用于兼容性）
   * @param {Object} project - 项目对象
   * @param {Array} characters - 角色列表
   * @param {String} situation - 情景描述
   */
  function batchQueryCharacters(project, characters, situation) {
    NovelUtils.log(`批量查询 ${characters.length} 个角色`, 'phase');
    
    // 依次查询每个角色
    const queries = characters.map(char => {
      return queryCharacter(project, char, situation)
        .then(result => {
          NovelUtils.log(`角色 ${result.character} 查询完成`, 'success');
          return result;
        })
        .catch(err => {
          NovelUtils.log(`角色 ${char.character_name || char.name} 查询失败：${err.message}`, 'error');
          return {
            type: 'error',
            character: char.character_name || char.name,
            error: err.message
          };
        });
    });
    
    return Promise.all(queries);
  }

  /**
   * 查询单个角色（旧方法，保留用于兼容性）
   */
  function queryCharacter(project, character, situation, queryType = 'action', additionalParams = {}) {
    const settings = NovelNav.getActiveSettings();
    const charModel = character.model || settings.model;
    const charApiKey = character.apiKey || settings.apiKey;
    const charBaseUrl = character.baseUrl || settings.baseUrl;
    
    // 构建用户提示词
    const userPrompt = buildCharacterAnalysisPrompt(project, character, situation);
    
    // 构建系统提示词
    const charName = character.character_name || character.name;
    const systemPrompt = `你是${charName}的角色扮演助手。
性格特点：${character.personality || character.initial_state || '未设定'}
你的任务是根据情景描述，准确模拟${charName}的反应，包括动作、语言、心理活动等。`;

    // 获取工具定义
    const tools = getCharacterTools();
    
    NovelUtils.log(`调用角色 Agent：${charName} (${queryType})`, 'phase');
    
    // 发起 API 调用（使用工具调用方式）
    return NovelAPI.call(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      tools,
      charModel,
      charApiKey,
      charBaseUrl,
      null,
      0.7,  // 温度略低以保证角色一致性
      1500, // maxTokens
      { type: 'text' }
    ).then(response => {
      const message = response.choices[0].message;
      
      // 检查是否有工具调用
      if (message.tool_calls && message.tool_calls.length > 0) {
        NovelUtils.log(`角色 ${charName} 触发了工具调用`, 'info');
        return handleToolCalls(project, character, situation, message.tool_calls, additionalParams);
      } else {
        // 没有工具调用，直接返回内容
        NovelUtils.log(`角色 ${charName} 直接返回内容`, 'info');
        return {
          type: 'direct_response',
          content: message.content || '',
          character: charName
        };
      }
    });
  }

  /**
   * 处理工具调用（旧方法，保留用于兼容性）
   */
  function handleToolCalls(project, character, situation, toolCalls, additionalParams) {
    const results = [];
    const charName = character.character_name || character.name;
    
    toolCalls.forEach(toolCall => {
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments || '{}');
      
      NovelUtils.log(`工具调用：${functionName}`, 'info');
      
      // 执行对应的工具函数
      switch (functionName) {
        case 'get_character_action':
          results.push(executeActionTool(character, situation, functionArgs));
          break;
        case 'get_character_dialogue':
          results.push(executeDialogueTool(character, situation, functionArgs));
          break;
        case 'get_character_emotion':
          results.push(executeEmotionTool(character, situation, functionArgs));
          break;
        case 'get_character_background':
          results.push(executeBackgroundTool(character, functionArgs));
          break;
      }
    });
    
    return {
      type: 'tool_results',
      results: results,
      character: charName,
      rawCalls: toolCalls
    };
  }

  /**
   * 执行动作工具（旧方法，保留用于兼容性）
   */
  function executeActionTool(character, situation, args) {
    const charName = character.character_name || character.name;
    const personality = character.personality || '';
    
    // 基于角色性格生成动作描述
    return {
      tool: 'get_character_action',
      action: generateActionFromPersonality(personality, situation),
      reasoning: `基于${charName}的性格：${personality}`
    };
  }

  /**
   * 执行对话工具（旧方法，保留用于兼容性）
   */
  function executeDialogueTool(character, situation, args) {
    const charName = character.character_name || character.name;
    
    return {
      tool: 'get_character_dialogue',
      character: charName,
      dialogue: '[需要根据具体情景生成对话]',
      tone: '[待确定]',
      context: args.context || situation
    };
  }

  /**
   * 执行情绪工具（旧方法，保留用于兼容性）
   */
  function executeEmotionTool(character, situation, args) {
    const charName = character.character_name || character.name;
    
    return {
      tool: 'get_character_emotion',
      character: charName,
      emotion: '[需要分析情景后确定]',
      reasoning: `基于${charName}在情景中的反应`
    };
  }

  /**
   * 执行背景工具（旧方法，保留用于兼容性）
   */
  function executeBackgroundTool(character, args) {
    const charName = character.character_name || character.name;
    const infoType = args.info_type || 'all';
    
    return {
      tool: 'get_character_background',
      character: charName,
      infoType: infoType,
      background: character.personality || character.initial_state || '暂无详细背景'
    };
  }

  /**
   * 根据性格生成动作描述（简化版本，实际应该调用 AI）
   */
  function generateActionFromPersonality(personality, situation) {
    // 这里可以根据性格关键词生成更具体的动作
    // 目前返回一个通用的动作描述
    return '角色做出了符合其性格的动作反应';
  }

  /**
   * 构建角色分析的系统提示词（旧方法，保留用于兼容性）
   */
  function buildCharacterAnalysisPrompt(project, character, situation) {
    const charName = character.character_name || character.name;
    const personality = character.personality || character.initial_state || '';
    
    return `你是一位专业的文学创作助手，专门分析和模拟小说角色「${charName}」的行为和反应。

【角色设定】
- 姓名：${charName}
- 性格：${personality}
- 小说类型：${project.genre || ''}

【当前情景】
${situation}

请分析并输出：
1. 【动作行为】${charName}在此情景下会做什么动作？有什么行为反应？
2. 【语言表达】${charName}会说什么话？语气如何？
3. 【心理活动】${charName}内心在想什么？情绪如何变化？
4. 【表情神态】${charName}的面部表情和肢体语言是什么样的？

要求：
- 符合角色性格设定
- 生动具体，有细节描写
- 考虑与其他角色的互动关系
- 推动情节发展`;
  }

  /**
   * 处理角色管理工具调用
   * @param {Object} toolCall - 工具调用对象
   * @param {Object} project - 项目对象
   * @returns {Promise<Object>} 处理结果
   */
  async function handleManageCharacter(toolCall, project) {
    const functionName = toolCall.function.name;
    const functionArgs = JSON.parse(toolCall.function.arguments || '{}');
    
    NovelUtils.log(`检测到角色管理操作：${functionArgs.action} - ${functionArgs.character_name}`, 'tool');
    
    try {
      if (functionArgs.action === 'create') {
        // 创建新角色
        return await createNewCharacter(functionArgs, project);
      } else if (functionArgs.action === 'update') {
        // 更新现有角色
        return await updateExistingCharacter(functionArgs, project);
      } else {
        throw new Error(`未知的操作类型：${functionArgs.action}`);
      }
    } catch (err) {
      NovelUtils.log(`角色管理失败：${err.message}`, 'error');
      return {
        type: 'manage_character_error',
        error: err.message,
        action: functionArgs.action,
        character_name: functionArgs.character_name
      };
    }
  }

  /**
   * 创建新角色
   */
  async function createNewCharacter(args, project) {
    const newCharacter = {
      id: NovelUtils.uuid(),
      character_name: args.character_name,
      personality: args.character_info.personality || '',
      initial_state: args.character_info.initial_state || '',
      final_state: args.character_info.final_state || '',
      relationships: args.character_info.relationships || [],
      key_changes: args.character_info.key_changes || [],
      conflicts: args.character_info.conflicts || [],
      background: args.character_info.background || '',
      appearance: args.character_info.appearance || '',
      role_in_story: args.character_info.role_in_story || '配角',
      enabled: true,
      created_at: Date.now()
    };

    NovelUtils.log(`✨ 创建新角色：${newCharacter.character_name}`, 'success');

    // 添加到项目角色列表
    await addCharacterToProject(newCharacter, project);

    return {
      type: 'character_created',
      character: newCharacter,
      message: `成功创建角色「${newCharacter.character_name}」`,
      reason: args.reason || '剧情需要'
    };
  }

  /**
   * 更新现有角色
   */
  async function updateExistingCharacter(args, project) {
    // 查找现有角色
    const existingChar = findCharacterByName(args.character_name, project);
    
    if (!existingChar) {
      throw new Error(`未找到角色：${args.character_name}`);
    }

    // 更新角色信息
    const updatedCharacter = {
      ...existingChar,
      personality: args.character_info.personality || existingChar.personality,
      initial_state: args.character_info.initial_state || existingChar.initial_state,
      final_state: args.character_info.final_state || existingChar.final_state,
      relationships: args.character_info.relationships?.length 
        ? args.character_info.relationships 
        : existingChar.relationships,
      key_changes: args.character_info.key_changes?.length 
        ? args.character_info.key_changes 
        : existingChar.key_changes,
      conflicts: args.character_info.conflicts?.length 
        ? args.character_info.conflicts 
        : existingChar.conflicts,
      background: args.character_info.background || existingChar.background,
      appearance: args.character_info.appearance || existingChar.appearance,
      role_in_story: args.character_info.role_in_story || existingChar.role_in_story,
      updated_at: Date.now()
    };

    NovelUtils.log(`🔄 更新角色：${updatedCharacter.character_name}`, 'info');

    // 保存到项目
    await updateCharacterInProject(updatedCharacter, project);

    return {
      type: 'character_updated',
      character: updatedCharacter,
      message: `成功更新角色「${updatedCharacter.character_name}」`,
      reason: args.reason || '角色发展需要'
    };
  }

  /**
   * 将角色添加到项目
   */
  async function addCharacterToProject(character, project) {
    // 这里需要通过 UI 或存储模块来添加角色
    // 由于是异步操作，我们返回一个 Promise
    return new Promise((resolve) => {
      // 触发一个自定义事件，让 UI 层处理
      const event = new CustomEvent('novel-character-created', {
        detail: { character, project }
      });
      window.dispatchEvent(event);
      
      // 立即 resolve，让流程继续
      resolve(character);
    });
  }

  /**
   * 更新项目中的角色
   */
  async function updateCharacterInProject(character, project) {
    return new Promise((resolve) => {
      const event = new CustomEvent('novel-character-updated', {
        detail: { character, project }
      });
      window.dispatchEvent(event);
      
      resolve(character);
    });
  }

  /**
   * 根据名称查找角色
   */
  function findCharacterByName(name, project) {
    const allCharacters = NovelNav.getAllCharacters(project);
    return allCharacters.find(char => 
      (char.character_name === name) || (char.name === name)
    );
  }

  return {
    getCharacterTools,
    analyzeSceneAndIdentifyCharacters,
    querySingleCharacterTool,
    batchQueryCharacters,
    queryCharacter,
    buildCharacterAnalysisPrompt
  };
})();
