require('../src/tricks.js'); require('../src/sim.js');
const S=globalThis.Sim;
for (const [n,spec] of Object.entries(S.PRESETS)){ const p=S.buildDrone(spec); const s=p.stats;
 console.log(n.padEnd(18), 'AUW',s.auw.toFixed(1),'g thrust',s.thrust.toFixed(0),'g TWR',s.twr.toFixed(2),'rpm',s.rpmMax.toFixed(0),'A',s.ampsMax.toFixed(1),'hover',(s.hoverThrottle*100).toFixed(0)+'%', 'I',[s.I.x,s.I.y,s.I.z].map(v=>v.toExponential(2)).join(','), p.warnings.join(';'));}
const world=S.buildPlayground();
const p=S.buildDrone(S.PRESETS['Air65 Racing']); const tune=S.defaultTune();
const d=new S.Drone(p,tune,world); d.pos.y=2; d.armed=true;
const dt=0.001; let rc={thr:0.0,roll:0,pitch:0,yaw:0};
// find hover throttle by simple altitude hold
let thr=0.4;
for(let i=0;i<4000;i++){ thr+= ( (2-d.pos.y)*0.002 - d.vel.y*0.004); thr=Math.max(0,Math.min(1,thr)); d.step({thr,roll:0,pitch:0,yaw:0},dt);}
console.log('hover stick',thr.toFixed(3),'y',d.pos.y.toFixed(2),'vbat',d.vbat.toFixed(2),'I',d.ibat.toFixed(2),'rpm',(d.motorW[0]*60/6.283).toFixed(0), 'crash',d.crashed);
// roll step: full right roll stick for 0.6s
d.pos.y=5; d.vel={x:0,y:0,z:0}; let mx=0, rec=[];
for(let i=0;i<900;i++){ const st=i<500?1:0; d.step({thr:thr,roll:st,pitch:0,yaw:0},dt); const r=d.pilotRates(); if(i%25==0) rec.push(r[0].toFixed(0)); mx=Math.max(mx,r[0]); }
console.log('roll rate trace', rec.join(' '));
console.log('setpoint', S.applyRate(1,tune.rates.roll,'ACTUAL'));
// flip timing: half stick back flip
d.reset({pos:{x:0,y:5,z:0},yaw:0}); d.pos.y=5; d.armed=true; let ang=0,tFlip=0;
for(let i=0;i<3000;i++){ d.step({thr:thr,roll:0,pitch:-1,yaw:0},dt); ang+=d.pilotRates()[1]*dt; if(ang>=360){tFlip=i*dt;break;} }
console.log('360 backflip full stick time', tFlip.toFixed(3),'s');
// oscillation check at hover after a kick
d.reset({pos:{x:0,y:5,z:0},yaw:0}); d.pos.y=5; d.armed=true; d.w.x=10; let osc=[];
for(let i=0;i<400;i++){ d.step({thr,roll:0,pitch:0,yaw:0},dt); if(i%20==0) osc.push((d.pilotRates()[1]).toFixed(0)); }
console.log('kick recovery pitch rate', osc.join(' '));
// yaw
d.reset({pos:{x:0,y:5,z:0},yaw:0}); d.pos.y=5; d.armed=true; rec=[];
for(let i=0;i<600;i++){ d.step({thr,roll:0,pitch:0,yaw:i<400?1:0},dt); if(i%25==0) rec.push(d.pilotRates()[2].toFixed(0)); }
console.log('yaw trace', rec.join(' '), 'sp', S.applyRate(1,tune.rates.yaw,'ACTUAL'));
// full throttle punch
d.reset({pos:{x:0,y:1,z:0},yaw:0}); d.pos.y=1; d.armed=true;
for(let i=0;i<1000;i++) d.step({thr:1,roll:0,pitch:0,yaw:0},dt);
console.log('1s punch: climb', (d.pos.y-1).toFixed(1),'m vy',d.vel.y.toFixed(1),'vbat',d.vbat.toFixed(2),'A',d.ibat.toFixed(1));
// forward top speed at 45deg... pitch forward to ~50deg then hold
d.reset({pos:{x:0,y:3,z:0},yaw:0}); d.pos.y=3; d.armed=true;
for(let i=0;i<200;i++) d.step({thr:0.6,roll:0,pitch:0.5,yaw:0},dt);
for(let i=0;i<4000;i++) d.step({thr:0.85,roll:0,pitch:0,yaw:0},dt);
console.log('forward speed', S.len(d.vel).toFixed(1),'m/s', 'tilt', (Math.acos(d.up().y)*57.3).toFixed(0));
