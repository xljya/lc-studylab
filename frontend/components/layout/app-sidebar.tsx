"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  MessageSquare,
  BookOpen,
  Workflow,
  Search,
  Settings,
  Plus,
  BriefcaseBusiness,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useSession } from "@/providers/session-provider"
import { getModeLabel } from "@/lib/session"

const routes = [
  {
    label: "Chat",
    icon: MessageSquare,
    href: "/chat",
    color: "text-violet-500",
  },
  {
    label: "RAG 知识库",
    icon: BookOpen,
    href: "/rag",
    color: "text-pink-700",
  },
  {
    label: "工作流",
    icon: Workflow,
    href: "/workflows",
    color: "text-orange-700",
  },
  {
    label: "深度研究",
    icon: Search,
    href: "/deep-research",
    color: "text-emerald-500",
  },
  {
    label: "AI 面试助手",
    icon: BriefcaseBusiness,
    href: "/interview",
    color: "text-sky-600",
  },
  {
    label: "设置",
    icon: Settings,
    href: "/settings",
    color: "text-gray-700",
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { sessions, createNewSession, switchSession, currentSession } = useSession()

  const handleNewChat = () => {
    createNewSession('basic-agent')
    // 导航到 chat 页面会在 chat 页面组件中处理
  }

  return (
    <div className="space-y-4 py-4 flex flex-col h-full bg-background border-r">
      <div className="px-3 py-2 flex-1">
        <div className="space-y-1">
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="flex items-center">
              <h2 className="text-lg font-semibold tracking-tight">
                LC-StudyLab
              </h2>
            </Link>
          </div>

          <Button
            onClick={handleNewChat}
            className="w-full justify-start"
            variant="outline"
          >
            <Plus className="mr-2 h-4 w-4" />
            新建对话
          </Button>

          <Separator className="my-4" />

          <div className="space-y-1">
            {routes.map((route) => (
              <Link
                key={route.href}
                href={route.href}
                className={cn(
                  "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-lg transition",
                  pathname === route.href
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground"
                )}
              >
                <div className="flex items-center flex-1">
                  <route.icon className={cn("h-5 w-5 mr-3", route.color)} />
                  {route.label}
                </div>
              </Link>
            ))}
          </div>

          <Separator className="my-4" />

          {/* 会话列表 */}
          <div className="space-y-2">
            <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              最近会话
            </h3>
            <ScrollArea className="h-[300px]">
              <div className="space-y-1">
                {sessions.slice(0, 10).map((session) => (
                  <button
                    key={session.id}
                    onClick={() => switchSession(session.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-accent transition",
                      currentSession?.id === session.id
                        ? "bg-accent"
                        : "text-muted-foreground"
                    )}
                  >
                    <div className="font-medium truncate">{session.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {getModeLabel(session.mode)} · {session.messageCount} 条消息
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  )
}
