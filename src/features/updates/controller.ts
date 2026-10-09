export interface Release {app:'study-notes';id:string;builtAt:string}
export interface UpdateState {status:'idle'|'checking'|'current'|'available'|'applying'|'error'|'offline';available:boolean;message:string;release?:Release}
interface Dependencies {
  workers?:ServiceWorkerContainer;url:string;scope:string;current:string;
  online:()=>boolean;release:()=>Promise<Release>;workerBuild:(worker:ServiceWorker)=>Promise<string>;
  save:()=>Promise<void>;reload:()=>void;
}
export function parseRelease(value:unknown):Release {
  const v=value as Partial<Release>|null;
  if(!v||v.app!=='study-notes'||typeof v.id!=='string'||!v.id||v.id.length>100||typeof v.builtAt!=='string'||!Number.isFinite(Date.parse(v.builtAt)))throw new Error('更新情報を読み込めませんでした。時間を置いて再確認してください。');
  return {app:v.app,id:v.id,builtAt:v.builtAt};
}
export function waitForWorker(worker:ServiceWorker,state:ServiceWorkerState,timeout=30000){
  return new Promise<void>((resolve,reject)=>{
    const done=()=>{worker.removeEventListener('statechange',changed);clearTimeout(timer);};
    const changed=()=>{if(worker.state===state||state==='installed'&&(worker.state==='activating'||worker.state==='activated')){done();resolve();}else if(worker.state==='redundant'){done();reject(new Error('更新の準備が中断されました。もう一度確認してください。'));}};
    const timer=setTimeout(()=>{done();reject(new Error('更新の準備に時間がかかっています。もう一度確認してください。'));},timeout);
    worker.addEventListener('statechange',changed);changed();
  });
}
export function readWorkerBuild(worker:ServiceWorker):Promise<string>{
  return new Promise((resolve,reject)=>{const channel=new MessageChannel();const finish=()=>{clearTimeout(timer);channel.port1.close();channel.port2.close();};const timer=setTimeout(()=>{finish();reject(new Error('更新の確認が完了しませんでした。アプリを開き直して再確認してください。'));},5000);channel.port1.onmessage=event=>{const id=event.data?.id;finish();if(typeof id==='string')resolve(id);else reject(new Error('更新情報が不正です。'));};worker.postMessage({type:'GET_APP_BUILD'},[channel.port2]);});
}
export class UpdateController {
  private state:UpdateState={status:'idle',available:false,message:'更新を確認できます。'};
  private listeners=new Set<()=>void>();private registration?:Promise<ServiceWorkerRegistration|undefined>;private checking?:Promise<void>;private applying=false;
  constructor(private d:Dependencies){}
  snapshot=()=>this.state;
  subscribe=(callback:()=>void)=>{this.listeners.add(callback);return()=>{this.listeners.delete(callback);};};
  private set(patch:Partial<UpdateState>){this.state={...this.state,...patch};for(const callback of this.listeners)callback();}
  start(){
    if(this.registration)return this.registration;
    if(!this.d.workers)return Promise.resolve(undefined);
    this.d.workers.addEventListener('controllerchange',()=>{const worker=this.d.workers?.controller;if(!this.applying&&worker)void this.d.workerBuild(worker).then(id=>{if(!this.applying&&id!==this.d.current)this.set({status:'available',available:true,message:'更新の準備ができました。入力を終えて適用してください。'});}).catch(()=>{});});
    this.registration=this.d.workers.register(this.d.url,{scope:this.d.scope,updateViaCache:'none'}).then(registration=>{
      const inspect=()=>{if(registration.waiting&&!this.applying)this.set({status:'available',available:true,message:'新しいバージョンがあります。入力を終えて適用してください。'});};
      registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',inspect);inspect();});inspect();return registration;
    }).catch(error=>{this.registration=undefined;throw error;});return this.registration;
  }
  check():Promise<void>{
    if(this.checking)return this.checking;if(this.applying)return Promise.resolve();
    if(!this.d.online()){this.set({status:'offline',message:'オフラインです。接続後に更新を確認できます。'});return Promise.resolve();}
    this.set({status:'checking',message:'最新版を確認しています…'});
    this.checking=(async()=>{try{
      const registration=await this.start();const release=await this.d.release();
      if(registration)await registration.update();
      const available=release.id!==this.d.current||!!registration?.waiting;
      this.set({release,available,status:available?'available':'current',message:available?'新しいバージョンがあります。入力を終えて適用してください。':'最新版を使用しています。'});
    }catch(error){this.set({status:'error',message:error instanceof Error?error.message:'更新を確認できませんでした。ネット接続を確認してください。'});}finally{this.checking=undefined;}})();return this.checking;
  }
  async apply(){
    if(this.applying)return;this.applying=true;this.set({status:'applying',message:'書き込みを保存して更新しています…'});
    try{
      // A failed save must stop activation and navigation.
      try{await this.d.save();}catch{throw new Error('書き込みを保存できませんでした。更新を中止しました。保存を再試行してください。');}
      if(!this.d.online())throw new Error('更新にはネット接続が必要です。書き込みは保存済みです。');
      const registration=await this.start(),release=await this.d.release();this.set({release});
      if(!registration){this.d.reload();return;}
      await registration.update();
      if(registration.installing)await waitForWorker(registration.installing,'installed');
      if(registration.waiting){const waiting=registration.waiting;const activated=waitForWorker(waiting,'activated');waiting.postMessage({type:'SKIP_WAITING'});await activated;}
      const active=registration.active;
      if(!active||await this.d.workerBuild(active)!==release.id)throw new Error('最新版の準備がまだ完了していません。少し待って「更新を確認」を押してください。');
      // Activation and clientsClaim can occur in either order. Wait for both.
      if(this.d.workers?.controller!==active)await new Promise<void>((resolve,reject)=>{
        const workers=this.d.workers!;const done=()=>{clearTimeout(timer);workers.removeEventListener('controllerchange',changed);};const changed=()=>{if(workers.controller===active){done();resolve();}};
        const timer=setTimeout(()=>{done();reject(new Error('更新を適用できませんでした。学習ノートの別ウィンドウを閉じて再試行してください。'));},15000);workers.addEventListener('controllerchange',changed);changed();
      });
      // Saving again catches edits made while the new assets were downloading.
      await this.d.save();this.d.reload();
    }catch(error){this.set({status:'error',message:error instanceof Error?error.message:'更新できませんでした。再試行してください。'});}finally{this.applying=false;if(this.state.status==='applying')this.set({status:'available',available:true,message:'最新版への切り替えを開始しました。'});}
  }
}
