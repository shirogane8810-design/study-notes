import Dexie, { type EntityTable } from 'dexie';
import type { TextBox,Subject,Note,PdfDoc,Stroke,TextNote,Card,ReviewLog,AiSummary,PageCheck,Settings } from './models';
export class StudyDatabase extends Dexie {
  subjects!:EntityTable<Subject,'id'>; notes!:EntityTable<Note,'id'>; pdfDocs!:EntityTable<PdfDoc,'id'>;
  textBoxes!:EntityTable<TextBox,'id'>; strokes!:EntityTable<Stroke,'id'>; textNotes!:EntityTable<TextNote,'id'>; cards!:EntityTable<Card,'id'>;
  reviewLogs!:EntityTable<ReviewLog,'id'>; aiSummaries!:EntityTable<AiSummary,'id'>; pageChecks!:EntityTable<PageCheck,'id'>; settings!:EntityTable<Settings,'id'>;
  constructor(name='study-notes'){super(name);this.version(1).stores({subjects:'id, order',notes:'id, subjectId, [subjectId+order], lastOpenedAt',pdfDocs:'id, noteId',strokes:'id, pdfDocId, [pdfDocId+pageIndex]',textNotes:'id, &noteId',cards:'id, noteId, pdfDocId',reviewLogs:'id, cardId, reviewedAt',aiSummaries:'id, noteId',pageChecks:'id, pdfDocId, &[pdfDocId+pageIndex]',settings:'id'});this.version(2).stores({textBoxes:'id, pdfDocId, [pdfDocId+pageIndex]'});this.version(3).stores({}).upgrade(async tx=>{await tx.table<PdfDoc>('pdfDocs').toCollection().modify(doc=>{doc.pages=doc.pages.map(page=>page.kind==='pdf'||page.id?page:{...page,id:crypto.randomUUID()});});});}
}
export const db = new StudyDatabase();
