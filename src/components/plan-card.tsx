"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileVideo, Trash2, Loader2 } from "lucide-react";

interface PlanCardProps {
  plan: {
    id: string;
    title: string;
    idea: string | null;
    status: string;
    updatedAt: Date;
  };
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  intake: { label: "In Progress", variant: "secondary" },
  generating: { label: "Generating", variant: "secondary" },
  draft: { label: "Draft", variant: "outline" },
  refining: { label: "Refining", variant: "secondary" },
  complete: { label: "Complete", variant: "default" },
};

function formatDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function PlanCard({ plan }: PlanCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const status = statusLabels[plan.status] ?? statusLabels.draft;

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/plans/${plan.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete");

      setDialogOpen(false);
      router.refresh();
    } catch (error) {
      console.error("Delete error:", error);
      setIsDeleting(false);
    }
  };

  return (
    <Card className="hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors group">
      <CardHeader className="flex flex-row items-center gap-4">
        <Link href={`/plans/${plan.id}`} className="flex flex-row items-center gap-4 flex-1 min-w-0">
          <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center shrink-0">
            <FileVideo className="w-6 h-6 text-zinc-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg truncate">
                {plan.title}
              </CardTitle>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <CardDescription className="mt-1">
              {plan.idea
                ? plan.idea.slice(0, 120) + (plan.idea.length > 120 ? "..." : "")
                : "No description yet"}
            </CardDescription>
          </div>
        </Link>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm text-zinc-400">
            {formatDate(plan.updatedAt)}
          </span>

          <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDialogOpen(true);
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete video plan?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete &quot;{plan.title}&quot; and all its content. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-red-500 hover:bg-red-600"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
    </Card>
  );
}
