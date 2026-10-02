import { useEffect,useRef,useState,type FormEvent,type CSSProperties } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/database';
import type {PageTarget} from './features/notes/page-links';
import type { Note,Subject } from './db/models';
import {saveSubject,saveNote,deleteSubject,deleteNote,reorderNotes} from './features/notes/repository';
import { applyUpdate } from './sw';
import {LessonWorkspace,type PageRequest} from './features/notes/LessonWorkspace';
import {dueAt} from './features/review/scheduler';
import {formatDue} from './features/review/CardManager';
import HomeDashboard from './features/home/HomeDashboard';
import {ReviewPanel} from './features/review/ReviewPanel';
import {BackupPanel} from './features/backup/BackupPanel';
import {SearchPanel} from './features/search/SearchPanel';
import { flushAllStrokes } from './features/pdf/autosave';
type Editor = {kind:'subject';value?:Subject} | {kind:'note';value?:Note} | {kind:'delete-subject';value:Subject} | {kind:'delete-note';value:Note};
const colors=['#2563eb','#08916f','#d97706','#dc4965','#7c3aed','#0891b2'];
const icons=['📘','📐','🧪','🌏','🧬','📚','💻','🎨'];
export function App(){
  const subjects=useLiveQuery(()=>db.subjects.orderBy('order').toArray());
  const allNotes=useLiveQuery(()=>db.notes.toArray());
  const reviewCards=useLiveQuery(()=>db.cards.toArray())??[];
  function nextReview(noteId:string){const next=Math.min(...reviewCards.filter(c=>c.noteId===noteId&&c.kind!=='mask').map(dueAt));return Number.isFinite(next)?`次回復習：${formatDue(next)}`:undefined;}
  const settings=useLiveQuery(()=>db.settings.get('main'));
  const [reviewRequest,setReviewRequest]=useState<{id:string;subjectId?:string}>();
  const [pageRequest,setPageRequest]=useState<PageRequest>();
  const [selected,setSelected]=useState<string>();const [opened,setOpened]=useState<string>();
  const [editor,setEditor]=useState<Editor>();const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const [menu,setMenu]=useState(false);const [offline,setOffline]=useState(!navigator.onLine);const [update,setUpdate]=useState(false);
  const drag=useRef<string|undefined>(undefined);const modal=useRef<HTMLDialogElement>(null);const lastFocus=useRef<HTMLElement|null>(null);
  const subject=subjects?.find(s=>s.id===selected);const notes=(allNotes??[]).filter(n=>n.subjectId===selected).sort((a,b)=>a.order-b.order);
  const activeNote=notes.find(n=>n.id===opened);
  useEffect(()=>{document.documentElement.dataset.theme=settings?.theme??'light';},[settings?.theme]);
  useEffect(()=>{const on=()=>setOffline(!navigator.onLine);const changed=()=>setUpdate(true);window.addEventListener('online',on);window.addEventListener('offline',on);window.addEventListener('app-update',changed);return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',on);window.removeEventListener('app-update',changed);};},[]);
  useEffect(()=>{if(editor){lastFocus.current=document.activeElement as HTMLElement;modal.current?.showModal();}else{modal.current?.close();lastFocus.current?.focus();}},[editor]);
  async function run(action:()=>Promise<unknown>){setError('');setBusy(true);try{await action();setEditor(undefined);}catch(e){setError(e instanceof Error?e.message:'保存できませんでした。ブラウザの保存容量を確認してください。');}finally{setBusy(false);}}
  function pick(id?:string){void flushAllStrokes().then(()=>{setSelected(id);setOpened(undefined);setPageRequest(undefined);setMenu(false);setError('');}).catch(()=>setError('書き込みを保存できませんでした。画面の切り替えを中止しました。'));}
  async function openNote(note:Note){setPageRequest(undefined);setOpened(note.id);try{await db.notes.update(note.id,{lastOpenedAt:new Date().toISOString()});}catch{setError('閲覧履歴を保存できませんでした。');}}
  async function openLinkedNote(note:Note,target?:PageTarget){try{await flushAllStrokes();await openNote(note);setSelected(note.subjectId);setPageRequest(target?{...target,requestId:crypto.randomUUID()}:undefined);setMenu(false);}catch{setError('書き込みを保存できませんでした。');}}
  async function move(id:string,target:string){const ids=notes.map(n=>n.id);ids.splice(ids.indexOf(id),1);ids.splice(ids.indexOf(target),0,id);await run(()=>reorderNotes(selected!,ids));}
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);if(editor?.kind==='subject'){await run(async()=>{const id=await saveSubject({id:editor.value?.id,name:String(form.get('name')),icon:String(form.get('icon')),color:String(form.get('color'))});setSelected(id);setOpened(undefined);});}else if(editor?.kind==='note'&&selected){await run(()=>saveNote({id:editor.value?.id,subjectId:selected,title:String(form.get('title')),sessionNumber:Number(form.get('sessionNumber')),date:String(form.get('date'))||undefined}));}}
  return <div className={`app${activeNote?' pdf-open':''}`}>
    {menu&&<button className="scrim" aria-label="メニューを閉じる" onClick={()=>setMenu(false)}/>}
    <aside className={menu?'sidebar show':'sidebar'}>
      <div className="brand"><span className="brand-mark">▤</span><strong>学習ノート</strong><button className="mobile-close icon-button" aria-label="メニューを閉じる" onClick={()=>setMenu(false)}>×</button></div>
      <button className={`nav-home ${!selected?'selected':''}`} onClick={()=>pick()}>⌂ <span>学習ホーム</span><span className="count">{allNotes?.length??0}</span></button>
      <SearchPanel onOpen={(note,hit)=>{void flushAllStrokes().then(()=>{setSelected(note.subjectId);setOpened(note.id);setPageRequest(hit.target?{...hit.target,requestId:crypto.randomUUID()}:undefined);setMenu(false);}).catch(()=>setError('書き込みを保存できませんでした。'));}}/>
      <ReviewPanel request={reviewRequest} onOpen={(note,target)=>void openLinkedNote(note,target)}/>
      <BackupPanel onRestored={()=>{setOpened(undefined);setSelected(undefined);setPageRequest(undefined);setMenu(false);}}/>
      <div className="sidebar-heading"><span>科目</span><button className="icon-button" aria-label="科目を追加" onClick={()=>setEditor({kind:'subject'})}>＋</button></div>
      <nav aria-label="科目一覧">{subjects?.map(s=><button key={s.id} className={`subject-nav ${selected===s.id?'selected':''}`} style={{'--accent':s.color} as CSSProperties} onClick={()=>pick(s.id)}><span>{s.icon}</span><span className="truncate">{s.name}</span><span className="count">{allNotes?.filter(n=>n.subjectId===s.id).length??0}</span></button>)}</nav>
      {subjects?.length===0&&<p className="sidebar-hint">科目を追加して、授業ごとに<br/>ノートを整理しましょう。</p>}
      <button className="add-subject" onClick={()=>setEditor({kind:'subject'})}>＋ 科目を追加</button>
      <div className="sidebar-footer"><div className="local-info"><span>◉</span><div>このブラウザに保存<small>{offline?'オフラインで利用中':'データは外部に送信しません'}</small></div></div><button className="theme-button" onClick={()=>run(()=>db.settings.put({id:'main',maskColor:settings?.maskColor??'#ef4444',promptTemplate:settings?.promptTemplate??'',penPresets:settings?.penPresets??[],lastExportAt:settings?.lastExportAt,theme:settings?.theme==='dark'?'light':'dark'}))}>{settings?.theme==='dark'?'☀ ライトモード':'☾ ダークモード'}</button></div>
    </aside>
    <main>
      <header className="topbar"><button className="mobile-toggle icon-button" aria-label="科目メニューを開く" onClick={()=>setMenu(true)}>☰</button><div className="breadcrumb"><button onClick={()=>pick()}>学習ノート</button><span>/</span><span>{subject?.name??'ノート一覧'}</span>{activeNote&&<><span>/</span><span className="truncate">第{activeNote.sessionNumber}回</span></>}</div><span className="storage-label">{offline?'オフライン':'ブラウザ内保存'}</span></header>
      <div className={activeNote?"content editing-pdf":"content"} style={{'--accent':subject?.color??'#2563eb'} as CSSProperties}>
        {error&&<div role="alert" className="error">{error}<button onClick={()=>setError('')}>閉じる</button></div>}
        {update&&<div className="notice">新しいバージョンがあります。入力を終えてから再読み込みしてください。<button onClick={()=>void flushAllStrokes().then(()=>applyUpdate(true)).catch(()=>setError('書き込みを保存できませんでした。更新を中止しました。'))}>再読み込み</button></div>}
        {!subjects||!allNotes?<p role="status">ノートを読み込んでいます…</p>:subject?<>
          {!activeNote&&<div className="page-heading"><div><div className="eyebrow">科目ノート</div><h1><span>{subject.icon}</span> {subject.name}</h1><p>{notes.length}件の授業</p></div><div className="heading-actions"><button className="secondary" onClick={()=>setEditor({kind:'subject',value:subject})}>科目を編集</button><button className="primary" onClick={()=>setEditor({kind:'note'})}>＋ 授業を追加</button></div></div>}
          {activeNote?<><button className="back-link" onClick={()=>void flushAllStrokes().then(()=>setOpened(undefined)).catch(()=>setError('書き込みを保存できませんでした。'))}>授業一覧に戻る</button><section className="note-detail"><div className="detail-heading"><div><span className="session-badge">第{activeNote.sessionNumber}回</span><h2>{activeNote.title}</h2><p>{activeNote.date?formatDate(activeNote.date):'授業日未設定'}</p></div><button className="secondary" onClick={()=>setEditor({kind:'note',value:activeNote})}>編集</button></div><LessonWorkspace key={activeNote.id} noteId={activeNote.id} request={pageRequest}/></section></>:<>
            <div className="section-label"><h2>授業一覧</h2>{notes.length>1&&<span>ドラッグ、または上下ボタンで並べ替え</span>}</div>
            {notes.length===0?<Empty title="最初の授業を追加しましょう" text="授業のタイトルと回数を登録できます。" action="＋ 授業を追加" onAction={()=>setEditor({kind:'note'})}/>:<div className="note-list">{notes.map((n,i)=><article key={n.id} className="note-row" draggable onDragStart={e=>{drag.current=n.id;e.dataTransfer.setData('text/plain',n.id);e.dataTransfer.effectAllowed='move';}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(drag.current&&drag.current!==n.id)void move(drag.current,n.id);drag.current=undefined;}} onDragEnd={()=>{drag.current=undefined;}}><span className="grip" aria-hidden="true">⠿</span><button className="note-open" onClick={()=>void openNote(n)}><span className="session-number">{String(n.sessionNumber).padStart(2,'0')}</span><span><strong>{n.title}</strong><small>第{n.sessionNumber}回 · {n.date?formatDate(n.date):'授業日未設定'}</small>{nextReview(n.id)&&<small>{nextReview(n.id)}</small>}</span></button><div className="row-actions"><button className="icon-button" aria-label={`${n.title}を上へ移動`} disabled={i===0||busy} onClick={()=>void move(n.id,notes[i-1].id)}>↑</button><button className="icon-button" aria-label={`${n.title}を下へ移動`} disabled={i===notes.length-1||busy} onClick={()=>void move(notes[i+1].id,n.id)}>↓</button><button className="icon-button" aria-label={`${n.title}を編集`} onClick={()=>setEditor({kind:'note',value:n})}>✎</button><button className="icon-button" aria-label={`${n.title}を削除`} onClick={()=>setEditor({kind:'delete-note',value:n})}>×</button></div></article>)}</div>}
            <div className="subject-bottom"><span>作成日 {formatDate(subject.createdAt)}</span><button className="text-danger" onClick={()=>setEditor({kind:'delete-subject',value:subject})}>科目を削除</button></div>
          </>}
        </>:<>
          <div className="page-heading"><div><div className="eyebrow">MY NOTEBOOK</div><h1>学習ホーム</h1><p>科目ごとに、学びをまとめる。</p></div><button className="primary" onClick={()=>setEditor({kind:'subject'})}>＋ 科目を追加</button></div>
          <HomeDashboard onReview={subjectId=>setReviewRequest({id:crypto.randomUUID(),subjectId})} onOpen={(note,target)=>void openLinkedNote(note,target)}/><div className="section-label"><h2>科目</h2><span>{subjects.length}科目 · {allNotes.length}件の授業</span></div>
          {subjects.length===0?<Empty title="あなたのノートを、ここから" text="まず科目を登録して、授業回ごとのノートを作りましょう。" action="＋ 最初の科目を追加" onAction={()=>setEditor({kind:'subject'})}/>:<div className="subject-grid">{subjects.map(s=><button className="subject-card" key={s.id} style={{'--accent':s.color} as CSSProperties} onClick={()=>pick(s.id)}><span className="subject-icon">{s.icon}</span><strong>{s.name}</strong><small>{allNotes.filter(n=>n.subjectId===s.id).length}件の授業</small><span className="card-line"/></button>)}<button className="new-card" onClick={()=>setEditor({kind:'subject'})}><span>＋</span>科目を追加</button></div>}
        </>}
      </div>
    </main>
    <dialog ref={modal} onCancel={e=>{if(busy)e.preventDefault();else setEditor(undefined);}} aria-labelledby="dialog-title">
      {editor&&<><div className="dialog-heading"><h2 id="dialog-title">{editor.kind==='subject'?(editor.value?'科目を編集':'科目を追加'):editor.kind==='note'?(editor.value?'授業を編集':'授業を追加'):'削除の確認'}</h2><button className="icon-button" disabled={busy} aria-label="閉じる" onClick={()=>setEditor(undefined)}>×</button></div>
      {editor.kind==='delete-subject'||editor.kind==='delete-note'?<><p className="delete-description">「{editor.kind==='delete-subject'?editor.value.name:editor.value.title}」を削除します。{editor.kind==='delete-subject'?'この科目に含まれる授業と関連データも削除されます。':''}この操作は取り消せません。</p><div className="dialog-actions"><button className="secondary" disabled={busy} onClick={()=>setEditor(undefined)}>キャンセル</button><button className="danger" disabled={busy} onClick={()=>void run(async()=>{if(editor.kind==='delete-subject'){await deleteSubject(editor.value.id);pick();}else{await deleteNote(editor.value.id);if(opened===editor.value.id)setOpened(undefined);}})}>{busy?'削除中…':'削除する'}</button></div></>:<form key={`${editor.kind}-${editor.value?.id??'new'}`} onSubmit={e=>void submit(e)}>
        {editor.kind==='subject'?<><label>科目名<input name="name" autoFocus required maxLength={80} defaultValue={editor.value?.name} placeholder="例：数学、英語、理科"/></label><fieldset><legend>アイコン</legend><div className="icon-choices">{icons.map(icon=><label key={icon}><input type="radio" name="icon" value={icon} defaultChecked={(editor.value?.icon??icons[0])===icon}/><span>{icon}</span></label>)}</div></fieldset><label>科目カラー<div className="color-choices">{colors.map(c=><button key={c} type="button" style={{background:c}} aria-label={`カラー ${c}`} onClick={e=>{const input=e.currentTarget.closest('form')?.elements.namedItem('color');if(input instanceof HTMLInputElement)input.value=c;}}/>)}<input name="color" type="color" aria-label="カスタムカラー" defaultValue={editor.value?.color??colors[0]}/></div></label></>:<><label>タイトル<input name="title" autoFocus required maxLength={160} defaultValue={editor.value?.title} placeholder="例：一次関数のグラフ"/></label><div className="form-row"><label>授業回<input name="sessionNumber" type="number" min="1" step="1" required defaultValue={editor.value?.sessionNumber??Math.max(0,...notes.map(n=>n.sessionNumber))+1}/></label><label>授業日（任意）<input name="date" type="date" defaultValue={editor.value?.date}/></label></div></>}
        {error&&<p role="alert" className="error">{error}</p>}<div className="dialog-actions"><button type="button" className="secondary" disabled={busy} onClick={()=>setEditor(undefined)}>キャンセル</button><button className="primary" disabled={busy}>{busy?'保存中…':editor.value?'変更を保存':'追加する'}</button></div>
      </form>}</>}
    </dialog>
  </div>;
}
function Empty({title,text,action,onAction}:{title:string;text:string;action:string;onAction:()=>void}){return <div className="empty-state"><span className="empty-symbol">▤</span><h2>{title}</h2><p>{text}</p><button className="primary" onClick={onAction}>{action}</button></div>;}
function formatDate(value:string){return new Intl.DateTimeFormat('ja-JP',{year:'numeric',month:'short',day:'numeric'}).format(new Date(value.length===10?`${value}T12:00:00`:value));}
