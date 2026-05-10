import { SemanticChunker, SemanticChunk } from './SemanticChunker';

export interface PlotPoint {
  id: string;
  type: 'environment' | 'action' | 'dialogue' | 'monologue' | 'conflict' | 'transition' | 'climax';
  text: string;
  sceneName: string;
  estimatedShots: number;
  dialogueCount: number;
  actionVerbCount: number;
  characterIds: string[];
}

interface ChunkWithScene {
  text: string;
  sceneName: string;
  startIndex: number;
}

export interface PlotPointPlan {
  plotPoints: PlotPoint[];
  totalShotsEstimate: number;
  scenePlotPoints: Map<string, PlotPoint[]>;
}

export class PlotPointPlanner {
  private semanticChunker: SemanticChunker;

  constructor(semanticChunker: SemanticChunker) {
    this.semanticChunker = semanticChunker;
  }

  async plan(content: string, scenes: Array<{ name: string }>): Promise<PlotPointPlan> {
    const chunks = await this.semanticChunker.chunk(content);

    const chunksWithScene = this.assignChunksToScenes(chunks, scenes, content);

    const plotPoints = chunksWithScene.map(chunk => this.analyzePlotPoint(chunk));

    const plotPointsWithShots = plotPoints.map(pp => ({
      ...pp,
      estimatedShots: this.calculateShotCount(pp),
    }));

    const totalShotsEstimate = plotPointsWithShots.reduce((sum, pp) => sum + pp.estimatedShots, 0);

    const scenePlotPoints = new Map<string, PlotPoint[]>();
    for (const pp of plotPointsWithShots) {
      if (!scenePlotPoints.has(pp.sceneName)) {
        scenePlotPoints.set(pp.sceneName, []);
      }
      scenePlotPoints.get(pp.sceneName)!.push(pp);
    }

    return {
      plotPoints: plotPointsWithShots,
      totalShotsEstimate,
      scenePlotPoints,
    };
  }

