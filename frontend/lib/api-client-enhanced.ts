/**
 * 增强的 API 客户端
 * 支持解析后端的增强 SSE 流
 */

import type { ChatRequest, StreamChunk } from './types';

// 聊天页统一走 Next.js 代理，避免浏览器在远程访问 VPS 时直连 localhost
const CHAT_API_URL = '/api/chat';
const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * 增强的流式聊天客户端
 * 
 * 解析后端返回的多种 SSE 事件类型:
 * - start: 开始生成
 * - chunk: 内容块
 * - tool: 工具调用
 * - tool_result: 工具结果
 * - reasoning: 推理过程
 * - source/sources: 来源引用
 * - plan: AI 计划
 * - task: 任务
 * - queue: 队列
 * - context: Token 使用统计
 * - end: 生成完成
 * - error: 错误
 * 
 * @param request 聊天请求
 * @returns AsyncGenerator 异步生成器，逐个产出 StreamChunk
 * 
 * @example
 * ```typescript
 * for await (const chunk of chatStreamEnhanced({ message: "你好" })) {
 *   switch (chunk.type) {
 *     case 'chunk':
 *       console.log(chunk.content);
 *       break;
 *     case 'tool':
 *       console.log('工具调用:', chunk.data.name);
 *       break;
 *     case 'context':
 *       console.log('Token使用:', chunk.data.usedTokens);
 *       break;
 *   }
 * }
 * ```
 */
export async function* chatStreamEnhanced(
  request: ChatRequest
): AsyncGenerator<StreamChunk, void, unknown> {
  const url = CHAT_API_URL;
  
  let response: Response;
  
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }
  } catch (error) {
    console.error('Failed to initiate chat stream:', error);
    throw error;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }

      // 解码数据块
      buffer += decoder.decode(value, { stream: true });
      
      // 按行分割
      const lines = buffer.split('\n');
      
      // 保留最后一个不完整的行
      buffer = lines.pop() || '';

      // 处理每一行
      for (const line of lines) {
        // SSE 格式: "data: {JSON}\n"
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6); // 移除 "data: " 前缀
          
          if (dataStr.trim()) {
            try {
              const data = JSON.parse(dataStr);
              yield data as StreamChunk;
            } catch (parseError) {
              console.error('Failed to parse SSE data:', dataStr, parseError);
              // 继续处理下一行，不中断流
            }
          }
        }
      }
    }

    // 处理剩余的 buffer
    if (buffer.trim()) {
      if (buffer.startsWith('data: ')) {
        const dataStr = buffer.slice(6);
        if (dataStr.trim()) {
          try {
            const data = JSON.parse(dataStr);
            yield data as StreamChunk;
          } catch (parseError) {
            console.error('Failed to parse remaining buffer:', dataStr, parseError);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error reading stream:', error);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

/**
 * 非流式聊天接口
 * 
 * @param request 聊天请求
 * @returns Promise<ChatResponse>
 */
export async function chatNonStreaming(request: ChatRequest) {
  const url = `${BACKEND_API_URL}/chat`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * 带重试的流式聊天客户端
 * 
 * @param request 聊天请求
 * @param options 选项
 * @returns AsyncGenerator
 */
export async function* chatStreamWithRetry(
  request: ChatRequest,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): AsyncGenerator<StreamChunk, void, unknown> {
  const { maxRetries = 3, retryDelay = 1000, onRetry } = options;
  
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      yield* chatStreamEnhanced(request);
      return; // 成功完成，退出
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        // 还有重试机会
        if (onRetry) {
          onRetry(attempt + 1, lastError);
        }
        
        console.warn(`Stream failed, retrying (${attempt + 1}/${maxRetries})...`, error);
        
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }
  }

  // 所有重试都失败了
  throw new Error(`Failed after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * 健康检查
 */
export async function healthCheck(): Promise<{ status: string; version: string }> {
  const response = await fetch(`${BACKEND_API_URL}/health`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }

  return response.json();
}

/**
 * 获取可用的 Agent 模式列表
 */
export async function getAvailableModes(): Promise<{
  modes: Record<string, string>;
  default: string;
}> {
  const response = await fetch(`${BACKEND_API_URL}/chat/modes`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Failed to get modes: ${response.status}`);
  }

  return response.json();
}
