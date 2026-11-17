require('../src/tricks.js'); require('../src/sim.js'); const S=globalThis.Sim;
const w=S.buildPlayground(), p=S.buildDrone(S.PRESETS['Air65 Racing']);
function run(name, init, rc, T){ const d=new S.Drone(p,S.defaultTune(),w); d.armed=true; init(d); let maxImp=0, contacts=0;
 for(let i=0;i<T*1000;i++){ d.step(rc,0.001); if(d.contactThisStep){contacts++; maxImp=Math.max(maxImp,d.lastImpact);} }
 console.log(name.padEnd(28),'crashed',d.crashed,d.crashReason||'','maxImpact',maxImp.toFixed(2),'contacts',contacts,'pos',[d.pos.x,d.pos.y,d.pos.z].map(v=>v.toFixed(2)).join(','),'upY',d.up().y.toFixed(2)); }
run('gentle wall bump 2m/s', d=>{d.pos={x:-17.5,y:1.5,z:-5}; d.vel={x:-2,y:0,z:0};}, {thr:0.37,roll:0,pitch:0,yaw:0}, 1.5);
run('slam building 12m/s', d=>{d.pos={x:0,y:3,z:-19}; d.vel={x:0,y:0,z:-12};}, {thr:0.37,roll:0,pitch:0,yaw:0}, 1);
run('fall upside down', d=>{d.pos={x:0,y:1,z:8}; d.q=S.qaxis(S.v3(1,0,0),Math.PI);}, {thr:0,roll:0,pitch:0,yaw:0}, 2);
run('hit swing bar 5m/s', d=>{d.pos={x:0.5,y:2.4,z:-3}; d.vel={x:0,y:0,z:-5};}, {thr:0.37,roll:0,pitch:0,yaw:0}, 1.5);
run('land on ground', d=>{d.pos={x:0,y:0.6,z:8};}, {thr:0.3,roll:0,pitch:0,yaw:0}, 2);
