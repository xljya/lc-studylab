/**
 * 增强的聊天组件
 * 集成 useEnhancedChat Hook 和 EnhancedMessageRenderer
 */

"use client";

import React, { useRef, useEffect } from 'react';
import { useEnhancedChat } from '@/hooks/use-enhanced-chat';
import { EnhancedMessageRenderer } from './enhanced-message-renderer';
// 注意：我们不使用 Conversation 组件，因为有自己的滚动实现
// import {
//   Conversation,
//   ConversationContent,
//   ConversationScrollButton,
// } from '@/components/ai-elements/conversation';
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputSubmit,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input';
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from '@/components/ai-elements/model-selector';
import { Suggestions, Suggestion } from '@/components/ai-elements/suggestion';
import { toast } from 'sonner';
import { CheckIcon } from 'lucide-react';

export interface ChatEnhancedProps {
  /**
   * Agent 模式
   */
  mode?: string;
  
  /**
   * 是否启用工具
   */
  useTools?: boolean;
  
  /**
   * 滚动状态变化回调
   */
  onScrollChange?: (isScrolled: boolean) => void;
}

const AVAILABLE_MODELS = [
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    chef: 'DeepSeek',
    chefSlug: 'deepseek',
  },
];

// 建议由模型通过流事件提供，不再使用本地写死或关键词推断

export function ChatEnhanced({
  mode = 'default',
  useTools = true,
  onScrollChange,
}: ChatEnhancedProps) {
  const [text, setText] = React.useState('');
  const [model, setModel] = React.useState(AVAILABLE_MODELS[0].id);
  const [modelSelectorOpen, setModelSelectorOpen] = React.useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedModelData =
    AVAILABLE_MODELS.find((item) => item.id === model) ?? AVAILABLE_MODELS[0];

  const {
    messages,
    isStreaming,
    sendMessage,
    stopStreaming,
    error,
  } = useEnhancedChat({
    mode,
    useTools,
    onError: (error) => {
      toast.error('发生错误', {
        description: error.message,
      });
    },
    onStreamStart: () => {
      console.log('Stream started');
    },
    onStreamEnd: () => {
      console.log('Stream ended');
    },
  });

  // 监听滚动
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer || !onScrollChange) return;

    const handleScroll = () => {
      const isScrolled = scrollContainer.scrollTop > 0;
      onScrollChange(isScrolled);
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [onScrollChange]);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current;
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text?.trim());
    
    if (!hasText) {
      return;
    }

    sendMessage(message.text!);
    setText('');
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion);
  };

  const getModelSuggestions = (): string[] => {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant' && Array.isArray(m.metadata?.suggestions));
    return (lastAssistant?.metadata?.suggestions as string[]) || [];
  };

  const handleStop = () => {
    stopStreaming();
    toast.info('已停止生成');
  };

  return (
    <div className="relative flex size-full flex-col overflow-hidden">
      {/* 消息列表 */}
      <div
        ref={scrollRef}
        className={`${messages.length === 0 ? 'flex items-center justify-center' : ''} flex-1 overflow-y-auto scrollbar-custom`}
      >
        <div className="flex flex-col gap-8 p-4 max-w-[48rem] min-w-[768px] mx-auto ">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center min-h-full">
              <h2 className="text-2xl font-semibold text-center">您今天在想什么？</h2>
            </div>
          ) : (
            <>
              {/* 渲染消息 */}
              {messages.map((message) => (
                <EnhancedMessageRenderer
                  key={message.id}
                  message={message}
                  isStreaming={isStreaming && message.role === 'assistant' && !message.content}
                />
              ))}

              {/* 建议 (在有消息时显示在底部) */}
              {!isStreaming && getModelSuggestions().length > 0 && (
                <div className="pt-4">
                  <Suggestions className="px-4">
                    {getModelSuggestions().map((suggestion) => (
                      <Suggestion
                        key={suggestion}
                        onClick={() => handleSuggestionClick(suggestion)}
                        suggestion={suggestion}
                      />
                    ))}
                  </Suggestions>
                </div>
              )}
            </>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <p className="font-semibold">发生错误</p>
              <p className="text-sm">{error.message}</p>
            </div>
          )}
        </div>
      </div>

      {/* 输入区域 */}
      <div className="max-w-[48rem] min-w-[768px] mx-auto shrink-0 bg-background">
        <div className="w-full px-4 py-4">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputBody>
              <PromptInputTextarea
                placeholder={
                  isStreaming
                    ? '正在生成回复...'
                    : '输入您的问题...'
                }
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={isStreaming}
              />
            </PromptInputBody>
              <PromptInputFooter>
              <PromptInputTools>
                <ModelSelector
                  onOpenChange={setModelSelectorOpen}
                  open={modelSelectorOpen}
                >
                  <ModelSelectorTrigger asChild>
                    <PromptInputButton>
                      <ModelSelectorLogo provider={selectedModelData.chefSlug} />
                      <ModelSelectorName>{selectedModelData.name}</ModelSelectorName>
                    </PromptInputButton>
                  </ModelSelectorTrigger>
                  <ModelSelectorContent>
                    <ModelSelectorInput placeholder="Search models..." />
                    <ModelSelectorList>
                      <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                      <ModelSelectorGroup heading="DeepSeek">
                        {AVAILABLE_MODELS.map((availableModel) => (
                          <ModelSelectorItem
                            key={availableModel.id}
                            onSelect={() => {
                              setModel(availableModel.id);
                              setModelSelectorOpen(false);
                            }}
                            value={availableModel.id}
                          >
                            <ModelSelectorLogo provider={availableModel.chefSlug} />
                            <ModelSelectorName>{availableModel.name}</ModelSelectorName>
                            {model === availableModel.id ? (
                              <CheckIcon className="ml-auto size-4" />
                            ) : (
                              <div className="ml-auto size-4" />
                            )}
                          </ModelSelectorItem>
                        ))}
                      </ModelSelectorGroup>
                    </ModelSelectorList>
                  </ModelSelectorContent>
                </ModelSelector>
                {isStreaming && (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded-md hover:bg-red-100 transition-colors"
                  >
                    停止生成
                  </button>
                )}
              </PromptInputTools>
              <PromptInputSubmit
                disabled={!text.trim() || isStreaming}
                status={isStreaming ? 'streaming' : 'ready'}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
