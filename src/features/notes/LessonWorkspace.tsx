import {useCallback,useEffect,useState} from 'react';
import {PdfWorkspace} from '../pdf/PdfWorkspace';
import {TextNotebook} from './TextNotebook';
import type {PageTarget} from './page-links';
import './notebook.css';
import {AiBridge,AiSummaryList} from '../ai-bridge/AiBridge';
import {CardManager} from '../review/CardManager';
export type PageRequest=PageTarget&{requestId:string};
export function LessonWorkspace({noteId,request}:{noteId:string;request?:PageRequest}){
  const [collapsed,setCollapsed]=useState(false);const [current,setCurrent]=useState<PageTarget>();const [localRequest,setLocalRequest]=useState<PageRequest>();
  useEffect(()=>setLocalRequest(undefined),[request]);
  const update=useCallback((page:PageTarget)=>setCurrent(page),[]);
  return <><div className="lesson-layout-bar"><span>PDFと授業ノート</span><div className="lesson-layout-actions"><AiBridge noteId={noteId} current={current}/><CardManager noteId={noteId} current={current} onJump={target=>setLocalRequest({...target,requestId:crypto.randomUUID()})}/><button onClick={()=>setCollapsed(v=>!v)} aria-expanded={!collapsed}>{collapsed?'テキストノートを開く':'テキストノートを閉じる'}</button></div></div><div className={`lesson-workspace${collapsed?' text-collapsed':''}`}><div className="lesson-pdf"><PdfWorkspace noteId={noteId} request={localRequest??request} onPageChange={update}/></div><section className="lesson-text" hidden={collapsed} aria-label="授業のノート"><h3>授業のテキストノート</h3><TextNotebook noteId={noteId} current={current} onJump={target=>setLocalRequest({...target,requestId:crypto.randomUUID()})}/><AiSummaryList noteId={noteId}/></section></div></>;
}
