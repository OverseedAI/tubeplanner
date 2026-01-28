"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContextTagProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onRemove: () => void;
  className?: string;
}

export function ContextTag({ label, icon: Icon, onRemove, className }: ContextTagProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full",
        "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300",
        "text-sm font-medium",
        className
      )}
    >
      <Icon className="w-3.5 h-3.5 text-zinc-500" />
      <span>{label}</span>
      <button
        onClick={onRemove}
        className="ml-0.5 p-0.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
      >
        <X className="w-3 h-3 text-zinc-500" />
      </button>
    </div>
  );
}
