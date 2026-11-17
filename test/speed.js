require('../src/tricks.js'); require('../src/sim.js'); const S=globalThis.Sim;
const w={prims:[],objs:[],spawn:{pos:{x:0,y:0,z:0}}};
for (const n of ['Air65 Racing','Air65 II Champion','75mm build']){
const p=S.buildDrone(S.PRESETS[n]); const d=new S.Drone(p,S.defaultTune(),w); d.pos.y=50; d.armed=true;
for(let i=0;i<120;i++) d.step({thr:0.5,roll:0,pitch:0.6,yaw:0},0.001);
for(let i=0;i<5000;i++) d.step({thr:1,roll:0,pitch:0,yaw:0},0.001);
const top=S.len(d.vel), tilt=Math.acos(d.up().y)*57.3;
// coast: cut throttle level? measure decel from 8m/s level-ish: reset
const d2=new S.Drone(p,S.defaultTune(),w); d2.pos.y=50; d2.armed=true; d2.vel={x:0,y:0,z:-8};
for(let i=0;i<1000;i++) d2.step({thr:0.38,roll:0,pitch:0,yaw:0},0.001);
console.log(n.padEnd(18),'full-thr top speed',(top*3.6).toFixed(0),'kph at tilt',tilt.toFixed(0),'deg | 8 m/s level coast after 1s:',S.len({x:d2.vel.x,y:0,z:d2.vel.z}).toFixed(1),'m/s');}
