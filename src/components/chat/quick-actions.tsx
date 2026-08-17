"use client"

import { useCallback, useMemo, useState, type ReactNode } from "react"
import { useLocale, useTranslations } from "next-intl"
import { ChevronDown, Lock } from "lucide-react"
import { toast } from "sonner"

import type { ComposerInjectContent } from "@/components/chat/message-input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useWelcomeQuickActions } from "@/hooks/use-appearance"
import { useBuiltInExperts } from "@/hooks/use-built-in-experts"
import { useEnabledSkillIds } from "@/hooks/use-enabled-skill-ids"
import { openSettingsWindow, type SettingsSection } from "@/lib/api"
import { getAgentLabel } from "@/lib/custom-agents"
import { getExpertIcon, pickLocalized } from "@/lib/expert-presentation"
import { OFFICE_ACTIONS, type OfficeAction } from "@/lib/office-actions"
import {
  loadQuickActionsTab,
  saveQuickActionsTab,
  type QuickActionsTab,
} from "@/lib/quick-actions-tab-storage"
import { RESEARCH_ACTIONS, type ResearchAction } from "@/lib/research-actions"
import type { AgentType, ExpertListItem } from "@/lib/types"
import { cn } from "@/lib/utils"

const FEATURED_CODING_IDS = [
  "brainstorming",
  "systematic-debugging",
  "writing-skills",
]

interface CategoryMenuProps {
  label: string
  active: boolean
  onOpen: () => void
  children: ReactNode
}

function CategoryMenu({ label, active, onOpen, children }: CategoryMenuProps) {
  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) onOpen()
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-8 items-center gap-1 rounded-lg px-3 text-sm font-medium",
            "text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "active:scale-[0.96]",
            active && "bg-background text-foreground shadow-sm"
          )}
        >
          {label}
          <ChevronDown aria-hidden className="size-3.5 opacity-55" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-72 rounded-xl">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface SkillMenuItemProps {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  label: string
  locked: boolean
  lockHint: string
  onSelect: () => void
}

function SkillMenuItem({
  icon: Icon,
  label,
  locked,
  lockHint,
  onSelect,
}: SkillMenuItemProps) {
  return (
    <DropdownMenuItem
      title={locked ? lockHint : undefined}
      onSelect={onSelect}
      className="rounded-lg"
    >
      <Icon aria-hidden className="size-4 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {locked && (
        <Lock aria-hidden className="size-3.5 text-muted-foreground/65" />
      )}
    </DropdownMenuItem>
  )
}

interface QuickActionsProps {
  /** Emits the resolved (localized) injection payload for the picked action. */
  onSelect: (payload: ComposerInjectContent) => void
  /** The agent the new conversation will use. */
  agentType: AgentType | null
}

