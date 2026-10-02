import {z} from 'zod';
import {db,type StudyDatabase} from '../../db/database';
import type {PdfDoc} from '../../db/models';
import {pageKey} from '../notes/page-links';
import {newSchedule} from '../review/scheduler';
const text=z.string().trim().min(1).max(5000);
const common={question:text,answer:text,explanation:text,sourcePage:z.number().int().positive().nullable()};
const question=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('short'),...common}).strict(),
  z.object({kind:z.literal('mcq'),...common,choices:z.array(text).length(4)}).strict().superRefine((q,ctx)=>{if(new Set(q.choices).size!==4)ctx.addIssue({code:'custom',path:['choices'],message:'選択肢は重複しない4個にしてください。'});if(!q.choices.includes(q.answer))ctx.addIssue({code:'custom',path:['answer'],message:'正解は選択肢の文章と完全に一致させてください。'});}),
]);
export const responseSchema=z.object({summary:z.object({points:z.array(text).min(3).max(5),terms:z.array(text).max(30)}).strict(),questions:z.array(question).min(1).max(50)}).strict();
export type AiResponse=z.infer<typeof responseSchema>;
export const defaultTemplate='資料に書かれている内容だけを根拠に、日本語で要約と確認問題を作ってください。要点は3〜5個。4択のanswerは正解の選択肢と同じ文章にしてください。sourcePageは資料の[p.N]のN、テキストノートが根拠ならnullです。以下のJSONの形だけで返してください。';
export const example={summary:{points:['要点1','要点2','要点3'],terms:['重要用語']},questions:[{kind:'mcq',question:'確認問題',choices:['選択肢A','選択肢B','選択肢C','選択肢D'],answer:'選択肢A',explanation:'資料に基づく解説',sourcePage:1},{kind:'short',question:'一問一答',answer:'答え',explanation:'資料に基づく解説',sourcePage:null}]};
export function extractJson(raw:string){if(raw.length>500000)throw new Error('回答は50万文字以内にしてください。');const blocks=[...raw.matchAll(/```(?:json)?\s*\n?([\s\S]*?)```/gi)];if(blocks.length>1)throw new Error('JSONのコードブロックは1個にしてください。');try{return JSON.parse(blocks.length?blocks[0][1].trim():raw.trim()) as unknown;}catch{throw new Error('JSONとして読めません。括弧・引用符・末尾のカンマを確認してください。');}}
const labels:Record<string,string>={summary:'要約',points:'要点',terms:'重要用語',questions:'問題',question:'問題文',choices:'選択肢',answer:'正解',explanation:'解説',sourcePage:'根拠ページ',kind:'形式'};
export function validateResponse(raw:string,doc:PdfDoc|undefined,from:number,to:number):AiResponse{
  const result=responseSchema.safeParse(extractJson(raw));
  if(!result.success)throw new Error(result.error.issues.map(i=>`${i.path.map(p=>typeof p==='number'?`${p+1}番目`:labels[String(p)]??String(p)).join(' → ')||'回答'}：${i.code==='custom'?i.message:'必須項目・文字数・形式・個数を確認してください。'}`).join('\n'));
  const seen=new Set<string>();for(const [i,q] of result.data.questions.entries()){if(seen.has(q.question))throw new Error(`問題 → ${i+1}番目：同じ問題文が重複しています。`);seen.add(q.question);if(q.sourcePage!==null&&(!doc||q.sourcePage<from||q.sourcePage>to||q.sourcePage>doc.pages.length))throw new Error(`問題 → ${i+1}番目 → 根拠ページ：コピーしたページ範囲内を指定してください。`);}
  return result.data;
}
export function pdfText(doc:PdfDoc,from:number,to:number){if(!Number.isInteger(from)||!Number.isInteger(to)||from<1||to<from||to>doc.pages.length)throw new Error('ページ範囲が不正です。');return doc.pages.slice(from-1,to).map((p,i)=>`[p.${from+i}]\n${p.kind==='pdf'?doc.extractedText.find(t=>t.page===p.srcPage)?.text||'（抽出できる文字がありません）':'（挿入した用紙。手書き文字は抽出できません）'}`).join('\n\n');}
export function buildPrompt(template:string,plainText:string,doc:PdfDoc|undefined,from:number,to:number){return `${template.trim()||defaultTemplate}\n\n【JSON形式の例】\n${JSON.stringify({...example,questions:example.questions.map(q=>({...q,sourcePage:doc?(q.kind==='mcq'?from:null):null}))},null,2)}\n\n【PDF資料${doc?`：${doc.fileName}`:''}】\n${doc?pdfText(doc,from,to):'（PDFなし）'}\n\n【テキストノート】\n${plainText||'（本文なし）'}`;}
export async function importResponse(noteId:string,response:AiResponse,doc:PdfDoc|undefined,from:number,to:number,database:StudyDatabase=db){
  const parsed=validateResponse(JSON.stringify(response),doc,from,to);const now=new Date();
  await database.transaction('rw',database.notes,database.pdfDocs,database.cards,database.aiSummaries,async()=>{
    if(!await database.notes.get(noteId))throw new Error('授業が見つかりません。');
    const latest=doc?await database.pdfDocs.get(doc.id):undefined;if(doc&&(!latest||latest.noteId!==noteId))throw new Error('資料が変更されています。コピーからやり直してください。');
    if(doc&&latest&&JSON.stringify(latest.pages)!==JSON.stringify(doc.pages))throw new Error('ページ構成が変わりました。コピーからやり直してください。');
    await database.aiSummaries.add({id:crypto.randomUUID(),noteId,...parsed.summary,importedAt:now.toISOString()});
    await database.cards.bulkAdd(parsed.questions.map(q=>({id:crypto.randomUUID(),noteId,kind:q.kind,question:q.question,answer:q.answer,explanation:q.explanation,...(q.kind==='mcq'?{choices:q.choices}:{}),...(latest&&q.sourcePage!==null?{pdfDocId:latest.id,pageIndex:q.sourcePage-1,sourcePage:q.sourcePage,sourcePageKey:pageKey(latest.pages[q.sourcePage-1],q.sourcePage-1)}:{}),fsrs:newSchedule(now),createdAt:now.toISOString()})));
  });
}
export async function saveTemplate(promptTemplate:string,database:StudyDatabase=db){if(promptTemplate.length>10000)throw new Error('指示文は1万文字以内にしてください。');await database.transaction('rw',database.settings,async()=>{const current=await database.settings.get('main');await database.settings.put({...current,id:'main',maskColor:current?.maskColor??'#ef4444',promptTemplate,penPresets:current?.penPresets??[],theme:current?.theme??'light'});});}

