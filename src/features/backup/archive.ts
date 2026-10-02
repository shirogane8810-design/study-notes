import {strToU8,strFromU8,zip,unzip,unzipSync,type AsyncZippable} from 'fflate';
import {db,type StudyDatabase} from '../../db/database';
import type {PdfDoc,Stroke,TextBox} from '../../db/models';
import {dataSchema,parseMetadata,type BackupData,type Manifest} from './schema';
import {markdown,safeName} from './markdown';
export interface Snapshot {data:BackupData;pdfs:PdfDoc[];scope:Manifest['scope']}
export interface PreparedBackup {data:BackupData;manifest:Manifest;pdfs:PdfDoc[]}
export async function snapshot(subjectId?:string,database:StudyDatabase=db):Promise<Snapshot>{
  return database.transaction('r',database.tables,async()=>{
    const subjects=subjectId?await database.subjects.where('id').equals(subjectId).toArray():await database.subjects.toArray();if(subjectId&&!subjects.length)throw new Error('科目が見つかりません。');
    const subjectIds=new Set(subjects.map(s=>s.id)),notes=(await database.notes.toArray()).filter(n=>subjectIds.has(n.subjectId)),noteIds=new Set(notes.map(n=>n.id));
    const pdfs=(await database.pdfDocs.toArray()).filter(d=>noteIds.has(d.noteId)),pdfIds=new Set(pdfs.map(p=>p.id));const cards=(await database.cards.toArray()).filter(c=>noteIds.has(c.noteId)),cardIds=new Set(cards.map(c=>c.id));
    const data=dataSchema.parse({subjects,notes,pdfDocs:pdfs.map(({blob:_,...p})=>p),strokes:(await database.strokes.toArray()).filter(s=>pdfIds.has(s.pdfDocId)),textBoxes:(await database.textBoxes.toArray()).filter(s=>pdfIds.has(s.pdfDocId)),textNotes:(await database.textNotes.toArray()).filter(s=>noteIds.has(s.noteId)),cards,reviewLogs:(await database.reviewLogs.toArray()).filter(r=>cardIds.has(r.cardId)),aiSummaries:(await database.aiSummaries.toArray()).filter(s=>noteIds.has(s.noteId)),pageChecks:(await database.pageChecks.toArray()).filter(s=>pdfIds.has(s.pdfDocId)),settings:subjectId?[]:await database.settings.toArray()});
    return {data,pdfs,scope:subjectId?'subjects':'all'};
  });
}
type Renderer=(doc:PdfDoc,strokes:Stroke[],boxes:TextBox[],progress:(page:number,total:number)=>void)=>Promise<Uint8Array>;
export async function createArchive(s:Snapshot,progress:(text:string)=>void,render?:Renderer){
  const renderer=render??(await import('../pdf/export-pdf')).exportPdf;const files:AsyncZippable={};const manifest:Manifest={format:'study-notes',schemaVersion:1,scope:s.scope,exportedAt:new Date().toISOString(),pdfs:[]};let size=0;
  const add=(name:string,bytes:Uint8Array,level:0|6=6)=>{if(!safePath(name))throw new Error('バックアップのファイル名が長すぎるか不正です。');size+=bytes.length;if(size>512*1024*1024)throw new Error('バックアップが512MBを超えます。科目ごとに保存してください。');files[name]=[bytes,{level}];};
  const folders=new Map(s.data.subjects.map(subject=>[subject.id,`${safeName(subject.name)}_${encodeURIComponent(subject.id)}/`]));
  for(const subject of s.data.subjects)add(folders.get(subject.id)+'科目情報.json',strToU8(JSON.stringify(subject,null,2)));
  for(const note of [...s.data.notes].sort((a,b)=>a.order-b.order)){
    const folder=`${folders.get(note.subjectId)}第${note.sessionNumber}回_${safeName(note.title)}_${encodeURIComponent(note.id)}/`;
    add(folder+'授業情報.json',strToU8(JSON.stringify(note,null,2)));const text=s.data.textNotes.find(t=>t.noteId===note.id);add(folder+'テキストノート.md',strToU8(`# ${note.title}\n\n${text?markdown(text.content):''}`));
    for(const doc of s.pdfs.filter(d=>d.noteId===note.id)){
      const path=`${folder}${safeName(doc.fileName.replace(/\.pdf$/i,''))}_${encodeURIComponent(doc.id)}/`,originalPath=path+'元PDF.pdf',annotatedPath=path+'書き込みPDF.pdf';
      progress(`${doc.fileName}：元PDFを格納`);add(originalPath,new Uint8Array(await doc.blob.arrayBuffer()),0);
      const bytes=await renderer(doc,s.data.strokes.filter(p=>p.pdfDocId===doc.id),s.data.textBoxes.filter(p=>p.pdfDocId===doc.id),(n,total)=>progress(`${doc.fileName}：書き込みPDF ${n}/${total}`));add(annotatedPath,bytes,0);manifest.pdfs.push({id:doc.id,originalPath,annotatedPath});
    }
  }
  add('data.json',strToU8(JSON.stringify(s.data)));add('manifest.json',strToU8(JSON.stringify(manifest,null,2)));add('バックアップの説明.txt',strToU8('学習ノートのバックアップです。アプリの「バックアップ」からZIPを選ぶと復元できます。元PDF・書き込みPDF・テキストノート.mdは、解凍して閲覧できます。data.jsonとmanifest.jsonは編集せず保管してください。'));
  progress('ZIPを作成しています…');return await new Promise<Uint8Array>((resolve,reject)=>zip(files,{level:6},(e,out)=>e?reject(e):resolve(out)));
}
export function safePath(path:string){return path.length<1000&&!path.startsWith('/')&&!path.includes('\\')&&!path.includes(':')&&path.split('/').every(p=>p!=='.'&&p!=='..'&&p.length>0);}
export function archiveEntries(bytes:Uint8Array){const entries:{name:string;size:number}[]=[];unzipSync(bytes,{filter:file=>{entries.push({name:file.name,size:file.originalSize});return false;}});return entries;}
export async function readArchive(bytes:Uint8Array):Promise<PreparedBackup>{
  if(bytes.length>250*1024*1024)throw new Error('ZIPは250MB以下にしてください。');let total=0,count=0;const names=new Set<string>();
  const files=await new Promise<Record<string,Uint8Array>>((resolve,reject)=>{try{unzip(bytes,{filter:f=>{if(!safePath(f.name)||names.has(f.name))throw new Error('ZIPに不正・重複したパスがあります。');names.add(f.name);total+=f.originalSize;if(++count>10000||total>512*1024*1024||f.originalSize>150*1024*1024)throw new Error('ZIPの展開サイズが上限を超えています。');const metadata=f.name==='manifest.json'||f.name==='data.json';if(metadata&&f.originalSize>50*1024*1024)throw new Error('データJSONが大きすぎます。');return metadata||f.name.endsWith('/元PDF.pdf');}},(e,out)=>e?reject(new Error('ZIPを読み込めません。破損していないバックアップを選んでください。')):resolve(out));}catch(e){reject(e);}});
  if(!files['manifest.json']||!files['data.json'])throw new Error('学習ノートのバックアップではありません。');let parsed:ReturnType<typeof parseMetadata>;
  try{parsed=parseMetadata(JSON.parse(strFromU8(files['manifest.json'])),JSON.parse(strFromU8(files['data.json'])));}catch(e){throw e instanceof SyntaxError?new Error('バックアップのJSONが壊れています。'):e;}
  const {manifest,data}=parsed;if(new Set(manifest.pdfs.map(p=>p.id)).size!==manifest.pdfs.length||manifest.pdfs.length!==data.pdfDocs.length)throw new Error('PDF一覧が一致しません。');
  const {PDFDocument}=await import('pdf-lib');const pdfs:PdfDoc[]=[];
  for(const doc of data.pdfDocs){const entry=manifest.pdfs.find(p=>p.id===doc.id);if(!entry||!safePath(entry.originalPath)||!safePath(entry.annotatedPath)||!entry.originalPath.endsWith('/元PDF.pdf'))throw new Error('PDFのパスが不正です。');const original=files[entry.originalPath];if(!original||!strFromU8(original.subarray(0,1024)).includes('%PDF-'))throw new Error(`元PDFが不足・不正です：${doc.fileName}`);let pages:number;try{pages=(await PDFDocument.load(original)).getPageCount();}catch{throw new Error(`元PDFが壊れているか暗号化されています：${doc.fileName}`);}if(doc.pages.some(p=>p.kind==='pdf'&&p.srcPage>pages))throw new Error('PDFのページ参照が範囲外です。');pdfs.push({...doc,blob:new Blob([new Uint8Array(original)],{type:'application/pdf'})});}
  return {data,manifest,pdfs};
}
