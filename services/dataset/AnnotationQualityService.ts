/**
 * 标注标准质量评估服务
 *
 * 基于标注标准v1.0的质量评估规则
 * 用于检查分镜数据是否符合专业标注标准
 *
 * @module services/dataset/AnnotationQualityService
 * @version 1.0.0
 */

// 使用灵活的Shot类型
type FlexibleShot = {
  id: string;
  shotType?: string;
  cameraAngle?: string;
  cameraMovement?: string;
  duration?: number;
  visualDescription?: any;
  description?: any;
  dialogue?: string;
  sceneId?: string;
  [key: string]: any;
};

/**
 * 景别术语对照表
 */
export const SHOT_TYPES = ['大远景', '远景', '全景', '中景', '近景', '特写', '大特写'];

/**
 * 拍摄角度术语对照表
 */
export const CAMERA_ANGLES = ['平视', '俯拍', '仰拍', '倾斜', '顶拍'];

/**
 * 镜头运动术语对照表
 */
export const CAMERA_MOVEMENTS = ['静止', '推', '拉', '摇', '移', '跟', '变焦推', '变焦拉'];

/**
 * 质量问题类型
 */
export type AnnotationQualityIssueType =
  | 'shot_number_format'
  | 'shot_number_continuity'
  | 'shot_type'
  | 'camera_angle'
  | 'camera_movement'
  | 'visual_description_length'
  | 'duration_range'
  | 'dialogue_format'
  | 'music_sound'
  | 'shot_type_jump'
  | 'completeness';

/**
 * 质量问题严重程度
 */
export type AnnotationQualitySeverity = 'error' | 'warning' | 'info';

/**
 * 质量问题接口
 */
export interface AnnotationQualityIssue {
  type: AnnotationQualityIssueType;
  severity: AnnotationQualitySeverity;
  shotIndex?: number;
  shotId?: string;
  message: string;
  context?: string;
  suggestion: string;
}

/**
 * 维度评分接口
 */
export interface AnnotationDimensionScore {
  name: string;
  score: number; // 0-100
  weight: number; // 0-1
  issues: AnnotationQualityIssue[];
}

/**
 * 完整质量报告接口（重命名避免与组件冲突）
 */
export interface AnnotationQualityReportType {
  overallScore: number; // 0-100
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  dimensions: AnnotationDimensionScore[];
  totalIssues: number;
  criticalIssues: number;
  warningIssues: number;
  infoIssues: number;
  statistics: {
    totalShots: number;
    validShotNumbers: number;
    validShotTypes: number;
    validCameraAngles: number;
    validCameraMovements: number;
    avgDescriptionLength: number;
    avgDuration: number;
  };
}

/**
 * 标注标准质量评估服务
 */
export class AnnotationQualityService {
  /**
   * 检查分镜号格式（SXXX-YY）
   */
  private validateShotNumberFormat(
    shotId: string,
    shotIndex: number
  ): AnnotationQualityIssue | null {
    const pattern = /^S\d{3}-\d{2}$/;
    if (!pattern.test(shotId)) {
      return {
        type: 'shot_number_format',
        severity: 'error',
        shotIndex,
        shotId,
        message: `分镜号格式不正确: ${shotId}`,
        context: `正确格式应为: SXXX-YY（例如: S001-01）`,
        suggestion: '请修改分镜号为标准格式',
      };
    }
    return null;
  }

