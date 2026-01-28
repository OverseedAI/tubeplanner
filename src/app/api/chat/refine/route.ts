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

  const { planId, contextSections = [], messages } = await req.json();

  if (!planId || !messages) {
    return new Response("Missing required fields", { status: 400 });
  }

  // If no sections specified, include all sections
  const allSections = ["idea", "targetAudience", "hook", "outline", "thumbnailConcepts", "titleOptions"];
  const sectionsToInclude = contextSections.length > 0 ? contextSections : allSections;

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

  // Build context for sections
  const sectionsContext = sectionsToInclude.map((section: string) => {
    const label = SECTION_LABELS[section] || section;
    const content = plan[section as keyof typeof plan];
    const contentStr = Array.isArray(content)
      ? JSON.stringify(content, null, 2)
      : content || "Empty";
    return `## ${label}\n${contentStr}`;
  }).join("\n\n");

  const hasSpecificSections = contextSections.length > 0;
  const sectionDescriptions = hasSpecificSections
    ? contextSections.map((s: string) => SECTION_PROMPTS[s] || s).join(", ")
    : "the entire video plan";

  const systemPrompt = `You are a YouTube video planning assistant helping with: ${sectionDescriptions}.

${creatorContext}

CURRENT VIDEO PLAN:
- Title: ${plan.title}

PLAN SECTIONS:
${sectionsContext}

GUIDELINES:
- Be concise and actionable
- Build on the existing content, don't start from scratch
- Consider how sections relate to each other and the overall video plan
- If asked to rewrite or change something, output the COMPLETE new version (not just the changes)
- Keep responses focused and practical
- When you provide updated content, format it clearly so the user can easily apply it
${!hasSpecificSections ? "- If the user's request relates to specific sections, identify which sections would be affected and provide updates for those" : ""}`;

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
