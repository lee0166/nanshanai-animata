import DOMPurify from 'dompurify';

/**
 * XSS 防护工具函数
 * 用于转义用户输入，防止 XSS 攻击
 */

/**
 * 清理纯文本 - 移除所有 HTML 标签
 * @param text - 需要清理的文本
 * @returns 清理后的安全文本
 */
export const sanitizeText = (text: string): string => {
  if (!text) return '';
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
};

/**
 * 清理 HTML - 保留允许的标签
 * @param html - 需要清理的 HTML
 * @param allowedTags - 允许保留的标签列表
 * @returns 清理后的安全 HTML
 */
export const sanitizeHtml = (html: string, allowedTags?: string[]): string => {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: allowedTags || ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: ['class', 'style'],
  });
};

/**
 * 清理错误消息 - 移除敏感信息
 * @param message - 错误消息
 * @returns 清理后的安全消息
 */
export const sanitizeErrorMessage = (message: string): string => {
  if (!message) return '发生错误';

  // 移除 API 密钥
  let sanitized = message.replace(/sk-[a-zA-Z0-9]{32}/g, 'API_KEY_REDACTED');
  sanitized = sanitized.replace(/Bearer [a-zA-Z0-9._-]+/g, 'TOKEN_REDACTED');

  // 移除路径
  sanitized = sanitized.replace(/\/[a-zA-Z0-9_\/]+\.[a-z]+/g, '/path/REDACTED');

  // 移除邮箱
  sanitized = sanitized.replace(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, 'EMAIL_REDACTED');

  return sanitized;
};
