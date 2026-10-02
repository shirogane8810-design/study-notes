import {createEmptyCard,fsrs,type Card as FsrsCard,type Grade} from 'ts-fsrs';
import {z} from 'zod';
import type {Card} from '../../db/models';
const schedule=z.object({due:z.string().datetime(),stability:z.number().nonnegative(),difficulty:z.number().min(0).max(10),elapsed_days:z.number().nonnegative(),scheduled_days:z.number().nonnegative(),learning_steps:z.number().int().nonnegative(),reps:z.number().int().nonnegative(),lapses:z.number().int().nonnegative(),state:z.number().int().min(0).max(3),last_review:z.string().datetime().optional()});
const engine=fsrs({enable_fuzz:false});
export function serialize(value:object):Record<string,unknown>{return JSON.parse(JSON.stringify(value)) as Record<string,unknown>;}
export function newSchedule(now=new Date()){return serialize(createEmptyCard(now));}
export function readSchedule(value:Record<string,unknown>):FsrsCard{const parsed=schedule.parse(value);return {...parsed,due:new Date(parsed.due),last_review:parsed.last_review?new Date(parsed.last_review):undefined};}
export function rateSchedule(value:Record<string,unknown>,rating:Grade,now=new Date()){const result=engine.next(readSchedule(value),now,rating);return {card:serialize(result.card),log:serialize(result.log)};}
export function dueAt(card:Card){try{return readSchedule(card.fsrs).due.getTime();}catch{return Infinity;}}
export function dueCards(cards:Card[],now=Date.now()){return cards.filter(c=>c.kind!=='mask'&&dueAt(c)<=now).sort((a,b)=>dueAt(a)-dueAt(b));}
export const ratings=[{value:1,label:'もう一度'},{value:2,label:'難しい'},{value:3,label:'正解'},{value:4,label:'簡単'}] as const;
export function intervalLabel(due:number,now=Date.now()){const minutes=Math.max(1,Math.round((due-now)/60000));return minutes<60?`${minutes}分後`:minutes<1440?`${Math.round(minutes/60)}時間後`:`${Math.round(minutes/1440)}日後`;}
