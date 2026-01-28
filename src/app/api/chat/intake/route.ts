import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { auth } from "@/auth";
import { db } from "@/db";
import { videoPlans } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getUserContext, buildCreatorContextPrompt } from "@/lib/user-context";

const SYSTEM_PROMPT = `You are a YouTube video planning assistant. Your job is to help creators plan compelling, well-structured videos that resonate with their audience.

You're conducting a quick intake conversation to understand the creator's video idea. Ask questions naturally and conversationally - don't feel robotic.

INTAKE FLOW (ask these one at a time, naturally):
1. Understand the core idea - What's the video about? What's the main point or value?
2. Target audience - Who is this for? What's their current situation/knowledge level?
3. Desired outcome - What should viewers feel, learn, or do after watching?
4. Unique angle - What makes YOUR take on this topic different/interesting?

GUIDELINES:
- Be warm and encouraging, but concise
- Ask ONE question at a time
- Build on their answers - show you're listening
- After gathering enough info (usually 3-4 exchanges), let them know you have what you need and will generate their plan
- When ready to generate, include exactly these markers at the END of your message: [PLAN_GENERATED][PLAN_ID:{id}]

Keep your responses SHORT - 2-3 sentences max. You're having a conversation, not writing an essay.`;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages, planId } = await req.json();

  // Fetch creator context for personalization
  const userContext = await getUserContext(session.user.id);
  const creatorContext = buildCreatorContextPrompt(userContext);

  let currentPlanId = planId;
  let plan;

  // Create or fetch the plan
  if (!currentPlanId) {
    // Create a new plan
    const [newPlan] = await db
      .insert(videoPlans)
      .values({
        userId: session.user.id,
        title: "Untitled Video",
        status: "intake",
        intakeMessages: [],
      })
      .returning();
    currentPlanId = newPlan.id;
    plan = newPlan;
  } else {
    // Fetch existing plan
    const [existingPlan] = await db
      .select()
      .from(videoPlans)
      .where(
        and(
          eq(videoPlans.id, currentPlanId),
          eq(videoPlans.userId, session.user.id)
        )
      );
    if (!existingPlan) {
      return new Response("Plan not found", { status: 404 });
    }
    plan = existingPlan;
  }

  // Check if we should generate the plan (after enough context)
  const userMessageCount = messages.filter(
    (m: { role: string }) => m.role === "user"
  ).length;
  const shouldGenerate = userMessageCount >= 3;

  // Build the full system prompt with creator context
  const basePrompt = creatorContext
    ? `${SYSTEM_PROMPT}\n${creatorContext}`
    : SYSTEM_PROMPT;

  // Update the system prompt to include generation instruction if ready
  const systemPrompt = shouldGenerate
    ? `${basePrompt}

IMPORTANT: You now have enough information. In your response:
1. Briefly acknowledge their final answer
2. Tell them you're generating their video plan
3. End your message with: [PLAN_GENERATED][PLAN_ID:${currentPlanId}]

This will trigger the plan generation and redirect them to view it.`
    : basePrompt;

  // Stream the response
  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: systemPrompt,
    messages,
    async onFinish({ text }) {
      // Save the conversation to the plan
      const updatedMessages = [
        ...messages,
        { role: "assistant", content: text, createdAt: new Date().toISOString() },
      ];

      // If plan was generated, also generate the actual plan content
      if (text.includes("[PLAN_GENERATED]")) {
        await generatePlanContent(currentPlanId, session.user!.id!, updatedMessages, userContext);
      }

      await db
        .update(videoPlans)
        .set({
          intakeMessages: updatedMessages,
          updatedAt: new Date(),
        })
        .where(eq(videoPlans.id, currentPlanId));
    },
  });

  // Return the stream with the plan ID header
  const response = result.toTextStreamResponse();
  response.headers.set("x-plan-id", currentPlanId);
  return response;
}

async function generatePlanContent(
  planId: string,
  userId: string,
  messages: { role: string; content: string }[],
  userContext: string | null
) {
  const conversationContext = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const creatorContextSection = userContext?.trim()
    ? `\nCREATOR CONTEXT:\n${userContext}\n\nUse this context to tailor the plan to match the creator's style and audience.`
    : "";

  const { text } = await import("ai").then((m) =>
    m.generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: `You are a YouTube video planning expert. Based on the intake conversation, generate a comprehensive video plan.
${creatorContextSection}
Output a JSON object with this exact structure:
{
  "title": "Working title for the video",
  "idea": "2-3 sentence summary of the video concept and its core value proposition",
  "targetAudience": "Description of the ideal viewer - their situation, needs, and what they'll gain",
  "hook": "The opening hook/intro (first 30 seconds). Include the pattern interrupt, the promise, and why viewers should keep watching",
  "outline": [
    {"id": "1", "title": "Section name", "content": "What to cover in this section", "duration": "estimated time"},
    ...
  ],
  "thumbnailConcepts": ["Concept 1 description", "Concept 2 description", "Concept 3 description"],
  "titleOptions": ["Title option 1", "Title option 2", "Title option 3"]
}

Make the plan actionable and specific. The hook should be compelling. The outline should have 4-7 sections with clear content for each. Thumbnail concepts should be visual and attention-grabbing. Titles should balance SEO with clickability.`,
      prompt: `Based on this intake conversation, generate a video plan:\n\n${conversationContext}`,
    })
  );

  try {
    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");

    const plan = JSON.parse(jsonMatch[0]);

    await db
      .update(videoPlans)
      .set({
        title: plan.title,
        idea: plan.idea,
        targetAudience: plan.targetAudience,
        hook: plan.hook,
        outline: plan.outline,
        thumbnailConcepts: plan.thumbnailConcepts,
        titleOptions: plan.titleOptions,
        status: "draft",
        updatedAt: new Date(),
      })
      .where(and(eq(videoPlans.id, planId), eq(videoPlans.userId, userId)));
  } catch (e) {
    console.error("Failed to parse plan:", e);
    // Mark as draft anyway so user can see something
    await db
      .update(videoPlans)
      .set({ status: "draft", updatedAt: new Date() })
      .where(and(eq(videoPlans.id, planId), eq(videoPlans.userId, userId)));
  }
}
