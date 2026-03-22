/**
 * 分镜编号生成工具
 * 用于生成专业的场景-镜头编号（如 SC01-01）
 */

import { Shot } from '../../types';

/**
 * 从场景名称提取场景编号
 * @param sceneName 场景名称
 * @returns 场景编号（两位数格式，如 01）
 */
export function extractSceneNumber(sceneName: string): string {
  const match = sceneName.match(/场景(\d+)/);
  const sceneNum = match ? parseInt(match[1]) : 1;
  return sceneNum.toString().padStart(2, '0');
}

/**
 * 生成专业的分镜编号
 * @param sceneName 场景名称
 * @param shotSequence 镜头序号
 * @returns 专业分镜编号（如 SC01-01）
 */
export function generateShotNumber(sceneName: string, shotSequence: number): string {
  const sceneNum = extractSceneNumber(sceneName);
  const shotNum = shotSequence.toString().padStart(2, '0');
  return `SC${sceneNum}-${shotNum}`;
}

/**
 * 为分镜列表生成专业编号
 * @param shots 分镜列表
 * @returns 带专业编号的分镜列表
 */
export function generateShotNumbers(shots: Shot[]): Shot[] {
  // 按场景分组
  const shotsByScene: Record<string, Shot[]> = {};

  shots.forEach(shot => {
    const sceneName = shot.sceneName || '未分类场景';
    if (!shotsByScene[sceneName]) {
      shotsByScene[sceneName] = [];
    }
    shotsByScene[sceneName].push(shot);
  });

  // 为每个场景的分镜生成编号
  return shots.map(shot => {
    if (shot.shotNumber) {
      return shot; // 已有编号的分镜保持不变
    }

    const sceneName = shot.sceneName || '未分类场景';
    const sceneShots = shotsByScene[sceneName].sort((a, b) => a.sequence - b.sequence);
    const shotIndex = sceneShots.findIndex(s => s.id === shot.id);

    if (shotIndex !== -1) {
      const shotNumber = generateShotNumber(sceneName, shot.sequence);
      return { ...shot, shotNumber };
    }

    return shot;
  });
}

/**
 * 为单个分镜生成专业编号
 * @param shot 分镜
 * @param allShots 所有分镜（用于计算序号）
 * @returns 带专业编号的分镜
 */
export function generateShotNumberForSingle(shot: Shot, allShots: Shot[]): Shot {
  if (shot.shotNumber) {
    return shot; // 已有编号的分镜保持不变
  }

  const sceneName = shot.sceneName || '未分类场景';
  const sceneShots = allShots.filter(s => s.sceneName === sceneName);
  const shotNumber = generateShotNumber(sceneName, shot.sequence);

  return { ...shot, shotNumber };
}