  /**
   * 检查分镜号连续性
   */
  private validateShotNumberContinuity(shots: FlexibleShot[]): AnnotationQualityIssue[] {
    const issues: AnnotationQualityIssue[] = [];

    // 按场景分组
    const shotsByScene: Record<string, Array<FlexibleShot & { _index: number }>> = {};
    shots.forEach((shot, index) => {
      const sceneId = shot.sceneId || 'unknown';
      if (!shotsByScene[sceneId]) {
        shotsByScene[sceneId] = [];
      }
      shotsByScene[sceneId].push({ ...shot, _index: index });
    });

    // 检查每个场景内的分镜连续性
    Object.entries(shotsByScene).forEach(([sceneId, sceneShots]) => {
      const sortedShots = [...sceneShots].sort((a, b) => {
        const aNum = parseInt(a.id.split('-')[1] || '0');
        const bNum = parseInt(b.id.split('-')[1] || '0');
        return aNum - bNum;
      });

      let expectedNum = 1;
      sortedShots.forEach(shot => {
        const match = shot.id.match(/^S\d{3}-(\d{2})$/);
        if (match) {
          const actualNum = parseInt(match[1]);
          if (actualNum !== expectedNum) {
            issues.push({
              type: 'shot_number_continuity',
              severity: 'warning',
              shotIndex: (shot as any)._index,
              shotId: shot.id,
              message: `分镜号不连续: ${shot.id}`,
              context: `期望: SXXX-${expectedNum.toString().padStart(2, '0')}, 实际: ${shot.id}`,
              suggestion: '请调整分镜号使其连续',
            });
          }
          expectedNum = actualNum + 1;
        }
      });
    });

    return issues;
  }

  /**
   * 检查景别
   */
  private validateShotType(shot: FlexibleShot, shotIndex: number): AnnotationQualityIssue | null {
    const shotType = shot.shotType || shot.type;
    if (!shotType) {
      return {
        type: 'shot_type',
        severity: 'error',
        shotIndex,
        shotId: shot.id,
        message: '缺少景别信息',
        suggestion: '请添加景别信息',
      };
    }

    if (!SHOT_TYPES.includes(shotType)) {
      return {
        type: 'shot_type',
        severity: 'warning',
        shotIndex,
        shotId: shot.id,
        message: `景别术语不规范: ${shotType}`,
        context: `标准术语: ${SHOT_TYPES.join('、')}`,
        suggestion: '请使用标准景别术语',
      };
    }

    return null;
  }

  /**
   * 检查拍摄角度
   */
  private validateCameraAngle(
    shot: FlexibleShot,
    shotIndex: number
  ): AnnotationQualityIssue | null {
    const angle = shot.cameraAngle;
    if (!angle) {
      return null; // 拍摄角度是可选的
    }

    if (!CAMERA_ANGLES.includes(angle)) {
      return {
        type: 'camera_angle',
        severity: 'warning',
        shotIndex,
        shotId: shot.id,
        message: `拍摄角度术语不规范: ${angle}`,
        context: `标准术语: ${CAMERA_ANGLES.join('、')}`,
        suggestion: '请使用标准拍摄角度术语',
      };
    }

    return null;
  }

  /**
   * 检查镜头运动
   */
  private validateCameraMovement(
    shot: FlexibleShot,
    shotIndex: number
  ): AnnotationQualityIssue | null {
    const movement = shot.cameraMovement;
    if (!movement) {
      return null; // 镜头运动是可选的
    }

    if (!CAMERA_MOVEMENTS.includes(movement)) {
      return {
        type: 'camera_movement',
        severity: 'warning',
        shotIndex,
        shotId: shot.id,
        message: `镜头运动术语不规范: ${movement}`,
        context: `标准术语: ${CAMERA_MOVEMENTS.join('、')}`,
        suggestion: '请使用标准镜头运动术语',
      };
    }

    return null;
  }

  /**
   * 检查画面描述长度（100-200字）
   */
  private validateVisualDescription(
    shot: FlexibleShot,
    shotIndex: number
  ): AnnotationQualityIssue | null {
    const getDescriptionLength = (desc: any): number => {
      if (typeof desc === 'string') return desc.length;
      return 0;
    };

    const description = shot.visualDescription || shot.description || '';
    const length = getDescriptionLength(description);

    if (length === 0) {
      return {
        type: 'visual_description_length',
        severity: 'error',
        shotIndex,
        shotId: shot.id,
        message: '缺少画面描述',
        suggestion: '请添加画面描述（建议100-200字）',
      };
    }

    if (length < 50) {
      return {
        type: 'visual_description_length',
        severity: 'warning',
        shotIndex,
        shotId: shot.id,
        message: `画面描述过短: ${length}字`,
        context: '建议至少50字',
        suggestion: '请补充更多画面细节描述',
      };
    }

    if (length > 300) {
      return {
        type: 'visual_description_length',
        severity: 'info',
        shotIndex,
        shotId: shot.id,
        message: `画面描述过长: ${length}字`,
        context: '建议不超过300字',
        suggestion: '请精简画面描述，保持在100-200字为宜',
      };
    }

    return null;
  }

