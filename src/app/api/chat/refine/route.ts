import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { auth } from "@/auth";
import { db } from "@/db";
import { videoPlans } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const SECTION_PROMPTS: Record<string, string> = {
  idea: "You're helping refine the core video idea and value proposition.",
  targetAudience: "You're helping define and refine the target audience description.",
  hook: "You're helping craft a compelling hook/intro for the first 30 seconds.",
  outline: "You're helping structure and refine the content outline.",
  thumbnailConcepts: "You're helping brainstorm thumbnail visual concepts.",
  titleOptions: "You're helping craft click-worthy, SEO-friendly title options.",
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { planId, section, messages } = await req.json();

  if (!planId || !section || !messages) {
    return new Response("Missing required fields", { status: 400 });
  }

  // Fetch the plan
  const [plan] = await db
    .select()
    .from(videoPlans)
    .where(
      and(eq(videoPlans.id, planId), eq(videoPlans.userId, session.user.id))
    );

  if (!plan) {
    return new Response("Plan not found", { status: 404 });
  }

  // Build context from current plan state
  const planContext = `
CURRENT VIDEO PLAN STATE:
- Title: ${plan.title}
- Core Idea: ${plan.idea || "Not set"}
- Target Audience: ${plan.targetAudience || "Not set"}
- Hook: ${plan.hook || "Not set"}
- Outline: ${plan.outline ? JSON.stringify(plan.outline, null, 2) : "Not set"}
- Thumbnail Concepts: ${plan.thumbnailConcepts?.join(", ") || "Not set"}
- Title Options: ${plan.titleOptions?.join(", ") || "Not set"}

CURRENT ${section.toUpperCase()} CONTENT:
${plan[section as keyof typeof plan] || "Empty"}
`.trim();

  const sectionContext = SECTION_PROMPTS[section] || "You're helping refine this section.";

  const systemPrompt = `You are a YouTube video planning assistant. ${sectionContext}

${planContext}

GUIDELINES:
- Be concise and actionable
- Build on the existing content, don't start from scratch
- Consider how this section relates to the overall video plan
- If they ask you to rewrite or change something, output the COMPLETE new version (not just the changes)
- Keep responses focused and practical

When you provide updated content, format it clearly so the user can easily copy it.`;

  // Stream the response
  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: systemPrompt,
    messages,
    async onFinish({ text }) {
      // Save the conversation to the plan's section conversations
      const updatedConversations = {
        ...(plan.sectionConversations || {}),
        [section]: [
          ...messages,
          { role: "assistant", content: text, createdAt: new Date().toISOString() },
        ],
      };

      await db
        .update(videoPlans)
        .set({
          sectionConversations: updatedConversations,
          updatedAt: new Date(),
        })
        .where(eq(videoPlans.id, planId));
    },
  });

  return result.toTextStreamResponse();
}
