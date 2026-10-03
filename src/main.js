import {Game} from './game.js';
import {Renderer} from './renderer.js';
import {UI} from './ui.js';
import {TouchControls} from './touch.js';
import {AudioEngine} from './audio.js';
import {enemyProfiles} from './encounters.js';
let storage;try{storage=window.localStorage;}catch{}
const setting=(key,fallback)=>{try{return storage?.getItem('spacemonkey.'+key)??fallback;}catch{return fallback;}};
const remember=(key,value)=>{try{storage?.setItem('spacemonkey.'+key,String(value));}catch{}};
const game=new Game(storage),renderer=new Renderer(document.getElementById('space'),document.getElementById('scanner'));
game.mode=setting('render','solid')==='vector'?'vector':'solid';
const ui=new UI(game),touch=new TouchControls(game,ui),audio=new AudioEngine(setting('sound','on')!=='off');
game.save();game.audio=type=>audio.play(type);
const soundButton=document.getElementById('sound');soundButton.textContent=audio.enabled?'SOUND ON':'SOUND OFF';
soundButton.onclick=()=>{audio.enabled=!audio.enabled;audio.unlock();soundButton.textContent=audio.enabled?'SOUND ON':'SOUND OFF';remember('sound',audio.enabled?'on':'off');};
document.addEventListener('pointerdown',()=>audio.unlock(),{passive:true});
document.getElementById('mode').onclick=()=>{game.mode=game.mode==='vector'?'solid':'vector';remember('render',game.mode);ui.update();};
document.getElementById('select-contact').onclick=()=>game.cycleTarget();
document.getElementById('station-nav').onclick=()=>game.stationNav();
function clearInput(){game.keys.clear();touch.clear();game.charging=false;game.weaponCharge=0;game.burstShots=0;game.rollRate=0;game.pitchRate=0;}
document.addEventListener('keydown',e=>{
 if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
 audio.unlock();
 const flying=!game.docked&&!game.panel;
 if((flying&&['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))||(game.panel==='chart'&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code)))e.preventDefault();
 game.keys.add(e.code);if(e.repeat)return;
 if(e.code==='Escape'){if(game.panel==='trialResult')return;clearInput();ui.closePanel();}
 if(e.code==='KeyV')document.getElementById('mode').click();
 if(e.code==='KeyP'&&!game.dead&&!(game.trial&&game.trial.result!==null)){game.paused=!game.paused;clearInput();}
 if(e.code==='Slash')ui.open('help');
 if(e.code==='KeyL'&&game.docked)game.launch();
 const panel={Digit1:'dock',Digit2:'chart',Digit3:'market',Digit4:'equipment',Digit5:'pilot'}[e.code];if(panel)ui.open(panel);
 const view={Digit7:0,Digit8:1,Digit9:2,Digit0:3}[e.code];if(view!==undefined){game.charging=false;game.weaponCharge=0;game.burstShots=0;game.view=view;}
 if(game.panel==='chart'){
  ui.chartKey(e.code);if(e.code==='Tab'){ui.chartMode=ui.chartMode==='local'?'regional':'local';ui.renderPanel();}
  if(e.code==='Enter'&&!game.docked){game.panel=null;game.startJump();ui.renderPanel();}
 }
 if(!game.docked&&!game.panel&&!game.dead&&!game.paused){
  if(e.code==='Space')game.shoot();
  if(e.code==='KeyH')game.startJump();if(e.code==='KeyJ')game.toggleCruise();if(e.code==='KeyC')game.toggleDock();if(e.code==='KeyM')game.missile();if(e.code==='KeyE')game.countermeasure();if(e.code==='KeyX')game.dump();if(e.code==='KeyG')game.regionJump();
  if(e.code==='KeyT')game.cycleTarget();if(e.code==='KeyN')game.stationNav();if(e.code==='KeyI')game.hail();if(e.code==='KeyQ')game.cycleTrialWeapon();
 }
});
document.addEventListener('keyup',e=>{game.keys.delete(e.code);if(e.code==='Space')game.releaseTrigger();});
window.addEventListener('blur',()=>{clearInput();if(!game.docked)game.paused=true;});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(!game.docked)game.paused=true;}});
let previous=performance.now(),accumulator=0,uiTime=0;
function frame(now){
 const dt=Math.min((now-previous)/1000,.08);previous=now;touch.update();accumulator+=dt;
 while(accumulator>=1/60){game.update(1/60);accumulator-=1/60;}
 const renderStart=performance.now();renderer.draw(game);const renderCost=performance.now()-renderStart;
 const preview=document.getElementById('ship-preview');if(preview)renderer.preview(preview,ui.simEnemy==='mixed'?18:(enemyProfiles.find(e=>e.id===ui.simEnemy)||enemyProfiles[0]).mesh,game.mode,now/1000);
 if(now-uiTime>80){ui.update();renderer.canvas.dataset.renderMs=renderCost.toFixed(2);uiTime=now;}
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
