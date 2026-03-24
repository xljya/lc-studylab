"""
基础 Agent 模块
使用 LangChain 1.0.3 的全新 create_agent API 实现通用的智能体封装

这是第 1 阶段的核心模块，实现：
1. 基于 LangChain V1.0.0 的 create_agent API
2. 流式输出支持（Streaming）
3. 工具调用集成
4. 统一的消息处理

技术要点：
- 使用 LangChain 1.0.3 的 langchain.agents.create_agent API
- create_agent 返回 CompiledStateGraph（基于 LangGraph）
- 支持流式输出，可以实时看到 token、tool calls、reasoning
- 集成自定义工具（时间、计算、搜索等）
- 提供同步和异步接口

参考文档：
- https://docs.langchain.com/oss/python/langchain/agents
- https://reference.langchain.com/python/langchain/agents/
"""

# `typing` 里的这些类型标注，主要作用是帮助人和 IDE 理解“这个变量/参数应该是什么类型”。
# 你可以把它理解成一种“轻量版接口说明”，类似 Java 方法签名里写参数类型。
from typing import List, Optional, Dict, Any, Iterator, AsyncIterator, Union, Sequence

# LangChain 的消息类型。
# 这些类对应对话里的不同角色/消息：
# - BaseMessage: 所有消息类型的父类
# - HumanMessage: 用户消息
# - AIMessage: 模型/Agent 返回的消息
# - SystemMessage: 系统提示词消息（本文件里当前没有直接使用，但保留导入便于扩展）
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage

# BaseTool 表示“工具”的基类。
# 只要某个对象符合 LangChain 的工具接口，就可以交给 Agent 使用。
from langchain_core.tools import BaseTool

# BaseChatModel 是聊天模型的抽象父类。
# 你可以把它理解成“所有聊天模型都遵守的一套统一接口”。
from langchain_core.language_models.chat_models import BaseChatModel

# create_agent 是 LangChain 1.x 里的 Agent 工厂函数。
# 它负责把“模型 + 工具 + 系统提示词”组装成一个可运行的 Agent。
from langchain.agents import create_agent  # LangChain V1.0.0 的新 API

# 项目内部的模型工厂函数。
# `get_chat_model()` 用于创建普通聊天模型实例。
# `get_streaming_model()` 当前这个文件没有直接使用，但表示项目也支持单独创建流式模型。
from core.models import get_chat_model, get_streaming_model

# 项目内部的提示词函数：
# - get_system_prompt: 普通系统提示词
# - get_prompt_with_tools: 带工具说明的系统提示词
from core.prompts import get_system_prompt, get_prompt_with_tools

# 项目预置的工具集合。
# - ALL_TOOLS: 全量工具
# - BASIC_TOOLS: 基础工具
from core.tools import ALL_TOOLS, BASIC_TOOLS

# 全局配置和日志工厂。
# settings 用来读取 .env 中的配置；get_logger 用来创建日志对象。
from config import settings, get_logger

# 当前模块自己的 logger。
logger = get_logger(__name__)


