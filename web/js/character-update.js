/**
 * Character Update Module
 * 负责基于生成的正文更新角色档案
 */
const NovelWriterCharacterUpdate = (function () {
  /**
   * 从大纲中构建全文宏观信息概要
   * @param {Object} outline - 大纲对象
   * @param {Object} chapter - 章节对象（可选）
   * @returns {string} - 格式化的全局上下文文本
   */
  function buildGlobalContextFromOutline(outline, chapter) {
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

    // 构建章节列表摘要（展示故事结构）
    const chaptersSummary = chapters.length > 0
      ? `【章节结构（共${chapters.length}章）】
${chapters.slice(0, 10).map((ch, idx) =>
        `${idx + 1}. 第${ch.chapter_number || (idx + 1)}章「${ch.chapter_title || '无标题'}」：${ch.one_sentence || ''}`
      ).join('\n')}${chapters.length > 10 ? `\n... 剩余 ${chapters.length - 10} 章` : ''}
`
      : '';

    // 组合全局上下文
    const globalContext = `${themeText}${worldBuildingText}${chaptersSummary}\n【全文信息概要】\n以上是小说的整体设定和故事结构。\n`;

    return globalContext.trim() || '\n【全文信息概要】\n暂无详细大纲信息。\n';
  }

  /**
   * 合并角色档案更新（根据字段类型采用不同策略）
   * @param {Object} existingChar - 现有角色档案
   * @param {Object} updates - 更新内容
   * @param {boolean} isLastChapter - 是否为最终章节
   * @returns {Object} 更新后的角色档案
   */
  function mergeCharacterUpdates(existingChar, updates, isLastChapter = false) {
    const evidence = updates.evidence;
    const updatedChar = { ...existingChar };

    // ========== 数组型字段：直接覆盖（全文汇总）==========
    // key_changes：整本小说范围内的关键成长/事件汇总，直接覆盖
    if (updates.key_changes && Array.isArray(updates.key_changes)) {
      updatedChar.key_changes = updates.key_changes;
      NovelUtils.log(`📝 关键成长/事件已更新（共 ${updatedChar.key_changes.length} 条）`, 'phase');
    }

    // conflicts：整本小说范围内的内心冲突/矛盾汇总，直接覆盖
    if (updates.conflicts && Array.isArray(updates.conflicts)) {
      updatedChar.conflicts = updates.conflicts;
      NovelUtils.log(`📝 内心冲突/矛盾已更新（共 ${updatedChar.conflicts.length} 条）`, 'phase');
    }

    // ========== 文本型字段：直接覆盖（全新描述）==========
    // personality：完整性格画像，直接覆盖
    if (updates.personality !== undefined) {
      updatedChar.personality = updates.personality || existingChar.personality;
      NovelUtils.log(`📝 性格特征已更新`, 'phase');
    }

    // background：完整背景信息，直接覆盖
    if (updates.background !== undefined) {
      updatedChar.background = updates.background || existingChar.background;
      NovelUtils.log(`📝 背景经历已更新`, 'phase');
    }

    // ========== 状态字段：直接覆盖 ==========
    // initial_state：小说开端状态，一般不修改（除非发现设定有误）
    if (updates.initial_state !== undefined) {
      updatedChar.initial_state = updates.initial_state;
      NovelUtils.log(`📝 初始状态已更新`, 'phase');
    }

    // current_state：本章结束时的当前状态，直接覆盖
    if (updates.current_state !== undefined) {
      updatedChar.current_state = updates.current_state;
      NovelUtils.log(`📝 当前状态已更新`, 'phase');
    }

    // final_state：最终状态，仅在最终章节允许修改
    if (updates.final_state !== undefined) {
      if (isLastChapter) {
        updatedChar.final_state = updates.final_state;
        NovelUtils.log(`✅ 最终状态已更新（最终章节）`, 'phase');
      } else {
        NovelUtils.log(`⚠️ 跳过 final_state 更新（非最终章节不允许修改）`, 'warning');
      }
    }

    // 添加更新时间戳
    updatedChar.updated_at = Date.now();

    // 可选：保存证据引用
    if (evidence) {
      updatedChar.last_update_evidence = evidence;
      updatedChar.last_update_time = new Date().toISOString();
    }

    return updatedChar;
  }

  /**
   * 构建角色更新的 User Prompt
   * @param {string} novelContent - 生成的正文内容
   * @param {Array} characterProfiles - 角色档案列表
   * @param {Object} chapter - 章节对象
   * @returns {string} - 格式化后的 prompt
   */
  function buildCharacterUpdatePrompt(novelContent, characterProfiles, chapter) {
    const currentProject = NovelNav.getCurrentProject();
    const outline = currentProject?.outline || {};

    // 从大纲中提取全文宏观信息
    const globalContext = buildGlobalContextFromOutline(outline, chapter);

    // 格式化现有角色档案（包含完整历史信息）
    const charactersContext = characterProfiles.map(char => {
      const keyChangesText = Array.isArray(char.key_changes) && char.key_changes.length > 0
        ? `\n  - 关键成长（全文汇总）：${char.key_changes.join(';')}`
        : '';

      const conflictsText = Array.isArray(char.conflicts) && char.conflicts.length > 0
        ? `\n  - 内心冲突（全文汇总）：${char.conflicts.join(';')}`
        : '';

      return `【${char.name}】(ID: ${char.id})
  - 性格：${char.personality || '待补充'}
  - 背景：${char.background || '待补充'}
  - 故事定位：${char.role_in_story || '未明确'}
  - 初始状态：${char.initial_state || '未设定'}
  - 当前状态：${char.current_state || '未设定'}
  - 最终状态：${char.final_state || '未设定'}${keyChangesText}${conflictsText}`;
    }).join('\n\n');

    return `${globalContext}
【本章出场角色档案（全文级别·更新前快照）】
${charactersContext}

【当前章节正文】
${novelContent}

【分析任务】
请对比"角色档案"与"本章正文",识别每个角色的发展和变化:
1. **性格新侧面**:本章是否展现了角色之前未体现的性格特征?
2. **背景揭示**:本章是否揭露了角色新的背景信息?
3. **状态演化**:角色的"当前状态"是否有明显变化?
4. **关键成长**:角色是否经历了重要事件或转折点?
5. **冲突升级**:角色的内心冲突是否有新发展?

【更新策略】
- 只处理"有新增信息或变化"的角色 (无变化则跳过)
- **最小更改原则**: 能不修改就不修改，只有在本章内容确实导致角色设定发生实质性变化时才进行更新
- 所有更新必须基于本章具体描写，不做推测或脑补
- 更新应与既有设定保持一致，避免突兀或断裂
- 优先关注:
  - 性格新侧面
  - 状态变化
  - 新冲突或冲突升级
  - 关键经历节点

【字段规范 (必须严格理解)】
✅ **直接覆盖字段 **(全新描述):
- key_changes: 
  - 角色在"整本小说范围内"的关键成长/事件汇总
  - 系统会用新内容**完全替换**旧内容
  - 请提供截至本章的**完整**关键成长/事件列表（包含之前的所有内容）

- conflicts:
  - 角色在"整本小说范围内"的内心冲突/矛盾汇总
  - 系统会用新内容**完全替换**旧内容
  - 请提供截至本章的**完整**内心冲突/矛盾列表（包含之前的所有内容）

✅ **直接覆盖字段 **(全新描述):
- personality:
  - 角色的"完整性格画像"(全文级)
  - 如果本章揭示了新的性格侧面，请提供**完整的、更新后的**性格描述
  - 系统会用新内容**完全替换**旧内容

- background:
  - 角色的"完整背景信息"(全文级)
  - 如果本章揭露了新的背景信息，请提供**完整的、更新后的**背景描述
  - 系统会用新内容**完全替换**旧内容

- initial_state:
  - 角色在"小说开端"的状态
  - ⚠️ 仅在创建角色时填写，后续**不得修改**(除非发现设定有误)

- current_state:
  - 截至"本章结束"的角色状态 (动态更新)
  - 请提供**最新的、当前的**状态描述
  - 系统会用新内容**完全替换**旧内容

- final_state:
  - 角色最终走向/目标状态
  - ⚠️ **重要限制**: 仅在"最终章节"允许修改
  - 如果当前不是最终章节，即使提供了也会被系统忽略
  - 仅在角色完成完整弧线时设置

- evidence:
  - 必须引用正文中的 1–2 句原文，作为更新依据

**重要提示**:
- 调用 update_character_profile 时必须提供角色的 **character_id**
- evidence 字段必须引用正文中的原句 (1-2 句) 作为证据`;
  }

  /**
   * 第三阶段：基于生成的正文更新角色档案
   * @param {string} novelContent - 生成的正文内容
   * @param {Array} characterProfiles - 角色档案列表
   * @param {Object} chapter - 章节对象
   * @param {Object} settings - API 设置
   */
  async function updateCharactersFromNovel(novelContent, characterProfiles, chapter, settings) {
    const currentProject = NovelNav.getCurrentProject();
    if (!currentProject || !novelContent.trim()) {
      NovelUtils.log('没有项目或正文内容，跳过角色更新', 'warning');
      return;
    }

    // 判断当前章节是否为最终章节
    const allChapters = currentProject?.chapters || [];
    const isLastChapter = allChapters.length > 0 &&
      chapter.chapter_number === allChapters[allChapters.length - 1].chapter_number;

    NovelUtils.log(`当前章节号：${chapter.chapter_number}, 总章节数：${allChapters.length}, 是否最终章节：${isLastChapter}`, 'phase');

    // 增强 System Prompt：明确指示只负责调用工具更新角色
    const characterUpdateSystemPrompt = `你是一位专业的小说编辑和角色发展分析师。你的任务是基于"刚刚生成的章节内容"，分析角色的发展变化，并通过工具调用更新角色档案。

【角色发展分析师指南】

【核心原则】
- **最小更改原则**: 能不修改就不修改，只有在本章内容确实导致角色设定发生实质性变化时才进行更新
- 保持角色设定的连续性和稳定性，避免过度解读或频繁修改

【核心任务】
- 识别本章中"发生了实质变化或新增信息"的角色
- 提取角色的成长、性格补充、冲突演化或背景揭示
- 使用工具对角色档案进行更新或创建

【输出规则】
- 以工具调用为唯一核心输出
- 可以在调用前进行极简说明（1 句以内，可选）
- 不输出 JSON 文本本身（必须通过工具传递）
- 不进行任何小说正文写作或剧情扩展

【工具选择】
- 已存在角色 → 调用 update_character_profile（必须提供角色 ID）
- 新出现角色 → 调用 create_new_character

【更新策略】
- 只处理"有新增信息或变化"的角色 (无变化则跳过)
- **最小更改原则**: 能不修改就不修改，只有在本章内容确实导致角色设定发生实质性变化时才进行更新
- 所有更新必须基于本章具体描写，不做推测或脑补
- 更新应与既有设定保持一致，避免突兀或断裂
- 优先关注:
  - 性格新侧面
  - 状态变化
  - 新冲突或冲突升级
  - 关键经历节点

【字段规范 (必须严格理解)】
✅ **直接覆盖字段 **(全新描述):
- key_changes: 
  - 角色在"整本小说范围内"的关键成长/事件汇总
  - 系统会用新内容**完全替换**旧内容
  - 请提供截至本章的**完整**关键成长/事件列表（包含之前的所有内容）

- conflicts:
  - 角色在"整本小说范围内"的内心冲突/矛盾汇总
  - 系统会用新内容**完全替换**旧内容
  - 请提供截至本章的**完整**内心冲突/矛盾列表（包含之前的所有内容）

✅ **直接覆盖字段 **(全新描述):
- personality:
  - 角色的"完整性格画像"(全文级)
  - 如果本章揭示了新的性格侧面，请提供**完整的、更新后的**性格描述
  - 系统会用新内容**完全替换**旧内容

- background:
  - 角色的"完整背景信息"(全文级)
  - 如果本章揭露了新的背景信息，请提供**完整的、更新后的**背景描述
  - 系统会用新内容**完全替换**旧内容

- initial_state:
  - 角色在"小说开端"的状态
  - ⚠️ 仅在创建角色时填写，后续**不得修改**(除非发现设定有误)

- current_state:
  - 截至"本章结束"的角色状态 (动态更新)
  - 请提供**最新的、当前的**状态描述
  - 系统会用新内容**完全替换**旧内容

- final_state:
  - 角色最终走向/目标状态
  - ⚠️ **重要限制**: 仅在"最终章节"允许修改
  - 如果当前不是最终章节，即使提供了也会被系统忽略
  - 仅在角色完成完整弧线时设置

- evidence:
  - 必须引用正文中的 1–2 句原文，作为更新依据

【禁止事项】
- ❌ 不进行小说写作或润色
- ❌ 不编造未出现的信息
- ❌ 不更新没有变化的角色
- ❌ 不输出普通文本代替工具调用

【执行建议】
- 每个角色单独调用工具，保证结构清晰
- 如有多个角色发生变化，依次调用工具
- 优先保证信息准确性，其次再考虑完整性

记住：你的职责是"分析并更新角色档案"，而不是"创作故事"。`;

    // 定义角色管理工具
    const characterManagementTools = [
      {
        type: 'function',
        function: {
          name: 'update_character_profile',
          description: '基于章节内容更新指定角色的档案信息。当你发现某个已有角色在本章中有明显的成长、变化或新特征时使用此工具。',
          parameters: {
            type: 'object',
            properties: {
              character_id: {
                type: 'string',
                description: '要更新的角色的唯一 ID（从角色档案中获取）'
              },
              key_changes: {
                type: 'array',
                items: { type: 'string' },
                description: '角色在整本小说中经历的所有关键成长、转变或重要事件【全文汇总·直接覆盖】'
              },
              conflicts: {
                type: 'array',
                items: { type: 'string' },
                description: '角色在整本小说中展现的所有内心冲突、矛盾或挣扎【全文汇总·直接覆盖】'
              },
              personality: {
                type: 'string',
                description: '角色的完整性格特征（全文级别，如果本章揭示了新的性格侧面，请在原有基础上补充）'
              },
              background: {
                type: 'string',
                description: '角色的完整背景经历（全文级别，如果本章揭露了新的背景信息，请在原有基础上补充）'
              },
              initial_state: {
                type: 'string',
                description: '整本小说开始时该角色的初始状态（一般不修改，除非发现设定有误）'
              },
              current_state: {
                type: 'string',
                description: '角色在本章结束时的当前状态（累积到本章为止的发展）'
              },
              final_state: {
                type: 'string',
                description: '整本小说结束时该角色的最终状态/目标状态（仅在确认角色完成完整弧线时设置）'
              },
              evidence: {
                type: 'string',
                description: '引用正文中支持这些变化的原句（1-2 句）作为证据'
              }
            },
            required: ['character_id']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'create_new_character',
          description: '在章节中发现全新角色时创建新角色档案。当正文中出现了一个之前不存在的角色时使用此工具。',
          parameters: {
            type: 'object',
            properties: {
              character_name: {
                type: 'string',
                description: '新角色的名称'
              },
              personality: {
                type: 'string',
                description: '角色的完整性格特征'
              },
              background: {
                type: 'string',
                description: '角色的完整背景经历'
              },
              role_in_story: {
                type: 'string',
                description: '角色在故事中的定位（如：主角、配角、反派等）'
              },
              initial_state: {
                type: 'string',
                description: '该角色的初始状态（首次出场时的样子）'
              },
              current_state: {
                type: 'string',
                description: '角色在本章结束时的状态（到本章为止的发展）'
              },
              final_state: {
                type: 'string',
                description: '该角色的最终状态/目标状态（如果已明确）'
              },
              key_changes: {
                type: 'array',
                items: { type: 'string' },
                description: '角色经历的所有关键成长或转变'
              },
              conflicts: {
                type: 'array',
                items: { type: 'string' },
                description: '角色在展现的所有内心冲突或挣扎'
              },
              evidence: {
                type: 'string',
                description: '引用正文中描述该角色的原句（1-2 句）作为证据'
              }
            },
            required: ['character_name']
          }
        }
      }
    ];

    // 构建初始消息
    const messages = [
      { role: 'system', content: characterUpdateSystemPrompt },
      { role: 'user', content: buildCharacterUpdatePrompt(novelContent, characterProfiles, chapter) }
    ];

    let roundCount = 0;
    const maxRounds = settings.characterAgentMaxRounds || 10;
    let hasToolCalls = true;
    const updatedCharacters = [];
    const createdCharacters = [];

    // 多轮循环处理角色更新
    while (hasToolCalls && roundCount < maxRounds) {
      roundCount++;
      NovelUtils.log(`=== 第 ${roundCount} 轮角色档案分析 ===`, 'phase');

      // 调用 LLM
      const response = await NovelAPI.call(
        messages,
        characterManagementTools,
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
        NovelUtils.log(`检测到 ${assistantMessage.tool_calls.length} 个角色操作请求`, 'phase');

        // 将 AI 的回复添加到消息历史
        messages.push(assistantMessage);

        // 处理每个工具调用
        for (const toolCall of assistantMessage.tool_calls) {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            const isUpdate = toolCall.function.name === 'update_character_profile';
            const isNewChar = toolCall.function.name === 'create_new_character';

            if (isUpdate) {
              const characterId = args.character_id;

              if (!characterId) {
                NovelUtils.log('⚠️ 更新操作缺少角色 ID', 'warning');
                // 即使参数错误，也要创建响应消息
                messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: `错误：更新操作缺少必需的 character_id 参数`
                });
                continue;
              }

              NovelUtils.log(`准备更新角色 ID「${characterId}」的档案`, 'phase');

              // 在项目中查找该角色
              const project = NovelStorage.getProjectById(currentProject.id);
              let existingCharIndex = project.characters?.findIndex(c => c.id === characterId);

              if (existingCharIndex === undefined || existingCharIndex === -1) {
                NovelUtils.log(`⚠️ 角色 ID「${characterId}」不存在，无法执行更新操作`, 'warning');
                // 角色不存在，也要创建响应消息
                messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: `错误：角色 ID「${characterId}」不存在`
                });
                continue;
              }

              // 角色存在，执行更新逻辑（传入 isLastChapter 参数）
              const existingChar = project.characters[existingCharIndex];
              const updates = {
                key_changes: args.key_changes || [],
                conflicts: args.conflicts || [],
                personality: args.personality,
                background: args.background,
                initial_state: args.initial_state,
                current_state: args.current_state,
                final_state: args.final_state,
                evidence: args.evidence
              };
              const updatedChar = mergeCharacterUpdates(existingChar, updates, isLastChapter);
              project.characters[existingCharIndex] = updatedChar;

              // 持久化更新
              NovelStorage.updateProject(currentProject.id, {
                characters: project.characters
              });

              const charName = updatedChar.name || updatedChar.character_name || characterId;
              NovelUtils.log(`✅ 角色「${charName}」已更新`, 'success');
              NovelUtils.toast(`角色「${charName}」已根据剧情发展自动更新`);

              updatedCharacters.push(updatedChar);

              // 将工具调用结果添加到消息历史
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: `成功更新角色「${charName}」的档案`
              });

            } else if (isNewChar) {
              const characterName = args.character_name;

              if (!characterName) {
                NovelUtils.log('⚠️ 创建操作缺少角色名称', 'warning');
                // 参数错误，也要创建响应消息
                messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: `错误：创建操作缺少必需的 character_name 参数`
                });
                continue;
              }

              NovelUtils.log(`准备创建新角色「${characterName}」`, 'phase');

              // 在项目中查找该角色是否已存在（通过名称）
              const project = NovelStorage.getProjectById(currentProject.id);
              const existingCharIndex = project.characters?.findIndex(
                c => (c.name === characterName || c.character_name === characterName)
              );

              if (existingCharIndex !== undefined && existingCharIndex !== -1) {
                NovelUtils.log(`⚠️ 角色「${characterName}」已存在，跳过创建`, 'warning');
                // 角色已存在，也要创建响应消息
                messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: `错误：角色「${characterName}」已存在，无法重复创建`
                });
                continue;
              }

              // 创建新角色
              const newCharacter = {
                id: NovelUtils.uuid(),
                character_name: characterName,
                name: characterName,
                personality: args.personality || '待补充',
                background: args.background || '待补充',
                role_in_story: args.role_in_story || '配角',
                initial_state: args.initial_state || '',
                current_state: args.current_state || '',
                final_state: args.final_state || '',
                key_changes: args.key_changes || [],
                conflicts: args.conflicts || [],
                enabled: true,
                created_at: Date.now()
              };

              // 使用 NovelProject.addCharacter API 添加新角色
              NovelProject.addCharacter(currentProject.id, newCharacter);

              NovelUtils.log(`✅ 已创建新角色「${characterName}」`, 'success');
              NovelUtils.toast(`已根据剧情自动创建角色「${characterName}」`);

              createdCharacters.push(newCharacter);

              // 重新获取最新的项目数据
              const updatedProject = NovelStorage.getProjectById(currentProject.id);

              // 将工具调用结果添加到消息历史
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: `成功创建新角色「${characterName}」的档案`
              });
            } else {
              NovelUtils.log(`未知的工具调用：${toolCall.function.name}`, 'warning');
              // 未知工具，也要创建响应消息
              messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: `错误：未知的工具调用 ${toolCall.function.name}`
              });
            }
          } catch (error) {
            NovelUtils.log('解析工具调用参数失败：' + error.message, 'error');
            // 解析失败，也要创建响应消息
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: `错误：解析工具调用参数失败 - ${error.message}`
            });
          }
        }

        NovelUtils.log(`本轮工具调用已处理完毕，继续下一轮检测...`, 'phase');
        // ⚠️ 关键：处理完工具调用后，必须继续循环，再次调用 LLM
        // 这样 LLM 才能看到工具响应，并判断是否需要继续调用新工具
      } else {
        NovelUtils.log(`第 ${roundCount} 轮：无更多角色需要更新，分析完成`, 'phase');
      }
    }

    if (roundCount >= maxRounds) {
      NovelUtils.log(`达到最大轮次限制 (${maxRounds})`, 'warning');
    }

    // 刷新 UI 显示最新数据
    if (updatedCharacters.length > 0 || createdCharacters.length > 0) {
      const updatedProject = NovelStorage.getProjectById(currentProject.id);
      NovelNav.setCurrentProject(updatedProject);
      NovelNav.applyProjectToUI();
      NovelUtils.log(`本轮共更新 ${updatedCharacters.length} 个角色，创建 ${createdCharacters.length} 个新角色`, 'success');
    } else {
      NovelUtils.log('本章没有明显的角色发展需要更新或创建', 'phase');
    }
  }

  return {
    updateCharactersFromNovel,
    mergeCharacterUpdates,
    buildCharacterUpdatePrompt,
    buildGlobalContextFromOutline
  };
})();
