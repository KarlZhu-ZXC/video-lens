export interface ThinkExtraction {
  content: string;
  reasoning: string;
  inThink: boolean;
}

export function extractThinkBlocks(text: string, initialInThink = false): ThinkExtraction {
  let rest = text;
  let content = '';
  let reasoning = '';
  let inThink = initialInThink;

  while (rest) {
    if (inThink) {
      const end = rest.search(/<\/think>/i);
      if (end === -1) {
        reasoning += rest;
        rest = '';
      } else {
        reasoning += rest.slice(0, end);
        rest = rest.slice(end).replace(/^<\/think>/i, '');
        inThink = false;
      }
      continue;
    }

    const start = rest.search(/<think>/i);
    if (start === -1) {
      content += rest;
      rest = '';
    } else {
      content += rest.slice(0, start);
      rest = rest.slice(start).replace(/^<think>/i, '');
      inThink = true;
    }
  }

  return { content, reasoning, inThink };
}
