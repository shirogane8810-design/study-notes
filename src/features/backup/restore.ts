import {db,type StudyDatabase} from '../../db/database';
import {deleteSubject} from '../notes/repository';
import type {PreparedBackup} from './archive';
import type {BackupData} from './schema';
export function mergeCopy(backup:PreparedBackup,order:number):PreparedBackup{
  const maps=new Map<string,Map<string,string>>();for(const[name,rows]of Object.entries(backup.data))maps.set(name,new Map(rows.map(r=>[r.id,crypto.randomUUID()])));
  const id=(table:string,value:string)=>maps.get(table)?.get(value)??value;
  const remapContent=(value:unknown):unknown=>{if(Array.isArray(value))return value.map(remapContent);if(!value||typeof value!=='object')return value;const node={...(value as Record<string,unknown>)};if(node.type==='pageLink'&&node.attrs&&typeof node.attrs==='object'){const a={...(node.attrs as Record<string,unknown>)};if(typeof a.pdfDocId==='string')a.pdfDocId=id('pdfDocs',a.pdfDocId);node.attrs=a;}if(node.content)node.content=remapContent(node.content);return node;};
  const data:BackupData={...backup.data,subjects:backup.data.subjects.map((s,i)=>({...s,id:id('subjects',s.id),order:order+i})),notes:backup.data.notes.map(n=>({...n,id:id('notes',n.id),subjectId:id('subjects',n.subjectId)})),pdfDocs:backup.data.pdfDocs.map(d=>({...d,id:id('pdfDocs',d.id),noteId:id('notes',d.noteId)})),strokes:backup.data.strokes.map(s=>({...s,id:id('strokes',s.id),pdfDocId:id('pdfDocs',s.pdfDocId)})),textBoxes:backup.data.textBoxes.map(s=>({...s,id:id('textBoxes',s.id),pdfDocId:id('pdfDocs',s.pdfDocId)})),textNotes:backup.data.textNotes.map(n=>({...n,id:id('textNotes',n.id),noteId:id('notes',n.noteId),content:remapContent(n.content) as Record<string,unknown>})),cards:backup.data.cards.map(c=>({...c,id:id('cards',c.id),noteId:id('notes',c.noteId),pdfDocId:c.pdfDocId?id('pdfDocs',c.pdfDocId):undefined,strokeIds:c.strokeIds?.map(s=>id('strokes',s))})),reviewLogs:backup.data.reviewLogs.map(r=>({...r,id:id('reviewLogs',r.id),cardId:id('cards',r.cardId)})),aiSummaries:backup.data.aiSummaries.map(a=>({...a,id:id('aiSummaries',a.id),noteId:id('notes',a.noteId)})),pageChecks:backup.data.pageChecks.map(p=>({...p,id:id('pageChecks',p.id),pdfDocId:id('pdfDocs',p.pdfDocId)})),settings:[]};
  return {...backup,data,pdfs:backup.pdfs.map(p=>({...p,id:id('pdfDocs',p.id),noteId:id('notes',p.noteId)}))};
}
export async function restore(backup:PreparedBackup,mode:'merge'|'replace',database:StudyDatabase=db){
  await database.transaction('rw',database.tables,async()=>{
    let incoming=backup;
    if(mode==='merge'){const last=await database.subjects.orderBy('order').last();incoming=mergeCopy(backup,(last?.order??-1)+1);}
    else if(backup.manifest.scope==='all'){for(const table of database.tables)await table.clear();}
    else {for(const subject of backup.data.subjects)await deleteSubject(subject.id,database);const ids=new Set<string>();for(const[name,rows]of Object.entries(backup.data)){if(name==='settings')continue;for(const row of rows){if(await database.table(name).get(row.id))ids.add(row.id);}}if(ids.size)throw new Error('別の科目とIDが衝突しています。「マージ（追加）」で復元してください。');}
    for(const[name,rows]of Object.entries(incoming.data)){if(name==='pdfDocs'||(name==='settings'&&backup.manifest.scope!=='all'))continue;await database.table(name).bulkPut(rows);}
    await database.pdfDocs.bulkPut(incoming.pdfs);
  });
}
export function backupDue(lastExportAt:string|undefined,now=Date.now()){const time=lastExportAt?Date.parse(lastExportAt):NaN;return !Number.isFinite(time)||now-time>=7*86400000;}
