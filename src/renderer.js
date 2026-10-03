import {random} from './universe.js';
import {sub,add,mul,dot,cross,norm,local,camera,basis,length,clamp} from './math.js';
import {shipMesh,stationMesh,rockMesh,cargoMesh,planetMesh} from './geometry.js';
import {contactBasis} from './encounters.js';
import {weapons} from './weapons.js';
const colors={trader:[155,204,189],patrol:[140,192,240],pirate:[241,144,107],hostile:[207,133,225],miner:[208,193,121],asteroid:[133,143,148],cargo:[227,187,103],courier:[224,219,143],warship:[245,116,94]};
const light=norm([-1,1.5,-1.5]);
export function clipNear(points,near=2){
 const out=[];
 for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],insideA=a[2]>=near,insideB=b[2]>=near;if(insideA)out.push(a);if(insideA!==insideB){const t=(near-a[2])/(b[2]-a[2]);out.push(a.map((v,j)=>v+(b[j]-v)*t));}}
 return out;
}
function shade(color,k){return `rgb(${color.map(v=>Math.round(clamp(v*k,0,255))).join(',')})`;}
export class Renderer {
 constructor(canvas,scanner){
  this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.scanner=scanner;this.sctx=scanner.getContext('2d');
  const rng=random(92134);
  this.stars=Array.from({length:410},()=>{const z=rng()*2-1,a=rng()*Math.PI*2,r=Math.sqrt(1-z*z);return {p:[Math.cos(a)*r,Math.sin(a)*r,z],size:rng()>.92?1.5:.8,alpha:.3+rng()*.55};});
  this.dust=Array.from({length:145},()=>[rng()*1200,rng()*1200,rng()*1200]);
  this.ships=Array.from({length:30},(_,i)=>shipMesh(i));this.stations=Array.from({length:4},(_,i)=>stationMesh(i));this.rocks=Array.from({length:30},(_,i)=>rockMesh(i));this.planetGeometry=planetMesh();
 }
 preview(canvas,id,mode,time){
  const saved={ctx:this.ctx,w:this.w,h:this.h,f:this.f,eye:this.eye,cam:this.cam};
  const w=canvas.clientWidth||300,h=canvas.clientHeight||140,dpr=Math.min(window.devicePixelRatio||1,2);
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);this.ctx=c;this.w=w;this.h=h;this.f=h*1.45;this.eye=[0,0,0];this.cam=basis();
  c.fillStyle='#060e12';c.fillRect(0,0,w,h);c.strokeStyle='#1a3435';c.lineWidth=.5;c.beginPath();c.moveTo(w/2-60,h-18);c.lineTo(w/2+60,h-18);c.moveTo(w/2,18);c.lineTo(w/2,h-18);c.stroke();
  const faces=[];this.mesh(this.ships[id],[0,0,100],.1,[213,170,124],mode,faces,{forward:norm([Math.sin(time*.32),.2,Math.cos(time*.32)])},1.65);faces.sort((a,b)=>b.z-a.z);
  for(const f of faces){c.beginPath();f.points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fillStyle=f.fill;c.fill();c.strokeStyle=f.edge;c.lineWidth=1;c.stroke();}
  c.fillStyle='#78938d';c.font='8px Consolas,monospace';c.textAlign='left';c.fillText('RECOGNITION / '+String(id+1).padStart(2,'0'),10,16);
  Object.assign(this,saved);
 }
 resize(){const dpr=Math.min(window.devicePixelRatio||1,2),w=this.canvas.clientWidth,h=this.canvas.clientHeight;if(this.canvas.width!==Math.round(w*dpr)||this.canvas.height!==Math.round(h*dpr)){this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);}this.ctx.setTransform(dpr,0,0,dpr,0,0);this.w=w;this.h=h;this.f=h*.85;}
 project(v){if(v[2]<2)return null;return [this.w/2+v[0]/v[2]*this.f,this.h/2-v[1]/v[2]*this.f];}
 point(world){return this.project(local(sub(world,this.eye),this.cam));}
 line(a,b,color,width=1){const av=local(sub(a,this.eye),this.cam),bv=local(sub(b,this.eye),this.cam);if(av[2]<2&&bv[2]<2)return;if(av[2]<2||bv[2]<2){const t=(2-av[2])/(bv[2]-av[2]),v=av.map((n,i)=>n+(bv[i]-n)*t);if(av[2]<2)av.splice(0,3,...v);else bv.splice(0,3,...v);}const p=this.project(av),q=this.project(bv);if(!p||!q)return;const c=this.ctx;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(...p);c.lineTo(...q);c.stroke();}
 draw(g){
  this.resize();const c=this.ctx,w=this.w,h=this.h;c.fillStyle=g.interstitial?'#08050c':'#020709';c.fillRect(0,0,w,h);this.cam=g.docked?basis():camera(g.b,g.view);this.eye=g.docked?[0,0,0]:g.position;const shake=g.paused?0:Math.min(2.5,g.hitFlash*9+(g.shotWeapon==='military'||g.shotWeapon==='charge'?g.fireFlash*6:0));c.save();c.translate(Math.sin(g.time*89)*shake,Math.cos(g.time*113)*shake);
  this.background(g);
  if(!g.docked)this.sun(g.star);
  const faces=[],stationPos=g.docked?[w*.27*520/this.f,-8,520]:g.station.pos;
  const planetPos=g.docked?[w*.2*1900/this.f,420,1900]:g.planet;
  if(!g.interstitial)this.mesh(this.planetGeometry,planetPos,0,[92,126+(g.system.hue%30),144],g.mode,faces,null,480,true);
  this.mesh(this.stations[g.station.type],stationPos,g.station.angle,[144,198,183],g.mode,faces,null,g.docked?1.15:1);
  if(g.docked)this.mesh(this.ships[0],[stationPos[0]-.5*120,-90,330],-.18,[226,186,119],g.mode,faces,{forward:norm([-.65,.15,1])},1.5);
  for(const e of g.entities){const mesh=e.type==='asteroid'?this.rocks[e.mesh]:e.type==='cargo'?cargoMesh:this.ships[e.mesh],color=e.hit>0?[245,220,176]:colors[e.type]||colors.trader;this.mesh(mesh,e.pos,e.angle,color,g.mode,faces,e.type==='asteroid'||e.type==='cargo'?null:e,e.type==='asteroid'||e.type==='cargo'?1:e.scale||1.9);}
  faces.sort((a,b)=>b.z-a.z);
  for(const f of faces){c.beginPath();f.points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fillStyle=f.fill;c.fill();c.strokeStyle=f.edge;c.lineWidth=f.planet?.65:1;c.stroke();}
  this.aperture(g,stationPos,g.docked?1.15:1);
  for(const e of g.entities){if(e.type==='asteroid'||e.type==='cargo')continue;const b=contactBasis(e);if(dot(sub(this.eye,e.pos),b.forward)<0){const scale=e.scale||1,p=add(e.pos,mul(b.forward,-19*scale));for(const sign of [-1,1]){const engine=add(p,mul(b.right,sign*6*scale));this.line(engine,add(engine,mul(b.forward,-(7+Math.sin(g.time*35+e.id)*2)*scale)),'#8cbecb',2);}}}
  for(const e of g.entities){
   if(e.type==='asteroid'||e.type==='cargo')continue;const b=contactBasis(e),scale=e.scale||1;
   if(dot(norm(sub(this.eye,e.pos)),b.forward)>.1){for(const sign of [-1,1]){
    const root=add(e.pos,add(mul(b.right,sign*6*scale),mul(b.forward,13*scale))),tip=add(root,mul(b.forward,10*scale));
    this.line(root,tip,e.type==='pirate'?'#be8c75':'#7aaba7',1);
    if(e.telegraph||e.muzzle>0){const p=this.point(tip);if(p){c.strokeStyle=e.muzzle>0?'#ffdfb0':e.weapon==='beam'?'#96cfc7':'#eeb589';c.lineWidth=1;c.beginPath();c.arc(p[0],p[1],e.muzzle>0?3:1.5+Math.sin(g.time*30)*.5,0,Math.PI*2);c.stroke();}}
   }}
  }
  this.effects(g);
  c.restore();if(!g.docked)this.hud(g);
  if(g.radio&&g.radio.until>g.time&&!g.panel)this.radio(g.radio);
  if(g.jumpFlash>0){c.fillStyle=`rgba(165,199,184,${g.jumpFlash*.3})`;c.fillRect(0,0,w,h);}
  if(g.hitFlash>0){c.strokeStyle=`rgba(237,119,81,${g.hitFlash*3})`;c.lineWidth=4;c.strokeRect(2,2,w-4,h-4);const d=g.hitDirection||[0,0,1],a=Math.atan2(-d[1],d[0]),x=w/2+Math.cos(a)*(w/2-26),y=h/2+Math.sin(a)*(h/2-26);c.fillStyle='#f1ae80';c.beginPath();c.moveTo(x+Math.cos(a)*10,y+Math.sin(a)*10);c.lineTo(x+Math.cos(a+2.3)*8,y+Math.sin(a+2.3)*8);c.lineTo(x+Math.cos(a-2.3)*8,y+Math.sin(a-2.3)*8);c.closePath();c.fill();}
  if(g.ecmTime>0){c.strokeStyle=`rgba(121,197,183,${g.ecmTime})`;c.lineWidth=1;c.beginPath();c.arc(w/2,h/2,(1-g.ecmTime)*w,0,Math.PI*2);c.stroke();}
  this.scan(g);
 }
 background(g){const c=this.ctx,w=this.w,h=this.h;for(const star of this.stars){const p=this.project(local(mul(star.p,5000),this.cam));if(p&&p[0]>0&&p[0]<w&&p[1]>0&&p[1]<h){c.fillStyle=`rgba(183,203,203,${star.alpha})`;c.fillRect(p[0],p[1],star.size,star.size);}}
  if(g.docked)return;
  for(const seed of this.dust){const offset=seed.map((v,i)=>((v-g.position[i])%1200+1200)%1200-600);const v=local(offset,this.cam),p=this.project(v);if(!p||v[2]<45||p[0]<0||p[0]>w||p[1]<0||p[1]>h)continue;const alpha=clamp((650-v[2])/1300,.08,.38);c.fillStyle=`rgba(157,188,190,${alpha})`;c.fillRect(p[0],p[1],1,1);if(g.compression>2){const tail=local(add(offset,mul(g.b.forward,-g.speed*.015*g.compression)),this.cam),q=this.project(tail);if(q){c.strokeStyle=`rgba(157,188,190,${alpha*.8})`;c.lineWidth=.7;c.beginPath();c.moveTo(...p);c.lineTo(...q);c.stroke();}}}
 }
 mesh(mesh,pos,angle,color,mode,faces,entity=null,scale=1,planet=false){
  const b=entity?contactBasis(entity):basis(),ca=Math.cos(entity?0:angle),sa=Math.sin(entity?0:angle);
  const world=mesh.vertices.map(v=>{const x=(v[0]*ca-v[1]*sa)*scale,y=(v[0]*sa+v[1]*ca)*scale,z=v[2]*scale;return add(pos,add(mul(b.right,x),add(mul(b.up,y),mul(b.forward,z))));});
  for(const [faceIndex,face] of mesh.faces.entries()){const verts=face.map(i=>world[i]),n=norm(cross(sub(verts[1],verts[0]),sub(verts[2],verts[0])));if(dot(n,sub(this.eye,verts[0]))<=0)continue;
   const transformed=clipNear(verts.map(v=>local(sub(v,this.eye),this.cam)));if(transformed.length<3)continue;
   const points=transformed.map(v=>this.project(v));if(points.some(p=>!p))continue;
   const brightness=(planet?.16:.25)+Math.floor(Math.max(0,dot(n,light))*4.99)*(planet?.105:.13),material=faceIndex>=mesh.cockpitStart?[106,188,213]:faceIndex>=mesh.secondaryStart?color.map((v,i)=>v*.5+[112,143,151][i]*.5):color;
   faces.push({points,z:transformed.reduce((s,v)=>s+v[2],0)/transformed.length,edge:shade(material,planet?.65:.94),fill:mode==='vector'?'#020709':shade(material,brightness),planet});
  }
 }
 aperture(g,pos,scale){if(this.eye[2]>=pos[2]-24*scale)return;const c=this.ctx,ca=Math.cos(g.station.angle),sa=Math.sin(g.station.angle);const ring=(z,x,y)=>Array.from({length:8},(_,i)=>{const a=(i+.5)*Math.PI/4;const xx=Math.cos(a)*x*scale,yy=Math.sin(a)*y*scale;return add(pos,[xx*ca-yy*sa,xx*sa+yy*ca,z*scale]);});const front=ring(-24.3,23,14);
  for(let i=0;i<8;i++)this.line(front[i],front[(i+1)%8],'#eac47e',1.5);
  if(!g.docked&&g.stationRange<550){const outer=ring(-64,25,16);for(const i of [0,2,4,6])this.line(front[i],outer[i],'#b6a372',.8);}
  for(const i of [0,2,4,6]){const p=this.point(front[i]);if(p){c.fillStyle='#ffe2a0';c.fillRect(p[0]-1.5,p[1]-1.5,3,3);}}
 }
 sun(pos){const v=local(sub(pos,this.eye),this.cam),p=this.project(v);if(!p)return;const r=170/v[2]*this.f,c=this.ctx;c.fillStyle='#b09257';c.beginPath();for(let i=0;i<20;i++){const a=i/20*Math.PI*2;i?c.lineTo(p[0]+Math.cos(a)*r,p[1]+Math.sin(a)*r):c.moveTo(p[0]+r,p[1]);}c.closePath();c.fill();}
 effects(g){
  const c=this.ctx;
  for(const e of g.effects){
   if(e.type==='beam'){const color=e.weapon==='beam'?'#a7e3d3':e.weapon==='military'?'#ef9988':e.hostile?'#f1c07b':'#b5e6dd';this.line(e.from,e.pos,color,e.weapon==='beam'?2:1.6);if(e.weapon==='military'){const dir=norm(sub(e.pos,e.from)),offset=mul(norm(cross(dir,[0,1,0])),10);this.line(add(e.from,offset),add(e.pos,offset),color,1.6);}continue;}
   const v=local(sub(e.pos,this.eye),this.cam),p=this.project(v);if(!p)continue;
   const burst=e.type==='burst',smoke=e.type==='smoke',duration=burst?1.6:smoke?.7:.25,age=Math.max(0,duration-e.life),fade=Math.min(1,e.life/(burst?.7:duration));
   const size=e.size||18,r=(burst?size*.4+age*65:smoke?3+age*6:3+age*38)/Math.max(20,v[2])*this.f;
   c.save();c.globalAlpha=fade;c.lineWidth=1;
   if(smoke){c.strokeStyle='#886e61';c.beginPath();c.moveTo(p[0]-r,p[1]+r*.5);c.lineTo(p[0],p[1]-r);c.lineTo(p[0]+r,p[1]+r*.5);c.stroke();c.restore();continue;}
   if(burst&&age<.23){c.fillStyle=age<.09?'#f6edca':'#dcaa71';c.beginPath();for(let i=0;i<10;i++){const a=i/10*Math.PI*2;const d=r*(i%2?.6:1);i?c.lineTo(p[0]+Math.cos(a)*d,p[1]+Math.sin(a)*d):c.moveTo(p[0]+d,p[1]);}c.closePath();c.fill();}
   if(burst&&age<.8){c.strokeStyle='#c5b993';c.globalAlpha=fade*(1-age/.8)*.6;c.beginPath();for(let i=0;i<12;i++){const a=i/12*Math.PI*2;i?c.lineTo(p[0]+Math.cos(a)*r*1.25,p[1]+Math.sin(a)*r*.65):c.moveTo(p[0]+r*1.25,p[1]);}c.closePath();c.stroke();c.globalAlpha=fade;}
   for(let i=0;i<(burst?13:7);i++){
    const a=i*2.399+(e.seed||0)*.6,travel=r*(.45+(i%4)*.23),x=p[0]+Math.cos(a)*travel,y=p[1]+Math.sin(a)*travel;
    c.strokeStyle=burst?i%3?'#d6a675':'#93b5b8':'#f6e1ad';c.fillStyle=i%3?'#695345':'#3e575c';
    const shard=burst?Math.max(1,(5+i%5)/Math.max(30,v[2])*this.f):1;
    c.beginPath();c.moveTo(x+Math.cos(age*3+i)*shard,y+Math.sin(age*3+i)*shard);c.lineTo(x+Math.cos(age*3+i+2.4)*shard,y+Math.sin(age*3+i+2.4)*shard);c.lineTo(x+Math.cos(age*3+i+4)*shard,y+Math.sin(age*3+i+4)*shard);c.closePath();if(burst)c.fill();c.stroke();
   }
   c.restore();
  }
  for(const m of g.projectiles){const p=this.point(m.pos);if(p){c.strokeStyle=m.hostile?'#ffb18b':'#d8e7bb';c.lineWidth=1.5;c.strokeRect(p[0]-2,p[1]-2,4,4);this.line(m.pos,add(m.pos,mul(m.forward||[0,0,1],-24)),c.strokeStyle,1.5);}}
 }

 hud(g){
  const c=this.ctx,w=this.w,h=this.h,cx=w/2,cy=h/2;
  if(!g.panel){
   if(g.projectiles.some(m=>m.hostile)){c.fillStyle='#f2ac86';c.font='10px Consolas,monospace';c.textAlign='center';c.fillText('MISSILE INBOUND / ECM',cx,42);}
   c.strokeStyle=g.armed?(g.lockTime>=1?'#edbd70':'#ca8979'):g.aimTarget?'#edc887':'#7d9e97';c.lineWidth=1;c.beginPath();for(const sign of [-1,1]){c.moveTo(cx+sign*12,cy);c.lineTo(cx+sign*24,cy);c.moveTo(cx,cy+sign*12);c.lineTo(cx,cy+sign*19);}c.stroke();
   if(g.target){const v=local(sub(g.target.pos,g.position),this.cam),a=Math.atan2(-v[1],v[0]),off=v[2]<=0||Math.abs(v[0]/v[2]*this.f)>w*.43||Math.abs(v[1]/v[2]*this.f)>h*.4;if(off){c.strokeStyle='#be906d';c.beginPath();const x=cx+Math.cos(a)*39,y=cy+Math.sin(a)*39;c.moveTo(x+Math.cos(a)*5,y+Math.sin(a)*5);c.lineTo(x+Math.cos(a+2.1)*5,y+Math.sin(a+2.1)*5);c.moveTo(x+Math.cos(a)*5,y+Math.sin(a)*5);c.lineTo(x+Math.cos(a-2.1)*5,y+Math.sin(a-2.1)*5);c.stroke();}}
   if(g.hitConfirm>0){c.strokeStyle='#f6d595';c.beginPath();for(let i=0;i<4;i++){const a=Math.PI/4+i*Math.PI/2;c.moveTo(cx+Math.cos(a)*6,cy+Math.sin(a)*6);c.lineTo(cx+Math.cos(a)*12,cy+Math.sin(a)*12);}c.stroke();}
   if(g.fireFlash>0){
    const weapon=weapons.find(x=>x.id===g.shotWeapon)||weapons[0];c.strokeStyle=weapon.color;c.lineWidth=weapon.id==='military'?2.1:weapon.charge?2.5:weapon.id==='beam'?1.6:1.1;
    const rays=g.shotRays?.length?g.shotRays:[{direction:this.cam.forward,distance:800}];
    for(let i=0;i<rays.length;i++){const ray=rays[i],end=this.point(add(g.position,mul(ray.direction,ray.distance)))||[cx,cy];c.beginPath();c.moveTo(weapon.id==='beam'||weapon.charge?cx:w*(.18+i/Math.max(1,rays.length-1)*.64),h*.96);c.lineTo(...end);if(rays.length===1&&weapon.id!=='beam'&&!weapon.charge){c.moveTo(w*.82,h*.96);c.lineTo(...end);}c.stroke();}
   }
   if(g.charging){c.strokeStyle='#aac6de';c.lineWidth=2;c.beginPath();c.moveTo(cx-30,cy+33);c.lineTo(cx-30+g.weaponCharge*60,cy+33);c.stroke();c.font='8px Consolas,monospace';c.fillStyle='#aac6de';c.textAlign='center';c.fillText(g.weaponCharge>=1?'RELEASE':'CHARGING',cx,cy+47);}
   if(g.jump>0){c.textAlign='center';c.fillStyle='#ead2a3';c.font='30px Consolas,monospace';c.fillText(String(Math.ceil(g.jump)).padStart(2,'0'),cx,cy-53);c.font='10px Consolas,monospace';c.fillText('DRIVE SYNCHRONISING',cx,cy-91);c.strokeStyle='#4e6c65';c.beginPath();c.arc(cx,cy-65,47,-Math.PI/2,-Math.PI/2+(5-g.jump)/5*Math.PI*2);c.stroke();}
   if(g.paused){c.fillStyle='#071215ee';c.fillRect(cx-125,cy-74,250,62);c.fillStyle='#edc17e';c.font='17px Consolas,monospace';c.textAlign='center';c.fillText('FLIGHT PAUSED',cx,cy-47);c.fillStyle='#90a7a6';c.font='10px Consolas,monospace';c.fillText('P / RESUME TO CONTINUE',cx,cy-28);}
   if(g.stationRange<600&&!g.navContact&&!g.paused)this.dockingGuide(g);
  }
  c.strokeStyle='#27403d';c.lineWidth=1;c.beginPath();c.moveTo(0,h*.78);c.lineTo(16,h*.78);c.lineTo(42,h-17);c.lineTo(w*.22,h-17);c.moveTo(w,h*.78);c.lineTo(w-16,h*.78);c.lineTo(w-42,h-17);c.lineTo(w*.78,h-17);c.stroke();
 }
 dockingGuide(g){const d=g.dockingInfo();if(d.z>0)return;const c=this.ctx,x=this.w-58,y=this.h-66,size=22;c.save();c.translate(x,y);c.strokeStyle='#536c66';c.beginPath();c.arc(0,0,size+7,0,Math.PI*2);c.stroke();c.rotate(-d.roll);c.strokeStyle=Math.abs(Math.sin(d.roll))<.32?'#98ceb4':'#d2ae73';c.strokeRect(-size,-size*.5,size*2,size);c.restore();c.fillStyle='#d8d5a9';c.fillRect(x+clamp(-d.x*.3,-28,28)-1.5,y+clamp(d.y*.3,-28,28)-1.5,3,3);c.textAlign='center';c.font='8px Consolas,monospace';c.fillStyle=g.speed>28?'#ed9676':'#8aa8a0';c.fillText(g.speed>28?'SLOW TO 28':'DOCK ALIGN',x,y+42);}
 radio(r){const c=this.ctx,maxWidth=Math.min(420,this.w-48),x=24,y=this.h<270?48:this.h-107;if(this.h<240)return;c.fillStyle='#081316ee';c.fillRect(x,y,maxWidth,66);c.strokeStyle='#344b48';c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.lineTo(x,y+66);c.stroke();c.textAlign='left';c.fillStyle='#c4a776';c.font='9px Consolas,monospace';c.fillText(`${r.name.toUpperCase()} / ${r.species.toUpperCase()}`,x+12,y+16);c.fillStyle='#859e98';c.font='9px Consolas,monospace';const words=r.text.split(' ');let line='',row=0;for(const word of words){if(c.measureText(line+word).width>maxWidth-26){c.fillText(line,x+12,y+34+row*13);row++;line='';if(row>1)break;}line+=word+' ';}if(row<=1)c.fillText(line,x+12,y+34+row*13);}
 scan(g){
  const c=this.sctx,w=310;c.clearRect(0,0,w,150);c.lineWidth=.75;c.strokeStyle='#32504c';
  for(const radius of [26,51,76]){c.beginPath();c.ellipse(146,81,radius*1.55,radius*.5,0,0,Math.PI*2);c.stroke();}
  c.beginPath();c.moveTo(28,81);c.lineTo(264,81);c.moveTo(146,43);c.lineTo(146,119);c.moveTo(62,54);c.lineTo(230,108);c.moveTo(62,108);c.lineTo(230,54);c.stroke();c.fillStyle='#e4d7ac';c.beginPath();c.moveTo(146,74);c.lineTo(141,84);c.lineTo(151,84);c.closePath();c.fill();
  for(const e of [{pos:g.station.pos,type:'station'},...g.entities]){const v=local(sub(e.pos,g.position),g.b),d=length(v);if(d>1500)continue;const x=146+v[0]/1500*115,y=81-v[2]/1500*37,z=clamp(v[1]/1500*60,-35,35);c.strokeStyle=e.type==='station'?'#edbd70':shade(colors[e.type]||colors.trader,1);c.beginPath();c.moveTo(x,y);c.lineTo(x,y-z);c.stroke();c.fillStyle=c.strokeStyle;c.fillRect(x-2,y-z-2,4,4);if(e.id===g.targetId)c.strokeRect(x-5,y-z-5,10,10);}
  const target=g.navContact&&g.target?g.target.pos:g.station.pos,v=norm(local(sub(target,g.position),g.b)),x=284,y=27;c.strokeStyle='#a29169';c.beginPath();c.arc(x,y,16,0,Math.PI*2);c.moveTo(x-20,y);c.lineTo(x+20,y);c.moveTo(x,y-20);c.lineTo(x,y+20);c.stroke();c.beginPath();c.arc(x+v[0]*13,y-v[1]*13,3,0,Math.PI*2);c.fillStyle=v[2]>0?'#e9ca88':'#071014';c.fill();c.strokeStyle='#e9ca88';c.stroke();c.font='8px Consolas,monospace';c.fillStyle='#8fa79e';c.textAlign='center';c.fillText(g.navContact&&g.target?'CONTACT':'HARBOUR',x,56);c.fillText(v[2]>0?'AHEAD':'BEHIND',x,68);c.textAlign='left';c.font='8px Consolas,monospace';c.fillText('1.5K',7,138);c.fillText('● AHEAD   ○ BEHIND',111,140);
 }
}
