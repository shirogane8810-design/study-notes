import {describe,it,expect,vi,afterEach} from 'vitest';
import {UpdateController,parseRelease,waitForWorker} from './controller';
class Worker extends EventTarget {
  state:ServiceWorkerState='installed';postMessage=vi.fn();
  asWorker(){return this as unknown as ServiceWorker;}
}
function setup(current='old'){
  const worker=new Worker(),registration=Object.assign(new EventTarget(),{waiting:worker.asWorker() as ServiceWorker|null,active:null as ServiceWorker|null,installing:null as ServiceWorker|null,update:vi.fn(async()=>{})});
  const workers=Object.assign(new EventTarget(),{controller:null as ServiceWorker|null,register:vi.fn(async()=>registration as unknown as ServiceWorkerRegistration)});
  const release=vi.fn(async()=>parseRelease({app:'study-notes',id:'new',builtAt:'2026-10-09T08:00:00Z'})),save=vi.fn(async()=>{}),reload=vi.fn(),workerBuild=vi.fn(async()=> 'new');
  worker.postMessage.mockImplementation(()=>{registration.waiting=null;worker.state='activated';registration.active=worker.asWorker();workers.controller=worker.asWorker();worker.dispatchEvent(new Event('statechange'));workers.dispatchEvent(new Event('controllerchange'));});
  const controller=new UpdateController({workers:workers as unknown as ServiceWorkerContainer,url:'https://example.com/study-notes/sw.js',scope:'/study-notes/',current,online:()=>true,release,workerBuild,save,reload});
  return {controller,worker,workers,registration,release,save,reload,workerBuild};
}
afterEach(()=>vi.useRealTimers());
describe('PWA updates',()=>{
  it('起動前から待機中の更新を見逃さず、通知を購読前の状態にも保持する',async()=>{
    const s=setup();await s.controller.start();expect(s.controller.snapshot().available).toBe(true);const notice=vi.fn();s.controller.subscribe(notice);await s.controller.check();expect(notice).toHaveBeenCalled();expect(s.workers.register).toHaveBeenCalledWith('https://example.com/study-notes/sw.js',{scope:'/study-notes/',updateViaCache:'none'});
  });
  it('保存・有効化・版の照合を完了した後にだけ再読み込みする',async()=>{
    const s=setup();await s.controller.check();await s.controller.apply();expect(s.save).toHaveBeenCalledTimes(2);expect(s.worker.postMessage).toHaveBeenCalledWith({type:'SKIP_WAITING'});expect(s.reload).toHaveBeenCalledTimes(1);expect(s.save.mock.invocationCallOrder[0]).toBeLessThan(s.worker.postMessage.mock.invocationCallOrder[0]);expect(s.workerBuild.mock.invocationCallOrder[0]).toBeLessThan(s.reload.mock.invocationCallOrder[0]);
  });
  it('保存失敗時は有効化も再読み込みも行わない',async()=>{
    const s=setup();s.save.mockRejectedValue(new Error('quota'));await s.controller.apply();expect(s.worker.postMessage).not.toHaveBeenCalled();expect(s.reload).not.toHaveBeenCalled();expect(s.controller.snapshot().message).toContain('保存できません');
  });
  it('他のウィンドウで有効化されても自動再読み込みせず、明示操作で適用する',async()=>{
    const s=setup();await s.controller.start();s.registration.waiting=null;s.registration.active=s.worker.asWorker();s.workers.controller=s.worker.asWorker();s.workers.dispatchEvent(new Event('controllerchange'));await Promise.resolve();expect(s.controller.snapshot().available).toBe(true);expect(s.reload).not.toHaveBeenCalled();await s.controller.apply();expect(s.reload).toHaveBeenCalledTimes(1);
  });
  it('公開版と有効なキャッシュの版が違う場合は再読み込みを止める',async()=>{
    const s=setup();s.workerBuild.mockResolvedValue('stale');await s.controller.apply();expect(s.reload).not.toHaveBeenCalled();expect(s.controller.snapshot().status).toBe('error');expect(s.controller.snapshot().message).toContain('準備');
  });
  it('初回インストールの同じ版を更新と誤認しない',async()=>{
    const s=setup('new');s.registration.waiting=null;await s.controller.start();s.workers.controller=s.worker.asWorker();s.workers.dispatchEvent(new Event('controllerchange'));await Promise.resolve();await s.controller.check();expect(s.controller.snapshot().status).toBe('current');expect(s.controller.snapshot().available).toBe(false);
  });
  it('インストールの中断とタイムアウトを扱い、他画面で既に有効化されていても待ち続けない',async()=>{
    vi.useFakeTimers();const worker=new Worker();worker.state='installing';const result=waitForWorker(worker.asWorker(),'installed',100).catch(e=>e);await vi.advanceTimersByTimeAsync(101);expect(await result).toBeInstanceOf(Error);worker.state='redundant';await expect(waitForWorker(worker.asWorker(),'installed')).rejects.toThrow('中断');worker.state='activated';await expect(waitForWorker(worker.asWorker(),'installed')).resolves.toBeUndefined();
  });
  it('ネット接続不可や不正な公開情報で既存画面を維持する',async()=>{
    const reload=vi.fn(),release=vi.fn();const controller=new UpdateController({url:'sw.js',scope:'/',current:'old',online:()=>false,release,workerBuild:vi.fn(),save:async()=>{},reload});await controller.check();expect(controller.snapshot().status).toBe('offline');expect(release).not.toHaveBeenCalled();expect(reload).not.toHaveBeenCalled();expect(()=>parseRelease({app:'other',id:'new',builtAt:'not a date'})).toThrow();
  });
});
