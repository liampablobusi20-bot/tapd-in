import type Anthropic from "@anthropic-ai/sdk";
import { MAX_PROPOSALS, type Proposal } from "@/lib/assistant/proposals";

export type ToolOutcome = {
  content: string;
  isError?: boolean;
  proposal?: Proposal;
};

type ChatMessage = { role: "user" | "assistant"; content: string };

const MAX_ROUNDS = 6;

export async function runAssistant({
  client,
  model,
  system,
  messages,
  tools,
  executeTool,
}: {
  client: Pick<Anthropic, "beta">;
  model: string;
  system: string;
  messages: ChatMessage[];
  tools: Anthropic.Beta.BetaTool[];
  executeTool: (name: string, input: unknown) => Promise<ToolOutcome>;
}): Promise<{ text: string; proposals: Proposal[] }> {
  const convo: Anthropic.Beta.BetaMessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const proposals: Proposal[] = [];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 8192,
      system,
      tools,
      messages: convo,
      output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    if (response.stop_reason === "refusal") {
      return { text: "I can't help with that request.", proposals };
    }

    const toolUses = response.content.filter(
      (block): block is Anthropic.Beta.BetaToolUseBlock => block.type === "tool_use"
    );

    if (toolUses.length === 0) {
      const text = response.content
        .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();
      return {
        text:
          text ||
          (proposals.length ? "I've put together some changes for you to review." : "Sorry, I didn't catch that."),
        proposals,
      };
    }

    convo.push({
      role: "assistant",
      content: response.content as Anthropic.Beta.BetaContentBlockParam[],
    });

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      const outcome = await executeTool(toolUse.name, toolUse.input);
      if (outcome.proposal) {
        if (proposals.length >= MAX_PROPOSALS) {
          results.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: `Too many changes in one request (max ${MAX_PROPOSALS}). Ask the user to split it up.`,
            is_error: true,
          });
          continue;
        }
        proposals.push(outcome.proposal);
      }
      results.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: outcome.content,
        ...(outcome.isError ? { is_error: true } : {}),
      });
    }
    convo.push({ role: "user", content: results });
  }

  return {
    text: "That took too many steps — try asking for a smaller change.",
    proposals,
  };
}
