import {useEffect,useRef,useState} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {db} from '../../db/database';
import type {Note} from '../../db/models';
import {findNotes,type SearchHit} from './search';
import {indexPdf} from './pdf-index';
export function SearchPanel({onOpen}:{onOpen:(note:Note,hit:SearchHit)=>void}){
  const docs=useLiveQuery(()=>db.pdfDocs.filter(d=>!d.trashedAt).toArray())??[];const notes=useLiveQuery(()=>db.notes.toArray())??[];const texts=useLiveQuery(()=>db.textNotes.toArray())??[];const subjects=useLiveQuery(()=>db.subjects.toArray())??[];
  const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[progress,setProgress]=useState(''),[error,setError]=useState(''),[limit,setLimit]=useState(50),[retry,setRetry]=useState(0);
  const dialog=useRef<HTMLDialogElement>(null);const jobs=useRef(false);const latest=useRef(docs);latest.current=docs;const signature=docs.filter(d=>!d.textIndexed).map(d=>d.id).join(',');
  useEffect(()=>{if(jobs.current)return;const pending=latest.current.filter(d=>!d.textIndexed);if(!pending.length)return;jobs.current=true;let succeeded=false;void(async()=>{try{for(const doc of pending)await indexPdf(doc,setProgress);setProgress('');setError('');succeeded=true;}catch{setError('PDFの文字を読み込めませんでした。検索できる範囲の結果を表示しています。');setProgress('');}finally{jobs.current=false;if(succeeded&&latest.current.some(d=>!d.textIndexed&&!pending.some(p=>p.id===d.id)))setRetry(v=>v+1);}})();},[signature,retry]);
  useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();},[open]);
  const hits=findNotes(query,notes,texts,docs);
  return <><button className="nav-home" onClick={()=>setOpen(true)}>⌕ <span>ノートを検索</span></button><dialog ref={dialog} className="search-dialog" aria-label="ノートを検索" onCancel={()=>setOpen(false)}><div className="dialog-heading"><h2>ノートを検索</h2><button aria-label="検索を閉じる" onClick={()=>setOpen(false)}>×</button></div><label>検索する語句<input autoFocus type="search" aria-label="検索する語句" value={query} onChange={e=>{setQuery(e.target.value);setLimit(50);}} placeholder="授業名・本文・PDFの文字を検索"/></label><p className="search-progress" role="status">{progress?`PDFの検索を準備中：${progress}`:'文字のあるPDFを検索できます。画像だけのPDFは対象外です。'}</p>{error&&<p role="alert">{error}<button onClick={()=>setRetry(v=>v+1)}>再試行</button></p>}<div className="search-results"><p role="status">{query.trim()?`${hits.length}件の検索結果`:'語句を入力してください'}</p>{hits.slice(0,limit).map((hit,i)=>{const note=notes.find(n=>n.id===hit.noteId);if(!note)return null;return <button className="search-result" key={`${hit.noteId}-${hit.kind}-${i}`} onClick={()=>{onOpen(note,hit);setOpen(false);}}><strong>{note.title}</strong><small>{subjects.find(s=>s.id===note.subjectId)?.name} · {hit.kind==='title'?'授業名':hit.kind==='note'?'テキストノート':`PDF · p.${(hit.target?.pageIndex??0)+1}`}</small><span>{hit.snippet}</span></button>;})}{hits.length>limit&&<button onClick={()=>setLimit(v=>v+50)}>さらに50件を表示</button>}</div></dialog></>;
}
