export class AudioEngine {
 constructor(enabled=true){this.enabled=enabled;this.context=null;this.master=null;this.noise=null;}
 unlock(){
  if(!this.enabled)return;
  try{if(!this.context){const Constructor=window.AudioContext||window.webkitAudioContext;if(!Constructor)return;this.context=new Constructor();this.master=this.context.createGain();this.master.gain.value=.3;this.master.connect(this.context.destination);const n=this.context.sampleRate;this.noise=this.context.createBuffer(1,n, this.context.sampleRate);const data=this.noise.getChannelData(0);let seed=7291;for(let i=0;i<n;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1;}}if(this.context.state==='suspended')this.context.resume();}catch{this.enabled=false;}
 }
 tone(frequency,end,duration=.15,volume=.1,type='triangle',delay=0){const a=this.context;if(!a)return;const oscillator=a.createOscillator(),gain=a.createGain(),t=a.currentTime+delay;oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,t);oscillator.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(volume,t+.008);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);oscillator.connect(gain);gain.connect(this.master);oscillator.start(t);oscillator.stop(t+duration+.02);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};}
 burst(duration=.3,frequency=700,volume=.2){const a=this.context;if(!a||!this.noise)return;const source=a.createBufferSource(),filter=a.createBiquadFilter(),gain=a.createGain(),t=a.currentTime;source.buffer=this.noise;filter.type='lowpass';filter.frequency.setValueAtTime(frequency,t);filter.frequency.exponentialRampToValueAtTime(80,t+duration);gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);source.connect(filter);filter.connect(gain);gain.connect(this.master);source.start(t);source.stop(t+duration);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};}
 play(type){if(!this.enabled)return;this.unlock();if(!this.context||this.context.state!=='running')return;
  if(type==='enemyfire'){this.tone(260,60,.16,.055,'sawtooth');}
  else if(type==='beam'){this.tone(160,135,.08,.025,'sawtooth');}
  else if(type==='charge'){this.tone(90,680,1.1,.055,'triangle');}
  else if(type==='lance'){this.tone(850,65,.24,.16,'sawtooth');this.burst(.14,2100,.12);}
  else if(type==='scatter'){this.burst(.16,2300,.19);this.tone(240,55,.15,.08);}
  else if(type==='heavy'){this.tone(300,45,.22,.16,'sawtooth');this.burst(.12,800,.12);}
  else if(type==='fire'){this.tone(520,105,.13,.09,'sawtooth');this.tone(180,70,.1,.1);}
  else if(type==='hit'){this.burst(.09,1600,.16);this.tone(170,80,.08,.08);}
  else if(type==='explode'){this.burst(.65,1400,.35);this.tone(85,25,.55,.18);}
  else if(type==='impact'){this.burst(.18,500,.2);this.tone(75,32,.2,.12);}
  else if(type==='dock'){this.tone(240,240,.16,.1);this.tone(360,360,.22,.1,'triangle',.16);this.tone(480,480,.3,.07,'triangle',.34);}
  else if(type==='arrival'){this.burst(.35,1000,.08);this.tone(70,310,.45,.12);}
  else if(type==='jump'){this.tone(90,180,.6,.08);}
  else if(type==='tick'){this.tone(500,440,.09,.09);}
  else if(type==='missile'){this.burst(.25,2400,.15);this.tone(120,600,.25,.08);}
  else if(type==='warning'){this.tone(680,680,.13,.1,'square');this.tone(480,480,.13,.1,'square',.17);}
  else if(type==='lock'){this.tone(700,700,.08,.08);this.tone(900,900,.13,.08,'triangle',.1);}
  else if(type==='ecm'){this.tone(90,900,.32,.1,'sawtooth');}
  else if(type==='failure'){this.tone(170,40,.28,.09,'square');}
  else if(type==='trade'||type==='scoop'){this.tone(480,700,.11,.06);}
  else if(type==='cruise'){this.tone(100,260,.22,.06);}
  else this.tone(420,350,.055,.04);
 }
}
