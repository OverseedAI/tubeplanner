import { NextRequest } from "next/server";
import { generateText } from "ai";
import { auth } from "@/auth";
import { db } from "@/db";
import { videoPlans } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getUserContext, buildCreatorContextPrompt } from "@/lib/user-context";
import { getUserAnthropicClient, ApiKeyError } from "@/lib/anthropic";

const SECTION_PROMPTS: Record<string, string> = {
  idea: `Generate a 2-3 sentence summary of the video concept and its core value proposition.
Output just the text, no JSON or formatting.`,

  targetAudience: `Generate a description of the ideal viewer - their situation, needs, and what they'll gain from this video.
Output just the text, no JSON or formatting.`,

  hooks: `Generate 4 distinct hook variations for the first 30 seconds of this video.
Output a JSON array with this exact structure:
[
  {"style": "story", "content": "A personal anecdote hook...", "selected": true},
  {"style": "curiosity", "content": "An open loop hook..."},
  {"style": "bold", "content": "A contrarian/bold claim hook..."},
  {"style": "question", "content": "A direct question hook..."}
]
Each hook should be compelling, specific to this video topic, and ready to use as a script.`,

  outline: `Generate a content outline with 4-7 sections.
Output a JSON array with this exact structure:
[
  {"id": "1", "title": "Section name", "content": "What to cover", "duration": "estimated time"},
  ...
]`,

  thumbnailConcepts: `Generate 3 thumbnail visual concepts that would grab attention.
Output a JSON array of strings:
["Concept 1 description", "Concept 2 description", "Concept 3 description"]`,

  titleOptions: `Generate 3 title options that balance SEO with clickability.
Output a JSON array of strings:
["Title option 1", "Title option 2", "Title option 3"]`,
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: planId } = await params;
  const { section } = await req.json();

  if (!section || !SECTION_PROMPTS[section]) {
    return new Response("Invalid section", { status: 400 });
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

  // Fetch creator context
  const userContext = await getUserContext(session.user.id);
  const creatorContext = buildCreatorContextPrompt(userContext);

  // Build context from intake conversation
  const intakeContext = (plan.intakeMessages || [])
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  // Build context from existing plan sections
  const planContext = `
Title: ${plan.title}
Idea: ${plan.idea || "Not yet generated"}
Target Audience: ${plan.targetAudience || "Not yet generated"}
Outline: ${plan.outline ? JSON.stringify(plan.outline) : "Not yet generated"}
`.trim();

  const systemPrompt = `You are a YouTube video planning expert.
${creatorContext ? `\n${creatorContext}\n` : ""}
Based on the intake conversation and existing plan context, regenerate the requested section.

INTAKE CONVERSATION:
${intakeContext}

EXISTING PLAN:
${planContext}

${SECTION_PROMPTS[section]}`;

  try {
    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: systemPrompt,
      prompt: `Regenerate the ${section} section for this video plan.`,
    });

    // Parse the result based on section type
    let parsedValue: unknown;

    if (section === "hooks" || section === "outline" || section === "thumbnailConcepts" || section === "titleOptions") {
      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        parsedValue = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse JSON response");
      }
    } else {
      // Plain text sections
      parsedValue = text.trim();
    }

    // Update the plan
    await db
      .update(videoPlans)
      .set({
        [section]: parsedValue,
        updatedAt: new Date(),
      })
      .where(and(eq(videoPlans.id, planId), eq(videoPlans.userId, session.user.id)));

    return Response.json({ [section]: parsedValue });
  } catch (error) {
    console.error("Failed to regenerate section:", error);
    return new Response("Failed to regenerate section", { status: 500 });
  }
}
