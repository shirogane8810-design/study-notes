import {useCallback,useEffect,useRef,useState} from 'react';
import {PdfWorkspace} from '../pdf/PdfWorkspace';
import {TextNotebook} from './TextNotebook';
import type {PageTarget} from './page-links';
import './notebook.css';
import {AiBridge,AiSummaryList} from '../ai-bridge/AiBridge';
import {useLiveQuery} from 'dexie-react-hooks';
import {db} from '../../db/database';
import {CardManager} from '../review/CardManager';
export type PageRequest=PageTarget&{requestId:string};
export function LessonWorkspace({noteId,request}:{noteId:string;request?:PageRequest}){
  const area=useRef<HTMLDivElement>(null);const [immersive,setImmersive]=useState(false);const [noteOpen,setNoteOpen]=useState(false);
  const note=useLiveQuery(()=>db.notes.get(noteId),[noteId]);
  function enter(){setNoteOpen(false);setImmersive(true);void area.current?.requestFullscreen?.().catch(()=>{});}
  function exit(){setImmersive(false);if(document.fullscreenElement===area.current)void document.exitFullscreen().catch(()=>{});}
  useEffect(()=>{function changed(){if(!document.fullscreenElement)setImmersive(false);}function key(e:KeyboardEvent){if(e.key==='Escape')setImmersive(false);}document.addEventListener('fullscreenchange',changed);window.addEventListener('keydown',key);return()=>{document.removeEventListener('fullscreenchange',changed);window.removeEventListener('keydown',key);};},[]);
  useEffect(()=>{if(!immersive)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;};},[immersive]);
  const [collapsed,setCollapsed]=useState(false);const [current,setCurrent]=useState<PageTarget>();const [localRequest,setLocalRequest]=useState<PageRequest>();
  useEffect(()=>setLocalRequest(undefined),[request]);
  const update=useCallback((page:PageTarget)=>setCurrent(page),[]);
  return <div ref={area} className={immersive?'lesson-immersive':'lesson-container'}><div className="lesson-layout-bar"><span>PDFと授業ノート</span><div className="lesson-layout-actions"><AiBridge noteId={noteId} current={current}/><CardManager noteId={noteId} current={current} onJump={target=>setLocalRequest({...target,requestId:crypto.randomUUID()})}/><button onClick={()=>setCollapsed(v=>!v)} aria-expanded={!collapsed}>{collapsed?'テキストノートを開く':'テキストノートを閉じる'}</button></div></div><div className={`lesson-workspace${collapsed?' text-collapsed':''}`}><div className="lesson-pdf"><PdfWorkspace immersive={immersive} onFullscreen={enter} title={note?.title} noteId={noteId} request={localRequest??request} onPageChange={update}/></div><section className="lesson-text" hidden={immersive?!noteOpen:collapsed} aria-label="授業のノート"><h3>授業のテキストノート{immersive&&<button aria-label="ノートを閉じる" onClick={()=>setNoteOpen(false)}>×</button>}</h3><TextNotebook noteId={noteId} current={current} onJump={target=>setLocalRequest({...target,requestId:crypto.randomUUID()})}/><AiSummaryList noteId={noteId}/></section></div>{immersive&&<div className="immersive-corner"><button aria-expanded={noteOpen} onClick={()=>setNoteOpen(v=>!v)}>▤ {noteOpen?'ノートを閉じる':'ノートを開く'}</button><button aria-label="フルスクリーンを終了" title="元の画面に戻る" onClick={exit}>⤡</button></div>}</div>;
}
