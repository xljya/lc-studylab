/**
 * 消息管理器
 * 管理聊天消息的状态，处理流式更新
 */

import type {
  EnhancedMessage,
  ToolCall,
  Source,
  Reasoning,
  Plan,
  Task,
  QueueItem,
  ContextUsage,
  Citation,
  ChainOfThought,
  JsonValue,
} from './types';

export class MessageManager {
  private messages: Map<string, EnhancedMessage>;
  private listeners: Set<() => void>;

  constructor() {
    this.messages = new Map();
    this.listeners = new Set();
  }

  /**
   * 订阅消息变化
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 通知所有监听器
   */
  private notify() {
    this.listeners.forEach(listener => listener());
  }

  /**
   * 获取所有消息
   */
  getAllMessages(): EnhancedMessage[] {
    return Array.from(this.messages.values()).sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
  }

  /**
   * 获取单个消息
   */
  getMessage(id: string): EnhancedMessage | undefined {
    return this.messages.get(id);
  }

  /**
   * 添加新消息
   */
  addMessage(message: EnhancedMessage): void {
    this.messages.set(message.id, message);
    this.notify();
  }

  /**
   * 批量添加消息
   */
  addMessages(messages: EnhancedMessage[]): void {
    messages.forEach(msg => this.messages.set(msg.id, msg));
    this.notify();
  }

  /**
   * 更新消息
   */
  updateMessage(id: string, updates: Partial<EnhancedMessage>): void {
    const message = this.messages.get(id);
    if (message) {
      Object.assign(message, updates);
      this.notify();
    }
  }

  /**
   * 追加内容到消息
   */
  appendContent(id: string, content: string): void {
    const message = this.messages.get(id);
    if (message) {
      message.content += content;
      this.notify();
    }
  }

  /**
   * 设置消息内容
   */
  setContent(id: string, content: string): void {
    const message = this.messages.get(id);
    if (message) {
      message.content = content;
      this.notify();
    }
  }

  /**
   * 添加工具调用
   */
  addToolCall(id: string, tool: ToolCall): void {
    const message = this.messages.get(id);
    if (message) {
      if (!message.tools) {
        message.tools = [];
      }
      message.tools.push(tool);
      this.notify();
    }
  }

  /**
   * 更新工具调用结果
   */
  updateToolResult(messageId: string, toolId: string, updates: Partial<ToolCall>): void {
    const message = this.messages.get(messageId);
    if (message?.tools) {
      const tool = message.tools.find(t => t.id === toolId);
      if (tool) {
        Object.assign(tool, updates);
        this.notify();
      }
    }
  }

  /**
   * 添加来源
   */
  addSource(id: string, source: Source): void {
    const message = this.messages.get(id);
    if (message) {
      if (!message.sources) {
        message.sources = [];
      }
      message.sources.push(source);
      this.notify();
    }
  }

  /**
   * 批量添加来源
   */
  addSources(id: string, sources: Source[]): void {
    const message = this.messages.get(id);
    if (message) {
      if (!message.sources) {
        message.sources = [];
      }
      message.sources.push(...sources);
      this.notify();
    }
  }

  /**
   * 设置推理信息
   */
  setReasoning(id: string, reasoning: Reasoning): void {
    const message = this.messages.get(id);
    if (message) {
      message.reasoning = reasoning;
      this.notify();
    }
  }

  /**
   * 设置计划
   */
  setPlan(id: string, plan: Plan): void {
    const message = this.messages.get(id);
    if (message) {
      message.plan = plan;
      this.notify();
    }
  }

  /**
   * 添加任务
   */
  addTask(id: string, task: Task): void {
    const message = this.messages.get(id);
    if (message) {
      if (!message.tasks) {
        message.tasks = [];
      }
      message.tasks.push(task);
      this.notify();
    }
  }

  /**
   * 批量添加任务
   */
  addTasks(id: string, tasks: Task[]): void {
    const message = this.messages.get(id);
    if (message) {
      if (!message.tasks) {
        message.tasks = [];
      }
      message.tasks.push(...tasks);
      this.notify();
    }
  }

