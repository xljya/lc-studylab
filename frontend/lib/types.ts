/**
 * 前端类型定义 - 增强版
 * 支持所有 AI Elements 组件所需的数据结构
 */

import type { ToolUIPart } from "ai";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

// 后端模式类型
export type AgentMode =
  | "basic-agent"
  | "rag"
  | "workflow"
  | "deep-research"
  | "guarded"
  | "interview";

// 会话类型
export interface Session {
  id: string;
  title: string;
  mode: AgentMode;
  threadId?: string; // 后端 LangGraph/DeepAgents thread_id
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

// ===== 增强的消息类型 =====

// 消息版本（支持分支）
export interface MessageVersion {
  id: string;
  content: string;
  createdAt: Date;
}

// 推理过程
export interface Reasoning {
  content: string;
  duration: number; // 秒
}

// 工具调用（映射 AI SDK ToolUIPart）
export interface ToolCall {
  id: string;
  name: string;
  description?: string;
  type: string; // e.g., "tool-call-get_time"
  state: ToolUIPart["state"];
  parameters: Record<string, any>;
  result?: any;
  error?: string;
  requiresApproval?: boolean;
}

// RAG 来源
export interface Source {
  href: string;
  title: string;
  content?: string;
  similarity?: number;
  metadata?: Record<string, any>;
}

// 内联引用
export interface Citation {
  index: number;
  href?: string;
  title?: string;
  position: number; // 在文本中的位置
  text: string; // e.g., "[1]"
}

// 计划
export interface Plan {
  title: string;
  description: string;
  steps: PlanStep[];
  isStreaming?: boolean;
}

// 计划步骤
export interface PlanStep {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  order?: number;
}

// 任务
export interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  files?: string[]; // 关联的文件
}

// 队列项目
export interface QueueItem {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "completed";
  type?: "message" | "todo" | "file";
  parts?: any[]; // 如果是消息类型
}

// 思维链
export interface ChainOfThought {
  steps: ChainOfThoughtStep[];
}

export interface ChainOfThoughtStep {
  id: string;
  label: string;
  description?: string;
  status: "complete" | "active" | "pending";
  icon?: string;
  searchResults?: any[];
  image?: {
    url: string;
    caption?: string;
  };
}

// 上下文使用情况
export interface ContextUsage {
  usedTokens: number;
  maxTokens: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    cachedInputTokens?: number;
  };
  modelId: string;
  percentage?: number;
}

// 检查点
export interface Checkpoint {
  id: string;
  label: string;
  tooltip?: string;
  threadId?: string;
  timestamp: number;
  state?: Record<string, any>;
}

// 增强的消息类型
export interface EnhancedMessage {
  // 基础字段
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;

  // 分支管理
  versions?: MessageVersion[];
  currentVersionIndex?: number;

  // AI Elements 组件数据
  chainOfThought?: ChainOfThought;
  reasoning?: Reasoning;
  tools?: ToolCall[];
  sources?: Source[];
  citations?: Citation[];
  plan?: Plan;
  tasks?: Task[];
  queue?: QueueItem[];
  contextUsage?: ContextUsage;
  checkpoints?: Checkpoint[];

  // 元数据
  metadata?: Record<string, any>;
}

// ===== 流式数据类型 =====

// SSE 流式数据块
export type StreamChunk =
  | { type: "start"; message: string }
  | { type: "chunk"; content: string }
  | { type: "tool"; data: ToolCall }
  | { type: "tool_result"; data: ToolCall }
  | { type: "reasoning"; data: Reasoning }
  | { type: "source"; data: Source }
  | { type: "sources"; data: Source[] }
  | { type: "plan"; data: Plan }
  | { type: "task"; data: Task }
  | { type: "queue"; data: QueueItem[] }
  | { type: "context"; data: ContextUsage }
  | { type: "citation"; data: Citation }
  | { type: "chainOfThought"; data: ChainOfThought }
  | { type: "suggestions"; data: string[] }
  | { type: "end"; message: string }
  | { type: "error"; message: string; error: string };

// API 请求
export interface ChatRequest {
  message: string;
  chat_history?: Array<{ role: string; content: string }>;
  mode?: string;
  threadId?: string;
  sessionId?: string;
  use_tools?: boolean;
  config?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

// 消息元数据（用于 AI Elements 组件）
export interface MessageMetadata {
  sources?: Source[];
  tools?: ToolCall[];
  reasoning?: string;
  plan?: PlanStep[];
  task?: Task;
  checkpoint?: Checkpoint;
  chainOfThought?: string;
}

// API 响应
export interface ChatResponse {
  message: string;
  metadata?: MessageMetadata;
  threadId?: string;
  error?: string;
}

// 模型配置
export interface ModelConfig {
  provider: "openai" | "anthropic" | "google" | "deepseek";
  model: string;
  displayName: string;
  maxTokens: number;
}

// 应用配置
export interface AppConfig {
  backendUrl: string;
  defaultModel: ModelConfig;
  enableGuardrails: boolean;
  streamingEnabled: boolean;
}

export interface InterviewQuestion {
  question: string;
  intent: string;
  answer_tips: string[];
}

export interface PreparationTask {
  title: string;
  why: string;
  action: string;
  priority: "high" | "medium" | "low";
}

export interface InterviewKitSummary {
  id: string;
  created_at: string;
  candidate_name?: string | null;
  target_role: string;
  company_name?: string | null;
  role_fit_score: number;
  summary: string;
  strengths: string[];
}

export interface InterviewKit extends InterviewKitSummary {
  resume_text: string;
  job_description: string;
  focus_areas: string[];
  risks: string[];
  focus_points: string[];
  self_intro: string;
  project_story: string;
  likely_questions: InterviewQuestion[];
  prep_plan: PreparationTask[];
  suggested_followups: string[];
  metrics?: {
    model_id: string;
    generation_ms: number;
    input_chars: number;
    output_chars: number;
    input_tokens: number;
    output_tokens: number;
    reasoning_tokens: number;
    cached_input_tokens: number;
    total_tokens: number;
    estimated_cost_usd: number;
  };
}

export interface CreateInterviewKitRequest {
  candidate_name?: string;
  target_role: string;
  company_name?: string;
  resume_text: string;
  job_description: string;
  model_id?: "gpt-4o" | "gpt-4o-mini" | "deepseek-chat" | "deepseek-reasoner";
  focus_areas?: string[];
}

export interface CountStat {
  label: string;
  count: number;
}

export interface DailyInterviewStat {
  date: string;
  count: number;
  average_score: number;
}

export interface InterviewStats {
  total_kits: number;
  average_role_fit_score: number;
  high_fit_count: number;
  recent_7d_count: number;
  average_generation_ms: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_estimated_cost_usd: number;
  top_focus_areas: CountStat[];
  top_target_roles: CountStat[];
  recent_activity: DailyInterviewStat[];
}

export interface AuthUser {
  id: string;
  email: string;
  display_name?: string | null;
  created_at: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  display_name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  user: AuthUser;
}
