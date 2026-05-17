import type { PromptVariables } from './promptTypes';

export function renderPrompt(template: string, variables: PromptVariables): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = variables[key as keyof PromptVariables];
    return value == null ? '' : String(value);
  });
}
