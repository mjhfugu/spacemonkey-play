import {clamp} from './math.js';

// Each finger owns its input until release/cancel; releasing one never releases another.
export class TouchInput {
 constructor(){this.pointers=new Map();this.axes={roll:0,pitch:0};this.keys=new Set();}
 press(id,key){this.pointers.set(id,key);this.rebuild();}
 release(id){this.pointers.delete(id);this.rebuild();}
 rebuild(){this.keys=new Set(this.pointers.values());}
 move(x,y,radius){const dead=.12;const axis=v=>Math.abs(v)<dead?0:Math.sign(v)*Math.pow(Math.min(1,(Math.abs(v)-dead)/(1-dead)),1.35);this.axes={roll:-axis(clamp(x/radius,-1,1)),pitch:axis(clamp(y/radius,-1,1))};}
 clear(){this.pointers.clear();this.keys.clear();this.axes={roll:0,pitch:0};}
}

export class TouchControls {
 constructor(game,ui){
  this.g=game;this.ui=ui;this.input=new TouchInput();this.stickPointer=null;
  const root=document.createElement('section');this.root=root;root.id='touch-controls';root.setAttribute('aria-label','Touch flight controls');
  root.innerHTML=`<div class="touch-flight"><div class="touch-stick" role="group" aria-label="Flight stick: drag up or down to pitch, left or right to roll"><span class="stick-label top">PITCH</span><span class="stick-label bottom">ROLL</span><div class="stick-cross"></div><div class="stick-knob"></div></div><div class="touch-throttle"><button data-hold="KeyR" aria-label="Increase speed">+<small>SPEED</small></button><button data-hold="KeyF" aria-label="Decrease speed">−<small>SPEED</small></button></div><div class="touch-weapons"><button class="touch-fire" data-hold="Space" aria-label="Fire weapon">FIRE</button><div class="touch-ordnance"><button data-command="missile" aria-label="Arm or launch missile">ARM MSL</button><button data-command="ecm" aria-label="Missile countermeasures">ECM</button></div></div></div><div class="touch-console-return"><button data-command="close">RETURN TO FLIGHT</button></div><div class="touch-actions"><button data-command="cruise">CRUISE</button><button data-command="jump">JUMP</button><button data-command="target">TARGET</button><button data-command="view">FWD VIEW</button><button data-command="pause">PAUSE</button><button data-command="more" aria-expanded="false" aria-controls="touch-more">MORE</button></div><div id="touch-more" hidden><button data-command="nav">HARBOUR NAV</button><button data-command="hail">HAIL</button><button data-command="manual">MANUAL</button><button data-command="dock">AUTO DOCK</button><button data-command="dump">DUMP CARGO</button><button data-command="region">REGION JUMP</button></div>`;
  const menu=root.querySelector('#touch-more');
  for(const name of ['cruise','target','view'])menu.prepend(root.querySelector('[data-command="'+name+'"]'));
  const chart=document.createElement('button');chart.dataset.command='chart';chart.textContent='STAR CHART';menu.append(chart);
  const status=document.createElement('div');status.className='touch-status';status.setAttribute('aria-label','Compact flight status');status.innerHTML='<div class="compact-weapon"></div><div class="compact-meters"></div>';root.append(status);this.status=status;
  document.getElementById('navigation').before(root);this.stick=root.querySelector('.touch-stick');this.knob=root.querySelector('.stick-knob');
  this.stick.addEventListener('pointerdown',e=>{if(!this.canFly()||this.stickPointer!==null)return;e.preventDefault();this.stickPointer=e.pointerId;this.stick.setPointerCapture(e.pointerId);this.move(e);});
  this.stick.addEventListener('pointermove',e=>{if(e.pointerId===this.stickPointer)this.move(e);});
  const stopStick=e=>{if(e.pointerId===this.stickPointer){this.stickPointer=null;this.input.axes={roll:0,pitch:0};this.knob.style.transform='translate(0,0)';}};
  for(const type of ['pointerup','pointercancel','lostpointercapture'])this.stick.addEventListener(type,stopStick);
  for(const button of root.querySelectorAll('[data-hold]')){
   button.addEventListener('pointerdown',e=>{if(!this.canFly())return;e.preventDefault();button.setPointerCapture(e.pointerId);this.input.press(e.pointerId,button.dataset.hold);if(button.dataset.hold==='Space')game.shoot();else game.speed=clamp(game.speed+(button.dataset.hold==='KeyR'?4:-4),0,100);button.classList.add('held');});
   const release=e=>{this.input.release(e.pointerId);if(button.dataset.hold==='Space'&&!this.input.keys.has('Space')){if(e.type==='pointerup')game.releaseTrigger();else{game.charging=false;game.weaponCharge=0;}}button.classList.toggle('held',this.input.keys.has(button.dataset.hold));};
   for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,release);
  }
  root.addEventListener('contextmenu',e=>e.preventDefault());root.addEventListener('click',e=>{const button=e.target.closest('[data-command]');if(button&&!button.disabled)this.command(button.dataset.command);});
  window.addEventListener('blur',()=>this.clear());window.addEventListener('pagehide',()=>this.clear());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clear();});window.addEventListener('resize',()=>this.clear());this.update();
 }
 canFly(){return !this.g.docked&&!this.g.dead&&!this.g.paused&&!this.g.panel;}
 move(e){const box=this.stick.getBoundingClientRect(),radius=box.width*.34,x=e.clientX-box.left-box.width/2,y=e.clientY-box.top-box.height/2;this.input.move(x,y,radius);const d=Math.hypot(x,y),scale=d>radius?radius/d:1;this.knob.style.transform=`translate(${x*scale}px,${y*scale}px)`;}
 clear(){this.input.clear();this.stickPointer=null;this.knob.style.transform='translate(0,0)';this.root.querySelectorAll('.held').forEach(b=>b.classList.remove('held'));this.g.touchAxes={roll:0,pitch:0};this.g.touchKeys=new Set();this.g.charging=false;this.g.weaponCharge=0;this.g.burstShots=0;}
 command(name){const g=this.g;this.clear();if(name==='more'){const more=this.root.querySelector('#touch-more');if(more.hidden){this.resumeAfterMenu=!g.paused;g.paused=true;more.hidden=false;}else{more.hidden=true;if(this.resumeAfterMenu)g.paused=false;}this.root.classList.toggle('menu-open',!more.hidden);this.root.querySelector('[data-command="more"]').setAttribute('aria-expanded',String(!more.hidden));return;}
  const menu=this.root.querySelector('#touch-more');if(!menu.hidden){menu.hidden=true;this.root.classList.remove('menu-open');this.root.querySelector('[data-command="more"]').setAttribute('aria-expanded','false');if(this.resumeAfterMenu)g.paused=false;}
  if(name==='chart'){this.ui.open('chart');return;}if(name==='cruise'&&g.trial){g.endTrial();return;}if(name==='pause'){g.paused=!g.paused;g.keys.clear();}else if(name==='close'){this.ui.closePanel();}else if(name==='manual'){this.ui.open('help');}else if(this.canFly()){if(name==='target')g.cycleTarget();if(name==='nav')g.stationNav();if(name==='hail')g.hail();if(name==='cruise'){if(g.trial)g.endTrial();else g.toggleCruise();}if(name==='jump'){if(g.trial)g.cycleTrialWeapon();else g.startJump();}if(name==='view')g.view=(g.view+1)%4;if(name==='missile')g.missile();if(name==='ecm')g.countermeasure();if(name==='dock')g.toggleDock();if(name==='dump')g.dump();if(name==='region')g.regionJump();}this.update();}
 update(){const g=this.g,active=!g.docked&&!g.dead&&g.panel!=='trialResult';this.root.classList.toggle('is-flight',active);this.root.classList.toggle('console-open',!!g.panel);if(!this.canFly())this.clear();g.touchAxes=this.input.axes;g.touchKeys=this.input.keys;
  const menuCanAct=this.canFly()||(this.root.classList.contains('menu-open')&&this.resumeAfterMenu&&!g.docked&&!g.dead&&!g.panel);
  const set=(name,text,disabled=false,pressed=null)=>{const b=this.root.querySelector(`[data-command="${name}"]`);if(b.textContent!==text)b.textContent=text;b.disabled=disabled;if(pressed!==null)b.setAttribute('aria-pressed',String(pressed));};
  set('pause',g.paused?'RESUME':'PAUSE',false,g.paused);set('view',['FWD VIEW','REAR VIEW','PORT VIEW','STBD VIEW'][g.view],!menuCanAct);set('cruise',g.trial?'EXIT SIM':g.cruise?'CRUISE ON':'CRUISE',!g.trial&&!this.canFly()&&!this.root.classList.contains('menu-open'),g.cruise);set('target','TARGET',!menuCanAct);set('nav','HARBOUR NAV',!menuCanAct);set('hail','HAIL',!menuCanAct||!g.target);set('jump',g.trial?'WEAPON':g.jump?'JUMPING':'JUMP',!this.canFly()||g.jump>0);set('missile',g.armed?(g.lockTime>=1?'FIRE MSL':'LOCKING'):'ARM MSL',!this.canFly()||g.p.missiles===0);set('ecm','ECM',!this.canFly()||!g.has('ecm')||g.energy<15||g.damageEquipment==='ecm');set('dock',g.autodock?'MANUAL':'AUTO DOCK',!menuCanAct||!g.has('autodock'));set('dump','DUMP CARGO',!menuCanAct||g.cargoUsed===0);set('region','REGION JUMP',!menuCanAct||!g.has('region'));for(const b of this.root.querySelectorAll('[data-hold]'))b.disabled=!this.canFly();
  this.root.querySelector('[data-command="more"]').textContent=this.root.classList.contains('menu-open')?'CLOSE':'MENU';
  this.root.querySelector('[data-command="chart"]').hidden=!!g.trial;
  const weapon=document.getElementById('weapon-name')?.textContent||'EMITTER';if(this.status.firstElementChild.textContent!==weapon)this.status.firstElementChild.textContent=weapon;
  const meterText='SHIELD '+Math.round(Math.min(g.front,g.rear))+'  •  CORE '+Math.max(0,Math.round(g.energy))+'  •  HEAT '+Math.round(g.heat)+'  •  SPEED '+Math.round(g.speed);
  if(this.status.lastElementChild.textContent!==meterText)this.status.lastElementChild.textContent=meterText;
  this.status.classList.toggle('warning',g.energy<30||g.overheated);

 }
}



