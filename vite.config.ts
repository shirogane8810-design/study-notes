import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  base: './',
  plugins: [react(), VitePWA({registerType:'prompt', includeAssets:['icon.svg','icon-192.png','icon-512.png'], manifest:{name:'学習ノート',short_name:'学習ノート',description:'科目と授業回を整理する自分専用の学習ノート',lang:'ja',start_url:'.',scope:'.',display:'standalone',background_color:'#ffffff',theme_color:'#2563eb',icons:[{src:'icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'}]},workbox:{globPatterns:['**/*.{js,mjs,css,html,svg,png,webmanifest,bcmap,ttf,otf,pfb,wasm,woff,woff2}'],maximumFileSizeToCacheInBytes:10000000,navigateFallback:'index.html'}})],
  test:{environment:'node',setupFiles:['./src/test-setup.ts']}
});
