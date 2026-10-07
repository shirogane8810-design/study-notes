import Dexie,{type EntityTable} from 'dexie';
import {snapshot,createArchive,type Snapshot} from './archive';
import {flushAllStrokes} from '../pdf/autosave';
import {db} from '../../db/database';
export interface BackupFolder {
  name:string;
  queryPermission:(options:{mode:'readwrite'})=>Promise<PermissionState>;
  requestPermission:(options:{mode:'readwrite'})=>Promise<PermissionState>;
  getFileHandle:(name:string,options:{create:true})=>Promise<{createWritable:()=>Promise<{write:(data:Blob)=>Promise<void>;close:()=>Promise<void>;abort:()=>Promise<void>}>}>;
}
export const directoryPicker=typeof window==='undefined'?undefined:(window as Window&{showDirectoryPicker?:(options:{mode:'readwrite';id:string})=>Promise<BackupFolder>}).showDirectoryPicker?.bind(window);
export interface Checkpoint {id:string;createdAt:string;signature:string;snapshot:Snapshot}
export interface AutoPreferences {id:'main';enabled:boolean;folder?:BackupFolder;folderId?:string;installationId:string;generation:number;folderSignature?:string;folderSavedAt?:string}
export class SafetyDatabase extends Dexie {
  checkpoints!:EntityTable<Checkpoint,'id'>;preferences!:EntityTable<AutoPreferences,'id'>;
  constructor(name='study-notes-safety'){super(name);this.version(1).stores({checkpoints:'id,createdAt',preferences:'id'});}
}
export const safety=new SafetyDatabase();
export async function autoPreferences(database:SafetyDatabase=safety){return await database.preferences.get('main')??{id:'main' as const,enabled:true,installationId:crypto.randomUUID(),generation:0};}
export async function snapshotSignature(s:Snapshot){
  const data={...s.data,notes:s.data.notes.map(({lastOpenedAt:_,...note})=>note),settings:s.data.settings.map(({lastExportAt:_,...settings})=>settings)};
  const bytes=new TextEncoder().encode(JSON.stringify(data));const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function storeCheckpoint(s:Snapshot,signature:string,database:SafetyDatabase=safety){
  const record:Checkpoint={id:crypto.randomUUID(),createdAt:new Date().toISOString(),signature,snapshot:s};
  await database.transaction('rw',database.checkpoints,async()=>{await database.checkpoints.put(record);const records=await database.checkpoints.orderBy('createdAt').reverse().toArray();await database.checkpoints.bulkDelete(records.slice(3).map(r=>r.id));});return record;
}
export async function writeFolderBackup(folder:BackupFolder,name:string,bytes:Uint8Array){
  const handle=await folder.getFileHandle(name,{create:true}),stream=await handle.createWritable();
  try{await stream.write(new Blob([new Uint8Array(bytes)],{type:'application/zip'}));await stream.close();}catch(e){await stream.abort().catch(()=>{});throw e;}
}
let running:Promise<string>|undefined;
export async function waitAutomaticBackup(){await running;}
export function automaticBackup(force=false):Promise<string>{
  if(running)return running;
  const run=async():Promise<string>=>{
    const preferences=await autoPreferences();if(!preferences.enabled&&!force)return '自動バックアップは停止中です。';
    await flushAllStrokes();const s=await snapshot();if(!s.data.subjects.length)return '科目を追加すると自動バックアップが始まります。';
    const signature=await snapshotSignature(s),latest=await safety.checkpoints.orderBy('createdAt').last();
    if(force||latest?.signature!==signature)await storeCheckpoint(s,signature);
    if(preferences.folder&&(force||preferences.folderSignature!==signature)){
      if(await preferences.folder.queryPermission({mode:'readwrite'})!=='granted')return 'ブラウザ内に保存済み。フォルダ保存は「保存を再許可」を押してください。';
      const bytes=await createArchive(s,()=>{}),generation=preferences.generation+1;
      await writeFolderBackup(preferences.folder,`学習ノート_自動_${preferences.installationId}_${generation%3+1}.zip`,bytes);
      const current=await autoPreferences();if(current.folder&&current.folderId===preferences.folderId&&current.installationId===preferences.installationId)await safety.preferences.put({...current,generation,folderSignature:signature,folderSavedAt:new Date().toISOString()});
      const settings=await db.settings.get('main');if(settings)await db.settings.update('main',{lastExportAt:new Date().toISOString()});else await db.settings.put({id:'main',theme:'light',maskColor:'#ef4444',promptTemplate:'',penPresets:[],lastExportAt:new Date().toISOString()});
      return 'ブラウザ内と指定フォルダにバックアップしました。';
    }
    return latest?.signature===signature&&!force?'変更なし · バックアップは最新です。':'ブラウザ内に復元ポイントを保存しました。';
  };
  running=(async()=>{if(typeof navigator!=='undefined'&&navigator.locks)return await navigator.locks.request('study-notes-automatic-backup',{ifAvailable:true},async lock=>lock?await run():'別のウィンドウでバックアップ中です。');return await run();})().finally(()=>{running=undefined;});return running;
}
