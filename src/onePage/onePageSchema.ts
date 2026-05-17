import { z } from 'zod';
import { extractThinkBlocks } from '../summary/think';

export const OnePageSummarySchema = z.object({
  title: z.string().min(1).max(40),
  subtitle: z.string().max(60).optional(),
  conclusion: z.string().min(1).max(100),
  keyPoints: z
    .array(
      z.object({
        title: z.string().min(1).max(20),
        detail: z.string().min(1).max(120),
      }),
    )
    .min(3)
    .max(8),
  timeline: z
    .array(
      z.object({
        time: z.string().optional(),
        event: z.string().min(1).max(80),
      }),
    )
    .max(8)
    .optional(),
  takeaways: z.array(z.string().min(1).max(80)).min(1).max(6),
  tags: z.array(z.string().min(1).max(20)).min(1).max(8),
  source: z.object({
    title: z.string(),
    upName: z.string().optional(),
    url: z.string(),
  }),
});

export type OneImageSummaryData = z.infer<typeof OnePageSummarySchema>;
export type OnePageSummaryData = OneImageSummaryData;

export function parseOneImageJson(input: string): OneImageSummaryData {
  const withoutThink = extractThinkBlocks(input).content.trim();
  const raw = extractJson(withoutThink);
  try {
    return OnePageSummarySchema.parse(JSON.parse(raw));
  } catch (error) {
    throw new Error(`一图流 JSON 解析失败：${getErrorMessage(error)}；返回片段：${raw.slice(0, 240)}`);
  }
}

export const parseOnePageJson = parseOneImageJson;

function extractJson(input: string): string {
  const fenced = input.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const first = input.indexOf('{');
  const last = input.lastIndexOf('}');
  if (first >= 0 && last > first) return input.slice(first, last + 1);

  return input.trim();
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
