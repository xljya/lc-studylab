/**
 * 会话管理工具
 */

import { Session, AgentMode } from './types';
import { nanoid } from 'nanoid';

const SESSIONS_KEY = 'lc-studylab-sessions';
const CURRENT_SESSION_KEY = 'lc-studylab-current-session';

/**
 * 获取所有会话
 */
export function getSessions(): Session[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const data = localStorage.getItem(SESSIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load sessions:', error);
    return [];
  }
}

/**
 * 保存会话
 */
export function saveSessions(sessions: Session[]): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error('Failed to save sessions:', error);
  }
}

/**
 * 创建新会话
 */
export function createSession(mode: AgentMode, title?: string): Session {
  const session: Session = {
    id: nanoid(),
    title: title || `新对话 - ${getModeLabel(mode)}`,
    mode,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messageCount: 0,
  };
  
  const sessions = getSessions();
  sessions.unshift(session);
  saveSessions(sessions);
  setCurrentSession(session.id);
  
  return session;
}

/**
 * 更新会话
 */
export function updateSession(sessionId: string, updates: Partial<Session>): void {
  const sessions = getSessions();
  const index = sessions.findIndex(s => s.id === sessionId);
  
  if (index !== -1) {
    sessions[index] = {
      ...sessions[index],
      ...updates,
      updatedAt: Date.now(),
    };
    saveSessions(sessions);
  }
}

/**
 * 删除会话
 */
export function deleteSession(sessionId: string): void {
  const sessions = getSessions();
  const filtered = sessions.filter(s => s.id !== sessionId);
  saveSessions(filtered);
  
  // 如果删除的是当前会话，清除当前会话标记
  if (getCurrentSessionId() === sessionId) {
    clearCurrentSession();
  }
}

/**
 * 获取当前会话 ID
 */
export function getCurrentSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CURRENT_SESSION_KEY);
}

/**
 * 设置当前会话
 */
export function setCurrentSession(sessionId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CURRENT_SESSION_KEY, sessionId);
}

/**
 * 清除当前会话
 */
export function clearCurrentSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CURRENT_SESSION_KEY);
}

/**
 * 获取当前会话
 */
export function getCurrentSession(): Session | null {
  const sessionId = getCurrentSessionId();
  if (!sessionId) return null;
  
  const sessions = getSessions();
  return sessions.find(s => s.id === sessionId) || null;
}

/**
 * 按模式过滤会话
 */
export function getSessionsByMode(mode: AgentMode): Session[] {
  return getSessions().filter(s => s.mode === mode);
}

/**
 * 获取模式标签
 */
export function getModeLabel(mode: AgentMode): string {
  const labels: Record<AgentMode, string> = {
    'basic-agent': '基础对话',
    'rag': 'RAG 问答',
    'workflow': '学习工作流',
    'deep-research': '深度研究',
    'guarded': '安全模式',
    'interview': 'AI 面试助手',
  };
  return labels[mode] || mode;
}

/**
 * 获取模式描述
 */
export function getModeDescription(mode: AgentMode): string {
  const descriptions: Record<AgentMode, string> = {
    'basic-agent': '基础智能体对话，支持工具调用',
    'rag': '基于文档的问答，支持来源引用',
    'workflow': 'LangGraph 学习任务工作流',
    'deep-research': 'DeepAgents 深度研究模式',
    'guarded': '带安全过滤的对话模式',
    'interview': '根据简历和 JD 生成面试准备包',
  };
  return descriptions[mode] || '';
}
