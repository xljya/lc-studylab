"use client"

import { useEffect, useState } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  clearStoredAccessToken,
  createInterviewKit,
  deleteInterviewKit,
  getCurrentUser,
  getInterviewKit,
  getInterviewStats,
  loginUser,
  listInterviewKits,
  registerUser,
} from "@/lib/api-client"
import type {
  AuthUser,
  CreateInterviewKitRequest,
  InterviewKit,
  InterviewKitSummary,
  InterviewStats,
} from "@/lib/types"

type InterviewFieldKey = "target_role" | "resume_text" | "job_description"
type InterviewFieldErrors = Partial<Record<InterviewFieldKey, string>>

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value))
  } catch {
    return value
  }
}

function priorityLabel(priority: "high" | "medium" | "low") {
  if (priority === "high") return "高优先级"
  if (priority === "medium") return "中优先级"
  return "低优先级"
}

function formatUsd(value: number) {
  if (value > 0 && value < 0.0001) {
    return "< $0.0001"
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 0.01 ? 4 : 2,
    maximumFractionDigits: value < 0.01 ? 6 : 4,
  }).format(value)
}

const MIN_INTERVIEW_TEXT_LENGTH = 30

const interviewModelOptions: Array<{
  id: NonNullable<CreateInterviewKitRequest["model_id"]>
  label: string
  description: string
}> = [
  {
    id: "deepseek-chat",
    label: "DeepSeek Chat",
    description: "更快、更省，适合日常演示和结构化生成。",
  },
  {
    id: "deepseek-reasoner",
    label: "DeepSeek Reasoner",
    description: "更偏推理型，适合展示更强的分析能力。",
  },
]

function getFieldInputClassName(error?: string) {
  return error ? "border-red-300 focus-visible:ring-red-400" : ""
}

const initialForm: CreateInterviewKitRequest = {
  candidate_name: "",
  target_role: "AI 全栈工程师",
  company_name: "",
  resume_text: "",
  job_description: "",
  model_id: "deepseek-chat",
  focus_areas: ["FastAPI", "RAG", "前端全栈", "Docker"],
}

const initialAuthForm = {
  display_name: "",
  email: "",
  password: "",
}