  private assignChunksToScenes(
    chunks: SemanticChunk[],
    scenes: Array<{ name: string }>,
    content: string
  ): ChunkWithScene[] {
    return chunks.map(chunk => {
      let bestScene = scenes[0]?.name || '未分类';
      let bestScore = 0;

      for (const scene of scenes) {
        const sceneNameLower = scene.name.toLowerCase();
        const keywords = sceneNameLower.replace(/场景/g, '').split(/[,，、\s]+/).filter(k => k.length > 1);

        let score = 0;
        for (const keyword of keywords) {
          if (chunk.content.includes(keyword)) {
            score += 1;
          }
        }

        const sceneIndex = content.indexOf(scene.name);
        const chunkIndex = content.indexOf(chunk.content.substring(0, 20));
        if (sceneIndex !== -1 && chunkIndex !== -1) {
          const distance = Math.abs(chunkIndex - sceneIndex);
          if (distance < 500) {
            score += 2;
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestScene = scene.name;
        }
      }

      const startIndex = content.indexOf(chunk.content.substring(0, 20));

      return {
        text: chunk.content,
        sceneName: bestScene,
        startIndex: startIndex !== -1 ? startIndex : 0,
      };
    });
  }

  private analyzePlotPoint(chunk: ChunkWithScene): PlotPoint {
    const { text } = chunk;

    // 对话分析
    const dialogues = text.match(/[""「『《].*?['"」』》]/g) || [];
    const dialogueCount = dialogues.length;
    
    // 提取对话总字数(用于判断对话密度)
    const dialogueTotalLength = (dialogues as string[]).reduce((sum, d) => sum + d.length, 0);
    const dialogueDensity = text.length > 0 ? dialogueTotalLength / text.length : 0;

    // 动作动词分析(扩展词库)
    const actionVerbs = [
      '踹', '扑', '滚', '攥', '攀', '坠', '爆发', '停止', '走向', '转身', '放下', '撑起', '踢', '抓', '挥', '跃', '冲', '退', '挡', '劈',
      '跃起', '腾空', '坠落', '砸', '撞', '砍', '刺', '挑', '扫', '擒', '拿', '点', '拍', '震', '退', '避', '闪', '掠', '遁',
      '掐诀', '念咒', '祭出', '打出', '抛出', '收起', '展开', '捏碎', '捏成', '化作', '化为', '显化',
    ];
    const actionVerbCount = actionVerbs.filter(v => text.includes(v)).length;
    
    // 统计动作描写的总长度
    const actionTextLength = actionVerbs
      .filter(v => text.includes(v))
      .reduce((sum, v) => sum + v.length, 0);

    // 冲突分析(扩展词库)
    const conflictKeywords = [
      '欺凌', '欺压', '踩', '嗤笑', '戏谑', '尖酸', '废人', '废灵根', '嘲讽', '辱骂', '对峙', '打斗',
      '怒', '恨', '杀意', '敌意', '威胁', '压迫', '威压', '气势', '交锋', '碰撞', '爆炸',
      '反目', '背叛', '揭露', '戳穿', '对峙', '质问', '审问',
    ];
    const conflictKeywordsMatched = conflictKeywords.filter(k => text.includes(k));
    const hasConflict = conflictKeywordsMatched.length >= 2;

    // 情绪分析(扩展词库)
    const emotionKeywords = [
      '愤怒', '绝望', '震惊', '瞳孔骤缩', '大惊', '不甘', '坚毅', '隐忍', '倔强',
      '冷笑', '狞笑', '苦笑', '惨笑', '微笑', '轻笑', '淡笑', '莞尔',
      '叹息', '长叹', '喟叹', '唏嘘', '感慨', '怅然', '失落', '落寞',
      '欣喜', '喜悦', '兴奋', '激动', '狂喜', '满足', '欣慰', '安心',
      '恐惧', '害怕', '惊慌', '忐忑', '不安', '紧张', '焦虑', '担忧',
    ];
    const emotionKeywordsMatched = emotionKeywords.filter(k => text.includes(k));
    const hasEmotion = emotionKeywordsMatched.length >= 2;
    const emotionIntensity = emotionKeywordsMatched.length;

    // 转折分析(扩展词库)
    const transitionKeywords = [
      '突然', '刹那间', '骤然', '竟', '竟然', '却', '猛地', '瞬间', '转眼',
      '谁知', '哪知', '岂料', '没想到', '出乎意料', '意想不到',
      '忽然', '倏地', '蓦地', '陡然', '骤然', '霍然',
    ];
    const transitionKeywordsMatched = transitionKeywords.filter(k => text.includes(k));
    const hasTransition = transitionKeywordsMatched.length >= 1;

    // 内心独白分析(扩展词库)
    const monologueKeywords = [
      '想', '难道', '喃喃自语', '心想', '暗自', '难道我', '他不甘心', '他想', '自语',
      '默念', '心中', '心底', '暗道', '暗自思忖', '心中暗想', '心中一动',
      '不禁', '不由得', '忍不住', '只觉得',
    ];
    const monologueKeywordsMatched = monologueKeywords.filter(k => text.includes(k));
    const hasMonologue = monologueKeywordsMatched.length >= 2 || 
      (monologueKeywordsMatched.length >= 1 && dialogueDensity < 0.3);

    // 环境描写分析
    const environmentKeywords = [
      '云雾', '缭绕', '灵气', '仙鹤', '琼楼玉宇', '云海', '山峰', '峡谷', '溪流', '瀑布',
      '殿堂', '阁楼', '庭院', '花园', '竹林', '松林', '树林', '草丛', '花海',
      '阳光', '月光', '星光', '夜色', '晨曦', '黄昏', '黎明', '傍晚',
      '风', '雨', '雪', '雷', '电', '雾', '霜', '露',
    ];
    const environmentKeywordsMatched = environmentKeywords.filter(k => text.includes(k));
    const hasEnvironment = environmentKeywordsMatched.length >= 3;

    // 情节点类型判断(优化优先级逻辑)
    let type: PlotPoint['type'];
    
    // 内容比例检查：如果环境关键词远多于冲突关键词，优先标记为 environment
    if (hasConflict && hasEnvironment && environmentKeywordsMatched.length > conflictKeywordsMatched.length * 2) {
      type = 'environment';
    }
    // 高潮: 冲突+转折+高情绪强度
    else if (hasConflict && hasTransition && emotionIntensity >= 3) {
      type = 'climax';
    }
    // 冲突: 明显的对抗或打斗
    else if (hasConflict && (actionVerbCount >= 2 || conflictKeywordsMatched.length >= 3)) {
      type = 'conflict';
    }
    // 对话: 对话密度高且内容充实
    else if (dialogueCount >= 2 && dialogueDensity > 0.4) {
      type = 'dialogue';
    }
    // 内心独白: 有明确的内心活动且对话较少
    else if (hasMonologue && dialogueCount < 2) {
      type = 'monologue';
    }
    // 动作: 动作密集
    else if (actionVerbCount >= 3 || actionTextLength > text.length * 0.3) {
      type = 'action';
    }
    // 转折: 有意外或反转
    else if (hasTransition && hasEmotion) {
      type = 'transition';
    }
    // 环境: 环境描写为主
    else if (hasEnvironment && text.length > 80) {
      type = 'environment';
    }
    // 过渡: 短文本且内容不密集
    else {
      type = 'transition';
    }

    // 提取角色 ID(简单启发式)
    const characterPatterns = text.match(/[\u4e00-\u9fa5]{2,4}(?:说|道|问|答|笑|哭|怒|喜|心想|暗道)/g) || [];
    const characterIds = [...new Set(characterPatterns.map(m => m.replace(/(说|道|问|答|笑|哭|怒|喜|心想|暗道)/, '')))];

    return {
      id: crypto.randomUUID(),
      type,
      text,
      sceneName: chunk.sceneName,
      estimatedShots: 0,
      dialogueCount,
      actionVerbCount,
      characterIds,
    };
  }

  private calculateShotCount(plotPoint: PlotPoint): number {
    // 基础分镜数映射
    const baseShotsMap: Record<PlotPoint['type'], number> = {
      environment: 1,
      action: 2,
      dialogue: 2,
      monologue: 1,
      conflict: 3,
      transition: 1,
      climax: 3,
    };

    let baseShots = baseShotsMap[plotPoint.type];

    // 计算各维度的调整系数（取最大值而非叠加）
    let dialogueMultiplier = 1.0;
    if (plotPoint.dialogueCount >= 4) dialogueMultiplier = 1.3;
    else if (plotPoint.dialogueCount >= 3) dialogueMultiplier = 1.2;
    else if (plotPoint.dialogueCount >= 2) dialogueMultiplier = 1.1;

    let lengthMultiplier = 1.0;
    if (plotPoint.text.length > 300) lengthMultiplier = 1.3;
    else if (plotPoint.text.length > 200) lengthMultiplier = 1.2;
    else if (plotPoint.text.length > 100) lengthMultiplier = 1.1;
    else if (plotPoint.text.length < 50) lengthMultiplier = 0.8;

    let actionMultiplier = 1.0;
    if (plotPoint.actionVerbCount >= 5) actionMultiplier = 1.3;
    else if (plotPoint.actionVerbCount >= 3) actionMultiplier = 1.15;

    // 使用最大值（而非叠加），避免倍率爆炸
    const maxMultiplier = Math.max(dialogueMultiplier, lengthMultiplier, actionMultiplier);
    const adjustedShots = Math.round(baseShots * maxMultiplier);

    // 扩大上限至 8（为复杂情节留空间）
    return Math.max(1, Math.min(8, adjustedShots));
  }
}
