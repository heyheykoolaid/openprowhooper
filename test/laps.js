// Laps count (owner, 2026-11-18: 'a one lap trippy, or even a powerloop, can be lapped and each lap should count'): N powerloops
// round the playground swing set in a row are N Powerloop calls (the TPW sheet's back-to-back rule then scores them). node test/laps.js
require('../src/tricks.js'); require('../src/sim.js');const S=globalThis.Sim,{v3,mul,sub,qmul,qnorm}=S;
const norm=a=>mul(a,1/(S.len(a)||1)),cross=(a,b)=>v3(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
function basisQ(f,u){f=norm(f);const r=norm(cross(f,u));u=cross(r,f);const m=[[r.x,u.x,-f.x],[r.y,u.y,-f.y],[r.z,u.z,-f.z]],tr=m[0][0]+m[1][1]+m[2][2];let q;
if(tr>0){const s=Math.sqrt(tr+1)*2;q={w:s/4,x:(m[2][1]-m[1][2])/s,y:(m[0][2]-m[2][0])/s,z:(m[1][0]-m[0][1])/s}}else if(m[0][0]>m[1][1]&&m[0][0]>m[2][2]){const s=Math.sqrt(1+m[0][0]-m[1][1]-m[2][2])*2;q={w:(m[2][1]-m[1][2])/s,x:s/4,y:(m[0][1]+m[1][0])/s,z:(m[0][2]+m[2][0])/s}}else if(m[1][1]>m[2][2]){const s=Math.sqrt(1+m[1][1]-m[0][0]-m[2][2])*2;q={w:(m[0][2]-m[2][0])/s,x:(m[0][1]+m[1][0])/s,y:s/4,z:(m[1][2]+m[2][1])/s}}else{const s=Math.sqrt(1+m[2][2]-m[0][0]-m[1][1])*2;q={w:(m[1][0]-m[0][1])/s,x:(m[0][2]+m[2][0])/s,y:(m[1][2]+m[2][1])/s,z:s/4}}return qnorm(q)}
function fly(W,gen,T){const det=new S.TrickDetector(W),d=Object.create(S.Drone.prototype);d.armed=true;d.crashed=false;const dt=0.001;let pq=null,pp=null;const got=[];
for(let t=0;t<T;t+=dt){const s=gen(t);let q=s.q;if(pq&&q.w*pq.w+q.x*pq.x+q.y*pq.y+q.z*pq.z<0)q={w:-q.w,x:-q.x,y:-q.y,z:-q.z};let w=v3();if(pq){const dq={w:(q.w-pq.w)/dt,x:(q.x-pq.x)/dt,y:(q.y-pq.y)/dt,z:(q.z-pq.z)/dt},r=qmul({w:q.w,x:-q.x,y:-q.y,z:-q.z},dq);w=v3(2*r.x,2*r.y,2*r.z)}
d.vel=pp?mul(sub(s.pos,pp),1/dt):v3();pp=s.pos;pq=q;d.pos=s.pos;d.q=q;d.w=w;d.contactThisStep=false;det.update(d,dt);for(const e of det.drain())if(e.name!=='near')got.push(e.name+'@'+t.toFixed(1)+(e.laps?'/'+e.laps:''))}return got}
// approach along -z at y 1.2, under the swing bar (z=-6, top 2.4), loop up and back over it, N times, fly away
const W=S.buildPlayground(), N=4, R=1.25, cz=-6, cy=2.4, v=6, w=v/R, Tl=2*Math.PI/w, Tin=1.0;
const gen=t=>{ if(t<Tin){const z=cz+v*(Tin-t); return {pos:v3(0,cy-R,z),q:basisQ(v3(0,0,-1),v3(0,1,0))}}
 const a=Math.min((t-Tin)*w,N*2*Math.PI); if((t-Tin)*w<=N*2*Math.PI){ // a=0 at the bottom moving -z; loop goes up over towards +z? powerloop: under, up, back over the top flying +z, down
  const pos=v3(0,cy-R*Math.cos(a),cz-R*Math.sin(a)), f=v3(0,Math.sin(a),-Math.cos(a)), up=v3(0,Math.cos(a),Math.sin(a)); return {pos,q:basisQ(f,up)} }
 const te=t-Tin-N*Tl; return {pos:v3(0,cy-R,cz-v*te),q:basisQ(v3(0,0,-1),v3(0,1,0))} };
let ok = 0, n = 0; for (const k of [1, 2, 3, 4]) { const NN = k; const g2 = t => { if (t < Tin) return gen(t); const lim = NN * Tl; if (t - Tin <= lim) return gen(t); const te = t - Tin - lim; return { pos: v3(0, cy - R, cz - v * te), q: basisQ(v3(0, 0, -1), v3(0, 1, 0)) }; };
  const got = fly(W, g2, Tin + NN * Tl + 2.5), pl = got.filter(x => x.startsWith('Powerloop@')).length; n++; if (pl === NN) ok++; console.log(`${pl === NN ? '✓' : '✗'} ${NN} powerloop${NN > 1 ? 's' : ''} in a row round the swing set: ${pl} called  ${got.join(', ')}`); }
console.log(`\n${ok}/${n} lap checks`); if (ok !== n) process.exit(1);
