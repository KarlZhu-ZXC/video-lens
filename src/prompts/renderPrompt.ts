import type { PromptVariables } from './promptTypes';

export function renderPrompt(template: string, variables: PromptVariables): string {
  const normalized: PromptVariables = {
    ...variables,
    upName: variables.upName ?? variables.creatorName,
    creatorName: variables.creatorName ?? variables.upName,
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = normalized[key as keyof PromptVariables];
    return value == null ? '' : String(value);
  });
}
