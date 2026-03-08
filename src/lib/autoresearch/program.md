# Storyworld AutoResearch

This is an autonomous self-improvement system for Storyworld, a literary reading application.
Inspired by [karpathy/autoresearch](https://github.com/karpathy/autoresearch).

## Concept

In autoresearch, an AI agent iteratively modifies training code, measures val_bpb, and keeps or discards changes. In Storyworld, the "training code" is the **literary content and AI behavior** — annotations, character analyses, system prompts, theme mappings, and reading experience parameters. The metric is a **quality score** judged by an LLM evaluator.

## What the Agent Improves

The agent operates on these **experiment domains**:

1. **annotations** — Literary annotations on sentences. Quality = depth of insight, literary merit, connection to broader themes.
2. **characters** — Character descriptions and analysis. Quality = psychological depth, textual grounding, narrative relevance.
3. **themes** — Theme identification and articulation. Quality = specificity, interconnection, originality of interpretation.
4. **prompts** — The AI chat system prompt that guides literary conversation. Quality = response helpfulness, analytical depth, contextual awareness.
5. **content** — New sentences, scenes, or chapters expanding the library. Quality = faithfulness to source, annotation richness, narrative coherence.
6. **ux_copy** — UI microcopy, onboarding text, and feature descriptions. Quality = clarity, tone consistency, user guidance.

## The Experiment Loop

Each experiment follows this protocol:

1. **Select domain**: Pick an experiment domain based on what has the most room for improvement.
2. **Read current state**: Examine the current content/configuration for the chosen domain.
3. **Propose improvement**: Generate a specific, concrete modification.
4. **Self-evaluate**: Score the improvement on a 1-10 scale across these axes:
   - **Insight depth** (1-10): Does this reveal something non-obvious?
   - **Literary merit** (1-10): Is the language precise and evocative?
   - **Coherence** (1-10): Does it fit the existing content ecosystem?
   - **Originality** (1-10): Does it avoid generic AI platitudes?
5. **Compute composite score**: Average of the four axes.
6. **Keep or discard**:
   - Score ≥ 7.0 → **keep** (apply the improvement)
   - Score 5.0–6.9 → **discard** (not good enough)
   - Score < 5.0 → **crash** (fundamentally misguided)

## Simplicity Criterion

All else being equal, simpler is better. A marginal improvement that adds verbosity or complexity is not worth it. Removing unnecessary words while maintaining meaning is always a win. The best annotations are those that illuminate with economy.

## Quality Anti-Patterns (NEVER do these)

- Generic praise: "Fitzgerald's masterful prose..."
- Stating the obvious: "This shows that Nick is observant"
- Academic jargon without insight: "The diegetic narrator employs..."
- Purple prose in annotations: "The shimmering tapestry of meaning..."
- Disconnected observations that don't link to the larger work

## Quality Patterns (ALWAYS aim for these)

- Specific textual evidence tied to interpretation
- Connections between micro (sentence) and macro (novel) levels
- Paradoxes and tensions within the text
- What the author chose NOT to do and why
- How form mirrors content

## Output Format

Each experiment produces a result:

```json
{
  "domain": "annotations",
  "target_id": "g1-7",
  "description": "Rewrote annotation for 'Reserving judgments...' to connect hope/judgment paradox to Gatsby's character",
  "before": "Perhaps the novel's thesis in six words...",
  "after": "Six words that contain the novel's DNA. To reserve judgment is to keep hope alive — and Gatsby is hope incarnate. But hope without judgment is also blindness.",
  "scores": { "insight": 8, "merit": 7, "coherence": 9, "originality": 7 },
  "composite_score": 7.75,
  "status": "keep"
}
```

## NEVER STOP

Once the experiment loop has begun, continue proposing improvements until manually stopped. If you run out of ideas in one domain, switch to another. If all domains feel saturated, look for cross-domain connections: can a character insight improve an annotation? Can a theme reframing improve the chat prompt?

## Meta-Improvement

The agent should also periodically evaluate and improve THIS PROGRAM itself. If a scoring criterion is too lenient or too strict, adjust it. If a quality pattern is missing, add it. The program.md is a living document — the research org's "culture" that evolves alongside the content it governs.
