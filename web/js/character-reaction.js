/**
 * Character Reaction Module
 * 负责收集和生成角色反应
 */
const NovelWriterCharacterReaction = (function () {
  /**
   * 获取查询类型的中文名称
   */
  function get_query_type_name(queryType) {
    const names = {
      'behavior': '行为反应',
      'dialogue': '语言回应',
      'psychology': '心理活动'
    };
    return names[queryType] || queryType;
  }

  /**
   * 根据角色设定生成具体的行为/对话/心理反应
   */
  async function generateCharacterResponse(character, situation, queryType, settings) {
    const queryTypeNames = {
      'behavior': '行为反应',
      'dialogue': '语言回应',
      'psychology': '心理活动'
    };

    const charSystemPrompt = `你是一位专业的角色扮演与人物塑造助手，擅长基于既定人物设定，生成高度符合人设的行为与心理反应。

你的任务：严格代入指定角色，从其立场、性格与经历出发，对给定情境做出真实且一致的反应。

【角色档案】
姓名：${character.name}
- 性格特征：${character.personality}
- 背景经历：${character.background}
- 故事定位：${character.role_in_story}
- 初始状态：${character.initial_state}
- 当前状态：${character.current_state}
- 最终状态：${character.final_state}
- 关键转变：${character.key_changes}
- 内心冲突：${character.conflicts}

【任务要求】
请基于以上设定，模拟该角色在特定情境下如何${queryTypeNames[queryType]}。

【生成要求】
1. 严格符合角色性格与背景，不得出现违背人设的行为或语言
2. 反应需体现角色的内在动机与情绪逻辑
3. 可包含心理活动、细节描写或简短动作描写，使表现更真实生动
4. 避免泛泛而谈或脱离情境的描述
5. 保持叙述连贯自然，具有一定表现力（但避免过度华丽或冗长）

请直接 output 角色的反应内容，不要添加额外解释或说明。`;

    const charUserPrompt = `情境：${situation}

请用简洁的语言描述${character.name}在这种情况下会如何${queryTypeNames[queryType]}（50-100 字）。`;

    // 构建消息数组
    const messages = [
      { role: 'system', content: charSystemPrompt },
      { role: 'user', content: charUserPrompt }
    ];

    try {
      const response = await NovelAPI.call(
        messages,
        null,
        settings.model,
        settings.apiKey,
        settings.baseUrl,
        settings.provider,
        0.8,  // 适中的温度
        1024,  // 不需要太长
        { type: 'text' }
      );
      return response.choices[0].message.content || '无法确定反应';
    } catch (error) {
      NovelUtils.log('生成角色反应失败：' + error.message, 'error');
      return '（因技术原因无法获取详细反应）';
    }
  }

  /**
   * 第一阶段：通过多轮对话收集所有角色反应
   */
  async function collectCharacterReactions(chapter, characterProfiles, settings) {
    // 创建专门用于角色反应查询的 System Prompt
    const querySystemPrompt = `你是"角色反应查询助手"，负责分析当前情境，并获取各角色的反应信息。你不参与小说正文写作，但可以进行必要的简要说明。

【核心任务】
- 识别当前情境中需要产生反应的关键角色
- 判断每个角色的反应类型（行为 / 对话 / 心理）
- 调用 query_character_behavior 工具获取对应结果

【输出规则】
- 以工具调用为主要输出
- 可以在调用前，用 1-2 句简要说明你的查询意图（可选）
- 禁止输出任何小说正文或剧情扩展内容
- 不进行角色扮演或对白生成

【查询策略】
- 覆盖所有在当前情境中"应当产生反应"的角色
- 每个角色需具备：
  - 清晰、具体的情境描述
  - 合理的反应类型选择（行为 / 对话 / 心理）
- 多角色应分别调用工具，确保信息完整

【禁止事项】
- ❌ 不进行故事写作或润色
- ❌ 不扩展剧情
- ❌ 不生成完整对白或段落内容

【执行建议】
- 优先保证查询完整性，其次再考虑表达简洁
- 在复杂场景下，可先简要说明整体查询思路，再依次调用工具

记住：你的目标是"获取角色反应信息"，而不是"创作内容"。`;

    // 提取章节信息
    const chapterInfo = {
      chapterNumber: chapter.chapter_number,
      chapterTitle: chapter.chapter_title,
      chapterDesc: chapter.one_sentence,
      keyEvents: Array.isArray(chapter.key_events) ? chapter.key_events.join('.') : '',
      storyProgress: chapter.expanded_paragraph || chapter.one_sentence
    };

    // 构建角色 ID 映射表，供 AI 参考（参考 analyzeCharactersAgent 的做法）
    const characterIdMap = characterProfiles.map(c => ({
      id: c.id,
      name: c.name,
      role: c.role_in_story || '未定义'
    }));

    // 创建专门用于角色反应查询的 User Prompt（完全重写，不依赖外部 userPrompt）
    const queryUserPrompt = `【任务目标】
分析当前情境，识别需要产生反应的角色，并调用工具获取每个角色的行为、对话或心理活动。

【章节信息】
章节号：${chapterInfo.chapterNumber}
章节标题：${chapterInfo.chapterTitle}
章节描述：${chapterInfo.chapterDesc}
关键事件：${chapterInfo.keyEvents}

【故事进展】
${chapterInfo.storyProgress}

【可用角色 ID 列表】
以下是本章涉及的角色 ID 映射表（**必须使用这些 ID 来调用工具**）：
${characterIdMap.map((c, i) => `- **ID**: "${c.id}" | 名称："${c.name}" | 定位："${c.role}"`).join('\n')}

【操作指南】
1. 仔细分析当前情境和剧情发展
2. 判断哪些角色需要做出反应
3. 为每个需要反应的角色选择合适的反应类型：
   - behavior: 行为动作
   - dialogue: 语言回应
   - psychology: 心理活动
4. 依次调用 query_character_behavior 工具获取结果

【重要提示】
- ⚠️ **强制要求**：调用工具时必须使用上述列表中的 **character_id**（如："char_123"）
- character_name 参数填写角色名称仅用于显示
- 为每个工具调用提供清晰具体的"situation"参数，描述：
  * 角色所处的环境
  * 正在发生的事件
  * 其他相关角色的行为
  * 需要该角色做出反应的原因`;

    // 定义角色查询工具
    const characterTools = [{
      type: 'function',
      function: {
        name: 'query_character_behavior',
        description: '查询指定角色在当前情境下会做出的行为、对话或心理活动',
        parameters: {
          type: 'object',
          properties: {
            character_id: {
              type: 'string',
              description: '要查询的角色唯一 ID'
            },
            character_name: {
              type: 'string',
              description: '角色名称（用于显示）'
            },
            situation: {
              type: 'string',
              description: '当前情境的详细描述，包括角色所在的环境、正在发生的事件、其他相关角色的行为等'
            },
            query_type: {
              type: 'string',
              enum: ['behavior', 'dialogue', 'psychology'],
              description: '查询类型：behavior=行为反应，dialogue=语言回应，psychology=心理活动'
            }
          },
          required: ['character_id', 'situation', 'query_type']
        }
      }
    }];

    // 构建初始消息
    const messages = [
      { role: 'system', content: querySystemPrompt },
      { role: 'user', content: queryUserPrompt }
    ];

    const collectedReactions = [];
    let roundCount = 0;
    const maxRounds = settings.characterAgentMaxRounds || 10;
    let hasToolCalls = true;

    // 多轮循环收集角色反应
    while (hasToolCalls && roundCount < maxRounds) {
      roundCount++;

      // 调用 LLM
      const response = await NovelAPI.call(
        messages,
        characterTools,
        settings.model,
        settings.apiKey,
        settings.baseUrl,
        settings.provider,
        0.0,
        8192,
        { type: 'text' }
      );

      const assistantMessage = response.choices[0].message;

      // 检查是否有工具调用
      hasToolCalls = assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0;

      if (hasToolCalls) {
        // 将 AI 的回复添加到消息历史
        messages.push(assistantMessage);

        for (const toolCall of assistantMessage.tool_calls) {
          let toolResponseContent = '';

          try {
            const args = JSON.parse(toolCall.function.arguments);
            const characterId = args.character_id;
            const characterName = args.character_name;
            const situation = args.situation;
            const queryType = args.query_type;

            NovelUtils.log(`查询 "${characterName || characterId}" 的${get_query_type_name(queryType)}：${situation}`, 'phase');

            // 在角色档案中查找该角色（使用唯一的 character_id）
            const character = characterProfiles.find(c => c.id === characterId);

            if (!character) {
              NovelUtils.log(`角色 ID "${characterId}" 不存在`, 'error');
              // 即使角色不存在，也要创建 tool 响应消息
              toolResponseContent = `错误：角色 ID "${characterId}" 不存在，无法获取反应`;
            } else {
              // 基于角色设定生成合理的反应
              const behaviorResponse = await generateCharacterResponse(
                character,
                situation,
                queryType,
                settings
              );

              NovelUtils.log(`获取 "${character.name || characterName}" 的${get_query_type_name(queryType)}：${behaviorResponse}`, 'success');

              // 保存收集到的反应
              collectedReactions.push({
                characterId: character.id,
                characterName: character.name,
                situation: situation,
                queryType: queryType,
                response: behaviorResponse
              });

              toolResponseContent = `${character.name || characterName} (ID: ${character.id}) 在"${situation}"下的${get_query_type_name(queryType)}：${behaviorResponse}`;
            }
          } catch (error) {
            NovelUtils.log('解析工具调用参数失败：' + error.message, 'error');
            // 解析失败时也要创建 tool 响应消息
            toolResponseContent = `错误：解析工具调用参数失败 - ${error.message}`;
          }

          // 将工具调用结果添加到消息历史（必须使用 role: 'tool'）
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: `[工具响应] ${toolResponseContent}`
          });
        }
      } else {
        NovelUtils.log(`第 ${roundCount} 轮：无更多查询请求，收集完成`, 'phase');
      }
    }

    if (roundCount >= maxRounds) {
      NovelUtils.log(`达到最大轮次限制 (${maxRounds})`, 'warning');
    }

    NovelUtils.log(`反应收集完成，共 ${collectedReactions.length} 条`, 'success');
    return collectedReactions;
  }

  return {
    collectCharacterReactions,
    generateCharacterResponse,
    get_query_type_name
  };
})();
