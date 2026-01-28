"use client";

import { useState } from "react";
import type { VideoPlan, OutlineItem } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefineDialog } from "@/components/refine-dialog";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface PlanViewerProps {
  plan: VideoPlan;
}

type SectionKey = "idea" | "targetAudience" | "hook" | "outline" | "thumbnailConcepts" | "titleOptions";

const sections: {
  key: SectionKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}[] = [
  { key: "idea", label: "Core Idea", icon: Lightbulb, description: "The video concept and value" },
  { key: "targetAudience", label: "Target Audience", icon: Users, description: "Who this is for" },
  { key: "hook", label: "Hook & Intro", icon: Zap, description: "First 30 seconds" },
  { key: "outline", label: "Content Outline", icon: List, description: "Structure and flow" },
  { key: "thumbnailConcepts", label: "Thumbnail Ideas", icon: Image, description: "Visual concepts" },
  { key: "titleOptions", label: "Title Options", icon: Type, description: "Title variations" },
];

export function PlanViewer({ plan: initialPlan }: PlanViewerProps) {
  const [plan, setPlan] = useState(initialPlan);
  const [editingSection, setEditingSection] = useState<SectionKey | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [refineSection, setRefineSection] = useState<SectionKey | null>(null);

  const startEditing = (key: SectionKey) => {
    const value = plan[key];
    if (Array.isArray(value)) {
      setEditValue(value.map((item) =>
        typeof item === "string" ? item : `${item.title}: ${item.content}`
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

  const handleRefineApply = async (newContent: string) => {
    if (!refineSection) return;

    // Parse the content based on section type
    let parsedValue: string | string[];
    if (refineSection === "titleOptions" || refineSection === "thumbnailConcepts") {
      // Split by newlines, filter empties, clean up numbering
      parsedValue = newContent
        .split("\n")
        .map((line) => line.replace(/^\d+\.\s*/, "").trim())
        .filter(Boolean);
    } else {
      parsedValue = newContent;
    }

    await saveSection(refineSection, parsedValue);
  };

  const getSectionContentAsString = (key: SectionKey): string => {
    const value = plan[key];
    if (!value) return "";
    if (Array.isArray(value)) {
      return value.map((item) =>
        typeof item === "string" ? item : `${item.title}: ${item.content}`
      ).join("\n");
    }
    return String(value);
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

  const currentRefineSection = sections.find((s) => s.key === refineSection);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-8 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-4 mb-4">
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
        </div>
      </div>

      {/* Sections */}
      <ScrollArea className="flex-1">
        <div className="p-8 max-w-4xl mx-auto">
          <div className="grid gap-6">
            {sections.map((section) => (
              <Card key={section.key}>
                <CardHeader className="pb-3">
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
                          onClick={() => startEditing(section.key)}
                        >
                          <Edit3 className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRefineSection(section.key)}
                        >
                          <Sparkles className="w-4 h-4 mr-1" />
                          Refine
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <Separator />
                <CardContent className="pt-4">
                  {renderSectionContent(section.key)}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* Refine Dialog */}
      <RefineDialog
        open={refineSection !== null}
        onOpenChange={(open) => !open && setRefineSection(null)}
        planId={plan.id}
        section={refineSection || ""}
        sectionLabel={currentRefineSection?.label || ""}
        currentContent={refineSection ? getSectionContentAsString(refineSection) : ""}
        onApply={handleRefineApply}
      />
    </div>
  );
}
