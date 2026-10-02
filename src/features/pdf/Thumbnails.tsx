import {useEffect,useRef,useState} from 'react';
import type {PDFDocumentProxy,RenderTask} from 'pdfjs-dist';
import type {PageRef,Stroke,TextBox} from '../../db/models';
import {paperLines,paperNames} from './pages';
import {paint} from './InkPage';
export function Thumbnails({pdf,pages,sizes,strokes,boxes,current,onJump,onClose}:{pdf:PDFDocumentProxy;pages:PageRef[];sizes:{width:number;height:number}[];strokes:Stroke[];boxes:TextBox[];current:number;onJump:(index:number)=>void;onClose:()=>void}){
  return <div className="thumbnail-panel" role="region" aria-label="ページ一覧"><div className="thumbnail-heading"><strong>ページ一覧 · {pages.length}ページ</strong><button onClick={onClose} aria-label="ページ一覧を閉じる">×</button></div><div className="thumbnail-grid">{pages.map((page,i)=><Thumbnail key={i} pdf={pdf} page={page} size={sizes[i]} strokes={strokes.filter(s=>s.pageIndex===i)} boxes={boxes.filter(b=>b.pageIndex===i)} current={i===current} index={i} onJump={()=>onJump(i)}/>)}</div></div>;
}
function Thumbnail({pdf,page,size,strokes,boxes,current,index,onJump}:{pdf:PDFDocumentProxy;page:PageRef;size:{width:number;height:number};strokes:Stroke[];boxes:TextBox[];current:boolean;index:number;onJump:()=>void}){
  const button=useRef<HTMLButtonElement>(null),canvas=useRef<HTMLCanvasElement>(null);const [visible,setVisible]=useState(false);
  useEffect(()=>{const element=button.current;if(!element)return;const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting),{root:element.closest('.thumbnail-grid'),rootMargin:'100px'});observer.observe(element);return()=>observer.disconnect();},[]);
  useEffect(()=>{if(!visible||!canvas.current)return;let cancelled=false;let task:RenderTask|undefined;const target=canvas.current;const w=140,h=140*size.height/size.width;target.width=Math.round(w);target.height=Math.round(h);const ctx=target.getContext('2d');if(!ctx)return;
    void(async()=>{try{if(page.kind==='pdf'){const source=await pdf.getPage(page.srcPage);if(cancelled)return;task=source.render({canvas:target,viewport:source.getViewport({scale:w/size.width})});await task.promise;}else {ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#cbd5e1';ctx.lineWidth=.5;const scale=w/595;for(const l of paperLines(page.kind,595,842)){ctx.beginPath();ctx.moveTo(l.x1*scale,l.y1*scale);ctx.lineTo(l.x2*scale,l.y2*scale);ctx.stroke();}}
      if(cancelled)return;const ink=document.createElement('canvas');paint(ink,strokes,w,h,0);ctx.drawImage(ink,0,0,w,h);ctx.fillStyle='#172033';for(const b of boxes){ctx.font=`${b.fontSize*w}px system-ui`;ctx.fillStyle=b.color;ctx.fillText(b.text.split('\n')[0],b.x*w+2,b.y*h+b.fontSize*w,b.width*w);}
    }catch(e){if(!cancelled)console.warn('サムネイルを描画できませんでした',e);}})();return()=>{cancelled=true;task?.cancel();};
  },[visible,pdf,page,size,strokes,boxes]);
  return <button ref={button} className={`thumbnail ${current?'current':''}`} aria-label={`${index+1}ページへ移動`} aria-current={current?'page':undefined} onClick={onJump}><canvas ref={canvas} style={{aspectRatio:`${size.width}/${size.height}`}}/><span>{index+1} · {page.kind==='pdf'?'資料':paperNames[page.kind]}</span></button>;
}
