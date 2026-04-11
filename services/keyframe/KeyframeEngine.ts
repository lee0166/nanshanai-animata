import {
  Shot,
  Keyframe,
  ShotType,
  CameraMovement,
  ShotContentType,
  FrameType,
  Script,
  CharacterAsset,
  SceneAsset,
} from '../../types';
import { aiService } from '../aiService';

export interface KeyframeSplitParams {
  shot: Shot;
  keyframeCount?: number; // 可选，如果不传则自动根据contentType决定
  script?: Script;
  characterAssets?: CharacterAsset[]; // 完整的角色资产信息
  sceneAsset?: SceneAsset; // 完整的场景资产信息
  modelConfigId?: string; // 用户选择的LLM模型配置ID
  splitOptions?: {
    includeCameraMovement?: boolean; // 是否包含运镜信息
    includeCharacterDetails?: boolean; // 是否包含角色细节
    includeSceneDetails?: boolean; // 是否包含场景细节
    focusOnAction?: boolean; // 是否专注于动作
    focusOnEmotion?: boolean; // 是否专注于情感表达
  };
  temperature?: number; // LLM生成温度
  maxTokens?: number; // LLM最大 tokens
  negativePrompt?: string;
  language?: 'zh' | 'en'; // 语言设置
}

export interface KeyframeSplitResult {
  keyframes: Keyframe[];
  contentType: ShotContentType;
  error?: string;
}

export class KeyframeEngine {
  /**
   * 自动检测分镜类型（static/dynamic-simple/dynamic-complex）
   * 基于description中的动作词汇判断（使用权重机制）
   */
  detectShotType(
    description: string | undefined | null,
    cameraMovement: CameraMovement | undefined | null
  ): ShotContentType {
    const desc = (description || '').toLowerCase();

    // 复杂动态关键词（权重+2）
    const complexKeywords = [
      '打斗',
      '战斗',
      '追逐',
      '奔跑',
      '跳跃',
      '翻滚',
      '爆炸',
      'fight',
      'battle',
      'chase',
      'run',
      'jump',
      'roll',
      'explosion',
      '激烈',
      '快速移动',
      '连续动作',
      '激烈地',
    ];

    // 简单动态关键词（权重+1）
    const simpleKeywords = [
      '走',
      '走动',
      '转身',
      '回头',
      '坐下',
      '站起',
      '开门',
      '关门',
      'walk',
      'turn',
      'sit',
      'stand',
      'open',
      'close',
      'enter',
      'exit',
      '走向',
      '离开',
      '靠近',
      '拿起',
      '放下',
      '说话',
      '交谈',
      '表情',
      'look',
      'speak',
      'talk',
      'express',
      '表情变化',
    ];

    // 计算权重
    let complexScore = 0;
    let simpleScore = 0;

    // 统计复杂关键词
    const matchedComplexKeywords: string[] = [];
    complexKeywords.forEach(kw => {
      if (desc.includes(kw)) {
        complexScore += 2;
        matchedComplexKeywords.push(kw);
      }
    });

    // 统计简单关键词
    const matchedSimpleKeywords: string[] = [];
    simpleKeywords.forEach(kw => {
      if (desc.includes(kw)) {
        simpleScore += 1;
        matchedSimpleKeywords.push(kw);
      }
    });

    // 运镜加分：如果有动态运镜，简单分+1
    const dynamicMovements: CameraMovement[] = [
      'push',
      'pull',
      'pan',
      'tilt',
      'track',
      'zoom_in',
      'zoom_out',
      'dolly_in',
      'dolly_out',
    ];
    if (cameraMovement && dynamicMovements.includes(cameraMovement)) {
      simpleScore += 1;
    }

    // 权重判定规则
    if (complexScore >= 2) {
      return 'dynamic-complex';
    } else if (simpleScore >= 1) {
      return 'dynamic-simple';
    } else {
      return 'static';
    }
  }

  /**
   * 根据分镜类型确定关键帧数量
   */
  getKeyframeCount(contentType: ShotContentType): number {
    switch (contentType) {
      case 'static':
        return 1; // 静态只需要1帧（首帧）
      case 'dynamic-simple':
        return 2; // 简单动态需要2帧（首帧+尾帧）
      case 'dynamic-complex':
        return 3; // 复杂动态需要3帧（首帧+中间帧+尾帧）
      default:
        return 2;
    }
  }

