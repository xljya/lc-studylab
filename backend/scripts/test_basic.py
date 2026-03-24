#!/usr/bin/env python3
"""
基础功能测试脚本
用于验证第 1 阶段的核心功能是否正常工作

测试内容：
1. 配置加载
2. 模型创建
3. 工具调用
4. Agent 基本功能
"""

# `sys` 是 Python 的系统模块，里面有解释器相关能力。
# 这个脚本里主要用它做两件事：
# 1. 修改模块搜索路径 `sys.path`
# 2. 在程序结束时用 `sys.exit(...)` 返回退出码
import sys

# `pathlib.Path` 是 Python 里处理文件路径的现代写法。
# 你可以把它理解成比字符串路径更安全、更面向对象的 File/Path 工具。
# 这里用它来定位当前脚本所在目录，再反推出项目根目录。
from pathlib import Path

# `__file__` 表示“当前这个 Python 文件自己的路径”，不是项目根目录。
# 对当前文件 `backend/scripts/test_basic.py` 来说：
# 1. `Path(__file__)`                -> 当前文件本身
# 2. `Path(__file__).parent`         -> `backend/scripts`
# 3. `Path(__file__).parent.parent`  -> `backend`
#
# 所以这里实际拿到的是 `backend` 目录，而不是整个仓库根目录 `lc-studylab`。
# 之所以要把 `backend` 加入 `sys.path`，是因为下面要导入的 `config`、`core`、`agents`
# 这些包都位于 `backend` 目录下。
backend_root = Path(__file__).parent.parent

# `sys.path` 可以理解成 Python 查找模块时会看的目录列表。
# `insert(0, ...)` 表示把 `backend` 放到最前面优先查找，
# 这样 `from config import ...` 才能成功。
sys.path.insert(0, str(backend_root))

# 从 `config` 包里导入 `settings` 配置对象。
# 它会读取 `.env` 里的环境变量，类似 Java 项目里统一的配置类/配置中心。
# 例如 `settings.openai_model`、`settings.app_name` 这些值都是从这里拿。
# 同时导入 `get_logger`，用于创建当前脚本专属的日志对象。
from config import settings, get_logger

# 从 `core.models` 模块导入 `get_chat_model` 工厂函数。
# 它负责根据配置创建聊天模型实例，你可以把它理解成一个“模型对象构造器”。
from core.models import get_chat_model

# 从 `core.tools` 模块导入 3 类内容：
# 1. `BASIC_TOOLS`：基础工具列表，Agent 可以使用这些工具
# 2. `get_current_time`：获取当前时间的工具
# 3. `calculator`：计算表达式的工具
# 这些“工具”在概念上有点像给 Agent 挂载的一组可调用服务。
from core.tools import BASIC_TOOLS, get_current_time, calculator

# 从 `agents` 包里导入 `create_base_agent`。
# 这是一个创建 Agent 的工厂函数，负责把模型、提示词、工具等组装起来。
# 可以把它类比成 Java 里一个封装好的 `AgentBuilder.buildDefault()`。
from agents import create_base_agent

# `__name__` 是 Python 自动提供的一个特殊变量，用来表示“当前模块的名字”。
# 你可以先把“模块”理解成“一个 .py 文件被 Python 加载后对应的代码单元”。
#
# 常见有两种情况：
# 1. 直接运行这个文件时，`__name__ == "__main__"`
# 2. 这个文件被别的文件 `import` 时，`__name__` 通常是模块路径/模块名
#
# 对当前文件 `backend/scripts/test_basic.py` 来说：
# - 直接运行 `python3 backend/scripts/test_basic.py` 时，
#   `__name__` 通常是 `"__main__"`
# - 如果把 `backend` 放进 Python 路径后，再 `import scripts.test_basic`，
#   那么这个文件里的 `__name__` 通常就是 `"scripts.test_basic"`
#
# 这里把 `__name__` 传给 `get_logger(...)`，
# 是为了让日志系统知道“这条日志是哪个模块打出来的”。
# 你可以把 `logger` 理解成 Java 里的 `Logger logger = LoggerFactory.getLogger(...)`。
logger = get_logger(__name__)


