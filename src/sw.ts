import {UpdateController,parseRelease,readWorkerBuild} from './features/updates/controller';
import {flushAllStrokes} from './features/pdf/autosave';
const base=new URL(import.meta.env.BASE_URL,document.baseURI);
export const updates=new UpdateController({
  workers:import.meta.env.PROD&&'serviceWorker' in navigator?navigator.serviceWorker:undefined,
  url:new URL('sw.js',base).href,scope:base.pathname,current:__APP_BUILD__,online:()=>navigator.onLine,
  release:async()=>{if(!import.meta.env.PROD)return {app:'study-notes',id:__APP_BUILD__,builtAt:__APP_BUILT_AT__};const response=await fetch(new URL(`version.json?check=${Date.now()}`,base),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('公開版の更新情報を取得できませんでした。時間を置いて再確認してください。');return parseRelease(await response.json());},
  workerBuild:readWorkerBuild,save:async()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();await flushAllStrokes();},reload:()=>window.location.reload(),
});
const check=()=>{if(!document.hidden)void updates.check();};
window.addEventListener('online',check);window.addEventListener('focus',check);window.addEventListener('pageshow',check);
document.addEventListener('visibilitychange',check);window.setInterval(check,5*60*1000);check();
