/**
 * Outline Modification Module
 * 负责基于生成的正文修改后续大纲
 */
const NovelWriterOutlineModification = (function () {
  /**
   * 从大纲中构建全文宏观信息概要
   * @param {Object} outline - 大纲对象
   * @param {Object} currentChapter - 当前章节对象
   * @returns {string} - 格式化的全局上下文文本
   */
  function buildGlobalContextFromOutline(outline, currentChapter) {
    const theme = outline.theme || {};
    const worldBuilding = outline.world_building || {};
    const chapters = outline.chapters || [];

    // 构建主题信息
    const themeText = (theme.theme || theme.tone)
      ? `【故事主题】
主题：${theme.theme || '未指定'}
基调：${theme.tone || '未指定'}
`
      : '';

    // 构建世界观信息
    const worldBuildingText = Object.keys(worldBuilding).length > 0
      ? `【世界观设定】
时代背景：${worldBuilding.time_period || '未指定'}
世界地点：${Array.isArray(worldBuilding.locations) ? worldBuilding.locations.join(',') : (worldBuilding.location || '未指定')}
氛围基调：${worldBuilding.tone || worldBuilding.atmosphere || '未指定'}
世界规则：${Array.isArray(worldBuilding.rules_of_world) ? worldBuilding.rules_of_world.join('.') : (worldBuilding.rules_of_world || '无特殊规则')}
其他设定：${worldBuilding.other_settings || '无'}
`
      : '';

    // 构建章节列表摘要（区分已生成和未生成）
    const currentChapterNum = currentChapter.chapter_number || 1;
    const chaptersSummary = chapters.length > 0
      ? `【章节结构（共${chapters.length}章，当前第${currentChapterNum}章）】
${chapters.map((ch, idx) => {
        const chapterNum = ch.chapter_number || (idx + 1);
        const status = chapterNum < currentChapterNum ? '✅已生成' : (chapterNum === currentChapterNum ? '📝当前章节' : '⏳待生成');
        const keyEvents = Array.isArray(ch.key_events) && ch.key_events.length > 0 ? ` [关键事件：${ch.key_events.join('、')}]` : '';
        const sceneSetting = ch.scene_setting ? ` [场景：${ch.scene_setting}]` : '';
        return `${status} 第${chapterNum}章「${ch.chapter_title || '无标题'}」：${ch.one_sentence || ''}${ch.expanded_paragraph || ''}${sceneSetting}${keyEvents}`;
      }).join('\n')}
`
      : '';

    // 组合全局上下文
    const globalContext = `${themeText}${worldBuildingText}${chaptersSummary}\n【全文信息概要】\n以上是小说的整体设定和故事结构。\n`;

    return globalContext.trim() || '\n【全文信息概要】\n暂无详细大纲信息。\n';
  }

  /**
   * 合并大纲更新（根据字段类型采用不同策略）
   * @param {Object} existingOutline - 现有大纲
   * @param {Object} updates - 更新内容
   * @returns {Object} 更新后的大纲
   */
  function mergeOutlineUpdates(existingOutline, updates) {
    const updatedOutline = { ...existingOutline };

    // ========== chapters 数组：按章节编号匹配并更新 ==========
    if (updates.chapters && Array.isArray(updates.chapters)) {
      const existingChapters = existingOutline.chapters || [];
      
      updates.chapters.forEach(updateItem => {
        const chapterIndex = existingChapters.findIndex(
          ch => ch.chapter_number === updateItem.chapter_number
        );

        if (chapterIndex !== -1) {
          // 找到对应章节，更新字段
          const existingChapter = existingChapters[chapterIndex];
          
          // one_sentence: 直接覆盖
          if (updateItem.one_sentence !== undefined) {
            existingChapter.one_sentence = updateItem.one_sentence;
          }
          
          // chapter_detail: 直接覆盖
          if (updateItem.chapter_detail !== undefined) {
            existingChapter.chapter_detail = updateItem.chapter_detail;
          }
          
          // chapter_title: 直接覆盖（如果提供了新标题）
          if (updateItem.chapter_title !== undefined) {
            existingChapter.chapter_title = updateItem.chapter_title;
          }
          
          // expanded_paragraph: 直接覆盖（详细剧情描述）
          if (updateItem.expanded_paragraph !== undefined) {
            existingChapter.expanded_paragraph = updateItem.expanded_paragraph;
          }
          
          // scene_setting: 直接覆盖（场景设定）
          if (updateItem.scene_setting !== undefined) {
            existingChapter.scene_setting = updateItem.scene_setting;
          }
          
          // key_events: 直接覆盖（关键事件数组）
          if (updateItem.key_events !== undefined && Array.isArray(updateItem.key_events)) {
            existingChapter.key_events = updateItem.key_events;
          }
          
          // characters_involved: 直接覆盖（涉及角色数组）
          if (updateItem.characters_involved !== undefined && Array.isArray(updateItem.characters_involved)) {
            existingChapter.characters_involved = updateItem.characters_involved;
          }
          
          // plot_progression: 直接覆盖（剧情推进说明）
          if (updateItem.plot_progression !== undefined) {
            existingChapter.plot_progression = updateItem.plot_progression;
          }
          
          NovelUtils.log(`📝 大纲第${updateItem.chapter_number}章已更新`, 'phase');
        } else {
          NovelUtils.log(`⚠️ 未找到章节 ${updateItem.chapter_number}，跳过更新`, 'warning');
        }
      });

      updatedOutline.chapters = existingChapters;
      NovelUtils.log(`✅ 大纲章节更新完成，共更新 ${updates.chapters.length} 章`, 'success');
    }

    // 添加更新时间戳
    updatedOutline.updated_at = Date.now();

    return updatedOutline;
  }

  /**
   * 构建大纲更新的 User Prompt
   * @param {string} novelContent - 生成的正文内容
   * @param {Object} outline - 完整大纲对象
   * @param {Object} currentChapter - 当前章节对象
   * @returns {string} - 格式化后的 prompt
   */
  function buildOutlineUpdatePrompt(novelContent, outline, currentChapter) {
    const globalContext = buildGlobalContextFromOutline(outline, currentChapter);

    // 提取当前章节之后的所有章节（显示所有字段）
    const currentChapterNum = currentChapter.chapter_number || 1;
    const futureChapters = (outline.chapters || [])
      .filter(ch => (ch.chapter_number || 0) > currentChapterNum)
      .map(ch => {
        const lines = [`第${ch.chapter_number}章「${ch.chapter_title || '无标题'}」`];
        
        // 添加一句话概括
        if (ch.one_sentence) {
          lines.push(`  概括：${ch.one_sentence}`);
        }
        
        // 添加详细剧情描述
        if (ch.chapter_detail) {
          lines.push(`  详情：${ch.chapter_detail}`);
        }
        
        // 添加详细扩写段落
        if (ch.expanded_paragraph) {
          lines.push(`  扩写：${ch.expanded_paragraph}`);
        }
        
        // 添加场景设定
        if (ch.scene_setting) {
          lines.push(`  场景：${ch.scene_setting}`);
        }
        
        // 添加关键事件
        if (Array.isArray(ch.key_events) && ch.key_events.length > 0) {
          lines.push(`  关键事件：${ch.key_events.join('、')}`);
        }
        
        // 添加涉及角色
        if (Array.isArray(ch.characters_involved) && ch.characters_involved.length > 0) {
          lines.push(`  角色：${ch.characters_involved.join('、')}`);
        }
        
        // 添加剧情推进说明
        if (ch.plot_progression) {
          lines.push(`  推进：${ch.plot_progression}`);
        }
        
        return lines.join('\n');
      });
    const futureChaptersText = futureChapters.length > 0
      ? `\n【后续章节大纲（需要调整的部分）】\n${futureChapters.join('\n')}\n`
      : '\n【后续章节大纲】\n无后续章节（当前为最后一章）\n';

    return `${globalContext}
${futureChaptersText}
【当前章节正文】
${novelContent}

【分析任务】
请对比"当前章节正文"与"后续章节大纲",判断是否需要调整:
1. **剧情连贯性**: 本章实际发展是否与后续大纲冲突？
2. **伏笔回收**: 本章是否埋下了新的伏笔，需要在后续章节中体现？
3. **角色发展**: 本章角色的选择是否导致后续剧情需要调整？
4. **节奏优化**: 根据本章的实际节奏，后续章节是否需要重新规划？
5. **新元素整合**: 本章是否引入了新的人物、设定或情节线？

【更新策略】
- 只处理"需要调整"的后续章节 (无变化则跳过)
- **最小更改原则**: 能不修改就不修改，只有在本章内容确实导致后续剧情发生实质性冲突或需要补充时才进行调整
- 所有调整必须基于本章具体描写，不做推测或脑补
- 调整应与既有设定保持一致，避免突兀或断裂
- 优先关注:
  - 剧情走向的重大变化
  - 新伏笔的回收安排
  - 角色弧线的调整
  - 节奏的重新分配

【字段规范 (必须严格理解)】
✅ **直接覆盖字段 **(全新描述):

1. **chapter_title** (章节标题):
   - 该章节的"标题"
   - 如果本章导致后续章节的标题需要调整，请提供**新的**标题
   - 可选字段，如无必要可不提供

2. **one_sentence** (一句话概括):
   - 该章节的"核心剧情一句话总结"
   - 如果本章导致后续章节的剧情发生变化，请提供**全新的、更新后的**一句话概括
   - 系统会用新内容**完全替换**旧内容
   - 建议长度：15-60 字

3. **chapter_detail** (详细剧情描述):
   - 该章节的"完整详细剧情规划"
   - 如果本章导致后续章节的详细规划发生变化，请提供**完整的、更新后的**详细描述
   - 系统会用新内容**完全替换**旧内容
   - 建议长度：100-400 字，包含场景转换、人物行为、冲突发展、情绪变化等

4. **expanded_paragraph** (详细扩写段落):
   - 该章节的"剧情扩写内容"（100-300 字）
   - 包含具体的场景描写、人物对话、行为动作、心理活动等
   - 用于快速生成正文时的参考
   - 如果本章导致后续章节的扩写内容需要调整，请提供**全新的**扩写段落

5. **scene_setting** (场景设定):
   - 该章节的"主要场景描述"
   - 包含时间、地点、环境氛围等
   - 建议长度：10-30 字
   - 示例："深夜，废弃医院的地下室，昏暗潮湿，弥漫着消毒水味"

6. **key_events** (关键事件列表):
   - 该章节发生的"2-4 个关键事件"
   - 数组格式，每个事件为简洁短语
   - 示例：["发现神秘信件", "遭遇伏击", "意外觉醒能力"]
   - 这些事件应该是推动剧情发展的关键点

7. **characters_involved** (涉及角色):
   - 该章节出场的"主要角色名单"
   - 数组格式，列出角色名称
   - 示例：["李明", "白鸦", "张华"]
   - 只列出有重要戏份的角色

8. **plot_progression** (剧情推进说明):
   - 该章节在整体剧情中的"推进作用"
   - 说明本章如何推动故事发展、揭示信息或制造转折
   - 建议长度：20-50 字
   - 示例："揭示测试的残酷本质，加剧参与者间的信任危机，为下一章系统失控埋下伏笔"

**工具调用规则**:
- 调用 update_outline 时必须提供 **chapter_number** (要调整的章节号)
- 其他字段根据需要选择性提供，但至少要提供一个更新字段
- 只提供确实需要修改的字段，保持不变的字段不要提供

**重要提示**:
- 调用 update_outline 时必须提供 **chapter_number** (要调整的章节号)
- 只允许修改"当前章节之后"的章节，严禁修改已生成的章节
- 如无前序章节需要调整，可不调用工具

【禁止事项】
- ❌ 不修改当前章节及之前章节的大纲
- ❌ 不改变故事的核心主题和世界观
- ❌ 不删除后续章节，只调整内容
- ❌ 不进行小说写作或润色
- ❌ 不编造未出现的信息
- ❌ 不输出普通文本代替工具调用

【执行建议】
- 每个需要调整的章节单独调用工具，保证结构清晰
- 如有多个章节需要调整，依次调用工具
- 优先保证信息准确性和连贯性

记住：你的职责是"分析并更新大纲"，而不是"创作故事"。`;
  }

  /**
   * 基于生成的正文修改后续大纲
   * @param {string} novelContent - 生成的正文内容
   * @param {Object} outline - 完整大纲对象
   * @param {Object} currentChapter - 当前章节对象
   * @param {Object} settings - API 设置
   */
  async function modifyOutlineFromNovel(novelContent, outline, currentChapter, settings) {
    const currentProject = NovelNav.getCurrentProject();
    if (!currentProject || !novelContent.trim()) {
      NovelUtils.log('没有项目或正文内容，跳过大纲更新', 'warning');
      return;
    }

    // 检查是否有后续章节
    const currentChapterNum = currentChapter.chapter_number || 1;
    const futureChapters = (outline.chapters || []).filter(ch => (ch.chapter_number || 0) > currentChapterNum);
    
    if (futureChapters.length === 0) {
      NovelUtils.log('没有后续章节需要更新，跳过大纲修改', 'phase');
      return;
    }

    NovelUtils.log(`当前章节号：${currentChapterNum}, 后续章节数：${futureChapters.length}`, 'phase');

    // 增强 System Prompt：明确指示只负责调用工具更新大纲
    const outlineUpdateSystemPrompt = `你是一位专业的小说编辑和剧情规划师。你的任务是基于"刚刚生成的章节内容"，分析后续剧情是否需要调整，并通过工具调用更新大纲。

【剧情规划师指南】

【核心原则】
- **最小更改原则**: 能不修改就不修改，只有在本章内容确实导致后续剧情发生实质性冲突或需要补充时才进行调整
- 保持大纲的稳定性和连贯性，避免过度调整或频繁修改

【核心任务】
- 识别本章对后续剧情的影响
- 判断哪些后续章节需要调整
- 使用工具对大纲进行更新

【输出规则】
- 以工具调用为唯一核心输出
- 可以在调用前进行极简说明（1 句以内，可选）
- 不输出 JSON 文本本身（必须通过工具传递）
- 不进行任何小说正文写作或剧情扩展

【工具选择】
- 需要调整后续章节 → 调用 update_outline（必须提供章节号）
- 无需调整 → 不调用工具

【更新策略】
- 只处理"需要调整"的后续章节 (无变化则跳过)
- **最小更改原则**: 能不修改就不修改，只有在本章内容确实导致后续剧情发生实质性冲突或需要补充时才进行调整
- 所有调整必须基于本章具体描写，不做推测或脑补
- 调整应与既有设定保持一致，避免突兀或断裂
- 优先关注:
  - 剧情走向的重大变化
  - 新伏笔的回收安排
  - 角色弧线的调整
  - 节奏的重新分配

记住：你的职责是"分析并更新大纲"，而不是"创作故事"。`;

    // 定义大纲管理工具
    const outlineManagementTools = [
      {
        type: 'function',
        function: {
          name: 'update_outline',
          description: '基于当前章节内容更新后续章节的大纲。当发现后续章节的剧情、节奏、设定或角色发展需要调整时使用此工具。可以更新标题、概括、详细描述、场景设定、关键事件、涉及角色、剧情推进等所有字段。',
          parameters: {
            type: 'object',
            properties: {
              chapter_number: {
                type: 'number',
                description: '要更新的章节号（必须是当前章节之后的章节，例如：1, 2, 3...）'
              },
              chapter_title: {
                type: 'string',
                description: '新的章节标题（如："真相揭露"、"最后的抉择"）'
              },
              one_sentence: {
                type: 'string',
                description: '新的一句话概括（15-60 字，包含核心剧情）'
              },
              chapter_detail: {
                type: 'string',
                description: '新的详细剧情描述（100-400 字，包含完整的场景转换、人物行为、冲突发展）'
              },
              expanded_paragraph: {
                type: 'string',
                description: '新的详细扩写段落（100-300 字，包含具体描写、对话、心理活动）'
              },
              scene_setting: {
                type: 'string',
                description: '新的场景设定（10-30 字，包含时间、地点、环境氛围）'
              },
              key_events: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: '新的关键事件列表（2-4 个简洁短语，例如：["发现神秘信件", "遭遇伏击", "意外觉醒能力"]）'
              },
              characters_involved: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: '新的涉及角色名单（列出主要出场角色名称）'
              },
              plot_progression: {
                type: 'string',
                description: '新的剧情推进说明（20-50 字，说明本章在整体剧情中的作用和意义）'
              }
            },
            required: ['chapter_number']
          }
        }
      }
    ];

    // 构建初始消息
    const messages = [
      { role: 'system', content: outlineUpdateSystemPrompt },
      { role: 'user', content: buildOutlineUpdatePrompt(novelContent, outline, currentChapter) }
    ];

    let roundCount = 0;
    const maxRounds = settings.characterAgentMaxRounds || 10;
    let hasToolCalls = true;
    const updatedChapters = [];

    // 多轮循环处理大纲更新
    while (hasToolCalls && roundCount < maxRounds) {
      roundCount++;
      NovelUtils.log(`=== 第 ${roundCount} 轮大纲分析 ===`, 'phase');

      // 调用 LLM
      const response = await NovelAPI.call(
        messages,
        outlineManagementTools,
        settings.model,
        settings.apiKey,
        settings.baseUrl,
        settings.provider,
        0.7,
        8192,
        { type: 'text' }
      );

      const assistantMessage = response.choices[0].message;

      // 检查是否有工具调用
      hasToolCalls = assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0;

      if (hasToolCalls) {
        NovelUtils.log(`检测到 ${assistantMessage.tool_calls.length} 个大纲调整请求`, 'phase');

        // 将 AI 的回复添加到消息历史
        messages.push(assistantMessage);

        // 处理每个工具调用
        for (const toolCall of assistantMessage.tool_calls) {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            const chapterNumber = args.chapter_number;

            if (!chapterNumber) {
              NovelUtils.log('⚠️ 更新操作缺少章节号', 'warning');
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: `错误：更新操作缺少必需的 chapter_number 参数`
              });
              continue;
            }

            // 验证章节号是否合法（必须大于当前章节号）
            if (chapterNumber <= currentChapterNum) {
              NovelUtils.log(`⚠️ 拒绝修改第${chapterNumber}章（不允许修改已生成的章节）`, 'warning');
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: `错误：不允许修改第${chapterNumber}章（该章节已生成或为当前章节）`
              });
              continue;
            }

            NovelUtils.log(`准备更新大纲第${chapterNumber}章`, 'phase');

            // 执行大纲更新逻辑
            const updates = {
              chapters: [{
                chapter_number: chapterNumber,
                one_sentence: args.one_sentence,
                chapter_detail: args.chapter_detail,
                chapter_title: args.chapter_title,
                expanded_paragraph: args.expanded_paragraph,
                scene_setting: args.scene_setting,
                key_events: args.key_events,
                characters_involved: args.characters_involved,
                plot_progression: args.plot_progression
              }]
            };

            const updatedOutline = mergeOutlineUpdates(outline, updates);
            
            // 持久化更新
            NovelStorage.updateProject(currentProject.id, {
              outline: updatedOutline
            });

            // 更新本地 outline 引用
            outline = updatedOutline;

            NovelUtils.log(`✅ 大纲第${chapterNumber}章已更新`, 'success');
            NovelUtils.toast(`大纲第${chapterNumber}章已根据剧情自动调整`);

            updatedChapters.push(chapterNumber);

            // 将工具调用结果添加到消息历史
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: `成功更新大纲第${chapterNumber}章`
            });

          } catch (error) {
            NovelUtils.log(`❌ 处理工具调用失败：${error.message}`, 'error');
            console.error('[OutlineModification] Tool call error:', error);
            
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: `错误：解析更新参数失败 - ${error.message}`
            });
          }
        }
      }
    }

    if (updatedChapters.length > 0) {
      NovelUtils.log(`✅ 大纲更新完成，共更新 ${updatedChapters.length} 章：${updatedChapters.join(', ')}`, 'success');
      
      // 刷新 UI 显示最新数据
      const updatedProject = NovelStorage.getProjectById(currentProject.id);
      NovelNav.setCurrentProject(updatedProject);
      NovelNav.applyProjectToUI();
    } else {
      NovelUtils.log('ℹ️ 无需调整后续大纲', 'phase');
    }
  }

  return {
    modifyOutlineFromNovel,
    mergeOutlineUpdates,
    buildOutlineUpdatePrompt,
    buildGlobalContextFromOutline
  };
})();

// 确保挂载到 window 对象（供 HTML onclick 使用）
if (typeof window !== 'undefined') {
  window.NovelWriterOutlineModification = NovelWriterOutlineModification;
  console.log('[NovelWriterOutlineModification] Module loaded and attached to window');
}