  /**
   * 检查时长范围（2-15秒）
   */
  private validateDuration(shot: FlexibleShot, shotIndex: number): AnnotationQualityIssue | null {
    const duration = shot.duration;

    if (duration === undefined || duration === null) {
      return {
        type: 'duration_range',
        severity: 'warning',
        shotIndex,
        shotId: shot.id,
        message: '缺少时长信息',
        suggestion: '请添加时长信息（建议2-15秒）',
      };
    }

    if (duration < 2) {
      return {
        type: 'duration_range',
        severity: 'warning',
        shotIndex,
        shotId: shot.id,
        message: `时长短于建议值: ${duration}秒`,
        context: '建议最短2秒',
        suggestion: '请适当增加时长',
      };
    }

    if (duration > 15) {
      return {
        type: 'duration_range',
        severity: 'warning',
        shotIndex,
        shotId: shot.id,
        message: `时长长于建议值: ${duration}秒`,
        context: '建议最长15秒',
        suggestion: '请考虑拆分这个分镜',
      };
    }

    return null;
  }

  /**
   * 检查对话格式
   */
  private validateDialogueFormat(
    shot: FlexibleShot,
    shotIndex: number
  ): AnnotationQualityIssue | null {
    const dialogue = shot.dialogue;
    if (!dialogue || dialogue.trim() === '' || dialogue === '无') {
      return null; // 对话是可选的
    }

    // 检查格式: [角色名]：对话内容
    const pattern = /^\[.+?\]：.+/;
    if (!pattern.test(dialogue)) {
      return {
        type: 'dialogue_format',
        severity: 'info',
        shotIndex,
        shotId: shot.id,
        message: '对话格式不规范',
        context: `当前: ${dialogue}`,
        suggestion: '建议使用格式: [角色名]：对话内容',
      };
    }

    return null;
  }

  /**
   * 检查景别跳度
   */
  private validateShotTypeJump(shots: FlexibleShot[]): AnnotationQualityIssue[] {
    const issues: AnnotationQualityIssue[] = [];

    for (let i = 1; i < shots.length; i++) {
      const prevShot = shots[i - 1];
      const currShot = shots[i];

      const prevTypeIndex = SHOT_TYPES.indexOf(prevShot.shotType || prevShot.type || '');
      const currTypeIndex = SHOT_TYPES.indexOf(currShot.shotType || currShot.type || '');

      if (prevTypeIndex !== -1 && currTypeIndex !== -1) {
        const jump = Math.abs(prevTypeIndex - currTypeIndex);
        if (jump >= 3) {
          issues.push({
            type: 'shot_type_jump',
            severity: 'warning',
            shotIndex: i,
            shotId: currShot.id,
            message: `景别跳度过大: ${prevShot.shotType || prevShot.type} → ${currShot.shotType || currShot.type}`,
            context: `跳度: ${jump}级`,
            suggestion: '建议添加过渡分镜，避免景别跳度过大',
          });
        }
      }
    }

    return issues;
  }

