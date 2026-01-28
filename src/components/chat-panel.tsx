"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ContextTag } from "@/components/context-tag";
import {
  Loader2,
  Send,
  Sparkles,
  User,
  Check,
  Lightbulb,
  Users,
  Zap,
  List,
  Image,
  Type,
  MessageSquare,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SectionKey = "idea" | "targetAudience" | "hook" | "outline" | "thumbnailConcepts" | "titleOptions";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// DB message type (without id)
interface DbMessage {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

interface SectionConfig {
  key: SectionKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const sectionConfigs: SectionConfig[] = [
  { key: "idea", label: "Core Idea", icon: Lightbulb },
  { key: "targetAudience", label: "Target Audience", icon: Users },
  { key: "hook", label: "Hook & Intro", icon: Zap },
  { key: "outline", label: "Content Outline", icon: List },
  { key: "thumbnailConcepts", label: "Thumbnail Ideas", icon: Image },
  { key: "titleOptions", label: "Title Options", icon: Type },
];

interface ChatPanelProps {
  planId: string;
  contextSections: SectionKey[];
  onRemoveContext: (key: SectionKey) => void;
  messages: Message[];
  onMessagesChange: (messages: Message[]) => void;
  onApply: (sectionKey: SectionKey, content: string) => void;
  intakeMessages: DbMessage[];
  sectionConversations: Record<string, DbMessage[]>;
  onConversationUpdate?: (conversations: Record<string, DbMessage[]>) => void;
}

export function ChatPanel({
  planId,
  contextSections,
  onRemoveContext,
  messages,
  onMessagesChange,
  onApply,
  intakeMessages,
  sectionConversations,
  onConversationUpdate,
}: ChatPanelProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastAssistantContent, setLastAssistantContent] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Unified conversation history: intake + refinement
  const refinementHistory = sectionConversations["main"] || [];
  const conversationHistory = [...intakeMessages, ...refinementHistory];
  const showHistoryBanner = conversationHistory.length > 0 && messages.length === 0 && !bannerDismissed;

  // Auto-scroll on new messages
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]');
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);


  const loadHistory = () => {
    if (conversationHistory.length > 0) {
      const loadedMessages: Message[] = conversationHistory.map((msg, i) => ({
        id: `history-${i}`,
        role: msg.role,
        content: msg.content,
      }));
      onMessagesChange(loadedMessages);
      setBannerDismissed(true);
    }
  };

  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (contextSections.length === 0) return;

      setIsLoading(true);

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: userMessage,
      };

      const updatedMessages = [...messages, userMsg];
      onMessagesChange(updatedMessages);

      try {
        const response = await fetch("/api/chat/refine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId,
            contextSections,
            messages: updatedMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        if (!response.ok) throw new Error("Failed to send message");

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) throw new Error("No response body");

        let assistantContent = "";
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "",
        };

        onMessagesChange([...updatedMessages, assistantMsg]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          assistantContent += chunk;

          onMessagesChange([
            ...updatedMessages,
            { ...assistantMsg, content: assistantContent },
          ]);
        }

        setLastAssistantContent(assistantContent);

        // Update parent with new conversation state
        if (onConversationUpdate) {
          const finalMessages = [
            ...updatedMessages.map((m) => ({ role: m.role, content: m.content })),
            { role: "assistant" as const, content: assistantContent, createdAt: new Date().toISOString() },
          ];
          onConversationUpdate({
            ...sectionConversations,
            main: finalMessages,
          });
        }
      } catch (err) {
        console.error("Chat error:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, planId, contextSections, onMessagesChange, onConversationUpdate, sectionConversations]
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const userInput = input;
    setInput("");
    sendMessage(userInput);
    // Keep focus on input after submit
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e);
    }
  };

  const getSectionConfig = (key: SectionKey): SectionConfig => {
    return sectionConfigs.find((s) => s.key === key) || sectionConfigs[0];
  };

  return (
    <div className="w-[380px] min-w-[380px] border-l border-zinc-200 dark:border-zinc-800 flex flex-col bg-white dark:bg-zinc-950 h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-red-500" />
          <span className="font-semibold">AI Assistant</span>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 px-4">
        <div className="space-y-4 py-4">
          {/* History banner - Option B */}
          {showHistoryBanner && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <MessageSquare className="w-4 h-4" />
                <span>{conversationHistory.length} previous messages</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={loadHistory}
                >
                  Load
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setBannerDismissed(true)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {messages.length === 0 && !showHistoryBanner && (
            <div className="text-center py-8 text-zinc-500">
              {contextSections.length === 0 ? (
                <p>Click &quot;Enhance&quot; on a section to add it as context</p>
              ) : (
                <>
                  <p>How would you like to enhance these sections?</p>
                  <p className="text-sm mt-1">
                    Try: &quot;Make it more engaging&quot; or &quot;Add specific examples&quot;
                  </p>
                </>
              )}
            </div>
          )}

          {/* Message list */}
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user" && "flex-row-reverse"
              )}
            >
              <Avatar
                className={cn(
                  "w-8 h-8 shrink-0",
                  message.role === "assistant"
                    ? "bg-red-500"
                    : "bg-zinc-200 dark:bg-zinc-700"
                )}
              >
                <AvatarFallback
                  className={cn(
                    message.role === "assistant"
                      ? "bg-red-500 text-white"
                      : "bg-zinc-200 dark:bg-zinc-700"
                  )}
                >
                  {message.role === "assistant" ? (
                    <Sparkles className="w-4 h-4" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                </AvatarFallback>
              </Avatar>

              <div
                className={cn(
                  "flex-1 max-w-[85%]",
                  message.role === "user" && "flex justify-end"
                )}
              >
                <div
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm",
                    message.role === "assistant"
                      ? "bg-zinc-100 dark:bg-zinc-800"
                      : "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                  )}
                >
                  <p className="whitespace-pre-wrap">
                    {message.content || (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-3">
              <Avatar className="w-8 h-8 bg-red-500 shrink-0">
                <AvatarFallback className="bg-red-500 text-white">
                  <Sparkles className="w-4 h-4" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Apply buttons - show when we have a response and context sections */}
      {lastAssistantContent && contextSections.length > 0 && (
        <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 mb-2">Apply to section:</p>
          <div className="flex flex-wrap gap-2">
            {contextSections.map((key) => {
              const config = getSectionConfig(key);
              return (
                <Button
                  key={key}
                  variant="outline"
                  size="sm"
                  onClick={() => onApply(key, lastAssistantContent)}
                  className="gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  {config.label}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* Context Tags + Input */}
      <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800">
        {/* Context tags */}
        {contextSections.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {contextSections.map((key) => {
              const config = getSectionConfig(key);
              return (
                <ContextTag
                  key={key}
                  label={config.label}
                  icon={config.icon}
                  onRemove={() => onRemoveContext(key)}
                />
              );
            })}
          </div>
        )}

        {/* Input */}
        <form onSubmit={onSubmit} className="flex gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              contextSections.length === 0
                ? "Add sections to enhance..."
                : "Ask AI to enhance..."
            }
            className="min-h-[44px] max-h-[100px] resize-none flex-1"
            disabled={isLoading || contextSections.length === 0}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading || contextSections.length === 0}
            className="h-[44px] w-[44px] bg-red-500 hover:bg-red-600"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
