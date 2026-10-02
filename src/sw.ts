import { registerSW } from 'virtual:pwa-register';
export const applyUpdate=registerSW({
  onNeedRefresh(){window.dispatchEvent(new Event('app-update'));},
  onRegisteredSW(_url,registration){
    if(!registration)return;
    const check=()=>{if(navigator.onLine)void registration.update().catch(()=>{});};
    window.addEventListener('online',check);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
    window.setInterval(check,60*60*1000);
    check();
  },
});
