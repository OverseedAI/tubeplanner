"use client";

import { useState } from "react";
import type { VideoPlan, OutlineItem, Hook, HookStyle } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChatPanel, type SectionKey, type Message } from "@/components/chat-panel";
import {
  Lightbulb,
  Users,
  Zap,
  List,
  Image,
  Type,
  Edit3,
  Check,
  X,
  Sparkles,
  ArrowLeft,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  History,
  BookOpen,
  HelpCircle,
  Flame,
  MessageCircleQuestion,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ApiKeyModal } from "@/components/api-key-modal";
import { ConversationHistoryModal } from "@/components/conversation-history-modal";

const hookStyleConfig: Record<HookStyle, { label: string; icon: React.ComponentType<{ className?: string }>; description: string }> = {
  story: { label: "Story", icon: BookOpen, description: "Personal anecdote" },
  curiosity: { label: "Curiosity", icon: HelpCircle, description: "Open loop" },
  bold: { label: "Bold", icon: Flame, description: "Contrarian take" },
  question: { label: "Question", icon: MessageCircleQuestion, description: "Direct engagement" },
};

interface PlanViewerProps {
  plan: VideoPlan;
  initialHasApiKey: boolean;
}

const sections: {
  key: SectionKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}[] = [
  { key: "idea", label: "Core Idea", icon: Lightbulb, description: "The video concept and value" },
  { key: "targetAudience", label: "Target Audience", icon: Users, description: "Who this is for" },
  { key: "hooks", label: "Hook & Intro", icon: Zap, description: "First 30 seconds" },
  { key: "outline", label: "Content Outline", icon: List, description: "Structure and flow" },
  { key: "thumbnailConcepts", label: "Thumbnail Ideas", icon: Image, description: "Visual concepts" },
  { key: "titleOptions", label: "Title Options", icon: Type, description: "Title variations" },
];

