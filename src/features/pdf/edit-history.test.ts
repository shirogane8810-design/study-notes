import {expect,it} from 'vitest';
import {StudyDatabase} from '../../db/database';
import {persistTextEdit,textChanged} from './edit-history';
it('文字の作成・移動・サイズ変更・削除を戻し、やり直しても他の注釈を保つ',async()=>{
  const database=new StudyDatabase(crypto.randomUUID()),box={id:'a',pdfDocId:'p',pageIndex:0,x:.1,y:.1,width:.2,height:.1,text:'回答',color:'#2563eb',fontSize:.03};
  try{await database.textBoxes.put({...box,id:'other'});
    const created={kind:'text' as const,after:box};await persistTextEdit(created,false,database);await persistTextEdit(created,true,database);expect(await database.textBoxes.get('a')).toBeUndefined();await persistTextEdit(created,false,database);
    const moved={kind:'text' as const,before:box,after:{...box,x:.4,y:.3,fontSize:.05,text:'編集した回答'}};
    await persistTextEdit(moved,false,database);await persistTextEdit(moved,true,database);expect(await database.textBoxes.get('a')).toEqual(box);await persistTextEdit(moved,false,database);expect(await database.textBoxes.get('a')).toEqual(moved.after);
    const deleted={kind:'text' as const,before:moved.after};await persistTextEdit(deleted,false,database);expect(await database.textBoxes.get('a')).toBeUndefined();await persistTextEdit(deleted,true,database);expect(await database.textBoxes.get('a')).toEqual(moved.after);expect(await database.textBoxes.get('other')).toEqual({...box,id:'other'});
    expect(textChanged(box,{...box})).toBe(false);expect(textChanged(box,moved.after)).toBe(true);
  }finally{await database.delete();}
});
