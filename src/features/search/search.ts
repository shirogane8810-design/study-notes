import type {Note,PdfDoc,TextNote} from '../../db/models';
import {pageKey,type PageTarget} from '../notes/page-links';
export interface SearchHit {noteId:string;kind:'title'|'note'|'pdf';snippet:string;target?:PageTarget}
export const normalized=(value:string)=>value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim();
export function snippet(text:string,query:string){const at=normalized(text).indexOf(normalized(query));return text.slice(Math.max(0,at-30),Math.max(0,at-30)+150);}
export function findNotes(query:string,notes:Note[],textNotes:TextNote[],docs:PdfDoc[]):SearchHit[]{
  const q=normalized(query);if(!q)return [];const hits:SearchHit[]=[];
  for(const note of notes){if(normalized(note.title).includes(q))hits.push({noteId:note.id,kind:'title',snippet:note.title});const text=textNotes.find(t=>t.noteId===note.id);if(text&&normalized(text.plainText).includes(q))hits.push({noteId:note.id,kind:'note',snippet:snippet(text.plainText,query)});}
  for(const doc of docs)for(const text of doc.extractedText){if(!normalized(text.text).includes(q))continue;const index=doc.pages.findIndex(p=>p.kind==='pdf'&&p.srcPage===text.page);if(index>=0)hits.push({noteId:doc.noteId,kind:'pdf',snippet:snippet(text.text,query),target:{pdfDocId:doc.id,pageKey:pageKey(doc.pages[index],index),pageIndex:index,query}});}
  return hits;
}
export function matchingRuns(runs:{text:string;rect:[number,number,number,number]}[],query:string){const q=normalized(query);if(!q)return [];return runs.filter(r=>{const text=normalized(r.text);return text&&(text.includes(q)||q.includes(text));});}
