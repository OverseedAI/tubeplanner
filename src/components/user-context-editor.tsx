"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Check } from "lucide-react";

interface UserContextEditorProps {
  initialContext: string;
}

export function UserContextEditor({ initialContext }: UserContextEditorProps) {
  const [context, setContext] = useState(initialContext);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDirty(context !== initialContext);
  }, [context, initialContext]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/user/context", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userContext: context }),
      });
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <Textarea
        value={context}
        onChange={(e) => setContext(e.target.value)}
        placeholder="Tell the AI about yourself as a creator...

Examples:
- Your channel niche and content style
- Your typical video format (tutorials, vlogs, reviews)
- Your tone of voice (casual, professional, humorous)
- Your target audience demographics
- Topics you frequently cover"
        className="min-h-[160px] resize-none"
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          This context helps personalize AI suggestions for your content.
        </p>

        <Button
          onClick={handleSave}
          disabled={saving || !dirty}
          size="sm"
          className="gap-2"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <Check className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? "Saved" : "Save"}
        </Button>
      </div>
    </div>
  );
}
