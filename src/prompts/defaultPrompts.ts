import type { PromptPreset } from './promptTypes';

export const BUILT_IN_PROMPTS: PromptPreset[] = [
  {
    id: 'summary_plain',
    name: '极简白话版',
    type: 'summary',
    icon: '省',
    builtIn: true,
    template: `你是一个极其擅长省流总结的中文助手。

我没有耐心，不想动脑子，阅读困难。请用最直白的大白话解释这个视频到底在说什么。在能解释清楚的前提下，废话越少越好。

禁止寒暄、铺垫、自我介绍，不要说“根据字幕”，不要堆专业术语。

视频标题：{{title}}
UP 主：{{upName}}
视频简介：{{description}}
原链接：{{url}}

字幕内容：
{{transcript}}

请严格按以下结构输出：

# 结论
直接告诉我核心意思。

# 具体讲了啥
用极简白话说明来龙去脉。

# 关键点
列出最重要的几个要点。

# 对我有什么用
直接说明价值。如果是广告、水视频、标题党，请直接告诉我避雷。

# 原链接
{{url}}`,
    enTemplate: `You are an assistant that summarizes videos in clear, concise English.

Explain what this video is saying in plain language. Be direct. Do not say "according to the subtitles" and do not add information that is not supported by the transcript.

Video title: {{title}}
Creator: {{upName}}
Description: {{description}}
Original URL: {{url}}

Transcript:
{{transcript}}

Output strictly in this structure:

# Conclusion
Tell me the core point directly.

# What It Covered
Explain the main flow in simple English.

# Key Points
List the most important points.

# Why It Matters
Explain the practical value. If the video is clickbait, shallow, or mostly an ad, say so directly.

# Original URL
{{url}}`,
  },
  {
    id: 'summary_detailed',
    name: '详细笔记版',
    type: 'summary',
    icon: '记',
    builtIn: true,
    template: `请基于视频字幕内容，生成一份结构清晰的中文学习笔记。

视频标题：{{title}}
UP 主：{{upName}}
视频简介：{{description}}
原链接：{{url}}

字幕内容：
{{transcript}}

请使用 Markdown 输出，并包含：主题概述、内容大纲、关键概念、关键细节、金句摘录、个人启发、原链接。`,
    enTemplate: `Create a clearly structured English study note based on the video transcript.

Video title: {{title}}
Creator: {{upName}}
Description: {{description}}
Original URL: {{url}}

Transcript:
{{transcript}}

Use Markdown and include: Topic Overview, Outline, Key Concepts, Important Details, Notable Quotes, Personal Takeaways, and Original URL.`,
  },
  {
    id: 'summary_critical',
    name: '批判分析版',
    type: 'summary',
    icon: '析',
    builtIn: true,
    template: `请以批判性思维审视这个视频。

视频标题：{{title}}
UP 主：{{upName}}
视频简介：{{description}}
原链接：{{url}}

字幕内容：
{{transcript}}

请直接输出：核心观点、论据评估、逻辑漏洞、对立观点、内容质量判断、我应该怎么处理、原链接。`,
    enTemplate: `Review this video with critical thinking.

Video title: {{title}}
Creator: {{upName}}
Description: {{description}}
Original URL: {{url}}

Transcript:
{{transcript}}

Output directly in English: Core Claims, Evidence Assessment, Logical Gaps, Opposing Views, Content Quality Judgment, What I Should Do With It, and Original URL.`,
  },
  {
    id: 'summary_action',
    name: '行动清单版',
    type: 'summary',
    icon: '行',
    builtIn: true,
    template: `请把视频内容整理成一份可执行行动清单。

视频标题：{{title}}
UP 主：{{upName}}
视频简介：{{description}}
原链接：{{url}}

字幕内容：
{{transcript}}

输出：一句话结论、可执行步骤、注意事项、适合谁、不适合谁、原链接。`,
    enTemplate: `Turn the video content into an actionable checklist.

Video title: {{title}}
Creator: {{upName}}
Description: {{description}}
Original URL: {{url}}

Transcript:
{{transcript}}

Output in English: One-Sentence Conclusion, Action Steps, Caveats, Who This Is For, Who This Is Not For, and Original URL.`,
  },
  {
    id: 'chunk_summary',
    name: '分块摘要',
    type: 'chunk_summary',
    builtIn: true,
    template: `这是一个长视频的第 {{chunkIndex}} / {{totalChunks}} 段字幕。请只总结这一段的事实、观点和关键例子，不要补充没有出现的信息。

视频标题：{{title}}
字幕片段：
{{chunkText}}`,
    enTemplate: `This is transcript chunk {{chunkIndex}} / {{totalChunks}} from a long video. Summarize only the facts, claims, and key examples in this chunk. Do not add anything that does not appear here.

Video title: {{title}}
Transcript chunk:
{{chunkText}}`,
  },
  {
    id: 'merge_summary',
    name: '合并摘要',
    type: 'merge_summary',
    builtIn: true,
    template: `以下是长视频各段摘要。请合并成一份不重复、结构清晰的中文总结。

视频标题：{{title}}
UP 主：{{upName}}
原链接：{{url}}

分段摘要：
{{chunkSummaries}}`,
    enTemplate: `Below are summaries of chunks from a long video. Merge them into one non-repetitive, clearly structured English summary.

Video title: {{title}}
Creator: {{upName}}
Original URL: {{url}}

Chunk summaries:
{{chunkSummaries}}`,
  },
  {
    id: 'video_insights_default',
    name: 'Video Insights',
    type: 'video_insights',
    builtIn: true,
    template: `你正在回答用户关于一个 Bilibili 视频的问题。请基于摘要和字幕回答，不知道就说不知道。

视频标题：{{title}}
摘要：
{{summary}}

字幕：
{{transcript}}

问题：{{question}}`,
    enTemplate: `You are answering a user's question about a Bilibili video. Answer in English based on the summary and transcript. If the answer is not supported, say you do not know.

Video title: {{title}}
Summary:
{{summary}}

Transcript:
{{transcript}}

Question: {{question}}`,
  },
  {
    id: 'one_page_json',
    name: '一图流 JSON',
    type: 'one_page_json',
    builtIn: true,
    template: `请把以下视频摘要转换为一张中文信息图所需的严格 JSON。只输出 JSON，不要 Markdown。

约束：
- 必须是 JSON.parse 可以解析的标准 JSON
- 所有属性名和字符串都必须使用英文双引号
- 不要输出 <think>、解释、注释、代码块或尾随逗号
- title 不超过 40 字
- conclusion 不超过 100 字
- keyPoints 3 到 8 条
- takeaways 1 到 6 条
- tags 1 到 8 个

视频标题：{{title}}
UP 主：{{upName}}
原链接：{{url}}
摘要：
{{summary}}

JSON 字段：title, subtitle, conclusion, keyPoints[{title,detail}], timeline[{time,event}], takeaways[], tags[], source{title,upName,url}`,
    enTemplate: `Convert the following video summary into strict JSON for a shareable English infographic. Output JSON only, no Markdown.

Rules:
- Must be valid JSON.parse-compatible JSON
- Use English double quotes for all property names and strings
- Do not output <think>, explanations, comments, code fences, or trailing commas
- title under 40 English words
- conclusion under 100 English words
- keyPoints 3 to 8 items
- takeaways 1 to 6 items
- tags 1 to 8 items

Video title: {{title}}
Creator: {{upName}}
Original URL: {{url}}
Summary:
{{summary}}

JSON fields: title, subtitle, conclusion, keyPoints[{title,detail}], timeline[{time,event}], takeaways[], tags[], source{title,upName,url}`,
  },
  {
    id: 'image_prompt',
    name: '图片 Prompt',
    type: 'image_prompt',
    builtIn: true,
    template: `根据以下视频一图流数据，写一个适合图像模型的英文 prompt。

要求：
- 只输出最终英文 prompt，不要解释、不要分析、不要 Markdown
- 120 到 220 个英文单词
- 必须结合视频标题、结论、关键点和标签里的具体主题，不要泛泛而谈
- 图片不应包含任何文字、字幕、汉字、logo 或水印
- 只负责生成抽象视觉背景、插画感场景和信息图氛围

{{summary}}`,
  },
];

export function getPromptById(id: string, custom: PromptPreset[] = []): PromptPreset | undefined {
  return [...custom, ...BUILT_IN_PROMPTS].find((prompt) => prompt.id === id);
}

export function getPromptTemplate(prompt: PromptPreset, language: 'zh-CN' | 'en-US' = 'zh-CN'): string {
  return language === 'en-US' ? prompt.enTemplate ?? prompt.template : prompt.template;
}
