/**
 * 关键叙事元素提取器
 * 
 * 从小说原文中提取必须包含在分镜中的关键元素：
 * - 关键台词
 * - 关键道具及其来历
 * - 环境/情境对比
 * - 内心独白
 * - 角色性格特征
 */

export interface KeyNarrativeElements {
  criticalDialogues: {
    text: string;
    characterName: string;
    sceneName: string;
    paragraphIndex: number;
  }[];
  criticalProps: {
    name: string;
    description: string;
    significance: string;
    sceneName: string;
  }[];
  criticalContrasts: {
    description: string;
    sceneA: string;
    sceneB: string;
  }[];
  criticalInnerMonologues: {
    text: string;
    characterName: string;
    sceneName: string;
    paragraphIndex: number;
  }[];
  characterProfiles: {
    name: string;
    personalityTraits: {
      trait: string;
      visualCues: string[];
    }[];
    role: 'protagonist' | 'antagonist' | 'supporting';
  }[];
}

export class KeyElementsExtractor {
  extract(content: string, scenes: Array<{ name: string }>): KeyNarrativeElements {
    const paragraphs = content.split(/\n+/).filter(p => p.trim().length > 0);
    
    const criticalDialogues: KeyNarrativeElements['criticalDialogues'] = [];
    const criticalProps: KeyNarrativeElements['criticalProps'] = [];
    const criticalContrasts: KeyNarrativeElements['criticalContrasts'] = [];
    const criticalInnerMonologues: KeyNarrativeElements['criticalInnerMonologues'] = [];
    
    const dialoguePattern = /([""「『《])(.*?)['"」』》]/g;
    const monologuePattern = /(心想|暗道|默念|心中|心底|难道|他不甘心|难道我)/;
    const propPattern = /(玉佩|武器|法宝|丹药|书信|遗物|宝物|物件)/;
    const contrastPattern = /(从来|却|但是|然而|反而|截然不同|完全不同|迥然)/;
    
    const dialogueVerbs = [
      '说', '道', '问', '答', '喊', '叫', '斥', '骂',
      '喝道', '说道', '问道', '答道', '笑道', '冷声道', '淡淡道', 
      '沉声道', '厉声道', '怒道', '轻声道', '低声道', '喃喃道', 
      '嘟囔道', '吩咐道', '开口道', '回应道', '解释道', '安慰道',
      '催促道', '警告道', '威胁道', '乞求道', '哀求道', '嘲讽道',
      '讥讽道', '冷哼道', '嗤笑道', '断然道', '坚决道', '恭敬道',
      '恭敬地说道', '大声说道', '小声说道', '缓缓说道', '冷冷说道',
      '突然说道', '接着说道', '继续说道', '又说道', '补充道',
      '回答', '喝道', '大骂', '训斥', '责骂', '呵斥', '怒吼',
      '咆哮', '嘶吼', '大喊', '叫喊', '尖叫', '呼喊', '呼唤',
      '呼唤道', '喃喃', '嘟囔', '吩咐', '开口', '回应', '解释',
      '安慰', '催促', '警告', '威胁', '乞求', '哀求', '嘲讽',
      '讥讽', '冷哼', '嗤笑', '断然', '坚决', '恭敬'
    ];
    
    // 增强：台词提取辅助模式（不依赖角色名）
    const dialogueIndicators = [
      '说', '道', '问', '答', '喊', '叫', '斥', '骂',
      '心想', '暗道', '默念', '心中', '心底',
      '喃喃', '嘟囔', '吩咐', '开口', '回应', '解释',
      '安慰', '催促', '警告', '威胁', '乞求', '哀求', '嘲讽'
    ];
    
    const personalityKeywords = {
      '隐忍': ['咬紧牙关', '拳头攥紧', '低头', '沉默', '握拳', '紧咬'],
      '坚毅': ['目光直视', '步伐稳定', '动作果断', '挺直腰板', '坚定'],
      '不甘': ['眼神挣扎', '深呼吸', '握拳', '抬头望向', '不甘'],
      '嚣张': ['居高临下', '踢', '踩', '嗤笑', '俯视', '跋扈'],
      '沉稳': ['面色平静', '缓缓', '不慌不忙', '镇定', '沉稳'],
    };
    
    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i];
      
      let sceneName = '未分类';
      let bestScore = 0;
      for (const scene of scenes) {
        let score = 0;
        const keywords = scene.name.replace(/场景/g, '').split(/[,，、\s]+/).filter(k => k.length > 1);
        for (const kw of keywords) {
          if (para.includes(kw)) score += 1;
        }
        const sceneIndex = content.indexOf(scene.name);
        const paraIndex = content.indexOf(para);
        if (sceneIndex !== -1 && paraIndex !== -1) {
          const distance = Math.abs(paraIndex - sceneIndex);
          if (distance < 300) score += 2;
          else if (distance < 600) score += 1;
        }
        if (score > bestScore) {
          bestScore = score;
          sceneName = scene.name;
        }
      }
      
      // ========== 提取台词：方式1 - 引号内的对话 ==========
      let match;
      const dialogueRegex = new RegExp(dialoguePattern);
      while ((match = dialogueRegex.exec(para)) !== null) {
        const dialogue = match[2].trim();
        if (dialogue.length > 3 && dialogue.length < 100) {
          const characterMatch = para.match(/([\u4e00-\u9fa5]{2,4})(?:说|道|问|答|喊|叫|斥|骂)/);
          const characterName = characterMatch ? characterMatch[1] : '未知';
          
          criticalDialogues.push({
            text: dialogue,
            characterName,
            sceneName,
            paragraphIndex: i,
          });
        }
      }
      
      // ========== 提取台词：方式2 - 无引号的"角色说/道：..."或"角色：..."格式 ==========
      
      // 方式2a：处理"角色喝道/说道：对话内容"格式（支持引号包围）
      for (const verb of dialogueVerbs) {
        // 匹配带引号的格式：角色喝道："对话"
        const quotedPattern = new RegExp(`([\\u4e00-\\u9fa5]{2,4})(?:${verb})[：:]\\s*[""「『《]([\\s\\S]{5,80})['"」』》]`);
        const quotedMatch = para.match(quotedPattern);
        if (quotedMatch) {
          const characterName = quotedMatch[1];
          const dialogue = quotedMatch[2].trim();
          if (dialogue.length > 3 && dialogue.length < 100) {
            const alreadyExtracted = criticalDialogues.some(d => 
              d.text === dialogue || d.text.includes(dialogue.substring(0, 20)) || dialogue.includes(d.text.substring(0, 20))
            );
            if (!alreadyExtracted) {
              criticalDialogues.push({
                text: dialogue,
                characterName,
                sceneName,
                paragraphIndex: i,
              });
            }
          }
        }
        
        // 匹配无引号的格式：角色喝道：对话内容
        const unquotedPattern = new RegExp(`([\\u4e00-\\u9fa5]{2,4})(?:${verb})[：:]\\s*([\\s\\S]{5,80})(?:[。！？]|$)`);
        const unquotedMatch = para.match(unquotedPattern);
        if (unquotedMatch) {
          const characterName = unquotedMatch[1];
          const dialogue = unquotedMatch[2].trim().replace(/^[""「『《]|['"」』》]$/g, '');
          if (dialogue.length > 3 && dialogue.length < 100) {
            const alreadyExtracted = criticalDialogues.some(d => 
              d.text === dialogue || d.text.includes(dialogue.substring(0, 20)) || dialogue.includes(d.text.substring(0, 20))
            );
            if (!alreadyExtracted) {
              criticalDialogues.push({
                text: dialogue,
                characterName,
                sceneName,
                paragraphIndex: i,
              });
            }
          }
        }
      }
      
      // 方式2b：处理"角色名：对话内容"格式（无说/道等动词）
      const directPattern = /([\u4e00-\u9fa5]{2,4})[：:]\s*[""「『《]([\s\S]{5,80})['"」』》]/g;
      let directMatch;
      while ((directMatch = directPattern.exec(para)) !== null) {
        const characterName = directMatch[1];
        const dialogue = directMatch[2].trim();
        if (dialogue.length > 3 && dialogue.length < 100) {
          // 排除不是角色名的常见词
          const excludedNames = ['场景', '场景', '第一', '第二', '第三', '第四', '第五'];
          if (!excludedNames.includes(characterName)) {
            const alreadyExtracted = criticalDialogues.some(d => 
              d.text === dialogue || d.text.includes(dialogue.substring(0, 20)) || dialogue.includes(d.text.substring(0, 20))
            );
            if (!alreadyExtracted) {
              criticalDialogues.push({
                text: dialogue,
                characterName,
                sceneName,
                paragraphIndex: i,
              });
            }
          }
        }
      }
      
      // ========== 提取台词：方式3 - 辅助模式：段落包含台词动词+引号 ==========
      if (criticalDialogues.length < 15) {
        // 检测段落中是否包含台词指示词和引号
        const hasDialogueIndicator = dialogueIndicators.some(indicator => para.includes(indicator));
        const hasQuote = /[""「『《][\s\S]{5,80}['"」』》]/.test(para);
        
        if (hasDialogueIndicator && hasQuote) {
          // 提取引号中的内容作为台词
          const quotePattern = /[""「『《]([\s\S]{5,80})['"」』》]/g;
          let quoteMatch;
          while ((quoteMatch = quotePattern.exec(para)) !== null) {
            const dialogue = quoteMatch[1].trim();
            if (dialogue.length > 3 && dialogue.length < 100 && !dialogue.includes('场景') && !dialogue.includes('第一')) {
              // 尝试在引号前后找到角色名
              const charContext = para.substring(Math.max(0, quoteMatch.index - 10), quoteMatch.index);
              const charMatch = charContext.match(/([\u4e00-\u9fa5]{2,4})(?:的|了|在|被|向|从|对|却|又|也|就|才|已经|说|道|问|答|喊|叫)/);
              const characterName = charMatch ? charMatch[1] : '未知';
              
              const alreadyExtracted = criticalDialogues.some(d => 
                d.text === dialogue || d.text.includes(dialogue.substring(0, 15)) || dialogue.includes(d.text.substring(0, 15))
              );
              if (!alreadyExtracted) {
                criticalDialogues.push({
                  text: dialogue,
                  characterName,
                  sceneName,
                  paragraphIndex: i,
                });
                break; // 每个段落最多提取一个台词
              }
            }
          }
        }
      }
      
      // ========== 提取内心独白 ==========
      if (monologuePattern.test(para)) {
        const characterMatch = para.match(/([\u4e00-\u9fa5]{2,4})(?:心想|暗道|默念|心中)/);
        const characterName = characterMatch ? characterMatch[1] : '未知';
        
        criticalInnerMonologues.push({
          text: para.substring(0, 100),
          characterName,
          sceneName,
          paragraphIndex: i,
        });
      }
      
      if (propPattern.test(para)) {
        const propMatch = para.match(/(\w+?(?:玉佩|武器|法宝|丹药|书信|遗物|宝物))/);
        if (propMatch) {
          criticalProps.push({
            name: propMatch[1],
            description: para.substring(0, 80),
            significance: this.extractPropSignificance(para),
            sceneName,
          });
        }
      }
      
      if (contrastPattern.test(para) && para.length > 30) {
        criticalContrasts.push({
          description: para.substring(0, 100),
          sceneA: sceneName,
          sceneB: '未知',
        });
      }
    }
    
    const characterProfiles = this.analyzeCharacterProfiles(content, scenes, personalityKeywords);
    
    return {
      criticalDialogues: criticalDialogues.slice(0, 15),
      criticalProps: criticalProps.slice(0, 8),
      criticalContrasts: criticalContrasts.slice(0, 5),
      criticalInnerMonologues: criticalInnerMonologues.slice(0, 8),
      characterProfiles,
    };
  }
  
  private extractPropSignificance(paragraph: string): string {
    if (paragraph.includes('遗物')) return '重要遗物';
    if (paragraph.includes('唯一')) return '唯一所有物';
    if (paragraph.includes('秘密')) return '隐藏秘密';
    if (paragraph.includes('传承')) return '传承之物';
    if (paragraph.includes('礼物')) return '赠礼';
    return '未知';
  }
  
  private analyzeCharacterProfiles(
    content: string,
    scenes: Array<{ name: string }>,
    personalityKeywords: Record<string, string[]>
  ): KeyNarrativeElements['characterProfiles'] {
    const profiles: KeyNarrativeElements['characterProfiles'] = [];
    
    const characterActions = new Map<string, Map<string, string[]>>();
    const paragraphs = content.split(/\n+/);
    
    for (const para of paragraphs) {
      for (const [trait, visualCues] of Object.entries(personalityKeywords)) {
        for (const cue of visualCues) {
          if (para.includes(cue)) {
            const charMatch = para.match(/([\u4e00-\u9fa5]{2,4})(?:的|在|被|向|从|对|却|又|也|就|才|已经)/);
            if (charMatch) {
              const charName = charMatch[1];
              if (!characterActions.has(charName)) {
                characterActions.set(charName, new Map());
              }
              const charTraits = characterActions.get(charName)!;
              if (!charTraits.has(trait)) {
                charTraits.set(trait, []);
              }
              charTraits.get(trait)!.push(cue);
            }
          }
        }
      }
    }
    
    for (const [charName, traits] of characterActions.entries()) {
      const personalityTraits = Array.from(traits.entries()).map(([trait, cues]) => ({
        trait,
        visualCues: [...new Set(cues)],
      }));
      
      if (personalityTraits.length > 0) {
        profiles.push({
          name: charName,
          personalityTraits,
          role: this.determineCharacterRole(charName, content),
        });
      }
    }
    
    return profiles.slice(0, 6);
  }
  
  private determineCharacterRole(
    characterName: string,
    content: string
  ): 'protagonist' | 'antagonist' | 'supporting' {
    const paragraphs = content.split(/\n+/);
    let appearCount = 0;
    for (const para of paragraphs) {
      if (para.includes(characterName)) appearCount++;
    }
    
    const totalParagraphs = paragraphs.length;
    
    if (appearCount >= totalParagraphs * 0.4) return 'protagonist';
    
    const conflictKeywords = ['欺凌', '欺压', '欺凌', '压迫', '欺凌', '嘲讽', '辱骂'];
    const hasConflict = conflictKeywords.some(kw => {
      const idx = content.indexOf(kw);
      if (idx === -1) return false;
      const context = content.substring(Math.max(0, idx - 50), idx + 50);
      return context.includes(characterName);
    });
    if (hasConflict) return 'antagonist';
    
    return 'supporting';
  }
  
  toPromptFormat(elements: KeyNarrativeElements): string {
    let prompt = '';
    
    if (elements.criticalDialogues.length > 0) {
      prompt += '\n\n【必须包含的台词】（以下台词必须在分镜中出现，缺失将被判定为不合格）\n';
      for (const d of elements.criticalDialogues.slice(0, 10)) {
        prompt += `  - "${d.text}" — ${d.characterName} 在 [${d.sceneName}] 中说（段落${d.paragraphIndex}）\n`;
      }
    }
    
    if (elements.criticalProps.length > 0) {
      prompt += '\n\n【必须包含的道具】（以下道具必须在分镜中展示其来历/意义）\n';
      for (const p of elements.criticalProps.slice(0, 5)) {
        prompt += `  - ${p.name}（${p.significance}） — ${p.description.substring(0, 50)}...\n`;
      }
    }
    
    if (elements.criticalContrasts.length > 0) {
      prompt += '\n\n【必须体现的对比】（以下环境/情境对比必须在分镜中体现）\n';
      for (const c of elements.criticalContrasts.slice(0, 3)) {
        prompt += `  - ${c.description.substring(0, 80)}...\n`;
      }
    }
    
    if (elements.criticalInnerMonologues.length > 0) {
      prompt += '\n\n【必须包含的内心独白】（以下独白必须在分镜中出现）\n';
      for (const m of elements.criticalInnerMonologues.slice(0, 5)) {
        prompt += `  - "${m.text.substring(0, 60)}..." — ${m.characterName} 的内心活动\n`;
      }
    }
    
    if (elements.characterProfiles && elements.characterProfiles.length > 0) {
      prompt += '\n\n【角色塑造指南】（通过画面动作塑造角色，而非仅靠台词）\n';
      
      for (const profile of elements.characterProfiles) {
        const roleLabel = this.translateRole(profile.role);
        prompt += `\n  ${profile.name}（${roleLabel}）：\n`;
        
        if (profile.personalityTraits.length > 0) {
          prompt += '  - 性格特征：';
          prompt += profile.personalityTraits.map(t => t.trait).join('、');
          prompt += '\n';
          
          prompt += '  - 画面表现建议：\n';
          for (const trait of profile.personalityTraits.slice(0, 3)) {
            prompt += `    * ${trait.trait}：${trait.visualCues.join('、')}\n`;
          }
        }
      }
    }
    
    return prompt;
  }
  
  private translateRole(role: string): string {
    switch (role) {
      case 'protagonist': return '主角';
      case 'antagonist': return '反派';
      case 'supporting': return '配角';
      default: return '角色';
    }
  }
}
