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
    { id: 'short-drama', label: 'Short Drama', description: 'Fast-paced, suitable for short video platforms', icon: <Sparkles className="w-5 h-5" /> },
    { id: 'film', label: 'Cinematic', description: 'Slow-paced, emphasis on mood and atmosphere', icon: <Film className="w-5 h-5" /> },
    { id: 'documentary', label: 'Documentary', description: 'Realistic narrative, focus on authenticity', icon: <BookOpen className="w-5 h-5" /> },
    { id: 'custom', label: 'Custom', description: 'Define your own style', icon: <Clapperboard className="w-5 h-5" /> }
  ];

  const emotionalTones = [
    { id: 'inspiring', label: 'Inspiring', color: 'success' },
    { id: 'melancholic', label: 'Melancholic', color: 'default' },
    { id: 'thrilling', label: 'Thrilling', color: 'danger' },
    { id: 'romantic', label: 'Romantic', color: 'secondary' },
    { id: 'mysterious', label: 'Mysterious', color: 'primary' }
  ] as const;

  const narrativeFocusOptions = [
    { key: 'protagonistArc', label: 'Protagonist Arc', description: 'Character growth and transformation', icon: <Target className="w-4 h-4" /> },
    { key: 'emotionalCore', label: 'Emotional Core', description: 'Emotional relationships and conflicts', icon: <Heart className="w-4 h-4" /> },
    { key: 'worldBuilding', label: 'World Building', description: 'Setting and atmosphere construction', icon: <Globe className="w-4 h-4" /> },
    { key: 'visualSpectacle', label: 'Visual Spectacle', description: 'Visual impact and aesthetics', icon: <Eye className="w-4 h-4" /> },
    { key: 'thematicDepth', label: 'Thematic Depth', description: 'Themes and philosophical exploration', icon: <BookOpen className="w-4 h-4" /> }
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Clapperboard className="w-6 h-6 text-primary" />
            <span>Creative Intent</span>
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
              <span className="font-medium">Film Style</span>
              <Tooltip content="Choose the overall cinematic style for your project">
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
              <span className="font-medium">Narrative Focus</span>
              <span className="text-xs text-default-400">(Select multiple)</span>
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
              <span className="font-medium">Emotional Tone</span>
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
                <span className="text-sm text-default-500">Intensity</span>
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
              <span className="font-medium">Visual References</span>
              <span className="text-xs text-default-400">(Optional)</span>
            </div>
            <Textarea
              placeholder="Enter reference films, directors, or visual styles (e.g., 'Makoto Shinkai', 'Wong Kar-wai', 'Film Noir')..."
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
              <span className="font-medium">Creative Notes</span>
              <span className="text-xs text-default-400">(Optional)</span>
            </div>
            <Textarea
              placeholder="Any special creative requirements or notes for the AI director..."
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
                <span className="font-medium">AI Director Understanding</span>
              </div>
              <p className="text-sm text-default-600">
                You want to create a <strong>{filmStyles.find(s => s.id === creativeIntent.filmStyle)?.label}</strong> style project 
                with <strong>{emotionalTones.find(t => t.id === creativeIntent.emotionalTone.primary)?.label}</strong> emotional tone 
                at intensity level <strong>{creativeIntent.emotionalTone.intensity}/10</strong>.
                The narrative will focus on: <strong>
                  {Object.entries(creativeIntent.narrativeFocus)
                    .filter(([, v]) => v)
                    .map(([k]) => narrativeFocusOptions.find(o => o.key === k)?.label)
                    .filter(Boolean)
                    .join(', ') || 'Comprehensive storytelling'}
                </strong>.
              </p>
              <p className="text-xs text-default-500">
                The AI will analyze your script and generate shots based on these creative intentions, not limited by word count or platform constraints.
              </p>
            </CardBody>
          </Card>
        </ModalBody>

        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            Cancel
          </Button>
          <Button 
            color="primary" 
            onPress={onConfirm}
            startContent={<Clapperboard className="w-4 h-4" />}
          >
            Start Analysis
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CreativeIntentModal;
