import {db,type StudyDatabase} from '../../db/database';
import type {TextBox} from '../../db/models';
import type {Change} from './geometry';
export type EditChange={kind:'ink';change:Change}|{kind:'text';before?:TextBox;after?:TextBox};
export function textChanged(before:TextBox|undefined,after:TextBox|undefined){return JSON.stringify(before)!==JSON.stringify(after);}
export async function persistTextEdit(edit:Extract<EditChange,{kind:'text'}>,inverse=false,database:StudyDatabase=db){
  const box=inverse?edit.before:edit.after,remove=inverse?edit.after:edit.before;
  await database.transaction('rw',database.textBoxes,async()=>{if(box)await database.textBoxes.put(box);else if(remove)await database.textBoxes.delete(remove.id);});
}
