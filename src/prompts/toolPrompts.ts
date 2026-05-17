export const IMAGE_PROMPT_MAX_CHARS = 1200;
export const IMAGE_PROMPT_SYSTEM_PROMPT =
  'You write final image-generation prompts only. Do not explain, analyze, mention the user, or include markdown. Return one polished English prompt.';

export function writeOnePageJsonTool() {
  return {
    type: 'function' as const,
    function: {
      name: 'write_one_page_json',
      description: 'Write the final one-page summary as strict JSON only. The arguments must match the schema exactly.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'conclusion', 'keyPoints', 'takeaways', 'tags', 'source'],
        properties: {
          title: { type: 'string', maxLength: 40 },
          subtitle: { type: 'string', maxLength: 60 },
          conclusion: { type: 'string', maxLength: 100 },
          keyPoints: {
            type: 'array',
            minItems: 3,
            maxItems: 8,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'detail'],
              properties: {
                title: { type: 'string', maxLength: 20 },
                detail: { type: 'string', maxLength: 120 },
              },
            },
          },
          timeline: {
            type: 'array',
            maxItems: 8,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['event'],
              properties: {
                time: { type: 'string' },
                event: { type: 'string', maxLength: 80 },
              },
            },
          },
          takeaways: { type: 'array', minItems: 1, maxItems: 6, items: { type: 'string', maxLength: 80 } },
          tags: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'string', maxLength: 20 } },
          source: {
            type: 'object',
            additionalProperties: false,
            required: ['title', 'url'],
            properties: {
              title: { type: 'string' },
              upName: { type: 'string' },
              url: { type: 'string' },
            },
          },
        },
      },
    },
  };
}

export function writeImagePromptTool() {
  return {
    type: 'function' as const,
    function: {
      name: 'write_image_prompt',
      description:
        'Write the final English image-generation prompt only. The prompt must describe a visual background and must forbid text, logos, and watermarks.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['prompt'],
        properties: {
          prompt: {
            type: 'string',
            minLength: 80,
            maxLength: IMAGE_PROMPT_MAX_CHARS,
            description: 'A polished English prompt for an image model. No analysis or markdown.',
          },
        },
      },
    },
  };
}
