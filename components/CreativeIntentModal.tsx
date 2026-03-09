/**
 * CreativeIntentModal - 创作意图确认弹窗
 * 
 * Kmeng AI Animata 2.0 核心组件
 * 替代旧的ParseConfigConfirmModal，实现从"平台选择"到"创作意图"的转变
 * 
 * @module components/CreativeIntentModal
 * @version 2.0.0
 */

import React from 'react';
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
  Switch,
  Divider,
  Tooltip
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
  CheckCircle2
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
  onIntentChange
}) => {
  const updateIntent = (updates: Partial<CreativeIntent>) => {
    onIntentChange({ ...creativeIntent, ...updates });
  };

  const updateNarrativeFocus = (key: keyof CreativeIntent['narrativeFocus'], value: boolean) => {
    onIntentChange({
      ...creativeIntent,
      narrativeFocus: {
        ...creativeIntent.narrativeFocus,
        [key]: value
      }
    });
  };

  const filmStyles = [
    { id: 'short-drama', label: '短剧风格', description: '快节奏，适合短视频平台', icon: <Sparkles className="w-5 h-5" /> },
    { id: 'film', label: '电影风格', description: '慢节奏，注重意境和氛围', icon: <Film className="w-5 h-5" /> },
    { id: 'documentary', label: '纪录片风格', description: '写实叙事，注重真实性', icon: <BookOpen className="w-5 h-5" /> },
    { id: 'custom', label: '自定义', description: '定义您自己的风格', icon: <Clapperboard className="w-5 h-5" /> }
  ];

  const emotionalTones = [
    { id: 'inspiring', label: '励志', color: 'success' },
    { id: 'melancholic', label: '忧郁', color: 'default' },
    { id: 'thrilling', label: '惊悚', color: 'danger' },
    { id: 'romantic', label: '浪漫', color: 'secondary' },
    { id: 'mysterious', label: '神秘', color: 'primary' }
  ] as const;

  const narrativeFocusOptions = [
    { key: 'protagonistArc', label: '主角成长', description: '角色的成长和转变', icon: <Target className="w-4 h-4" /> },
    { key: 'emotionalCore', label: '情感核心', description: '情感关系和冲突', icon: <Heart className="w-4 h-4" /> },
    { key: 'worldBuilding', label: '世界观构建', description: '场景和氛围营造', icon: <Globe className="w-4 h-4" /> },
    { key: 'visualSpectacle', label: '视觉奇观', description: '视觉冲击和美学', icon: <Eye className="w-4 h-4" /> },
    { key: 'thematicDepth', label: '主题深度', description: '主题和哲学探索', icon: <BookOpen className="w-4 h-4" /> }
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Clapperboard className="w-6 h-6 text-primary" />
            <span>创作意图</span>
          </div>
          <p className="text-sm font-normal text-default-500">
            {scriptTitle}
          </p>
        </ModalHeader>

        <ModalBody className="space-y-6">
          {/* Film Style Selection */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Film className="w-4 h-4 text-primary" />
              <span className="font-medium">影视风格</span>
              <Tooltip content="选择项目的整体影像风格">
                <Info className="w-4 h-4 text-default-400 cursor-help" />
              </Tooltip>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {filmStyles.map((style) => (
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
                  <CardBody className="flex items-start gap-3 p-4">
                    <div className={`p-2 rounded-lg ${
                      creativeIntent.filmStyle === style.id
                        ? 'bg-primary/20 text-primary'
                        : 'bg-default-100 text-default-500'
                    }`}>
                      {style.icon}
                    </div>
                    <div>
                      <p className="font-medium">{style.label}</p>
                      <p className="text-xs text-default-500">{style.description}</p>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>

          <Divider />

          {/* Narrative Focus */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-secondary" />
              <span className="font-medium">叙事重点</span>
              <span className="text-xs text-default-400">（可多选）</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {narrativeFocusOptions.map((option) => {
                const isSelected = creativeIntent.narrativeFocus[option.key as keyof typeof creativeIntent.narrativeFocus];
                return (
                  <Chip
                    key={option.key}
                    variant={isSelected ? 'solid' : 'flat'}
                    color={isSelected ? 'secondary' : 'default'}
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

          <Divider />

          {/* Emotional Tone */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Heart className="w-4 h-4 text-danger" />
              <span className="font-medium">情感基调</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {emotionalTones.map((tone) => (
                <Chip
                  key={tone.id}
                  variant={creativeIntent.emotionalTone.primary === tone.id ? 'solid' : 'flat'}
                  color={tone.color as any}
                  className="cursor-pointer"
                  onClick={() => updateIntent({
                    emotionalTone: { ...creativeIntent.emotionalTone, primary: tone.id as any }
                  })}
                >
                  {tone.label}
                </Chip>
              ))}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-default-500">情感强度</span>
                <span className="text-sm font-medium">{creativeIntent.emotionalTone.intensity}/10</span>
              </div>
              <Slider
                size="sm"
                step={1}
                minValue={1}
                maxValue={10}
                value={creativeIntent.emotionalTone.intensity}
                onChange={(value) => updateIntent({
                  emotionalTone: { ...creativeIntent.emotionalTone, intensity: value as number }
                })}
                className="max-w-md"
              />
            </div>
          </div>

          <Divider />

          {/* Visual References */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-warning" />
              <span className="font-medium">视觉参考</span>
              <span className="text-xs text-default-400">（可选）</span>
            </div>
            <Textarea
              placeholder="输入参考影片、导演或视觉风格（如：新海诚、王家卫、黑色电影）..."
              value={creativeIntent.visualReferences?.join(', ') || ''}
              onChange={(e) => updateIntent({
                visualReferences: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
              minRows={2}
            />
          </div>

          {/* Creative Notes */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-success" />
              <span className="font-medium">创作备注</span>
              <span className="text-xs text-default-400">（可选）</span>
            </div>
            <Textarea
              placeholder="任何特殊的创作要求或对AI导演的备注..."
              value={creativeIntent.creativeNotes || ''}
              onChange={(e) => updateIntent({ creativeNotes: e.target.value })}
              minRows={3}
            />
          </div>

          {/* Summary */}
          <Card className="bg-primary/5 border-primary/20">
            <CardBody className="space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">AI导演理解</span>
              </div>
              <p className="text-sm text-default-600">
                您希望创作一个<strong>{filmStyles.find(s => s.id === creativeIntent.filmStyle)?.label}</strong>风格的作品，
                情感基调为<strong>{emotionalTones.find(t => t.id === creativeIntent.emotionalTone.primary)?.label}</strong>，
                强度等级<strong>{creativeIntent.emotionalTone.intensity}/10</strong>。
                叙事重点：<strong>
                  {Object.entries(creativeIntent.narrativeFocus)
                    .filter(([, v]) => v)
                    .map(([k]) => narrativeFocusOptions.find(o => o.key === k)?.label)
                    .filter(Boolean)
                    .join('、') || '全面叙事'}
                </strong>。
              </p>
              <p className="text-xs text-default-500">
                AI将根据这些创作意图分析剧本并生成分镜，不受字数或平台限制。
              </p>
            </CardBody>
          </Card>
        </ModalBody>

        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            取消
          </Button>
          <Button 
            color="primary" 
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
