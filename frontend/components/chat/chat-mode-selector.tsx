"use client"

import { AgentMode } from "@/lib/types"
import { getModeLabel, getModeDescription } from "@/lib/session"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Bot, BookOpen, Workflow, Search, Shield, BriefcaseBusiness } from "lucide-react"

const modeIcons: Record<AgentMode, React.ComponentType<{ className?: string }>> = {
  'basic-agent': Bot,
  'rag': BookOpen,
  'workflow': Workflow,
  'deep-research': Search,
  'guarded': Shield,
  'interview': BriefcaseBusiness,
}

interface ChatModeSelectorProps {
  value: AgentMode
  onChange: (mode: AgentMode) => void
}

export function ChatModeSelector({ value, onChange }: ChatModeSelectorProps) {
  const modes: AgentMode[] = ['basic-agent', 'rag', 'workflow', 'deep-research', 'guarded', 'interview']

  return (
    <Select value={value} onValueChange={(v) => onChange(v as AgentMode)}>
      <SelectTrigger className="w-[200px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {modes.map((mode) => {
          const Icon = modeIcons[mode]
          return (
            <SelectItem key={mode} value={mode}>
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <div>
                  <div className="font-medium">{getModeLabel(mode)}</div>
                  <div className="text-xs text-muted-foreground">
                    {getModeDescription(mode)}
                  </div>
                </div>
              </div>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
