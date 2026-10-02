import {it,expect} from 'vitest';
import {StudyDatabase} from '../../db/database';
import {StrokeWriter,TextBoxWriter,TextNoteWriter,flushAllStrokes,persistStrokeChange} from './autosave';
import type {Stroke} from '../../db/models';
it('授業ノートは画面切替時に最新のJSONと検索用本文を保存する',async()=>{
  const database=new StudyDatabase(crypto.randomUUID()),writer=new TextNoteWriter(()=>{},database);
  writer.queue({id:'t',noteId:'n',content:{type:'doc'},plainText:'途中'});
  writer.queue({id:'t',noteId:'n',content:{type:'doc',content:[{type:'blockMath',attrs:{latex:'x^2'}}]},plainText:'x^2'});
  await flushAllStrokes();database.close();await database.open();expect(await database.textNotes.get('t')).toMatchObject({plainText:'x^2',content:{content:[{type:'blockMath',attrs:{latex:'x^2'}}]}});writer.dispose();await database.delete();
});
it('連続編集の最後を保存し、消去を上書きで復活させない',async()=>{
  const database=new StudyDatabase(crypto.randomUUID());const writer=new StrokeWriter(()=>{},database);
  const stroke:Stroke={id:'s',pdfDocId:'p',pageIndex:0,tool:'pen',color:'#000',width:.003,points:[[.1,.2,.5]]};
  writer.queue(stroke);writer.queue({...stroke,points:[...stroke.points,[.4,.5,.7]]});await writer.flush();expect((await database.strokes.get('s'))?.points).toHaveLength(2);
  writer.queue(stroke);writer.queue(null,'s');await writer.flush();expect(await database.strokes.get('s')).toBeUndefined();writer.dispose();await database.delete();
});

it('文字の編集と位置をまとめて保存し、再接続後も残る',async()=>{
  const database=new StudyDatabase(crypto.randomUUID());const writer=new TextBoxWriter(()=>{},database);
  const box={id:'t',pdfDocId:'p',pageIndex:0,x:.1,y:.2,width:.3,height:.1,text:'注釈',color:'#172033',fontSize:.03};
  writer.queue(box);writer.queue({...box,text:'日本語の注釈\n2行目',x:.4});await writer.flush();database.close();await database.open();expect(await database.textBoxes.get('t')).toMatchObject({text:'日本語の注釈\n2行目',x:.4});
  writer.queue(null,'t');await writer.flush();expect(await database.textBoxes.get('t')).toBeUndefined();writer.dispose();await database.delete();
});

it('投げ縄で同じIDを編集しても消えず、Undoで元に戻る',async()=>{
  const database=new StudyDatabase(crypto.randomUUID()),writer=new StrokeWriter(()=>{},database);
  const before:Stroke={id:'s',pdfDocId:'p',pageIndex:0,tool:'pen',color:'#000',width:.01,points:[[.1,.2,.5]]};const after={...before,color:'#dc2626',points:[[.3,.4,.5]] as [number,number,number][]};
  writer.queue(before);await writer.flush();const change={removed:[before],added:[after]};await persistStrokeChange(writer,change);expect(await database.strokes.get('s')).toEqual(after);await persistStrokeChange(writer,change,true);expect(await database.strokes.get('s')).toEqual(before);writer.dispose();await database.delete();
});
