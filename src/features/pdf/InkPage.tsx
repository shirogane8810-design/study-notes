import {useEffect,useLayoutEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import type {PDFDocumentProxy,RenderTask} from 'pdfjs-dist';
import type {Stroke,PageRef} from '../../db/models';
import {paperLines} from './pages';
import {normalizePoint,rotatePoint,hitStroke,pressureWidth,type Change,type Point,type Rotation} from './geometry';
export type Tool='pen'|'highlighter'|'eraser'|'hand'|'text'|'lasso';
interface Props { pageRef:PageRef;pdf:PDFDocumentProxy;docId:string;index:number;width:number;height:number;rotation:Rotation;active:boolean;strokes:Stroke[];tool:Tool;color:string;brushWidth:number;fingerDraw:boolean;onChange:(change:Change)=>void;onErase:(ids:string[])=>void;onPreview:(stroke:Stroke)=>void;onActivity:(active:boolean,kind?:string)=>void;cancelTouch:number;canDrawTouch:()=>boolean;onDiscard:(id:string)=>void }
export function paint(canvas:HTMLCanvasElement,strokes:Stroke[],width:number,height:number,rotation:Rotation){
  const ratio=Math.min(window.devicePixelRatio||1,2,Math.sqrt(4000000/(width*height)));
  const targetW=Math.max(1,Math.round(width*ratio)),targetH=Math.max(1,Math.round(height*ratio));
  if(canvas.width!==targetW||canvas.height!==targetH){canvas.width=targetW;canvas.height=targetH;}
  const ctx=canvas.getContext('2d');if(!ctx)return;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
  for(const stroke of strokes){
    const points=stroke.points.map(p=>{const v=rotatePoint(p,rotation);return[v[0]*width,v[1]*height,v[2]] as Point;});if(!points.length)continue;
    const base=stroke.width*(rotation===90||rotation===270?height:width);
    ctx.strokeStyle=stroke.color;ctx.fillStyle=stroke.color;ctx.lineCap='round';ctx.lineJoin='round';ctx.globalAlpha=stroke.tool==='highlighter'?.32:1;
    if(stroke.tool==='highlighter'){
      ctx.lineWidth=base;ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
      for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];ctx.quadraticCurveTo(a[0],a[1],(a[0]+b[0])/2,(a[1]+b[1])/2);}
      ctx.lineTo(points.at(-1)![0],points.at(-1)![1]);ctx.stroke();
    }else{for(let i=0;i<points.length;i++){const p=points[i],previous=points[i-1]??p;ctx.lineWidth=pressureWidth(base,(p[2]+previous[2])/2,'pen');ctx.beginPath();ctx.moveTo(previous[0],previous[1]);ctx.lineTo(p[0],p[1]);ctx.stroke();ctx.beginPath();ctx.arc(p[0],p[1],pressureWidth(base,p[2],'pen')/2,0,Math.PI*2);ctx.fill();}}
  }ctx.globalAlpha=1;
}
export function InkPage(props:Props){
  const {pdf,pageRef,index,width,height,rotation,active,strokes}=props;
  const pdfCanvas=useRef<HTMLCanvasElement>(null),penCanvas=useRef<HTMLCanvasElement>(null),highlightCanvas=useRef<HTMLCanvasElement>(null),draftCanvas=useRef<HTMLCanvasElement>(null);
  const latest=useRef(props);latest.current=props;const draft=useRef<Stroke|null>(null);const pointer=useRef<number|null>(null);const erased=useRef(new Map<string,Stroke>());const frame=useRef(0);const pointerKind=useRef('');
  const [draftTool,setDraftTool]=useState<'pen'|'highlighter'>('pen');const [renderError,setRenderError]=useState('');
  useEffect(()=>{setRenderError('');let disposed=false;let task:RenderTask|undefined;let renderedPage:Awaited<ReturnType<PDFDocumentProxy['getPage']>>|undefined;
    void (async()=>{try{if(pageRef.kind!=='pdf'){const canvas=pdfCanvas.current;if(!canvas)return;const cw=rotation===90||rotation===270?height:width,ch=rotation===90||rotation===270?width:height;canvas.width=Math.round(width);canvas.height=Math.round(height);const ctx=canvas.getContext('2d');if(!ctx)return;ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.strokeStyle='#cbd5e1';ctx.lineWidth=.6;for(const line of paperLines(pageRef.kind,cw/(cw/595),ch/(cw/595))){const a=rotatePoint([line.x1/595,line.y1/(ch/(cw/595)),.5],rotation),b=rotatePoint([line.x2/595,line.y2/(ch/(cw/595)),.5],rotation);ctx.beginPath();ctx.moveTo(a[0]*width,a[1]*height);ctx.lineTo(b[0]*width,b[1]*height);ctx.stroke();}return;}const page=await pdf.getPage(pageRef.srcPage);renderedPage=page;if(disposed)return;const view=page.getViewport({scale:1,rotation:(page.rotate+rotation)%360});
      const scale=width/view.width;const viewport=page.getViewport({scale,rotation:(page.rotate+rotation)%360});const ratio=Math.min(active?(window.devicePixelRatio||1):1,2,Math.sqrt(6000000/(width*height)));
      const canvas=pdfCanvas.current;if(!canvas)return;canvas.width=Math.max(1,Math.round(viewport.width*ratio));canvas.height=Math.max(1,Math.round(viewport.height*ratio));
      task=page.render({canvas,viewport,transform:[ratio,0,0,ratio,0,0]});await task.promise;
    }catch(e){if(!disposed&&!(e instanceof Error&&e.name==='RenderingCancelledException'))setRenderError('ページを描画できませんでした。');}})();
    return()=>{disposed=true;task?.cancel();if(task)void task.promise.catch(()=>{}).finally(()=>{renderedPage?.cleanup();});else renderedPage?.cleanup();};
  },[pdf,pageRef.kind,pageRef.kind==='pdf'?pageRef.srcPage:pageRef.id,index,width,height,rotation,active]);
  useEffect(()=>{if(penCanvas.current)paint(penCanvas.current,strokes.filter(s=>s.tool==='pen'),width,height,rotation);if(highlightCanvas.current)paint(highlightCanvas.current,strokes.filter(s=>s.tool==='highlighter'),width,height,rotation);},[strokes,width,height,rotation]);
  function renderDraft(){if(frame.current)return;frame.current=requestAnimationFrame(()=>{frame.current=0;const p=latest.current;if(draftCanvas.current)paint(draftCanvas.current,draft.current?[draft.current]:[],p.width,p.height,p.rotation);});}
  function point(e:PointerEvent,element:HTMLElement):Point{return normalizePoint(e.clientX,e.clientY,element.getBoundingClientRect(),e.pointerType==='pen'?(e.pressure||.5):.5,latest.current.rotation);}
  function erase(p:Point){const current=latest.current;const canonicalW=current.rotation===90||current.rotation===270?current.height:current.width,canonicalH=current.rotation===90||current.rotation===270?current.width:current.height;
    const found=current.strokes.filter(s=>!erased.current.has(s.id)&&hitStroke(s,p,canonicalW,canonicalH,12));for(const s of found)erased.current.set(s.id,s);if(found.length)current.onErase(found.map(s=>s.id));}
  function down(e:ReactPointerEvent<HTMLCanvasElement>){const p=latest.current;
    if(p.tool==='lasso'||p.tool==='text'||p.tool==='hand'||(e.pointerType==='touch'&&(!p.fingerDraw||!p.canDrawTouch()))||e.button!==0||pointer.current!==null)return;
    e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);pointer.current=e.pointerId;pointerKind.current=e.pointerType;p.onActivity(true,e.pointerType);erased.current.clear();
    const v=point(e.nativeEvent,e.currentTarget);if(p.tool==='eraser')erase(v);else{setDraftTool(p.tool);draft.current={id:crypto.randomUUID(),pdfDocId:p.docId,pageIndex:p.index,tool:p.tool,color:p.color,width:p.brushWidth/595,points:[v],createdAt:Date.now()};renderDraft();}
  }
  function move(e:ReactPointerEvent<HTMLCanvasElement>){if(pointer.current!==e.pointerId)return;e.preventDefault();e.stopPropagation();
    const events=typeof e.nativeEvent.getCoalescedEvents==='function'?e.nativeEvent.getCoalescedEvents():[];
    for(const event of events.length?events:[e.nativeEvent]){const p=point(event,e.currentTarget);if(draft.current){const previous=draft.current.points.at(-1);if(!previous||Math.hypot(p[0]-previous[0],p[1]-previous[1])>.0001)draft.current.points.push(p);}else erase(p);}
    if(draft.current)latest.current.onPreview({...draft.current,points:[...draft.current.points]});renderDraft();
  }
  function finish(){if(pointer.current===null)return;const p=latest.current;const stroke=draft.current;draft.current=null;pointer.current=null;
    if(stroke)p.onChange({added:[stroke],removed:[]});else if(erased.current.size)p.onChange({added:[],removed:[...erased.current.values()]});erased.current.clear();p.onActivity(false);renderDraft();
  }
  useLayoutEffect(()=>{if(pointer.current!==null&&pointerKind.current==='touch'){if(draft.current){latest.current.onDiscard(draft.current.id);draft.current=null;pointer.current=null;erased.current.clear();latest.current.onActivity(false);renderDraft();}else finish();}},[props.cancelTouch]);
  useEffect(()=>()=>{cancelAnimationFrame(frame.current);if(draft.current){latest.current.onChange({added:[draft.current],removed:[]});draft.current=null;}if(pointer.current!==null)latest.current.onActivity(false);},[]);
  return <div className="pdf-page" style={{width,height}} data-page={index+1}>
    <canvas ref={pdfCanvas} className="pdf-background" aria-label={`PDF ${index+1}ページ`}/>
    <canvas ref={highlightCanvas} className="ink-layer highlights" aria-hidden="true"/>
    <canvas ref={penCanvas} className="ink-layer" aria-hidden="true"/>
    <canvas ref={draftCanvas} className={`ink-layer draft ${draftTool==='highlighter'?'highlights':''}`} aria-label={`${index+1}ページの手書き領域`} onPointerDown={down} onPointerMove={move} onPointerUp={e=>{if(pointer.current===e.pointerId){e.preventDefault();e.stopPropagation();finish();}}} onPointerCancel={finish} onLostPointerCapture={finish}/>
    {renderError&&<p role="alert" className="pdf-render-error">{renderError}</p>}
  </div>;
}
