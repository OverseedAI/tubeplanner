"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Copy, Check, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

interface ConversationHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: Message[];
  planTitle: string;
}

export function ConversationHistoryModal({
  open,
  onOpenChange,
  messages,
  planTitle,
}: ConversationHistoryModalProps) {
  const [copied, setCopied] = useState(false);

  const exportAsText = () => {
    let text = `# Conversation History: ${planTitle}\n\n`;

    messages.forEach((msg) => {
      const role = msg.role === "user" ? "You" : "AI";
      text += `**${role}:** ${msg.content}\n\n`;
    });

    return text;
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(exportAsText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const text = exportAsText();
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${planTitle.toLowerCase().replace(/\s+/g, "-")}-conversation.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Conversation History</DialogTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={messages.length === 0}
              >
                {copied ? (
                  <Check className="w-4 h-4 mr-1" />
                ) : (
                  <Copy className="w-4 h-4 mr-1" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={messages.length === 0}
              >
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto pr-2">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <p>No conversation history yet</p>
              <p className="text-sm mt-1">
                Start chatting with AI to enhance your plan
              </p>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              {messages.map((message, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" && "flex-row-reverse"
                  )}
                >
                  <div
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                      message.role === "assistant"
                        ? "bg-red-500 text-white"
                        : "bg-zinc-200 dark:bg-zinc-700"
                    )}
                  >
                    {message.role === "assistant" ? (
                      <Sparkles className="w-3.5 h-3.5" />
                    ) : (
                      <User className="w-3.5 h-3.5" />
                    )}
                  </div>
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
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
