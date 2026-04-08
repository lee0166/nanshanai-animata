import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PenTool, Database, TrendingUp, FlaskConical, Zap, TestTube, Info } from 'lucide-react';
import { Card, CardBody } from '@heroui/react';
import AnnotationAssistant from '../components/AnnotationAssistant';
import AnnotationSampleManager from '../components/AnnotationSampleManager';
import AnnotationQualityReport from '../components/AnnotationQualityReport';

// 导航项类型
interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  component: React.ComponentType<any>;
  description: string;
  useCase: string;
  difference: string;
}

// 导航配置
const navItems: NavItem[] = [
  {
    id: 'assistant',
    label: '标注工作台',
    icon: PenTool,
    component: AnnotationAssistant,
    description: '创建和编辑标注样本',
    useCase: '用于创建新的标注样本，或编辑现有标注样本',
    difference: '与ScriptManager无关，是独立的标注工具',
  },
  {
    id: 'samples',
    label: '样本库管理',
    icon: Database,
    component: AnnotationSampleManager,
    description: '管理标注样本库',
    useCase: '用于导入、导出、复制、删除标注样本',
    difference: '与ScriptManager无关，是独立的样本管理工具',
  },
  {
    id: 'quality',
    label: '质量评估',
    icon: TrendingUp,
    component: () => <AnnotationQualityReport t={{}} />,
    description: '评估标注样本质量',
    useCase: '用于检查标注样本的质量，给出优化建议',
    difference: '⚠️ 与ScriptManager中的质量评估不同：这个评估标注样本，ScriptManager评估解析结果',
  },
  {
    id: 'prompt',
    label: 'Prompt实验室',
    icon: FlaskConical,
    component: () => <div className="p-6">Prompt实验室 - 开发中...</div>,
    description: '测试和优化Prompt',
    useCase: '用于测试不同的Prompt，对比效果',
    difference: '全新功能，ScriptManager中没有',
  },
  {
    id: 'abtest',
    label: 'A/B测试',
    icon: TestTube,
    component: () => <div className="p-6">A/B测试 - 开发中...</div>,
    description: '对比不同方案的效果',
    useCase: '用于对比不同Prompt、不同参数的效果',
    difference: '全新功能，ScriptManager中没有',
  },
];

const AnnotationManager: React.FC = () => {
  const [activeNav, setActiveNav] = useState<string>('assistant');

  // 获取当前激活的导航项
  const activeItem = navItems.find(item => item.id === activeNav) || navItems[0];
  const ActiveComponent = activeItem.component;

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-950">
      {/* 左侧导航 */}
      <div className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex flex-col gap-2 mb-8">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">
            数据工作台
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
            管理您的标注数据和优化工具
          </p>
        </div>

        <nav className="space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group-nav ${
                  isActive
                    ? 'bg-lime-500 text-slate-950 shadow-lg shadow-lime-500/30'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span
                  className={`text-sm font-black uppercase tracking-widest transition-colors duration-200 ${
                    isActive ? 'text-slate-950' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* 右侧内容区 */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto p-4 md:p-6">
          <Card
            className="border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
            radius="lg"
          >
            <CardBody className="px-6 pb-6 pt-6 space-y-6">
              {/* 功能定位说明卡片 */}
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-500 text-white p-2 rounded-lg flex-shrink-0">
                    <Info className="w-4 h-4" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <h3 className="font-bold text-blue-700 dark:text-blue-300">
                      {activeItem.label}
                    </h3>
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      📋 <strong>功能：</strong>
                      {activeItem.description}
                    </p>
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      🎯 <strong>用途：</strong>
                      {activeItem.useCase}
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                      ⚠️ <strong>区别：</strong>
                      {activeItem.difference}
                    </p>
                  </div>
                </div>
              </div>

              {/* 功能内容 */}
              <ActiveComponent />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AnnotationManager;
