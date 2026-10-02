import type {PdfDoc} from '../../db/models';
import {db} from '../../db/database';
import {loadPdf} from '../pdf/pdf-engine';
const jobs=new Map<string,Promise<void>>();
export function indexPdf(doc:PdfDoc,progress:(text:string)=>void){
  if(doc.textIndexed)return Promise.resolve();const running=jobs.get(doc.id);if(running)return running;
  const job=(async()=>{const task=loadPdf(new Uint8Array(await doc.blob.arrayBuffer()));try{
    const pdf=await task.promise;const extracted:PdfDoc['extractedText']=[];
    for(let n=1;n<=pdf.numPages;n++){
      const page=await pdf.getPage(n),view=page.getViewport({scale:1}),content=await page.getTextContent();const runs:NonNullable<PdfDoc['extractedText'][number]['runs']>=[];let text='';
      for(const item of content.items){if(!('str'in item))continue;text+=item.str+(item.hasEOL?'\n':' ');const t=item.transform,base=Math.hypot(t[0],t[1])||1,cos=t[0]/base,sin=t[1]/base;const points:number[][]=[];
        for(const[x,y]of [[0,-item.height*.2],[item.width,-item.height*.2],[item.width,item.height*.85],[0,item.height*.85]])points.push(view.convertToViewportPoint(t[4]+x*cos-y*sin,t[5]+x*sin+y*cos));
        const x=Math.min(...points.map(p=>p[0]))/view.width,y=Math.min(...points.map(p=>p[1]))/view.height,right=Math.max(...points.map(p=>p[0]))/view.width,bottom=Math.max(...points.map(p=>p[1]))/view.height;
        runs.push({text:item.str,rect:[x,y,right-x,bottom-y]});
      }
      extracted.push({page:n,text,runs});progress(`${doc.fileName} · ${n}/${pdf.numPages}ページ`);page.cleanup();await new Promise<void>(resolve=>setTimeout(resolve,0));
    }
    await db.pdfDocs.update(doc.id,{extractedText:extracted,textIndexed:true});
  }finally{await task.destroy();}})();jobs.set(doc.id,job);void job.finally(()=>jobs.delete(doc.id)).catch(()=>{});return job;
}

export async function waitForPdfIndexes(){await Promise.allSettled([...jobs.values()]);}
