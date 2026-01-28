"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Key, ExternalLink, Eye, EyeOff } from "lucide-react";

interface ApiKeyModalProps {
  open: boolean;
  onSuccess: () => void;
}

export function ApiKeyModal({ open, onSuccess }: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!apiKey.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/user/api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save");
      }

      setApiKey("");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save API key");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center mb-2">
            <Key className="w-6 h-6 text-red-500" />
          </div>
          <DialogTitle>Add your Anthropic API key</DialogTitle>
          <DialogDescription>
            TubePlanner uses Claude to power AI features. You&apos;ll need to add your
            own API key to continue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="pr-10 font-mono text-sm"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center gap-1"
            >
              Get an API key from Anthropic
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleSave}
              disabled={saving || !apiKey.trim()}
              className="flex-1 bg-red-500 hover:bg-red-600"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Save API Key
            </Button>
          </div>

          <p className="text-xs text-zinc-400 text-center">
            Your key is encrypted and stored securely. We never see or store it in plain text.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
