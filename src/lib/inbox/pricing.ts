// What a message costs to process, and what to charge for it.

// claude-haiku-5-5: $0.10 per million input tokens, $0.50 per million output
// tokens (prompts up to 100K). One dollar per million tokens is exactly one
// micro-dollar per token, so these are also the per-token prices in micros.
const INPUT_MICROS_PER_TOKEN = 0.1;
const OUTPUT_MICROS_PER_TOKEN = 0.5;

export type Usage = { inputTokens: number; outputTokens: number };

// Cost in micro-dollars (1,000,000 = $1).
export function costMicros(usage: Usage): number {
  return Math.round(usage.inputTokens * INPUT_MICROS_PER_TOKEN + usage.outputTokens * OUTPUT_MICROS_PER_TOKEN);
}

// The price that leaves a given gross margin: margin = (price - cost) / price.
export function priceForMargin(costMicros: number, margin: number): number {
  if (!(margin >= 0 && margin < 1)) throw new Error("Margin must be at least 0 and below 1.");
  return Math.round(costMicros / (1 - margin));
}

export function marginAt(priceMicros: number, costMicros: number): number {
  return priceMicros > 0 ? (priceMicros - costMicros) / priceMicros : 0;
}

export const microsToDollars = (micros: number) => micros / 1_000_000;
