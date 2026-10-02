import {it,expect} from 'vitest';
import {assessChoice} from './choices';
import {newSchedule} from './scheduler';
import {reviewCard,undoReview} from './repository';
import {StudyDatabase} from '../../db/database';
import type {Card} from '../../db/models';
const card:Card={id:'c',noteId:'n',kind:'mcq',question:'傾きは？',choices:['1','2','3','4'],answer:'2',fsrs:newSchedule(),createdAt:new Date().toISOString()};
it('4択の正誤を判定し不正な正解・重複選択肢を拒否する',()=>{expect(assessChoice(card,'2')).toBe(true);expect(assessChoice(card,'1')).toBe(false);expect(()=>assessChoice({...card,answer:'5'},'1')).toThrow();expect(()=>assessChoice({...card,choices:['1','1','2','3']},'1')).toThrow();});
it('不正解をもう一度で保存し履歴と期限を取り消せる',async()=>{const d=new StudyDatabase(crypto.randomUUID());await d.cards.put(card);const result=await reviewCard(card,assessChoice(card,'1')?3:1,new Date(),d);expect((await d.reviewLogs.get(result.id))?.rating).toBe(1);expect((await d.cards.get(card.id))?.fsrs.reps).toBe(1);await undoReview(result.id,d);expect((await d.cards.get(card.id))?.fsrs).toEqual(card.fsrs);await d.delete();});
