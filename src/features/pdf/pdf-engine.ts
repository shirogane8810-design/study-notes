import {getDocument,GlobalWorkerOptions,type PDFDocumentProxy} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc=workerUrl;
const asset=(folder:string)=>new URL(`pdf-assets/${folder}/`,document.baseURI).href;
export function loadPdf(data:Uint8Array){return getDocument({data,cMapUrl:asset('cmaps'),cMapPacked:true,standardFontDataUrl:asset('standard_fonts'),wasmUrl:asset('wasm')});}
export async function pageSizes(pdf:PDFDocumentProxy){
  const sizes:{width:number;height:number}[]=[];
  for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);const view=page.getViewport({scale:1});sizes.push({width:view.width,height:view.height});}
  return sizes;
}