  /**
   * 获取关键帧类型（start/middle/end）
   */
  getFrameType(index: number, total: number): FrameType {
    if (index === 0) return 'start';
    if (index === total - 1) return 'end';
    return 'middle';
  }

  /**
   * 智能拆分关键帧
   * 1. 自动检测分镜类型
   * 2. 根据类型确定关键帧数量
   * 3. 使用LLM生成关键帧描述
   */
  async splitKeyframes(params: KeyframeSplitParams): Promise<KeyframeSplitResult> {
    try {
      const { shot, temperature = 0.7, maxTokens = 2000, negativePrompt } = params;

      // Step 1: 自动检测分镜类型
      const contentType = this.detectShotType(shot.description, shot.cameraMovement);

      // Step 2: 确定关键帧数量
      const keyframeCount = params.keyframeCount || this.getKeyframeCount(contentType);

      // Step 3: 构建并发送Prompt
      const prompt = this.buildSplitPrompt({ ...params, keyframeCount, contentType });

      const result = await aiService.generateText(prompt, params.modelConfigId || '', undefined, {
        temperature,
        maxTokens,
      });

      if (!result.success || !result.data) {
        return { keyframes: [], contentType, error: result.error || 'LLM调用失败' };
      }

      // Step 4: 解析关键帧
      const keyframes = this.parseKeyframesFromResponse(
        result.data,
        shot,
        keyframeCount,
        params.characterAssets,
        params.sceneAsset,
        negativePrompt,
        params.script
      );

      return { keyframes, contentType };
    } catch (error) {
      return {
        keyframes: [],
        contentType: 'dynamic-simple',
        error: String(error),
      };
    }
  }

