import { beforeEach,afterEach,describe,it,expect } from 'vitest';
import { StudyDatabase } from '../../db/database';
import {saveSubject,saveNote,deleteSubject,reorderNotes} from './repository';
let database:StudyDatabase;
beforeEach(()=>{database=new StudyDatabase(crypto.randomUUID());});afterEach(async()=>{await database.delete();});
describe('科目と授業回の保存',()=>{
  it('再接続後も編集内容と並び順が残る',async()=>{
    const id=await saveSubject({name:' 数学 ',color:'#2563eb',icon:'📐'},database);
    const a=await saveNote({subjectId:id,title:'集合',sessionNumber:1},database);const b=await saveNote({subjectId:id,title:'関数',sessionNumber:2},database);
    await saveNote({id:a,subjectId:id,title:'集合と命題',sessionNumber:1},database);await reorderNotes(id,[b,a],database);
    database.close();await database.open();expect((await database.notes.where('[subjectId+order]').between([id, 0], [id, 999999]).toArray()).map(n=>n.id)).toEqual([b,a]);expect((await database.notes.get(a))?.title).toBe('集合と命題');expect((await database.subjects.get(id))?.name).toBe('数学');
  });
  it('科目の削除で関連データを消し、別科目を残す',async()=>{
    const a=await saveSubject({name:'理科',color:'#008800',icon:'🧪'},database);const b=await saveSubject({name:'英語',color:'#000088',icon:'📘'},database);
    const note=await saveNote({subjectId:a,title:'実験',sessionNumber:1},database);await saveNote({subjectId:b,title:'文法',sessionNumber:1},database);
    await database.pdfDocs.add({id:'pdf',noteId:note,fileName:'a.pdf',blob:new Blob(),pages:[],extractedText:[]});
    await database.strokes.add({id:'stroke',pdfDocId:'pdf',pageIndex:0,tool:'pen',color:'#000',width:1,points:[]});
    await database.textBoxes.add({id:'text',pdfDocId:'pdf',pageIndex:0,x:0,y:0,width:.3,height:.1,text:'注釈',color:'#000',fontSize:.03});
    await database.cards.add({id:'card',noteId:note,kind:'short',fsrs:{},createdAt:''});await database.reviewLogs.add({id:'log',cardId:'card',rating:1,reviewedAt:''});
    await deleteSubject(a,database);expect(await database.notes.count()).toBe(1);expect(await database.subjects.get(b)).toBeDefined();for(const table of [database.pdfDocs,database.textBoxes,database.strokes,database.cards,database.reviewLogs])expect(await table.count()).toBe(0);
  });
  it('不正な並び替えや授業回を保存しない',async()=>{
    const id=await saveSubject({name:'数学',color:'#2563eb',icon:'📐'},database);const a=await saveNote({subjectId:id,title:'集合',sessionNumber:1},database);
    await expect(reorderNotes(id,[a,a],database)).rejects.toThrow();await expect(saveNote({subjectId:id,title:'集合',sessionNumber:0},database)).rejects.toThrow();expect(await database.notes.count()).toBe(1);
  });
});

