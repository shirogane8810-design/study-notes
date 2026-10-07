import {expect,it} from 'vitest';
import {PDFDocument,PDFName} from 'pdf-lib';
import {imageFormat,imagePageSize,imagePdf} from './image-import';
import {StudyDatabase} from '../../db/database';
import {snapshot,createArchive,readArchive} from '../backup/archive';
import {restore} from '../backup/restore';

it('拡張子やMIMEではなく画像の内容で判定する',()=>{
  expect(imageFormat(new Uint8Array([137,80,78,71,13,10,26,10]))).toBe('png');
  expect(imageFormat(new Uint8Array([255,216,255,224]))).toBe('jpeg');
  expect(imageFormat(new TextEncoder().encode('RIFF1234WEBP'))).toBe('webp');
  expect(imageFormat(new TextEncoder().encode('<svg></svg>'))).toBeUndefined();
  expect(imageFormat(new Uint8Array())).toBeUndefined();
});
it('縦横比を保ち、縦長・横長どちらも余白のないページにする',()=>{
  expect(imagePageSize(1600,900)).toEqual({width:842,height:473.625});
  expect(imagePageSize(900,1600)).toEqual({width:473.625,height:842});
  expect(()=>imagePageSize(0,100)).toThrow();
  expect(()=>imagePageSize(100,NaN)).toThrow();
});
it('画像を実際にPDFへ埋め込み、既存の資料形式で読み戻せる',async()=>{
  const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
  const blob=await imagePdf(png,1600,900),pdf=await PDFDocument.load(await blob.arrayBuffer());
  expect(blob.type).toBe('application/pdf');expect(pdf.getPageCount()).toBe(1);
  expect(pdf.getPage(0).getSize()).toEqual({width:842,height:473.625});
  expect(pdf.getPage(0).node.Resources()?.lookup(PDFName.of('XObject'))).toBeDefined();
});
it('画像名の資料と書き込みをZIPから復元し、既存の資料を保つ',async()=>{
  const source=new StudyDatabase(crypto.randomUUID()),dest=new StudyDatabase(crypto.randomUUID());
  try{
    const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII='),c=>c.charCodeAt(0)),blob=await imagePdf(png,1600,900);
    await source.subjects.put({id:'s',name:'画像のテスト',icon:'📘',color:'#2563eb',order:0,exams:[],createdAt:'2026-10-07'});
    await source.notes.put({id:'n',subjectId:'s',title:'画像',sessionNumber:1,order:0,createdAt:'2026-10-07',updatedAt:'2026-10-07'});
    await source.pdfDocs.put({id:'image',noteId:'n',fileName:'画像.png',blob,order:2,trashedAt:'2026-10-07T00:00:00Z',pages:[{kind:'pdf',srcPage:1}],extractedText:[]});
    await source.textBoxes.put({id:'text',pdfDocId:'image',pageIndex:0,x:.1,y:.2,width:.2,height:.1,text:'回答',color:'#2563eb',fontSize:.03});
    await dest.pdfDocs.put({id:'existing',noteId:'other',fileName:'保持.pdf',blob,pages:[{kind:'pdf',srcPage:1}],extractedText:[]});
    const backup=await readArchive(await createArchive(await snapshot(undefined,source),()=>{},async doc=>new Uint8Array(await doc.blob.arrayBuffer())));
    await restore(backup,'merge',dest);
    const image=(await dest.pdfDocs.toArray()).find(d=>d.fileName==='画像.png')!;
    expect(image.order).toBe(2);expect(image.trashedAt).toBe('2026-10-07T00:00:00Z');expect(image.pages).toEqual([{kind:'pdf',srcPage:1}]);expect(await image.blob.arrayBuffer()).toEqual(await blob.arrayBuffer());
    expect((await dest.textBoxes.toArray())[0]).toMatchObject({pdfDocId:image.id,text:'回答'});
    expect((await dest.pdfDocs.get('existing'))?.fileName).toBe('保持.pdf');
  }finally{await source.delete();await dest.delete();}
});
