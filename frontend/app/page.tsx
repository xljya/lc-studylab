import Link from "next/link"
import { AppLayout } from "@/components/layout/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const featureCards = [
  {
    title: "AI 面试助手",
    href: "/interview",
    badge: "岗位贴合度最高",
    description:
      "上传简历和 JD，生成结构化面试准备包，包括匹配分析、自我介绍、项目表达和高概率问题。",
  },
  {
    title: "Agent 对话",
    href: "/chat",
    badge: "基础能力",
    description: "展示 LangChain Agent、工具调用、流式输出和多模式聊天能力。",
  },
  {
    title: "RAG 知识库",
    href: "/rag",
    badge: "RAG 实战",
    description: "展示文档上传、索引构建、向量检索和基于知识库的问答链路。",
  },
  {
    title: "深度研究",
    href: "/deep-research",
    badge: "多 Agent",
    description: "展示多智能体协作、结构化研究流程和更复杂的问题拆解能力。",
  },
]

export default function Home() {
  return (
    <AppLayout>
      <div className="min-h-full bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_32%),linear-gradient(180deg,_rgba(248,250,252,1)_0%,_rgba(241,245,249,1)_100%)]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-6">
          <Card className="overflow-hidden border-sky-200/60 bg-white/90 shadow-sm">
            <CardHeader className="space-y-4">
              <Badge className="w-fit bg-sky-600">AI 全栈演示项目</Badge>
              <div className="space-y-3">
                <CardTitle className="max-w-4xl text-4xl font-semibold tracking-tight text-slate-950">
                  把 LangChain 学习项目升级成可展示的 AI SaaS 原型
                </CardTitle>
                <CardDescription className="max-w-3xl text-base leading-7 text-slate-600">
                  这个版本重点突出 AI 面试助手、RAG、Agent、前后端联动和部署闭环，
                  更适合拿去面试展示“从能力实验到产品化落地”的改造思路。
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/interview">打开 AI 面试助手</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/chat">查看 Agent 对话</Link>
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            {featureCards.map((item) => (
              <Link href={item.href} key={item.href} className="group">
                <Card className="h-full border-slate-200 bg-white/90 transition group-hover:-translate-y-0.5 group-hover:border-sky-300 group-hover:shadow-md">
                  <CardHeader>
                    <Badge variant="secondary" className="w-fit">
                      {item.badge}
                    </Badge>
                    <CardTitle className="text-2xl text-slate-900">{item.title}</CardTitle>
                    <CardDescription className="text-sm leading-7 text-slate-600">
                      {item.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
