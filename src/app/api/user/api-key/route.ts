import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encrypt } from "@/lib/crypto";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { apiKey } = await req.json();

  if (!apiKey || typeof apiKey !== "string") {
    return Response.json({ error: "API key is required" }, { status: 400 });
  }

  // Basic validation - Anthropic keys start with sk-ant-
  if (!apiKey.startsWith("sk-ant-")) {
    return Response.json(
      { error: "Invalid API key format. Anthropic keys start with sk-ant-" },
      { status: 400 }
    );
  }

  try {
    const encryptedKey = encrypt(apiKey);

    await db
      .update(users)
      .set({ encryptedApiKey: encryptedKey })
      .where(eq(users.id, session.user.id));

    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to save API key:", error);
    return Response.json({ error: "Failed to save API key" }, { status: 500 });
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({ encryptedApiKey: users.encryptedApiKey })
    .from(users)
    .where(eq(users.id, session.user.id));

  return Response.json({ hasKey: !!user?.encryptedApiKey });
}
