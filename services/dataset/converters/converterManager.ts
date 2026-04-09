import { DatasetConverter } from './baseConverter';
import { AnnotationData } from '../types';

export class ConverterManager {
  private converters: Map<string, DatasetConverter> = new Map();

  registerConverter(converter: DatasetConverter): void {
    this.converters.set(converter.name, converter);
    console.log(`✅ 注册转换器: ${converter.name} v${converter.version}`);
  }

  getConverter(name: string): DatasetConverter | undefined {
    return this.converters.get(name);
  }

  getAllConverters(): DatasetConverter[] {
    return Array.from(this.converters.values());
  }

  findCompatibleConverter(rawData: any): DatasetConverter | undefined {
    for (const converter of this.converters.values()) {
      if (converter.canConvert(rawData)) {
        return converter;
      }
    }
    return undefined;
  }

  async autoConvert(rawData: any): Promise<AnnotationData | null> {
    const converter = this.findCompatibleConverter(rawData);
    if (!converter) {
      console.warn('❌ 未找到兼容的转换器');
      return null;
    }
    console.log(`🎯 使用转换器: ${converter.name}`);
    return await converter.convert(rawData);
  }

  async convertWith(name: string, rawData: any): Promise<AnnotationData | null> {
    const converter = this.getConverter(name);
    if (!converter) {
      console.warn(`❌ 未找到转换器: ${name}`);
      return null;
    }
    return await converter.convert(rawData);
  }
}

export const converterManager = new ConverterManager();
