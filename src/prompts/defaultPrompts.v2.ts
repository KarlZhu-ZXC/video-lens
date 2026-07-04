import type { PromptPreset } from './promptTypes';
import type { Transcript } from '../sources/VideoSourceProvider';
import { stableHash } from '../utils/hash';

export const ONE_IMAGE_PROMPT_TEMPLATE =
  '根据以下视频内容总结，生成一张信息可视化的精美配图，风格清晰美观，适合作为视频总结的封面图：\n\n{{summary}}';

export const TEXT_CONNECTIVITY_TEST_PROMPT = 'Reply with OK.';

export const IMAGE_CONNECTIVITY_TEST_PROMPT =
  'Connectivity test image. Simple neutral abstract background, no text, no logo.';

export const DEFAULT_IMAGE_PROMPT_ID = 'image_infographic';

/**
 * 改良版内置 Prompts。
 *
 * 与 defaultPrompts.ts 的差异，集中在六件事：
 *   1. 每条 prompt 顶部加「通用规则」：忠实于字幕、长度目标、Markdown 格式、跳过无依据的章节。
 *   2. 去掉「禁止寒暄/我作为用户的偏好」之类过度拟人化或自我矛盾的措辞。
 *   3. 中文/英文模板对齐成「同一意图的两种语言」，不再出现两边章节不一致的情况。
 *   4. 把「写一段不存在的引用 / 凭空给行动步骤 / 替用户决定怎么处理」这些容易让模型编造的位置
 *      换成「必须基于字幕」「找不到就跳过/明说」。
 *   5. 结尾 URL / 元信息 收成固定段落，不再每条 prompt 都让模型重写一遍。
 *   6. 新增时间轴预设、Prompt 指纹和长视频目标预设合并能力。
 *
 * v1 文件保持不变；运行时显式引用本文件，便于后续对比两版效果。
 */
