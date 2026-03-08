import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROGRAM = `You are an autonomous self-improvement agent for Storyworld, a literary reading application.

## Your Mission
Continuously improve the literary content and AI behavior of Storyworld. You operate on these domains:
- annotations: Literary annotations on sentences
- characters: Character descriptions and psychological depth
- themes: Theme identification and articulation
- prompts: The AI chat system prompt for literary conversation
- content: New sentences or scenes expanding the library

## Current Book Data
You will receive the current state of the book content. Propose ONE specific improvement.

## Scoring
Score your improvement on 4 axes (1-10 each):
- insight: Does this reveal something non-obvious?
- merit: Is the language precise and evocative?
- coherence: Does it fit the existing content?
- originality: Does it avoid generic AI platitudes?

## Quality Anti-Patterns (NEVER)
- Generic praise: "Fitzgerald's masterful prose..."
- Stating the obvious
- Academic jargon without insight
- Purple prose in annotations

## Quality Patterns (ALWAYS)
- Specific textual evidence tied to interpretation
- Connections between micro (sentence) and macro (novel) levels
- Paradoxes and tensions within the text
- How form mirrors content

## Response Format
You MUST respond with a JSON object using this exact tool call.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain, bookData, experimentHistory } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build context for the agent
    const historyContext = experimentHistory?.length
      ? `\n## Recent Experiments\n${experimentHistory.map((e: any) => `- [${e.status}] ${e.domain}: ${e.description} (score: ${e.composite_score})`).join("\n")}`
      : "";

    const userPrompt = `Here is the current book data for Storyworld:

\`\`\`json
${JSON.stringify(bookData, null, 2)}
\`\`\`

${historyContext}

Domain to improve: ${domain || "auto-select the most impactful domain"}

Propose ONE specific improvement. Be concrete — provide exact before/after text.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: PROGRAM },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_experiment",
              description: "Submit an experiment result with before/after content and quality scores",
              parameters: {
                type: "object",
                properties: {
                  domain: {
                    type: "string",
                    enum: ["annotations", "characters", "themes", "prompts", "content"],
                  },
                  target_id: {
                    type: "string",
                    description: "ID of the specific item being improved (e.g. sentence id, character id)",
                  },
                  description: {
                    type: "string",
                    description: "Short description of what this experiment tried",
                  },
                  before_value: {
                    type: "string",
                    description: "The original text/content before modification",
                  },
                  after_value: {
                    type: "string",
                    description: "The improved text/content after modification",
                  },
                  score_insight: { type: "integer", minimum: 1, maximum: 10 },
                  score_merit: { type: "integer", minimum: 1, maximum: 10 },
                  score_coherence: { type: "integer", minimum: 1, maximum: 10 },
                  score_originality: { type: "integer", minimum: 1, maximum: 10 },
                },
                required: [
                  "domain", "target_id", "description",
                  "before_value", "after_value",
                  "score_insight", "score_merit", "score_coherence", "score_originality",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_experiment" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`AI gateway returned ${response.status}`);
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("No tool call in AI response");
    }

    let experiment: any;
    try {
      experiment = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } catch {
      throw new Error("Failed to parse experiment from AI response");
    }

    // Compute composite score
    const composite =
      (experiment.score_insight + experiment.score_merit + experiment.score_coherence + experiment.score_originality) / 4;

    // Determine status based on score
    let status: string;
    if (composite >= 7.0) status = "keep";
    else if (composite >= 5.0) status = "discard";
    else status = "crash";

    // Store in database
    const { data: inserted, error: dbError } = await supabase
      .from("experiments")
      .insert({
        domain: experiment.domain,
        target_id: experiment.target_id,
        description: experiment.description,
        before_value: experiment.before_value,
        after_value: experiment.after_value,
        score_insight: experiment.score_insight,
        score_merit: experiment.score_merit,
        score_coherence: experiment.score_coherence,
        score_originality: experiment.score_originality,
        composite_score: composite,
        status,
        applied: false,
      })
      .select()
      .single();

    if (dbError) {
      console.error("DB insert error:", dbError);
      throw new Error("Failed to store experiment");
    }

    return new Response(JSON.stringify(inserted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("autoresearch error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
