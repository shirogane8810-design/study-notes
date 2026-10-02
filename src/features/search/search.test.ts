import {describe,it,expect} from 'vitest';
import {findNotes,matchingRuns} from './search';
import {pageKey,resolvePage,textFromJson} from '../notes/page-links';
import type {Note,PdfDoc,TextNote} from '../../db/models';
const note:Note={id:'n',subjectId:'s',title:'一次関数',sessionNumber:1,order:0,createdAt:'2026-10-02',updatedAt:'2026-10-02'};
const doc:PdfDoc={id:'d',noteId:'n',fileName:'資料.pdf',blob:new Blob(),pages:[{kind:'pdf',srcPage:1},{kind:'grid',id:'g'},{kind:'pdf',srcPage:2}],extractedText:[{page:2,text:'Linear functions'}]};
describe('全文検索とページリンク',()=>{
  it('授業名・本文・PDFを検索して挿入後の表示ページへリンクする',()=>{
    const text:TextNote={id:'t',noteId:'n',content:{},plainText:'傾きと切片を復習'};
    expect(findNotes('一次', [note],[text],[doc])[0].kind).toBe('title');
    expect(findNotes('切片', [note],[text],[doc])[0].kind).toBe('note');
    const target=findNotes('ＬＩＮＥＡＲ', [note],[text],[doc])[0].target!;
    expect(target.pageIndex).toBe(2);expect(resolvePage({...doc,pages:[{kind:'blank',id:'b'},...doc.pages]},target)).toBe(3);
  });
  it('挿入用紙のリンクは固有IDで解決し、消えたリンクを別ページへ飛ばさない',()=>{
    const target={pdfDocId:'d',pageKey:pageKey(doc.pages[1],1),pageIndex:1};
    expect(resolvePage({...doc,pages:[doc.pages[1],doc.pages[0]]},target)).toBe(0);
    expect(resolvePage({...doc,pages:[doc.pages[0]]},target)).toBe(-1);
  });
  it('TipTapの数式・リンク・段落を検索用テキストへ変換する',()=>{
    expect(textFromJson({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'参照 '},{type:'pageLink',attrs:{label:'p.2'}}]},{type:'blockMath',attrs:{latex:'x^2'}}]})).toBe('参照 p.2\nx^2');
  });
  it('空文字をハイライトせず、大小文字を区別しない',()=>{
    const runs=[{text:'Linear functions',rect:[0,0,1,.1] as [number,number,number,number]},{text:'',rect:[0,0,0,0] as [number,number,number,number]}];
    expect(matchingRuns(runs,'linear')).toHaveLength(1);expect(matchingRuns(runs,' ')).toHaveLength(0);
  });
});