export default function InterviewPage() {
  const [form, setForm] = useState<CreateInterviewKitRequest>(initialForm)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authMode, setAuthMode] = useState<"login" | "register">("register")
  const [authForm, setAuthForm] = useState(initialAuthForm)
  const [focusAreaInput, setFocusAreaInput] = useState(initialForm.focus_areas?.join(", ") ?? "")
  const [kits, setKits] = useState<InterviewKitSummary[]>([])
  const [selectedKit, setSelectedKit] = useState<InterviewKit | null>(null)
  const [stats, setStats] = useState<InterviewStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formErrors, setFormErrors] = useState<InterviewFieldErrors>({})

  async function refreshKits(selectId?: string) {
    const [data, statsData] = await Promise.all([listInterviewKits(), getInterviewStats()])
    setKits(data)
    setStats(statsData)

    const targetId = selectId ?? data[0]?.id
    if (targetId) {
      const detail = await getInterviewKit(targetId)
      setSelectedKit(detail)
    } else {
      setSelectedKit(null)
    }
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        setBootstrapping(true)
        setError(null)
        const currentUser = await getCurrentUser()
        setUser(currentUser)
        await refreshKits()
      } catch {
        clearStoredAccessToken()
        setUser(null)
        setKits([])
        setStats(null)
        setSelectedKit(null)
      } finally {
        setBootstrapping(false)
      }
    }

    bootstrap()
  }, [])

  async function handleAuthSubmit() {
    if (!authForm.email.trim() || !authForm.password.trim()) {
      setError("请填写邮箱和密码")
      return
    }

    if (authMode === "register" && !authForm.display_name.trim()) {
      setError("注册时请填写展示名称，方便演示用户体系")
      return
    }

    try {
      setAuthLoading(true)
      setError(null)

      const result =
        authMode === "register"
          ? await registerUser({
              display_name: authForm.display_name.trim(),
              email: authForm.email.trim(),
              password: authForm.password,
            })
          : await loginUser({
              email: authForm.email.trim(),
              password: authForm.password,
            })

      setUser(result.user)
      await refreshKits()
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败")
    } finally {
      setAuthLoading(false)
    }
  }

  function handleLogout() {
    clearStoredAccessToken()
    setUser(null)
    setKits([])
    setStats(null)
    setSelectedKit(null)
    setError(null)
  }

  async function handleCreate() {
    if (!user) {
      setError("请先登录后再生成面试准备包")
      return
    }

    const trimmedResumeText = form.resume_text?.trim() ?? ""
    const trimmedJobDescription = form.job_description?.trim() ?? ""
    const nextErrors: InterviewFieldErrors = {}

    if (!form.target_role?.trim()) {
      nextErrors.target_role = "请输入目标岗位"
    }
    if (!trimmedResumeText) {
      nextErrors.resume_text = "请输入简历内容"
    } else if (trimmedResumeText.length < MIN_INTERVIEW_TEXT_LENGTH) {
      nextErrors.resume_text = `至少 ${MIN_INTERVIEW_TEXT_LENGTH} 个字符，当前 ${trimmedResumeText.length} 个`
    }
    if (!trimmedJobDescription) {
      nextErrors.job_description = "请输入岗位 JD"
    } else if (trimmedJobDescription.length < MIN_INTERVIEW_TEXT_LENGTH) {
      nextErrors.job_description = `至少 ${MIN_INTERVIEW_TEXT_LENGTH} 个字符，当前 ${trimmedJobDescription.length} 个`
    }

    setFormErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setError(null)
      return
    }

    try {
      setLoading(true)
      setError(null)
      setFormErrors({})
      const payload: CreateInterviewKitRequest = {
        ...form,
        resume_text: trimmedResumeText,
        job_description: trimmedJobDescription,
        focus_areas: focusAreaInput
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      }

      const kit = await createInterviewKit(payload)
      setSelectedKit(kit)
      await refreshKits(kit.id)
    } catch (err) {
      const message = err instanceof Error ? err.message : "生成面试准备包失败"
      if (message.includes("resume_text:")) {
        setFormErrors((prev) => ({
          ...prev,
          resume_text: message.split("resume_text:")[1]?.trim() || "简历内容不符合要求",
        }))
        setError(null)
      } else if (message.includes("job_description:")) {
        setFormErrors((prev) => ({
          ...prev,
          job_description: message.split("job_description:")[1]?.trim() || "岗位 JD 不符合要求",
        }))
        setError(null)
      } else if (message.includes("target_role:")) {
        setFormErrors((prev) => ({
          ...prev,
          target_role: message.split("target_role:")[1]?.trim() || "目标岗位不符合要求",
        }))
        setError(null)
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSelect(kitId: string) {
    if (!user) return

    try {
      setError(null)
      const detail = await getInterviewKit(kitId)
      setSelectedKit(detail)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载准备包详情失败")
    }
  }

  async function handleDelete(kitId: string) {
    if (!user) return

    try {
      setError(null)
      await deleteInterviewKit(kitId)
      await refreshKits(selectedKit?.id === kitId ? undefined : selectedKit?.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除准备包失败")
    }
  }

  return (
    <AppLayout>
      <div className="min-h-full bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_35%),linear-gradient(180deg,_rgba(248,250,252,1)_0%,_rgba(241,245,249,1)_100%)]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
          <Card className="border-sky-200/70 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-3xl font-semibold tracking-tight text-slate-900">
                AI 面试助手工作台
              </CardTitle>
              <CardDescription className="max-w-3xl text-base leading-7 text-slate-600">
                把你的简历和岗位 JD 喂给系统，生成一份可以直接拿去练习和展示的面试准备包。
                这比单纯的聊天 demo 更像一个可落地的 AI SaaS 原型。
              </CardDescription>
            </CardHeader>
          </Card>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {bootstrapping ? (
            <Card className="bg-white/90">
              <CardContent className="py-12 text-center text-sm text-slate-500">
                正在校验登录状态...
              </CardContent>
            </Card>
          ) : null}

          {!bootstrapping && !user ? (
            <Card className="border-sky-200/70 bg-white/95 shadow-sm">
              <CardHeader>
                <CardTitle>登录后使用面试助手</CardTitle>
                <CardDescription>
                  这一版已经补上最小用户体系。注册后，面试准备包和统计数据会按用户维度隔离。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={authMode === "register" ? "default" : "outline"}
                    onClick={() => setAuthMode("register")}
                  >
                    注册
                  </Button>
                  <Button
                    type="button"
                    variant={authMode === "login" ? "default" : "outline"}
                    onClick={() => setAuthMode("login")}
                  >
                    登录
                  </Button>
                </div>
                {authMode === "register" ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">展示名称</label>
                    <Input
                      value={authForm.display_name}
                      onChange={(event) =>
                        setAuthForm((prev) => ({ ...prev, display_name: event.target.value }))
                      }
                      placeholder="例如：刘晨风"
                    />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">邮箱</label>
                  <Input
                    type="email"
                    value={authForm.email}
                    onChange={(event) =>
                      setAuthForm((prev) => ({ ...prev, email: event.target.value }))
                    }
                    placeholder="you@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">密码</label>
                  <Input
                    type="password"
                    value={authForm.password}
                    onChange={(event) =>
                      setAuthForm((prev) => ({ ...prev, password: event.target.value }))
                    }
                    placeholder="至少 8 位"
                  />
                </div>
                <Button onClick={handleAuthSubmit} disabled={authLoading} className="w-full">
                  {authLoading ? "提交中..." : authMode === "register" ? "注册并进入工作台" : "登录并进入工作台"}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {user && stats ? (
            <Card className="border-slate-200 bg-white/90">
              <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm text-slate-500">当前登录用户</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {user.display_name || user.email}
                  </div>
                  <div className="text-sm text-slate-500">{user.email}</div>
                </div>
                <Button variant="outline" onClick={handleLogout}>
                  退出登录
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {user && stats ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="bg-white/90">
                <CardContent className="p-5">
                  <div className="text-sm text-slate-500">累计准备包</div>
                  <div className="mt-2 text-3xl font-semibold text-slate-900">{stats.total_kits}</div>
                  <div className="mt-2 text-sm text-slate-600">
                    最近 7 天新增 {stats.recent_7d_count} 份
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/90">
                <CardContent className="p-5">
                  <div className="text-sm text-slate-500">平均岗位匹配分</div>
                  <div className="mt-2 text-3xl font-semibold text-slate-900">
                    {stats.average_role_fit_score}
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    80 分以上 {stats.high_fit_count} 份
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/90">
                <CardContent className="p-5">
                  <div className="text-sm text-slate-500">累计 Token</div>
                  <div className="mt-2 text-3xl font-semibold text-slate-900">
                    {(stats.total_input_tokens + stats.total_output_tokens).toLocaleString()}
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    输入 {stats.total_input_tokens.toLocaleString()} / 输出 {stats.total_output_tokens.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/90">
                <CardContent className="p-5">
                  <div className="text-sm text-slate-500">生成成本与耗时</div>
                  <div className="mt-2 text-3xl font-semibold text-slate-900">
                    {formatUsd(stats.total_estimated_cost_usd)}
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    平均生成 {Math.round(stats.average_generation_ms)} ms
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {user ? (
            <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
            <div className="space-y-6">
              <Card className="bg-white/90">
                <CardHeader>
                  <CardTitle>生成准备包</CardTitle>
                  <CardDescription>填入你的简历和岗位要求，生成结构化面试方案。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">候选人姓名</label>
                    <Input
                      value={form.candidate_name ?? ""}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, candidate_name: event.target.value }))
                      }
                      placeholder="例如：刘晨风"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">目标岗位</label>
                    <Input
                      value={form.target_role}
                      onChange={(event) => {
                        setForm((prev) => ({ ...prev, target_role: event.target.value }))
                        setFormErrors((prev) => ({ ...prev, target_role: undefined }))
                      }}
                      className={getFieldInputClassName(formErrors.target_role)}
                      placeholder="例如：AI 全栈工程师"
                    />
                    {formErrors.target_role ? (
                      <div className="text-xs font-medium text-red-600">{formErrors.target_role}</div>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">目标公司</label>
                    <Input
                      value={form.company_name ?? ""}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, company_name: event.target.value }))
                      }
                      placeholder="例如：某 AI 创业公司"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">生成模型</label>
                    <div className="grid gap-2">
                      {interviewModelOptions.map((option) => {
                        const active = form.model_id === option.id
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, model_id: option.id }))}
                            className={`rounded-xl border px-3 py-3 text-left transition ${
                              active
                                ? "border-sky-500 bg-sky-50"
                                : "border-slate-200 bg-white hover:border-sky-200"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-medium text-slate-900">{option.label}</div>
                              {active ? <Badge className="bg-sky-600">当前使用</Badge> : null}
                            </div>
                            <div className="mt-1 text-xs leading-5 text-slate-500">
                              {option.description}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">重点准备方向</label>
                    <Input
                      value={focusAreaInput}
                      onChange={(event) => setFocusAreaInput(event.target.value)}
                      placeholder="例如：FastAPI, RAG, React, Docker"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">简历内容</label>
                    <Textarea
                      value={form.resume_text}
                      onChange={(event) => {
                        setForm((prev) => ({ ...prev, resume_text: event.target.value }))
                        setFormErrors((prev) => ({ ...prev, resume_text: undefined }))
                      }}
                      placeholder="贴入你的项目经历、技术栈、实习经历、自我评价等内容"
                      className={`min-h-48 ${getFieldInputClassName(formErrors.resume_text)}`}
                    />
                    {formErrors.resume_text ? (
                      <div className="text-xs font-medium text-red-600">{formErrors.resume_text}</div>
                    ) : null}
                    <div className="text-xs text-slate-500">
                      至少 {MIN_INTERVIEW_TEXT_LENGTH} 个字符，当前 {form.resume_text.trim().length} 个
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">岗位 JD</label>
                    <Textarea
                      value={form.job_description}
                      onChange={(event) => {
                        setForm((prev) => ({ ...prev, job_description: event.target.value }))
                        setFormErrors((prev) => ({ ...prev, job_description: undefined }))
                      }}
                      placeholder="贴入岗位职责、岗位亮点、技能要求、加分项等内容"
                      className={`min-h-56 ${getFieldInputClassName(formErrors.job_description)}`}
                    />
                    {formErrors.job_description ? (
                      <div className="text-xs font-medium text-red-600">{formErrors.job_description}</div>
                    ) : null}
                    <div className="text-xs text-slate-500">
                      至少 {MIN_INTERVIEW_TEXT_LENGTH} 个字符，当前 {form.job_description.trim().length} 个
                    </div>
                  </div>
                  <Button onClick={handleCreate} disabled={loading} className="w-full">
                    {loading ? "正在生成..." : "生成面试准备包"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-white/90">
                <CardHeader>
                  <CardTitle>历史准备包</CardTitle>
                  <CardDescription>保留多份岗位分析结果，面试前可以快速回顾。</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-80 pr-3">
                    <div className="space-y-3">
                      {kits.length === 0 && !bootstrapping ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                          还没有生成过准备包，先用左侧表单创建一份。
                        </div>
                      ) : null}
                      {kits.map((kit) => (
                        <div
                          key={kit.id}
                          className={`rounded-xl border p-3 transition ${
                            selectedKit?.id === kit.id
                              ? "border-sky-400 bg-sky-50"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <button className="w-full text-left" onClick={() => handleSelect(kit.id)}>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-medium text-slate-900">{kit.target_role}</div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {kit.company_name || "未填写公司"} · {formatDate(kit.created_at)}
                                </div>
                              </div>
                              <Badge variant="secondary">{kit.role_fit_score} 分</Badge>
                            </div>
                            <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                              {kit.summary}
                            </p>
                          </button>
                          <Button
                            variant="ghost"
                            className="mt-2 h-8 px-2 text-xs text-slate-500 hover:text-red-600"
                            onClick={() => handleDelete(kit.id)}
                          >
                            删除
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {stats ? (
                <div className="grid gap-6 xl:grid-cols-2">
                  <Card className="bg-white/90">
                    <CardHeader>
                      <CardTitle>高频准备方向</CardTitle>
                      <CardDescription>这能帮助你展示“面试热点”和用户需求集中在哪些能力上。</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {stats.top_focus_areas.length > 0 ? (
                        stats.top_focus_areas.map((item) => (
                          <Badge key={item.label} variant="secondary">
                            {item.label} · {item.count}
                          </Badge>
                        ))
                      ) : (
                        <div className="text-sm text-slate-500">还没有足够数据</div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-white/90">
                    <CardHeader>
                      <CardTitle>目标岗位分布</CardTitle>
                      <CardDescription>适合在演示时说明这个产品支持不同岗位场景。</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {stats.top_target_roles.length > 0 ? (
                        stats.top_target_roles.map((item) => (
                          <div
                            key={item.label}
                            className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          >
                            <span className="text-slate-700">{item.label}</span>
                            <Badge variant="outline">{item.count}</Badge>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-slate-500">还没有足够数据</div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : null}

              {bootstrapping ? (
                <Card className="bg-white/90">
                  <CardContent className="py-12 text-center text-sm text-slate-500">
                    正在加载面试准备包...
                  </CardContent>
                </Card>
              ) : null}

              {!bootstrapping && selectedKit ? (
                <>
                  <Card className="bg-white/95">
                    <CardHeader>
                      <div className="flex flex-wrap items-center gap-3">
                        <CardTitle className="text-2xl text-slate-900">
                          {selectedKit.target_role}
                        </CardTitle>
                        <Badge className="bg-sky-600">{selectedKit.role_fit_score} 分匹配度</Badge>
                      </div>
                      <CardDescription className="text-sm text-slate-500">
                        {selectedKit.company_name || "未填写公司"} · {formatDate(selectedKit.created_at)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                          总结
                        </h3>
                        <p className="mt-2 text-sm leading-7 text-slate-700">
                          {selectedKit.summary}
                        </p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                            优势
                          </h3>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {selectedKit.strengths.map((item) => (
                              <Badge key={item} variant="secondary">
                                {item}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                            风险点
                          </h3>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {selectedKit.risks.map((item) => (
                              <Badge key={item} variant="outline">
                                {item}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                          面试重点
                        </h3>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedKit.focus_points.map((item) => (
                            <Badge key={item} className="bg-slate-900 text-white hover:bg-slate-900">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {selectedKit.metrics ? (
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                            生成指标
                          </h3>
                          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                              模型：{selectedKit.metrics.model_id}
                            </div>
                            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                              总 Token：{selectedKit.metrics.total_tokens.toLocaleString()}
                            </div>
                            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                              耗时：{selectedKit.metrics.generation_ms} ms
                            </div>
                            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                              成本：{formatUsd(selectedKit.metrics.estimated_cost_usd)}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <Card className="bg-white/95">
                      <CardHeader>
                        <CardTitle>1 分钟自我介绍</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm leading-7 text-slate-700">
                        {selectedKit.self_intro}
                      </CardContent>
                    </Card>

                    <Card className="bg-white/95">
                      <CardHeader>
                        <CardTitle>项目表达模板</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm leading-7 text-slate-700">
                        {selectedKit.project_story}
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="bg-white/95">
                    <CardHeader>
                      <CardTitle>高概率面试题</CardTitle>
                      <CardDescription>把这些问题练熟，面试表现会稳很多。</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selectedKit.likely_questions.map((item, index) => (
                        <div key={`${item.question}-${index}`} className="rounded-xl border border-slate-200 p-4">
                          <div className="text-sm font-semibold text-slate-900">
                            {index + 1}. {item.question}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            考察意图：{item.intent}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {item.answer_tips.map((tip) => (
                              <Badge key={tip} variant="secondary">
                                {tip}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="bg-white/95">
                    <CardHeader>
                      <CardTitle>准备计划</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selectedKit.prep_plan.map((item) => (
                        <div key={item.title} className="rounded-xl border border-slate-200 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold text-slate-900">{item.title}</div>
                            <Badge variant="outline">{priorityLabel(item.priority)}</Badge>
                          </div>
                          <p className="mt-2 text-sm text-slate-600">为什么：{item.why}</p>
                          <p className="mt-2 text-sm text-slate-700">行动建议：{item.action}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="bg-white/95">
                    <CardHeader>
                      <CardTitle>后续建议</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedKit.suggested_followups.map((item) => (
                        <div key={item} className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                          {item}
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {stats?.recent_activity?.length ? (
                    <Card className="bg-white/95">
                      <CardHeader>
                        <CardTitle>最近活跃趋势</CardTitle>
                        <CardDescription>更像产品 dashboard，适合讲“可观测性”和“用户使用轨迹”。</CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {stats.recent_activity.map((item) => (
                          <div key={item.date} className="rounded-xl border border-slate-200 p-4">
                            <div className="text-sm font-medium text-slate-900">{item.date}</div>
                            <div className="mt-2 text-2xl font-semibold text-slate-900">{item.count}</div>
                            <div className="mt-1 text-sm text-slate-600">
                              平均匹配分 {item.average_score}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ) : null}

                  <Card className="bg-white/95">
                    <CardHeader>
                      <CardTitle>原始输入</CardTitle>
                      <CardDescription>用于追溯这份准备包是基于哪份简历和 JD 生成的。</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-6 xl:grid-cols-2">
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-slate-900">简历内容</h3>
                        <Separator />
                        <div className="max-h-72 overflow-auto whitespace-pre-wrap text-sm leading-6 text-slate-600">
                          {selectedKit.resume_text}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-slate-900">岗位 JD</h3>
                        <Separator />
                        <div className="max-h-72 overflow-auto whitespace-pre-wrap text-sm leading-6 text-slate-600">
                          {selectedKit.job_description}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : null}

              {!bootstrapping && !selectedKit ? (
                <Card className="bg-white/90">
                  <CardContent className="py-16 text-center text-sm text-slate-500">
                    生成一份面试准备包后，这里会展示岗位匹配分析、自我介绍、项目表达和面试题。
                  </CardContent>
                </Card>
              ) : null}
            </div>
            </div>
          ) : null}
        </div>
      </div>
    </AppLayout>
  )
}
