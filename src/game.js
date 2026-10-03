import {generateRegion,marketFor,distance,commodities,random,rank,species} from './universe.js';
import {add,sub,mul,dot,length,norm,basis,roll,pitch,camera,clamp,local,cross} from './math.js';
import {shipClasses} from './geometry.js';
import {updateNPCs,updateMissiles,enemyProfiles} from './encounters.js';
export const SAVE_KEY='spacemonkey.station.v1';
export const equipment=[
 {id:'hold',name:'Expanded cargo bay',cost:350,tech:2,description:'20 → 35 cargo units'},
 {id:'scoop',name:'Collection cradle',cost:260,tech:3,description:'Recover cargo; skim stellar fuel'},
 {id:'ecm',name:'Scatter countermeasures',cost:420,tech:4,description:'Disrupt nearby missiles [E]'},
 {id:'reactor',name:'Reserve reactor',cost:680,tech:5,description:'Faster energy regeneration'},
 {id:'shields',name:'Layered defence',cost:760,tech:5,description:'Stronger forward and rear fields'},
 {id:'autodock',name:'Harbour docking computer',cost:1100,tech:7,description:'Flies the approach for you [C]'},
 {id:'escape',name:'Return capsule',cost:600,tech:5,description:'Survive destruction; lose cargo'},
 {id:'nav',name:'Route computer',cost:300,tech:4,description:'Suggests chains of fuel stops'},
 {id:'region',name:'Farbranch region drive',cost:3200,tech:10,description:'Travel to another region [G]'}
];
import {weapons,requestShot,releaseShot,updateWeapons,aimContact,weaponFor} from './weapons.js';
export {weapons} from './weapons.js';
function fresh(){return {version:1,region:0,system:119,credits:160,fuel:5.2,cargo:Array(14).fill(0),equipment:[],weapons:['pulse',null,null,null],kills:0,legal:0,missiles:3,visits:0,epoch:0,missions:{courier:0,ashfall:0},name:'Nemi',species:'Capuchin'};}
export function validSave(s){return s&&s.version===1&&Number.isInteger(s.region)&&s.region>=0&&s.region<8&&Number.isInteger(s.system)&&s.system>=0&&s.system<256&&Number.isFinite(s.credits)&&s.credits>=0&&Number.isFinite(s.fuel)&&s.fuel>=0&&s.fuel<=7&&Array.isArray(s.cargo)&&s.cargo.length===14&&s.cargo.every(n=>Number.isInteger(n)&&n>=0&&n<=35)&&s.cargo.reduce((a,b)=>a+b,0)<=((Array.isArray(s.equipment)&&s.equipment.includes('hold'))?35:20)&&Array.isArray(s.equipment)&&s.equipment.every(x=>equipment.some(e=>e.id===x))&&Array.isArray(s.weapons)&&s.weapons.length===4&&s.weapons.every(w=>w===null||weapons.some(x=>x.id===w))&&['kills','legal','visits','epoch','missiles'].every(k=>Number.isInteger(s[k])&&s[k]>=0)&&s.missiles<=4&&s.missions&&['courier','ashfall'].every(k=>[0,1,2,3].includes(s.missions[k]))&&typeof s.name==='string'&&s.name.length<=30&&species.includes(s.species)&&(!s.savedMarket||(Array.isArray(s.savedMarket)&&s.savedMarket.length===14&&s.savedMarket.every(m=>m&&Number.isInteger(m.price)&&m.price>0&&Number.isInteger(m.stock)&&m.stock>=0)));}
export class Game {
 constructor(storage=null){
  this.storage=storage;this.saveWarning='';let saved=null;
  try{saved=JSON.parse(storage?.getItem(SAVE_KEY)||'null');}catch{this.saveWarning='Station record could not be read. A new pilot is ready.';}
  this.p=validSave(saved)?saved:fresh();this.preparePilot();this.checkpoint=structuredClone(this.p);
  this.systems=generateRegion(this.p.region);this.selected=this.nearest();this.market=this.p.savedMarket?structuredClone(this.p.savedMarket):marketFor(this.system,this.p.epoch);
  this.mode='solid';this.view=0;this.panel='dock';this.paused=false;this.keys=new Set();this.log=[...(this.p.transmissions||[])];this.message='';this.messageTime=0;this.radio=null;this.time=0;this.serial=0;this.sensitivity=1;
  this.rng=random(this.system.seed);this.onchange=()=>{};this.audio=()=>{};this.resetFlight();this.docked=true;this.notify(this.saveWarning||'Harbour link established. Your ship is ready.');
 }
 preparePilot(){
  if(!Array.isArray(this.p.cargoCost)||this.p.cargoCost.length!==14||!this.p.cargoCost.every(Number.isFinite))this.p.cargoCost=Array(14).fill(0);
  if(!Array.isArray(this.p.transmissions))this.p.transmissions=[];
 }
 get system(){return this.systems[this.p.system];}
 get capacity(){return this.has('hold')?35:20;}
 get cargoUsed(){return this.p.cargo.reduce((a,b)=>a+b,0);}
 get maxShield(){return this.has('shields')?150:100;}
 get rating(){return rank(this.p.kills);}
 get target(){return this.entities.find(e=>e.id===this.targetId)||null;}
 get stationRange(){return length(sub(this.station.pos,this.position));}
 get hostileCount(){return this.entities.filter(e=>e.state==='attack'&&length(sub(e.pos,this.position))<1200).length;}
 has(id){return this.p.equipment.includes(id);}
 commodityName(id){return commodities[id]?.name||'cargo';}
 nearest(){return this.systems.filter(s=>s.id!==this.p.system).sort((a,b)=>distance(a,this.system)-distance(b,this.system))[0].id;}
 resetFlight(){
  this.position=[0,0,0];this.b=basis();this.speed=0;this.rollRate=0;this.pitchRate=0;this.front=this.maxShield;this.rear=this.maxShield;this.energy=100;this.heat=0;this.cabin=0;this.shieldDelay=0;
  this.station={pos:[0,0,420],angle:0,type:this.system.stationType};this.planet=[-900,480,-3400];this.star=[1400,650,-4200];
  this.entities=[];this.projectiles=[];this.effects=[];this.cooldown=0;this.overheated=false;this.fireFlash=0;this.hitFlash=0;this.hitConfirm=0;this.jumpFlash=0;this.dockFlash=0;
  this.jump=0;this.jumpTarget=null;this.cruise=false;this.compression=1;this.autodock=false;this.dockPhase=false;this.armed=false;this.lock=null;this.lockTime=0;this.encounterTimer=32;
  this.ecmTime=0;this.dead=false;this.interstitial=false;this.hollowTimer=0;this.damageEquipment=null;this.targetId=null;this.navContact=false;this.collisionCooldown=0;this.departureTimer=0;this.flightTime=0;this.cruiseReason='';this.toastTimer=0;this.charging=false;this.weaponCharge=0;this.burstShots=0;this.shotRays=[];
 }
 notify(text,speaker=null){
  this.message=text;this.messageTime=speaker?10:6;
  this.radio=speaker?{...speaker,text,until:this.time+12}:null;
  this.log.unshift(text);this.log=this.log.slice(0,14);this.onchange();
 }
 save(){
  if(!this.docked||this.trial)return;
  this.p.savedMarket=structuredClone(this.market);this.p.transmissions=this.log.slice(0,10);this.checkpoint=structuredClone(this.p);
  try{if(!this.storage){this.saveWarning='Storage unavailable. Export your station record to keep it.';return;}this.storage.setItem(SAVE_KEY,JSON.stringify(this.p));this.saveWarning='';}catch{this.saveWarning='Browser storage unavailable. Export your station record in Pilot.';}
 }
 launch(){
  if(!this.docked)return;this.save();this.resetFlight();this.docked=false;this.paused=false;this.panel=null;this.view=0;this.position=[0,0,285];this.b=basis();roll(this.b,Math.PI);pitch(this.b,Math.PI);this.speed=34;
  const trader=this.spawn('trader',[85,22,15],{mesh:2,destination:[180,30,-1800],forward:[0,0,-1],pilot:'Oru Venn',species:'Macaque',rescueMerchant:true});
  this.spawn('trader',[-100,-45,-100],{mesh:6,destination:[-250,-80,-1600],forward:[0,0,-1]});
  if(this.system.security>4)this.spawn('patrol',[210,55,-260],{destination:[230,55,-1800],forward:[0,0,-1]});
  this.departureTimer=this.p.visits<2&&!this.p.firstRescue?7:0;this.departureVictim=trader.id;
  this.notify('Departure cleared. Convoy crossing ahead. Clear the harbour, then jump when ready.',{name:'Tiko Marr',species:'Capuchin',role:'HARBOUR CONTROL'});this.audio('dock');
 }
 dock(){
  if(this.docked)return;this.docked=true;this.speed=0;this.cruise=false;this.autodock=false;this.front=this.maxShield;this.rear=this.maxShield;this.energy=100;this.heat=0;this.damageEquipment=null;this.panel='dock';this.p.visits++;this.dockFlash=1;
  if(this.p.cargo[9]>0&&this.system.security>=6){const fine=Math.min(this.p.credits,this.p.cargo[9]*12);this.p.credits-=fine;this.p.legal+=this.p.cargo[9];this.notify(`Customs detected prohibited emitter cores. Fine: ${fine} cr.`);}
  else this.notify('Clamps secured. Ship serviced. Station record saved.',{name:'Tiko Marr',species:'Capuchin',role:'HARBOUR CONTROL'});
  this.missionCheck();this.save();this.audio('dock');this.onchange();
 }
 trade(index,amount){
  if(!this.docked||!this.market[index]||!Number.isInteger(amount)||amount===0)return false;
  const m=this.market[index],wanted=Math.abs(amount);
  const count=amount>0?Math.min(wanted,m.stock,this.capacity-this.cargoUsed,Math.floor(this.p.credits/m.price)):Math.min(wanted,this.p.cargo[index]);
  if(count<1)return false;
  if(amount>0){this.p.credits-=m.price*count;this.p.cargoCost[index]+=m.price*count;this.p.cargo[index]+=count;m.stock-=count;}
  else{const costPerUnit=this.p.cargo[index]?this.p.cargoCost[index]/this.p.cargo[index]:0;this.p.credits+=m.price*count;this.p.cargoCost[index]=Math.max(0,this.p.cargoCost[index]-costPerUnit*count);this.p.cargo[index]-=count;m.stock+=count;this.lastTrade={name:commodities[index].name,count,net:Math.round((m.price-costPerUnit)*count)};}
  this.audio('trade');this.save();this.onchange();return true;
 }
 refuel(){if(!this.docked)return;const units=Math.min(7-this.p.fuel,this.p.credits/4);if(units<.001)return;this.p.credits=Math.round((this.p.credits-units*4)*100)/100;this.p.fuel=clamp(this.p.fuel+units,0,7);this.save();this.notify('Fuel transfer complete.');this.audio('trade');}
 buy(id){if(!this.docked)return;const e=equipment.find(e=>e.id===id);if(!e||this.has(id)||this.p.credits<e.cost||this.system.tech<e.tech)return;this.p.credits-=e.cost;this.p.equipment.push(id);this.front=this.maxShield;this.rear=this.maxShield;this.save();this.notify(`${e.name} installed.`);this.audio('trade');}
 buyWeapon(id,mount){if(!this.docked||!Number.isInteger(mount)||mount<0||mount>3)return;const w=weapons.find(w=>w.id===id),price=w?.cost||90;if(!w||this.p.credits<price||this.system.tech<w.tech||this.p.weapons[mount]===id)return;this.p.credits-=price;this.p.weapons[mount]=id;this.save();this.notify(`${w.name} fitted.`);this.audio('trade');}
 buyMissile(){if(this.docked&&this.p.missiles<4&&this.p.credits>=45){this.p.credits-=45;this.p.missiles++;this.save();this.onchange();this.audio('trade');}}
 startJump(){if(this.trial)return this.notify('Jump drive disabled in the simulator. EXIT SIM returns to harbour.');
  if(this.trial)return this.notify('Jump drives are offline in the combat simulator.');if(this.docked||this.jump||this.dead)return;const dest=this.systems[this.selected],d=distance(this.system,dest);
  if(d<.01)return this.notify('Select another system in Chart.');
  if(d>7||d>this.p.fuel+.00001)return this.notify('Destination beyond available fuel.');
  if(this.stationRange<350&&!this.interstitial)return this.notify(`Harbour mass lock. Fly ${Math.ceil(350-this.stationRange)} units farther out.`);
  this.jumpTarget=this.selected;this.jumpCost=d;this.jump=5;this.cruise=false;this.autodock=false;this.panel=null;this.notify(`Jump drive charging: ${dest.name}.`);this.audio('jump');
 }
 arrive(){
  const target=this.systems[this.jumpTarget];this.p.fuel=Math.max(0,this.p.fuel-(this.jumpCost??distance(this.system,target)));this.p.system=target.id;this.p.epoch++;this.market=marketFor(target,this.p.epoch);this.rng=random(target.seed+this.p.epoch*317);
  this.resetFlight();this.docked=false;this.speed=48;this.station.pos=[0,0,2300];this.planet=[720,390,3800];this.star=[-1400,800,-3800];this.selected=this.nearest();this.encounterTimer=15;this.jumpFlash=1;
  this.interstitial=this.p.visits>1&&this.rng()<.025;
  this.notify(this.interstitial?'Jump shear. Hollow-space. Hold out while the drive locates a stable exit.':`${target.name} reached. Harbour beacon straight ahead. Engage cruise in clear space.`);
  if(this.interstitial){this.hollowTimer=30;this.station.pos=[0,0,4800];this.spawn('hostile',[90,25,500]);this.spawn('hostile',[-100,-30,700]);}
  else{
   const type=this.system.security<4?'pirate':this.system.security>=6?'patrol':'trader';
   const e=this.spawn(type,[90,40,850],{destination:[200,35,1800]});
   if(type==='pirate'){this.targetId=e.id;this.notify('Cut your drive, little traveller. Your cargo buys your way past.',{name:e.pilot,species:e.species,role:'UNLICENSED CONTACT'});}
   else if(type==='patrol')this.notify('Patrol channel clear. Keep weapons cold on the harbour approach.',{name:e.pilot,species:e.species,role:'SYSTEM PATROL'});
   this.spawn('asteroid',[-410,-140,1450]);this.spawn('asteroid',[-490,-115,1590]);
  }
  this.missionSpawn();this.audio('arrival');
 }
 regionJump(){if(this.trial)return;if(this.docked||!this.has('region')||this.p.fuel<7||this.massLocked())return this.notify('Region drive requires full fuel and clear space.');this.p.region=(this.p.region+1)%8;this.systems=generateRegion(this.p.region);this.p.system=119;this.jumpTarget=119;this.jumpCost=7;this.arrive();this.notify('Farbranch transit complete. A new region awaits.');}
 massLocked(){
  this.cruiseReason='';
  if(this.stationRange<420)this.cruiseReason='HARBOUR APPROACH';
  else if(this.projectiles.some(m=>m.hostile))this.cruiseReason='INCOMING MISSILE';
  else if(this.interstitial)this.cruiseReason='UNSTABLE SPACE';
  else{const e=this.entities.find(e=>e.type!=='cargo'&&length(sub(e.pos,this.position))<(e.state==='attack'?420:250));if(e)this.cruiseReason=e.type==='asteroid'?'DEBRIS FIELD':'NEARBY CONTACT';}
  return !!this.cruiseReason;
 }
 toggleCruise(){if(this.trial)return this.notify('Compression disabled during combat trials.');if(this.docked||this.jump)return;this.cruise=!this.cruise;if(this.cruise&&this.massLocked()){this.cruise=false;return this.notify(`Cruise inhibited: ${this.cruiseReason.toLowerCase()}.`);}if(this.cruise&&this.speed<30)this.speed=48;this.notify(this.cruise?'Space compression engaged.':'Normal space restored.');this.audio('cruise');}
 toggleDock(){if(!this.has('autodock')||this.damageEquipment==='autodock')return this.notify('Fit a Harbour docking computer to automate the approach.');if(!this.docked){this.autodock=!this.autodock;this.dockPhase=false;this.cruise=false;this.navContact=false;this.notify(this.autodock?'Harbour computer has the helm.':'Manual flight restored.');}}
 cycleTarget(){const contacts=this.entities.filter(e=>e.type!=='cargo').sort((a,b)=>length(sub(a.pos,this.position))-length(sub(b.pos,this.position)));if(!contacts.length){this.targetId=null;this.navContact=false;return this.notify('No local contacts.');}const index=contacts.findIndex(e=>e.id===this.targetId);this.targetId=contacts[(index+1)%contacts.length].id;this.navContact=true;this.audio('select');}
 stationNav(){this.navContact=false;this.audio('select');}
 hail(){
  const e=this.target;if(!e)return this.notify('Select a contact first.');
  const line=e.type==='pirate'?'There are easier ways to lose that cargo. Slow down and make this civil.':e.type==='patrol'?'Keep the lane clear. We are watching for raiders.':e.type==='miner'?'Good ore off the main lane. Bring an extraction emitter and a collection cradle.':`I buy where it is made and sell where it is needed. ${economyHint(this.system.economy)}`;
  this.notify(line,{name:e.pilot,species:e.species,role:e.type.toUpperCase()});this.audio('radio');
 }
 spawn(type,pos,extra={}){
  const options=shipClasses.filter(c=>c.role===(type==='courier'?'trader':type==='hostile'||type==='warship'?'pirate':type));
  const cls=options.length?options[Math.floor(this.rng()*options.length)]:shipClasses[Math.floor(this.rng()*30)];
  const archetype=type==='pirate'?enemyProfiles[cls.family==='needle'?0:cls.family==='outrigger'?1:cls.family==='freighter'||cls.family==='extractor'?2:cls.family==='wing'?3:4]:null;
  const id=++this.serial;const hostile=['pirate','hostile','warship'].includes(type);
  const e={id,type,pos:[...pos],vel:[0,0,-22],forward:[0,0,-1],angle:0,mesh:cls.id,hp:type==='asteroid'?36:hostile?62:82,maxHp:hostile?62:82,name:cls.name,pilot:['Oru Venn','Sava Rill','Tiko Marr','Ena Voss','Kesh Daro','Miri Quell','Raku Flint','Simi Vale'][id%8],species:species[id%8],state:hostile?'attack':'travel',victim:'player',fire:1.2+this.rng()*1.3,age:0,...(archetype?{tactic:archetype.tactic,weapon:archetype.weapon,armour:archetype.armour,cruiseSpeed:archetype.cruiseSpeed,turnRate:archetype.turnRate,hp:archetype.hp}:{}),...extra};
  e.maxHp=extra.maxHp||e.hp;e.scale=type==='warship'?2.5:([2,4].includes(e.mesh%6)?2.05:1.9);e.radius=type==='asteroid'?22:type==='cargo'?6:type==='warship'?55:32;e.shieldDelay=0;
  if(extra.mesh!==undefined)e.name=extra.name||shipClasses[extra.mesh].name;
  this.entities.push(e);return e;
 }
 encounter(){
  if(this.entities.filter(e=>e.type!=='cargo'&&e.type!=='asteroid').length>=5||this.stationRange<550)return;
  const low=this.system.security<4,r=this.rng(),type=r<(low?.48:.08)?'pirate':r<.57?'trader':r<.85?'patrol':'miner';
  const offset=add(mul(this.b.forward,650),add(mul(this.b.right,(this.rng()-.5)*330),mul(this.b.up,(this.rng()-.5)*150)));
  const e=this.spawn(type,add(this.position,offset));
  if(type==='pirate'){if(!this.target)this.targetId=e.id;this.notify('Drive signature acquired. A raider is closing.',{name:'Ship receiver',species:this.p.species,role:'LOCAL BAND'});if(low&&this.p.visits>2&&this.rng()<.35)this.spawn('pirate',add(e.pos,[110,-40,160]));}
  if(type==='miner')this.spawn('asteroid',add(e.pos,[50,0,100]));
 }
 crimeForAttack(e){if(['trader','miner','patrol'].includes(e.type)&&!e.provoked){this.p.legal+=e.type==='patrol'?12:4;e.provoked=true;e.state=e.type==='patrol'?'attack':'flee';e.victim='player';this.notify('Unlawful weapons discharge recorded.');}}
 shoot(){requestShot(this);}
 releaseTrigger(){releaseShot(this);}
 destroy(e,weapon='pulse',playerKill=true){
  if(!this.entities.includes(e))return;
  this.entities=this.entities.filter(x=>x!==e);this.effects.push({type:'burst',pos:[...e.pos],life:1.6,size:(e.radius||22),seed:e.id});
  if(e.type==='asteroid'){if(weapon==='extraction')for(let i=0;i<3;i++)this.spawn('cargo',add(e.pos,[i*11-11,i*4,0]),{commodity:10,vel:[0,0,0]});else if(playerKill)this.notify('Rock vaporised. An extraction emitter preserves collectible ore.');}
  else if(e.type!=='cargo'){
   if(playerKill){this.p.kills++;if(this.trial)this.trial.kills++;if(['pirate','hostile','courier','warship'].includes(e.type)){const reward=e.type==='warship'?1800:55+e.mesh*3;this.p.credits+=reward;this.notify(this.trial?`${e.name} neutralised. ${this.trial.kills} / ${this.trial.count} contacts down.`:`Confirmed: ${e.name}. Bounty +${reward} cr.`);}else{this.p.legal+=8;this.notify('Protected vessel destroyed. Warrant updated.');}}
   this.spawn('cargo',[...e.pos],{commodity:Math.floor(this.rng()*14),vel:[0,0,0]});
   if(e.rescueRaider&&playerKill){this.p.credits+=80;this.p.firstRescue=true;this.notify('That was close. Eighty credits for the trouble, Commander. I owe you a quiet crossing.',{name:'Oru Venn',species:'Macaque',role:'MERCHANT / +80 CR'});}
   if(e.type==='courier'&&playerKill){this.p.missions.courier=2;this.p.credits+=700;this.notify('The corrupted relay has gone silent. Your transfer is cleared.',{name:'Nemi Coil',species:'Tamarin',role:'AUTHORITY / +700 CR'});}
   if(e.type==='warship'&&playerKill){this.p.missions.ashfall=3;this.notify('Its drive signature is gone. The settlements will sleep tonight. Thank you.',{name:'Miri Quell',species:'Marmoset',role:'ASHFALL / COMPLETE'});}
  }
  if(this.targetId===e.id){const next=this.entities.find(x=>x.state==='attack');this.targetId=next?.id||null;if(!next)this.navContact=false;}
  this.audio('explode');
 }
 missile(){if(this.docked)return;if(!this.armed){if(!this.p.missiles)return this.notify('No missiles remaining.');this.armed=true;this.lock=null;this.lockTime=0;return this.notify('Missile armed. Keep a vessel in the sight to lock.');}if(!this.lock||this.lockTime<1)return this.notify('Hold the target in the sight for a stable lock.');const e=this.entities.find(e=>e.id===this.lock);if(!e)return;this.p.missiles--;this.projectiles.push({pos:[...this.position],forward:[...camera(this.b,this.view).forward],target:e.id,life:12,hostile:false});this.armed=false;this.lock=null;this.audio('missile');this.notify('Missile away.');}
 countermeasure(){if(!this.has('ecm')||this.energy<15||this.damageEquipment==='ecm')return this.notify('Countermeasures unavailable.');this.energy-=15;this.projectiles=[];this.ecmTime=1;this.audio('ecm');this.notify('Scatter field discharged.');}
 dump(){if(this.docked)return;const index=this.p.cargo.findIndex(n=>n>0);if(index<0)return this.notify('Cargo hold empty.');const unitCost=this.p.cargoCost[index]/this.p.cargo[index];this.p.cargo[index]--;this.p.cargoCost[index]=Math.max(0,this.p.cargoCost[index]-unitCost);this.spawn('cargo',add(this.position,mul(this.b.forward,-30)),{commodity:index,vel:[0,0,0]});for(const e of this.entities)if(e.type==='pirate'&&length(sub(e.pos,this.position))<700){e.state='flee';e.victim=null;}this.notify(`${commodities[index].name} jettisoned. Nearby raiders break pursuit.`);}
 damage(amount,source){if(this.dead||this.docked)return;if(this.trial)this.trial.damage+=amount;const rear=dot(sub(source,this.position),this.b.forward)<0,key=rear?'rear':'front',absorbed=Math.min(this[key],amount);this[key]-=absorbed;this.energy-=amount-absorbed;this.hitFlash=.28;this.shieldDelay=3;this.hitDirection=local(sub(source,this.position),this.b);this.audio('impact');if(!this.trial&&absorbed<amount&&this.rng()<.08){const fitted=['weapons',...['scoop','ecm','autodock'].filter(id=>this.has(id))];this.damageEquipment=fitted[Math.floor(this.rng()*fitted.length)];this.notify(`Equipment fault: ${this.damageEquipment}. Station repair required.`);this.audio('failure');}if(this.energy<=0)this.die();}
 die(){if(this.trial){this.finishTrial(false);this.audio('explode');return;}if(this.has('escape')){this.p.equipment=this.p.equipment.filter(e=>e!=='escape');this.p.cargo.fill(0);this.p.cargoCost.fill(0);this.resetFlight();this.docked=false;this.dock();this.notify('Return capsule recovered. Cargo lost; capsule expended.');}else{this.dead=true;this.speed=0;this.cruise=false;this.panel='death';this.notify('Signal lost. Your last station record is safe.');}this.audio('explode');}
 restore(){let saved;try{saved=JSON.parse(this.storage?.getItem(SAVE_KEY)||'null');}catch{}this.p=validSave(saved)?saved:structuredClone(this.checkpoint||fresh());this.preparePilot();this.systems=generateRegion(this.p.region);this.market=this.p.savedMarket?structuredClone(this.p.savedMarket):marketFor(this.system,this.p.epoch);this.selected=this.nearest();this.resetFlight();this.docked=true;this.paused=false;this.panel='dock';this.notify('Station record restored.');}
 startTrial(weapon='pulse',enemy='skirmisher',count=1){
  if(!this.docked&&!this.trial)return;
  const original=this.trial?.original||{pilot:structuredClone(this.p),market:structuredClone(this.market),selected:this.selected,log:[...this.log]};
  this.p=structuredClone(original.pilot);this.p.equipment=['ecm'];this.p.weapons=Array(4).fill(weapons.some(w=>w.id===weapon)?weapon:'pulse');this.p.missiles=3;this.p.legal=0;this.p.cargo.fill(0);this.p.cargoCost.fill(0);
  this.resetFlight();this.trial={original,weapon:this.p.weapons[0],enemy,count:clamp(Math.round(count),1,3),shots:0,hits:0,kills:0,damage:0,result:null,finishDelay:0};
  this.position=[0,0,0];this.b=basis();this.speed=38;this.view=0;this.docked=false;this.paused=false;this.panel=null;this.station.pos=[0,0,-10000];this.planet=[-1800,900,3100];this.star=[1400,850,4400];this.encounterTimer=1e9;this.rng=random(9127+this.p.epoch*17);
  const profile=enemyProfiles.find(e=>e.id===enemy)||enemyProfiles[0];
  for(let i=0;i<this.trial.count;i++){const opponent=enemy==='mixed'?[enemyProfiles[1],enemyProfiles[4],enemyProfiles[2]][i]:profile;const e=this.spawn('pirate',[i===0?-28:(i%2?140:-140),i===0?12:(i%2?-45:60),340+i*140],{...opponent,mesh:opponent.mesh,name:opponent.name,pilot:opponent.pilot,species:opponent.species,hp:opponent.hp,maxHp:opponent.hp,id:++this.serial,forward:[0,0,-1],special:true});if(i===0)this.targetId=e.id;}
  this.navContact=true;this.notify('Live weapons simulation. Track the contact, manage heat, and break away from its firing line.',{name:'Sava Rill',species:'Mandrill',role:'COMBAT INSTRUCTOR'});this.audio('arrival');this.onchange();
 }
 finishTrial(won){if(!this.trial||this.trial.result!==null)return;this.trial.result=won;this.trial.duration=this.flightTime;this.paused=true;this.dead=!won;this.panel='trialResult';this.keys.clear();this.audio(won?'dock':'failure');this.onchange();}
 endTrial(){if(!this.trial)return;const original=this.trial.original;this.trial=null;this.p=original.pilot;this.market=original.market;this.selected=original.selected;this.log=original.log;this.resetFlight();this.docked=true;this.paused=false;this.panel='dock';this.notify('Simulation ended. Your commander and cargo are unchanged.');}
 cycleTrialWeapon(){if(!this.trial)return;this.charging=false;this.weaponCharge=0;const index=weapons.findIndex(w=>w.id===this.p.weapons[0]);const next=weapons[(index+1)%weapons.length];this.p.weapons=Array(4).fill(next.id);this.trial.weapon=next.id;this.heat=0;this.cooldown=0;this.overheated=false;this.burstShots=0;this.notify(`${next.name}: ${next.description}`);this.audio('select');}
 missionCheck(){
  if(this.p.visits>=3&&this.p.missions.courier===0){this.p.missions.courier=1;this.p.missions.courierSystem=this.nearest();this.notify(`An unmanned courier carries compromised navigation data. Intercept it in ${this.systems[this.p.missions.courierSystem].name}. Authority bounty: 700 cr.`,{name:'Nemi Coil',species:'Tamarin',role:'PRIVATE CHANNEL'});}
  if(this.p.kills>=8&&this.p.visits>=6&&this.p.missions.ashfall===0){this.p.missions.ashfall=1;this.p.missions.ashfallSystem=this.nearest();this.notify(`A weapon test went wrong. Meet my relay in ${this.systems[this.p.missions.ashfallSystem].name}. Keep this off the public band.`,{name:'Miri Quell',species:'Marmoset',role:'ENCRYPTED RELAY'});}
 }
 missionSpawn(){
  if(this.p.missions.courier===1&&(this.p.missions.courierSystem===undefined||this.p.system===this.p.missions.courierSystem)){const e=this.spawn('courier',[60,20,650],{name:'Silent Courier',hp:125,state:'flee',special:true});this.targetId=e.id;this.notify('Courier signature confirmed. It is trying to leave the system.',{name:'Nemi Coil',species:'Tamarin',role:'AUTHORITY RELAY'});}
  if(this.p.missions.ashfall===1&&this.p.system===this.p.missions.ashfallSystem){this.p.missions.ashfall=2;this.p.missions.ashfallSystem=this.nearest();this.notify(`I found the Crown. It is refuelling near ${this.systems[this.p.missions.ashfallSystem].name}. Expect escorts; fit countermeasures.`,{name:'Miri Quell',species:'Marmoset',role:'ENCRYPTED RELAY'});}
  else if(this.p.missions.ashfall===2&&(this.p.missions.ashfallSystem===undefined||this.p.system===this.p.missions.ashfallSystem)){const e=this.spawn('warship',[-50,50,800],{name:'Ashfall Crown',mesh:29,hp:340,state:'attack',special:true});this.spawn('pirate',[100,-40,1000]);this.targetId=e.id;}
 }
 dockingInfo(){
  const rel=sub(this.position,this.station.pos),a=-this.station.angle;
  return {range:length(rel),x:rel[0]*Math.cos(a)-rel[1]*Math.sin(a),y:rel[0]*Math.sin(a)+rel[1]*Math.cos(a),z:rel[2],roll:Math.atan2(this.b.right[1],this.b.right[0])-this.station.angle,axis:this.b.forward[2]};
 }
 fly(dt){
  if(this.autodock){
   const approach=add(this.station.pos,[0,0,-220]),to=sub(approach,this.position),d=length(to);
   if(!this.dockPhase&&d>10){const aim=norm(to),blend=Math.min(1,dt*1.8);this.b.forward=norm(add(mul(this.b.forward,1-blend),mul(aim,blend)));this.b.right=norm(cross(Math.abs(this.b.forward[1])>.98?[1,0,0]:[0,1,0],this.b.forward));this.b.up=norm(cross(this.b.forward,this.b.right));this.speed=Math.min(75,d*.8);}
   else{this.dockPhase=true;const aim=norm(sub(this.station.pos,this.position));this.b.forward=norm(add(mul(this.b.forward,1-dt*2),mul(aim,dt*2)));const r=[Math.cos(this.station.angle),Math.sin(this.station.angle),0];this.b.up=norm(cross(this.b.forward,r));this.b.right=norm(cross(this.b.up,this.b.forward));this.speed=17;}
  }else if(!this.panel){
   const pressed=k=>this.keys.has(k)||this.touchKeys?.has(k);
   const r=clamp((pressed('ArrowLeft')||pressed('KeyA')?1:0)-(pressed('ArrowRight')||pressed('KeyD')?1:0)+(this.touchAxes?.roll||0),-1,1);
   const p=clamp((pressed('ArrowDown')||pressed('KeyS')?1:0)-(pressed('ArrowUp')||pressed('KeyW')?1:0)+(this.touchAxes?.pitch||0),-1,1);
   // Short response smoothing removes digital jolts without introducing drift.
   const response=1-Math.exp(-dt*18);this.rollRate+=(r*1.65*this.sensitivity-this.rollRate)*response;this.pitchRate+=(p*1.15*this.sensitivity-this.pitchRate)*response;
   if(!r&&Math.abs(this.rollRate)<.01)this.rollRate=0;if(!p&&Math.abs(this.pitchRate)<.01)this.pitchRate=0;
   if(this.rollRate)roll(this.b,this.rollRate*dt);if(this.pitchRate)pitch(this.b,this.pitchRate*dt);
   if(pressed('KeyR'))this.speed=clamp(this.speed+dt*34,0,100);if(pressed('KeyF'))this.speed=clamp(this.speed-dt*45,0,100);if(pressed('Space'))this.shoot();else this.releaseTrigger();
  }else{this.rollRate=0;this.pitchRate=0;}
  if(this.cruise&&this.massLocked()){this.cruise=false;this.compression=1;this.notify(`Compression released: ${this.cruiseReason.toLowerCase()}.`);this.audio('select');}
  const desired=this.cruise?16:1;this.compression+=(desired-this.compression)*Math.min(1,dt*3);
  if(!this.cruise&&this.compression<1.01)this.compression=1;
  this.position=add(this.position,mul(this.b.forward,this.speed*dt*this.compression));
 }
 stationCollision(dt){
  const d=this.dockingInfo();if(this.collisionCooldown>0)return false;
  if(Math.abs(d.z)<28&&Math.hypot(d.x,d.y)<50){
   const aligned=Math.abs(Math.sin(d.roll))<.32;
   if(d.z<0&&Math.abs(d.x)<18&&Math.abs(d.y)<9&&d.axis>.96&&aligned&&this.speed<=28){this.dock();return true;}
   this.damage(35+this.speed*.25,this.station.pos);this.collisionCooldown=1.1;this.position=add(this.position,mul(this.b.forward,-25));this.speed=5;this.autodock=false;
   this.notify(this.speed>28?'Docking speed too high.':!aligned?'Match your roll to the amber aperture.':'Hull strike. Centre the aperture and approach its front face.');return this.dead;
  }
  return false;
 }
 update(dt){
  if(this.paused||this.dead)return;
  this.time+=dt;this.messageTime=Math.max(0,this.messageTime-dt);this.station.angle+=dt*.105;this.dockFlash=Math.max(0,this.dockFlash-dt);
  if(this.docked)return;this.flightTime+=dt;
  for(const key of ['cooldown','fireFlash','hitFlash','hitConfirm','ecmTime','jumpFlash','collisionCooldown','toastTimer','shieldDelay'])this[key]=Math.max(0,this[key]-dt);
  this.heat=Math.max(0,this.heat-dt*17);if(this.heat<30)this.overheated=false;
  this.energy=Math.min(100,this.energy+dt*(this.has('reactor')?5.5:1.9));
  for(const key of ['front','rear'])if(this.shieldDelay<=0&&this[key]<this.maxShield&&this.energy>15){const n=Math.min(dt*1.6,this.maxShield-this[key]);this[key]+=n;this.energy-=n*.65;}
  const starDist=length(sub(this.position,this.star));this.cabin=clamp(100-starDist/8,0,100);
  if(this.cabin>90)this.damage(dt*10,this.star);if(this.has('scoop')&&starDist<750&&starDist>280)this.p.fuel=Math.min(7,this.p.fuel+dt*.18);
  if(this.dead||this.docked)return;
  this.fly(dt);updateWeapons(this,dt);this.aimTarget=aimContact(this,weaponFor(this)?.range||0);if(this.stationCollision(dt)||this.docked||this.dead)return;
  if(length(sub(this.position,this.planet))<420&&this.collisionCooldown<=0){this.damage(45,this.planet);this.collisionCooldown=1;this.notify('Atmospheric boundary. Pull away from the planet.');}
  if(this.departureTimer>0){this.departureTimer-=dt;if(this.departureTimer<=0){const trader=this.entities.find(e=>e.id===this.departureVictim);if(trader){const pos=add(this.position,add(mul(this.b.forward,380),mul(this.b.right,45)));const e=this.spawn('pirate',pos,{mesh:1,hp:52,maxHp:52,victim:trader.id,rescueRaider:true,pilot:'Kesh Daro',species:'Langur'});this.targetId=e.id;this.notify('A raider is cutting into the lane. I am hauling keepsakes, not guns. Anyone willing to help?',{name:'Oru Venn',species:'Macaque',role:'OPEN DISTRESS BAND'});}}}
  this.encounterTimer-=dt;if(this.encounterTimer<=0){this.encounter();this.encounterTimer=40+this.rng()*25;}
  if(this.interstitial){this.hollowTimer-=dt;if(this.hollowTimer<=0){this.interstitial=false;this.notify('Stable exit located. Harbour beacon restored; cruise is available.');}}
  updateNPCs(this,dt);if(this.dead||this.docked)return;updateMissiles(this,dt);
  if(this.armed){const dir=camera(this.b,this.view).forward;const e=this.entities.find(e=>e.type!=='cargo'&&e.type!=='asteroid'&&dot(norm(sub(e.pos,this.position)),dir)>.986&&length(sub(e.pos,this.position))<1100);if(e){if(this.lock===e.id)this.lockTime+=dt;else{this.lock=e.id;this.lockTime=0;}if(this.lockTime>=1&&this.lockTime-dt<1){this.audio('lock');this.notify('Missile lock confirmed.');}}else{this.lock=null;this.lockTime=0;}}
  this.effects=this.effects.filter(e=>(e.life-=dt)>0);
  if(this.trial&&!this.entities.some(e=>e.state==='attack')){this.trial.finishDelay+=dt;if(this.trial.finishDelay>1.7){this.finishTrial(true);return;}}
  if(this.jump>0){const before=Math.ceil(this.jump);this.jump-=dt;if(Math.ceil(this.jump)<before)this.audio('tick');if(this.jump<=0)this.arrive();}
 }
}
function economyHint(economy){return ['Grain and nectar are plentiful here.','Crystal ore rarely stays cheap beyond the mining belts.','Hull ceramics travel well.','Logic wafers fetch good money in the frontier.','The local artisans are worth a visit.','Frontier crews pay well for machinery.'][economy];}