  /**
   * 计算评级
   */
  private calculateGrade(score: number): 'S' | 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 95) return 'S';
    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    if (score >= 55) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }

  /**
   * 执行完整质量评估
   */
  evaluate(
    shots: FlexibleShot[],
    characters: any[] = [],
    scenes: any[] = [],
    items: any[] = []
  ): AnnotationQualityReportType {
    const allIssues: AnnotationQualityIssue[] = [];
    const descriptionLengths: number[] = [];
    const durations: number[] = [];

    const getDescriptionLength = (desc: any): number => {
      if (typeof desc === 'string') return desc.length;
      return 0;
    };

    let validShotNumbers = 0;
    let validShotTypes = 0;
    let validCameraAngles = 0;
    let validCameraMovements = 0;

    // 检查每个分镜
    shots.forEach((shot, index) => {
      // 分镜号格式
      const shotNumberIssue = this.validateShotNumberFormat(shot.id, index);
      if (shotNumberIssue) {
        allIssues.push(shotNumberIssue);
      } else {
        validShotNumbers++;
      }

      // 景别
      const shotTypeIssue = this.validateShotType(shot, index);
      if (shotTypeIssue) {
        allIssues.push(shotTypeIssue);
      } else {
        validShotTypes++;
      }

      // 拍摄角度
      const cameraAngleIssue = this.validateCameraAngle(shot, index);
      if (cameraAngleIssue) {
        allIssues.push(cameraAngleIssue);
      } else if (shot.cameraAngle) {
        validCameraAngles++;
      }

      // 镜头运动
      const cameraMovementIssue = this.validateCameraMovement(shot, index);
      if (cameraMovementIssue) {
        allIssues.push(cameraMovementIssue);
      } else if (shot.cameraMovement) {
        validCameraMovements++;
      }

      // 画面描述
      const descriptionIssue = this.validateVisualDescription(shot, index);
      if (descriptionIssue) {
        allIssues.push(descriptionIssue);
      }
      const descLength = getDescriptionLength(shot.visualDescription || shot.description || '');
      descriptionLengths.push(descLength);

      // 时长
      const durationIssue = this.validateDuration(shot, index);
      if (durationIssue) {
        allIssues.push(durationIssue);
      }
      if (shot.duration !== undefined && shot.duration !== null) {
        durations.push(shot.duration);
      }

      // 对话格式
      const dialogueIssue = this.validateDialogueFormat(shot, index);
      if (dialogueIssue) {
        allIssues.push(dialogueIssue);
      }
    });

    // 分镜号连续性
    const continuityIssues = this.validateShotNumberContinuity(shots);
    allIssues.push(...continuityIssues);

    // 景别跳度
    const jumpIssues = this.validateShotTypeJump(shots);
    allIssues.push(...jumpIssues);

    // 按维度分组
    const dimensionGroups: Record<string, AnnotationQualityIssue[]> = {
      格式规范: allIssues.filter(
        i => i.type === 'shot_number_format' || i.type === 'shot_number_continuity'
      ),
      专业术语: allIssues.filter(
        i => i.type === 'shot_type' || i.type === 'camera_angle' || i.type === 'camera_movement'
      ),
      画面质量: allIssues.filter(
        i => i.type === 'visual_description_length' || i.type === 'shot_type_jump'
      ),
      时长控制: allIssues.filter(i => i.type === 'duration_range'),
      对话格式: allIssues.filter(i => i.type === 'dialogue_format'),
    };

    // 计算各维度评分
    const dimensions: AnnotationDimensionScore[] = [];
    const dimensionWeights: Record<string, number> = {
      格式规范: 0.25,
      专业术语: 0.2,
      画面质量: 0.25,
      时长控制: 0.15,
      对话格式: 0.15,
    };

    Object.entries(dimensionGroups).forEach(([name, issues]) => {
      const errorCount = issues.filter(i => i.severity === 'error').length;
      const warningCount = issues.filter(i => i.severity === 'warning').length;

      let score = 100;
      score -= errorCount * 15;
      score -= warningCount * 5;
      score = Math.max(0, Math.min(100, score));

      dimensions.push({
        name,
        score,
        weight: dimensionWeights[name] || 0.2,
        issues,
      });
    });

    // 计算总分
    const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
    const overallScore = Math.round(
      dimensions.reduce((sum, d) => sum + d.score * d.weight, 0) / totalWeight
    );

    // 统计
    const criticalIssues = allIssues.filter(i => i.severity === 'error').length;
    const warningIssues = allIssues.filter(i => i.severity === 'warning').length;
    const infoIssues = allIssues.filter(i => i.severity === 'info').length;

    return {
      overallScore,
      grade: this.calculateGrade(overallScore),
      dimensions,
      totalIssues: allIssues.length,
      criticalIssues,
      warningIssues,
      infoIssues,
      statistics: {
        totalShots: shots.length,
        validShotNumbers,
        validShotTypes,
        validCameraAngles,
        validCameraMovements,
        avgDescriptionLength:
          descriptionLengths.length > 0
            ? Math.round(descriptionLengths.reduce((a, b) => a + b, 0) / descriptionLengths.length)
            : 0,
        avgDuration:
          durations.length > 0
            ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
            : 0,
      },
    };
  }
}

export default AnnotationQualityService;
