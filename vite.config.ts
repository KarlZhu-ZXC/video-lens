import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.ts',
      userscript: {
        name: 'Video Summary',
        namespace: 'https://github.com/yourname/video-summary',
        version: '0.1.0',
        description: 'Bilibili / YouTube 视频字幕摘要、Video Insights、一图流总结与 AI 封面图生成',
        author: 'Karl',
        match: ['*://*.bilibili.com/*', '*://bilibili.com/*', '*://*.youtube.com/*'],
        connect: [
          'youtube.com',
          'googlevideo.com',
          'youtubei.googleapis.com',
          'www.googleapis.com',
          'api.minimaxi.com',
          'api.minimax.io',
        ],
        'run-at': 'document-end',
        noframes: true,
        grant: ['GM_getValue', 'GM_setValue', 'GM_xmlhttpRequest', 'GM_setClipboard'],
        license: 'MIT',
      },
      build: {
        fileName: 'video-summary.user.js',
        autoGrant: false,
      },
    }),
  ],
});
