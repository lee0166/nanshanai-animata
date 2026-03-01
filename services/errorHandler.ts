/**
 * 错误处理服务
 * 将技术性错误转换为用户友好的提示
 */

export interface UserFriendlyError {
  title: string;
  message: string;
  action: string;
  severity: 'error' | 'warning' | 'info';
  actionLink?: string;
  detail?: string; // 开发环境显示的技术详情
}

export class ErrorHandler {
  /**
   * 错误映射表
   * 将技术错误映射为用户友好的提示
   */
  private static errorMap: Record<string, UserFriendlyError> = {
    // API 相关错误
    'Rate limit exceeded': {
      title: '请求过于频繁',
      message: 'API调用频率超限，请稍后再试',
      action: '等待30秒后重试',
      severity: 'warning'
    },
    'rate_limit': {
      title: '请求过于频繁',
      message: '已达到API调用频率限制，请稍后再试',
      action: '等待1分钟后重试',
      severity: 'warning'
    },
    'Invalid API key': {
      title: 'API密钥错误',
      message: '请检查模型配置中的API密钥是否正确',
      action: '前往设置页面检查',
      severity: 'error',
      actionLink: '/settings'
    },
    'invalid_api_key': {
      title: 'API密钥无效',
      message: 'API密钥已过期或无效，请更新密钥',
      action: '前往设置页面更新',
      severity: 'error',
      actionLink: '/settings'
    },
    'unauthorized': {
      title: '未授权',
      message: 'API密钥无效或已过期',
      action: '检查API密钥设置',
      severity: 'error',
      actionLink: '/settings'
    },
    
    // 内容相关错误
    'Content policy violation': {
      title: '内容不合规',
      message: '生成内容违反平台政策，请修改提示词',
      action: '修改提示词后重试',
      severity: 'warning'
    },
    'content_policy_violation': {
      title: '内容审核未通过',
      message: '提示词或生成内容包含敏感信息',
      action: '修改提示词，避免敏感内容',
      severity: 'warning'
    },
    'safety_filter': {
      title: '内容被安全过滤',
      message: '生成内容触发安全过滤器',
      action: '调整提示词，降低敏感程度',
      severity: 'warning'
    },
    
    // 网络相关错误
    'timeout': {
      title: '生成超时',
      message: '生成任务耗时过长，已自动取消',
      action: '尝试简化提示词或减少批量数量',
      severity: 'warning'
    },
    'ETIMEDOUT': {
      title: '连接超时',
      message: '连接AI服务超时，请检查网络',
      action: '检查网络后重试',
      severity: 'error'
    },
    'ECONNREFUSED': {
      title: '连接被拒绝',
      message: '无法连接到AI服务',
      action: '检查网络连接或API地址',
      severity: 'error'
    },
    'network_error': {
      title: '网络连接失败',
      message: '无法连接到AI服务，请检查网络',
      action: '检查网络连接后重试',
      severity: 'error'
    },
    'fetch failed': {
      title: '网络请求失败',
      message: '网络连接异常，请检查网络状态',
      action: '检查网络后重试',
      severity: 'error'
    },
    'Failed to fetch': {
      title: '网络请求失败',
      message: '无法连接到服务器，请检查网络',
      action: '检查网络连接',
      severity: 'error'
    },
    
    // 资源相关错误
    'insufficient_quota': {
      title: '额度不足',
      message: 'API调用额度已用完',
      action: '请充值或更换API密钥',
      severity: 'error'
    },
    'quota_exceeded': {
      title: '额度已用完',
      message: '本月API调用额度已耗尽',
      action: '等待下月重置或升级套餐',
      severity: 'warning'
    },
    
    // 服务器错误
    'Internal server error': {
      title: '服务器错误',
      message: 'AI服务暂时不可用，请稍后再试',
      action: '等待几分钟后重试',
      severity: 'error'
    },
    'internal_error': {
      title: '服务内部错误',
      message: 'AI服务遇到内部错误',
      action: '请稍后再试',
      severity: 'error'
    },
    'service_unavailable': {
      title: '服务不可用',
      message: 'AI服务暂时不可用',
      action: '请稍后再试',
      severity: 'error'
    },
    'bad_gateway': {
      title: '网关错误',
      message: 'AI服务网关异常',
      action: '请稍后再试',
      severity: 'error'
    },
    
    // 请求相关错误
    'Bad request': {
      title: '请求参数错误',
      message: '请求参数格式不正确',
      action: '检查输入参数后重试',
      severity: 'warning'
    },
    'invalid_request': {
      title: '请求无效',
      message: '请求格式或参数有误',
      action: '检查输入后重试',
      severity: 'warning'
    },
    'payload_too_large': {
      title: '请求过大',
      message: '上传的文件或提示词过长',
      action: '减小文件大小或缩短提示词',
      severity: 'warning'
    },
    
    // 模型相关错误
    'model_not_found': {
      title: '模型不存在',
      message: '指定的AI模型不存在或已下线',
      action: '选择其他可用模型',
      severity: 'error'
    },
    'model_overloaded': {
      title: '模型负载过高',
      message: '当前模型负载过高，请稍后再试',
      action: '等待几分钟后重试',
      severity: 'warning'
    },
    
    // 存储相关错误
    'storage_full': {
      title: '存储空间不足',
      message: '本地存储空间已满',
      action: '清理不必要的文件',
      severity: 'error'
    },
    'file_too_large': {
      title: '文件过大',
      message: '上传的文件超过大小限制',
      action: '压缩文件或分批上传',
      severity: 'warning'
    },
    
    // 解析相关错误
    'parse_error': {
      title: '解析失败',
      message: '无法解析AI返回的内容',
      action: '请重试，如问题持续请反馈',
      severity: 'warning'
    },
    'json_parse_error': {
      title: '数据解析错误',
      message: 'AI返回的数据格式异常',
      action: '请重试',
      severity: 'warning'
    }
  };

