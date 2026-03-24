# LC-StudyLab

> 基于开源 LangChain 全栈学习项目的二次开发版本。我主导新增了 AI 面试助手、登录鉴权、SQLite 持久化、用户隔离、统计与可观测性展示，并完成了前端工程收敛与可部署验证。

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![LangChain](https://img.shields.io/badge/LangChain-v1.0.3-green.svg)](https://docs.langchain.com/)
[![LangGraph](https://img.shields.io/badge/LangGraph-v1.0.2-orange.svg)](https://docs.langchain.com/oss/python/langgraph/)
[![License](https://img.shields.io/badge/license-MIT-lightgrey.svg)](LICENSE)

## 项目定位

这个项目原本是一个用于学习 LangChain 生态能力的全栈示例，覆盖 Agent、RAG、LangGraph、DeepAgents、Guardrails 等模块。

我在这个基础上，把它从“通用学习 demo”推进成了一个更适合面试展示的 AI SaaS 原型，重点突出：

- 明确的产品场景：`AI 面试助手`
- 更强的产品化结构：`登录 / 用户隔离 / 持久化 / 历史记录 / 统计面板`
- 更完整的工程闭环：`前后端联通 / Docker 部署 / Nginx 反向代理 / 构建验证`

一句话介绍可以这样说：

> 这是一个基于开源 LangChain 全栈项目做的二次开发版本，我主导新增了 AI 面试助手场景、结构化面试准备包、登录鉴权、SQLite 持久化和统计工作台，把原来的学习 demo 改造成了更适合面试展示的 AI SaaS 原型。

## 1 分钟中文面试讲稿

可以直接按下面这段讲：

> 这个项目一开始是一个开源的 LangChain 全栈学习项目，原本更多是用来演示 Agent、RAG、LangGraph 这些基础能力。我接手之后，没有停留在通用聊天 demo，而是把它往更适合业务展示的方向做了二次开发。  
> 我新增了一个 AI 面试助手场景，用户可以输入简历和岗位 JD，系统会生成结构化的面试准备包，包括岗位匹配度、优势和风险点、自我介绍、项目表达模板、高概率面试题和准备计划。  
> 在工程层面，我补了登录注册和 JWT 鉴权，把数据从本地 JSON 升级到 SQLite 持久化，并做了用户维度的数据隔离，同时增加了历史记录、Token、耗时、成本和聚合统计，让它更像一个真正的 SaaS 原型。  
> 前端这边我也做了工程收敛和可部署验证，最终把项目通过 Docker 和 Nginx 跑在了线上域名环境里。  
> 所以我想展示的不只是会调 LLM API，而是我能把一个开源 AI demo 改造成一个有明确场景、有用户体系、能部署、能演示的产品化项目。

## 我做了哪些二开

### 产品层

- 新增 `AI 面试助手工作台`
- 支持输入简历和岗位 JD，生成结构化面试准备包
- 增加历史准备包列表和详情回看
- 增加统计面板，展示准备包数量、岗位匹配分、Token、成本、耗时、活跃趋势
- 增加模型切换，支持 `DeepSeek Chat` 与 `DeepSeek Reasoner`

### 后端层

- 新增面试助手 API：
  - `GET /interview/kits`
  - `GET /interview/kits/{id}`
  - `POST /interview/kits`
  - `DELETE /interview/kits/{id}`
  - `GET /interview/stats`
- 新增认证 API：
  - `POST /auth/register`
  - `POST /auth/login`
  - `GET /auth/me`
- 接入 JWT 鉴权
- 新增 SQLite 持久化层
- 新增用户表和面试准备包表
- 完成面试准备包的用户隔离
- 支持按模型记录生成指标与成本估算

### 前端层

- 新增 `/interview` 面试助手页面
- 调整首页和侧边栏入口
- 增加登录、注册、退出流程
- API 客户端支持 Bearer Token
- 表单增加字段级错误提示与提交前校验
- 支持前端切换 `deepseek-chat / deepseek-reasoner`

## 核心能力

### 新增：AI 面试助手

- 根据简历和岗位 JD 生成结构化面试准备包
- 输出岗位匹配总结、优势、风险点、面试重点
- 自动生成 1 分钟自我介绍和项目表达模板
- 自动生成高概率面试题和准备计划
- 记录生成模型、Token、耗时和成本
- 支持按用户查看历史记录和统计面板

### 原项目保留能力

- 基础 Agent 对话与工具调用
- RAG 知识库问答
- LangGraph 工作流
- DeepAgents 深度研究
- Guardrails 安全机制

## 当前实现状态

### 已完成

- [x] AI 面试助手工作台
- [x] 登录 / 注册 / JWT 鉴权
- [x] SQLite 持久化
- [x] 用户维度数据隔离
- [x] 面试准备包历史记录
- [x] Token / 成本 / 耗时统计
- [x] Docker 构建验证
- [x] Nginx 同域 `/api` 反向代理
- [x] 前端 `pnpm build` 通过

### 仍可继续增强

- [ ] 将 SQLite 升级为 MySQL / PostgreSQL
- [ ] 多业务模块统一 dashboard
- [ ] 用户权限与更细粒度的角色控制
- [ ] RAG 评测与优化报告
- [ ] 剩余前端 warning 清理

## 技术栈

### 后端

- Python 3.10+
- FastAPI
- LangChain 1.0.3
- LangGraph 1.0.2
- Pydantic 2
- SQLite
- JWT
- Loguru

### 前端

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui
- AI Elements

### 模型与部署

- DeepSeek API
- Docker Compose
- Nginx

## 项目结构

```text
lc-studylab/
├── backend/
│   ├── api/
│   │   ├── http_server.py
│   │   └── routers/
│   │       ├── auth.py
│   │       ├── chat.py
│   │       ├── interview.py
│   │       ├── rag.py
│   │       ├── workflow.py
│   │       └── deep_research.py
│   ├── core/
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── prompts.py
│   │   ├── security.py
│   │   └── usage_tracker.py
│   ├── agents/
│   ├── rag/
│   ├── workflows/
│   ├── deep_research/
│   ├── config/
│   ├── scripts/
│   └── data/
└── frontend/
    ├── app/
    │   ├── interview/
    │   ├── chat/
    │   ├── rag/
    │   ├── workflows/
    │   ├── deep-research/
    │   └── settings/
    ├── components/
    ├── lib/
    └── providers/
```

## 关键接口

### 认证接口

```bash
POST /auth/register
POST /auth/login
GET  /auth/me
```

### 面试助手接口

```bash
GET    /interview/kits
GET    /interview/kits/{id}
POST   /interview/kits
DELETE /interview/kits/{id}
GET    /interview/stats
```

## 快速开始

### 1. Docker 运行

推荐直接使用 Docker Compose：

```bash
docker compose up -d --build
```

默认端口：

- 前端：`127.0.0.1:3000`
- 后端：`127.0.0.1:8001`
- 后端文档：`http://127.0.0.1:8001/docs`

### 2. 必要配置

项目当前通过 `backend/.env` 读取模型配置。至少需要确保：

```env
OPENAI_API_KEY=your-api-key
OPENAI_API_BASE=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-chat
```

说明：

- 虽然配置项名字叫 `OPENAI_*`，但当前可接 DeepSeek 的 OpenAI-compatible 接口
- SQLite 不需要单独安装，后端启动后会自动创建数据库文件

### 3. 数据存储

当前使用 SQLite，本地数据库文件路径为：

```text
backend/data/app.db
```

这里会保存：

- 用户信息
- 面试准备包
- 统计所需数据

## 线上部署说明

如果通过域名访问前端，不要把前端 API 地址配置成 `http://localhost:8001`。

当前线上推荐方式：

- 前端使用同域 API 前缀：`/api`
- Nginx 将 `/api/` 反向代理到 `127.0.0.1:8001`

这样浏览器访问链路是：

```text
https://your-domain.com/interview
-> /api/auth/login
-> Nginx
-> http://127.0.0.1:8001/auth/login
```

## 演示建议

面试演示时建议按这个顺序：

1. 先说明这是开源 LangChain 项目的二次开发，而不是从零空壳搭页面
2. 展示登录注册，说明已经有最小用户体系
3. 打开 AI 面试助手，输入简历和 JD
4. 展示结构化准备包
5. 展示历史记录、统计、成本、Token、耗时
6. 最后补一句：目前用 SQLite，下一步可以平滑升级到正式数据库

## 适合怎么讲这个项目

推荐这样描述：

> 这是一个从开源 LangChain 学习项目出发，逐步改造成 AI SaaS 原型的二开项目。我重点主导的是 AI 面试助手场景，补齐了登录鉴权、SQLite 持久化、用户隔离、统计展示和线上部署，让它从能力 demo 变成了一个更接近真实产品的项目。

## 文档索引

- [后端 README](./backend/README.md)
- [前端 README](./frontend/README.md)
- [阶段一：基础 Agent](./backend/docs/stage_01/STAGE1_COMPLETION.md)
- [阶段二：RAG 系统](./backend/docs/stage_02/STAGE2_COMPLETION.md)
- [阶段三：LangGraph 工作流](./backend/docs/stage_03/STAGE3_COMPLETION.md)
- [阶段四：DeepAgents](./backend/docs/stage_04/STAGE4_COMPLETION.md)
- [阶段五：Guardrails](./backend/docs/stage_05/STAGE5_COMPLETION.md)

## 致谢

- [LangChain](https://github.com/langchain-ai/langchain)
- [LangGraph](https://github.com/langchain-ai/langgraph)
- [Vercel AI SDK](https://github.com/vercel/ai)
- [shadcn/ui](https://github.com/shadcn-ui/ui)

## 许可证

本项目基于 [MIT License](LICENSE) 开源。
