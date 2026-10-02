import {z} from 'zod';
const id=z.string().min(1).max(200),str=z.string().max(2000000),date=z.string().max(40),index=z.number().int().nonnegative(),unit=z.number().min(0).max(1),color=z.string().regex(/^#[\da-f]{3,8}$/i);
const record=z.record(z.string(),z.unknown());const list=<T extends z.ZodType>(item:T)=>z.array(item).max(200000);
const rect=z.tuple([z.number().finite(),z.number().finite(),z.number().finite(),z.number().finite()]);
export const manifestSchema=z.object({format:z.literal('study-notes'),schemaVersion:z.literal(1),scope:z.enum(['all','subjects']),exportedAt:date,pdfs:list(z.object({id,originalPath:z.string().max(1000),annotatedPath:z.string().max(1000)}))}).strict();
export const dataSchema=z.object({
  subjects:list(z.object({id,name:z.string().min(1).max(200),color,icon:z.string().max(80),order:index,exams:list(z.object({name:z.string().max(200),date})),createdAt:date})),
  notes:list(z.object({id,subjectId:id,title:z.string().min(1).max(500),sessionNumber:z.number().int().positive(),date:date.optional(),order:index,createdAt:date,updatedAt:date,lastOpenedAt:date.optional()})),
  pdfDocs:list(z.object({id,noteId:id,fileName:z.string().min(1).max(500),pages:z.array(z.union([z.object({kind:z.literal('pdf'),srcPage:z.number().int().positive()}),z.object({kind:z.enum(['blank','ruled','grid']),id:id.optional()})])).min(1).max(10000),textIndexed:z.boolean().optional(),extractedText:list(z.object({page:z.number().int().positive(),text:str,runs:list(z.object({text:str,rect})).optional()}))})),
  strokes:list(z.object({id,pdfDocId:id,pageIndex:index,tool:z.enum(['pen','highlighter']),color,width:z.number().positive().max(1),points:z.array(z.tuple([unit,unit,unit])).max(1000000),createdAt:z.number().finite().optional()})),
  textBoxes:list(z.object({id,pdfDocId:id,pageIndex:index,x:unit,y:unit,width:unit,height:unit,text:str,color,fontSize:z.number().positive().max(1)})),
  textNotes:list(z.object({id,noteId:id,content:record,plainText:str})),
  cards:list(z.object({id,noteId:id,kind:z.enum(['mask','mcq','short']),pdfDocId:id.optional(),pageIndex:index.optional(),rect:rect.optional(),strokeIds:list(id).optional(),question:str.optional(),choices:list(str).optional(),answer:str.optional(),explanation:str.optional(),sourcePage:index.optional(),sourcePageKey:id.optional(),fsrs:record,createdAt:date})),
  reviewLogs:list(z.object({id,cardId:id,rating:z.number().finite(),reviewedAt:date,previousFsrs:record.optional(),scheduleLog:record.optional()})),
  aiSummaries:list(z.object({id,noteId:id,points:list(str),terms:list(str),importedAt:date})),
  pageChecks:list(z.object({id,pdfDocId:id,pageIndex:index,checkedAt:date})),
  settings:list(z.object({id:z.literal('main'),maskColor:color,promptTemplate:str,lastExportAt:date.optional(),penPresets:list(z.object({color,width:z.number().positive()})),theme:z.enum(['light','dark'])})).max(1),
}).strict();
export type BackupData=z.infer<typeof dataSchema>;
export type Manifest=z.infer<typeof manifestSchema>;
export function validateReferences(data:BackupData){
  for(const [name,rows]of Object.entries(data)){const ids=rows.map(r=>r.id);if(new Set(ids).size!==ids.length)throw new Error(`${name}：IDが重複しています。`);}
  const subjects=new Set(data.subjects.map(s=>s.id)),notes=new Set(data.notes.map(n=>n.id)),docs=new Map(data.pdfDocs.map(d=>[d.id,d])),cards=new Set(data.cards.map(c=>c.id)),strokes=new Set(data.strokes.map(s=>s.id));
  const require=(ok:boolean,label:string)=>{if(!ok)throw new Error(`${label}：参照先が不正です。`);};
  data.notes.forEach(n=>require(subjects.has(n.subjectId),'授業'));data.pdfDocs.forEach(d=>require(notes.has(d.noteId),'PDF'));
  for(const row of [...data.strokes,...data.textBoxes,...data.pageChecks])require(!!docs.get(row.pdfDocId)&&row.pageIndex<docs.get(row.pdfDocId)!.pages.length,'ページ');
  for(const row of [...data.textNotes,...data.cards,...data.aiSummaries])require(notes.has(row.noteId),'ノート');
  data.cards.forEach(c=>{if(c.pdfDocId)require(docs.has(c.pdfDocId)&&(c.pageIndex===undefined||c.pageIndex<docs.get(c.pdfDocId)!.pages.length),'カード');if(c.strokeIds)require(c.strokeIds.every(s=>strokes.has(s)),'カードの手書き');});
  data.reviewLogs.forEach(r=>require(cards.has(r.cardId),'復習履歴'));
  require(new Set(data.textNotes.map(t=>t.noteId)).size===data.textNotes.length,'テキストノートの重複');require(new Set(data.pageChecks.map(t=>`${t.pdfDocId}:${t.pageIndex}`)).size===data.pageChecks.length,'確認済みページの重複');
  for(const note of data.textNotes)validateNotebook(note.content);
}
function validateNotebook(root:unknown){
  const allowed=new Set(['doc','paragraph','heading','text','bulletList','orderedList','listItem','taskList','taskItem','blockquote','codeBlock','hardBreak','horizontalRule','blockMath','inlineMath','pageLink']);let count=0;
  function visit(value:unknown,depth:number){if(++count>100000||depth>30||!value||typeof value!=='object')throw new Error('テキストノートの構造が不正です。');const node=value as Record<string,unknown>;if(typeof node.type!=='string'||!allowed.has(node.type))throw new Error('テキストノートに未対応の書式があります。');if(node.text!==undefined&&typeof node.text!=='string')throw new Error('本文が不正です。');if(node.content!==undefined){if(!Array.isArray(node.content))throw new Error('本文の構造が不正です。');node.content.forEach(n=>visit(n,depth+1));}if(node.attrs!==undefined&&(!node.attrs||typeof node.attrs!=='object'||Array.isArray(node.attrs)))throw new Error('書式が不正です。');}
  visit(root,0);
}
export function parseMetadata(manifest:unknown,data:unknown){
  try{const m=manifestSchema.parse(manifest),d=dataSchema.parse(data);validateReferences(d);return {manifest:m,data:d};}catch(e){if(e instanceof z.ZodError)throw new Error(`バックアップの形式が不正です：${e.issues.slice(0,3).map(i=>i.path.join('.')).join('、')}`);throw e;}
}
