import {useEffect,useLayoutEffect,useMemo,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import type {PDFDocumentProxy} from 'pdfjs-dist';
import {db} from '../../db/database';
import type {PdfDoc,Stroke} from '../../db/models';
import {loadPdf,pageSizes} from './pdf-engine';
import {InkPage,type Tool} from './InkPage';
import {applyChange,visiblePages,type Change,type Rotation} from './geometry';
import {StrokeWriter,flushAllStrokes,persistStrokeChange} from './autosave';
import {TextBoxes} from './TextBoxes';
import {wheelZoom} from './text-box-geometry';
import {LassoPage} from './LassoPage';
import {Thumbnails} from './Thumbnails';
import {insertPaper,paperNames,type PaperKind} from './pages';
import {ExportPreview} from './ExportPreview';
import './pdf.css';
import {pageKey,resolvePage,type PageTarget} from '../notes/page-links';
import type {PageRequest} from '../notes/LessonWorkspace';
import {isTwoFingerTap,movedFrom} from './fullscreen-gesture';
import {SearchHighlights} from '../search/SearchHighlights';
export function PdfWorkspace({noteId,request,onPageChange,immersive=false,onFullscreen,title}:{immersive?:boolean;onFullscreen?:()=>void;title?:string;noteId:string;request?:PageRequest;onPageChange?:(page:PageTarget)=>void}){
  const docs=useLiveQuery(()=>db.pdfDocs.where('noteId').equals(noteId).toArray(),[noteId]);
  const [selected,setSelected]=useState<string>();const [importing,setImporting]=useState(false);const [error,setError]=useState('');const [dropping,setDropping]=useState(false);
  const [initialPage,setInitialPage]=useState(0);const [pendingRequest,setPendingRequest]=useState<PageRequest>();const lastRequest=useRef<string>(undefined);
  const fileInput=useRef<HTMLInputElement>(null);const current=docs?.find(d=>d.id===selected)??docs?.[0];
  useEffect(()=>{if(!request||!docs||lastRequest.current===request.requestId)return;const target=docs.find(d=>d.id===request.pdfDocId);if(!target)return;const index=resolvePage(target,request);if(index<0){setError('リンク先のページが見つかりません。');return;}lastRequest.current=request.requestId;void flushAllStrokes().then(()=>{setInitialPage(index);setSelected(target.id);setPendingRequest(request);}).catch(()=>setError('書き込みを保存できませんでした。'));},[request,docs]);
  async function importFile(file?:File){
    if(!file||importing)return;setError('');setImporting(true);let task:ReturnType<typeof loadPdf>|undefined;
    try{if(file.size>100*1024*1024)throw new Error('PDFは100MB以下のファイルを選んでください。');if(!(await file.slice(0,1024).text()).includes('%PDF-'))throw new Error('PDFファイルを選んでください。');
      const bytes=new Uint8Array(await file.arrayBuffer());task=loadPdf(bytes);task.onPassword=()=>{void task?.destroy();};let pdf:PDFDocumentProxy;
      try{pdf=await task.promise;}catch{throw new Error('PDFを開けません。破損していない、パスワードのないPDFを選んでください。');}
      const id=crypto.randomUUID();const item:PdfDoc={id,noteId,fileName:file.name,blob:file,pages:Array.from({length:pdf.numPages},(_,i)=>({kind:'pdf',srcPage:i+1})),extractedText:[]};
      await flushAllStrokes();await db.transaction('rw',db.notes,db.pdfDocs,async()=>{if(!await db.notes.get(noteId))throw new Error('授業が見つかりません。');await db.pdfDocs.add(item);await db.notes.update(noteId,{updatedAt:new Date().toISOString()});});setInitialPage(0);setSelected(id);
    }catch(e){setError(e instanceof Error?e.message:'PDFを保存できませんでした。ブラウザの空き容量を確認してください。');}finally{await task?.destroy().catch(()=>{});setImporting(false);if(fileInput.current)fileInput.current.value='';}
  }
  return <div className={`pdf-workspace ${dropping?'drop-active':''}`} onDragOver={e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();setDropping(true);}}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setDropping(false);}} onDrop={e=>{e.preventDefault();setDropping(false);void importFile(e.dataTransfer.files[0]);}}>
    <input type="file" accept="application/pdf,.pdf" ref={fileInput} className="file-input" aria-label="PDFファイル" onChange={e=>void importFile(e.target.files?.[0])}/>
    {error&&<div role="alert" className="error">{error}<button onClick={()=>setError('')}>閉じる</button></div>}
    {importing&&<div role="status" className="pdf-loading">PDFを確認して保存しています…</div>}
    {!docs?<p className="pdf-loading">PDFを読み込んでいます…</p>:current?<>
      <div className="pdf-filebar"><label>{immersive&&<strong>{title}</strong>}資料<select aria-label="PDF資料を選択" value={current.id} disabled={importing} onChange={e=>{const id=e.target.value;void flushAllStrokes().then(()=>{setInitialPage(0);setSelected(id);}).catch(()=>setError('書き込みを保存できませんでした。資料の切り替えを中止しました。'));}}>{docs.map(d=><option key={d.id} value={d.id}>{d.fileName}</option>)}</select></label><button className="secondary" disabled={importing} onClick={()=>fileInput.current?.click()}>＋ PDFを追加</button>{!immersive&&<button onClick={onFullscreen}>⛶ フルスクリーンで表示</button>}</div>
      <PdfEditor onFullscreen={immersive?undefined:onFullscreen} key={`${current.id}:${current.pages.length}`} doc={current} initialPage={initialPage} onInsert={setInitialPage} request={pendingRequest} onRequestDone={()=>setPendingRequest(undefined)} onPageChange={onPageChange}/>
    </>:<div className="pdf-import-empty"><span>▤</span><h3>授業のPDFを取り込む</h3><p>PDFをここにドラッグするか、ファイルを選んでください。</p><button className="primary" disabled={importing} onClick={()=>fileInput.current?.click()}>PDFを選ぶ</button><small>100MBまで · ファイルはこのブラウザ内に保存されます</small></div>}
  </div>;
}
const emptyStrokes:Stroke[]=[];
function PdfEditor({doc,initialPage,onInsert,request,onPageChange,onRequestDone,onFullscreen}:{onFullscreen?:()=>void;doc:PdfDoc;initialPage:number;onInsert:(index:number)=>void;request?:PageRequest;onPageChange?:(page:PageTarget)=>void;onRequestDone:()=>void}){
  const [fullscreenPrompt,setFullscreenPrompt]=useState(false);const [toolsExpanded,setToolsExpanded]=useState(false);const tap=useRef<{started:number;points:Map<number,{x:number;y:number}>;moved:boolean}|undefined>(undefined);
  const [pdf,setPdf]=useState<PDFDocumentProxy>();const [sourceSizes,setSourceSizes]=useState<{width:number;height:number}[]>([]);const [error,setError]=useState('');
  const sizes=useMemo(()=>doc.pages.map(p=>p.kind==='pdf'?(sourceSizes[p.srcPage-1]??{width:595,height:842}):{width:595,height:842}),[doc.pages,sourceSizes]);
  const boxes=useLiveQuery(()=>db.textBoxes.where('pdfDocId').equals(doc.id).toArray(),[doc.id])??[];
  const [download,setDownload]=useState<{url:string;fileName:string;bytes:Uint8Array}>();
  const controls=useRef<HTMLDivElement>(null);const editorArea=useRef<HTMLDivElement>(null);const resize=useRef<{y:number;height:number}|undefined>(undefined);const [controlsHeight,setControlsHeight]=useState<number>();
  const [showExport,setShowExport]=useState(false);
  useEffect(()=>()=>{if(download)URL.revokeObjectURL(download.url);},[download]);
  const [actionError,setActionError]=useState('');const [searchQuery,setSearchQuery]=useState('');
  const [showPages,setShowPages]=useState(false),[showInsert,setShowInsert]=useState(false),[paperKind,setPaperKind]=useState<PaperKind>('blank'),[insertIndex,setInsertIndex]=useState(1),[busy,setBusy]=useState(false),[exportProgress,setExportProgress]=useState('');
  const [selection,setSelection]=useState<{page:number;ids:string[]}>({page:-1,ids:[]});
  const [strokes,setStrokes]=useState<Stroke[]>([]);const currentStrokes=useRef<Stroke[]>([]);const [saveStatus,setSaveStatus]=useState<'saving'|'saved'|'error'>('saved');
  const [quick,setQuick]=useState(false),[answerFont,setAnswerFont]=useState(18);
  const [tool,setTool]=useState<Tool>('hand'),[penColor,setPenColor]=useState('#172033'),[highlightColor,setHighlightColor]=useState('#facc15'),[thickness,setThickness]=useState(1),[fingerDraw,setFingerDraw]=useState(false);
  const [rotation,setRotation]=useState<Rotation>(0),[zoom,setZoom]=useState(1),[viewport,setViewport]=useState({width:800,height:600,top:0}),[pageInput,setPageInput]=useState('1');
  const history=useRef<{undo:Change[];redo:Change[]}>({undo:[],redo:[]});const [historyTick,setHistoryTick]=useState(0);const scroll=useRef<HTMLDivElement>(null);const inking=useRef(false);const lastPen=useRef(0);const inkKind=useRef('');const [cancelTouch,setCancelTouch]=useState(0);const contacts=useRef(new Map<number,{x:number;y:number}>());
  const touches=useRef(new Map<number,{x:number;y:number}>());const pinch=useRef<{distance:number;zoom:number;anchorX:number;anchorY:number}|undefined>(undefined);
  const writer=useMemo(()=>new StrokeWriter(setSaveStatus),[]);
  useEffect(()=>{let cancelled=false;let loading:ReturnType<typeof loadPdf>|undefined;
    void (async()=>{try{const existing=(await db.strokes.where('pdfDocId').equals(doc.id).toArray()).sort((a,b)=>(a.createdAt??0)-(b.createdAt??0));if(cancelled)return;currentStrokes.current=existing;setStrokes(existing);const bytes=new Uint8Array(await doc.blob.arrayBuffer());if(cancelled)return;loading=loadPdf(bytes);const result=await loading.promise;const dimensions=await pageSizes(result);if(cancelled)return;setSourceSizes(dimensions);setPdf(result);}catch(e){if(!cancelled)setError(e instanceof Error?`PDFを開けませんでした：${e.message}`:'PDFを開けませんでした。');}})();
    const leave=()=>{void writer.flush().catch(()=>{});};window.addEventListener('pagehide',leave);const visibility=()=>{if(document.hidden)leave();};document.addEventListener('visibilitychange',visibility);
    return()=>{cancelled=true;window.removeEventListener('pagehide',leave);document.removeEventListener('visibilitychange',visibility);writer.dispose();void loading?.destroy().catch(()=>{});};
  },[doc.id,doc.blob,writer]);
  useLayoutEffect(()=>{const element=scroll.current;if(!element)return;const update=()=>setViewport({width:element.clientWidth,height:element.clientHeight,top:element.scrollTop});const observer=new ResizeObserver(update);observer.observe(element);update();return()=>observer.disconnect();},[pdf]);
  const pageStrokes=useMemo(()=>{const result=new Map<number,Stroke[]>();for(const s of strokes){const list=result.get(s.pageIndex)??[];list.push(s);result.set(s.pageIndex,list);}return result;},[strokes]);
  const rotated=sizes.map(s=>rotation===90||rotation===270?{width:s.height,height:s.width}:s);
  const fit=Math.min(1.5,Math.max(180,viewport.width-48)/(rotated[0]?.width??595));
  const dimensions=rotated.map(s=>({width:s.width*fit*zoom,height:s.height*fit*zoom}));
  const heights=dimensions.map(s=>s.height);const offsets:number[]=[];let total=24;for(const d of dimensions){offsets.push(total);total+=d.height+40;}
  const range=visiblePages(offsets,heights,viewport.top,viewport.height,1);const currentPage=Math.max(0,offsets.findIndex((t,i)=>t+heights[i]>=viewport.top+viewport.height*.35));
  useEffect(()=>{setPageInput(String(currentPage+1));onPageChange?.({pdfDocId:doc.id,pageKey:pageKey(doc.pages[currentPage],currentPage),pageIndex:currentPage});},[currentPage,doc.id,doc.pages,onPageChange]);
  function setLocal(next:Stroke[]){const ordered=[...next].sort((a,b)=>(a.createdAt??0)-(b.createdAt??0));currentStrokes.current=ordered;setStrokes(ordered);}
  function persist(change:Change,inverse=false){void persistStrokeChange(writer,change,inverse).catch(()=>{});}
  function change(change:Change){setLocal(applyChange(currentStrokes.current,change));history.current.undo.push(change);if(history.current.undo.length>100)history.current.undo.shift();history.current.redo=[];setHistoryTick(v=>v+1);persist(change);}
  function undo(){const change=history.current.undo.pop();if(!change)return;setLocal(applyChange(currentStrokes.current,change,true));history.current.redo.push(change);setHistoryTick(v=>v+1);persist(change,true);}
  function redo(){const change=history.current.redo.pop();if(!change)return;setLocal(applyChange(currentStrokes.current,change));history.current.undo.push(change);setHistoryTick(v=>v+1);persist(change);}
  function recolor(color:string){const chosen=currentStrokes.current.filter(s=>selection.ids.includes(s.id)&&s.pageIndex===selection.page);setPenColor(color);change({removed:chosen,added:chosen.map(s=>({...s,color}))});}
  function erase(ids:string[]){const remove=new Set(ids);setLocal(currentStrokes.current.filter(s=>!remove.has(s.id)));for(const id of ids)writer.queue(null,id);}
  function activity(active:boolean,kind?:string){inking.current=active;if(active){inkKind.current=kind??'';if(kind==='pen'){lastPen.current=Date.now();touches.current.clear();contacts.current.clear();pinch.current=undefined;}}}
  function jump(page:number){if(!scroll.current||!sizes.length)return;const target=Math.max(1,Math.min(sizes.length,page));scroll.current.scrollTop=offsets[target-1];setPageInput(String(target));}
  const initialJumpDone=useRef(false);
  useEffect(()=>{if(!pdf||initialJumpDone.current)return;const frame=requestAnimationFrame(()=>{if(scroll.current){scroll.current.scrollTop=offsets[Math.min(initialPage,sizes.length-1)]??0;initialJumpDone.current=true;}});return()=>cancelAnimationFrame(frame);},[pdf,fit]);
  useEffect(()=>{if(!pdf||request?.pdfDocId!==doc.id)return;const index=resolvePage(doc,request);if(index<0)return;const frame=requestAnimationFrame(()=>{if(scroll.current){scroll.current.scrollTop=offsets[index];initialJumpDone.current=true;setSearchQuery(request.query??'');onRequestDone();}});return()=>cancelAnimationFrame(frame);},[pdf,request?.requestId]);
  async function addPaper(){setBusy(true);setActionError('');try{await flushAllStrokes();const index=insertIndex-1;onInsert(index);await insertPaper(doc.id,index,paperKind);}catch(e){setActionError(e instanceof Error?e.message:'ページを挿入できませんでした。');setBusy(false);}}
  async function exportFile(){setBusy(true);setExportProgress('書き出しを準備中…');try{await flushAllStrokes();const savedStrokes=await db.strokes.where('pdfDocId').equals(doc.id).toArray();const savedBoxes=await db.textBoxes.where('pdfDocId').equals(doc.id).toArray();const {exportPdf,downloadPdf}=await import('./export-pdf');const bytes=await exportPdf(doc,savedStrokes,savedBoxes,(n,total)=>setExportProgress(`PDFを書き出しています… ${n} / ${total}`));setDownload({...downloadPdf(bytes,doc.fileName),bytes});setExportProgress('PDFの準備ができました');}catch(e){setExportProgress(e instanceof Error?`書き出せませんでした：${e.message}`:'PDFを書き出せませんでした。');}finally{setBusy(false);}}
  const zoomAnchor=useRef<{x:number;y:number;oldZoom:number;clientX:number;clientY:number}|undefined>(undefined);
  function changeZoom(next:number,clientX?:number,clientY?:number){const element=scroll.current;if(!element)return;const rect=element.getBoundingClientRect();const x=clientX===undefined?element.clientWidth/2:clientX-rect.left,y=clientY===undefined?element.clientHeight/2:clientY-rect.top;
    zoomAnchor.current={x:element.scrollLeft+x,y:element.scrollTop+y,oldZoom:zoom,clientX:x,clientY:y};setZoom(Math.max(.5,Math.min(3,next)));
  }
  useLayoutEffect(()=>{const anchor=zoomAnchor.current;if(anchor&&scroll.current){const ratio=zoom/anchor.oldZoom;scroll.current.scrollLeft=anchor.x*ratio-anchor.clientX;scroll.current.scrollTop=anchor.y*ratio-anchor.clientY;zoomAnchor.current=undefined;}},[zoom]);
  const latestZoom=useRef(zoom);latestZoom.current=zoom;
  const zoomAt=useRef(changeZoom);zoomAt.current=changeZoom;
  useEffect(()=>{const element=scroll.current;if(!element)return;function wheel(e:WheelEvent){if(!e.ctrlKey)return;e.preventDefault();zoomAt.current(wheelZoom(latestZoom.current,e.deltaY,e.deltaMode),e.clientX,e.clientY);}element.addEventListener('wheel',wheel,{passive:false});return()=>element.removeEventListener('wheel',wheel);},[pdf]);
  function touchCapture(e:ReactPointerEvent<HTMLDivElement>){
    if(e.pointerType!=='touch'||(inking.current&&inkKind.current==='pen')||Date.now()-lastPen.current<180)return;
    if(contacts.current.size>=2&&tap.current)tap.current.moved=true;
    contacts.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(contacts.current.size===2){
      if(inking.current&&inkKind.current==='touch'){inking.current=false;setCancelTouch(v=>v+1);}
      tap.current={started:Date.now(),points:new Map(contacts.current),moved:false};
      touches.current=new Map(contacts.current);const element=scroll.current;if(!element)return;
      for(const id of contacts.current.keys())element.setPointerCapture(id);
      const[a,b]=[...contacts.current.values()],rect=element.getBoundingClientRect();const x=(a.x+b.x)/2-rect.left,y=(a.y+b.y)/2-rect.top;
      pinch.current={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom,anchorX:(element.scrollLeft+x)/zoom,anchorY:(element.scrollTop+y)/zoom};
      e.preventDefault();e.stopPropagation();
    }
  }
  function touchDown(e:ReactPointerEvent<HTMLDivElement>){if(e.pointerType==='mouse'&&e.button!==0)return;if((e.pointerType!=='touch'&&tool!=='hand')||inking.current||Date.now()-lastPen.current<180)return;
    e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);touches.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(touches.current.size===2){const[a,b]=[...touches.current.values()];const element=scroll.current!;const rect=element.getBoundingClientRect();const x=(a.x+b.x)/2-rect.left,y=(a.y+b.y)/2-rect.top;pinch.current={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom,anchorX:(element.scrollLeft+x)/zoom,anchorY:(element.scrollTop+y)/zoom};}
  }
  function touchMove(e:ReactPointerEvent<HTMLDivElement>){if(inking.current||Date.now()-lastPen.current<180)return;const previous=touches.current.get(e.pointerId);if(!previous||!scroll.current)return;e.preventDefault();touches.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(touches.current.size===1){scroll.current.scrollTop+=previous.y-e.clientY;scroll.current.scrollLeft+=previous.x-e.clientX;}else if(touches.current.size===2&&pinch.current){const[a,b]=[...touches.current.values()];const p=pinch.current;const next=Math.max(.5,Math.min(3,p.zoom*Math.hypot(a.x-b.x,a.y-b.y)/(p.distance||1)));const rect=scroll.current.getBoundingClientRect();const x=(a.x+b.x)/2-rect.left,y=(a.y+b.y)/2-rect.top;zoomAnchor.current={x:p.anchorX*zoom,y:p.anchorY*zoom,oldZoom:zoom,clientX:x,clientY:y};setZoom(next);}
  }
  function touchEnd(e:ReactPointerEvent<HTMLDivElement>){const candidate=tap.current;if(candidate){const start=candidate.points.get(e.pointerId);if(start&&movedFrom(start,e.clientX,e.clientY))candidate.moved=true;if(e.type.includes('cancel'))candidate.moved=true;if(contacts.current.size===0){if(isTwoFingerTap(Date.now()-candidate.started,candidate.moved)&&onFullscreen)setFullscreenPrompt(true);tap.current=undefined;}}touches.current.delete(e.pointerId);pinch.current=undefined;}
  useEffect(()=>{function key(e:KeyboardEvent){if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.target instanceof HTMLTextAreaElement||!scroll.current?.closest('.pdf-workspace')?.contains(document.activeElement))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}}window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[historyTick]);
  const color=tool==='highlighter'?highlightColor:penColor;const palette=tool==='highlighter'?['#facc15','#fb923c','#f87171','#86efac','#67e8f9']:['#172033','#2563eb','#dc2626','#16a34a','#7c3aed'];
  if(error)return <p role="alert" className="error">{error}</p>;
  if(!pdf)return <p role="status" className="pdf-loading">PDFを読み込んでいます…</p>;
  return <div className={`pdf-editor${toolsExpanded?' tools-expanded':''}`} ref={editorArea} data-history={historyTick}>
    <button className="immersive-tools-toggle" aria-expanded={toolsExpanded} onClick={()=>setToolsExpanded(v=>!v)}>⚙ ツール設定</button>{fullscreenPrompt&&<div className="fullscreen-prompt"><button onClick={()=>{setFullscreenPrompt(false);onFullscreen?.();}}>⛶ フルスクリーンで表示</button><button aria-label="フルスクリーンの案内を閉じる" onClick={()=>setFullscreenPrompt(false)}>×</button></div>}<div className="pdf-controls" ref={controls} style={{height:controlsHeight}}>
    <div className="pdf-toolbar" inert={busy} aria-label="手書きツール">
      <div className="tool-group">{([['pen','✎','ペン'],['highlighter','▰','蛍光ペン'],['eraser','▱','消しゴム'],['text','T','テキスト'],['lasso','◌','投げ縄']] as const).map(([value,icon,label])=><button key={value} className={tool===value&&!(value==='text'&&quick)?'tool-selected':''} aria-label={label} aria-pressed={tool===value&&!(value==='text'&&quick)} title={label} onClick={()=>{setQuick(false);setTool(tool===value&&!(value==='text'&&quick)?'hand':value);}}><span>{icon}</span><small>{label}</small></button>)}<button className={tool==='text'&&quick?'tool-selected':''} aria-label="空欄入力" aria-pressed={tool==='text'&&quick} title="空欄入力：行の目安を合わせてクリックして入力" onClick={()=>{if(tool==='text'&&quick){setTool('hand');setQuick(false);}else{setTool('text');setQuick(true);}}}><span>＿T</span><small>空欄入力</small></button></div>
      <div className="tool-group"><button aria-label="元に戻す" title="元に戻す (Ctrl+Z)" disabled={!history.current.undo.length} onClick={undo}>↶</button><button aria-label="やり直す" title="やり直す (Ctrl+Shift+Z)" disabled={!history.current.redo.length} onClick={redo}>↷</button></div>
      {(tool==='pen'||tool==='highlighter')&&<><div className="tool-group ink-colors">{palette.map(c=><button key={c} aria-label={`インク ${c}`} aria-pressed={color===c} className={color===c?'chosen-color':''} onClick={()=>tool==='highlighter'?setHighlightColor(c):setPenColor(c)}><span style={{background:c}}/></button>)}<input type="color" aria-label="インクのカスタムカラー" value={color} onChange={e=>tool==='highlighter'?setHighlightColor(e.target.value):setPenColor(e.target.value)}/></div><div className="tool-group">{['細','中','太'].map((label,i)=><button key={label} aria-label={`${label}い線`} aria-pressed={thickness===i} className={thickness===i?'tool-selected':''} onClick={()=>setThickness(i)}>{label}</button>)}</div></>}
      {tool==='text'&&quick&&<label className="answer-size">答えの文字サイズ<input type="number" aria-label="空欄入力の文字サイズ" min="8" max="72" value={answerFont} onChange={e=>setAnswerFont(Math.max(8,Math.min(72,Number(e.target.value)||18)))}/><span>薄い文字と点線で行を合わせてクリック → Enterで確定 · 文字をドラッグして移動</span></label>}
      {tool==='hand'&&<span className="hand-mode" role="status">✋ 閲覧中</span>}
      {tool==='lasso'&&<div className="lasso-actions"><span>{selection.ids.length}本を選択</span>{['#172033','#2563eb','#dc2626','#16a34a','#7c3aed'].map(c=><button key={c} aria-label={`選択を${c}に変更`} disabled={!selection.ids.length} onClick={()=>recolor(c)}><span style={{display:'block',width:20,height:20,borderRadius:'50%',background:c}}/></button>)}<input type="color" aria-label="選択した手書きの色" value={penColor} disabled={!selection.ids.length} onChange={e=>recolor(e.target.value)}/><button disabled={!selection.ids.length} onClick={()=>{const chosen=currentStrokes.current.filter(s=>selection.ids.includes(s.id)&&s.pageIndex===selection.page);change({removed:chosen,added:[]});setSelection({page:-1,ids:[]});}}>選択を削除</button><button disabled={!selection.ids.length} onClick={()=>setSelection({page:-1,ids:[]})}>解除</button></div>}
      <label className="finger-toggle"><input type="checkbox" checked={fingerDraw} onChange={e=>setFingerDraw(e.target.checked)}/>指でも描く</label>
      <span className={`save-status ${saveStatus==='error'?'save-error':''}`} role="status">{saveStatus==='saving'?'保存中…':saveStatus==='saved'?'保存済み':'保存できません'}{saveStatus==='error'&&<button onClick={()=>void writer.flush().catch(()=>{})}>再試行</button>}</span>
    </div>
    {actionError&&<p className="error" role="alert">{actionError}</p>}
    <div className="pdf-page-actions"><button aria-expanded={showPages} onClick={()=>setShowPages(v=>!v)}>▦ ページ一覧</button><button disabled={busy} onClick={()=>{setInsertIndex(currentPage+2);setShowInsert(true);}}>＋ ページを挿入</button><button disabled={busy} onClick={()=>void exportFile()}>↓ PDFを書き出す</button>{exportProgress&&<span role="status">{exportProgress}</span>}{download&&<><button onClick={()=>setShowExport(true)}>出力を確認</button><a className="pdf-download" href={download.url} download={download.fileName}>PDFを保存</a></>}</div>
    {showExport&&download&&<ExportPreview bytes={download.bytes} onClose={()=>setShowExport(false)}/>}
    {showInsert&&<div className="paper-dialog" role="dialog" aria-label="ページを挿入"><form onSubmit={e=>{e.preventDefault();void addPaper();}}><h3>ノート用のページを挿入</h3><label>用紙<select aria-label="挿入する用紙" value={paperKind} onChange={e=>setPaperKind(e.target.value as PaperKind)}>{Object.entries(paperNames).map(([kind,name])=><option value={kind} key={kind}>{name}</option>)}</select></label><label>挿入位置<input aria-label="挿入位置" type="number" min="1" max={doc.pages.length+1} required value={insertIndex} onChange={e=>setInsertIndex(Number(e.target.value))}/></label><p>{insertIndex<=doc.pages.length?`${insertIndex}ページの前に挿入します`:'最後のページの後に挿入します'}</p><div><button type="button" disabled={busy} onClick={()=>setShowInsert(false)}>キャンセル</button><button type="submit" className="primary" disabled={busy}>{busy?'挿入中…':'挿入する'}</button></div></form></div>}
    {showPages&&<Thumbnails pdf={pdf} pages={doc.pages} sizes={sizes} strokes={strokes} boxes={boxes} current={currentPage} onJump={i=>{jump(i+1);setShowPages(false);}} onClose={()=>setShowPages(false)}/>}
    <div className="pdf-viewbar"><div className="page-controls"><button aria-label="前のページ" disabled={currentPage===0} onClick={()=>jump(currentPage)}>‹</button><form onSubmit={e=>{e.preventDefault();jump(Number(pageInput)||1);}}><input aria-label="ページ番号" type="number" min="1" max={sizes.length} value={pageInput} onChange={e=>setPageInput(e.target.value)} onBlur={()=>jump(Number(pageInput)||1)}/><span>/ {sizes.length}</span></form><button aria-label="次のページ" disabled={currentPage>=sizes.length-1} onClick={()=>jump(currentPage+2)}>›</button></div><div className="zoom-controls"><button aria-label="縮小" disabled={zoom<=.5} onClick={()=>changeZoom(zoom-.25)}>−</button><button onClick={()=>changeZoom(1)} aria-label="ページ幅に合わせる">{Math.round(zoom*100)}%</button><button aria-label="拡大" disabled={zoom>=3} onClick={()=>changeZoom(zoom+.25)}>＋</button><button aria-label="右に90度回転" onClick={()=>{setRotation(((rotation+90)%360) as Rotation);}}>⟳</button></div></div>
    {searchQuery&&<div className="search-hit-banner">検索：{searchQuery}<button onClick={()=>setSearchQuery('')}>ハイライトを解除</button></div>}
    </div><div className="pdf-resize-boundary" role="separator" tabIndex={0} aria-label="ツール欄とPDFの境界を上下に調整" aria-orientation="horizontal" aria-valuenow={Math.round(controlsHeight??controls.current?.clientHeight??160)} title="上下にドラッグ・ダブルクリックで戻す" onDoubleClick={()=>setControlsHeight(undefined)} onKeyDown={e=>{if(e.key==='Home'){e.preventDefault();setControlsHeight(undefined);}else if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();setControlsHeight(Math.max(44,Math.min((editorArea.current?.clientHeight??700)-180,(controlsHeight??controls.current?.clientHeight??160)+(e.key==='ArrowUp'?-20:20))));}}} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);resize.current={y:e.clientY,height:controls.current?.clientHeight??160};}} onPointerMove={e=>{const start=resize.current;if(!start)return;e.preventDefault();setControlsHeight(Math.max(44,Math.min((editorArea.current?.clientHeight??700)-180,start.height+e.clientY-start.y)));}} onPointerUp={()=>{resize.current=undefined;}} onPointerCancel={()=>{resize.current=undefined;}}><span>•••</span></div>
    <div className={`pdf-scroll tool-${tool}`} inert={busy} ref={scroll} tabIndex={0} aria-label="PDF閲覧・手書き" onContextMenu={e=>{if(!onFullscreen||busy||e.target instanceof Element&&e.target.closest('textarea,input,[contenteditable="true"]'))return;e.preventDefault();setFullscreenPrompt(true);}} onKeyDown={e=>{if(e.key==='Escape')setFullscreenPrompt(false);}} onScroll={e=>setViewport({width:e.currentTarget.clientWidth,height:e.currentTarget.clientHeight,top:e.currentTarget.scrollTop})} onPointerDownCapture={touchCapture} onPointerMoveCapture={e=>{const start=tap.current?.points.get(e.pointerId);if(start&&movedFrom(start,e.clientX,e.clientY))tap.current!.moved=true;if(contacts.current.has(e.pointerId))contacts.current.set(e.pointerId,{x:e.clientX,y:e.clientY});if(contacts.current.size>=2){touchMove(e);e.stopPropagation();}}} onPointerUpCapture={e=>{contacts.current.delete(e.pointerId);touchEnd(e);}} onPointerCancelCapture={e=>{contacts.current.delete(e.pointerId);touchEnd(e);}} onPointerDown={touchDown} onPointerMove={touchMove} onPointerUp={touchEnd} onPointerCancel={touchEnd}>
      <div className="pdf-pages" style={{height:total,minWidth:Math.max(...dimensions.map(d=>d.width))+48}}>
        {dimensions.map((d,i)=><div key={i} className="pdf-page-slot" style={{top:offsets[i],width:d.width,height:d.height,left:Math.max(24,(viewport.width-d.width)/2)}}>{i>=range.start&&i<=range.end?<><InkPage pageRef={doc.pages[i]} pdf={pdf} docId={doc.id} index={i} width={d.width} height={d.height} rotation={rotation} active={i===currentPage} strokes={pageStrokes.get(i)??emptyStrokes} tool={tool} color={color} brushWidth={(tool==='highlighter'?[10,18,28]:[1.4,2.6,4.5])[thickness]} fingerDraw={fingerDraw} onChange={change} onErase={erase} onPreview={s=>writer.queue(s)} onActivity={activity} cancelTouch={cancelTouch} canDrawTouch={()=>contacts.current.size<=1} onDiscard={id=>{writer.queue(null,id);void writer.flush().catch(()=>{});}}/>{tool==='lasso'&&<LassoPage strokes={pageStrokes.get(i)??emptyStrokes} selected={selection.page===i?selection.ids:[]} width={d.width} height={d.height} rotation={rotation} fingerDraw={fingerDraw} onSelect={ids=>setSelection({page:i,ids})} onChange={change} onActivity={activity} cancelTouch={cancelTouch}/>}{searchQuery&&<SearchHighlights doc={doc} index={i} query={searchQuery} rotation={rotation}/>}<TextBoxes docId={doc.id} pageIndex={i} width={d.width} height={d.height} rotation={rotation} quick={quick&&tool==='text'} answerFont={answerFont} onAnswerFont={setAnswerFont} enabled={tool==='text'} movable={tool==='hand'} onFinish={()=>setTool('hand')} onEdit={answer=>{setQuick(!!answer);setTool('text');}}/></>:<div className="pdf-page-placeholder">{i+1}ページ</div>}<span className="pdf-page-label">{i+1}</span></div>)}
      </div>
    </div>
    <div className="pdf-bottom-hint">{tool==='lasso'?'手書きを囲んで選択 · 選択枠をドラッグして移動':tool==='text'&&quick?'薄い文字・点線で行を合わせて入力 · 文字をクリックで編集、ドラッグで移動 · Escで閲覧へ':tool==='text'?'PDFをクリックして入力 · 枠線で移動 · 角でサイズ変更':fingerDraw?'指・ペン・マウスで書き込み':tool==='hand'?'指でスクロール・2本指でズーム':'ペン・マウスで書き込み · 指でスクロール・2本指でズーム'}<span>{strokes.length}ストローク</span></div>
  </div>;
}
