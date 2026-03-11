/**
 * PlatformTemplateSelector - 平台模板快速选择
 *
 * 提供一键配置平台模板（抖音/快手/B站/精品）
 *
 * @module components/DurationBudget/PlatformTemplateSelector
 * @version 1.0.0
 */

import React from 'react';
import { Card, CardBody } from '@heroui/react';
import { Smartphone, Video, Monitor, Film } from 'lucide-react';

export interface PlatformTemplate {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  config: {
    platform: string;
    pace: string;
    useDurationBudget: boolean;
    useProductionPrompt: boolean;
    useShotQC: boolean;
  };
  estimatedDuration: string;
  recommendedShots: string;
  features: string[];
}

export interface PlatformTemplateSelectorProps {
  onSelectTemplate: (template: PlatformTemplate) => void;
  t: any;
}

export const PlatformTemplateSelector: React.FC<PlatformTemplateSelectorProps> = ({
  onSelectTemplate,
  t,
}) => {
  // 定义平台模板
  const templates: PlatformTemplate[] = [
    {
      id: 'douyin',
      name: t.settings.durationBudget?.douyinTemplate || '抖音短剧',
      icon: <Smartphone className="w-6 h-6" />,
      description: t.settings.durationBudget?.douyinDesc || '竖屏短视频，快节奏，适合抖音平台',
      config: {
        platform: 'douyin',
        pace: 'fast',
        useDurationBudget: true,
        useProductionPrompt: true,
        useShotQC: false,
      },
      estimatedDuration: '3-5分钟',
      recommendedShots: '25-35个',
      features: [
        t.settings.durationBudget?.featureVertical || '竖屏适配',
        t.settings.durationBudget?.featureFastPace || '快节奏(280字/分钟)',
        t.settings.durationBudget?.featureShortVideo || '短视频优化',
      ],
    },
    {
      id: 'kuaishou',
      name: t.settings.durationBudget?.kuaishouTemplate || '快手短剧',
      icon: <Video className="w-6 h-6" />,
      description: t.settings.durationBudget?.kuaishouDesc || '竖屏视频，生活化，适合快手平台',
      config: {
        platform: 'kuaishou',
        pace: 'normal',
        useDurationBudget: true,
        useProductionPrompt: true,
        useShotQC: false,
      },
      estimatedDuration: '4-6分钟',
      recommendedShots: '30-40个',
      features: [
        t.settings.durationBudget?.featureVertical || '竖屏适配',
        t.settings.durationBudget?.featureLifestyle || '生活化风格',
        t.settings.durationBudget?.featureCommunity || '老铁文化',
      ],
    },
    {
      id: 'bilibili',
      name: t.settings.durationBudget?.bilibiliTemplate || 'B站视频',
      icon: <Monitor className="w-6 h-6" />,
      description: t.settings.durationBudget?.bilibiliDesc || '横屏视频，多样化，适合B站平台',
      config: {
        platform: 'bilibili',
        pace: 'normal',
        useDurationBudget: true,
        useProductionPrompt: true,
        useShotQC: true,
      },
      estimatedDuration: '5-10分钟',
      recommendedShots: '40-60个',
      features: [
        t.settings.durationBudget?.featureHorizontal || '横屏适配',
        t.settings.durationBudget?.featureDiverse || '多样化风格',
        t.settings.durationBudget?.featureQuality || '质量检查',
      ],
    },
    {
      id: 'premium',
      name: t.settings.durationBudget?.premiumTemplate || '精品短剧',
      icon: <Film className="w-6 h-6" />,
      description: t.settings.durationBudget?.premiumDesc || '横屏视频，电影级质感，精品制作',
      config: {
        platform: 'premium',
        pace: 'slow',
        useDurationBudget: true,
        useProductionPrompt: true,
        useShotQC: true,
      },
      estimatedDuration: '8-15分钟',
      recommendedShots: '60-90个',
      features: [
        t.settings.durationBudget?.featureHorizontal || '横屏适配',
        t.settings.durationBudget?.featureCinematic || '电影级质感',
        t.settings.durationBudget?.featurePremium || '精品制作',
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 bg-secondary rounded-full" />
        <h3 className="text-[15px] font-black uppercase tracking-widest text-slate-900 dark:text-white">
          {t.settings.durationBudget?.quickConfig || '快速配置'}
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-3">
        {templates.map(template => (
          <Card
            key={template.id}
            className="border border-slate-200 dark:border-slate-800 hover:border-primary dark:hover:border-primary transition-all duration-300 cursor-pointer group"
            isPressable
            onPress={() => onSelectTemplate(template)}
          >
            <CardBody className="p-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary group-hover:text-white transition-all duration-300">
                  {template.icon}
                </div>
                <div className="flex-1">
                  <h4 className="text-[15px] font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                    {template.name}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">{template.description}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {template.features.map((feature, index) => (
                      <span
                        key={index}
                        className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] rounded-full"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                    <span>⏱️ {template.estimatedDuration}</span>
                    <span>🎬 {template.recommendedShots}</span>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PlatformTemplateSelector;
