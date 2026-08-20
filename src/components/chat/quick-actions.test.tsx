import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NextIntlClientProvider } from "next-intl"
import { beforeEach, describe, expect, it, vi } from "vitest"

import enMessages from "@/i18n/messages/en.json"
import zhMessages from "@/i18n/messages/zh-CN.json"
import type { ExpertListItem } from "@/lib/types"
import { QuickActions } from "./quick-actions"

vi.mock("@/hooks/use-built-in-experts", () => ({
  useBuiltInExperts: () => [
    {
      metadata: {
        id: "brainstorming",
        category: "coding",
        icon: null,
        sort_order: 0,
        display_name: { en: "Brainstorming", "zh-CN": "头脑风暴" },
        description: {},
        bundled_hash: "",
      },
      installed_centrally: true,
      user_modified: false,
      central_path: "",
    } satisfies ExpertListItem,
  ],
}))

vi.mock("@/hooks/use-enabled-skill-ids", () => ({
  useEnabledSkillIds: () => ({
    enabledIds: new Set(["brainstorming"]),
    ready: true,
    supported: true,
  }),
}))

vi.mock("@/hooks/use-appearance", () => ({
  useWelcomeQuickActions: () => ({ showWelcomeQuickActions: true }),
}))

vi.mock("@/lib/api", () => ({
  openSettingsWindow: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { warning: vi.fn() },
}))

function renderQuickActions(locale: "en" | "zh-CN", onSelect = vi.fn()) {
  const messages = locale === "en" ? enMessages : zhMessages
  render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QuickActions onSelect={onSelect} agentType="claude_code" />
    </NextIntlClientProvider>
  )
  return onSelect
}

describe("QuickActions compact category menus", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("renders the concise English categories and selects a coding skill", async () => {
    const user = userEvent.setup()
    const onSelect = renderQuickActions("en")

    expect(screen.getByRole("button", { name: "Code" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Work" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Research" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Code" }))
    await user.click(screen.getByRole("menuitem", { name: "Brainstorming" }))

    expect(onSelect).toHaveBeenCalledWith({
      text: "",
      skill: { id: "brainstorming", label: "Brainstorming" },
    })
  })

  it("renders the concise Chinese categories", () => {
    renderQuickActions("zh-CN")

    expect(screen.getByRole("button", { name: "代码" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "日常" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "研究" })).toBeInTheDocument()
  })
})
