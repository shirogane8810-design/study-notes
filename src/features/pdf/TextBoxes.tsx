import {useEffect,useMemo,useRef,useState} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {db} from '../../db/database';
import type {TextBox} from '../../db/models';
import {TextBoxWriter} from './autosave';
import {transformTextBox,type Corner} from './text-box-geometry';
import {normalizePoint,type Rotation} from './geometry';

export function TextBoxes({docId,pageIndex,width,height,rotation,enabled,movable,onFinish,onEdit}:{docId:string;pageIndex:number;width:number;height:number;rotation:Rotation;enabled:boolean;movable:boolean;onFinish:()=>void;onEdit:()=>void}){
  const boxes=useLiveQuery(()=>db.textBoxes.where('[pdfDocId+pageIndex]').equals([docId,pageIndex]).toArray(),[docId,pageIndex]);
  const [deleted,setDeleted]=useState<TextBox>();const [hidden,setHidden]=useState(new Set<string>());
  const [selected,setSelected]=useState<string>();const [status,setStatus]=useState<'saving'|'saved'|'error'>('saved');
  const [drafts,setDrafts]=useState<Record<string,TextBox>>({});const writer=useMemo(()=>new TextBoxWriter(setStatus),[]);
  const enter=useRef<{id:string;caret:number}|undefined>(undefined);
  const layer=useRef<HTMLDivElement>(null);const drag=useRef<{box:TextBox;x:number;y:number;corner?:Corner;pointerId:number}|undefined>(undefined);
  useEffect(()=>{const flush=()=>void writer.flush().catch(()=>{});window.addEventListener('pagehide',flush);const visibility=()=>{if(document.hidden)flush();};document.addEventListener('visibilitychange',visibility);return()=>{window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',visibility);writer.dispose();};},[writer]);
  const canonicalW=rotation===90||rotation===270?height:width,canonicalH=rotation===90||rotation===270?width:height;
  const transform=rotation===90?`translate(${width}px,0) rotate(90deg)`:rotation===180?`translate(${width}px,${height}px) rotate(180deg)`:rotation===270?`translate(0,${height}px) rotate(270deg)`:'none';
  function save(box:TextBox){setDrafts(v=>({...v,[box.id]:box}));writer.queue(box);}
  const display=new Map((boxes??[]).map(b=>[b.id,b]));for(const b of Object.values(drafts))display.set(b.id,b);
  return <div ref={layer} className={`text-box-layer ${enabled?'text-enabled':''}`} style={{width,height}} onPointerDown={e=>{
    if(e.pointerType==='touch')return;
    if(!enabled||e.button!==0||e.target!==e.currentTarget)return;e.preventDefault();e.stopPropagation();
    const [x,y]=normalizePoint(e.clientX,e.clientY,e.currentTarget.getBoundingClientRect(),.5,rotation);
    const box:TextBox={id:crypto.randomUUID(),pdfDocId:docId,pageIndex,x:Math.min(x,.65),y:Math.min(y,.85),width:.32,height:.12,text:'',color:'#172033',fontSize:16/595};save(box);setSelected(box.id);
  }}>
    <div className="text-box-plane" style={{width:canonicalW,height:canonicalH,transform}}>
      {[...display.values()].filter(b=>!hidden.has(b.id)).map(box=><div key={box.id} className={`pdf-text-box ${enabled?'editable':''}`} style={{left:box.x*canonicalW,top:box.y*canonicalH,width:box.width*canonicalW,height:box.height*canonicalH}} onPointerDown={e=>e.stopPropagation()}>
        {enabled?<><div className="text-box-actions" onPointerDown={e=>e.stopPropagation()}><button aria-label="文字を小さく" onClick={()=>save({...box,fontSize:Math.max(8/595,box.fontSize-2/595)})}>A−</button><span>{Math.round(box.fontSize*595)}</span><button aria-label="文字を大きく" onClick={()=>save({...box,fontSize:Math.min(72/595,box.fontSize+2/595)})}>A＋</button><button aria-label="テキストボックスを削除" onClick={()=>{setDeleted(box);setHidden(v=>new Set([...v,box.id]));setDrafts(v=>{const next={...v};delete next[box.id];return next;});writer.queue(null,box.id);void writer.flush().catch(()=>{});}}>×</button></div>
        {(['n','e','s','w','nw','ne','sw','se'] as const).map(handle=><div key={handle} role="button" aria-label={`テキスト枠${handle.length===2?'の角でサイズ変更':'線で移動'} ${handle}`} className={`text-frame-handle handle-${handle}`} onPointerDown={e=>{e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);drag.current={box,x:e.clientX,y:e.clientY,pointerId:e.pointerId,corner:handle.length===2?handle as Corner:undefined};}} onPointerMove={e=>{const start=drag.current;if(!start||start.pointerId!==e.pointerId||!layer.current)return;e.preventDefault();e.stopPropagation();const rect=layer.current.getBoundingClientRect();const a=normalizePoint(start.x,start.y,rect,.5,rotation),b=normalizePoint(e.clientX,e.clientY,rect,.5,rotation);save(transformTextBox(start.box,b[0]-a[0],b[1]-a[1],start.corner));}} onPointerUp={()=>{drag.current=undefined;void writer.flush().catch(()=>{});}} onPointerCancel={()=>{drag.current=undefined;void writer.flush().catch(()=>{});}} onLostPointerCapture={()=>{drag.current=undefined;void writer.flush().catch(()=>{});}}/>)}
        <textarea aria-label={`${pageIndex+1}ページのテキストボックス`} autoFocus={selected===box.id} onFocus={()=>setSelected(undefined)} onCompositionStart={()=>{enter.current=undefined;}} onPointerDown={()=>{enter.current=undefined;}} onKeyDown={e=>{
          if(e.nativeEvent.isComposing||e.nativeEvent.keyCode===229){enter.current=undefined;return;}
          if(e.key!=='Enter'||e.shiftKey){enter.current=undefined;return;}if(e.repeat){e.preventDefault();return;}
          const caret=e.currentTarget.selectionStart;
          if(enter.current?.id===box.id&&enter.current.caret===caret&&box.text[caret-1]==='\n'){
            e.preventDefault();const next={...box,text:box.text.slice(0,caret-1)+box.text.slice(caret)};save(next);enter.current=undefined;
            void writer.flush().then(onFinish).catch(()=>{});
          }else enter.current={id:box.id,caret:caret+1};
        }} placeholder="ここに入力" value={box.text} style={{fontSize:box.fontSize*canonicalW,color:box.color}} onChange={e=>save({...box,text:e.target.value})} onBlur={()=>void writer.flush().catch(()=>{})}/></>:<div className="text-box-content" style={{fontSize:box.fontSize*canonicalW,color:box.color}}><span className={movable?'movable-text':''} role={movable?'button':undefined} tabIndex={movable?0:undefined} aria-label={movable?'テキストをドラッグして移動':undefined} onDoubleClick={()=>{if(movable){setSelected(box.id);onEdit();}}} onPointerDown={e=>{if(!movable||e.button!==0||e.pointerType==='touch')return;e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);drag.current={box,x:e.clientX,y:e.clientY,pointerId:e.pointerId};}} onPointerMove={e=>{const start=drag.current;if(!start||start.pointerId!==e.pointerId||!layer.current)return;e.preventDefault();e.stopPropagation();const rect=layer.current.getBoundingClientRect(),a=normalizePoint(start.x,start.y,rect,.5,rotation),b=normalizePoint(e.clientX,e.clientY,rect,.5,rotation);save(transformTextBox(start.box,b[0]-a[0],b[1]-a[1]));}} onPointerUp={()=>{drag.current=undefined;void writer.flush().catch(()=>{});}} onPointerCancel={()=>{drag.current=undefined;void writer.flush().catch(()=>{});}} onLostPointerCapture={()=>{drag.current=undefined;}} onKeyDown={e=>{const movement={ArrowLeft:[-.01,0],ArrowRight:[.01,0],ArrowUp:[0,-.01],ArrowDown:[0,.01]}[e.key];if(movable&&movement){e.preventDefault();e.stopPropagation();save(transformTextBox(box,movement[0],movement[1]));}}}>{box.text}</span></div>}
      </div>)}
    </div>
    {enabled&&deleted&&<button className="text-restore" onClick={()=>{setHidden(v=>{const next=new Set(v);next.delete(deleted.id);return next;});save(deleted);setDeleted(undefined);}}>削除したテキストを戻す</button>}
    {enabled&&status!=='saved'&&<span className="text-save-status" role="status">{status==='saving'?'文字を保存中…':<button onClick={()=>void writer.flush().catch(()=>{})}>文字の保存に失敗・再試行</button>}</span>}
  </div>;
}
