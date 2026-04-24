import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Shot, ShotType, CameraMovement } from '../types';

export interface ExportFieldOption {
  key: string;
  label: string;
  checked: boolean;
}

export interface ExportConfig {
  [key: string]: boolean;
}

const shotTypeMap: Record<ShotType, string> = {
  extreme_long: '大远景',
  long: '远景',
  full: '全景',
  medium: '中景',
  close_up: '近景',
  extreme_close_up: '特写',
};

const cameraMovementMap: Record<CameraMovement, string> = {
  static: '固定',
  pan: '摇镜头',
  tilt: '俯仰',
  dolly: '推拉',
  truck: '横移',
  crane: '升降',
  handheld: '手持',
  steadicam: '稳定器',
  zoom: '变焦',
  arc: '弧线',
  follow: '跟随',
};

export function getDefaultExportFields(): ExportFieldOption[][] {
  return [
    [
      { key: 'shotNumber', label: '序号', checked: true },
      { key: 'layer', label: '类型', checked: true },
      { key: 'sceneName', label: '场景', checked: true },
      { key: 'shotType', label: '景别', checked: true },
      { key: 'cameraMovement', label: '运镜', checked: true },
      { key: 'description', label: '画面描述', checked: true },
      { key: 'characters', label: '角色', checked: true },
      { key: 'duration', label: '时长(秒)', checked: true },
    ],
    [
      { key: 'dialogue', label: '台词', checked: true },
      { key: 'sound', label: '音效', checked: true },
      { key: 'music', label: '音乐', checked: true },
    ],
    [
      { key: 'composition', label: '构图', checked: false },
      { key: 'lighting', label: '光影', checked: false },
      { key: 'colorPalette', label: '色调', checked: false },
      { key: 'characterPositions', label: '角色位置/动作/表情', checked: false },
    ],
    [
      { key: 'cameraAngle', label: '拍摄角度', checked: false },
      { key: 'contentType', label: '内容类型', checked: false },
      { key: 'style', label: '影视风格', checked: false },
    ],
    [
      { key: 'mood', label: '情绪氛围', checked: false },
      { key: 'narrativeNode', label: '叙事节点', checked: false },
      { key: 'shotRelation', label: '前后镜头关联', checked: false },
    ],
    [
      { key: 'characterIds', label: '关联角色ID', checked: false },
      { key: 'sceneId', label: '关联场景ID', checked: false },
      { key: 'propIds', label: '关联道具ID', checked: false },
    ],
    [
      { key: 'analysisType', label: '分析类型', checked: false },
      { key: 'analysisConfidence', label: '分析置信度', checked: false },
      { key: 'analysisKeyframeCount', label: '建议关键帧数', checked: false },
    ],
    [
      { key: 'status', label: '状态', checked: false },
      { key: 'keyframeCount', label: '关键帧数', checked: false },
      { key: 'mappedFragmentId', label: '关联视频片段', checked: false },
      { key: 'generatedImagesCount', label: '已生成图片数', checked: false },
      { key: 'generatedVideo', label: '已生成视频', checked: false },
      { key: 'generatedAudio', label: '已生成音频', checked: false },
    ],
  ];
}

export const exportFieldGroups = [
  { title: '基础信息', groupIndex: 0 },
  { title: '音频', groupIndex: 1 },
  { title: '视觉描述', groupIndex: 2 },
  { title: '拍摄参数', groupIndex: 3 },
  { title: '叙事与关联', groupIndex: 4 },
  { title: '资产关联', groupIndex: 5 },
  { title: '分镜分析', groupIndex: 6 },
  { title: '生成状态', groupIndex: 7 },
];