export const BUILT_IN_PROMPTS = {
  summary_plain: {
    id: 'summary_plain',
    name: '极简白话版',
    type: 'summary',
    icon: '省',
    builtIn: true,
    template: `通用规则：
- 严格基于「字幕内容」写，不要补充字幕未提及的事实或外部知识。
- 找不到依据的小节直接跳过，不要为了凑结构编造。
- 篇幅参考：短视频 200–350 字，长视频不超过 600 字。
- 用 H2 作为小节标题，段内优先用短句和 bullet，不要写成长段落。
- 中文输出；如果字幕里有英文专有名词，原样保留。

视频标题：{{title}}
创作者：{{creatorName}}
原链接：{{url}}

字幕内容：
{{transcript}}

请严格按以下结构输出（没有依据的整段跳过）：

## 一句话结论
直接说这个视频的核心意思，一句话。

## 讲了啥
按时间或话题顺序，用 3–6 条 bullet 把内容捋一遍。

## 关键点
列 3–5 条最重要的具体信息（数字、名字、结论、步骤）。

## 值得看看吗
说明视频的价值或定位。如果字幕明显以营销为主、信息重复，或实际内容与标题不一致，直接指出并说明字幕依据。

## 来源
- 标题：{{title}}
- 创作者：{{creatorName}}
- 链接：{{url}}`,
    enTemplate: `General rules:
- Stick to the transcript. Do not add facts that are not supported by it.
- Skip any section you cannot ground in the transcript; do not pad.
- Length: 80–140 words for short videos, up to 240 for long ones.
- Use H2 for sections, short sentences or bullet lists. Avoid long paragraphs.
- Output in English; keep proper nouns and quoted terms verbatim.

Video title: {{title}}
Creator: {{creatorName}}
Original URL: {{url}}

Transcript:
{{transcript}}

Use exactly this structure (skip sections that are not supported):

## Bottom Line
One sentence: the core point of the video.

## What It Covered
3–6 bullets in narrative or topical order.

## Key Points
3–5 specific facts, numbers, names, conclusions, or steps.

## Worth Your Time
State its practical value or positioning. Flag transcript-grounded marketing, heavy repetition, or a clear title/content mismatch, and name the supporting evidence.

## Source
- Title: {{title}}
- Creator: {{creatorName}}
- URL: {{url}}`,
  },
  summary_detailed: {
    id: 'summary_detailed',
    name: '结构化笔记版',
    type: 'summary',
    icon: '记',
    builtIn: true,
    template: `通用规则：
- 严格基于「字幕内容」写，不要补充字幕未提及的事实。
- 找不到依据的小节直接跳过；不要为了凑结构编造。
- 篇幅参考：短视频 400–700 字，长视频不超过 1200 字。
- 用 H2/H3 分层，bullet 优先；保留必要的引用，引用必须照抄字幕原文。
- 中文输出；如果字幕里有英文专有名词，原样保留。

视频标题：{{title}}
创作者：{{creatorName}}
原链接：{{url}}

字幕内容：
{{transcript}}

请按以下结构输出（没有依据的整段跳过）：

## 主题概述
用 2–3 句话说明这个视频在讲什么、面向谁。

## 内容大纲
按时间或话题顺序列出 4–8 个主要段落，每段一句话。

## 关键概念
解释视频里出现的核心术语或框架，并说明它在本视频语境中的含义。不要用外部定义替代视频自己的说法。

## 关键细节
数据、案例、对比、注意事项等具体信息。

## 字幕原句
仅在字幕句子完整且含义明确时，摘录 2–5 句原文并保留原语言。注明“字幕可能含识别误差”；无法确认原句完整性时跳过本节。

## 延伸方向
可继续读什么、可继续查证什么、可应用到哪些场景——只列视频里暗示过的方向，不要替用户决策。

## 来源
- 标题：{{title}}
- 创作者：{{creatorName}}
- 链接：{{url}}`,
    enTemplate: `General rules:
- Stick to the transcript. Do not add facts that are not supported by it.
- Skip any section you cannot ground in the transcript; do not pad.
- Length: 180–300 words for short videos, up to 500 for long ones.
- Use H2/H3 hierarchy, prefer bullets. Quotes must be verbatim from the transcript.
- Output in English; keep proper nouns verbatim.

Video title: {{title}}
Creator: {{creatorName}}
Original URL: {{url}}

Transcript:
{{transcript}}

Use this structure (skip sections that are not supported):

## Topic Overview
2–3 sentences: what the video is about and who it's for.

## Outline
4–8 main sections in narrative or topical order, one sentence each.

## Key Concepts
Explain core terms or frameworks in the meaning used by this video. Do not replace the video's meaning with an external definition.

## Important Details
Numbers, cases, contrasts, caveats, and other specifics.

## Transcript Excerpts
Include 2–5 verbatim excerpts only when the transcript sentence is complete and unambiguous. Note that captions may contain transcription errors; otherwise skip this section.

## Follow-up Directions
What to read or verify next, what to apply this to — only directions the video hints at; do not decide for the reader.

## Source
- Title: {{title}}
- Creator: {{creatorName}}
- URL: {{url}}`,
  },
  summary_critical: {
    id: 'summary_critical',
    name: '批判分析版',
    type: 'summary',
    icon: '批',
    builtIn: true,
    template: `通用规则：
- 区分「视频主张」和「视频给出的证据」，分开列，不要混在一起。
- 评估必须基于字幕内容；视频没给论据的，不要替它补；找不到直接反例的，不要凭空捏造对立观点。
- 篇幅参考：短视频 400–700 字，长视频不超过 1200 字。
- 用 H2/H3 分层，bullet 优先；引用字幕原文时照抄。
- 中文输出；如果字幕里有英文专名词，原样保留。

视频标题：{{title}}
创作者：{{creatorName}}
原链接：{{url}}

字幕内容：
{{transcript}}

请按以下结构输出（没有依据的整段跳过）：

## 核心主张
列出视频的 2–5 个核心主张，逐条简短陈述。

## 论据评估
对每个核心主张，说明视频给出了哪些证据、案例或数据；没给证据的明确写「视频未提供证据」。

## 逻辑漏洞
只列字幕本身存在的内部矛盾、跳跃或定义不清的地方；不要从外部知识补充。

## 视频中提及的不同意见
只列视频自己引述或回应过的反方观点；视频没提就跳过本节。

## 待核查项
列出仅凭字幕无法确认、需要外部来源验证的事实性主张。不要假装已经完成事实核查。

## 内容质量判断
分别评价论点是否清楚、视频内论据是否充分、限制条件是否交代。结论只代表“视频内部论证质量”，不等于外部事实真伪。

## 来源
- 标题：{{title}}
- 创作者：{{creatorName}}
- 链接：{{url}}`,
    enTemplate: `General rules:
- Separate "claims" from "evidence the video actually gives." Do not mix them.
- Only critique what is in the transcript; do not import outside knowledge to fill gaps, and do not invent opposing views the video never references.
- Length: 180–300 words for short videos, up to 500 for long ones.
- Use H2/H3 hierarchy, prefer bullets. Quotes must be verbatim.
- Output in English; keep proper nouns verbatim.

Video title: {{title}}
Creator: {{creatorName}}
Original URL: {{url}}

Transcript:
{{transcript}}

Use this structure (skip sections that are not supported):

## Core Claims
2–5 main claims, each one short sentence.

## Evidence Assessment
For each claim, list the evidence, examples, or data the video gives. If none, say so explicitly.

## Logical Gaps
Internal contradictions, jumps, or undefined terms — only those actually present in the transcript.

## Counterpoints the Video Itself Raises
Only views the video quotes or responds to. Skip this section if there are none.

## Items Requiring Verification
List factual claims that cannot be verified from the transcript alone and require external sources. Do not pretend a fact-check has already been completed.

## Content Quality Judgment
Assess claim clarity, evidence supplied within the video, and stated limitations separately. Make clear that this evaluates internal argument quality, not external factual truth.

## Source
- Title: {{title}}
- Creator: {{creatorName}}
- URL: {{url}}`,
  },
  summary_action: {
    id: 'summary_action',
    name: '行动清单版',
    type: 'summary',
    icon: '行',
    builtIn: true,
    template: `通用规则：
- 如果视频本质是「知识/观点/资讯」而不是「教程/方法论」，把「可执行步骤」改写成「如果想动手，从哪里开始」或直接跳过；不要替视频编出步骤。
- 适用前提和不适用场景都要基于视频给出的条件，不要凭空想象读者画像。
- 篇幅参考：短视频 300–500 字，长视频不超过 800 字。
- 用 H2 分层；步骤用有序列表，每步 1 行。
- 中文输出；专有名词原样保留。

视频标题：{{title}}
创作者：{{creatorName}}
原链接：{{url}}

字幕内容：
{{transcript}}

请按以下结构输出（没有依据的整段跳过）：

## 一句话结论
这个视频最值得记住的一件事。

## 适用前提
要照做需要哪些背景、资源或条件——只列视频说过的。

## 可执行步骤（或起点）
按顺序列出 3–7 步，每步 1 行，动词开头。如果不是教程型，明确写「这不是教程型视频，建议从这里入手：…」。

## 注意事项
视频里提到过的坑、限制、前置条件、常见错误。

## 预期结果
只写视频明确承诺、展示或测量过的结果；没有依据就跳过。

## 不适用场景
只写视频明确提到的不适用条件；不要推测读者画像，也不要泛泛地说「不适合新手」。

## 来源
- 标题：{{title}}
- 创作者：{{creatorName}}
- 链接：{{url}}`,
    enTemplate: `General rules:
- If the video is informational rather than how-to, do NOT invent steps. Either turn this section into "where to start if you want to act" or skip it.
- Conditions and anti-cases must come from the video; do not fabricate audience profiles.
- Length: 120–220 words for short videos, up to 350 for long ones.
- Use H2 hierarchy; steps should be a numbered list, one line each, verb-first.
- Output in English; keep proper nouns verbatim.

Video title: {{title}}
Creator: {{creatorName}}
Original URL: {{url}}

Transcript:
{{transcript}}

Use this structure (skip sections that are not supported):

## One-Sentence Conclusion
The single most important takeaway.

## Prerequisites
Background, resources, or conditions needed — only what the video mentions.

## Action Steps (or Starting Point)
3–7 verb-first steps in order, one line each. If the video is not a how-to, say so and give a starting point instead.

## Caveats
Pitfalls, limits, prerequisites, common mistakes the video warns about.

## Expected Result
Only include outcomes the video explicitly promises, demonstrates, or measures. Skip if unsupported.

## When Not To Apply
Only cases the video explicitly flags. Do not infer audience profiles or add generic "not for beginners" filler.

## Source
- Title: {{title}}
- Creator: {{creatorName}}
- URL: {{url}}`,
  },
  summary_timeline: {
    id: 'summary_timeline',
    name: '时间轴定位版',
    type: 'summary',
    icon: '时',
    builtIn: true,
    template: `通用规则：
- 严格基于「字幕内容」输出，不补充外部事实。
- 只能原样使用字幕中已经出现的 [开始-结束] 时间范围；禁止猜测、补写、合并或改写时间。
- 同一条内容没有明确时间范围时，写「未定位到明确时间范围」，不要伪造时间点。
- 篇幅参考：5–10 个时间轴片段、3–5 个重点结论、3 个值得追问片段。
- 使用 Markdown；中文输出；专有名词保留原文。

视频标题：{{title}}
创作者：{{creatorName}}
原链接：{{url}}

字幕内容：
{{transcript}}

请严格按以下结构输出：

## 一句话结论
一句话说明视频核心内容。

## 时间轴速览
按字幕顺序列出 5–10 个关键片段。每条格式为：
- [输入中已有的开始-结束] 这一段的核心内容

## 重点结论
提炼 3–5 个最重要且有字幕依据的信息点。

## 值得追问
列出 3 个适合继续追问的片段，每条保留输入中已有的时间范围并给出具体问题。

## 来源
- 标题：{{title}}
- 创作者：{{creatorName}}
- 链接：{{url}}`,
    enTemplate: `General rules:
- Stay strictly within the transcript; do not add external facts.
- Use only [start-end] ranges already present in the transcript, verbatim. Never guess, create, merge, or rewrite timestamps.
- If content has no explicit range, write "No clear timestamp in the transcript" instead of inventing one.
- Target 5–10 timeline entries, 3–5 key conclusions, and 3 follow-up moments.
- Use Markdown and output in English; preserve proper nouns.

Video title: {{title}}
Creator: {{creatorName}}
Original URL: {{url}}

Transcript:
{{transcript}}

Use exactly this structure:

## Bottom Line
One sentence stating the video's core content.

## Timeline
List 5–10 key moments in transcript order. Format each item as:
- [verbatim start-end range from input] What this segment covers

## Key Conclusions
Extract 3–5 important points supported by the transcript.

## Worth Following Up
List 3 moments worth asking about next. Preserve an existing input range and add a specific question for each.

## Source
- Title: {{title}}
- Creator: {{creatorName}}
- URL: {{url}}`,
  },
  chunk_summary: {
    id: 'chunk_summary',
    name: '分块摘要',
    type: 'chunk_summary',
    builtIn: true,
    template: `通用规则：
- 只总结本段字幕里出现的事实、观点、例子；不要补充字幕未提及的内容，也不要引入其他段的信息。
- 同一支视频的其他段还会总结一次，所以不需要追求覆盖主旨；本段独有信息优先。
- 篇幅参考：150–350 字；用 bullet，3–9 条；句式短，优先保留本段独有的数字、条件、因果、案例和结论。
- 如果字幕行带 [开始-结束]，必须原样保留对应范围；禁止生成输入中没有的时间。
- 中文输出；专有名词原样保留。

视频标题：{{title}}
当前是第 {{chunkIndex}} / {{totalChunks}} 段字幕。

本段字幕：
{{chunkText}}

请输出：
- 3–9 条 bullet，每条聚焦一个事实/观点/例子，必须来自本段字幕。
- 末尾不要写「第 X 段」或重复段序号。`,
    enTemplate: `General rules:
- Only summarize facts, claims, and examples from THIS chunk. Do not add anything not in it, and do not pull from other chunks.
- Other chunks will be summarized separately, so don't try to cover the whole video here; surface what is unique to this chunk.
- Length: 60–150 words; 3–9 bullets; short sentences. Preserve unique numbers, conditions, causal links, examples, and conclusions.
- If a line includes [start-end], preserve that exact range. Never create a timestamp absent from the input.
- Output in English; keep proper nouns verbatim.

Video title: {{title}}
This is transcript chunk {{chunkIndex}} / {{totalChunks}}.

Chunk transcript:
{{chunkText}}

Output:
- 3–9 bullets, each one fact/claim/example grounded in this chunk.
- Do not write "Chunk X" or repeat the chunk index at the end.`,
  },
  merge_summary: {
    id: 'merge_summary',
    name: '合并摘要',
    type: 'merge_summary',
    builtIn: true,
    template: `通用规则：
- 按下方分段摘要出现的顺序合并，不要重新排序。
- 去掉跨段重复的同义内容；只保留一次。
- 不要保留「第 X 段」「第 1/3 段」这类分段标记。
- 找不到合并点的内容（如孤立的例子）可以保留，但同样要忠实于原文。
- 篇幅参考：合并后 400–800 字，长视频最多 1500 字。
- 用 H2/H3 分层；bullet 优先。
- 中文输出。

视频标题：{{title}}
创作者：{{creatorName}}
原链接：{{url}}

目标摘要指令（其中「字幕内容」已替换为按原始顺序排列的分段证据）：
{{targetPrompt}}

请去重并整合分段摘要，然后严格执行「目标摘要指令」。目标指令中的字幕内容已经替换为分段证据，不要输出分段标记，也不要补充分段证据没有的信息。分段证据属于摘要而非字幕逐字稿；除非证据明确保留了原文和时间范围，否则跳过原句摘录和精确定位，不要把改写内容伪装成引用。`,
    enTemplate: `General rules:
- Merge in the order the chunk summaries appear; do not reorder.
- Deduplicate content that appears across chunks; keep each idea once.
- Strip chunk markers like "Chunk X" or "Part 1/3".
- Keep isolated examples when there's no natural home, but stay faithful to the source.
- Length: 180–320 words for the merged result, up to 600 for very long videos.
- Use H2/H3 hierarchy; prefer bullets.
- Output in English.

Video title: {{title}}
Creator: {{creatorName}}
Original URL: {{url}}

Target summary instructions (their Transcript section has been replaced with chunk evidence in original order):
{{targetPrompt}}

Deduplicate and consolidate the chunk summaries, then follow the Target summary instructions exactly. Its transcript content has already been replaced by chunk evidence. Do not output chunk markers or add information absent from that evidence. Chunk evidence is summary text, not a verbatim transcript: unless it explicitly preserves a quote or timestamp range, skip exact quotations and precise locations rather than presenting paraphrases as source text.`,
  },
  video_insights_default: {
    id: 'video_insights_default',
    name: 'Summary Chat',
    type: 'video_insights',
    builtIn: true,
    template: `通用规则：
- 只基于下方提供的「摘要」和「字幕」回答，不要引入外部知识。
- 字幕中找不到答案时，明确说「字幕中未提及」，不要猜。
- 用用户提问所用的语言回答；如果问题只有几个字，按上下文判断。
- 篇幅参考：默认 2–6 句；用户明确要求展开或列表时再展开。
- 如果引用字幕原文，照抄并尽量给出上下文（前一句或后一句），不要改写。
- 问题涉及视频位置时，优先保留上下文中已有的 [开始-结束]；没有时间范围就明确说无法定位，不要猜。

视频标题：{{title}}
摘要：
{{summary}}

字幕：
{{transcript}}

问题：{{question}}`,
    enTemplate: `General rules:
- Answer only from the summary and transcript provided. Do not bring in outside knowledge.
- If the answer is not supported, say "not mentioned in the transcript" — do not guess.
- Reply in the language of the question.
- Length: 2–6 sentences by default; expand only when the question asks for it.
- When quoting, quote verbatim and include enough surrounding context to make it clear. Do not paraphrase quotes.
- For location questions, preserve an existing [start-end] range from context. If none exists, say it cannot be located; never guess.

Video title: {{title}}
Summary:
{{summary}}

Transcript:
{{transcript}}

Question: {{question}}`,
  },
  image_infographic: {
    id: 'image_infographic',
    name: '信息图',
    type: 'image',
    icon: '图',
    builtIn: true,
    template: `根据以下视频总结，生成一张横向信息可视化配图。

视觉方向：
- 清晰、现代、精致，适合作为视频总结的主视觉。
- 用 3–5 个清楚的视觉模块表达核心观点、步骤、对比或数据关系。
- 使用图标、抽象图形、卡片、箭头、层级分组和柔和光效，但不要堆满细节。
- 如果涉及人物、行业或场景，可以用象征性插画表达，不要使用真实品牌 Logo。
- 不要生成大段文字、乱码、小字、水印、二维码或界面截图；必要文字只保留极少量可读标题感元素。

视频总结：
{{summary}}`,
    enTemplate: `Create a horizontal infographic-style hero image from the video summary below.

Visual direction:
- Clear, modern, polished, suitable as the main visual for a video summary.
- Express the core ideas, steps, comparisons, or data relationships through 3-5 readable visual modules.
- Use icons, abstract shapes, cards, arrows, grouped hierarchy, and subtle glow without overcrowding the image.
- If people, industries, or scenarios appear, represent them symbolically; do not use real brand logos.
- Avoid long text, gibberish, tiny labels, watermarks, QR codes, or UI screenshots. Keep any text-like elements minimal and title-like.

Video summary:
{{summary}}`,
  },
  image_cover: {
    id: 'image_cover',
    name: '封面图',
    type: 'image',
    icon: '封',
    builtIn: true,
    template: `根据以下视频总结，生成一张高点击感的视频封面主视觉。

视觉方向：
- 构图大胆，主体明确，前景有一个强视觉焦点，背景提供情绪和主题线索。
- 使用高对比光影、干净留白和电影感景深，让缩略图尺寸下也清楚。
- 可以把关键概念拟人化为人物、物件、场景或符号，但不要堆叠太多信息。
- 整体像专业 YouTube/Bilibili 封面设计，不要像 PPT 页面。
- 避免真实品牌 Logo、水印、二维码和大量文字；不要生成难以辨认的小字。

视频总结：
{{summary}}`,
    enTemplate: `Create a high-click-through video thumbnail hero image from the video summary below.

Visual direction:
- Bold composition with one clear focal subject in the foreground and thematic context in the background.
- Use high-contrast lighting, clean negative space, and cinematic depth so it remains readable at thumbnail size.
- Turn key ideas into symbolic characters, objects, scenes, or visual metaphors, but avoid overcrowding.
- It should feel like a professional YouTube/Bilibili cover, not a slide deck.
- Avoid real brand logos, watermarks, QR codes, and long text. Do not create unreadable tiny labels.

Video summary:
{{summary}}`,
  },
  image_poster: {
    id: 'image_poster',
    name: '海报',
    type: 'image',
    icon: '海',
    builtIn: true,
    template: `根据以下视频总结，生成一张电影海报感的主题视觉。

视觉方向：
- 强氛围、强叙事，画面像一张主题海报，而不是信息卡片。
- 用中心主体、前后景层次、戏剧化光线和统一色调表达视频的核心情绪。
- 适合观点、事件、人物、商业、财经、科技类视频的高级主视觉。
- 可以加入象征性道具和环境隐喻，但不要依赖文字解释。
- 避免真实品牌 Logo、水印、二维码、长标题和小字；不要照搬任何真实电影海报。

视频总结：
{{summary}}`,
    enTemplate: `Create a cinematic poster-style thematic visual from the video summary below.

Visual direction:
- Atmospheric and narrative, like a theme poster rather than an information card.
- Use a central subject, layered foreground/background, dramatic lighting, and a coherent color palette to express the core mood.
- Suitable for opinion, event, people, business, finance, and technology videos.
- Add symbolic props and environmental metaphors where useful, but do not rely on text to explain the idea.
- Avoid real brand logos, watermarks, QR codes, long titles, and tiny labels. Do not copy any real movie poster.

Video summary:
{{summary}}`,
  },
  image_illustration: {
    id: 'image_illustration',
    name: '插画',
    type: 'image',
    icon: '插',
    builtIn: true,
    template: `根据以下视频总结，生成一张温和、精致、叙事感强的插画。

视觉方向：
- 使用现代 editorial illustration 风格，线条干净，色彩协调，细节有层次但不凌乱。
- 把视频核心内容转化为一个可理解的场景：人物正在行动、物件有关系、环境能说明主题。
- 适合知识、生活、故事、教育、科技解释类视频。
- 画面要友好、清爽、有留白，不要过度商业广告感。
- 避免真实品牌 Logo、水印、二维码、长文字和小字。

视频总结：
{{summary}}`,
    enTemplate: `Create a warm, polished, narrative illustration from the video summary below.

Visual direction:
- Use a modern editorial illustration style with clean lines, coordinated colors, and layered but uncluttered detail.
- Turn the core content into an understandable scene: people taking action, related objects, and an environment that explains the topic.
- Suitable for knowledge, lifestyle, story, education, and technology explainer videos.
- Keep it friendly, fresh, and spacious rather than overly commercial.
- Avoid real brand logos, watermarks, QR codes, long text, and tiny labels.

Video summary:
{{summary}}`,
  },
  image_minimal: {
    id: 'image_minimal',
    name: '极简',
    type: 'image',
    icon: '简',
    builtIn: true,
    template: `根据以下视频总结，生成一张极简抽象主视觉。

视觉方向：
- 使用少量几何形状、柔和渐变、空间层次和一个明确象征物表达核心主题。
- 画面干净、高级、留白充足，适合放在摘要页或文章封面。
- 只保留一个主要视觉隐喻，不要画复杂场景，不要做信息图。
- 色彩控制在 2–4 个主色，强调平衡、秩序和可读性。
- 避免真实品牌 Logo、水印、二维码、长文字、小字和杂乱背景。

视频总结：
{{summary}}`,
    enTemplate: `Create a minimal abstract hero image from the video summary below.

Visual direction:
- Use a small number of geometric shapes, soft gradients, spatial depth, and one clear symbolic object to express the core theme.
- Clean, premium, and spacious, suitable for a summary page or article cover.
- Keep only one main visual metaphor. Do not create a complex scene or an infographic.
- Limit the palette to 2-4 main colors and emphasize balance, order, and readability.
- Avoid real brand logos, watermarks, QR codes, long text, tiny labels, and busy backgrounds.

Video summary:
{{summary}}`,
  },
  image_pixel_rpg: {
    id: 'image_pixel_rpg',
    name: 'Pixel RPG',
    type: 'image',
    icon: '像',
    builtIn: true,
    template: `根据以下视频总结，生成一张像素 RPG 风格的信息图主视觉。

视觉方向：
- 使用精致 16-bit pixel art / retro fantasy RPG game UI 风格，横向构图。
- 把核心概念拟人化为 RPG 职业、角色、道具、徽章或阵营，并按重要性或类别分层排列。
- 可以使用城堡、旗帜、盾牌、卷轴、宝箱、任务面板、像素按钮、排行榜横幅等游戏 UI 元素。
- 画面要像一张可读的 RPG strategy board / ranking board：层级清楚、角色鲜明、信息密度高但不拥挤。
- 如果视频涉及行业、公司、技术或观点，用象征性角色和道具表达，不要使用真实品牌 Logo。
- 避免大段文字、乱码、小字、水印、二维码；中文标签不要成为主要信息承载，优先靠角色和构图表达。

视频总结：
{{summary}}`,
    enTemplate: `Create a Pixel RPG style infographic hero image from the video summary below.

Visual direction:
- Use polished 16-bit pixel art / retro fantasy RPG game UI styling in a horizontal composition.
- Personify the core concepts as RPG classes, characters, props, badges, or factions, arranged by importance or category.
- Use castles, banners, shields, scrolls, chests, quest panels, pixel buttons, and ranking ribbons where useful.
- The image should feel like a readable RPG strategy board / ranking board: clear hierarchy, distinct characters, high information density without clutter.
- If the video involves industries, companies, technology, or opinions, express them through symbolic characters and props; do not use real brand logos.
- Avoid long text, gibberish, tiny labels, watermarks, and QR codes. Let characters and composition carry the meaning more than labels.

Video summary:
{{summary}}`,
  },
} satisfies Record<string, PromptPreset>;

