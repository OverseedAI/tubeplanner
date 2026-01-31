"use client";

import { useState } from "react";
import type { VideoPlan, OutlineItem, Hook, HookStyle, CtrCombo } from "@/db/schema";
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
  RefreshCw,
  MousePointerClick,
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

function RatingBadge({ label, value }: { label: string; value: number }) {
  const getColor = (v: number) => {
    if (v >= 4) return "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950";
    if (v >= 3) return "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950";
    return "text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800";
  };

  return (
    <div className={cn("px-2 py-1 rounded-md text-xs font-medium", getColor(value))}>
      {label}: {value}/5
    </div>
  );
}

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
  { key: "ctrCombos", label: "CTR Combos", icon: MousePointerClick, description: "Title + thumbnail pairs" },
];

export function PlanViewer({ plan: initialPlan, initialHasApiKey }: PlanViewerProps) {
  const [plan, setPlan] = useState(initialPlan);
  const [editingSection, setEditingSection] = useState<SectionKey | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState<SectionKey | null>(null);

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
    // Hooks and CTR combos are edited via the tabbed UI, not bulk text editing
    if (key === "hooks" || key === "ctrCombos") return;

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

    let newValue: string | { id: string; title: string; content: string; duration?: string }[];

    if (editingSection === "outline") {
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
    // For most sections, just apply the content directly
    // Complex sections like hooks and ctrCombos should be regenerated rather than applied from chat
    await saveSection(sectionKey, content);
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

  const handleSelectCombo = async (id: string) => {
    const combos = plan.ctrCombos;
    if (!combos) return;

    const updatedCombos = combos.map((combo) => ({
      ...combo,
      selected: combo.id === id,
    }));

    await saveSection("ctrCombos", updatedCombos);
  };

  const handleRegenerate = async (key: SectionKey) => {
    setRegenerating(key);
    try {
      const response = await fetch(`/api/plans/${plan.id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: key }),
      });

      if (!response.ok) throw new Error("Failed to regenerate");

      const data = await response.json();
      setPlan((prev) => ({ ...prev, [key]: data[key] }));
    } catch (error) {
      console.error("Failed to regenerate:", error);
    } finally {
      setRegenerating(null);
    }
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

    if (key === "ctrCombos" && Array.isArray(value)) {
      const combos = value as CtrCombo[];
      const selectedCombo = combos.find((c) => c.selected) || combos[0];
      const defaultTab = selectedCombo?.id || "1";

      return (
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            {combos.map((combo, i) => (
              <TabsTrigger
                key={combo.id}
                value={combo.id}
                className={cn(
                  "flex items-center gap-1.5 text-xs",
                  combo.selected && "ring-2 ring-red-500 ring-offset-1"
                )}
              >
                Option {i + 1}
                {combo.selected && <Check className="w-3 h-3 ml-1" />}
              </TabsTrigger>
            ))}
          </TabsList>

          {combos.map((combo) => (
            <TabsContent key={combo.id} value={combo.id} className="space-y-4">
              {/* Title */}
              <div>
                <p className="text-xs text-zinc-500 mb-1">Title</p>
                <p className="font-medium text-lg">{combo.title}</p>
              </div>

              {/* Thumbnail */}
              <div>
                <p className="text-xs text-zinc-500 mb-1">Thumbnail Concept</p>
                <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Image className="w-4 h-4 text-zinc-400" />
                    <span className="text-sm text-zinc-500">Visual concept</span>
                  </div>
                  <p className="text-sm">{combo.thumbnail}</p>
                </div>
              </div>

              {/* Ratings */}
              <div className="flex gap-4">
                <RatingBadge label="Curiosity" value={combo.ratings.curiosity} />
                <RatingBadge label="Clarity" value={combo.ratings.clarity} />
                <RatingBadge label="Emotion" value={combo.ratings.emotion} />
              </div>

              {!combo.selected && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelectCombo(combo.id)}
                  className="mt-2"
                >
                  <Check className="w-4 h-4 mr-1" />
                  Use this combo
                </Button>
              )}
              {combo.selected && (
                <Badge variant="secondary" className="bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400">
                  Selected
                </Badge>
              )}
            </TabsContent>
          ))}
        </Tabs>
      );
    }

    // For text sections (idea, targetAudience)
    return <p className="whitespace-pre-wrap leading-relaxed">{value as string}</p>;
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRegenerate(section.key)}
                            disabled={regenerating === section.key}
                          >
                            <RefreshCw className={cn("w-4 h-4 mr-1", regenerating === section.key && "animate-spin")} />
                            {regenerating === section.key ? "Regenerating..." : "Regenerate"}
                          </Button>
                          {section.key !== "hooks" && section.key !== "ctrCombos" && (
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