function getFieldValue(shot: Shot, fieldKey: string): string | number {
  switch (fieldKey) {
    case 'shotNumber':
      return shot.shotNumber || `${shot.sequence}`;
    case 'layer':
      return shot.layer === 'key' ? '关键帧' : '可选帧';
    case 'sceneName':
      return shot.sceneName || '';
    case 'shotType':
      return shotTypeMap[shot.shotType] || shot.shotType;
    case 'cameraMovement':
      return cameraMovementMap[shot.cameraMovement] || shot.cameraMovement;
    case 'description':
      return shot.description || '';
    case 'characters':
      return shot.characters?.join(', ') || '';
    case 'duration':
      return shot.duration || 0;
    case 'dialogue':
      return shot.dialogue || '';
    case 'sound':
      return shot.sound || '';
    case 'music':
      return shot.music || '';
    case 'composition':
      return shot.visualDescription?.composition || '';
    case 'lighting':
      return shot.visualDescription?.lighting || '';
    case 'colorPalette':
      return shot.visualDescription?.colorPalette || '';
    case 'characterPositions': {
      if (!shot.visualDescription?.characterPositions || shot.visualDescription.characterPositions.length === 0) {
        return '';
      }
      return shot.visualDescription.characterPositions
        .map(p => `${p.characterId}: 位置=${p.position}, 动作=${p.action}, 表情=${p.expression}`)
        .join('; ');
    }
    case 'cameraAngle':
      return shot.cameraAngle || '';
    case 'contentType':
      return shot.contentType || shot.type || '';
    case 'style':
      return shot.style || '';
    case 'mood':
      return shot.mood || '';
    case 'narrativeNode':
      return shot.narrativeNode || '';
    case 'shotRelation': {
      const parts = [];
      if (shot.preShotId) parts.push(`前置: ${shot.preShotId}`);
      if (shot.nextShotId) parts.push(`后续: ${shot.nextShotId}`);
      return parts.join(', ');
    }
    case 'characterIds':
      return shot.assets?.characterIds?.join(', ') || '';
    case 'sceneId':
      return shot.assets?.sceneId || '';
    case 'propIds':
      return shot.assets?.propIds?.join(', ') || '';
    case 'analysisType':
      return shot.analysis?.type || '';
    case 'analysisConfidence':
      return shot.analysis?.confidence ? `${(shot.analysis.confidence * 100).toFixed(1)}%` : '';
    case 'analysisKeyframeCount':
      return shot.analysis?.recommendation?.keyframeCount || 0;
    case 'status': {
      const statusMap = { pending: '待处理', generating: '生成中', completed: '已完成', failed: '失败' };
      return statusMap[shot.status] || shot.status;
    }
    case 'keyframeCount':
      return shot.keyframes?.length || 0;
    case 'mappedFragmentId':
      return shot.mappedFragmentId || '';
    case 'generatedImagesCount':
      return shot.generatedImages?.length || 0;
    case 'generatedVideo':
      return shot.generatedVideo ? '已生成' : '';
    case 'generatedAudio': {
      const parts = [];
      if (shot.generatedAudio?.dialogue) parts.push('对话音频');
      if (shot.generatedAudio?.sound) parts.push('音效');
      if (shot.generatedAudio?.music) parts.push('音乐');
      return parts.join(', ');
    }
    default:
      return '';
  }
}

function getBorder(): Partial<ExcelJS.Borders> {
  return {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };
}

function applyRowStyle(
  row: ExcelJS.Row,
  colCount: number,
  isHeader: boolean,
  isStriped: boolean
) {
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.border = getBorder();

    if (isHeader) {
      cell.font = {
        size: 12,
        bold: true,
        color: { argb: 'FFFFFFFF' },
        name: 'Microsoft YaHei',
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
    } else {
      cell.font = {
        size: 11,
        name: 'Microsoft YaHei',
      };
      if (isStriped) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD9E2F3' },
        };
      }
    }

    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };
  }
}

function computeColumnWidths(
  worksheet: ExcelJS.Worksheet,
  headers: string[],
  colCount: number
): number[] {
  const widths = headers.map(h => h.length);

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      const val = cell.value?.toString() || '';
      widths[c - 1] = Math.max(widths[c - 1], val.length);
    }
  });

  return widths.map(w => {
    const width = w * 2.8 + 6;
    return Math.max(Math.min(width, 80), 14);
  });
}

export async function exportShotsToExcel(
  shots: Shot[],
  selectedFields: string[],
  scriptName?: string
): Promise<void> {
  if (shots.length === 0) {
    alert('没有可导出的分镜数据');
    return;
  }

  const headers = selectedFields.map(field => {
    const allFields = getDefaultExportFields().flat();
    const found = allFields.find(f => f.key === field);
    return found ? found.label : field;
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NSAnimata';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('分镜表', {
    properties: { defaultRowHeight: 20 },
  });

  worksheet.addRow(headers);

  shots.forEach(shot => {
    const row = selectedFields.map(field => getFieldValue(shot, field));
    worksheet.addRow(row);
  });

  const colCount = headers.length;

  const headerRow = worksheet.getRow(1);
  headerRow.height = 32;
  applyRowStyle(headerRow, colCount, true, false);

  for (let rowIdx = 2; rowIdx <= worksheet.rowCount; rowIdx++) {
    const currentRow = worksheet.getRow(rowIdx);
    currentRow.height = 26;
    const isStriped = rowIdx % 2 === 0;
    applyRowStyle(currentRow, colCount, false, isStriped);
  }

  const colWidths = computeColumnWidths(worksheet, headers, colCount);
  colWidths.forEach((width, idx) => {
    worksheet.getColumn(idx + 1).width = width;
  });

  worksheet.views = [
    {
      state: 'frozen',
      ySplit: 1,
      activeCell: 'A2',
    },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const fileName = `分镜表_${scriptName || '未命名'}_${dateStr}.xlsx`;
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, fileName);
}
