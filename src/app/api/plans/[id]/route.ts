import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { videoPlans } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  const [plan] = await db
    .select()
    .from(videoPlans)
    .where(
      and(eq(videoPlans.id, id), eq(videoPlans.userId, session.user.id))
    );

  if (!plan) {
    return new Response("Not found", { status: 404 });
  }

  return Response.json(plan);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  // Only allow updating specific fields
  const allowedFields = [
    "title",
    "idea",
    "targetAudience",
    "hook",
    "outline",
    "thumbnailConcepts",
    "titleOptions",
    "status",
  ];

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  const [plan] = await db
    .update(videoPlans)
    .set(updates)
    .where(
      and(eq(videoPlans.id, id), eq(videoPlans.userId, session.user.id))
    )
    .returning();

  if (!plan) {
    return new Response("Not found", { status: 404 });
  }

  return Response.json(plan);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  await db
    .delete(videoPlans)
    .where(
      and(eq(videoPlans.id, id), eq(videoPlans.userId, session.user.id))
    );

  return new Response(null, { status: 204 });
}