export function QuickActions({ onSelect, agentType }: QuickActionsProps) {
  const t = useTranslations("Folder.chat.welcomePanel.quickActions")
  const locale = useLocale()
  const experts = useBuiltInExperts()
  const { enabledIds, ready, supported } = useEnabledSkillIds(agentType)
  const { showWelcomeQuickActions } = useWelcomeQuickActions()
  const lockHint = t("notEnabled.hint")
  const [category, setCategory] = useState<QuickActionsTab>(() =>
    loadQuickActionsTab()
  )

  const selectCategory = useCallback((next: QuickActionsTab) => {
    setCategory(next)
    saveQuickActionsTab(next)
  }, [])

  const isLocked = useCallback(
    (id: string) => !!agentType && ready && !enabledIds.has(id),
    [agentType, ready, enabledIds]
  )

  const notifyNotEnabled = useCallback(
    (skillLabel: string, section: SettingsSection) => {
      const agentLabel = agentType ? getAgentLabel(agentType) : ""
      toast.warning(
        t("notEnabled.title", { skill: skillLabel, agent: agentLabel }),
        {
          description: t("notEnabled.description"),
          action: {
            label: t("notEnabled.action"),
            onClick: () => {
              void openSettingsWindow(section).catch((err) =>
                console.error("[QuickActions] failed to open settings:", err)
              )
            },
          },
        }
      )
    },
    [agentType, t]
  )

  const handleOffice = useCallback(
    (action: OfficeAction) => {
      const label = t(action.id as Parameters<typeof t>[0])
      if (isLocked(action.skillId)) {
        notifyNotEnabled(label, "office-tools")
        return
      }
      onSelect({
        text: t(action.promptKey as Parameters<typeof t>[0]),
        skill: { id: action.skillId, label },
      })
    },
    [onSelect, t, isLocked, notifyNotEnabled]
  )

  const handleResearch = useCallback(
    (action: ResearchAction) => {
      const label = t(action.id as Parameters<typeof t>[0])
      if (isLocked(action.skillId)) {
        notifyNotEnabled(label, "science")
        return
      }
      onSelect({
        text: t(action.promptKey as Parameters<typeof t>[0]),
        skill: { id: action.skillId, label },
      })
    },
    [onSelect, t, isLocked, notifyNotEnabled]
  )

  const handleExpert = useCallback(
    (item: ExpertListItem) => {
      const label =
        pickLocalized(item.metadata.display_name, locale) || item.metadata.id
      if (isLocked(item.metadata.id)) {
        notifyNotEnabled(label, "experts")
        return
      }
      onSelect({ text: "", skill: { id: item.metadata.id, label } })
    },
    [onSelect, locale, isLocked, notifyNotEnabled]
  )

  const sortedExperts = useMemo(() => {
    const featuredRank = new Map(
      FEATURED_CODING_IDS.map((id, index) => [id, index])
    )
    return [...experts].sort((a, b) => {
      const aRank = featuredRank.get(a.metadata.id)
      const bRank = featuredRank.get(b.metadata.id)
      if (aRank !== undefined || bRank !== undefined) {
        return (
          (aRank ?? Number.MAX_SAFE_INTEGER) -
          (bRank ?? Number.MAX_SAFE_INTEGER)
        )
      }
      return (
        (a.metadata.sort_order ?? 0) - (b.metadata.sort_order ?? 0) ||
        a.metadata.id.localeCompare(b.metadata.id)
      )
    })
  }, [experts])

  if (!supported || !showWelcomeQuickActions) return null

  return (
    <div className="mx-auto inline-flex max-w-full items-center gap-0.5 rounded-xl bg-muted/55 p-1 ring-1 ring-border/50">
      <CategoryMenu
        label={t("tabs.coding")}
        active={category === "coding"}
        onOpen={() => selectCategory("coding")}
      >
        {sortedExperts.map((item) => {
          const Icon = getExpertIcon(item.metadata.icon)
          const label =
            pickLocalized(item.metadata.display_name, locale) ||
            item.metadata.id
          return (
            <SkillMenuItem
              key={item.metadata.id}
              icon={Icon}
              label={label}
              locked={isLocked(item.metadata.id)}
              lockHint={lockHint}
              onSelect={() => handleExpert(item)}
            />
          )
        })}
      </CategoryMenu>

      <CategoryMenu
        label={t("tabs.office")}
        active={category === "office"}
        onOpen={() => selectCategory("office")}
      >
        {OFFICE_ACTIONS.map((action) => (
          <SkillMenuItem
            key={action.id}
            icon={action.icon}
            label={t(action.id as Parameters<typeof t>[0])}
            locked={isLocked(action.skillId)}
            lockHint={lockHint}
            onSelect={() => handleOffice(action)}
          />
        ))}
      </CategoryMenu>

      <CategoryMenu
        label={t("tabs.research")}
        active={category === "research"}
        onOpen={() => selectCategory("research")}
      >
        {RESEARCH_ACTIONS.map((action) => (
          <SkillMenuItem
            key={action.id}
            icon={action.icon}
            label={t(action.id as Parameters<typeof t>[0])}
            locked={isLocked(action.skillId)}
            lockHint={lockHint}
            onSelect={() => handleResearch(action)}
          />
        ))}
      </CategoryMenu>
    </div>
  )
}
