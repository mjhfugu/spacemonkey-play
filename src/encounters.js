import {add,sub,mul,dot,length,norm,cross,basis,clamp} from './math.js';

export const enemyProfiles=[
 {id:'skirmisher',name:'Cinder Finch',mesh:1,hp:110,armour:false,tactic:'sweep',weapon:'pulse',cruiseSpeed:38,turnRate:.9,pilot:'Kesh Daro',species:'Langur',description:'Fast needle craft. A rolling attack pass, then a wide turn.'},
 {id:'interceptor',name:'Stone Plover',mesh:18,hp:140,armour:false,tactic:'jink',weapon:'burst',cruiseSpeed:46,turnRate:1.2,pilot:'Raku Flint',species:'Tamarin',description:'Twin outriggers. Jinks across your nose and fires three-round bursts.'},
 {id:'gunship',name:'Quiet Loom',mesh:8,hp:280,armour:true,tactic:'stand',weapon:'beam',cruiseSpeed:23,turnRate:.55,pilot:'Dara Coil',species:'Mandrill',description:'Armoured cargo conversion. Slow turns, heavy forward fire.'},
 {id:'ace',name:'Thorn Carrier',mesh:27,hp:190,armour:false,tactic:'jink',weapon:'military',cruiseSpeed:55,turnRate:1.55,pilot:'Simi Vale',species:'Macaque',description:'Broad swept wings. Aggressive turns and dangerous twin emitters.'},
 {id:'missileboat',name:'Glass Mantis',mesh:23,hp:170,armour:false,tactic:'stand',weapon:'pulse',cruiseSpeed:30,turnRate:.75,pilot:'Pella Voss',species:'Spider monkey',description:'Forked missile boat. Keeps its distance and launches guided weapons.'}
];
export function steer(entity,direction,rate,dt){
 const aim=norm(direction),forward=entity.forward||norm(entity.vel||[0,0,1]);
 const amount=Math.min(1,rate*dt);
 let blended=add(mul(forward,1-amount),mul(aim,amount));
 if(length(blended)<.01)blended=[1,0,0];
 entity.forward=norm(blended);
}
export function contactBasis(e){
 const forward=e.forward||norm(e.vel||[0,0,1]);
 const right=norm(cross(Math.abs(forward[1])>.98?[1,0,0]:[0,1,0],forward));
 const up=norm(cross(forward,right)),a=e.angle||0;return {forward,right:add(mul(right,Math.cos(a)),mul(up,Math.sin(a))),up:add(mul(up,Math.cos(a)),mul(right,-Math.sin(a)))};
}
export function updateNPCs(g,dt){
 for(const e of [...g.entities]){
  if(!g.entities.includes(e))continue;
  e.age+=dt;e.fire-=dt;e.hit=Math.max(0,(e.hit||0)-dt);e.muzzle=Math.max(0,(e.muzzle||0)-dt);
  const toPlayer=sub(g.position,e.pos),range=length(toPlayer);
  if(e.type==='cargo'){
   e.angle+=dt*.2;
   if(range<25&&g.has('scoop')&&g.damageEquipment!=='scoop'&&g.cargoUsed<g.capacity){
    const dir=norm(sub(e.pos,g.position));
    if(dot(dir,g.b.up)<.45&&dot(dir,g.b.forward)>-.4){g.p.cargo[e.commodity]++;g.entities=g.entities.filter(x=>x!==e);g.notify(`Cargo secured: ${g.commodityName(e.commodity)}.`);g.audio('scoop');}
   }
   continue;
  }
  if(e.type==='asteroid'){e.angle+=dt*.04;continue;}
  if(e.type==='patrol'&&g.p.legal>6)e.state='attack';
  let target=null;
  if(e.state==='attack'){
   target=e.victim==='player'?{pos:g.position,player:true}:g.entities.find(x=>x.id===e.victim);
   if(!target)target={pos:g.position,player:true};
  }else if(e.type==='patrol'){
   target=g.entities.find(x=>['pirate','hostile','warship'].includes(x.type)&&length(sub(e.pos,x.pos))<850);
  }
  if(target){
   const toTarget=sub(target.pos,e.pos),d=length(toTarget),aim=norm(toTarget);
   if(d<(e.tactic==='stand'?180:100))e.evade=e.tactic==='jink'?1.6:2.2;
   e.evade=Math.max(0,(e.evade||0)-dt);
   const liningUp=e.fire<.65&&e.evade<=0;
   const desired=liningUp?aim:e.evade>0?add(mul(aim,-1),[Math.sin(e.id*3)*1.2,.5,Math.cos(e.id*2)]):add(aim,[Math.sin(e.age*(e.tactic==='jink'?1.7:.6)+e.id)*(e.tactic==='jink'?.2:.05),Math.cos(e.age*.7)*(e.tactic==='jink'?.13:.04),0]);
   steer(e,desired,liningUp?3.4:e.evade>0?2.4:(e.turnRate||.85),dt);
   e.vel=mul(e.forward,e.type==='warship'?24:e.evade>0?(e.cruiseSpeed||38)*1.2:(e.cruiseSpeed||38));
   e.telegraph=d<950&&dot(e.forward,aim)>.97&&e.fire<.35;
   if(target.player&&e.mesh===23&&e.age>3&&d>120&&d<1000&&(e.missileCooldown||0)<=0&&(e.missileAmmo??2)>0){
    e.missileAmmo=(e.missileAmmo??2)-1;e.missileCooldown=12;g.projectiles.push({pos:[...e.pos],forward:[...e.forward],hostile:true,life:12});g.notify('INCOMING MISSILE — evade or discharge ECM');g.audio('warning');
   }
   e.missileCooldown=Math.max(0,(e.missileCooldown||0)-dt);
   if(d<950&&d>40&&dot(e.forward,aim)>.975&&e.fire<=0){
    if(e.weapon==='burst'){e.burstLeft=e.burstLeft===undefined?2:e.burstLeft-1;e.fire=e.burstLeft>0?.16:2.3;if(e.burstLeft<=0)e.burstLeft=undefined;}else if(e.weapon==='beam'){e.beamLeft=e.beamLeft===undefined?4:e.beamLeft-1;e.fire=e.beamLeft>0?.12:2.5;if(e.beamLeft<=0)e.beamLeft=undefined;}else e.fire=e.type==='warship'?1.1:1.4+g.rng()*1.2;
    // A shot travels along the craft's actual nose; turning out of its firing line works.
    const error=length(sub(toTarget,mul(e.forward,dot(toTarget,e.forward))));
    const hit=error<(target.player?17:22);
    e.muzzle=.15;const end=add(e.pos,mul(e.forward,Math.min(d+80,1100))),origin=add(e.pos,mul(e.forward,22*(e.scale||1))); 
    g.effects.push({type:'beam',from:origin,pos:end,life:e.weapon==='beam'?.15:.12,hostile:e.type!=='patrol',weapon:e.weapon});if(d<550&&(e.weapon!=='beam'||e.beamLeft===4))g.audio('enemyfire');
    if(hit){if(target.player)g.damage(e.type==='warship'?16:e.weapon==='military'?18:e.weapon==='burst'?5:e.weapon==='beam'?5:12,e.pos);else{target.hp-=12;target.hit=.15;if(target.hp<=0)g.destroy(target,'npc',false);}}
    if(target.player&&e.mesh!==23&&g.system.security<4&&e.age>20&&g.rng()<.05&&g.projectiles.filter(m=>m.hostile).length<2){
     g.projectiles.push({pos:[...e.pos],forward:[...e.forward],hostile:true,life:12});g.notify('INCOMING MISSILE — evade or discharge ECM');g.audio('warning');
    }
   }
  }else if(e.state==='flee'){
   steer(e,toPlayer.map(x=>-x),.8,dt);e.vel=mul(e.forward,38);
  }else if(e.type==='miner'){
   const rock=g.entities.find(x=>x.type==='asteroid'&&length(sub(e.pos,x.pos))<500);
   if(rock){const v=sub(rock.pos,e.pos);steer(e,v,1,dt);e.vel=mul(e.forward,length(v)>100?20:0);if(e.fire<=0){e.fire=5;g.effects.push({type:'beam',from:[...e.pos],pos:[...rock.pos],life:.2});}}
  }else{
   const destination=e.destination||add(g.station.pos,[0,0,-1500]);
   steer(e,sub(destination,e.pos),.45,dt);e.vel=mul(e.forward,e.type==='patrol'?32:22);
   if(e.destination&&length(sub(e.pos,e.destination))<35){g.entities=g.entities.filter(x=>x!==e);continue;}
  }
  e.angle=Math.sin(e.age*(e.tactic==='jink'?2.2:.7)+e.id)*(e.evade>0?.65:e.tactic==='jink'?.3:.12);
  if(e.hp<e.maxHp*.35&&Math.floor(e.age*9)!==Math.floor((e.age-dt)*9))g.effects.push({type:'smoke',pos:add(e.pos,mul(e.forward,-25*(e.scale||1))),life:.7,seed:e.id});
  e.pos=add(e.pos,mul(e.vel,dt));
  if(range<(e.radius||22)&&g.collisionCooldown<=0){g.damage(24,e.pos);g.collisionCooldown=.8;g.speed*=.5;e.pos=add(e.pos,mul(norm(toPlayer),-65));g.notify('Contact collision.');}
  if(range>5500&&!e.special)g.entities=g.entities.filter(x=>x!==e);
 }
}
export function updateMissiles(g,dt){
 for(const m of [...g.projectiles]){
  const target=m.hostile?g.position:g.entities.find(e=>e.id===m.target)?.pos;
  m.life-=dt;
  if(!target||m.life<=0){g.projectiles=g.projectiles.filter(x=>x!==m);continue;}
  const v=sub(target,m.pos),aim=norm(v);
  m.forward=norm(add(mul(m.forward||aim,.95),mul(aim,.05)));
  const before=[...m.pos];m.pos=add(m.pos,mul(m.forward,dt*170));
  if(length(sub(target,m.pos))<20){
   if(m.hostile)g.damage(58,m.pos);else{const e=g.entities.find(e=>e.id===m.target);if(e){g.crimeForAttack(e);e.hp-=110;e.hit=.2;if(e.hp<=0)g.destroy(e);}}
   g.effects.push({type:'burst',pos:[...m.pos],life:.55});g.projectiles=g.projectiles.filter(x=>x!==m);
  }
 }
}