class BaseAgent:
    """
    基础 Agent 类
    
    封装了 LangChain 1.0.3 的 create_agent 功能，提供统一的智能体接口。
    
    在 LangChain V1.0.0 中，create_agent 返回一个 CompiledStateGraph（基于 LangGraph），
    它内部已经实现了完整的工具调用循环、状态管理和流式输出。
    
    Attributes:
        model: LLM 模型实例或模型标识符
        tools: Agent 可用的工具列表
        graph: LangChain 的 CompiledStateGraph 实例（由 create_agent 返回）
        system_prompt: 系统提示词
        
    Example:
        >>> # 创建一个基础 Agent
        >>> agent = BaseAgent(tools=[get_current_time, calculator])
        >>> 
        >>> # 同步调用
        >>> response = agent.invoke("现在几点？")
        >>> print(response)
        >>> 
        >>> # 流式调用
        >>> for chunk in agent.stream("计算 123 + 456"):
        ...     print(chunk, end="", flush=True)
    
    参考：
        - https://docs.langchain.com/oss/python/langchain/agents
        - https://reference.langchain.com/python/langchain/agents/
    """
    
    def __init__(
        self,
        model: Optional[Union[str, BaseChatModel]] = None,
        tools: Optional[Sequence[BaseTool]] = None,
        system_prompt: Optional[str] = None,
        prompt_mode: str = "default",
        debug: bool = False,
        **kwargs: Any,
    ):
        """
        初始化 Base Agent
        
        根据 LangChain V1.0.0 的 create_agent API 规范初始化 Agent。
        
        Args:
            model: LLM 模型，可以是：
                   - 字符串标识符（如 "openai:gpt-4o"）
                   - BaseChatModel 实例
                   如果为 None，使用默认配置创建
            tools: Agent 可用的工具列表（Sequence[BaseTool]）
                   如果为 None 或空列表，Agent 将只包含模型节点，不进行工具调用循环
            system_prompt: 自定义系统提示词
                          如果为 None，则根据 prompt_mode 生成
            prompt_mode: 提示词模式（default/coding/research/concise/detailed）
            debug: 是否启用详细日志（对应 create_agent 的 debug 参数）
            **kwargs: 其他传递给 create_agent 的参数，如：
                     - checkpointer: 状态持久化
                     - store: 跨线程数据存储
                     - interrupt_before/interrupt_after: 中断点
                     - name: Agent 名称
        
        参考：
            https://reference.langchain.com/python/langchain/agents/#langchain.agents.create_agent
        """
        # `__init__` 是 Python 类的构造方法。
        # 当你写 `agent = BaseAgent(...)` 时，Python 会自动执行这里的初始化逻辑。
        #
        # `self` 可以理解成 Java 里的 `this`，表示“当前这个对象实例自己”。

        # ==================== 模型初始化 ====================
        # 在 LangChain V1.0.0 中，model 可以是字符串或 BaseChatModel 实例
        if model is None:
            # 使用默认模型实例，确保 .env 中加载的 api_key/base_url
            # 能稳定传递给 create_agent，而不是依赖进程环境变量导出。
            self.model = get_chat_model(
                model_name=settings.openai_model,
                streaming=settings.openai_streaming,
            )
            logger.info(f"🤖 使用默认模型实例: {settings.openai_model}")
        elif isinstance(model, str):
            # 如果传入的是字符串，就把它当成模型标识符。
            # 例如 "openai:gpt-4o" 这种形式。
            self.model = model
            logger.info(f"🤖 使用模型标识符: {model}")
        else:
            # 否则认为你直接传入了一个已经创建好的模型对象。
            self.model = model
            logger.info(f"🤖 使用自定义模型实例: {model.__class__.__name__}")
        
        # ==================== 工具初始化 ====================
        if tools is None:
            # 默认使用基础工具集（不需要 API Key）
            self.tools = BASIC_TOOLS
            logger.info(f"🔧 使用基础工具集 ({len(self.tools)} 个工具)")
        else:
            self.tools = list(tools) if tools else []
            logger.info(f"🔧 使用自定义工具集 ({len(self.tools)} 个工具)")
        
        # 打印工具列表
        if self.tools:
            tool_names = [tool.name for tool in self.tools]
            logger.debug(f"   工具列表: {', '.join(tool_names)}")
        
        # ==================== 提示词初始化 ====================
        if system_prompt is None:
            # 如果调用方没有自己传 system_prompt，就由项目根据 prompt_mode 自动生成。
            if self.tools:
                # 如果 Agent 配了工具，就生成“带工具说明”的提示词。
                # 这样模型才知道有哪些工具、什么时候该调用。
                self.system_prompt = get_prompt_with_tools(mode=prompt_mode)
                logger.info(f"📝 使用带工具说明的系统提示词 (模式: {prompt_mode})")
            else:
                # 没有工具，使用普通提示词
                self.system_prompt = get_system_prompt(mode=prompt_mode)
                logger.info(f"📝 使用普通系统提示词 (模式: {prompt_mode})")
        else:
            self.system_prompt = system_prompt
            logger.info("📝 使用自定义系统提示词")
        
        # ==================== Agent 配置 ====================
        self.debug = debug
        
        # ==================== 创建 Agent ====================
        # 在 LangChain V1.0.0 中，使用 create_agent 直接创建
        # 它返回一个 CompiledStateGraph，内部已经实现了完整的工具调用循环
        try:
            logger.info("🔨 创建 Agent（使用 LangChain V1.0.0 create_agent API）...")
            
            # 调用 create_agent
            # 参考：https://reference.langchain.com/python/langchain/agents/#langchain.agents.create_agent
            #
            # 这里得到的 `self.graph` 可以暂时理解成：
            # “一个已经组装好的 Agent 运行引擎”。
            # 后面所有 `invoke()`、`stream()` 最终都会转发给它。
            self.graph = create_agent(
                model=self.model,
                tools=self.tools if self.tools else None,  # None 或空列表表示无工具
                system_prompt=self.system_prompt,
                debug=self.debug,
                **kwargs,  # 支持 checkpointer, store, interrupt_before/after, name 等
            )
            
            logger.info("✅ Agent 创建成功（CompiledStateGraph）")
            logger.debug(f"   配置: debug={self.debug}, tools={len(self.tools)}")
            
        except Exception as e:
            logger.error(f"❌ Agent 创建失败: {e}")
            raise
    
    def invoke(
        self,
        input_text: str,
        chat_history: Optional[List[BaseMessage]] = None,
        **kwargs: Any,
    ) -> str:
        """
        同步调用 Agent（非流式）
        
        在 LangChain V1.0.0 中，create_agent 返回的 CompiledStateGraph
        使用 {"messages": [...]} 作为输入格式。
        
        Args:
            input_text: 用户输入的文本
            chat_history: 对话历史（可选）
            **kwargs: 其他传递给 graph 的参数
            
        Returns:
            Agent 的响应文本
            
        Example:
            >>> agent = BaseAgent()
            >>> response = agent.invoke("你好，请介绍一下自己")
            >>> print(response)
        
        参考：
            https://docs.langchain.com/oss/python/langchain/agents
        """
        logger.info(f"🚀 执行 Agent 调用: {input_text[:50]}...")
        
        try:
            # 准备消息列表。
            # 这里的 messages 可以理解成“这次对话上下文”。
            # LangChain V1.0.0 的 create_agent 使用 {"messages": [...]} 格式
            messages = []
            
            # 如果之前已经有聊天记录，就先把历史消息放进去。
            if chat_history:
                messages.extend(chat_history)
            
            # 然后把这次新的用户输入包装成 HumanMessage。
            messages.append(HumanMessage(content=input_text))
            
            # 最终拼成 create_agent 需要的输入格式。
            graph_input = {"messages": messages}
            graph_input.update(kwargs)
            
            # 执行 Graph
            # CompiledStateGraph 的 invoke 方法返回最终状态
            result = self.graph.invoke(graph_input)
            
            # 提取最后一条 AI 消息
            # result 是一个包含 "messages" 键的字典
            output_messages = result.get("messages", [])
            
            # 倒序查找最后一条 AIMessage，
            # 因为最终结果里可能同时包含用户消息、工具消息、AI 消息等多种内容。
            ai_response = ""
            for msg in reversed(output_messages):
                if isinstance(msg, AIMessage):
                    ai_response = msg.content
                    break
            
            logger.info(f"✅ Agent 调用完成，输出长度: {len(ai_response)} 字符")
            logger.debug(f"   输出: {ai_response[:100]}...")
            
            return ai_response
            
        except Exception as e:
            error_msg = f"Agent 执行失败: {str(e)}"
            logger.error(f"❌ {error_msg}")
            return f"抱歉，处理您的请求时出现错误: {str(e)}"
    
    def stream(
        self,
        input_text: str,
        chat_history: Optional[List[BaseMessage]] = None,
        stream_mode: str = "messages",
        **kwargs: Any,
    ) -> Iterator[str]:
        """
        流式调用 Agent
        
        在 LangChain V1.0.0 中，CompiledStateGraph 支持多种流式模式。
        默认使用 "messages" 模式，逐步返回消息内容。
        
        Args:
            input_text: 用户输入的文本
            chat_history: 对话历史（可选）
            stream_mode: 流式模式，可选值：
                        - "messages": 流式返回消息内容（推荐）
                        - "updates": 返回状态更新
                        - "values": 返回完整状态值
            **kwargs: 其他参数
            
        Yields:
            Agent 输出的文本片段
            
        Example:
            >>> agent = BaseAgent()
            >>> for chunk in agent.stream("讲个笑话"):
            ...     print(chunk, end="", flush=True)
        
        参考：
            https://docs.langchain.com/oss/python/langchain/agents
        """
        logger.info(f"🌊 执行 Agent 流式调用: {input_text[:50]}...")
        
        try:
            # 这里和 invoke() 的前半段基本一样：
            # 先整理聊天历史，再拼出 graph_input。
            messages = []
            if chat_history:
                messages.extend(chat_history)
            messages.append(HumanMessage(content=input_text))
            
            # 准备输入
            graph_input = {"messages": messages}
            graph_input.update(kwargs)
            
            # 流式执行 Graph。
            # 和 invoke() 一次性拿完整结果不同，stream() 会一段一段地产出内容。
            # CompiledStateGraph 的 stream 方法支持多种模式
            for chunk in self.graph.stream(graph_input, stream_mode=stream_mode):
                # 根据 stream_mode 处理不同的输出格式
                if stream_mode == "messages":
                    # messages 模式：chunk 常见是 (message, metadata) 元组。
                    # tuple 可以理解成一个固定长度的小容器。
                    if isinstance(chunk, tuple) and len(chunk) == 2:
                        message, metadata = chunk
                        if isinstance(message, AIMessage) and message.content:
                            logger.debug(f"   流式输出: {message.content[:50]}...")
                            yield message.content
                    elif isinstance(chunk, AIMessage) and chunk.content:
                        logger.debug(f"   流式输出: {chunk.content[:50]}...")
                        yield chunk.content
                
                elif stream_mode == "updates":
                    # updates 模式：chunk 是状态更新字典
                    if isinstance(chunk, dict) and "messages" in chunk:
                        messages_update = chunk["messages"]
                        if messages_update:
                            last_msg = messages_update[-1]
                            if isinstance(last_msg, AIMessage) and last_msg.content:
                                yield last_msg.content
            
            logger.info("✅ Agent 流式调用完成")
            
        except Exception as e:
            error_msg = f"Agent 流式执行失败: {str(e)}"
            logger.error(f"❌ {error_msg}")
            yield f"\n\n抱歉，处理您的请求时出现错误: {str(e)}"
    
    async def ainvoke(
        self,
        input_text: str,
        chat_history: Optional[List[BaseMessage]] = None,
        config: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> str:
        """
        异步调用 Agent（非流式）
        
        Args:
            input_text: 用户输入的文本
            chat_history: 对话历史（可选）
            config: LangGraph 配置（如 recursion_limit）
            **kwargs: 其他参数
            
        Returns:
            Agent 的响应文本
            
        Example:
            >>> agent = BaseAgent()
            >>> response = await agent.ainvoke("你好")
            >>> print(response)
        """
        # `async def` 表示“异步函数”。
        # 这类函数通常要配合 `await` 使用，适合 I/O 较多的场景。
        logger.info(f"🚀 执行 Agent 异步调用: {input_text[:50]}...")
        
        try:
            # 准备消息列表
            messages = []
            if chat_history:
                messages.extend(chat_history)
            messages.append(HumanMessage(content=input_text))
            
            # 准备输入
            graph_input = {"messages": messages}
            graph_input.update(kwargs)
            
            # 异步执行 Graph。
            # `await` 可以理解成“先等待这个异步任务完成，再继续往下执行”。
            result = await self.graph.ainvoke(graph_input, config=config)
            
            # 提取最后一条 AI 消息
            output_messages = result.get("messages", [])
            ai_response = ""
            for msg in reversed(output_messages):
                if isinstance(msg, AIMessage):
                    ai_response = msg.content
                    break
            
            logger.info(f"✅ Agent 异步调用完成")
            return ai_response
            
        except Exception as e:
            error_msg = f"Agent 异步执行失败: {str(e)}"
            logger.error(f"❌ {error_msg}")
            return f"抱歉，处理您的请求时出现错误: {str(e)}"
    
    async def astream(
        self,
        input_text: str,
        chat_history: Optional[List[BaseMessage]] = None,
        stream_mode: str = "messages",
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        """
        异步流式调用 Agent
        
        Args:
            input_text: 用户输入的文本
            chat_history: 对话历史（可选）
            stream_mode: 流式模式（"messages" 或 "updates"）
            **kwargs: 其他参数
            
        Yields:
            Agent 输出的文本片段
            
        Example:
            >>> agent = BaseAgent()
            >>> async for chunk in agent.astream("讲个笑话"):
            ...     print(chunk, end="", flush=True)
        """
        # astream = async stream，表示“异步 + 流式”。
        logger.info(f"🌊 执行 Agent 异步流式调用: {input_text[:50]}...")
        
        try:
            # 准备消息列表
            messages = []
            if chat_history:
                messages.extend(chat_history)
            messages.append(HumanMessage(content=input_text))
            
            # 准备输入
            graph_input = {"messages": messages}
            graph_input.update(kwargs)
            
            # `async for` 用来遍历异步迭代器，
            # 类似普通 `for`，只是每次取值都可能需要等待。
            async for chunk in self.graph.astream(graph_input, stream_mode=stream_mode):
                # 根据 stream_mode 处理不同的输出格式
                if stream_mode == "messages":
                    if isinstance(chunk, tuple) and len(chunk) == 2:
                        message, metadata = chunk
                        if isinstance(message, AIMessage) and message.content:
                            yield message.content
                    elif isinstance(chunk, AIMessage) and chunk.content:
                        yield chunk.content
                
                elif stream_mode == "updates":
                    if isinstance(chunk, dict) and "messages" in chunk:
                        messages_update = chunk["messages"]
                        if messages_update:
                            last_msg = messages_update[-1]
                            if isinstance(last_msg, AIMessage) and last_msg.content:
                                yield last_msg.content
            
            logger.info("✅ Agent 异步流式调用完成")
            
        except Exception as e:
            error_msg = f"Agent 异步流式执行失败: {str(e)}"
            logger.error(f"❌ {error_msg}")
            yield f"\n\n抱歉，处理您的请求时出现错误: {str(e)}"


def create_base_agent(
    model: Optional[Union[str, BaseChatModel]] = None,
    tools: Optional[Sequence[BaseTool]] = None,
    prompt_mode: str = "default",
    debug: bool = False,
    **kwargs: Any,
) -> BaseAgent:
    """
    创建基础 Agent 的便捷工厂函数
    
    根据 LangChain V1.0.0 的规范创建 Agent。
    
    Args:
        model: LLM 模型（字符串标识符或实例）
        tools: 工具列表
        prompt_mode: 提示词模式
        debug: 是否启用调试日志
        **kwargs: 其他参数（传递给 create_agent）
        
    Returns:
        配置好的 BaseAgent 实例
        
    Example:
        >>> # 创建默认 Agent
        >>> agent = create_base_agent()
        >>> 
        >>> # 创建编程助手 Agent
        >>> agent = create_base_agent(prompt_mode="coding")
        >>> 
        >>> # 创建带所有工具的 Agent
        >>> from core.tools import ALL_TOOLS
        >>> agent = create_base_agent(tools=ALL_TOOLS)
        >>> 
        >>> # 使用特定模型
        >>> agent = create_base_agent(model="openai:gpt-4o-mini")
    
    参考：
        https://docs.langchain.com/oss/python/langchain/agents
    """
    # 这个函数本质上是对 `BaseAgent(...)` 的一层薄封装。
    # 好处是调用者不用关心类名，直接通过“工厂函数”拿一个默认 Agent 即可。
    # 这和很多 Java 项目里提供 `createXxx()` / `buildXxx()` 的写法是一个思路。
    logger.info(f"🏭 创建 Base Agent (mode={prompt_mode}, debug={debug})")
    
    return BaseAgent(
        model=model,
        tools=tools,
        prompt_mode=prompt_mode,
        debug=debug,
        **kwargs,
    )
