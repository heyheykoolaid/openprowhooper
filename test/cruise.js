require('../src/tricks.js'); require('../src/sim.js'); const S=globalThis.Sim;
const w=S.buildPlayground(), p=S.buildDrone(S.PRESETS['Air65 Racing']), d=new S.Drone(p,S.defaultTune(),w), det=new S.TrickDetector(w);
d.pos={x:0,y:3,z:10}; d.armed=true; let out=[];
for(let i=0;i<20000;i++){ const t=i/1000; const rc={thr:0.47+0.05*Math.sin(t*0.7), roll:0.35*Math.sin(t*0.9), pitch:0.25+0.15*Math.sin(t*0.5), yaw:0.4*Math.sin(t*0.6)};
  d.step(rc,0.001); det.update(d,0.001,rc); out.push(...det.drain()); if(d.crashed){ d.reset({pos:{x:0,y:3,z:10},yaw:0}); d.pos.y=3; d.armed=true; } }
console.log('20 s of carving/cruising ->', out.filter(e=>e.name!=='Crash').map(e=>e.name).join(', ')||'no false tricks', '| crashes', out.filter(e=>e.name==='Crash').length);
