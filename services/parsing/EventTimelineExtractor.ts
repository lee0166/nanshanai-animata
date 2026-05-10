/**
 * 事件时间线提取器
 * 
 * 从小说原文中提取叙事事件的因果链和时间顺序
 * 用于确保分镜严格遵循原文因果链
 */

export interface NarrativeEvent {
  id: string;
  description: string;
  sceneName: string;
  textStart: number;
  textEnd: number;
  paragraphIndex: number;
  dependsOn?: string[];
  leadsTo?: string[];
  eventType: 'action' | 'dialogue' | 'emotion' | 'transition' | 'environment';
}

export class EventTimelineExtractor {
  extract(content: string, scenes: Array<{ name: string }>): NarrativeEvent[] {
    const events: NarrativeEvent[] = [];
    
    const paragraphs = content.split(/\n+/).filter(p => p.trim().length > 0);
    
    const causalKeywords = ['因为', '所以', '导致', '结果', '于是', '因此', '从而', '使得', '故而', '继而', '随后', '接着'];
    const actionKeywords = ['走向', '转身', '拿起', '放下', '站起', '坐下', '跑向', '冲向', '后退', '跃起', '坠落', '倒下', '打出', '施展', '祭出', '掐诀', '飞射', '掠出', '腾空', '落下', '踏入', '走出', '推开', '翻身', '拔出', '握紧', '松开'];
    const dialogueKeywords = ['说道', '问道', '答道', '喊道', '叫道', '说', '道', '问', '答', '喝道', '冷笑', '轻笑', '喃喃', '嘟囔', '吩咐', '开口', '斥责', '骂道', '解释', '回应'];
    const emotionKeywords = ['心中', '暗道', '心想', '默念', '不甘', '愤怒', '绝望', '震惊', '坚毅', '隐忍', '恐惧', '害怕', '惊喜', '惊喜', '疑惑', '困惑', '释然', '欣慰', '期待', '激动', '冷静', '沉稳'];
    const environmentKeywords = ['云雾', '灵气', '仙鹤', '琼楼', '玉宇', '山门', '宫殿', '阁楼', '庭院', '竹林', '松树', '瀑布', '溪流', '岩石', '藤蔓', '月光', '阳光', '星空', '晨曦', '黄昏', '夜晚', '白天'];
    
    let currentIndex = 0;
    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i];
      const textStart = content.indexOf(para, currentIndex);
      const textEnd = textStart + para.length;
      
      let sceneName = '未分类';
      let bestScore = 0;
      for (const scene of scenes) {
        let score = 0;
        const keywords = scene.name.replace(/场景/g, '').split(/[,，、\s]+/).filter(k => k.length > 1);
        for (const kw of keywords) {
          if (para.includes(kw)) score += 1;
        }
        const sceneIndex = content.indexOf(scene.name);
        if (sceneIndex !== -1 && textStart !== -1) {
          const distance = Math.abs(textStart - sceneIndex);
          if (distance < 300) score += 2;
          else if (distance < 600) score += 1;
        }
        if (score > bestScore) {
          bestScore = score;
          sceneName = scene.name;
        }
      }
      
      // 按优先级检测事件类型（environment优先于transition）
      let eventType: NarrativeEvent['eventType'] = 'transition';
      if (actionKeywords.some(k => para.includes(k))) {
        eventType = 'action';
      } else if (dialogueKeywords.some(k => para.includes(k))) {
        eventType = 'dialogue';
      } else if (emotionKeywords.some(k => para.includes(k))) {
        eventType = 'emotion';
      } else if (environmentKeywords.some(k => para.includes(k))) {
        eventType = 'environment';
      } else if (para.length > 50 && !para.includes('"') && !para.includes('「')) {
        eventType = 'environment';
      }
      
      // 检测因果关系关键词（收窄条件：需要明确的因果结构）
      // 仅当段落包含明确的因果连接词且长度适中时才标记依赖
      const strongCausalKeywords = ['因此', '导致', '结果', '于是', '从而', '使得', '故而', '继而'];
      const weakCausalKeywords = ['因为', '所以', '随后', '接着'];
      
