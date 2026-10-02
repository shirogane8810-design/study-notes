import {it,expect} from 'vitest';
import {PDFDocument} from 'pdf-lib';
import {zipSync,strToU8,unzipSync,strFromU8} from 'fflate';
import {StudyDatabase} from '../../db/database';
import {snapshot,createArchive,readArchive} from './archive';
import {restore,backupDue} from './restore';
import {safeName,markdown} from './markdown';
import {parseMetadata} from './schema';
async function fixture(){
  const database=new StudyDatabase(crypto.randomUUID());const pdf=await PDFDocument.create();pdf.addPage([595,842]);const bytes=await pdf.save();
  await database.subjects.put({id:'s',name:'数学/第1',icon:'📐',color:'#2563eb',order:0,exams:[],createdAt:'2026-10-02'});
  await database.notes.put({id:'n',subjectId:'s',title:'一次関数',sessionNumber:1,order:0,createdAt:'2026-10-02',updatedAt:'2026-10-02'});
  await database.pdfDocs.put({id:'p',noteId:'n',fileName:'資料.pdf',blob:new Blob([new Uint8Array(bytes)]),pages:[{kind:'grid',id:'g'},{kind:'pdf',srcPage:1}],textIndexed:true,extractedText:[{page:1,text:'一次関数'}]});
  await database.strokes.put({id:'stroke',pdfDocId:'p',pageIndex:1,tool:'pen',color:'#172033',width:.01,points:[[.1,.2,.5]]});
  await database.textBoxes.put({id:'box',pdfDocId:'p',pageIndex:1,x:.1,y:.2,width:.3,height:.2,text:'注釈',color:'#172033',fontSize:.03});
  await database.textNotes.put({id:'t',noteId:'n',content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'要点'},{type:'pageLink',attrs:{pdfDocId:'p',pageKey:'pdf:1',pageIndex:1,label:'p.2'}}]}]},plainText:'要点p.2'});
  await database.cards.put({id:'c',noteId:'n',kind:'mask',pdfDocId:'p',pageIndex:1,strokeIds:['stroke'],fsrs:{due:'2026-10-03'},createdAt:'2026-10-02'});
  await database.reviewLogs.put({id:'r',cardId:'c',rating:3,reviewedAt:'2026-10-02'});await database.pageChecks.put({id:'check',pdfDocId:'p',pageIndex:1,checkedAt:'2026-10-02'});
  await database.settings.put({id:'main',theme:'dark',maskColor:'#ef4444',promptTemplate:'テンプレート',penPresets:[]});
  return {database,bytes};
}
it('ZIPに読みやすい資料と復元データを格納し、全データを復元する',async()=>{
  const {database,bytes}=await fixture(),dest=new StudyDatabase(crypto.randomUUID());const s=await snapshot(undefined,database),archive=await createArchive(s,()=>{},async()=>bytes);const files=unzipSync(archive);
  expect(Object.keys(files).some(n=>n.includes('数学_第1_s/第1回_一次関数_n/')&&n.endsWith('書き込みPDF.pdf'))).toBe(true);expect(strFromU8(files[Object.keys(files).find(n=>n.endsWith('.md'))!])).toContain('要点');
  const parsed=await readArchive(archive);await restore(parsed,'replace',dest);expect(await dest.notes.toArray()).toEqual(s.data.notes);expect(await dest.textBoxes.toArray()).toEqual(s.data.textBoxes);expect(await dest.reviewLogs.count()).toBe(1);expect((await dest.pdfDocs.get('p'))?.pages).toEqual(s.pdfs[0].pages);expect(new Uint8Array(await (await dest.pdfDocs.get('p'))!.blob.arrayBuffer())).toEqual(bytes);expect((await dest.settings.get('main'))?.theme).toBe('dark');await database.delete();await dest.delete();
});
it('マージは既存を残し、PDFリンク・手書き・カード参照を新IDに揃える',async()=>{
  const {database,bytes}=await fixture();const backup=await readArchive(await createArchive(await snapshot(undefined,database),()=>{},async()=>bytes));await restore(backup,'merge',database);
  expect(await database.subjects.count()).toBe(2);expect(await database.notes.count()).toBe(2);const note=(await database.notes.toArray()).find(n=>n.id!=='n')!,doc=(await database.pdfDocs.toArray()).find(d=>d.id!=='p')!,text=(await database.textNotes.toArray()).find(t=>t.noteId===note.id)!;
  expect(JSON.stringify(text.content)).toContain(doc.id);const card=(await database.cards.toArray()).find(c=>c.id!=='c')!,stroke=(await database.strokes.toArray()).find(s=>s.id!=='stroke')!;expect(card.strokeIds).toEqual([stroke.id]);expect(stroke.pdfDocId).toBe(doc.id);expect((await database.settings.get('main'))?.theme).toBe('dark');await database.delete();
});
it('科目別上書きは対象だけを復元し、不正なZIPは変更せず拒否する',async()=>{
  const {database,bytes}=await fixture();await database.subjects.put({id:'other',name:'英語',color:'#2563eb',icon:'📘',order:1,exams:[],createdAt:'2026-10-02'});const backup=await readArchive(await createArchive(await snapshot('s',database),()=>{},async()=>bytes));await database.notes.update('n',{title:'変更'});await restore(backup,'replace',database);expect((await database.notes.get('n'))?.title).toBe('一次関数');expect(await database.subjects.get('other')).toBeDefined();expect((await database.settings.get('main'))?.theme).toBe('dark');
  expect(()=>parseMetadata({...backup.manifest,schemaVersion:99},backup.data)).toThrow();expect(()=>parseMetadata(backup.manifest,{...backup.data,strokes:[{...backup.data.strokes[0],pageIndex:9}]})).toThrow();
  await expect(readArchive(zipSync({'../data.json':strToU8('{}')}))).rejects.toThrow();await expect(readArchive(zipSync({'manifest.json':strToU8('{}')}))).rejects.toThrow();expect(await database.subjects.count()).toBe(2);await database.delete();
});
it('失敗した復元トランザクションは削除をロールバックする',async()=>{
  const {database,bytes}=await fixture();const backup=await readArchive(await createArchive(await snapshot('s',database),()=>{},async()=>bytes));await database.notes.put({id:'collision',subjectId:'else',title:'保持',sessionNumber:1,order:0,createdAt:'2026-10-02',updatedAt:'2026-10-02'});backup.data.notes[0].id='collision';await expect(restore(backup,'replace',database)).rejects.toThrow('衝突');expect(await database.subjects.get('s')).toBeDefined();expect((await database.notes.get('collision'))?.title).toBe('保持');expect(await database.strokes.count()).toBe(1);await database.delete();
});
it('バックアップの7日境界とファイル名・Markdownを扱う',()=>{
  const now=Date.parse('2026-10-09T00:00:00Z');expect(backupDue(undefined,now)).toBe(true);expect(backupDue('2026-10-02T00:00:00Z',now)).toBe(true);expect(backupDue('2026-10-02T00:00:01Z',now)).toBe(false);expect(safeName('../数学:資料')).not.toMatch(/[/:]|\.\./);expect(markdown({type:'blockMath',attrs:{latex:'x^2'}})).toContain('$$\nx^2\n$$');
});
