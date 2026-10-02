import {db,type StudyDatabase} from '../../db/database';
import type {Card} from '../../db/models';
import type {Grade} from 'ts-fsrs';
import {resolvePage,type PageTarget} from '../notes/page-links';
import {newSchedule,rateSchedule} from './scheduler';
export async function saveCard(input:{id?:string;noteId:string;question:string;answer:string;explanation:string;source?:PageTarget;keepSource?:boolean},database:StudyDatabase=db){
  const question=input.question.trim(),answer=input.answer.trim();if(!question||!answer)throw new Error('問題と答えを入力してください。');if(question.length>2000||answer.length>5000||input.explanation.length>5000)throw new Error('入力が長すぎます。');
  return database.transaction('rw',database.notes,database.cards,database.pdfDocs,async()=>{
    if(!await database.notes.get(input.noteId))throw new Error('授業が見つかりません。');const old=input.id?await database.cards.get(input.id):undefined;if(input.id&&(!old||old.noteId!==input.noteId))throw new Error('カードが変更されました。');
    let sourceIndex=input.source?.pageIndex;
    if(input.source){const doc=await database.pdfDocs.get(input.source.pdfDocId);if(!doc||doc.noteId!==input.noteId)throw new Error('元のPDFが見つかりません。');sourceIndex=resolvePage(doc,input.source);if(sourceIndex<0)throw new Error('参照ページが見つかりません。');}
    const source=input.keepSource?{pdfDocId:old?.pdfDocId,pageIndex:old?.pageIndex,sourcePageKey:old?.sourcePageKey}: {pdfDocId:input.source?.pdfDocId,pageIndex:sourceIndex,sourcePageKey:input.source?.pageKey};
    const card:Card={...old,id:old?.id??crypto.randomUUID(),noteId:input.noteId,kind:'short',question,answer,explanation:input.explanation.trim(),...source,fsrs:old?.fsrs??newSchedule(),createdAt:old?.createdAt??new Date().toISOString()};await database.cards.put(card);return card.id;
  });
}
export async function reviewCard(card:Card,rating:Grade,now=new Date(),database:StudyDatabase=db){
  return database.transaction('rw',database.cards,database.reviewLogs,async()=>{const current=await database.cards.get(card.id);if(!current)throw new Error('カードが削除されています。');if(JSON.stringify(current.fsrs)!==JSON.stringify(card.fsrs))throw new Error('別の画面で復習済みです。一覧を開き直してください。');const result=rateSchedule(current.fsrs,rating,now),id=crypto.randomUUID();await database.cards.update(card.id,{fsrs:result.card});await database.reviewLogs.add({id,cardId:card.id,rating,reviewedAt:now.toISOString(),previousFsrs:current.fsrs,scheduleLog:result.log});return {id,due:String(result.card.due)};});
}
export async function undoReview(logId:string,database:StudyDatabase=db){await database.transaction('rw',database.cards,database.reviewLogs,async()=>{const log=await database.reviewLogs.get(logId);if(!log?.previousFsrs)throw new Error('この評価を戻せません。');const latest=(await database.reviewLogs.where('cardId').equals(log.cardId).toArray()).sort((a,b)=>b.reviewedAt.localeCompare(a.reviewedAt))[0];if(latest?.id!==logId)throw new Error('その後の復習があるため戻せません。');if(!await database.cards.get(log.cardId))throw new Error('カードが見つかりません。');await database.cards.update(log.cardId,{fsrs:log.previousFsrs});await database.reviewLogs.delete(logId);});}
export async function deleteCard(id:string,database:StudyDatabase=db){await database.transaction('rw',database.cards,database.reviewLogs,async()=>{await database.reviewLogs.where('cardId').equals(id).delete();await database.cards.delete(id);});}
