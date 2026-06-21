import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';
import packageJson from './package.json';

export const userscriptVersion = packageJson.version;
export const userscriptName = '片语 · Video Lens';
export const userscriptNamespace = 'https://github.com/KarlZhu-ZXC/video-lens';
export const userscriptFileName = 'video-lens.user.js';

export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.ts',
      userscript: {
        name: userscriptName,
        namespace: userscriptNamespace,
        version: userscriptVersion,
        description: 'Bilibili / YouTube 视频自动获取字幕并生成流式摘要与交互式对话，支持基于内容的配图生成、双语配置与大模型思考过程可视化',
        author: 'Karl',
        match: ['*://*.bilibili.com/*', '*://bilibili.com/*', '*://*.youtube.com/*', 'https://chatgpt.com/*'],
        connect: [
          'youtube.com',
          'googlevideo.com',
          'youtubei.googleapis.com',
          'www.googleapis.com',
          'api.minimaxi.com',
          'api.minimax.io',
          '*',
        ],
        'run-at': 'document-end',
        noframes: true,
        grant: [
          'GM_getValue',
          'GM_setValue',
          'GM_deleteValue',
          'GM_addValueChangeListener',
          'GM_removeValueChangeListener',
          'GM_openInTab',
          'GM_xmlhttpRequest',
          'GM_setClipboard',
        ],
        license: 'MIT',
      },
      build: {
        fileName: userscriptFileName,
        autoGrant: false,
      },
    }),
  ],
});
