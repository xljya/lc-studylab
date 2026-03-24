"""
AI 面试助手 API

提供一个更贴近真实求职场景的产品化能力：
1. 根据简历和岗位描述生成面试准备包
2. 将准备包持久化到 SQLite，支持用户隔离和历史记录
3. 返回适合前端直接展示的结构化数据
"""

from __future__ import annotations

from datetime import datetime, timezone
import time
from typing import List, Optional, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.dependencies import get_current_user
from config import get_logger, settings
from core.database import (
    create_interview_kit_for_user,
    delete_interview_kit_for_user,
    get_interview_kit_for_user,
    list_interview_kits_for_user,
)
from core.models import get_chat_model
from core.usage_tracker import create_usage_tracker

logger = get_logger(__name__)

router = APIRouter(prefix="/interview", tags=["interview"])

CHAT_MODEL_PRICING = {
    "gpt-4o": {"input": 0.005, "output": 0.015},
    "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
    # DeepSeek 官方 Models & Pricing 页面当前标注的 USD 单价（每 1M tokens）
    "deepseek-chat": {"input": 0.28, "cached_input": 0.028, "output": 0.42},
    "deepseek-reasoner": {"input": 0.28, "cached_input": 0.028, "output": 0.42},
}

InterviewModelId = Literal["gpt-4o", "gpt-4o-mini", "deepseek-chat", "deepseek-reasoner"]


class InterviewQuestion(BaseModel):
    question: str = Field(..., description="面试问题")
    intent: str = Field(..., description="面试官考察意图")
    answer_tips: List[str] = Field(default_factory=list, description="回答提示")


class PreparationTask(BaseModel):
    title: str = Field(..., description="准备任务标题")
    why: str = Field(..., description="为什么要做")
    action: str = Field(..., description="推荐动作")
    priority: Literal["high", "medium", "low"] = Field(..., description="优先级")


class InterviewKitContent(BaseModel):
    summary: str = Field(..., description="候选人与岗位匹配总结")
    role_fit_score: int = Field(..., ge=0, le=100, description="岗位匹配分")
    strengths: List[str] = Field(default_factory=list, description="候选人优势")
    risks: List[str] = Field(default_factory=list, description="候选人风险点")
    focus_points: List[str] = Field(default_factory=list, description="面试重点")
    self_intro: str = Field(..., description="建议的 1 分钟自我介绍")
    project_story: str = Field(..., description="建议重点讲的项目故事")
    likely_questions: List[InterviewQuestion] = Field(
        default_factory=list,
        description="高概率面试问题",
    )
    prep_plan: List[PreparationTask] = Field(
        default_factory=list,
        description="准备计划",
    )
    suggested_followups: List[str] = Field(
        default_factory=list,
        description="后续建议",
    )


class InterviewGenerationMetrics(BaseModel):
    model_id: str
    generation_ms: int = 0
    input_chars: int = 0
    output_chars: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    reasoning_tokens: int = 0
    cached_input_tokens: int = 0
    total_tokens: int = 0
    estimated_cost_usd: float = 0.0


class CreateInterviewKitRequest(BaseModel):
    candidate_name: Optional[str] = Field(default=None, description="候选人姓名")
    target_role: str = Field(..., min_length=2, description="目标岗位")
    company_name: Optional[str] = Field(default=None, description="公司名称")
    resume_text: str = Field(..., min_length=30, description="简历文本")
    job_description: str = Field(..., min_length=30, description="岗位描述文本")
    model_id: Optional[InterviewModelId] = Field(default=None, description="本次生成使用的模型")
    focus_areas: List[str] = Field(
        default_factory=list,
        description="希望重点准备的主题",
    )


class InterviewKit(InterviewKitContent):
    id: str
    created_at: str
    candidate_name: Optional[str] = None
    target_role: str
    company_name: Optional[str] = None
    resume_text: str
    job_description: str
    focus_areas: List[str] = Field(default_factory=list)
    metrics: Optional[InterviewGenerationMetrics] = None


class InterviewKitSummary(BaseModel):
    id: str
    created_at: str
    candidate_name: Optional[str] = None
    target_role: str
    company_name: Optional[str] = None
    role_fit_score: int
    summary: str
    strengths: List[str] = Field(default_factory=list)


class CountStat(BaseModel):
    label: str
    count: int


class DailyInterviewStat(BaseModel):
    date: str
    count: int
    average_score: float


class InterviewStats(BaseModel):
    total_kits: int
    average_role_fit_score: float
    high_fit_count: int
    recent_7d_count: int
    average_generation_ms: float
    total_input_tokens: int
    total_output_tokens: int
    total_estimated_cost_usd: float
    top_focus_areas: List[CountStat] = Field(default_factory=list)
    top_target_roles: List[CountStat] = Field(default_factory=list)
    recent_activity: List[DailyInterviewStat] = Field(default_factory=list)