def test_config():
    """
    测试配置加载。

    Python 用 `def` 定义函数，作用和 Java 里“定义一个方法”类似。
    这里没有参数，表示调用时不需要传入额外数据。
    
    `def test_config():` 可以拆开理解成：
    - `def`：开始定义一个函数
    - `test_config`：函数名
    - `()`：参数列表，这里为空
    - `:`：下面缩进的代码都属于这个函数体
    """
    print("=" * 60)
    print("测试 1: 配置加载")
    print("=" * 60)

    try:
        # `try/except` 的作用类似 Java 的 `try/catch`。
        # 如果 try 里面任何一行报错/抛异常，程序就不会继续往下执行，
        # 而是直接跳到下面对应的 `except ...` 里。
        #
        # 你可以把它理解成：
        # “先尝试执行；如果失败，就走备用处理逻辑”。
        print(f"✅ 应用名称: {settings.app_name}")
        print(f"✅ 版本: {settings.app_version}")
        print(f"✅ 模型: {settings.openai_model}")
        print(f"✅ API Base: {settings.openai_api_base}")

        # 主动验证必填配置是否存在，比如 OPENAI_API_KEY。
        settings.validate_required_keys()
        print("✅ 配置验证通过")

        # 返回 True 表示这项测试通过。
        return True
    except Exception as e:
        # `Exception` 可以先理解成“常见运行错误的总类”。
        # 写成 `except Exception` 的意思是：
        # 只要 try 里出现了大多数普通异常，就在这里统一处理。
        #
        # `as e` 表示把这次捕获到的异常对象保存到变量 `e` 中，
        # 这样我们就能打印具体错误信息，比如缺少配置、网络错误等。
        print(f"❌ 配置测试失败: {e}")
        return False


def test_model():
    """
    测试模型创建。

    这一段主要验证：能否根据当前配置正常创建聊天模型对象。
    """
    print("\n" + "=" * 60)
    print("测试 2: 模型创建")
    print("=" * 60)

    try:
        # 调用工厂函数创建模型。
        # 不传参数时，会优先使用 settings 里的默认配置。
        model = get_chat_model()

        # `model.__class__.__name__` 表示“这个对象所属类的类名”。
        # 类似你在 Java 里想看看某个对象实际是什么实现类。
        print(f"✅ 模型创建成功: {model.__class__.__name__}")
        print(f"✅ 模型名称: {settings.openai_model}")

        return True
    except Exception as e:
        print(f"❌ 模型创建失败: {e}")
        return False


def test_tools():
    """
    测试工具调用。

    这里的“工具”是 Agent 能调用的一组功能模块，
    例如查时间、算表达式，都被统一封装成了可调用对象。
    """
    print("\n" + "=" * 60)
    print("测试 3: 工具调用")
    print("=" * 60)

    try:
        # `invoke(...)` 可以理解成“执行这个对象”。
        # 在这个项目里，工具和 Agent 都采用统一的 `invoke(...)` 调用方式。
        #
        # 时间工具不需要参数，所以传空字典 `{}`。
        time_result = get_current_time.invoke({})
        print(f"✅ 时间工具: {time_result}")

        # 计算器工具需要一个名为 expression 的参数，
        # 所以这里传入一个字典，字典可以理解成 Python 里的 key-value 映射。
        calc_result = calculator.invoke({"expression": "2 + 2"})
        print(f"✅ 计算器工具: {calc_result}")

        # `len(...)` 用来获取集合长度，类似 Java 里看集合有多少个元素。
        # BASIC_TOOLS 是一个工具集合，这里只是确认它已经正确加载。
        print(f"✅ 基础工具数量: {len(BASIC_TOOLS)}")

        return True
    except Exception as e:
        print(f"❌ 工具测试失败: {e}")
        return False


