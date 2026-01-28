"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApiKey } from "@/hooks/use-api-key";
import { ApiKeyModal } from "@/components/api-key-modal";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-1">
      <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
      <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
      <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" />
    </div>
  );
}

export default function NewPlanPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { hasKey, loading: checkingKey, refresh: refreshKeyStatus } = useApiKey();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  const user = session?.user;
  const showApiKeyModal = !checkingKey && hasKey === false;

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = useCallback(
    async (userMessage: string) => {
      setIsLoading(true);
      setIsThinking(true);
      setError(null);

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: userMessage,
      };

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);

      try {
        const response = await fetch("/api/chat/intake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            planId,
          }),
        });

        if (!response.ok) throw new Error("Failed to send message");

        // Get plan ID from header
        const newPlanId = response.headers.get("x-plan-id");
        if (newPlanId && !planId) {
          setPlanId(newPlanId);
        }

        // Read streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) throw new Error("No response body");

        let assistantContent = "";
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "",
        };

        // First chunk received - stop showing thinking indicator
        let firstChunkReceived = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });

          if (!firstChunkReceived) {
            firstChunkReceived = true;
            setIsThinking(false);
            setMessages((prev) => [...prev, assistantMsg]);
          }

          // Plain text stream - just append
          assistantContent += chunk;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: assistantContent }
                : m
            )
          );
        }

        // Check if plan was generated
        if (assistantContent.includes("[PLAN_GENERATED]")) {
          const match = assistantContent.match(/\[PLAN_ID:([^\]]+)\]/);
          if (match) {
            setIsGeneratingPlan(true);
            setTimeout(() => router.push(`/plans/${match[1]}`), 1500);
          }
        }
      } catch (err) {
        console.error("Chat error:", err);
        setError("Something went wrong. Please try again.");
        setIsThinking(false);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, planId, router]
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const userInput = input;
    setInput("");
    sendMessage(userInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e);
    }
  };

  const displayContent = (content: string) => {
    return content
      .replace(/\[PLAN_GENERATED\]/g, "")
      .replace(/\[PLAN_ID:[^\]]+\]/g, "")
      .trim();
  };

  // Full-screen transition overlay when plan is being generated
  if (isGeneratingPlan) {
    return (
      <div className="flex flex-col items-center justify-center h-full animate-in fade-in duration-300">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 bg-red-500 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              Creating your video plan
            </h2>
            <p className="text-zinc-500">
              Organizing your ideas into a structured plan...
            </p>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      {/* API Key Modal */}
      <ApiKeyModal open={showApiKeyModal} onSuccess={refreshKeyStatus} />

      {/* Header */}
      <div className="p-8 pb-4">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          New Video Plan
        </h1>
        <p className="text-zinc-500 mt-1">
          Tell me about your video idea and I&apos;ll help you plan it out
        </p>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 px-8">
        <div className="space-y-6 pb-4">
          {/* Initial prompt if no messages */}
          {messages.length === 0 && (
            <Card className="p-6 bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800 border-none">
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="space-y-3">
                  <p className="text-zinc-700 dark:text-zinc-300">
                    Hey! I&apos;m here to help you plan an awesome video.
                    Let&apos;s start simple:
                  </p>
                  <p className="text-zinc-900 dark:text-zinc-100 font-medium">
                    What&apos;s your video idea? Just give me a rough concept -
                    it can be as simple as a topic or a question you want to
                    answer.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Chat messages */}
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-4",
                message.role === "user" && "flex-row-reverse"
              )}
            >
              {message.role === "assistant" ? (
                <Avatar className="w-10 h-10 shrink-0 bg-red-500">
                  <AvatarFallback className="bg-red-500 text-white">
                    <Sparkles className="w-5 h-5" />
                  </AvatarFallback>
                </Avatar>
              ) : (
                <Avatar className="w-10 h-10 shrink-0">
                  <AvatarImage src={user?.image ?? undefined} />
                  <AvatarFallback className="bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                    {user?.name?.[0] ?? user?.email?.[0] ?? "U"}
                  </AvatarFallback>
                </Avatar>
              )}

              <div
                className={cn(
                  "flex-1 max-w-[85%]",
                  message.role === "user" && "flex justify-end"
                )}
              >
                <div
                  className={cn(
                    "rounded-2xl px-4 py-3",
                    message.role === "assistant"
                      ? "bg-zinc-100 dark:bg-zinc-800"
                      : "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                  )}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {displayContent(message.content) || <ThinkingIndicator />}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* Thinking indicator (before first chunk arrives) */}
          {isThinking && (
            <div className="flex gap-4">
              <Avatar className="w-10 h-10 bg-red-500 shrink-0">
                <AvatarFallback className="bg-red-500 text-white">
                  <Sparkles className="w-5 h-5" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl px-4 py-3">
                <ThinkingIndicator />
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Plan generating indicator */}
          {isGeneratingPlan && (
            <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/50 dark:to-orange-950/50 border border-red-200 dark:border-red-800/50 rounded-xl">
              <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Generating your video plan...
                </p>
                <p className="text-xs text-zinc-500">
                  This usually takes a few seconds
                </p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-8 pt-4">
        <form onSubmit={onSubmit} className="relative">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your response..."
            className="min-h-[60px] max-h-[200px] pr-14 resize-none rounded-2xl border-zinc-200 dark:border-zinc-700 focus-visible:ring-red-500"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="absolute right-3 bottom-3 w-9 h-9 rounded-xl bg-red-500 hover:bg-red-600"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
        <p className="text-xs text-zinc-400 text-center mt-3">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