def _extract_json_object(content: str) -> dict:
    import json

    text = content.strip()

    if "```json" in text:
        text = text.split("```json", 1)[1].split("```", 1)[0].strip()
    elif "```" in text:
        text = text.split("```", 1)[1].split("```", 1)[0].strip()

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("模型未返回有效 JSON")

    return json.loads(text[start : end + 1])


def _estimate_chat_cost(
    model_id: str,
    input_tokens: int,
    output_tokens: int,
    cached_input_tokens: int = 0,
) -> float:
    pricing = CHAT_MODEL_PRICING.get(model_id)
    if not pricing:
        return 0.0

    cached_input_tokens = max(cached_input_tokens, 0)
    uncached_input_tokens = max(input_tokens - cached_input_tokens, 0)

    input_cost = (uncached_input_tokens / 1_000_000) * pricing["input"]
    cached_input_cost = (cached_input_tokens / 1_000_000) * pricing.get(
        "cached_input",
        pricing["input"],
    )
    output_cost = (output_tokens / 1_000_000) * pricing["output"]
    return round(input_cost + cached_input_cost + output_cost, 6)


async def _generate_interview_content(
    request: CreateInterviewKitRequest,
) -> tuple[InterviewKitContent, InterviewGenerationMetrics]:
    model_id = request.model_id or settings.openai_model
    model = get_chat_model(model_name=model_id, temperature=0.3, streaming=False)
    usage_tracker = create_usage_tracker(model_id)

    focus_text = "、".join(request.focus_areas) if request.focus_areas else "项目表达、岗位匹配度、技术深挖"

    prompt = f"""
你是一名资深 AI 面试官和求职顾问。请根据候选人简历和岗位描述，输出一个中文的“面试准备包”。

输出要求：
1. 只返回 JSON，不要返回 markdown、解释或额外文本。
2. JSON 必须包含以下字段：
{{
  "summary": "字符串，120-220字",
  "role_fit_score": 0-100 的整数,
  "strengths": ["优势1", "优势2", "优势3"],
  "risks": ["风险1", "风险2", "风险3"],
  "focus_points": ["重点1", "重点2", "重点3", "重点4"],
  "self_intro": "1分钟自我介绍，180-260字",
  "project_story": "重点项目表达模板，180-260字",
  "likely_questions": [
    {{
      "question": "问题内容",
      "intent": "考察意图",
      "answer_tips": ["提示1", "提示2", "提示3"]
    }}
  ],
  "prep_plan": [
    {{
      "title": "准备动作",
      "why": "原因",
      "action": "具体做法",
      "priority": "high|medium|low"
    }}
  ],
  "suggested_followups": ["建议1", "建议2", "建议3"]
}}
3. likely_questions 输出 6 条，prep_plan 输出 5 条。
4. 结论必须紧扣岗位要求，不要空泛鼓励。
5. 如果简历和岗位要求存在明显差距，要坦诚指出。

候选人姓名：{request.candidate_name or "未提供"}
目标岗位：{request.target_role}
目标公司：{request.company_name or "未提供"}
重点关注：{focus_text}

岗位描述：
{request.job_description}

候选人简历：
{request.resume_text}
""".strip()

    started = time.perf_counter()
    response = await model.ainvoke([{"role": "user", "content": prompt}])
    generation_ms = int((time.perf_counter() - started) * 1000)

    content = getattr(response, "content", "")
    usage_tracker.update_from_metadata(getattr(response, "response_metadata", {}))
    usage_metadata = getattr(response, "usage_metadata", None)
    if usage_metadata:
        usage_tracker.update_from_metadata({"usage_metadata": usage_metadata})

    parsed = _extract_json_object(content)
    usage_info = usage_tracker.get_usage_info()

    metrics = InterviewGenerationMetrics(
        model_id=model_id,
        generation_ms=generation_ms,
        input_chars=len(prompt),
        output_chars=len(content),
        input_tokens=usage_info["usage"]["inputTokens"],
        output_tokens=usage_info["usage"]["outputTokens"],
        reasoning_tokens=usage_info["usage"]["reasoningTokens"],
        cached_input_tokens=usage_info["usage"].get("cachedInputTokens", 0),
        total_tokens=usage_info["usedTokens"],
        estimated_cost_usd=_estimate_chat_cost(
            model_id,
            usage_info["usage"]["inputTokens"],
            usage_info["usage"]["outputTokens"],
            usage_info["usage"].get("cachedInputTokens", 0),
        ),
    )

    return InterviewKitContent.model_validate(parsed), metrics


def _to_summary(kit: InterviewKit) -> InterviewKitSummary:
    return InterviewKitSummary(
        id=kit.id,
        created_at=kit.created_at,
        candidate_name=kit.candidate_name,
        target_role=kit.target_role,
        company_name=kit.company_name,
        role_fit_score=kit.role_fit_score,
        summary=kit.summary,
        strengths=kit.strengths[:3],
    )


