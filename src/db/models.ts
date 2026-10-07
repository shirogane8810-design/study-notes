export interface Exam { name: string; date: string }
export interface Subject { id: string; name: string; color: string; icon: string; order: number; exams: Exam[]; createdAt: string }
export interface Note { id: string; subjectId: string; sessionNumber: number; title: string; date?: string; order: number; createdAt: string; updatedAt: string; lastOpenedAt?: string }
export type PageRef = {kind:'pdf';srcPage:number} | {kind:'blank'|'ruled'|'grid';id?:string};
export interface PdfDoc { id:string;noteId:string;fileName:string;blob:Blob;pages:PageRef[];textIndexed?:boolean;extractedText:{page:number;text:string;runs?:{text:string;rect:[number,number,number,number]}[]}[] }
export interface Stroke { id:string;pdfDocId:string;pageIndex:number;tool:'pen'|'highlighter';color:string;width:number;points:[number,number,number][];createdAt?:number }
export interface TextNote { id:string;noteId:string;content:Record<string,unknown>;plainText:string }
export interface Card { id:string;noteId:string;kind:'mask'|'mcq'|'short';pdfDocId?:string;pageIndex?:number;rect?:[number,number,number,number];strokeIds?:string[];question?:string;choices?:string[];answer?:string;explanation?:string;sourcePage?:number;sourcePageKey?:string;fsrs:Record<string,unknown>;createdAt:string }
export interface ReviewLog { id:string;cardId:string;rating:number;reviewedAt:string;previousFsrs?:Record<string,unknown>;scheduleLog?:Record<string,unknown> }
export interface AiSummary { id:string;noteId:string;points:string[];terms:string[];importedAt:string }
export interface PageCheck { id:string;pdfDocId:string;pageIndex:number;checkedAt:string }
export interface Settings { id:string;maskColor:string;promptTemplate:string;lastExportAt?:string;penPresets:{color:string;width:number}[];theme:'light'|'dark' }

export interface TextBox { kind?:'answer';id:string;pdfDocId:string;pageIndex:number;x:number;y:number;width:number;height:number;text:string;color:string;fontSize:number }