export type BuiltInPromptId = keyof typeof BUILT_IN_PROMPTS;

export const SUMMARY_PROMPT_ORDER = [
  'summary_plain',
  'summary_detailed',
  'summary_critical',
  'summary_action',
  'summary_timeline',
] as const satisfies readonly BuiltInPromptId[];

export const IMAGE_PROMPT_ORDER = [
  'image_infographic',
  'image_cover',
  'image_poster',
  'image_illustration',
  'image_minimal',
  'image_pixel_rpg',
] as const satisfies readonly BuiltInPromptId[];

export function getPromptById(id: string, custom: PromptPreset[] = []): PromptPreset | undefined {
  return custom.find((prompt) => prompt.id === id) ?? BUILT_IN_PROMPTS[id as BuiltInPromptId];
}

export function getPromptTemplate(prompt: PromptPreset, language: 'zh-CN' | 'en-US' = 'zh-CN'): string {
  return language === 'en-US' ? prompt.enTemplate ?? prompt.template : prompt.template;
}

export interface EffectiveSummaryPrompt {
  preset: PromptPreset;
  template: string;
  fingerprint: string;
}

export function resolveSummaryPrompt(
  id: string,
  custom: PromptPreset[] = [],
  language: 'zh-CN' | 'en-US' = 'zh-CN',
): EffectiveSummaryPrompt {
  const preset = getPromptById(id, custom);
  if (!preset || preset.type !== 'summary') throw new Error(`找不到摘要 Prompt：${id}`);
  const template = getPromptTemplate(preset, language);
  return {
    preset,
    template,
    fingerprint: stableHash(`${preset.id}\n${language}\n${template}`),
  };
}

