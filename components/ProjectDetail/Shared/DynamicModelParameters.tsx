import React from 'react';
import { Select, SelectItem, Input, Switch, Slider } from '@heroui/react';
import { useApp } from '../../../contexts/context';
import { ModelConfig } from '../../../types';
import { getUnifiedModelParams, getModelParamInfo } from '../../../services/modelUtils';

interface DynamicModelParametersProps {
  modelConfig: ModelConfig | undefined;
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  disabled?: boolean;
}

const HIDDEN_PARAMS = ['watermark', 'responseFormat', 'returnLastFrame', 'isRec'];

export const DynamicModelParameters: React.FC<DynamicModelParametersProps> = ({
  modelConfig,
  values,
  onChange,
  disabled = false,
}) => {
  const { t } = useApp();

  if (!modelConfig) return null;

  const paramKeys = getUnifiedModelParams(modelConfig).filter(key => !HIDDEN_PARAMS.includes(key));

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
    <div className="flex flex-col gap-1.5">
      {paramKeys.map(key => {
        const param = getModelParamInfo(modelConfig, key);
        if (!param) return null;

        const currentValue = values[key] ?? param.defaultValue;
        const label = getLabel(param, key);

        if (param.type === 'select') {
          const validOptions = param.options || [];
          const validValues = validOptions.map(opt => String(opt.value));
          const safeValue = currentValue ? String(currentValue) : '';
          const isValidValue = validValues.includes(safeValue);
          const finalSelectedKey = isValidValue ? safeValue : validValues[0] || '';

          return (
            <div key={key} className="space-y-1">
              <label className="text-[10px] font-semibold text-primary uppercase tracking-wide">
                {label}
              </label>
              <Select
                placeholder={label}
                selectedKeys={finalSelectedKey ? new Set([finalSelectedKey]) : new Set([])}
                onChange={e => onChange(key, e.target.value)}
                isDisabled={disabled}
                size="sm"
                aria-label={label}
                classNames={{ 
                  trigger: 'h-7 text-[11px] min-h-7 border border-zinc-700 data-[focus=true]:border-primary bg-zinc-900/50',
                  value: 'text-zinc-200',
                }}
              >
                {validOptions.map(opt => (
                  <SelectItem
                    key={String(opt.value)}
                    value={opt.value}
                    classNames={{ base: 'text-[11px]' }}
                  >
                    {getOptionLabel(opt)}
                  </SelectItem>
                ))}
              </Select>
            </div>
          );
        } else if (param.type === 'boolean') {
          return null;
        } else if (param.type === 'number') {
          return (
            <div key={key} className="space-y-1">
              <label className="text-[10px] font-semibold text-primary uppercase tracking-wide">
                {label}
              </label>
              <Input
                type="number"
                placeholder={label}
                value={String(currentValue)}
                onValueChange={v => onChange(key, Number(v))}
                min={param.min}
                max={param.max}
                step={param.step}
                isDisabled={disabled}
                size="sm"
                classNames={{ 
                  trigger: 'h-7 text-[11px] min-h-7', 
                  inputWrapper: 'h-7 min-h-7 border border-zinc-700 data-[focus=true]:border-lime-500 bg-zinc-900/50',
                  input: 'text-zinc-200',
                }}
              />
            </div>
          );
        } else {
          return (
            <div key={key} className="space-y-1">
              <label className="text-[10px] font-semibold text-primary uppercase tracking-wide">
                {label}
              </label>
              <Input
                placeholder={label}
                value={String(currentValue || '')}
                onValueChange={v => onChange(key, v)}
                isDisabled={disabled}
                size="sm"
                classNames={{ 
                  trigger: 'h-7 text-[11px] min-h-7', 
                  inputWrapper: 'h-7 min-h-7 border border-zinc-700 data-[focus=true]:border-lime-500 bg-zinc-900/50',
                  input: 'text-zinc-200',
                }}
              />
            </div>
          );
        }
      })}
    </div>
  );
};