  /**
   * 设置队列
   */
  setQueue(id: string, queue: QueueItem[]): void {
    const message = this.messages.get(id);
    if (message) {
      message.queue = queue;
      this.notify();
    }
  }

  /**
   * 设置上下文使用信息
   */
  setContextUsage(id: string, contextUsage: ContextUsage): void {
    const message = this.messages.get(id);
    if (message) {
      message.contextUsage = contextUsage;
      this.notify();
    }
  }

  /**
   * 添加引用
   */
  addCitation(id: string, citation: Citation): void {
    const message = this.messages.get(id);
    if (message) {
      if (!message.citations) {
        message.citations = [];
      }
      message.citations.push(citation);
      this.notify();
    }
  }

  /**
   * 批量添加引用
   */
  addCitations(id: string, citations: Citation[]): void {
    const message = this.messages.get(id);
    if (message) {
      if (!message.citations) {
        message.citations = [];
      }
      message.citations.push(...citations);
      this.notify();
    }
  }

  /**
   * 设置/合并 metadata
   */
  setMetadata(id: string, updates: Record<string, JsonValue | undefined>): void {
    const message = this.messages.get(id);
    if (message) {
      if (!message.metadata) {
        message.metadata = {};
      }
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined) {
          delete message.metadata![key];
        } else {
          message.metadata![key] = value;
        }
      });
      this.notify();
    }
  }

  /**
   * 设置思维链
   */
  setChainOfThought(id: string, chainOfThought: ChainOfThought): void {
    const message = this.messages.get(id);
    if (message) {
      message.chainOfThought = chainOfThought;
      this.notify();
    }
  }

  /**
   * 删除消息
   */
  deleteMessage(id: string): void {
    this.messages.delete(id);
    this.notify();
  }

  /**
   * 清空所有消息
   */
  clear(): void {
    this.messages.clear();
    this.notify();
  }

  /**
   * 获取消息数量
   */
  getMessageCount(): number {
    return this.messages.size;
  }

  /**
   * 检查消息是否存在
   */
  hasMessage(id: string): boolean {
    return this.messages.has(id);
  }

  /**
   * 获取最后一条消息
   */
  getLastMessage(): EnhancedMessage | undefined {
    const messages = this.getAllMessages();
    return messages[messages.length - 1];
  }

  /**
   * 获取最后一条 AI 消息
   */
  getLastAssistantMessage(): EnhancedMessage | undefined {
    const messages = this.getAllMessages();
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        return messages[i];
      }
    }
    return undefined;
  }

  /**
   * 从 JSON 恢复消息
   */
  fromJSON(json: string): void {
    try {
      const data: unknown = JSON.parse(json);
      if (Array.isArray(data)) {
        this.messages.clear();
        data.forEach((rawMessage) => {
          if (!rawMessage || typeof rawMessage !== 'object') {
            return;
          }

          const msg = rawMessage as EnhancedMessage & { timestamp?: string | Date };
          // 转换日期字符串为 Date 对象
          if (msg.timestamp) {
            msg.timestamp = new Date(msg.timestamp);
          }
          if (typeof msg.id === 'string') {
            this.messages.set(msg.id, msg as EnhancedMessage);
          }
        });
        this.notify();
      }
    } catch (error) {
      console.error('Failed to restore messages from JSON:', error);
    }
  }

  /**
   * 导出为 JSON
   */
  toJSON(): string {
    return JSON.stringify(this.getAllMessages());
  }

  /**
   * 保存到 localStorage
   */
  saveToLocalStorage(key: string = 'chat-messages'): void {
    try {
      localStorage.setItem(key, this.toJSON());
    } catch (error) {
      console.error('Failed to save messages to localStorage:', error);
    }
  }

  /**
   * 从 localStorage 加载
   */
  loadFromLocalStorage(key: string = 'chat-messages'): void {
    try {
      const json = localStorage.getItem(key);
      if (json) {
        this.fromJSON(json);
      }
    } catch (error) {
      console.error('Failed to load messages from localStorage:', error);
    }
  }
}

/**
 * 创建消息管理器实例
 */
export function createMessageManager(): MessageManager {
  return new MessageManager();
}
