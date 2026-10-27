import {it,expect,vi} from 'vitest';
import {drawText} from './export-pdf';
it('複数行の回答を空行も含む行間でPDFへ描画し、文字を連結しない',()=>{
  const fillText=vi.fn(),context={save:vi.fn(),restore:vi.fn(),beginPath:vi.fn(),rect:vi.fn(),clip:vi.fn(),fillText};
  drawText(context as unknown as CanvasRenderingContext2D,{id:'a',pdfDocId:'p',pageIndex:0,kind:'answer',x:.1,y:.2,width:.4,height:.3,text:'一行目\n\n三行目',fontSize:18/595,color:'#2563eb'},595,842);
  expect(fillText.mock.calls.map(call=>call[0])).toEqual(['一行目','','三行目']);
  expect(fillText.mock.calls[2][1]).toBeCloseTo(59.5);expect(fillText.mock.calls[2][2]).toBeCloseTo(.2*842+2*18*1.45);
  expect(context.clip).toHaveBeenCalledOnce();expect(context.restore).toHaveBeenCalledOnce();
});
