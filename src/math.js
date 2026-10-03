export const add=(a,b)=>a.map((n,i)=>n+b[i]);
export const sub=(a,b)=>a.map((n,i)=>n-b[i]);
export const mul=(a,k)=>a.map(n=>n*k);
export const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const length=a=>Math.hypot(...a);
export const norm=a=>mul(a,1/(length(a)||1));
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function rotate(v,axis,a){const c=Math.cos(a),s=Math.sin(a);return add(add(mul(v,c),mul(cross(axis,v),s)),mul(axis,dot(axis,v)*(1-c)));}
export function basis(){return {right:[1,0,0],up:[0,1,0],forward:[0,0,1]};}
export function roll(b,a){b.right=rotate(b.right,b.forward,a);b.up=norm(cross(b.forward,b.right));}
export function pitch(b,a){b.forward=norm(rotate(b.forward,b.right,a));b.up=norm(cross(b.forward,b.right));}
export function camera(b,view){if(view===1)return {right:mul(b.right,-1),up:b.up,forward:mul(b.forward,-1)};if(view===2)return {right:b.forward,up:b.up,forward:mul(b.right,-1)};if(view===3)return {right:mul(b.forward,-1),up:b.up,forward:b.right};return b;}
export function local(v,b){return [dot(v,b.right),dot(v,b.up),dot(v,b.forward)];}