  /**
   * 处理错误，转换为用户友好的格式
   * @param error 原始错误
   * @returns 用户友好的错误信息
   */
  static handle(error: Error | string | unknown): UserFriendlyError {
    let errorMessage = '';
    
    // 提取错误信息
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      // 尝试从对象中提取错误信息
      const errObj = error as any;
      errorMessage = errObj.message || errObj.error || errObj.detail || JSON.stringify(error);
    }

    // 转换为小写进行匹配
    const lowerMessage = errorMessage.toLowerCase();

    // 1. 尝试精确匹配
    for (const [pattern, mappedError] of Object.entries(this.errorMap)) {
      if (errorMessage.includes(pattern)) {
        return this.addDetail(mappedError, errorMessage);
      }
    }

    // 2. 尝试模糊匹配（HTTP状态码）
    if (lowerMessage.includes('401') || lowerMessage.includes('unauthorized')) {
      return this.addDetail(this.errorMap['unauthorized'], errorMessage);
    }
    if (lowerMessage.includes('403') || lowerMessage.includes('forbidden')) {
      return this.addDetail({
        title: '访问被拒绝',
        message: '没有权限访问该资源',
        action: '检查API密钥权限',
        severity: 'error'
      }, errorMessage);
    }
    if (lowerMessage.includes('404') || lowerMessage.includes('not found')) {
      return this.addDetail({
        title: '资源不存在',
        message: '请求的资源不存在',
        action: '检查资源ID或路径',
        severity: 'error'
      }, errorMessage);
    }
    if (lowerMessage.includes('429') || lowerMessage.includes('too many requests')) {
      return this.addDetail(this.errorMap['rate_limit'], errorMessage);
    }
    if (lowerMessage.includes('500') || lowerMessage.includes('internal server')) {
      return this.addDetail(this.errorMap['Internal server error'], errorMessage);
    }
    if (lowerMessage.includes('502') || lowerMessage.includes('bad gateway')) {
      return this.addDetail(this.errorMap['bad_gateway'], errorMessage);
    }
    if (lowerMessage.includes('503') || lowerMessage.includes('service unavailable')) {
      return this.addDetail(this.errorMap['service_unavailable'], errorMessage);
    }
    if (lowerMessage.includes('504') || lowerMessage.includes('gateway timeout')) {
      return this.addDetail({
        title: '网关超时',
        message: '服务器响应超时',
        action: '请稍后再试',
        severity: 'error'
      }, errorMessage);
    }

    // 3. 尝试关键词匹配
    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
      return this.addDetail(this.errorMap['timeout'], errorMessage);
    }
    if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
      return this.addDetail(this.errorMap['network_error'], errorMessage);
    }
    if (lowerMessage.includes('quota') || lowerMessage.includes('limit')) {
      return this.addDetail(this.errorMap['quota_exceeded'], errorMessage);
    }
    if (lowerMessage.includes('content') || lowerMessage.includes('policy') || lowerMessage.includes('safety')) {
      return this.addDetail(this.errorMap['content_policy_violation'], errorMessage);
    }
    if (lowerMessage.includes('api key') || lowerMessage.includes('apikey') || lowerMessage.includes('unauthorized')) {
      return this.addDetail(this.errorMap['Invalid API key'], errorMessage);
    }

    // 4. 未知错误，返回通用提示
    return this.addDetail({
      title: '操作失败',
      message: '遇到未知错误，请稍后重试',
      action: '如果问题持续，请查看控制台日志或联系支持',
      severity: 'error'
    }, errorMessage);
  }

  /**
   * 添加技术详情（仅在开发环境）
   */
  private static addDetail(mappedError: UserFriendlyError, originalMessage: string): UserFriendlyError {
    // 在开发环境添加原始错误信息
    if (process.env.NODE_ENV === 'development') {
      return {
        ...mappedError,
        detail: originalMessage
      };
    }
    return mappedError;
  }

  /**
   * 批量处理多个错误
   * @param errors 错误列表
   * @returns 汇总后的错误信息
   */
  static handleMultiple(errors: (Error | string | unknown)[]): UserFriendlyError {
    if (errors.length === 0) {
      return {
        title: '未知错误',
        message: '发生未知错误',
        action: '请重试',
        severity: 'error'
      };
    }

    if (errors.length === 1) {
      return this.handle(errors[0]);
    }

    // 统计错误类型
    const handled = errors.map(e => this.handle(e));
    const errorCount = handled.length;
    const errorTypes = new Set(handled.map(h => h.title));

    if (errorTypes.size === 1) {
      // 所有错误类型相同
      const first = handled[0];
      return {
        ...first,
        title: `${first.title} (${errorCount}次)`,
        message: `共发生${errorCount}次相同错误: ${first.message}`
      };
    }

    // 多种错误类型
    return {
      title: `多项操作失败`,
      message: `共${errorCount}项操作失败，包含${errorTypes.size}种错误类型`,
      action: '请查看详细错误信息',
      severity: 'error'
    };
  }
}

export default ErrorHandler;
