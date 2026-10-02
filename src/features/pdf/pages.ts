import {db,type StudyDatabase} from '../../db/database';
import type {PageRef} from '../../db/models';
export type PaperKind=Exclude<PageRef['kind'],'pdf'>;
export const paperNames={blank:'白紙',ruled:'罫線',grid:'方眼'};
export function paperLines(kind:PageRef['kind'],width:number,height:number){
  const lines:{x1:number;y1:number;x2:number;y2:number}[]=[];
  const gap=kind==='grid'?14:24;
  if(kind==='ruled'||kind==='grid')for(let y=kind==='ruled'?48:gap;y<height;y+=gap)lines.push({x1:kind==='ruled'?28:0,y1:y,x2:kind==='ruled'?width-28:width,y2:y});
  if(kind==='grid')for(let x=gap;x<width;x+=gap)lines.push({x1:x,y1:0,x2:x,y2:height});
  return lines;
}
export async function insertPaper(docId:string,index:number,kind:PaperKind,database:StudyDatabase=db){
  return database.transaction('rw',database.tables,async()=>{
    const doc=await database.pdfDocs.get(docId);if(!doc)throw new Error('PDFが見つかりません。');
    if(!Number.isInteger(index)||index<0||index>doc.pages.length)throw new Error('挿入位置が不正です。');
    for(const table of [database.strokes,database.textBoxes,database.cards,database.pageChecks]){
      const items=await table.where('pdfDocId').equals(docId).toArray();
      // Descending updates keep the unique page-check index valid.
      for(const item of items.filter(v=>v.pageIndex!==undefined&&v.pageIndex>=index).sort((a,b)=>(b.pageIndex??0)-(a.pageIndex??0)))await table.update(item.id,{pageIndex:item.pageIndex!+1});
    }
    const pages=[...doc.pages];pages.splice(index,0,{kind,id:crypto.randomUUID()});await database.pdfDocs.update(docId,{pages});await database.notes.update(doc.noteId,{updatedAt:new Date().toISOString()});
  });
}
