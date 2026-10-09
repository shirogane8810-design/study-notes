import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
const builtAt=new Date().toISOString();
const release={app:'study-notes',id:builtAt.replace(/[-:.TZ]/g,''),builtAt};
export default defineConfig({
  base:'./',
  define:{__APP_BUILD__:JSON.stringify(release.id),__APP_BUILT_AT__:JSON.stringify(builtAt)},
  plugins:[react(),{
    name:'release-info',generateBundle(){
      this.emitFile({type:'asset',fileName:'version.json',source:JSON.stringify(release)});
      this.emitFile({type:'asset',fileName:'sw-version.js',source:`self.addEventListener('message',event=>{if(event.data&&event.data.type==='GET_APP_BUILD'&&event.ports[0])event.ports[0].postMessage({id:${JSON.stringify(release.id)}});});`});
    },
  },VitePWA({
    injectRegister:false,registerType:'prompt',includeAssets:['icon.svg','icon-192.png','icon-512.png'],
    manifest:{name:'学習ノート',short_name:'学習ノート',description:'科目と授業回を整理する自分専用の学習ノート',lang:'ja',start_url:'.',scope:'.',display:'standalone',background_color:'#ffffff',theme_color:'#2563eb',icons:[{src:'icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'}]},
    workbox:{clientsClaim:true,importScripts:['./sw-version.js'],globIgnores:['**/sw-version.js','**/version.json'],globPatterns:['**/*.{js,mjs,css,html,svg,png,webmanifest,bcmap,ttf,otf,pfb,wasm,woff,woff2}'],maximumFileSizeToCacheInBytes:10000000,navigateFallback:'index.html'},
  })],
  test:{environment:'node',setupFiles:['./src/test-setup.ts']},
});
