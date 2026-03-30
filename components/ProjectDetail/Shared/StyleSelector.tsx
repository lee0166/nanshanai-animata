import React from 'react';
import { Image } from '@heroui/react';
import { CheckCircle2 } from 'lucide-react';
import { useApp } from '../../../contexts/context';
import { DefaultStylePrompt } from '../../../services/prompt';

interface StylePromptItem {
  nameEN: string;
  nameCN: string;
  image: string;
  prompt: string;
}

interface StyleSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export const StyleSelector: React.FC<StyleSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
}) => {
  const { t, settings } = useApp();

  return (
    <div className={`${className}`}>
      <div className="grid grid-cols-4 gap-1.5">
        {Object.entries(DefaultStylePrompt).map(([key, styleData]) => {
          const isSelected = value === key;
          const styleValue = styleData as StylePromptItem;
          return (
            <div
              key={key}
              className={`
                relative cursor-pointer group rounded-md overflow-hidden border-2 transition-all
                ${isSelected ? 'border-primary' : 'border-zinc-700 hover:border-zinc-600 hover:opacity-80'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              onClick={() => !disabled && onChange(isSelected ? '' : key)}
            >
              <div className="aspect-square w-full relative">
                <Image
                  src={styleValue.image}
                  alt={styleValue.nameEN}
                  className="w-full h-full object-cover"
                  radius="none"
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />

                {isSelected && (
                  <div className="absolute top-0.5 right-0.5 bg-primary rounded-full z-10 shadow-sm">
                    <CheckCircle2
                      size={12}
                      fill="currentColor"
                      className="text-primary-foreground"
                    />
                  </div>
                )}
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-0.5 bg-gradient-to-t from-black/90 to-transparent">
                <p className="text-[9px] text-white text-center font-medium truncate">
                  {settings.language === 'zh' ? styleValue.nameCN : styleValue.nameEN}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
