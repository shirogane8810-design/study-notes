import {useEffect,useMemo,useRef,useState} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {EditorContent,useEditor} from '@tiptap/react';
import {Node,mergeAttributes} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Mathematics from '@tiptap/extension-mathematics';
import 'katex/dist/katex.min.css';
import {db} from '../../db/database';
import type {TextNote} from '../../db/models';
import {TextNoteWriter} from '../pdf/autosave';
import {textFromJson,resolvePage,type PageTarget} from './page-links';

const PageLink=Node.create({name:'pageLink',inline:true,group:'inline',atom:true,
  addAttributes(){return {pdfDocId:{default:''},pageKey:{default:''},pageIndex:{default:0},label:{default:'p.1'}};},
  parseHTML(){return [];},
  renderHTML({node,HTMLAttributes}){return ['button',mergeAttributes(HTMLAttributes,{type:'button',class:'page-link',title:'PDFのページを開く'}),String(node.attrs.label)];},
});
export function TextNotebook(props:{noteId:string;current?:PageTarget;onJump:(target:PageTarget)=>void}){
  const saved=useLiveQuery(async()=>(await db.textNotes.where('noteId').equals(props.noteId).first())??null,[props.noteId]);
  return saved===undefined?<p role="status">ノートを読み込んでいます…</p>:<NotebookEditor key={props.noteId} {...props} saved={saved}/>;
}
function NotebookEditor({noteId,current,onJump,saved}:{noteId:string;current?:PageTarget;onJump:(target:PageTarget)=>void;saved:TextNote|null}){
  const docs=useLiveQuery(()=>db.pdfDocs.where('noteId').equals(noteId).toArray(),[noteId]);
  const [status,setStatus]=useState<'saving'|'saved'|'error'>('saved');const writer=useMemo(()=>new TextNoteWriter(setStatus),[]);
  const [math,setMath]=useState<{latex:string;pos?:number}>();const mathDialog=useRef<HTMLDialogElement>(null);
  const jump=useRef(onJump);jump.current=onJump;
  const editor=useEditor({extensions:[StarterKit.configure({heading:{levels:[1,2,3]},link:{openOnClick:false}}),TaskList,TaskItem.configure({nested:true,a11y:{checkboxLabel:node=>`チェック：${node.textContent||'項目'}`}}),PageLink,Mathematics.configure({katexOptions:{throwOnError:false,trust:false},blockOptions:{onClick:(node,pos)=>setMath({latex:String(node.attrs.latex),pos})}})],
    content:saved?.content??{type:'doc',content:[{type:'paragraph'}]},
    editorProps:{attributes:{'aria-label':'授業のテキストノート',role:'textbox','aria-multiline':'true'},handleClickOn:(_view,_pos,node)=>{if(node.type.name!=='pageLink')return false;const a=node.attrs;if(typeof a.pdfDocId==='string'&&typeof a.pageKey==='string')jump.current({pdfDocId:a.pdfDocId,pageKey:a.pageKey,pageIndex:Number(a.pageIndex)});return true;}},
    onUpdate:({editor:e})=>writer.queue({id:saved?.id??`text:${noteId}`,noteId,content:{...e.getJSON()},plainText:textFromJson(e.getJSON())}),
    onBlur:()=>{void writer.flush().catch(()=>{});},
  });
  useEffect(()=>{if(!editor||!docs)return;const transaction=editor.state.tr;editor.state.doc.descendants((node,pos)=>{if(node.type.name!=='pageLink')return;const doc=docs.find(d=>d.id===node.attrs.pdfDocId);const index=doc?resolvePage(doc,{pdfDocId:doc.id,pageKey:String(node.attrs.pageKey),pageIndex:Number(node.attrs.pageIndex)}):-1;const label=index<0?'リンク切れ':`p.${index+1}`;if(node.attrs.label!==label)transaction.setNodeMarkup(pos,undefined,{...node.attrs,label,pageIndex:index});});if(transaction.docChanged)editor.view.dispatch(transaction.setMeta('addToHistory',false));},[docs,editor]);
  useEffect(()=>{const leave=()=>{void writer.flush().catch(()=>{});};const visibility=()=>{if(document.hidden)leave();};window.addEventListener('pagehide',leave);document.addEventListener('visibilitychange',visibility);return()=>{window.removeEventListener('pagehide',leave);document.removeEventListener('visibilitychange',visibility);writer.dispose();};},[writer]);
  useEffect(()=>{if(math)mathDialog.current?.showModal();else mathDialog.current?.close();},[math]);
  return <div className="text-notebook">
    <div className="notebook-toolbar" aria-label="テキストノートの書式">
      <button onClick={()=>editor?.chain().focus().toggleHeading({level:2}).run()}>見出し</button>
      <button onClick={()=>editor?.chain().focus().toggleBold().run()}><strong>太字</strong></button>
      <button onClick={()=>editor?.chain().focus().toggleBulletList().run()}>箇条書き</button>
      <button onClick={()=>editor?.chain().focus().toggleTaskList().run()}>チェック</button>
      <button onClick={()=>setMath({latex:'y = ax + b'})}>数式</button>
      <button disabled={!current} onClick={()=>{if(current)editor?.chain().focus().insertContent({type:'pageLink',attrs:{...current,label:`p.${current.pageIndex+1}`}}).insertContent(' ').run();}}>＋ 今のページ{current?` p.${current.pageIndex+1}`:''}</button>
    </div>
    <EditorContent editor={editor} className="notebook-content"/>
    <div className="notebook-status" role="status">{status==='saved'?'自動保存済み':status==='saving'?'保存中…':'保存できません'}{status==='error'&&<button onClick={()=>void writer.flush().catch(()=>{})}>再試行</button>}<span>リンクを押すとPDFへ移動</span></div>
    <dialog ref={mathDialog} aria-label="数式を編集" onCancel={()=>setMath(undefined)}>{math&&<form onSubmit={e=>{e.preventDefault();if(math.pos===undefined)editor?.chain().focus().insertBlockMath({latex:math.latex}).run();else editor?.chain().focus().updateBlockMath({pos:math.pos,latex:math.latex}).run();setMath(undefined);}}><h3>数式を編集</h3><label>LaTeX形式の数式<textarea aria-label="LaTeX形式の数式" maxLength={2000} value={math.latex} onChange={e=>setMath({...math,latex:e.target.value})}/></label><p>例：x^2、\frac&#123;1&#125;&#123;2&#125;、\sqrt&#123;x&#125;</p><div className="dialog-actions"><button type="button" onClick={()=>setMath(undefined)}>キャンセル</button><button className="primary" disabled={!math.latex.trim()}>挿入・更新</button></div></form>}</dialog>
  </div>;
}
