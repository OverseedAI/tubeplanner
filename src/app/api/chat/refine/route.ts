import { streamText } from "ai";
import { auth } from "@/auth";
import { db } from "@/db";
import { videoPlans } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getUserContext, buildCreatorContextPrompt } from "@/lib/user-context";
import { getUserAnthropicClient, ApiKeyError } from "@/lib/anthropic";

const SECTION_LABELS: Record<string, string> = {
  idea: "Core Idea",
  targetAudience: "Target Audience",
  hook: "Hook & Intro",
  outline: "Content Outline",
  thumbnailConcepts: "Thumbnail Ideas",
  titleOptions: "Title Options",
};

const SECTION_PROMPTS: Record<string, string> = {
  idea: "the core video idea and value proposition",
  targetAudience: "the target audience description",
  hook: "the compelling hook/intro for the first 30 seconds",
  outline: "the content structure and outline",
  thumbnailConcepts: "thumbnail visual concepts",
  titleOptions: "click-worthy, SEO-friendly title options",
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { planId, contextSections, messages } = await req.json();

  if (!planId || !contextSections || !Array.isArray(contextSections) || contextSections.length === 0 || !messages) {
    return new Response("Missing required fields", { status: 400 });
  }

  // Get user's Anthropic client
  let anthropic;
  try {
    anthropic = await getUserAnthropicClient(session.user.id);
  } catch (error) {
    if (error instanceof ApiKeyError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw error;
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

  // Fetch creator context for personalization
  const userContext = await getUserContext(session.user.id);
  const creatorContext = buildCreatorContextPrompt(userContext);

  // Build context for selected sections
  const sectionsContext = contextSections.map((section: string) => {
    const label = SECTION_LABELS[section] || section;
    const content = plan[section as keyof typeof plan];
    const contentStr = Array.isArray(content)
      ? JSON.stringify(content, null, 2)
      : content || "Empty";
    return `## ${label}\n${contentStr}`;
  }).join("\n\n");

  const sectionDescriptions = contextSections.map(
    (s: string) => SECTION_PROMPTS[s] || s
  ).join(", ");

  const systemPrompt = `You are a YouTube video planning assistant. You're helping refine: ${sectionDescriptions}.

${creatorContext}

CURRENT VIDEO PLAN:
- Title: ${plan.title}

SECTIONS IN CONTEXT:
${sectionsContext}

GUIDELINES:
- Be concise and actionable
- Build on the existing content, don't start from scratch
- Consider how sections relate to each other and the overall video plan
- If asked to rewrite or change something, output the COMPLETE new version (not just the changes)
- Keep responses focused and practical
- When you provide updated content, format it clearly so the user can easily apply it`;

  // Stream the response
  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: systemPrompt,
    messages,
    async onFinish({ text }) {
      // Save to single conversation (keyed as "main")
      const updatedConversations = {
        ...(plan.sectionConversations || {}),
        main: [
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