  /**
   * 构建拆分提示词 - 充分利用角色和场景资产的所有信息
   */
  private buildSplitPrompt(
    params: KeyframeSplitParams & { keyframeCount: number; contentType: ShotContentType }
  ): string {
    const {
      shot,
      keyframeCount,
      contentType,
      characterAssets,
      sceneAsset,
      splitOptions,
      script,
      negativePrompt,
      language = 'zh',
    } = params;

    const isEnglish = language === 'en';

    // 读取全局视觉风格
    const visualStyle = script?.parseState?.metadata?.visualStyle;

    // 构建视觉风格描述
    let visualStyleDesc = '';
    if (visualStyle) {
      const parts: string[] = [];
      if (visualStyle.artDirection)
        parts.push(
          isEnglish
            ? `Art Direction: ${visualStyle.artDirection}`
            : `美术风格：${visualStyle.artDirection}`
        );
      if (visualStyle.artStyle)
        parts.push(
          isEnglish ? `Art Style: ${visualStyle.artStyle}` : `艺术风格：${visualStyle.artStyle}`
        );
      if (visualStyle.colorMood)
        parts.push(
          isEnglish ? `Color Mood: ${visualStyle.colorMood}` : `色彩情绪：${visualStyle.colorMood}`
        );
      if (visualStyle.cinematography)
        parts.push(
          isEnglish
            ? `Cinematography: ${visualStyle.cinematography}`
            : `摄影风格：${visualStyle.cinematography}`
        );
      if (visualStyle.lightingStyle)
        parts.push(
          isEnglish
            ? `Lighting Style: ${visualStyle.lightingStyle}`
            : `光影风格：${visualStyle.lightingStyle}`
        );
      if (visualStyle.colorPalette && visualStyle.colorPalette.length > 0) {
        parts.push(
          isEnglish
            ? `Main Colors: ${visualStyle.colorPalette.join(', ')}`
            : `主色调：${visualStyle.colorPalette.join('、')}`
        );
      }
      if (parts.length > 0) {
        visualStyleDesc = parts.join(isEnglish ? ', ' : '，');
      }
    }

    // 构建详细的角色描述 - 充分利用所有 CharacterAsset 信息
    const characterDesc =
      characterAssets
        ?.map((char, index) => {
          const charDetails: string[] = [];
          charDetails.push(`- ${char.name}`);
          if (char.gender)
            charDetails.push(
              isEnglish
                ? `Gender: ${char.gender === 'male' ? 'Male' : char.gender === 'female' ? 'Female' : 'Unlimited'}`
                : `性别：${char.gender === 'male' ? '男' : char.gender === 'female' ? '女' : '不限'}`
            );
          if (char.ageGroup) {
            const ageMap: Record<string, string> = isEnglish
              ? {
                  childhood: 'Child',
                  youth: 'Youth',
                  middle_aged: 'Middle-aged',
                  elderly: 'Elderly',
                  unknown: 'Unknown',
                }
              : {
                  childhood: '儿童',
                  youth: '青年',
                  middle_aged: '中年',
                  elderly: '老年',
                  unknown: '未知',
                };
            charDetails.push(
              isEnglish
                ? `Age: ${ageMap[char.ageGroup] || char.ageGroup}`
                : `年龄：${ageMap[char.ageGroup] || char.ageGroup}`
            );
          }
          if (char.prompt)
            charDetails.push(
              isEnglish ? `Character Description: ${char.prompt}` : `角色描述：${char.prompt}`
            );
          if (char.metadata?.features)
            charDetails.push(
              isEnglish ? `Features: ${char.metadata.features}` : `特征：${char.metadata.features}`
            );
          if (char.views) {
            const availableViews: string[] = [];
            if (char.views.front) availableViews.push(isEnglish ? 'Front' : '正面');
            if (char.views.side) availableViews.push(isEnglish ? 'Side' : '侧面');
            if (char.views.back) availableViews.push(isEnglish ? 'Back' : '背面');
            if (char.views.threeQuarter)
              availableViews.push(isEnglish ? 'Three-quarter' : '四分之三侧面');
            if (availableViews.length > 0)
              charDetails.push(
                isEnglish
                  ? `Available Views: ${availableViews.join(', ')}`
                  : `可用视角：${availableViews.join('、')}`
              );
          }
          return charDetails.join(isEnglish ? ', ' : '，');
        })
        .join('\n') || (isEnglish ? 'None' : '无');

    // 构建详细的场景描述 - 充分利用所有 SceneAsset 信息
    let sceneDesc = isEnglish ? 'Not specified' : '未指定';
    if (sceneAsset) {
      const sceneDetails: string[] = [];
      sceneDetails.push(sceneAsset.name);
      if (sceneAsset.prompt)
        sceneDetails.push(
          isEnglish ? `Scene Description: ${sceneAsset.prompt}` : `场景描述：${sceneAsset.prompt}`
        );
      if (sceneAsset.metadata?.features)
        sceneDetails.push(
          isEnglish
            ? `Features: ${sceneAsset.metadata.features}`
            : `特征：${sceneAsset.metadata.features}`
        );
      if (sceneAsset.keyElements && sceneAsset.keyElements.length > 0) {
        sceneDetails.push(
          isEnglish
            ? `Key Elements: ${sceneAsset.keyElements.join(', ')}`
            : `关键元素：${sceneAsset.keyElements.join('、')}`
        );
      }
      if (sceneAsset.views) {
        const availableViews: string[] = [];
        if (sceneAsset.views.panorama) availableViews.push(isEnglish ? 'Panorama' : '全景');
        if (sceneAsset.views.wide) availableViews.push(isEnglish ? 'Wide' : '广角');
        if (sceneAsset.views.detail && sceneAsset.views.detail.length > 0)
          availableViews.push(isEnglish ? 'Detail' : '细节');
        if (sceneAsset.views.aerial) availableViews.push(isEnglish ? 'Aerial' : '鸟瞰');
        if (availableViews.length > 0)
          sceneDetails.push(
            isEnglish
              ? `Available Views: ${availableViews.join(', ')}`
              : `可用视角：${availableViews.join('、')}`
          );
      }
      sceneDesc = sceneDetails.join(isEnglish ? ', ' : '，');
    }

    // 根据分镜类型生成不同的拆分要求
    let splitRequirement = '';
    let frameTypeDesc = '';

    if (isEnglish) {
      switch (contentType) {
        case 'static':
          splitRequirement =
            'This is a static shot, only 1 keyframe is needed, describe the main composition';
          frameTypeDesc = 'start (first frame)';
          break;
        case 'dynamic-simple':
          splitRequirement =
            'This is simple dynamic, 2 keyframes needed: starting pose and ending pose';
          frameTypeDesc = 'start (first frame), end (last frame)';
          break;
        case 'dynamic-complex':
          splitRequirement =
            'This is complex dynamic, 3 keyframes needed: starting pose, transition pose, ending pose';
          frameTypeDesc = 'start (first frame), middle (transition frame), end (last frame)';
          break;
      }
    } else {
      switch (contentType) {
        case 'static':
          splitRequirement = '此分镜为静态画面，只需1个关键帧，描述主要画面构图';
          frameTypeDesc = 'start（首帧）';
          break;
        case 'dynamic-simple':
          splitRequirement = '此分镜为简单动态，需要2个关键帧：起始姿态和结束姿态';
          frameTypeDesc = 'start（首帧）, end（尾帧）';
          break;
        case 'dynamic-complex':
          splitRequirement = '此分镜为复杂动态，需要3个关键帧：起始姿态、中间过渡姿态、结束姿态';
          frameTypeDesc = 'start（首帧）, middle（中间帧）, end（尾帧）';
          break;
      }
    }

    // 获取运镜指导
    const movementGuidance =
      splitOptions?.includeCameraMovement !== false
        ? this.getMovementGuidance(shot.cameraMovement, isEnglish)
        : isEnglish
          ? 'Camera movement not specified'
          : '运镜信息未指定';

    // 获取叙事结构指导
    const narrativeStructure = this.getNarrativeStructure(keyframeCount, shot.duration, isEnglish);

    // 构建额外的拆分要求
    let additionalRequirements = '';
    if (splitOptions) {
      if (splitOptions.includeCharacterDetails) {
        additionalRequirements += isEnglish
          ? '6. Describe character expression, costume and action details in detail\n'
          : '6. 详细描述角色的表情、服装和动作细节\n';
      }
      if (splitOptions.includeSceneDetails) {
        additionalRequirements += isEnglish
          ? '7. Describe scene environment, props and atmosphere in detail\n'
          : '7. 详细描述场景的环境、道具和氛围\n';
      }
      if (splitOptions.focusOnAction) {
        additionalRequirements += isEnglish
          ? '8. Emphasize action continuity and power\n'
          : '8. 重点突出动作的连贯性和力量感\n';
      }
      if (splitOptions.focusOnEmotion) {
        additionalRequirements += isEnglish
          ? '9. Emphasize character emotional expression and inner thoughts\n'
          : '9. 重点突出角色的情感表达和内心活动\n';
      }
    }

    // 构建详细的参考信息 - 充分利用所有资产信息
    let referenceInfo = '';
    if (characterAssets && characterAssets.length > 0) {
      referenceInfo += isEnglish ? '【Reference Characters】\n' : '【参考角色】\n';
      characterAssets.forEach((char, index) => {
        referenceInfo += isEnglish
          ? `Character ${index + 1}: ${char.name}\n`
          : `角色${index + 1}: ${char.name}\n`;
        if (char.gender)
          referenceInfo += isEnglish
            ? `  - Gender: ${char.gender === 'male' ? 'Male' : char.gender === 'female' ? 'Female' : 'Unlimited'}\n`
            : `  - 性别: ${char.gender === 'male' ? '男' : char.gender === 'female' ? '女' : '不限'}\n`;
        if (char.ageGroup) {
          const ageMap: Record<string, string> = isEnglish
            ? {
                childhood: 'Child',
                youth: 'Youth',
                middle_aged: 'Middle-aged',
                elderly: 'Elderly',
                unknown: 'Unknown',
              }
            : {
                childhood: '儿童',
                youth: '青年',
                middle_aged: '中年',
                elderly: '老年',
                unknown: '未知',
              };
          referenceInfo += isEnglish
            ? `  - Age: ${ageMap[char.ageGroup] || char.ageGroup}\n`
            : `  - 年龄: ${ageMap[char.ageGroup] || char.ageGroup}\n`;
        }
        if (char.prompt)
          referenceInfo += isEnglish
            ? `  - Description: ${char.prompt}\n`
            : `  - 描述: ${char.prompt}\n`;
        if (char.metadata?.features)
          referenceInfo += isEnglish
            ? `  - Features: ${char.metadata.features}\n`
            : `  - 特征: ${char.metadata.features}\n`;
        if (char.views) {
          const viewList: string[] = [];
          if (char.views.front) viewList.push(isEnglish ? 'Front' : '正面');
          if (char.views.side) viewList.push(isEnglish ? 'Side' : '侧面');
          if (char.views.back) viewList.push(isEnglish ? 'Back' : '背面');
          if (char.views.threeQuarter) viewList.push(isEnglish ? 'Three-quarter' : '四分之三侧面');
          if (viewList.length > 0)
            referenceInfo += isEnglish
              ? `  - Available Views: ${viewList.join(', ')}\n`
              : `  - 可用视角: ${viewList.join(', ')}\n`;
        }
      });
    }
    if (sceneAsset) {
      referenceInfo += isEnglish ? '【Reference Scene】\n' : '【参考场景】\n';
      referenceInfo += isEnglish ? `Scene: ${sceneAsset.name}\n` : `场景: ${sceneAsset.name}\n`;
      if (sceneAsset.prompt)
        referenceInfo += isEnglish
          ? `  - Description: ${sceneAsset.prompt}\n`
          : `  - 描述: ${sceneAsset.prompt}\n`;
      if (sceneAsset.metadata?.features)
        referenceInfo += isEnglish
          ? `  - Features: ${sceneAsset.metadata.features}\n`
          : `  - 特征: ${sceneAsset.metadata.features}\n`;
      if (sceneAsset.keyElements && sceneAsset.keyElements.length > 0) {
        referenceInfo += isEnglish
          ? `  - Key Elements: ${sceneAsset.keyElements.join(', ')}\n`
          : `  - 关键元素: ${sceneAsset.keyElements.join(', ')}\n`;
      }
      if (sceneAsset.views) {
        const viewList: string[] = [];
        if (sceneAsset.views.panorama) viewList.push(isEnglish ? 'Panorama' : '全景');
        if (sceneAsset.views.wide) viewList.push(isEnglish ? 'Wide' : '广角');
        if (sceneAsset.views.detail && sceneAsset.views.detail.length > 0)
          viewList.push(isEnglish ? 'Detail' : '细节');
        if (sceneAsset.views.aerial) viewList.push(isEnglish ? 'Aerial' : '鸟瞰');
        if (viewList.length > 0)
          referenceInfo += isEnglish
            ? `  - Available Views: ${viewList.join(', ')}\n`
            : `  - 可用视角: ${viewList.join(', ')}\n`;
      }
    }

    // 构建视觉风格部分
    let visualStyleSection = '';
    if (visualStyleDesc) {
      visualStyleSection = isEnglish
        ? `【Global Visual Style】
${visualStyleDesc}

`
        : `【全局视觉风格】
${visualStyleDesc}

`;
    }

    if (isEnglish) {
      return `You are a professional storyboard artist. Please split the following shot description into ${keyframeCount} coherent static keyframes.

【Camera Movement Guidance】
${movementGuidance}

【Narrative Structure】
${narrativeStructure}

${visualStyleSection}【Reference Information】
${referenceInfo || 'No reference information'}

【Coherence Requirements】
Character pose changes between adjacent keyframes should be gradual, avoid large jumps. Maintain scene and character consistency, ensure smooth action transitions.

【Shot Information】
- Scene: ${sceneDesc}
- Shot Type: ${shot.shotType}
- Camera Movement: ${shot.cameraMovement}
- Duration: ${shot.duration} seconds
- Shot Type: ${contentType}
- Characters:
${characterDesc}

【Shot Description】
${shot.description}

【Splitting Requirements】
${splitRequirement}
1. Sort by action timeline (start → transition → end)
2. Each keyframe must be a static shot, describe specific pose
3. Maintain character and scene consistency (strictly use reference character and scene features)
4. Meet ${shot.shotType} shot type requirements
5. Total duration within ${shot.duration} seconds
6. Use English commas to separate elements in prompt field
7. Both description and prompt fields MUST be in ENGLISH
8. prompt field must include quality tags: masterpiece, 8k, ultra detailed, best quality
9. prompt field must incorporate global visual style (if any)
10. prompt field must fully utilize reference character and scene description information
11. prompt field must include shot description content
12. prompt field must not include internal database IDs (like kf_xxx_1)
${additionalRequirements}

【Keyframe Type Description】
- frameType field must be one of: ${frameTypeDesc}
- start: Static shot at action start
- middle: Key transition pose during action (only needed for complex dynamic)
- end: Static shot at action end

【Output Format】
Please strictly output in the following JSON format, do not include other content:

{
  "keyframes": [
    {
      "sequence": 1,
      "frameType": "start",
      "description": "Static shot description (specific pose)",
      "prompt": "Image generation prompt, including character features, scene features, lighting style",
      "duration": duration in seconds
    }
  ]
}

Note:
- description should describe static pose, no dynamic action words
- prompt should be suitable for image generation tools, include quality tags and visual style
- prompt must strictly follow reference character and scene descriptions, ensure character and scene consistency
- prompt must include shot description content
- Both description and prompt fields must be in ENGLISH
- prompt format example: masterpiece, 8k, ultra detailed, best quality, [full character description], [full scene description], [shot description content], [visual style], [shot type description], [lighting description]`;
    } else {
      return `你是一位专业的电影分镜师。请将以下分镜描述拆分为${keyframeCount}个连贯的静态关键帧。

【运镜指导】
${movementGuidance}

【叙事结构】
${narrativeStructure}

${visualStyleSection}【参考信息】
${referenceInfo || '无参考信息'}

【连贯性要求】
相邻关键帧的角色姿态变化应该是渐进的，避免大幅度跳跃。保持场景和角色的一致性，确保动作的流畅过渡。

【分镜信息】
- 场景：${sceneDesc}
- 景别：${shot.shotType}
- 运镜：${shot.cameraMovement}
- 时长：${shot.duration}秒
- 分镜类型：${contentType}
- 角色：
${characterDesc}

【画面描述】
${shot.description}

【拆分要求】
${splitRequirement}
1. 按动作时间线排序（起始→过渡→结束）
2. 每个关键帧必须是静态画面，描述具体姿态
3. 保持角色和场景一致性（严格使用参考角色和场景的特征）
4. 符合${shot.shotType}景别要求
5. 总时长控制在${shot.duration}秒内
6. prompt字段使用英文逗号分隔元素
7. description和prompt字段都必须使用中文
8. prompt字段必须包含质量标签：masterpiece, 8k, ultra detailed, best quality
9. prompt字段必须融入全局视觉风格（如果有）
10. prompt字段必须充分利用参考角色和场景的描述信息
11. prompt字段必须包含分镜画面描述的内容
12. prompt字段不要包含内部数据库ID（如kf_xxx_1）
${additionalRequirements}

【关键帧类型说明】
- frameType字段必须是以下之一：${frameTypeDesc}
- start: 动作起始时的静态画面
- middle: 动作过程中的关键过渡姿态（仅复杂动态需要）
- end: 动作结束时的静态画面

【输出格式】
请严格按以下JSON格式输出，不要包含其他内容：

{
  "keyframes": [
    {
      "sequence": 1,
      "frameType": "start",
      "description": "静态画面描述（具体姿态）",
      "prompt": "图生图提示词，包含角色特征、场景特征、光影风格",
      "duration": 时长秒数
    }
  ]
}

注意：
- description要描述静态姿态，不能有动态动作词
- prompt要适配图生图工具，包含质量标签和视觉风格
- prompt必须严格遵循参考角色和场景的描述，确保角色和场景的一致性
- prompt必须包含分镜画面描述的内容
- description和prompt字段都必须使用中文
- prompt格式示例：masterpiece, 8k, ultra detailed, best quality, [角色完整描述], [场景完整描述], [画面描述内容], [视觉风格], [景别描述], [光影描述]`;
    }
  }

