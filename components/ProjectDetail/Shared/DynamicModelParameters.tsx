import React from 'react';
import { Select, SelectItem, Input, Switch, Slider } from "@heroui/react";
import { useApp } from '../../../contexts/context';
import { ModelConfig } from '../../../types';
import { getUnifiedModelParams, getModelParamInfo } from '../../../services/modelUtils';

interface DynamicModelParametersProps {
    modelConfig: ModelConfig | undefined;
    values: Record<string, any>;
    onChange: (key: string, value: any) => void;
    disabled?: boolean;
}

export const DynamicModelParameters: React.FC<DynamicModelParametersProps> = ({
    modelConfig,
    values,
    onChange,
    disabled = false
}) => {
    const { t } = useApp();
    
    if (!modelConfig) return null;

    const paramKeys = getUnifiedModelParams(modelConfig);

    // Helper to get translation
    const getLabel = (param: any, key: string) => {
        // Try to translate the key directly from aiParams
        const translated = (t.aiParams as any)[key];
        if (translated && typeof translated === 'string') return translated;
        return param.label || key;
    };

    const getDescription = (param: any, key: string) => {
        // Try to get description from aiParams (key + 'Desc')
        const descKey = `${key}Desc`;
        let translated = (t.aiParams as any)[descKey];
        if (!translated || typeof translated !== 'string') {
            translated = param.description;
        }

        if (key === 'voiceId') {
            return (
                <span>
                    {translated}
                    <a 
                        href="https://shengshu.feishu.cn/sheets/EgFvs6DShhiEBStmjzccr5gonOg" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-primary underline ml-1"
                    >
                        查看
                    </a>
                </span>
            );
        }

        return translated;
    };

    const getOptionLabel = (opt: any) => {
        const translated = (t.aiParams.options as any)[opt.value];
        if (translated && typeof translated === 'string') return translated;
        return opt.label;
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {paramKeys.map(key => {
                    const param = getModelParamInfo(modelConfig, key);
                    if (!param) return null;

                    const currentValue = values[key] ?? param.defaultValue;
                    const label = getLabel(param, key);
                    const description = getDescription(param, key);
                    
                    if (param.type === 'select') {
                        return (
                            <div key={key} className="flex flex-col gap-2 col-span-1">
                                <label className="text-slate-600 dark:text-slate-400 font-bold text-[13px] ml-1">{label}</label>
                                <Select
                                    placeholder={label}
                                    selectedKeys={currentValue ? [String(currentValue)] : []}
                                    onChange={(e) => onChange(key, e.target.value)}
                                    variant="bordered"
                                    radius="lg"
                                    isDisabled={disabled}
                                    aria-label={label}
                                    classNames={{ 
                                        value: "font-bold text-sm",
                                        trigger: "border-2 data-[focus=true]:border-primary"
                                    }}
                                >
                                    {(param.options || []).map(opt => (
                                        <SelectItem key={String(opt.value)} textValue={getOptionLabel(opt)}>
                                            {getOptionLabel(opt)}
                                        </SelectItem>
                                    ))}
                                </Select>
                            </div>
                        );
                    } else if (param.type === 'boolean') {
                         return (
                             <div key={key} className="flex flex-col gap-2 col-span-1 md:col-span-2">
                                <div className="flex items-center justify-between px-3 py-2 border rounded-medium border-default-200 hover:border-default-400 transition-colors bg-default-50">
                                    <div className="flex flex-col">
                                        <span className="text-[15px] text-foreground font-bold ml-1">{label}</span>
                                        {description && <span className="text-tiny text-foreground-400 ml-1">{description}</span>}
                                    </div>
                                    <Switch 
                                        size="sm" 
                                        isSelected={!!currentValue} 
                                        onValueChange={(v) => onChange(key, v)} 
                                        aria-label={label}
                                        isDisabled={disabled}
                                        color="primary"
                                    />
                                </div>
                             </div>
                        );
                    } else if (param.type === 'number') {
                        return (
                            <div key={key} className="flex flex-col gap-2 col-span-1">
                                <label className="text-slate-600 dark:text-slate-400 font-bold text-[13px] ml-1">{label}</label>
                                <Input
                                    type="number"
                                    placeholder={label}
                                    value={String(currentValue)}
                                    onValueChange={(v) => onChange(key, Number(v))}
                                    min={param.min}
                                    max={param.max}
                                    step={param.step}
                                    variant="bordered"
                                    radius="lg"
                                    isDisabled={disabled}
                                    description={description}
                                    aria-label={label}
                                    classNames={{ 
                                        input: "font-bold text-sm",
                                        inputWrapper: "border-2 group-data-[focus=true]:border-primary"
                                    }}
                                />
                            </div>
                        );
                    } else {
                         return (
                            <div key={key} className="flex flex-col gap-2 col-span-1">
                                <label className="text-slate-600 dark:text-slate-400 font-bold text-[13px] ml-1">{label}</label>
                                <Input
                                    placeholder={label}
                                    value={String(currentValue || '')}
                                    onValueChange={(v) => onChange(key, v)}
                                    variant="bordered"
                                    radius="lg"
                                    isDisabled={disabled}
                                    description={description}
                                    aria-label={label}
                                    classNames={{ 
                                        input: "font-bold text-sm",
                                        inputWrapper: "border-2 group-data-[focus=true]:border-primary"
                                    }}
                                />
                            </div>
                        );
                    }
                })}
            </div>
        </div>
    );
}
