import { registerSW } from 'virtual:pwa-register';
export const applyUpdate=registerSW({onNeedRefresh(){window.dispatchEvent(new Event('app-update'));}});