  /**
   * 解析LLM返回的关键帧
   */
  private parseKeyframesFromResponse(
    response: string,
    shot: Shot,
    keyframeCount: number,
    characterAssets?: CharacterAsset[],
    sceneAsset?: SceneAsset,
    negativePrompt?: string,
    script?: Script
  ): Keyframe[] {
    try {
      // 提取JSON部分
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法解析LLM返回的JSON格式，请检查模型输出');
      }

      const data = JSON.parse(jsonMatch[0]);

      if (!data.keyframes || !Array.isArray(data.keyframes)) {
        throw new Error('返回数据格式错误：缺少keyframes数组');
      }

      const keyframes = data.keyframes.map((kf: any, index: number) => {
        const frameType = kf.frameType || this.getFrameType(index, keyframeCount);

        const keyframe = {
          id: `kf_${shot.id}_${index + 1}`,
          sequence: kf.sequence || index + 1,
          frameType: frameType as FrameType,
          description: kf.description || '',
          prompt: kf.prompt || '',
          negativePrompt,
          duration: kf.duration || Math.ceil(shot.duration / data.keyframes.length),
          references: {
            character: characterAssets?.[0]
              ? {
                  id: characterAssets[0].id,
                  name: characterAssets[0].name,
                }
              : undefined,
            scene: sceneAsset
              ? {
                  id: sceneAsset.id,
                  name: sceneAsset.name,
                }
              : undefined,
          },
          status: 'pending' as const,
        };

        return keyframe;
      });

      return keyframes;
    } catch (error) {
      // 解析失败，抛出错误而不是返回默认关键帧
      throw new Error(`关键帧解析失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取运镜指导文本
   */
  private getMovementGuidance(movement: CameraMovement, isEnglish: boolean = false): string {
    const guidanceMapZH: Record<CameraMovement, string> = {
      static: '固定镜头：关键帧应该体现角色动作的变化，保持画面构图稳定。',
      push: '推镜头：关键帧应该体现景别从大到小的变化。第1帧用较大景别（能看到角色全身），第2帧中等景别（腰部以上），第3帧特写（脸部表情）。',
      pull: '拉镜头：关键帧应该体现景别从小到大的变化。第1帧特写（脸部表情），第2帧中等景别（腰部以上），第3帧较大景别（能看到角色全身）。',
      pan: '摇镜头：关键帧应该体现画面内容的水平移动。第1帧画面左侧内容，第2帧画面中央内容，第3帧画面右侧内容。',
      tilt: '升降镜头：关键帧应该体现画面内容的垂直移动。',
      track:
        '移镜头：关键帧应该体现空间位置的变化。第1帧角色在画面一侧，第2帧角色在画面中央，第3帧角色在画面另一侧。',
      crane: '升降镜头：关键帧应该体现大范围的视角变化。',
      zoom_in: '推镜头：关键帧应该体现景别从大到小的变化。',
      zoom_out: '拉镜头：关键帧应该体现景别从小到大的变化。',
      dolly_in: '推镜头：关键帧应该体现景别从大到小的变化。',
      dolly_out: '拉镜头：关键帧应该体现景别从小到大的变化。',
    };

    const guidanceMapEN: Record<CameraMovement, string> = {
      static:
        'Fixed shot: Keyframes should reflect character action changes, maintain stable composition.',
      push: 'Push-in shot: Keyframes should reflect shot size change from large to small. Frame 1: wide shot (full body), Frame 2: medium shot (waist up), Frame 3: close-up (facial expression).',
      pull: 'Pull-out shot: Keyframes should reflect shot size change from small to large. Frame 1: close-up (facial expression), Frame 2: medium shot (waist up), Frame 3: wide shot (full body).',
      pan: 'Pan shot: Keyframes should reflect horizontal movement of content. Frame 1: left side content, Frame 2: center content, Frame 3: right side content.',
      tilt: 'Tilt shot: Keyframes should reflect vertical movement of content.',
      track:
        'Tracking shot: Keyframes should reflect spatial position changes. Frame 1: character on one side, Frame 2: character in center, Frame 3: character on the other side.',
      crane: 'Crane shot: Keyframes should reflect large-scale perspective changes.',
      zoom_in: 'Zoom-in shot: Keyframes should reflect shot size change from large to small.',
      zoom_out: 'Zoom-out shot: Keyframes should reflect shot size change from small to large.',
      dolly_in: 'Dolly-in shot: Keyframes should reflect shot size change from large to small.',
      dolly_out: 'Dolly-out shot: Keyframes should reflect shot size change from small to large.',
    };

    const guidanceMap = isEnglish ? guidanceMapEN : guidanceMapZH;
    return guidanceMap[movement] || guidanceMap.static;
  }

  /**
   * 获取叙事结构指导
   */
  private getNarrativeStructure(
    count: number,
    duration: number,
    isEnglish: boolean = false
  ): string {
    if (count === 2) {
      return isEnglish
        ? `Generate 2 keyframes:
- Frame 1 (Action Start): ${Math.ceil(duration * 0.5)} seconds, establish initial pose
- Frame 2 (Action End): ${Math.ceil(duration * 0.5)} seconds, show final pose`
        : `生成2个关键帧：
- 第1帧（动作起点）：${Math.ceil(duration * 0.5)}秒，建立初始姿态
- 第2帧（动作终点）：${Math.ceil(duration * 0.5)}秒，展示最终姿态`;
    }

    if (count === 3) {
      return isEnglish
        ? `Generate 3 keyframes:
- Frame 1 (Action Start): ${Math.ceil(duration * 0.4)} seconds, establish initial pose
- Frame 2 (Action Peak/Turning): ${Math.ceil(duration * 0.3)} seconds, show most intense moment or turning point
- Frame 3 (Action End): ${Math.ceil(duration * 0.3)} seconds, show final stable pose`
        : `生成3个关键帧：
- 第1帧（动作起点）：${Math.ceil(duration * 0.4)}秒，建立初始姿态
- 第2帧（动作顶点/转折）：${Math.ceil(duration * 0.3)}秒，展示最激烈的瞬间或转折点
- 第3帧（动作终点）：${Math.ceil(duration * 0.3)}秒，展示最终稳定姿态`;
    }

    if (count === 4) {
      return isEnglish
        ? `Generate 4 keyframes:
- Frame 1 (Action Start): ${Math.ceil(duration * 0.3)} seconds, establish initial pose
- Frame 2 (Action Development): ${Math.ceil(duration * 0.25)} seconds, show action development
- Frame 3 (Action Peak): ${Math.ceil(duration * 0.25)} seconds, show most intense moment
- Frame 4 (Action End): ${Math.ceil(duration * 0.2)} seconds, show final stable pose`
        : `生成4个关键帧：
- 第1帧（动作起点）：${Math.ceil(duration * 0.3)}秒，建立初始姿态
- 第2帧（动作发展）：${Math.ceil(duration * 0.25)}秒，展示动作发展
- 第3帧（动作顶点）：${Math.ceil(duration * 0.25)}秒，展示最激烈的瞬间
- 第4帧（动作终点）：${Math.ceil(duration * 0.2)}秒，展示最终稳定姿态`;
    }

    return '';
  }

  /**
   * 生成默认关键帧（解析失败时使用）
   */
  private generateDefaultKeyframes(
    shot: Shot,
    keyframeCount: number,
    characterAssets?: CharacterAsset[],
    sceneAsset?: SceneAsset,
    negativePrompt?: string,
    script?: Script
  ): Keyframe[] {
    const durationPerFrame = Math.ceil(shot.duration / keyframeCount);

    // 读取全局视觉风格
    const visualStyle = script?.parseState?.metadata?.visualStyle;
    const stylePrompts: string[] = [];
    if (visualStyle?.artStyle) stylePrompts.push(visualStyle.artStyle);
    if (visualStyle?.cinematography) stylePrompts.push(visualStyle.cinematography);
    if (visualStyle?.colorPalette && Array.isArray(visualStyle.colorPalette)) {
      visualStyle.colorPalette.forEach(color => {
        if (color) stylePrompts.push(color);
      });
    }

    return Array.from({ length: keyframeCount }, (_, i) => {
      const frameType = this.getFrameType(i, keyframeCount);
      const progress = (i + 1) / keyframeCount;

      let typeDesc = '';
      let promptSuffix = '';
      let descriptionSuffix = '';

      if (frameType === 'start') {
        typeDesc = '起始';
        promptSuffix = ', opening scene, full shot, soft lighting';
        descriptionSuffix = '（开场画面）';
      } else if (frameType === 'end') {
        typeDesc = '结束';
        promptSuffix = ', closing scene, close-up, lasting impression';
        descriptionSuffix = '（收尾画面）';
      } else {
        const middleFrameCount = keyframeCount - 2;
        const middleFrameIndex = i;
        if (middleFrameCount === 1) {
          typeDesc = '过渡';
          promptSuffix = ', transition frame, medium shot, detail focus';
          descriptionSuffix = '（中间过渡）';
        } else {
          const middleProgress = middleFrameIndex / (middleFrameCount + 1);
          if (middleProgress < 0.5) {
            typeDesc = '发展';
            promptSuffix = ', developing scene, medium close-up, plot progression';
            descriptionSuffix = '（发展中画面）';
          } else {
            typeDesc = '高潮';
            promptSuffix = ', climax frame, close-up, emotional build-up';
            descriptionSuffix = '（高潮前画面）';
          }
        }
      }

      const shotNumber = shot.shotNumber || shot.sequence;

      const promptParts = [
        'masterpiece, 8k, ultra detailed, best quality',
        ...stylePrompts,
        shot.shotType,
        sceneAsset?.name,
        characterAssets?.[0]?.name,
        `${typeDesc} pose`,
      ].filter(Boolean);

      return {
        id: `kf_${shot.id}_${i + 1}`,
        sequence: i + 1,
        frameType: frameType,
        description: `${shotNumber}-${i + 1} ${shot.description}${descriptionSuffix}`,
        prompt: `${promptParts.join(', ')}${promptSuffix}`,
        negativePrompt,
        duration: durationPerFrame,
        references: {
          character: characterAssets?.[0]
            ? {
                id: characterAssets[0].id,
                name: characterAssets[0].name,
              }
            : undefined,
          scene: sceneAsset
            ? {
                id: sceneAsset.id,
                name: sceneAsset.name,
              }
            : undefined,
        },
        status: 'pending' as const,
      };
    });
  }
}

export const keyframeEngine = new KeyframeEngine();
