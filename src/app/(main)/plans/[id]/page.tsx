import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { videoPlans, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { PlanViewer } from "@/components/plan-viewer";

interface PlanPageProps {
  params: Promise<{ id: string }>;
}

export default async function PlanPage({ params }: PlanPageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return notFound();

  const [plan] = await db
    .select()
    .from(videoPlans)
    .where(
      and(eq(videoPlans.id, id), eq(videoPlans.userId, session.user.id))
    );

  if (!plan) return notFound();

  // Check if user has API key
  const [user] = await db
    .select({ encryptedApiKey: users.encryptedApiKey })
    .from(users)
    .where(eq(users.id, session.user.id));

  const hasApiKey = !!user?.encryptedApiKey;

  return <PlanViewer plan={plan} initialHasApiKey={hasApiKey} />;
}
