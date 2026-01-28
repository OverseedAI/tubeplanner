import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { userContext } = await req.json();

  if (typeof userContext !== "string") {
    return new Response("Invalid userContext", { status: 400 });
  }

  await db
    .update(users)
    .set({ userContext })
    .where(eq(users.id, session.user.id));

  return Response.json({ success: true });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [user] = await db
    .select({ userContext: users.userContext })
    .from(users)
    .where(eq(users.id, session.user.id));

  return Response.json({ userContext: user?.userContext ?? "" });
}
