require('../src/tricks.js'); require('../src/sim.js'); const S=globalThis.Sim;
const w=S.buildPlayground(), p=S.buildDrone(S.PRESETS['Air65 Racing']);
const starts=[[0,2,-3],[-13,2.5,-14],[-17,1.5,0],[8,2.5,4],[0,3,-18],[-8,2,5]]; const all={}; let crashes=0;
for (const [si,st] of starts.entries()) { const d=new S.Drone(p,S.defaultTune(),w), det=new S.TrickDetector(w); const rng=(()=>{let s=si*7919+1;return()=>{s=(s*16807)%2147483647;return s/2147483647*2-1;};})();
  d.pos={x:st[0],y:st[1],z:st[2]}; d.armed=true; let a=[0,0,0,0], tg=[0,0,0,0];
  for (let i=0;i<30000;i++){ if(i%400===0) tg=[0.45+0.08*rng(), 0.3*rng(), 0.25*rng(), 0.35*rng()]; for(let k=0;k<4;k++) a[k]+=(tg[k]-a[k])*0.004;
    const rc={thr:a[0],roll:a[1],pitch:a[2],yaw:a[3]}; d.step(rc,0.001); det.update(d,0.001,rc);
    for(const e of det.drain()) if(e.name!=='near'&&e.name!=='Crash') { const k=e.name+(e.exec==='BUMP'?' (bump)':''); all[k]=(all[k]||0)+1; }
    if(d.crashed||d.pos.y>12){ crashes++; d.reset({pos:{x:st[0],y:st[1],z:st[2]},yaw:0}); d.pos.y=st[1]; d.armed=true; } } }
console.log('3 min gentle random flying near obstacles -> tricks:', JSON.stringify(all), '| crashes', crashes);
