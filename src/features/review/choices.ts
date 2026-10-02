import type {Card} from '../../db/models';
export function assessChoice(card:Card,selected:string){
  if(card.kind!=='mcq'||card.choices?.length!==4||new Set(card.choices).size!==4||!card.answer||!card.choices.includes(card.answer))throw new Error('選択肢または正解が不正です。AI回答を確認して取り込み直してください。');
  if(!card.choices.includes(selected))throw new Error('選択肢を選んでください。');
  return selected===card.answer;
}