export function PlanViewer({ plan: initialPlan, initialHasApiKey }: PlanViewerProps) {
  const [plan, setPlan] = useState(initialPlan);
  const [editingSection, setEditingSection] = useState<SectionKey | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  // API key state
  const [hasApiKey, setHasApiKey] = useState(initialHasApiKey);
  const showApiKeyModal = !hasApiKey;

  // Chat panel state - open by default
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [contextSections, setContextSections] = useState<SectionKey[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  // History modal state
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const intakeMessages = plan.intakeMessages || [];
  const refinementMessages = plan.sectionConversations?.["main"] || [];
  const conversationHistory = [...intakeMessages, ...refinementMessages];
  const hasHistory = conversationHistory.length > 0;

  const startEditing = (key: SectionKey) => {
    // Hooks are edited via the tabbed UI, not bulk text editing
    if (key === "hooks") return;

    const value = plan[key];
    if (Array.isArray(value)) {
      setEditValue(value.map((item) =>
        typeof item === "string" ? item : `${(item as OutlineItem).title}: ${(item as OutlineItem).content}`
      ).join("\n"));
    } else {
      setEditValue(value ?? "");
    }
    setEditingSection(key);
  };

  const cancelEditing = () => {
    setEditingSection(null);
    setEditValue("");
  };

  const saveSection = async (key: SectionKey, newValue: unknown) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: newValue }),
      });

      if (!response.ok) throw new Error("Failed to save");

      setPlan((prev) => ({ ...prev, [key]: newValue }));
      return true;
    } catch (error) {
      console.error("Failed to save:", error);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editingSection) return;

    let newValue: string | string[] | { id: string; title: string; content: string; duration?: string }[];

    if (editingSection === "titleOptions" || editingSection === "thumbnailConcepts") {
      newValue = editValue.split("\n").filter(Boolean);
    } else if (editingSection === "outline") {
      newValue = editValue.split("\n").filter(Boolean).map((line, i) => {
        const [title, ...contentParts] = line.split(":");
        return {
          id: String(i + 1),
          title: title.trim(),
          content: contentParts.join(":").trim() || title.trim(),
        };
      });
    } else {
      newValue = editValue;
    }

    const success = await saveSection(editingSection, newValue);
    if (success) {
      setEditingSection(null);
      setEditValue("");
    }
  };

  const handleEnhance = (key: SectionKey) => {
    // Add section to context if not already there
    if (!contextSections.includes(key)) {
      setContextSections((prev) => [...prev, key]);
    }
    // Open panel if closed
    if (!isPanelOpen) {
      setIsPanelOpen(true);
    }
  };

  const handleRemoveContext = (key: SectionKey) => {
    setContextSections((prev) => prev.filter((s) => s !== key));
  };

  const handleApply = async (sectionKey: SectionKey, content: string) => {
    // Parse the content based on section type
    let parsedValue: string | string[];
    if (sectionKey === "titleOptions" || sectionKey === "thumbnailConcepts") {
      // Split by newlines, filter empties, clean up numbering
      parsedValue = content
        .split("\n")
        .map((line) => line.replace(/^\d+\.\s*/, "").trim())
        .filter(Boolean);
    } else {
      parsedValue = content;
    }

    await saveSection(sectionKey, parsedValue);
  };

  const handleConversationUpdate = (conversations: Record<string, { role: "user" | "assistant"; content: string; createdAt?: string }[]>) => {
    setPlan((prev) => ({ ...prev, sectionConversations: conversations }));
  };

  const handleSelectHook = async (style: HookStyle) => {
    const hooks = plan.hooks;
    if (!hooks) return;

    const updatedHooks = hooks.map((hook) => ({
      ...hook,
      selected: hook.style === style,
    }));

    await saveSection("hooks", updatedHooks);
  };

  const renderSectionContent = (key: SectionKey) => {
    const value = plan[key];

    if (editingSection === key) {
      return (
        <div className="space-y-3">
          <Textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="min-h-[120px] resize-none"
            placeholder={`Enter ${key}...`}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={saving}>
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
            <Button size="sm" onClick={saveEdit} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-1" />
              )}
              Save
            </Button>
          </div>
        </div>
      );
    }

    if (!value || (Array.isArray(value) && value.length === 0)) {
      return (
        <p className="text-zinc-400 italic">Not yet generated</p>
      );
    }

    if (key === "outline" && Array.isArray(value)) {
      const outlineItems = value as OutlineItem[];
      return (
        <div className="space-y-3">
          {outlineItems.map((item, i) => (
            <div key={item.id || i} className="flex gap-3">
              <div className="w-6 h-6 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center shrink-0 text-sm font-medium">
                {i + 1}
              </div>
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-zinc-500 text-sm">{item.content}</p>
                {item.duration && (
                  <p className="text-zinc-400 text-xs mt-1">{item.duration}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (key === "hooks" && Array.isArray(value)) {
      const hooks = value as Hook[];
      const selectedHook = hooks.find((h) => h.selected) || hooks[0];
      const defaultTab = selectedHook?.style || "story";

      return (
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            {hooks.map((hook) => {
              const config = hookStyleConfig[hook.style];
              const Icon = config.icon;
              return (
                <TabsTrigger
                  key={hook.style}
                  value={hook.style}
                  className={cn(
                    "flex items-center gap-1.5 text-xs",
                    hook.selected && "ring-2 ring-red-500 ring-offset-1"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {config.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {hooks.map((hook) => {
            const config = hookStyleConfig[hook.style];
            return (
              <TabsContent key={hook.style} value={hook.style} className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <span>{config.description}</span>
                  {hook.selected && (
                    <Badge variant="secondary" className="text-xs bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400">
                      Selected
                    </Badge>
                  )}
                </div>
                <p className="whitespace-pre-wrap leading-relaxed">{hook.content}</p>
                {!hook.selected && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSelectHook(hook.style)}
                    className="mt-2"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Use this hook
                  </Button>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      );
    }

    if (Array.isArray(value)) {
      const stringItems = value as string[];
      return (
        <ul className="space-y-2">
          {stringItems.map((item, i) => (
            <li key={i} className="flex gap-2 items-start">
              <span className="text-zinc-400 shrink-0">{i + 1}.</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    }

    return <p className="whitespace-pre-wrap leading-relaxed">{value}</p>;
  };

  const isInContext = (key: SectionKey) => contextSections.includes(key);

  return (
    <div className="h-full flex flex-col">
      {/* API Key Modal */}
      <ApiKeyModal open={showApiKeyModal} onSuccess={() => setHasApiKey(true)} />

      {/* Header - spans full width */}
      <div className="p-8 pb-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-xl">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                {plan.title}
              </h1>
              <Badge variant={plan.status === "complete" ? "default" : "secondary"}>
                {plan.status}
              </Badge>
            </div>
            <p className="text-zinc-500 mt-1">
              Created {new Date(plan.createdAt).toLocaleDateString()}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* History button */}
            {hasHistory && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setHistoryModalOpen(true)}
                className="h-10 w-10"
              >
                <History className="w-5 h-5" />
              </Button>
            )}

            {/* Toggle chat panel button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsPanelOpen(!isPanelOpen)}
              className="h-10 w-10"
            >
              {isPanelOpen ? (
                <PanelRightClose className="w-5 h-5" />
              ) : (
                <PanelRightOpen className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Content area - flex row with sections and panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sections */}
        <ScrollArea className="flex-1">
          <div className="p-8 max-w-4xl mx-auto">
            <div className="grid gap-6">
              {sections.map((section) => (
                <Card key={section.key}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center">
                          <section.icon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{section.label}</CardTitle>
                          <p className="text-sm text-zinc-500">{section.description}</p>
                        </div>
                      </div>
                      {editingSection !== section.key && (
                        <div className="flex gap-2">
                          {section.key !== "hooks" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEditing(section.key)}
                            >
                              <Edit3 className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                          )}
                          <Button
                            variant={isInContext(section.key) ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => handleEnhance(section.key)}
                            className={cn(
                              isInContext(section.key) && "bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400"
                            )}
                          >
                            <Sparkles className="w-4 h-4 mr-1" />
                            {isInContext(section.key) ? "In Context" : "Enhance"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <Separator />
                  <CardContent>
                    {renderSectionContent(section.key)}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </ScrollArea>

        {/* Chat Panel - slides in/out */}
        <div
          className={cn(
            "shrink-0 transition-all duration-300 ease-in-out overflow-hidden h-full",
            isPanelOpen ? "w-[380px]" : "w-0"
          )}
        >
          <ChatPanel
            planId={plan.id}
            contextSections={contextSections}
            onRemoveContext={handleRemoveContext}
            messages={messages}
            onMessagesChange={setMessages}
            onApply={handleApply}
            intakeMessages={plan.intakeMessages || []}
            sectionConversations={plan.sectionConversations || {}}
            onConversationUpdate={handleConversationUpdate}
          />
        </div>
      </div>

      {/* Conversation History Modal */}
      <ConversationHistoryModal
        open={historyModalOpen}
        onOpenChange={setHistoryModalOpen}
        messages={conversationHistory}
        planTitle={plan.title}
      />
    </div>
  );
}
