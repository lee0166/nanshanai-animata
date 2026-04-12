import { DerivedCreativeInfo } from '../types';
import { getCompositionPrompt } from './prompt';

/**
 * 创作意图自动推导器
 * 根据作品类型和宽高比自动推导平台、节奏、分镜密度等信息
 */
export class CreativeIntentDeriver {
  /**
   * 自动推导
   * @param filmStyle 作品类型
   * @param aspectRatio 宽高比
   * @returns 推导出的创作信息
   */
  static derive(filmStyle: string, aspectRatio: string = '9:16'): DerivedCreativeInfo {
    // 基础信息映射表
    const baseInfoMap: Record<string, Omit<DerivedCreativeInfo, 'compositionPrompt'>> = {
      'short-drama': {
        targetPlatform: 'douyin',
        pacing: 'fast',
        shotDensity: 30,
        averageShotDuration: 2.5,
        hookWithin: 3,
        twistEvery: 30,
      },
      film: {
        targetPlatform: 'theatrical',
        pacing: 'slow',
        shotDensity: 100,
        averageShotDuration: 6,
        hookWithin: 30,
        twistEvery: 120,
      },
      documentary: {
        targetPlatform: 'bilibili',
        pacing: 'slow',
        shotDensity: 50,
        averageShotDuration: 8,
        hookWithin: 15,
        twistEvery: 300,
      },
      advertisement: {
        targetPlatform: 'all',
        pacing: 'very-fast',
        shotDensity: 15,
        averageShotDuration: 1.5,
        hookWithin: 1,
        twistEvery: 5,
      },
      custom: {
        targetPlatform: 'douyin',
        pacing: 'normal',
        shotDensity: 40,
        averageShotDuration: 4,
        hookWithin: 5,
        twistEvery: 60,
      },
    };

    // 获取基础信息
    const baseInfo = baseInfoMap[filmStyle] || baseInfoMap['custom'];

    // 获取构图提示
    const compositionPrompt = getCompositionPrompt(aspectRatio, 'zh');

    return {
      ...baseInfo,
      compositionPrompt,
    };
  }

  /**
   * 获取作品类型显示名称
   * @param filmStyle 作品类型
   * @returns 显示名称
   */
  static getFilmStyleDisplayName(filmStyle: string): string {
    const displayMap: Record<string, string> = {
      'short-drama': '短剧（快节奏，多集，适合抖音/快手）',
      film: '电影（慢节奏，单集，适合院线/流媒体）',
      documentary: '纪录片（慢节奏，单集/多集，适合 B 站）',
      advertisement: '创意广告（超快节奏，1-3 集，全平台）',
      custom: '自定义',
    };
    return displayMap[filmStyle] || '自定义';
  }
}
