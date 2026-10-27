import {expect,it} from 'vitest';
import {answerAt,fitAnswer,answerLines,textAt,isTextDrag} from './answer-input';
const box={id:'a',pdfDocId:'p',pageIndex:0,x:.2,y:.2,width:.3,height:.1,text:'',color:'#2563eb',fontSize:18/595};
it('クリック位置に配置し、文字数に合わせて一行の幅を変える',()=>{const empty=answerAt(box,.2,.4,595/842);expect(empty.x).toBe(.2);expect(empty.y).toBe(.4);const filled=fitAnswer(empty,'政策手段',595/842);expect(filled.width).toBeGreaterThan(empty.width);expect(filled.height).toBe(empty.height);expect(filled.x).toBe(empty.x);expect(filled.kind).toBe('answer');});
it('ページ端で枠を収め、改行と貼り付けたCRLFを保持する',()=>{const edge=answerAt(box,.99,1,1);const next=fitAnswer(edge,'長い回答\r\n次の行',1);expect(next.x+next.width).toBeLessThanOrEqual(1);expect(next.y+next.height).toBeLessThanOrEqual(1);expect(next.text).toBe('長い回答\n次の行');expect(answerLines('a\rb\r\n')).toEqual(['a','b','']);});
it('複数行と空行の高さを確保し、幅は最長の行に合わせる',()=>{const one=fitAnswer(box,'長い回答',595/842),multi=fitAnswer(box,'長い回答\n\n次',595/842);expect(multi.height).toBeCloseTo(one.height*3);expect(multi.width).toBeCloseTo(one.width);expect(multi.x).toBe(box.x);expect(multi.y).toBe(box.y);expect(fitAnswer(multi,'一行',595/842).height).toBeCloseTo(one.height);});
it('実測幅を使い、拡大表示でも正規化されたサイズを保つ',()=>{expect(fitAnswer(box,'回答',595/842,.15).width).toBeCloseTo(.15+box.fontSize*.4);});

it('通常テキストは内側の余白を引いて文字の開始点をクリック位置に合わせる',()=>{const next=textAt(box,.8,.9,800,1000);expect(next.x*800+12).toBeCloseTo(640);expect(next.y*1000+12).toBeCloseTo(900);expect(next.x+next.width).toBeLessThanOrEqual(1);expect(next.y+next.height).toBeLessThanOrEqual(1);});
it('クリックの揺れとドラッグを区別する',()=>{expect(isTextDrag(10,10,12,11)).toBe(false);expect(isTextDrag(10,10,14,10)).toBe(true);});
