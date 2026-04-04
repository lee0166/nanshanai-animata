/**
 * CreativeIntentModal - 创作意图确认弹窗
 *
 * Kmeng AI Animata 2.0 核心组件
 * 替代旧的ParseConfigConfirmModal，实现从"平台选择"到"创作意图"的转变
 *
 * @module components/CreativeIntentModal
 * @version 2.1.0 - 优化布局，减少留白
 */

import React, { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Card,
  CardBody,
  Chip,
  Textarea,
  Slider,
  Tooltip,
  Select,
  SelectItem,
  Divider,
} from '@heroui/react';
import {
  Clapperboard,
  Film,
  Sparkles,
  Target,
  Heart,
  Globe,
  Eye,
  BookOpen,
  Info,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Settings,
  Clock,
} from 'lucide-react';
import { CreativeIntent } from '../types';

interface CreativeIntentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  scriptTitle: string;
  creativeIntent: CreativeIntent;
  onIntentChange: (intent: CreativeIntent) => void;
}

export const CreativeIntentModal: React.FC<CreativeIntentModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  scriptTitle,
  creativeIntent,
  onIntentChange,
}) => {
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  const updateIntent = (updates: Partial<CreativeIntent>) => {
    onIntentChange({ ...creativeIntent, ...updates });
  };

  const updateNarrativeFocus = (key: keyof CreativeIntent['narrativeFocus'], value: boolean) => {
    onIntentChange({
      ...creativeIntent,
      narrativeFocus: {
        ...creativeIntent.narrativeFocus,
        [key]: value,
      },
    });
  };

  const filmStyles = [
    {
      id: 'short-drama',
      label: '短剧',
      description: '快节奏短视频',
      icon: <Sparkles className="w-4 h-4" />,
    },
    { id: 'film', label: '电影', description: '慢节奏意境', icon: <Film className="w-4 h-4" /> },
    {
      id: 'documentary',
      label: '纪录片',
      description: '写实叙事',
      icon: <BookOpen className="w-4 h-4" />,
    },
    {
      id: 'custom',
      label: '自定义',
      description: '自由定义',
      icon: <Clapperboard className="w-4 h-4" />,
    },
  ];

  const emotionalTones = [
    { id: 'inspiring', label: '励志', color: 'success' },
    { id: 'melancholic', label: '忧郁', color: 'default' },
    { id: 'thrilling', label: '惊悚', color: 'danger' },
    { id: 'romantic', label: '浪漫', color: 'secondary' },
    { id: 'mysterious', label: '神秘', color: 'primary' },
  ] as const;

  const narrativeFocusOptions = [
    { key: 'protagonistArc', label: '主角成长', icon: <Target className="w-3.5 h-3.5" /> },
    { key: 'emotionalCore', label: '情感核心', icon: <Heart className="w-3.5 h-3.5" /> },
    { key: 'worldBuilding', label: '世界观', icon: <Globe className="w-3.5 h-3.5" /> },
    { key: 'visualSpectacle', label: '视觉奇观', icon: <Eye className="w-3.5 h-3.5" /> },
    { key: 'thematicDepth', label: '主题深度', icon: <BookOpen className="w-3.5 h-3.5" /> },
  ];

  const targetPlatformOptions = [
    { key: 'douyin', label: '短视频-抖音风格' },
    { key: 'kuaishou', label: '短视频-快手风格' },
    { key: 'bilibili', label: '中视频-B站风格' },
    { key: 'premium', label: '长视频-精品短剧' },
  ];

  const pacingPreferenceOptions = [
    { key: 'fast', label: '快' },
    { key: 'normal', label: '中' },
    { key: 'slow', label: '慢' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1 pb-2">
          <div className="flex items-center gap-2">
            <Clapperboard className="w-5 h-5 text-primary" />
            <span className="text-lg">创作意图</span>
          </div>
          <p className="text-sm font-normal text-default-500 truncate">{scriptTitle}</p>
        </ModalHeader>

        <ModalBody className="space-y-4 py-2">
          {/* Film Style Selection - 紧凑横向4列布局 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Film className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">影视风格</span>
              <Tooltip content="选择项目的整体影像风格">
                <Info className="w-3.5 h-3.5 text-default-400 cursor-help" />
              </Tooltip>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {filmStyles.map(style => (
                <Card
                  key={style.id}
                  isPressable
                  onPress={() => updateIntent({ filmStyle: style.id as any })}
                  className={`border-2 transition-all ${
                    creativeIntent.filmStyle === style.id
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent hover:border-default-200'
                  }`}
                >
                  <CardBody className="flex flex-col items-center gap-1.5 p-2">
                    <div
                      className={`p-1.5 rounded-md ${
                        creativeIntent.filmStyle === style.id
                          ? 'bg-primary/20 text-primary'
                          : 'bg-default-100 text-default-500'
                      }`}
                    >
                      {style.icon}
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium leading-tight">{style.label}</p>
                      <p className="text-[10px] text-default-500 leading-tight mt-0.5">
                        {style.description}
                      </p>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>

          {/* Narrative Focus - 紧凑标签布局 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-secondary" />
              <span className="text-sm font-medium">叙事重点</span>
              <span className="text-xs text-default-400">可多选</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {narrativeFocusOptions.map(option => {
                const isSelected =
                  creativeIntent.narrativeFocus[
                    option.key as keyof typeof creativeIntent.narrativeFocus
                  ];
                return (
                  <Chip
                    key={option.key}
                    variant={isSelected ? 'solid' : 'flat'}
                    color={isSelected ? 'secondary' : 'default'}
                    size="sm"
                    className="cursor-pointer"
                    onClick={() => updateNarrativeFocus(option.key as any, !isSelected)}
                    startContent={option.icon}
                  >
                    {option.label}
                  </Chip>
                );
              })}
            </div>
          </div>

          {/* Emotional Tone + Intensity - 合并一行布局 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Heart className="w-4 h-4 text-danger" />
                <span className="text-sm font-medium">情感基调</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {emotionalTones.map(tone => {
                  const isSelected = creativeIntent.emotionalTone.primary === tone.id;
                  return (
                    <Chip
                      key={tone.id}
                      variant={isSelected ? 'solid' : 'flat'}
                      color={isSelected ? (tone.color as any) : 'default'}
                      size="md"
                      className="cursor-pointer"
                      onClick={() =>
                        updateIntent({
                          emotionalTone: {
                            ...creativeIntent.emotionalTone,
                            primary: tone.id as any,
                          },
                        })
                      }
                    >
                      {tone.label}
                    </Chip>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">情感强度</span>
                <span className="text-xs font-medium text-primary">
                  {creativeIntent.emotionalTone.intensity}/10
                </span>
              </div>
              <Slider
                aria-label="情感强度"
                size="sm"
                step={1}
                minValue={1}
                maxValue={10}
                value={creativeIntent.emotionalTone.intensity}
                onChange={value =>
                  updateIntent({
                    emotionalTone: { ...creativeIntent.emotionalTone, intensity: value as number },
                  })
                }
                className="w-full"
              />
            </div>
          </div>

          <Divider className="my-4" />

          {/* Advanced Settings - 高级设置（时长控制） */}
          <div>
            <Button
              variant="light"
              size="sm"
              onPress={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className="w-full justify-start"
            >
              {showAdvancedSettings ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              <Settings className="w-4 h-4 ml-2" />
              <span className="ml-2">高级设置（时长控制）</span>
            </Button>

            {showAdvancedSettings && (
              <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-2 gap-4">
                  {/* 平台选择 */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium">目标平台</span>
                    </div>
                    <Select
                      aria-label="目标平台"
                      selectedKeys={
                        creativeIntent.durationControl?.targetPlatform
                          ? [creativeIntent.durationControl.targetPlatform]
                          : []
                      }
                      onSelectionChange={keys => {
                        const platform = Array.from(keys)[0] as string;
                        updateIntent({
                          durationControl: {
                            ...creativeIntent.durationControl,
                            targetPlatform: platform as any,
                          },
                        });
                      }}
                    >
                      {targetPlatformOptions.map(option => (
                        <SelectItem key={option.key}>{option.label}</SelectItem>
                      ))}
                    </Select>
                  </div>

                  {/* 节奏选择 */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium">节奏偏好</span>
                    </div>
                    <Select
                      aria-label="节奏偏好"
                      selectedKeys={
                        creativeIntent.durationControl?.pacingPreference
                          ? [creativeIntent.durationControl.pacingPreference]
                          : []
                      }
                      onSelectionChange={keys => {
                        const pace = Array.from(keys)[0] as string;
                        updateIntent({
                          durationControl: {
                            ...creativeIntent.durationControl,
                            pacingPreference: pace as any,
                          },
                        });
                      }}
                    >
                      {pacingPreferenceOptions.map(option => (
                        <SelectItem key={option.key}>{option.label}</SelectItem>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Visual References + Creative Notes - 左右两列布局 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Eye className="w-4 h-4 text-warning" />
                <span className="text-sm font-medium">视觉参考</span>
                <span className="text-xs text-default-400">可选</span>
              </div>
              <Textarea
                aria-label="视觉参考"
                placeholder="参考影片、导演或风格..."
                value={creativeIntent.visualReferences?.join(', ') || ''}
                onChange={e =>
                  updateIntent({
                    visualReferences: e.target.value
                      .split(',')
                      .map(s => s.trim())
                      .filter(Boolean),
                  })
                }
                minRows={2}
                size="sm"
              />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="w-4 h-4 text-success" />
                <span className="text-sm font-medium">创作备注</span>
                <span className="text-xs text-default-400">可选</span>
              </div>
              <Textarea
                aria-label="创作备注"
                placeholder="特殊要求或备注..."
                value={creativeIntent.creativeNotes || ''}
                onChange={e => updateIntent({ creativeNotes: e.target.value })}
                minRows={2}
                size="sm"
              />
            </div>
          </div>

          {/* Summary - 精简总结 */}
          <Card className="bg-default-50 border-default-200">
            <CardBody className="space-y-2 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">创作意图配置</span>
              </div>
              <p className="text-sm text-default-600 leading-relaxed">
                时长预算配置已生效：
                {creativeIntent.durationControl?.targetPlatform && (
                  <>
                    <br />• <strong>目标平台</strong>：
                    {
                      targetPlatformOptions.find(
                        o => o.key === creativeIntent.durationControl.targetPlatform
                      )?.label
                    }
                  </>
                )}
                {creativeIntent.durationControl?.pacingPreference && (
                  <>
                    <br />• <strong>节奏偏好</strong>：
                    {
                      pacingPreferenceOptions.find(
                        o => o.key === creativeIntent.durationControl.pacingPreference
                      )?.label
                    }
                  </>
                )}
                {!creativeIntent.durationControl?.targetPlatform &&
                  !creativeIntent.durationControl?.pacingPreference && (
                    <>
                      <br />• 使用默认配置
                    </>
                  )}
              </p>
              <p className="text-sm text-default-600 leading-relaxed">
                创作意图配置已生效：
                <br />• <strong>影视风格</strong>：
                {filmStyles.find(s => s.id === creativeIntent.filmStyle)?.label}
                {(() => {
                  const selectedFocus = Object.entries(creativeIntent.narrativeFocus)
                    .filter(([, v]) => v)
                    .map(([k]) => narrativeFocusOptions.find(o => o.key === k)?.label)
                    .filter(Boolean);
                  return selectedFocus.length > 0 ? (
                    <>
                      <br />• <strong>叙事重点</strong>：{selectedFocus.join('、')}
                    </>
                  ) : null;
                })()}
                {creativeIntent.visualReferences && creativeIntent.visualReferences.length > 0 && (
                  <>
                    <br />• <strong>视觉参考</strong>：{creativeIntent.visualReferences.join('、')}
                  </>
                )}
                <br />• <strong>情感基调</strong>：
                {emotionalTones.find(t => t.id === creativeIntent.emotionalTone.primary)?.label}
                <br />• <strong>情感强度</strong>：{creativeIntent.emotionalTone.intensity}/10
                {creativeIntent.creativeNotes && (
                  <>
                    <br />• <strong>创作备注</strong>：
                    {creativeIntent.creativeNotes.substring(0, 50)}
                    {creativeIntent.creativeNotes.length > 50 ? '...' : ''}
                  </>
                )}
              </p>
              <Divider className="my-2" />
              <p className="text-xs text-default-400">✅ 所有创作意图配置项已生效！</p>
            </CardBody>
          </Card>
        </ModalBody>

        <ModalFooter className="pt-2">
          <Button variant="light" size="sm" onPress={onClose}>
            取消
          </Button>
          <Button
            color="primary"
            size="sm"
            onPress={onConfirm}
            startContent={<Clapperboard className="w-4 h-4" />}
          >
            开始分析
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CreativeIntentModal;
