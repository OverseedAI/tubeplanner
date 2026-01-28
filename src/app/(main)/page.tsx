import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/db";
import { videoPlans } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, FileVideo, Sparkles } from "lucide-react";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  intake: { label: "In Progress", variant: "secondary" },
  generating: { label: "Generating", variant: "secondary" },
  draft: { label: "Draft", variant: "outline" },
  refining: { label: "Refining", variant: "secondary" },
  complete: { label: "Complete", variant: "default" },
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const plans = await db
    .select()
    .from(videoPlans)
    .where(eq(videoPlans.userId, session.user.id))
    .orderBy(desc(videoPlans.updatedAt));

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Video Plans
          </h1>
          <p className="text-zinc-500 mt-1">
            Plan and refine your YouTube content with AI
          </p>
        </div>
        <Link href="/plans/new">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            New Plan
          </Button>
        </Link>
      </div>

      {/* Plans grid */}
      {plans.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4">
          {plans.map((plan) => {
            const status = statusLabels[plan.status] ?? statusLabels.draft;
            return (
              <Link key={plan.id} href={`/plans/${plan.id}`}>
                <Card className="hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer">
                  <CardHeader className="flex flex-row items-center gap-4">
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
                    <div className="text-sm text-zinc-400 shrink-0">
                      {formatDate(plan.updatedAt)}
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mb-6">
        <Sparkles className="w-10 h-10 text-zinc-400" />
      </div>
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
        No video plans yet
      </h2>
      <p className="text-zinc-500 mb-6 max-w-md">
        Start planning your first video. Our AI will guide you through creating
        compelling content for your audience.
      </p>
      <Link href="/plans/new">
        <Button size="lg" className="gap-2">
          <Plus className="w-5 h-5" />
          Create Your First Plan
        </Button>
      </Link>
    </div>
  );
}

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
