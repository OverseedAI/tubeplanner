import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getUserContext(userId: string): Promise<string | null> {
  const [user] = await db
    .select({ userContext: users.userContext })
    .from(users)
    .where(eq(users.id, userId));

  return user?.userContext ?? null;
}

export function buildCreatorContextPrompt(userContext: string | null): string {
  if (!userContext?.trim()) return "";

  return `
CREATOR CONTEXT:
The following is information about this creator that should inform your suggestions:
${userContext}

Use this context to tailor hooks, titles, thumbnails, and content structure to match their style and audience.
`;
}