@router.get("/kits", response_model=List[InterviewKitSummary])
async def list_interview_kits(current_user: dict = Depends(get_current_user)) -> List[InterviewKitSummary]:
    kits = [
        InterviewKit.model_validate(item)
        for item in list_interview_kits_for_user(current_user["id"])
    ]
    return [_to_summary(kit) for kit in kits]


@router.get("/kits/{kit_id}", response_model=InterviewKit)
async def get_interview_kit(
    kit_id: str,
    current_user: dict = Depends(get_current_user),
) -> InterviewKit:
    kit = get_interview_kit_for_user(current_user["id"], kit_id)
    if kit is None:
        raise HTTPException(status_code=404, detail="Interview kit not found")
    return InterviewKit.model_validate(kit)


@router.post("/kits", response_model=InterviewKit)
async def create_interview_kit(
    request: CreateInterviewKitRequest,
    current_user: dict = Depends(get_current_user),
) -> InterviewKit:
    logger.info(f"🎯 为用户 {current_user['email']} 生成面试准备包: {request.target_role}")

    try:
        content, metrics = await _generate_interview_content(request)
    except Exception as exc:
        logger.error(f"❌ 面试准备包生成失败: {exc}", exc_info=True)
        raise HTTPException(
            status_code=502,
            detail=f"面试准备包生成失败: {exc}",
        ) from exc

    kit = InterviewKit(
        id=f"kit_{uuid4().hex[:12]}",
        created_at=datetime.now(timezone.utc).isoformat(),
        candidate_name=request.candidate_name,
        target_role=request.target_role,
        company_name=request.company_name,
        resume_text=request.resume_text,
        job_description=request.job_description,
        focus_areas=request.focus_areas,
        metrics=metrics,
        **content.model_dump(),
    )

    create_interview_kit_for_user(current_user["id"], kit.model_dump())
    return kit


@router.delete("/kits/{kit_id}")
async def delete_interview_kit(
    kit_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    deleted = delete_interview_kit_for_user(current_user["id"], kit_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Interview kit not found")

    return {"success": True}


@router.get("/stats", response_model=InterviewStats)
async def get_interview_stats(current_user: dict = Depends(get_current_user)) -> InterviewStats:
    kits = [
        InterviewKit.model_validate(item)
        for item in list_interview_kits_for_user(current_user["id"])
    ]
    if not kits:
        return InterviewStats(
            total_kits=0,
            average_role_fit_score=0.0,
            high_fit_count=0,
            recent_7d_count=0,
            average_generation_ms=0.0,
            total_input_tokens=0,
            total_output_tokens=0,
            total_estimated_cost_usd=0.0,
        )

    from collections import Counter, defaultdict
    from datetime import timedelta

    now = datetime.now(timezone.utc)
    focus_counter: Counter[str] = Counter()
    role_counter: Counter[str] = Counter()
    daily_scores: defaultdict[str, List[int]] = defaultdict(list)

    total_score = 0
    high_fit_count = 0
    recent_7d_count = 0
    total_generation_ms = 0
    total_input_tokens = 0
    total_output_tokens = 0
    total_estimated_cost_usd = 0.0
    metrics_count = 0

    for kit in kits:
        total_score += kit.role_fit_score
        if kit.role_fit_score >= 80:
            high_fit_count += 1

        created_at = datetime.fromisoformat(kit.created_at)
        if created_at >= now - timedelta(days=7):
            recent_7d_count += 1

        daily_key = created_at.date().isoformat()
        daily_scores[daily_key].append(kit.role_fit_score)

        for area in kit.focus_areas:
            if area.strip():
                focus_counter[area.strip()] += 1

        if kit.target_role.strip():
            role_counter[kit.target_role.strip()] += 1

        if kit.metrics:
            metrics_count += 1
            total_generation_ms += kit.metrics.generation_ms
            total_input_tokens += kit.metrics.input_tokens
            total_output_tokens += kit.metrics.output_tokens
            total_estimated_cost_usd += kit.metrics.estimated_cost_usd

    recent_activity = [
        DailyInterviewStat(
            date=day,
            count=len(scores),
            average_score=round(sum(scores) / len(scores), 1),
        )
        for day, scores in sorted(daily_scores.items())[-7:]
    ]

    return InterviewStats(
        total_kits=len(kits),
        average_role_fit_score=round(total_score / len(kits), 1),
        high_fit_count=high_fit_count,
        recent_7d_count=recent_7d_count,
        average_generation_ms=round(total_generation_ms / metrics_count, 1) if metrics_count else 0.0,
        total_input_tokens=total_input_tokens,
        total_output_tokens=total_output_tokens,
        total_estimated_cost_usd=round(total_estimated_cost_usd, 6),
        top_focus_areas=[
            CountStat(label=label, count=count)
            for label, count in focus_counter.most_common(5)
        ],
        top_target_roles=[
            CountStat(label=label, count=count)
            for label, count in role_counter.most_common(5)
        ],
        recent_activity=recent_activity,
    )
