/**
 * Script Analysis Components Test
 *
 * 剧本分析组件测试
 *
 * @module components/ScriptAnalysis/ScriptAnalysis.test
 * @version 1.0.0
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

// 导入组件
import { StoryOverviewCard } from './StoryOverviewCard';
import { VisualStyleCard } from './VisualStyleCard';
import { EmotionalArcChart } from './EmotionalArcChart';
import { StoryStructureDiagram } from './StoryStructureDiagram';

import type { ScriptMetadata, EmotionalPoint, StoryStructure } from '../../types';

// Mock HeroUI组件
vi.mock('@heroui/react', () => ({
  Card: ({ children, className }: any) => <div className={`card ${className || ''}`}>{children}</div>,
  CardBody: ({ children }: any) => <div className="card-body">{children}</div>,
  CardHeader: ({ children }: any) => <div className="card-header">{children}</div>,
  Chip: ({ children }: any) => <span className="chip">{children}</span>,
  Divider: () => <hr className="divider" />,
  Tooltip: ({ children }: any) => <div className="tooltip">{children}</div>,
}));

// Mock Lucide图标
vi.mock('lucide-react', () => ({
  BookOpen: () => <span>BookOpen</span>,
  Target: () => <span>Target</span>,
  Lightbulb: () => <span>Lightbulb</span>,
  Quote: () => <span>Quote</span>,
  Sparkles: () => <span>Sparkles</span>,
  Palette: () => <span>Palette</span>,
  Film: () => <span>Film</span>,
  Camera: () => <span>Camera</span>,
  Sun: () => <span>Sun</span>,
  Brush: () => <span>Brush</span>,
  Clapperboard: () => <span>Clapperboard</span>,
  User: () => <span>User</span>,
  TrendingUp: () => <span>TrendingUp</span>,
  Activity: () => <span>Activity</span>,
  Smile: () => <span>Smile</span>,
  Frown: () => <span>Frown</span>,
  Zap: () => <span>Zap</span>,
  Meh: () => <span>Meh</span>,
  Layout: () => <span>Layout</span>,
  Play: () => <span>Play</span>,
  AlertTriangle: () => <span>AlertTriangle</span>,
  TrendingDown: () => <span>TrendingDown</span>,
  Flag: () => <span>Flag</span>,
  HelpCircle: () => <span>HelpCircle</span>,
  Heart: () => <span>Heart</span>,
}));

describe('StoryOverviewCard', () => {
  const mockMetadata: ScriptMetadata = {
    title: '测试剧本',
    synopsis: '这是一个测试剧本的故事梗概',
    logline: '一个关于测试的故事',
    coreConflict: '测试与现实的冲突',
    theme: ['测试', '探索'],
    genre: '科幻',
    tone: '悬疑',
    wordCount: 5000,
    characterCount: 3,
    sceneCount: 5,
  };

  it('应该正确渲染故事概览卡片', () => {
    const { container } = render(
      <StoryOverviewCard metadata={mockMetadata} t={{}} />
    );
    expect(container.querySelector('.card')).toBeTruthy();
  });

  it('应该显示剧本标题', () => {
    const { container } = render(
      <StoryOverviewCard metadata={mockMetadata} t={{}} />
    );
    expect(container.textContent).toContain('测试剧本');
  });
});

describe('VisualStyleCard', () => {
  const mockMetadata: ScriptMetadata = {
    title: '测试剧本',
    visualStyle: {
      artStyle: '赛博朋克',
      artStyleDescription: '霓虹灯与高科技',
      colorPalette: ['#FF0000', '#00FF00', '#0000FF'],
      colorMood: '冷峻',
      cinematography: '广角镜头',
      lightingStyle: '霓虹灯光',
    },
    eraContext: {
      era: '未来',
      location: '东京',
      season: '冬季',
      eraDescription: '2077年的未来都市',
    },
    references: {
      films: ['银翼杀手', '攻壳机动队'],
      directors: ['雷德利·斯科特'],
    },
  };

  it('应该正确渲染视觉风格卡片', () => {
    const { container } = render(
      <VisualStyleCard metadata={mockMetadata} t={{}} />
    );
    expect(container.querySelector('.card')).toBeTruthy();
  });

  it('应该显示美术风格', () => {
    const { container } = render(
      <VisualStyleCard metadata={mockMetadata} t={{}} />
    );
    expect(container.textContent).toContain('赛博朋克');
  });
});

describe('EmotionalArcChart', () => {
  const mockEmotionalArc: EmotionalPoint[] = [
    { plotPoint: '开场', emotion: '平静', intensity: 3, percentage: 0, colorTone: '冷色调' },
    { plotPoint: '冲突', emotion: '紧张', intensity: 8, percentage: 50, colorTone: '暖色调' },
    { plotPoint: '高潮', emotion: '兴奋', intensity: 10, percentage: 80, colorTone: '高对比' },
    { plotPoint: '结局', emotion: '满足', intensity: 5, percentage: 100, colorTone: '柔和' },
  ];

  it('应该正确渲染情绪曲线图表', () => {
    const { container } = render(
      <EmotionalArcChart emotionalArc={mockEmotionalArc} overallMood="紧张" t={{}} />
    );
    expect(container.querySelector('.card')).toBeTruthy();
  });

  it('应该显示情绪点', () => {
    const { container } = render(
      <EmotionalArcChart emotionalArc={mockEmotionalArc} overallMood="紧张" t={{}} />
    );
    expect(container.textContent).toContain('开场');
    expect(container.textContent).toContain('冲突');
  });

  it('没有数据时应该显示空状态', () => {
    const { container } = render(
      <EmotionalArcChart emotionalArc={[]} overallMood="" t={{}} />
    );
    expect(container.textContent).toContain('暂无情绪曲线数据');
  });
});

describe('StoryStructureDiagram', () => {
  const mockStoryStructure: StoryStructure = {
    structureType: 'three_act',
    act1: '介绍主角和背景',
    act2a: '主角踏上旅程',
    act2b: '主角遭遇挫折',
    act3: '最终对决',
    midpoint: '重大转折',
    climax: '高潮对决',
  };

  it('应该正确渲染故事结构图表', () => {
    const { container } = render(
      <StoryStructureDiagram storyStructure={mockStoryStructure} t={{}} />
    );
    expect(container.querySelector('.card')).toBeTruthy();
  });

  it('应该显示结构类型', () => {
    const { container } = render(
      <StoryStructureDiagram storyStructure={mockStoryStructure} t={{}} />
    );
    expect(container.textContent).toContain('三幕式结构');
  });

  it('没有数据时应该显示空状态', () => {
    const { container } = render(
      <StoryStructureDiagram storyStructure={undefined} t={{}} />
    );
    expect(container.textContent).toContain('暂无故事结构数据');
  });
});