def test_agent():
    """
    测试 Agent 基本功能。

    Agent 可以理解成“带大模型能力、并且能按需调用工具的对象”。
    这一段会验证它能否正常创建、对话，以及自动使用工具。
    """
    print("\n" + "=" * 60)
    print("测试 4: Agent 基本功能")
    print("=" * 60)

    try:
        # 创建 Agent。
        # 这里不传参数，表示让项目使用默认配置组装一个基础 Agent。
        agent = create_base_agent(
            # streaming=False
        )
        print("✅ Agent 创建成功")

        # 给 Agent 发送一个简单问题。
        # 你可以把它理解成：把用户输入交给智能体，让它内部自己决定怎么处理。
        print("\n测试对话: '你好'")
        response = agent.invoke("你好，请用一句话介绍自己")

        # `response[:100]` 是 Python 的切片语法，表示“取前 100 个字符”。
        # 这样做是为了避免日志里输出太长内容。
        print(f"✅ Agent 响应: {response[:100]}...")

        # 再测一次需要工具参与的问题，看看 Agent 会不会自己调用时间工具。
        print("\n测试工具调用: '现在几点？'")
        response = agent.invoke("现在几点？")
        print(f"✅ Agent 响应: {response}")

        return True
    except Exception as e:
        print(f"❌ Agent 测试失败: {e}")
        logger.error(f"Agent 测试错误: {e}", exc_info=True)
        return False


def main():
    """
    主测试函数。

    可以把它理解成这个脚本的“总入口方法”之一，负责顺序执行所有测试，
    再统一汇总最终结果。
    """
    print("\n" + "🧪 " * 20)
    print("LC-StudyLab 第 1 阶段 - 基础功能测试")
    print("🧪 " * 20 + "\n")

    # 这里会保存每项测试的名字和结果，例如：
    # [("配置加载", True), ("模型创建", False)]
    #
    # 这种 `(名称, 结果)` 结构叫 tuple（二元组），
    # 可以理解成一个长度固定的小型数据容器。
    results = []

    # 按顺序执行各项测试，并把结果追加到列表里。
    results.append(("配置加载", test_config()))
    results.append(("模型创建", test_model()))
    results.append(("工具调用", test_tools()))
    results.append(("Agent 功能", test_agent()))

    # 输出测试总结
    print("\n" + "=" * 60)
    print("测试总结")
    print("=" * 60)

    # 这是 Python 的“生成式”写法：
    # `for _, result in results` 表示遍历 results 中的每一项，
    # 每项都是 `(name, result)` 这样的二元组。
    #
    # 这里用 `_` 表示“第一个值我不关心”，只关心第二个 result。
    # `if result` 表示只统计值为 True 的项。
    # 最后 `sum(...)` 把这些 1 全部加起来。
    passed = sum(1 for _, result in results if result)
    total = len(results)

    for name, result in results:
        # Python 三元表达式：
        # 条件成立时取左边，否则取右边。
        # 类似 Java 的 `condition ? A : B`
        status = "✅ 通过" if result else "❌ 失败"
        print(f"{name}: {status}")

    print(f"\n总计: {passed}/{total} 测试通过")

    if passed == total:
        print("\n🎉 所有测试通过！第 1 阶段功能正常。")
        return 0
    else:
        print(f"\n⚠️  有 {total - passed} 个测试失败，请检查配置和日志。")
        return 1


if __name__ == "__main__":
    # 只有当你直接运行这个脚本时，这里的代码才会执行。
    # 如果这个文件只是被别的模块 import，则不会自动运行 main()。
    try:
        # 运行主函数，并拿到返回的退出码。
        exit_code = main()

        # `sys.exit(...)` 会把退出码返回给操作系统。
        # 一般约定：
        # 0 = 成功
        # 非 0 = 失败
        sys.exit(exit_code)
    except KeyboardInterrupt:
        # 用户按 Ctrl+C 时，会触发 KeyboardInterrupt。
        print("\n\n测试被中断")
        sys.exit(1)
    except Exception as e:
        # 兜底异常：如果 main() 之外还有未处理错误，就走这里。
        print(f"\n❌ 测试程序错误: {e}")
        logger.error(f"测试程序错误: {e}", exc_info=True)
        sys.exit(1)
