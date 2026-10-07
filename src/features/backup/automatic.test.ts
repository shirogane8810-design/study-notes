import {expect,it} from 'vitest';
import {StudyDatabase} from '../../db/database';
import {snapshot} from './archive';
import {SafetyDatabase,storeCheckpoint,snapshotSignature,writeFolderBackup,type BackupFolder} from './automatic';
it('自動復元ポイントは3回分を保持し、元の学習データを書き換えない',async()=>{
  const study=new StudyDatabase(crypto.randomUUID()),safety=new SafetyDatabase(crypto.randomUUID());
  try{await study.subjects.put({id:'s',name:'保持',icon:'📘',color:'#2563eb',order:0,exams:[],createdAt:'2026-10-07'});
    for(let n=0;n<4;n++){await study.subjects.update('s',{name:'保持'+n});const s=await snapshot(undefined,study);await storeCheckpoint(s,await snapshotSignature(s),safety);await new Promise(r=>setTimeout(r,2));}
    const records=await safety.checkpoints.orderBy('createdAt').toArray();expect(records).toHaveLength(3);expect(records.map(r=>r.snapshot.data.subjects[0].name)).toEqual(['保持1','保持2','保持3']);expect((await study.subjects.get('s'))?.name).toBe('保持3');
    const s=await snapshot(undefined,study),signature=await snapshotSignature(s);s.data.subjects[0].name='変更';expect(await snapshotSignature(s)).not.toBe(signature);
  }finally{await study.delete();await safety.delete();}
});
it('フォルダ保存は書き込み完了後に閉じ、失敗時は中止して成功扱いしない',async()=>{
  const calls:string[]=[],folder:BackupFolder={name:'test',queryPermission:async()=>'granted',requestPermission:async()=>'granted',getFileHandle:async()=>({createWritable:async()=>({write:async(blob)=>{expect(blob.type).toBe('application/zip');calls.push('write');},close:async()=>{calls.push('close');},abort:async()=>{calls.push('abort');}})})};
  await writeFolderBackup(folder,'backup.zip',new Uint8Array([1,2]));expect(calls).toEqual(['write','close']);
  folder.getFileHandle=async()=>({createWritable:async()=>({write:async()=>{throw new Error('容量不足');},close:async()=>{calls.push('wrong');},abort:async()=>{calls.push('abort');}})});
  await expect(writeFolderBackup(folder,'backup.zip',new Uint8Array([1]))).rejects.toThrow('容量不足');expect(calls).toEqual(['write','close','abort']);
});
