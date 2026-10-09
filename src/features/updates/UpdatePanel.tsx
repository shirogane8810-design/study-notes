import {useSyncExternalStore} from 'react';
import {updates} from '../../sw';
export function useUpdates(){return useSyncExternalStore(updates.subscribe,updates.snapshot);}
export function UpdatePanel(){
  const state=useUpdates(),busy=state.status==='checking'||state.status==='applying';
  return <section className="app-updates" aria-label="アプリの更新"><small>使用中の版：{import.meta.env.DEV?'開発版':new Date(__APP_BUILT_AT__).toLocaleString('ja-JP')}<span className="build-id">{__APP_BUILD__}</span></small><button disabled={busy} onClick={()=>void updates.check()}>↻ 更新を確認</button>{state.available&&<button disabled={busy} onClick={()=>void updates.apply()}>保存して最新版を適用</button>}<p role={state.status==='error'?'alert':'status'}>{state.message}</p></section>;
}
export function UpdateNotice(){const state=useUpdates();return state.available?<div className="notice app-update-notice"><span>{state.message}</span><button disabled={state.status==='applying'||state.status==='checking'} onClick={()=>void updates.apply()}>保存して再読み込み</button></div>:null;}