export function getSummaryPromptPresets(): PromptPreset[] {
  return SUMMARY_PROMPT_ORDER.map((id) => BUILT_IN_PROMPTS[id]);
}

export interface EffectiveImagePrompt {
  preset: PromptPreset;
  template: string;
  fingerprint: string;
}

export function resolveImagePrompt(
  id: string | undefined,
  custom: PromptPreset[] = [],
  language: 'zh-CN' | 'en-US' = 'zh-CN',
): EffectiveImagePrompt {
  const promptId = id || DEFAULT_IMAGE_PROMPT_ID;
  const preset = getPromptById(promptId, custom);
  if (!preset || preset.type !== 'image') throw new Error(`找不到生图 Prompt：${promptId}`);
  const template = getPromptTemplate(preset, language);
  return {
    preset,
    template,
    fingerprint: stableHash(`${preset.id}\n${language}\n${template}`),
  };
}

export function getImagePromptPresets(): PromptPreset[] {
  return IMAGE_PROMPT_ORDER.map((id) => BUILT_IN_PROMPTS[id]);
}

export function formatTranscriptWithTimeline(transcript: Transcript): string {
  return transcript.lines
    .filter((line) => line.text.trim())
    .map((line) => `[${formatTimestamp(line.from)}-${formatTimestamp(line.to)}] ${line.text.trim()}`)
    .join('\n');
}

function formatTimestamp(value: number): string {
  const totalSeconds = Math.max(0, Math.round(value));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const minuteSecond = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return hours > 0 ? `${String(hours).padStart(2, '0')}:${minuteSecond}` : minuteSecond;
}
