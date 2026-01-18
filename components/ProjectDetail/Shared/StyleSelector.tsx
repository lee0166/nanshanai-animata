import React from 'react';
import { 
    Accordion,
    AccordionItem,
    Image
} from "@heroui/react";
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
    className = ""
}) => {
    const { t, settings } = useApp();

    return (
        <Accordion className={`px-0 ${className}`} motionProps={{}}>
            <AccordionItem 
                key="style" 
                aria-label={t.aiParams?.style || 'Style'} 
                title={
                    <div className="flex items-center gap-2">
                        <span className="text-slate-300 font-bold text-base">{t.aiParams?.style || 'Style'}</span>
                        {value && (
                            <span className="text-tiny text-blue-400 ml-1 font-normal">
                                {settings.language === 'zh' 
                                    ? (DefaultStylePrompt as Record<string, StylePromptItem>)[value]?.nameCN 
                                    : (DefaultStylePrompt as Record<string, StylePromptItem>)[value]?.nameEN}
                            </span>
                        )}
                    </div>
                }
                classNames={{
                    trigger: "py-2"
                }}
            >
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pb-2">
                    {Object.entries(DefaultStylePrompt).map(([key, styleData]) => {
                        const isSelected = value === key;
                        const styleValue = styleData as StylePromptItem;
                        return (
                            <div 
                                key={key}
                                className={`
                                    relative cursor-pointer group rounded-lg overflow-hidden border-2 transition-all
                                    ${isSelected ? 'border-success' : 'border-transparent hover:border-default-200'}
                                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                                `}
                                onClick={() => !disabled && onChange(isSelected ? '' : key)}
                            >
                                <div className="aspect-[4/3] w-full relative">
                                    <Image 
                                        src={styleValue.image} 
                                        alt={styleValue.nameEN}
                                        className="w-full h-full object-cover"
                                        radius="none"
                                    />
                                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                                    
                                    {isSelected && (
                                        <div className="absolute top-1 left-1 bg-white rounded-full z-10 shadow-sm text-success">
                                            <CheckCircle2 size={16} fill="currentColor" className="text-success fill-white" />
                                        </div>
                                    )}
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/80 to-transparent">
                                    <p className="text-[10px] text-white text-center font-medium truncate">
                                        {settings.language === 'zh' ? styleValue.nameCN : styleValue.nameEN}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </AccordionItem>
        </Accordion>
    );
};
