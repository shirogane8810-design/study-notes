import { db, type StudyDatabase } from '../../db/database';
import type { Subject,Note } from '../../db/models';
export async function saveSubject(input:Pick<Subject,'name'|'color'|'icon'> & {id?:string}, database:StudyDatabase=db){
  const name=input.name.trim(); if(!name) throw new Error('科目名を入力してください。');
  if(input.id){await database.subjects.update(input.id,{name,color:input.color,icon:input.icon});return input.id;}
  const last=await database.subjects.orderBy('order').last(); const id=crypto.randomUUID();
  await database.subjects.add({id,name,color:input.color,icon:input.icon,order:(last?.order??-1)+1,exams:[],createdAt:new Date().toISOString()}); return id;
}
export async function saveNote(input:Pick<Note,'subjectId'|'title'|'sessionNumber'|'date'> & {id?:string},database:StudyDatabase=db){
  const title=input.title.trim();if(!title)throw new Error('授業のタイトルを入力してください。');
  if(!Number.isInteger(input.sessionNumber)||input.sessionNumber<1)throw new Error('授業回は1以上の整数にしてください。');
  const now=new Date().toISOString();
  return database.transaction('rw',database.subjects,database.notes,async()=>{
    if(!await database.subjects.get(input.subjectId))throw new Error('科目が見つかりません。');
    if(input.id){await database.notes.update(input.id,{title,sessionNumber:input.sessionNumber,date:input.date,updatedAt:now});return input.id;}
    const notes=await database.notes.where('subjectId').equals(input.subjectId).toArray();const id=crypto.randomUUID();
    await database.notes.add({id,subjectId:input.subjectId,title,sessionNumber:input.sessionNumber,date:input.date,order:Math.max(-1,...notes.map(n=>n.order))+1,createdAt:now,updatedAt:now});return id;
  });
}
async function cascadeNotes(noteIds:string[],database:StudyDatabase){
  const pdfs=await database.pdfDocs.where('noteId').anyOf(noteIds).toArray();const pdfIds=pdfs.map(p=>p.id);
  const cards=await database.cards.where('noteId').anyOf(noteIds).toArray();
  await database.reviewLogs.where('cardId').anyOf(cards.map(c=>c.id)).delete();
  await database.textBoxes.where('pdfDocId').anyOf(pdfIds).delete();await database.strokes.where('pdfDocId').anyOf(pdfIds).delete();await database.pageChecks.where('pdfDocId').anyOf(pdfIds).delete();
  await database.pdfDocs.bulkDelete(pdfIds);await database.textNotes.where('noteId').anyOf(noteIds).delete();
  await database.cards.where('noteId').anyOf(noteIds).delete();await database.aiSummaries.where('noteId').anyOf(noteIds).delete();await database.notes.bulkDelete(noteIds);
}
export async function deleteNote(id:string,database:StudyDatabase=db){await database.transaction('rw',database.tables,()=>cascadeNotes([id],database));}
export async function deleteSubject(id:string,database:StudyDatabase=db){await database.transaction('rw',database.tables,async()=>{const notes=await database.notes.where('subjectId').equals(id).primaryKeys();await cascadeNotes(notes,database);await database.subjects.delete(id);});}
export async function reorderNotes(subjectId:string,ids:string[],database:StudyDatabase=db){
  await database.transaction('rw',database.notes,async()=>{
    const existing=await database.notes.where('subjectId').equals(subjectId).primaryKeys();
    if(ids.length!==existing.length||new Set(ids).size!==ids.length||existing.some(id=>!ids.includes(id)))throw new Error('授業一覧が変わりました。もう一度お試しください。');
    await Promise.all(ids.map((id,order)=>database.notes.update(id,{order})));
  });
}
