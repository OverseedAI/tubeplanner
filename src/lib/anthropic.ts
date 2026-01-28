import { createAnthropic } from "@ai-sdk/anthropic";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";

export class ApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiKeyError";
  }
}

export async function getUserAnthropicClient(userId: string) {
  const [user] = await db
    .select({ encryptedApiKey: users.encryptedApiKey })
    .from(users)
    .where(eq(users.id, userId));

  if (!user?.encryptedApiKey) {
    throw new ApiKeyError(
      "No API key configured. Please add your Anthropic API key in your profile settings."
    );
  }

  try {
    const apiKey = decrypt(user.encryptedApiKey);
    return createAnthropic({ apiKey });
  } catch (error) {
    console.error("Failed to decrypt API key:", error);
    throw new ApiKeyError("Failed to decrypt API key. Please re-enter your API key.");
  }
}
