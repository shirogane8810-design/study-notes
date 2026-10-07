import {PDFDocument,BlendMode,rgb,type PDFPage} from 'pdf-lib';
import type {PdfDoc,Stroke,TextBox} from '../../db/models';
import {annotationPlacement} from './export-placement';
import {paint} from './InkPage';
import {paperLines} from './pages';
function png(canvas:HTMLCanvasElement):Promise<Uint8Array>{return new Promise((resolve,reject)=>canvas.toBlob(blob=>{if(!blob)reject(new Error('書き込み画像を作れませんでした。'));else void blob.arrayBuffer().then(bytes=>resolve(new Uint8Array(bytes)),reject);},'image/png'));}
function drawText(ctx:CanvasRenderingContext2D,box:TextBox,width:number,height:number){
  const font=box.fontSize*width,padding=box.kind==='answer'?0:12*width/595;ctx.save();ctx.beginPath();ctx.rect(box.x*width,box.y*height,box.width*width,box.height*height);ctx.clip();ctx.font=`${font}px system-ui,sans-serif`;ctx.fillStyle=box.color;ctx.textBaseline='top';
  if(box.kind==='answer'){ctx.fillText(box.text,box.x*width,box.y*height);ctx.restore();return;}
  const max=box.width*width-2*padding;let y=box.y*height+padding;
  for(const paragraph of box.text.split('\n')){let line='';for(const char of paragraph){if(line&&ctx.measureText(line+char).width>max){ctx.fillText(line,box.x*width+padding,y);y+=font*1.45;line=char;}else line+=char;}ctx.fillText(line,box.x*width+padding,y);y+=font*1.45;}
  ctx.restore();
}
export async function exportPdf(doc:PdfDoc,strokes:Stroke[],boxes:TextBox[],onProgress:(done:number,total:number)=>void){
  await document.fonts.ready;
  const source=await PDFDocument.load(await doc.blob.arrayBuffer());const out=await PDFDocument.create();
  for(let i=0;i<doc.pages.length;i++){
    const ref=doc.pages[i];let page:PDFPage;
    if(ref.kind==='pdf'){const[copied]=await out.copyPages(source,[ref.srcPage-1]);page=out.addPage(copied);}else {page=out.addPage([595,842]);for(const l of paperLines(ref.kind,595,842))page.drawLine({start:{x:l.x1,y:842-l.y1},end:{x:l.x2,y:842-l.y2},thickness:.6,color:rgb(.8,.84,.89)});}
    const ink=strokes.filter(s=>s.pageIndex===i),text=boxes.filter(b=>b.pageIndex===i);
    if(ink.length||text.length){
      const placement=annotationPlacement(page);const scale=Math.min(2,Math.sqrt(6000000/(placement.width*placement.height)));const w=placement.width*scale,h=placement.height*scale;
      const canvas=document.createElement('canvas');
      const highlights=ink.filter(s=>s.tool==='highlighter');if(highlights.length){paint(canvas,highlights,w,h,0);const image=await out.embedPng(await png(canvas));page.drawImage(image,{...placement,blendMode:BlendMode.Multiply});}
      const pens=ink.filter(s=>s.tool==='pen');if(pens.length||text.length){paint(canvas,pens,w,h,0);const ctx=canvas.getContext('2d');if(!ctx)throw new Error('書き込みを描画できませんでした。');ctx.setTransform(canvas.width/w,0,0,canvas.height/h,0,0);for(const box of text)drawText(ctx,box,w,h);const image=await out.embedPng(await png(canvas));page.drawImage(image,placement);}
      canvas.width=canvas.height=1;
    }
    onProgress(i+1,doc.pages.length);await new Promise<void>(resolve=>setTimeout(resolve,0));
  }
  return await out.save();
}
export function downloadPdf(bytes:Uint8Array,fileName:string){
  return {url:URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/pdf'})),fileName:fileName.replace(/\.pdf$/i,'')+'_書き込み.pdf'};
}
