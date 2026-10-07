import {expect,it} from 'vitest';
import {StudyDatabase} from '../../db/database';
import {orderedMaterials,renameMaterial,reorderMaterials,trashMaterial} from './materials';
it('旧資料を並べ替え、名前変更とごみ箱復元でもBlob・注釈・他の資料を保つ',async()=>{
  const database=new StudyDatabase(crypto.randomUUID());try{
    for(const id of ['a','b'])await database.pdfDocs.put({id,noteId:'n',fileName:id+'.pdf',blob:new Blob([id]),pages:[{kind:'pdf',srcPage:1}],extractedText:[]});
    await database.textBoxes.put({id:'t',pdfDocId:'a',pageIndex:0,text:'保持',x:.1,y:.2,width:.3,height:.1,fontSize:.03,color:'#172033'});
    await reorderMaterials('n',['b','a'],database);expect(orderedMaterials(await database.pdfDocs.toArray()).map(d=>d.id)).toEqual(['b','a']);
    await renameMaterial('a','資料の名前',database);await trashMaterial('a',true,database);expect((await database.pdfDocs.get('a'))?.trashedAt).toBeTruthy();
    await trashMaterial('a',false,database);expect((await database.pdfDocs.get('a'))?.trashedAt).toBeUndefined();expect(await (await database.pdfDocs.get('a'))!.blob.text()).toBe('a');expect((await database.textBoxes.get('t'))?.text).toBe('保持');expect((await database.pdfDocs.get('b'))?.fileName).toBe('b.pdf');
    await expect(reorderMaterials('n',['a','a'],database)).rejects.toThrow();await expect(renameMaterial('a',' ',database)).rejects.toThrow();
  }finally{await database.delete();}
});
