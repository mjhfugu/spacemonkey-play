import {camera,add,sub,mul,dot,length,norm} from './math.js';
export const weapons=[
 {id:'pulse',name:'Tick pulse emitter',short:'PULSE',cost:0,damage:13,heat:8,interval:.24,tech:1,range:1100,color:'#ead2a0',description:'Reliable single pulses. Low heat, precise aim.'},
 {id:'burst',name:'Rattle burst emitter',short:'BURST',cost:280,damage:9,heat:5,interval:.52,tech:3,range:1000,color:'#e5b16e',burst:3,description:'Three rapid shots. Walk the burst across a turning target.'},
 {id:'beam',name:'Thread beam emitter',short:'BEAM',cost:650,damage:6,heat:2.8,interval:.065,tech:5,range:850,color:'#9adecf',description:'Continuous cutting beam. Track your target and watch the heat.'},
 {id:'scatter',name:'Fork scatter emitter',short:'SCATTER',cost:500,damage:8,heat:19,interval:.55,tech:4,range:420,color:'#e4c989',pellets:5,description:'Five diverging rays. Devastating on a close pass; weak at range.'},
 {id:'charge',name:'Spindle charge lance',short:'CHARGE',cost:1200,damage:75,heat:34,interval:.8,tech:7,range:1800,color:'#b6d4f0',charge:true,description:'Hold to charge, release to fire. Pierces heavy armour.'},
 {id:'extraction',name:'Quarry extraction emitter',short:'QUARRY',cost:450,damage:8,heat:12,interval:.55,tech:4,range:650,color:'#d5cf85',description:'Fractures asteroids into recoverable ore. Limited combat output.'},
 {id:'military',name:'Crownline emitter',short:'CROWNLINE',cost:2400,damage:30,heat:23,interval:.26,tech:9,range:1200,color:'#efb7a8',description:'Heavy twin discharge. High impact, very high heat.'}
];
export const weaponFor=g=>weapons.find(w=>w.id===g.p.weapons[g.view]);
export function aimContact(g,range=1100){const b=camera(g.b,g.view);let hit=null,best=range;for(const e of g.entities){const v=sub(e.pos,g.position),along=dot(v,b.forward),radius=e.radius??(e.type==='asteroid'?22:e.type==='cargo'?6:e.type==='warship'?40:22);if(along>0&&along<best&&length(sub(v,mul(b.forward,along)))<radius){hit=e;best=along;}}return hit;}
function emit(g,w,power=1){
 if(g.overheated)return;
 g.heat=Math.min(100,g.heat+w.heat*(w.charge?.4+power*.6:1));
 if(g.heat>=100){g.overheated=true;g.notify('Emitter overheated. Release fire to cool.');}
 g.fireFlash=w.id==='beam'?.09:w.charge?.18:.095;g.shotWeapon=w.id;g.shotPower=power;g.shotRays=[];
 g.audio(w.id==='beam'?'beam':w.id==='scatter'?'scatter':w.charge?'lance':w.id==='military'?'heavy':'fire');
 const b=camera(g.b,g.view),count=w.pellets||1;let anyHit=false;
 for(let i=0;i<count;i++){
  const spread=count>1?(i-(count-1)/2)*.047:0;
  const dir=norm(add(b.forward,add(mul(b.right,spread),mul(b.up,count>1?Math.sin(i*2)*.013:0))));
  let hit=null,best=w.range;
  for(const e of g.entities){const v=sub(e.pos,g.position),along=dot(v,dir),radius=e.radius??(e.type==='asteroid'?22:e.type==='cargo'?6:e.type==='warship'?40:22);
   if(along>0&&along<best&&length(sub(v,mul(dir,along)))<radius){hit=e;best=along;}}
  g.shotRays.push({direction:dir,distance:best});
  if(hit){
   anyHit=true;g.crimeForAttack(hit);hit.victim='player';if(['pirate','hostile'].includes(hit.type))hit.state='attack';
   let damage=w.charge?18+w.damage*power:w.damage;
   if(hit.armour&&!w.charge&&w.id!=='military')damage*=.7;
   if(hit.type==='asteroid'&&w.id==='extraction')damage=50;
   hit.hp-=damage;if(!hit.armour&&hit.hp<hit.maxHp*.55)hit.evade=Math.max(hit.evade||0,1.4);hit.hit=.18;g.hitConfirm=.18;
   g.effects.push({type:'spark',pos:add(g.position,mul(dir,best)),life:.24});
   if(hit.hp<=0)g.destroy(hit,w.id);
  }
 }
 if(g.trial){if(g.trial.shots===0&&g.radio?.role==='COMBAT INSTRUCTOR')g.radio.until=Math.min(g.radio.until,g.time+1.8);g.trial.shots++;if(anyHit)g.trial.hits++;}
 if(anyHit&&w.id!=='beam')g.audio('hit');
}
export function requestShot(g){
 if(g.docked||g.dead||g.paused||g.panel||g.cooldown>0||g.overheated||g.damageEquipment==='weapons')return;
 const w=weaponFor(g);if(!w){if(g.toastTimer<=0){g.notify('No emitter fitted to this view.');g.toastTimer=3;}return;}
 if(w.charge){if(!g.charging){g.charging=true;g.weaponCharge=0;g.chargeView=g.view;g.audio('charge');}return;}
 g.cooldown=w.interval;emit(g,w);
 if(w.burst){g.burstShots=w.burst-1;g.burstTimer=.085;g.burstWeapon=w.id;g.burstView=g.view;}
}
export function releaseShot(g){
 if(!g.charging)return;g.charging=false;
 const w=weapons.find(w=>w.id==='charge');
 if(g.weaponCharge>.08&&g.view===g.chargeView&&!g.overheated&&!g.paused&&!g.panel){g.cooldown=w.interval;emit(g,w,Math.min(1,g.weaponCharge));}
 g.weaponCharge=0;
}
export function updateWeapons(g,dt){
 if(g.charging){if(g.view!==g.chargeView||g.panel||g.autodock){g.charging=false;g.weaponCharge=0;}else g.weaponCharge=Math.min(1,g.weaponCharge+dt/1.1);}
 if(g.burstShots>0){g.burstTimer-=dt;if(g.burstTimer<=0){if(g.view===g.burstView&&!g.overheated&&!g.panel){emit(g,weapons.find(w=>w.id===g.burstWeapon));g.burstShots--;g.burstTimer=.085;}else g.burstShots=0;}}
}
