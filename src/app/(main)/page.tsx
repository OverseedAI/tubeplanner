import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/db";
import { videoPlans } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { PlanCard } from "@/components/plan-card";
import { Plus, Sparkles } from "lucide-react";

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
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
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
