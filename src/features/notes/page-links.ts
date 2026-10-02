import type {PageRef,PdfDoc} from '../../db/models';
export interface PageTarget {pdfDocId:string;pageKey:string;pageIndex:number;query?:string}
export function pageKey(page:PageRef,index:number){return page.kind==='pdf'?`pdf:${page.srcPage}`:page.id??`legacy:${index}`;}
export function resolvePage(doc:PdfDoc,target:PageTarget){const found=doc.pages.findIndex((p,i)=>pageKey(p,i)===target.pageKey);return found>=0?found:-1;}
export function textFromJson(value:unknown):string{
  if(!value||typeof value!=='object')return '';const node=value as Record<string,unknown>;
  if(typeof node.text==='string')return node.text;
  if(node.type==='blockMath'||node.type==='inlineMath'){const attrs=node.attrs as Record<string,unknown>|undefined;return typeof attrs?.latex==='string'?attrs.latex:'';}
  if(node.type==='pageLink'){const attrs=node.attrs as Record<string,unknown>|undefined;return typeof attrs?.label==='string'?attrs.label:'';}
  return Array.isArray(node.content)?node.content.map(textFromJson).join(node.type==='paragraph'||node.type==='heading'?'':'\n'):'';
}
