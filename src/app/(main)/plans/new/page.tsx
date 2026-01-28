"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Send, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function NewPlanPage() {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = useCallback(
    async (userMessage: string) => {
      setIsLoading(true);
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

        setMessages((prev) => [...prev, assistantMsg]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          // Parse SSE data
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("0:")) {
              // Text chunk - extract the JSON string
              try {
                const text = JSON.parse(line.slice(2));
                assistantContent += text;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, content: assistantContent }
                      : m
                  )
                );
              } catch {
                // Not valid JSON, skip
              }
            }
          }
        }

        // Check if plan was generated
        if (assistantContent.includes("[PLAN_GENERATED]")) {
          const match = assistantContent.match(/\[PLAN_ID:([^\]]+)\]/);
          if (match) {
            setTimeout(() => router.push(`/plans/${match[1]}`), 500);
          }
        }
      } catch (err) {
        console.error("Chat error:", err);
        setError("Something went wrong. Please try again.");
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

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
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
              <Avatar
                className={cn(
                  "w-10 h-10 shrink-0",
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
                    <Sparkles className="w-5 h-5" />
                  ) : (
                    <User className="w-5 h-5" />
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
                    "rounded-2xl px-4 py-3",
                    message.role === "assistant"
                      ? "bg-zinc-100 dark:bg-zinc-800"
                      : "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                  )}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {displayContent(message.content) || (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* Loading indicator (only when waiting for first chunk) */}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-4">
              <Avatar className="w-10 h-10 bg-red-500 shrink-0">
                <AvatarFallback className="bg-red-500 text-white">
                  <Sparkles className="w-5 h-5" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl px-4 py-3">
                <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400">
              {error}
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
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
        <p className="text-xs text-zinc-400 text-center mt-3">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
