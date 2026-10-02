import {it,expect} from 'vitest';
import {StudyDatabase} from '../../db/database';
import {insertPaper,paperLines} from './pages';
it('中間ページの挿入で手書き・文字・カード・確認済みページをずらす',async()=>{
  const database=new StudyDatabase(crypto.randomUUID());
  await database.pdfDocs.add({id:'p',noteId:'n',fileName:'a.pdf',blob:new Blob(),pages:[{kind:'pdf',srcPage:1},{kind:'pdf',srcPage:2}],extractedText:[]});
  await database.strokes.add({id:'s',pdfDocId:'p',pageIndex:1,tool:'pen',color:'#000',width:.01,points:[[.2,.3,.5]]});
  await database.textBoxes.add({id:'t',pdfDocId:'p',pageIndex:1,text:'注釈',x:.2,y:.2,width:.3,height:.1,color:'#000',fontSize:.03});
  await database.cards.add({id:'c',noteId:'n',pdfDocId:'p',pageIndex:1,kind:'mask',fsrs:{},createdAt:''});
  await database.pageChecks.bulkAdd([{id:'a',pdfDocId:'p',pageIndex:0,checkedAt:''},{id:'b',pdfDocId:'p',pageIndex:1,checkedAt:''}]);
  await insertPaper('p',1,'ruled',database);
  expect((await database.pdfDocs.get('p'))?.pages).toMatchObject([{kind:'pdf',srcPage:1},{kind:'ruled'},{kind:'pdf',srcPage:2}]);
  for(const table of [database.strokes,database.textBoxes,database.cards])expect((await table.toArray())[0].pageIndex).toBe(2);
  expect((await database.pageChecks.get('b'))?.pageIndex).toBe(2);expect((await database.pageChecks.get('a'))?.pageIndex).toBe(0);
  await insertPaper('p',0,'grid',database);await insertPaper('p',4,'blank',database);expect((await database.pdfDocs.get('p'))?.pages).toHaveLength(5);
  await expect(insertPaper('p',99,'blank',database)).rejects.toThrow();expect((await database.pdfDocs.get('p'))?.pages).toHaveLength(5);await database.delete();
});
it('用紙の線がページ内に収まる',()=>{expect(paperLines('blank',595,842)).toEqual([]);expect(paperLines('grid',595,842).length).toBeGreaterThan(paperLines('ruled',595,842).length);expect(paperLines('ruled',595,842).every(l=>l.x1>=0&&l.x2<=595&&l.y1<=842)).toBe(true);});