      const hasStrongCausal = strongCausalKeywords.some(k => para.includes(k));
      const hasWeakCausal = weakCausalKeywords.some(k => para.includes(k));
      
      // 强因果词直接标记，弱因果词需要段落长度>50字符才标记
      const hasCausalLink = hasStrongCausal || (hasWeakCausal && para.length > 50);
      
      events.push({
        id: `event-${i}`,
        description: para.substring(0, 100),
        sceneName,
        textStart,
        textEnd,
        paragraphIndex: i,
        dependsOn: hasCausalLink && i > 0 ? [`event-${i - 1}`] : undefined,
        leadsTo: undefined,
        eventType,
      });
      
      currentIndex = Math.max(currentIndex, textEnd);
    }
    
    for (let i = 1; i < events.length; i++) {
      if (events[i].dependsOn && events[i].dependsOn.length > 0) {
        const prevId = events[i].dependsOn[0];
        const prevEvent = events.find(e => e.id === prevId);
        if (prevEvent && !prevEvent.leadsTo) {
          prevEvent.leadsTo = [events[i].id];
        }
      }
    }
    
    return events;
  }
  
  toPromptFormat(events: NarrativeEvent[]): string {
    if (events.length === 0) return '';
    
    const meaningfulEvents = events.filter(e => 
      e.description.length > 10 && e.sceneName !== '未分类'
    ).slice(0, 30);
    
    if (meaningfulEvents.length === 0) return '';
    
    const eventDescriptions = meaningfulEvents.map((e, idx) => {
      const deps = e.dependsOn && e.dependsOn.length > 0 
        ? ` ←依赖[${e.dependsOn.join(',')}]` 
        : '';
      const typeTag = {
        'action': '【动作】',
        'dialogue': '【对话】',
        'emotion': '【情绪】',
        'environment': '【环境】',
        'transition': '【过渡】'
      }[e.eventType] || '【其他】';
      
      return `  事件${idx + 1} ${typeTag}[${e.sceneName}] 段落${e.paragraphIndex}：${e.description}...${deps}`;
    }).join('\n');
    
    return `

【事件时间线】（必须严格遵守因果顺序）
以下是原文中事件的先后顺序和因果关系：

${eventDescriptions}

【时序硬性规则】
1. 你生成的每个分镜，必须严格遵循上述事件时间线的先后顺序
2. 如果事件 B 依赖事件 A（标注 ←依赖），则 B 的分镜必须在 A 的分镜之后出现
3. 禁止颠倒事件的因果顺序（例如：禁止先输出"结果"，后输出"原因"）
4. 每个分镜应在描述中标注对应的"原文事件序号"（如：对应事件3）
5. 分镜的 sequence 字段必须与事件序号一致
`;
  }
  
  validateSequence(
    shots: Array<{ sequence: number; description?: string }>, 
    events: NarrativeEvent[]
  ): { isValid: boolean; violations: string[] } {
    const violations: string[] = [];
    
    const shotEventMap = new Map<number, NarrativeEvent | null>();
    for (const shot of shots) {
      const matchingEvent = events.find(e => 
        shot.description && shot.description.includes(e.description.substring(0, 30))
      );
      shotEventMap.set(shot.sequence, matchingEvent || null);
    }
    
    for (const event of events) {
      if (event.dependsOn && event.dependsOn.length > 0) {
        const depEvents = events.filter(e => event.dependsOn!.includes(e.id));
        const eventShot = shots.find(s => shotEventMap.get(s.sequence) === event);
        
        for (const depEvent of depEvents) {
          const depShot = shots.find(s => shotEventMap.get(s.sequence) === depEvent);
          if (eventShot && depShot && eventShot.sequence <= depShot.sequence) {
            violations.push(
              `时序违规：事件"${event.description.substring(0, 30)}..."（分镜${eventShot.sequence}）` +
              `依赖事件"${depEvent.description.substring(0, 30)}..."（分镜${depShot.sequence}），` +
              `但 sequence 顺序错误`
            );
          }
        }
      }
    }
    
    return {
      isValid: violations.length === 0,
      violations,
    };
  }
}
