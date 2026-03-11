/**
 * StructureDetailTab - 剧本结构详细分析Tab组件
 *
 * 展示基于 StoryStructure 和 emotionalArc 的详细结构分析
 */

import React, { useMemo } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Divider,
  Chip,
  Progress,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from '@heroui/react';
import { Layout, Clock, FileText, TrendingUp, Target, Activity } from 'lucide-react';
import type { ScriptMetadata } from '@/types';
import {
  screenplayStructureAnalyzer,
  type StructureAnalysis,
} from '@/src/services/parsing/professional';

interface StructureDetailTabProps {
  metadata: ScriptMetadata;
}

export const StructureDetailTab: React.FC<StructureDetailTabProps> = ({ metadata }) => {
  // 使用 useMemo 缓存分析结果
  const analysis = useMemo(() => {
    return screenplayStructureAnalyzer.analyze(
      metadata.storyStructure || {
        structureType: 'three_act',
        act1: '',
        act2a: '',
        act2b: '',
        act3: '',
        midpoint: '',
        climax: '',
      },
      metadata.emotionalArc,
      metadata.wordCount
    );
  }, [metadata]);

  // 渲染结构评分卡片
  const renderScoreCard = () => {
    const { structureScore } = analysis;

    return (
      <Card className="mb-6">
        <CardHeader className="flex items-center gap-2">
          <Target size={20} className="text-primary" />
          <h3 className="text-lg font-semibold">结构评分</h3>
        </CardHeader>
        <Divider />
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* 总分 */}
            <div className="text-center p-4 bg-primary-50 rounded-lg">
              <p className="text-3xl font-bold text-primary">{structureScore.overall}</p>
              <p className="text-sm text-primary-600">总分</p>
            </div>

            {/* 完整性 */}
            <div className="text-center p-4 bg-default-50 rounded-lg">
              <p className="text-2xl font-bold">{structureScore.completeness}</p>
              <p className="text-sm text-default-500">完整性</p>
              <Progress
                value={structureScore.completeness}
                className="mt-2"
                size="sm"
                color={structureScore.completeness >= 80 ? 'success' : 'warning'}
              />
            </div>

            {/* 平衡性 */}
            <div className="text-center p-4 bg-default-50 rounded-lg">
              <p className="text-2xl font-bold">{structureScore.balance}</p>
              <p className="text-sm text-default-500">平衡性</p>
              <Progress
                value={structureScore.balance}
                className="mt-2"
                size="sm"
                color={structureScore.balance >= 80 ? 'success' : 'warning'}
              />
            </div>

            {/* 情绪曲线 */}
            <div className="text-center p-4 bg-default-50 rounded-lg">
              <p className="text-2xl font-bold">{structureScore.emotionalArc}</p>
              <p className="text-sm text-default-500">情绪曲线</p>
              <Progress
                value={structureScore.emotionalArc}
                className="mt-2"
                size="sm"
                color={structureScore.emotionalArc >= 80 ? 'success' : 'warning'}
              />
            </div>
          </div>
        </CardBody>
      </Card>
    );
  };

  // 渲染幕长度统计
  const renderActLengths = () => {
    const { actLengths, structure } = analysis;

    const acts = [
      {
        key: 'act1',
        name: '第一幕',
        subtitle: '设定',
        data: actLengths.act1,
        description: structure.act1,
      },
      {
        key: 'act2a',
        name: '第二幕上',
        subtitle: '对抗',
        data: actLengths.act2a,
        description: structure.act2a,
      },
      {
        key: 'act2b',
        name: '第二幕下',
        subtitle: '低谷',
        data: actLengths.act2b,
        description: structure.act2b,
      },
      {
        key: 'act3',
        name: '第三幕',
        subtitle: '结局',
        data: actLengths.act3,
        description: structure.act3,
      },
    ];

    return (
      <Card className="mb-6">
        <CardHeader className="flex items-center gap-2">
          <Layout size={20} className="text-primary" />
          <h3 className="text-lg font-semibold">幕长度分布</h3>
          <Chip size="sm" variant="flat" color="primary">
            {screenplayStructureAnalyzer.getStructureTypeDisplayName(structure.structureType)}
          </Chip>
        </CardHeader>
        <Divider />
        <CardBody>
          <div className="space-y-4">
            {acts.map(act => (
              <div key={act.key} className="p-4 bg-default-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{act.name}</span>
                    <Chip size="sm" variant="flat">
                      {act.subtitle}
                    </Chip>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-default-500">
                    <span className="flex items-center gap-1">
                      <FileText size={14} />
                      {act.data.wordCount.toLocaleString()} 字
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={14} />
                      {act.data.estimatedMinutes} 分钟
                    </span>
                  </div>
                </div>
                <Progress
                  value={act.data.percentage}
                  className="mb-2"
                  size="md"
                  color="primary"
                  showValueLabel
                />
                {act.description && (
                  <p className="text-sm text-default-600 mt-2">{act.description}</p>
                )}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    );
  };

  // 渲染节奏分析
  const renderPacingAnalysis = () => {
    const { pacingAnalysis } = analysis;

    return (
      <Card className="mb-6">
        <CardHeader className="flex items-center gap-2">
          <Activity size={20} className="text-primary" />
          <h3 className="text-lg font-semibold">节奏分析</h3>
        </CardHeader>
        <Divider />
        <CardBody>
          <div className="space-y-6">
            {/* 节奏描述 */}
            <div className="p-4 bg-default-50 rounded-lg">
              <p className="text-sm text-default-500 mb-1">节奏特征</p>
              <p className="text-base">{pacingAnalysis.pacingDescription}</p>
            </div>

            {/* 紧张度曲线 */}
            {pacingAnalysis.tensionCurve.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={18} className="text-primary" />
                  <h4 className="font-medium">紧张度曲线</h4>
                </div>
                <div className="flex items-end gap-1 h-32 p-4 bg-default-50 rounded-lg">
                  {pacingAnalysis.tensionCurve.map((intensity, index) => (
                    <div
                      key={index}
                      className="flex-1 bg-primary rounded-t transition-all hover:bg-primary-600"
                      style={{
                        height: `${intensity * 10}%`,
                        opacity: 0.3 + (intensity / 10) * 0.7,
                      }}
                      title={`强度: ${intensity}/10`}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-xs text-default-400 mt-2">
                  <span>开场</span>
                  <span>中点</span>
                  <span>高潮</span>
                  <span>结局</span>
                </div>
              </div>
            )}

            {/* 高潮位置 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-default-50 rounded-lg">
                <p className="text-sm text-default-500 mb-1">高潮位置</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-primary">
                    {pacingAnalysis.climaxPosition}%
                  </p>
                  <Progress
                    value={pacingAnalysis.climaxPosition}
                    className="flex-1"
                    size="sm"
                    color="danger"
                  />
                </div>
              </div>

              {/* 转折点 */}
              <div className="p-4 bg-default-50 rounded-lg">
                <p className="text-sm text-default-500 mb-1">转折点</p>
                <div className="flex flex-wrap gap-2">
                  {pacingAnalysis.turningPoints.length > 0 ? (
                    pacingAnalysis.turningPoints.map((point, index) => (
                      <Chip key={index} size="sm" variant="flat" color="warning">
                        {point}
                      </Chip>
                    ))
                  ) : (
                    <p className="text-sm text-default-400">未识别到转折点</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  };

  // 渲染结构详情表
  const renderStructureDetails = () => {
    const { structure } = analysis;

    const details = [
      {
        label: '结构类型',
        value: screenplayStructureAnalyzer.getStructureTypeDisplayName(structure.structureType),
      },
      { label: '中点转折', value: structure.midpoint || '未定义' },
      { label: '高潮', value: structure.climax || '未定义' },
    ];

    return (
      <Card>
        <CardHeader className="flex items-center gap-2">
          <Layout size={20} className="text-primary" />
          <h3 className="text-lg font-semibold">结构详情</h3>
        </CardHeader>
        <Divider />
        <CardBody>
          <Table aria-label="结构详情">
            <TableHeader>
              <TableColumn>项目</TableColumn>
              <TableColumn>内容</TableColumn>
            </TableHeader>
            <TableBody>
              {details.map((detail, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{detail.label}</TableCell>
                  <TableCell>{detail.value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* 结构评分 */}
      {renderScoreCard()}

      {/* 幕长度统计 */}
      {renderActLengths()}

      {/* 节奏分析 */}
      {renderPacingAnalysis()}

      {/* 结构详情 */}
      {renderStructureDetails()}
    </div>
  );
};

export default StructureDetailTab;
