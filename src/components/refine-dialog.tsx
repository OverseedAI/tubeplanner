"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Send, Sparkles, User, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface RefineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  section: string;
  sectionLabel: string;
  currentContent: string;
  onApply: (newContent: string) => void;
}

export function RefineDialog({
  open,
  onOpenChange,
  planId,
  section,
  sectionLabel,
  currentContent,
  onApply,
}: RefineDialogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastAssistantContent, setLastAssistantContent] = useState<string | null>(null);

  // Reset messages when dialog opens with new section
  useEffect(() => {
    if (open) {
      setMessages([]);
      setLastAssistantContent(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, section]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(
    async (userMessage: string) => {
      setIsLoading(true);

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: userMessage,
      };

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);

      try {
        const response = await fetch("/api/chat/refine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId,
            section,
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

        setMessages((prev) => [...prev, assistantMsg]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          assistantContent += chunk;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: assistantContent } : m
            )
          );
        }

        setLastAssistantContent(assistantContent);
      } catch (err) {
        console.error("Refine error:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, planId, section]
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

  const handleApply = () => {
    if (lastAssistantContent) {
      onApply(lastAssistantContent);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[600px] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-red-500" />
            Refine {sectionLabel}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea ref={scrollRef} className="flex-1 px-6">
          <div className="space-y-4 py-4">
            {/* Current content */}
            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-4">
              <p className="text-xs text-zinc-500 mb-2 font-medium">
                Current content:
              </p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                {currentContent || "Empty"}
              </p>
            </div>

            {/* Initial prompt */}
            {messages.length === 0 && (
              <div className="text-center py-8 text-zinc-500">
                <p>How would you like to refine this section?</p>
                <p className="text-sm mt-1">
                  Try: &quot;Make it more engaging&quot; or &quot;Add more specific examples&quot;
                </p>
              </div>
            )}

            {/* Messages */}
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

            {/* Loading */}
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

        {/* Input */}
        <div className="px-6 py-4 border-t">
          <form onSubmit={onSubmit} className="flex gap-2">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask AI to refine this section..."
              className="min-h-[44px] max-h-[100px] resize-none flex-1"
              disabled={isLoading}
            />
            <div className="flex flex-col gap-2">
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isLoading}
                className="h-[44px] w-[44px] bg-red-500 hover:bg-red-600"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </form>

          {lastAssistantContent && (
            <Button
              onClick={handleApply}
              className="w-full mt-3 gap-2"
              variant="outline"
            >
              <Check className="w-4 h-4" />
              Apply AI Suggestion
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
