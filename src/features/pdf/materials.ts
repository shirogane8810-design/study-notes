import {db,type StudyDatabase} from '../../db/database';
import type {PdfDoc} from '../../db/models';
export function orderedMaterials(docs:PdfDoc[]){return docs.map((doc,index)=>({doc,index})).sort((a,b)=>(a.doc.order??a.index)-(b.doc.order??b.index)||a.index-b.index).map(v=>v.doc);}
export async function renameMaterial(id:string,name:string,database:StudyDatabase=db){
  const fileName=name.trim();if(!fileName||fileName.length>500)throw new Error('資料名は1〜500文字で入力してください。');
  await database.transaction('rw',database.pdfDocs,database.notes,async()=>{const doc=await database.pdfDocs.get(id);if(!doc)throw new Error('資料が見つかりません。');await database.pdfDocs.update(id,{fileName});await database.notes.update(doc.noteId,{updatedAt:new Date().toISOString()});});
}
export async function trashMaterial(id:string,trashed:boolean,database:StudyDatabase=db){
  await database.transaction('rw',database.pdfDocs,database.notes,async()=>{const doc=await database.pdfDocs.get(id);if(!doc)throw new Error('資料が見つかりません。');await database.pdfDocs.update(id,{trashedAt:trashed?new Date().toISOString():undefined});await database.notes.update(doc.noteId,{updatedAt:new Date().toISOString()});});
}
export async function reorderMaterials(noteId:string,ids:string[],database:StudyDatabase=db){
  await database.transaction('rw',database.pdfDocs,database.notes,async()=>{const docs=(await database.pdfDocs.where('noteId').equals(noteId).toArray()).filter(d=>!d.trashedAt);if(new Set(ids).size!==ids.length||ids.length!==docs.length||ids.some(id=>!docs.some(d=>d.id===id)))throw new Error('資料の並び順が不正です。');for(const [order,id]of ids.entries())await database.pdfDocs.update(id,{order});await database.notes.update(noteId,{updatedAt:new Date().toISOString()});});
}
