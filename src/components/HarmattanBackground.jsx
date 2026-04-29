import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import { useUIStore } from '../stores/uiStore';

function sn(t,s){const v=Math.sin(t*0.7+s*127.1)*43758.5453;return v-Math.floor(v);}
function sr(t,s){const a=sn(Math.floor(t),s),b=sn(Math.floor(t)+1,s),f=t-Math.floor(t),e=f*f*(3-2*f);return a+(b-a)*e;}

export default function HarmattanBackground() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    let raf, lastFrame = 0;
    const FPS = 30, frameDur = 1000 / FPS;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize(); window.addEventListener('resize', resize);

    // Camera: x,y = position in world, angle = heading (radians), pitch = up/down
    const cam = { x: 50, y: 50, angle: 0, pitch: 0, vx: 0, vy: 0, va: 0, vp: 0, nt: Math.random()*1000 };
    // Day cycle: 0=dawn, 0.25=noon, 0.5=dusk, 0.75=midnight
    let dayTime = 0.15; // start morning
    // World objects (seeded once)
    const dunes = []; for(let i=0;i<80;i++) dunes.push({x:Math.random()*200,y:Math.random()*200,w:30+Math.random()*80,h:8+Math.random()*25,hue:35+Math.random()*15});
    const mountains = []; for(let i=0;i<12;i++) mountains.push({x:Math.random()*200,y:Math.random()*200,w:60+Math.random()*120,h:40+Math.random()*60,hue:25+Math.random()*20,lum:25+Math.random()*10});
    const dustP = []; for(let i=0;i<300;i++) dustP.push({x:Math.random()*200,y:Math.random()*200,z:Math.random(),s:0.3+Math.random()*2,dx:(Math.random()-0.5)*0.02,dy:(Math.random()-0.5)*0.02});
    const birds = []; for(let i=0;i<8;i++) birds.push({x:Math.random()*200,y:Math.random()*200,phase:Math.random()*Math.PI*2,spd:0.01+Math.random()*0.02,r:2+Math.random()*5,h:0.3+Math.random()*0.5});
    let stormActive=false, stormPhase=0, stormIntensity=0;
    let mirageTimer=0;
    const audioData = new Uint8Array(64);
    let time = 0;

    const draw = (ts) => {
      raf = requestAnimationFrame(draw);
      if (ts - lastFrame < frameDur) return;
      lastFrame = ts; time += 0.033;
      const W = canvas.width, H = canvas.height;
      if (!W || !H) return;
      if (useUIStore.getState().mode !== 'dark') { ctx.clearRect(0,0,W,H); return; }

      const analyser = usePlayerStore.getState().analyserRef?.current;
      const isPlaying = usePlayerStore.getState().isPlaying;
      const spaceMode = useUIStore.getState().spaceAdventure;
      const adventureActive = (spaceMode === 'on' || spaceMode === 'immersive') && isPlaying;
      const si = useUIStore.getState().superImmersive;
      const spdM = si ? 3.0 : 1.0;
      let bass=0,mid=0,high=0,energy=0;
      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(audioData);
        for(let i=0;i<8;i++) bass+=audioData[i];
        for(let i=8;i<32;i++) mid+=audioData[i];
        for(let i=32;i<64;i++) high+=audioData[i];
        bass/=2040; mid/=6120; high/=8160;
        energy=bass*0.5+mid*0.3+high*0.2;
      }

      // ── Day/night cycle (very slow) ──
      dayTime += 0.00003 * (isPlaying ? 1 + energy * 0.5 : 0.3);
      if (dayTime > 1) dayTime -= 1;
      const sunAngle = dayTime * Math.PI * 2;
      const sunUp = Math.sin(sunAngle); // -1 to 1, >0 = day
      const isNight = sunUp < -0.05;
      const isDusk = sunUp >= -0.05 && sunUp < 0.15;

      // ── Camera movement (matches space system — constant noise-driven direction) ──
      cam.nt += 0.003 + energy * 0.008;
      if (adventureActive) {
        const nx = sr(cam.nt, 1) - 0.5, ny = sr(cam.nt*0.7, 2) - 0.5;
        const na = sr(cam.nt*0.4, 3) - 0.5, np = sr(cam.nt*0.25, 4) - 0.5;
        const spd = (0.012 + energy*0.04 + bass*0.025) * spdM;
        cam.vx += (nx*spd - cam.vx)*0.015;
        cam.vy += (ny*spd - cam.vy)*0.015;
        // Constant heading changes — like space drift
        const turnRate = (0.006 + energy*0.004 + bass*0.003) * spdM;
        cam.va += (na*turnRate - cam.va)*0.012;
        cam.vp += (np*0.002 - cam.vp)*0.01;
      } else {
        // Idle: slow spin in place
        cam.va += (0.002 - cam.va)*0.008;
        cam.vx *= 0.97; cam.vy *= 0.97; cam.vp *= 0.95;
      }
      cam.x += cam.vx; cam.y += cam.vy; cam.angle += cam.va;
      cam.pitch = Math.max(-0.25, Math.min(0.25, cam.pitch + cam.vp));
      // Wrap world
      if(cam.x<0)cam.x+=200;if(cam.x>=200)cam.x-=200;
      if(cam.y<0)cam.y+=200;if(cam.y>=200)cam.y-=200;

      // ── Horizon line (affected by pitch) ──
      const horizon = H * (0.55 + cam.pitch);

      // ── SKY ──
      let skyTop, skyMid, skyBot;
      if (isNight) {
        skyTop = 'rgb(8,8,25)'; skyMid = 'rgb(15,15,40)'; skyBot = 'rgb(25,22,35)';
      } else if (isDusk) {
        const t = (sunUp + 0.05) / 0.2;
        skyTop = `rgb(${40+t*80},${30+t*50},${60+t*30})`;
        skyMid = `rgb(${180+t*40},${100+t*50},${60+t*20})`;
        skyBot = `rgb(${220},${160+t*30},${100+t*30})`;
      } else {
        // Harmattan day: pale, washed out, dusty
        const haze = 0.6 + energy * 0.1;
        skyTop = `rgb(${180+haze*30},${175+haze*25},${160+haze*20})`;
        skyMid = `rgb(${210+haze*20},${200+haze*15},${180+haze*10})`;
        skyBot = `rgb(${230+haze*10},${215+haze*10},${190+haze*5})`;
      }
      const skyG = ctx.createLinearGradient(0,0,0,horizon);
      skyG.addColorStop(0, skyTop); skyG.addColorStop(0.6, skyMid); skyG.addColorStop(1, skyBot);
      ctx.fillStyle = skyG; ctx.fillRect(0,0,W,horizon);

      // ── Sun (tracks with camera rotation — appears to move as you spin) ──
      if (sunUp > -0.05) {
        // Sun has a fixed world direction; camera rotation makes it slide across sky
        const sunWorldAngle = sunAngle * 0.5; // sun's world bearing
        const relAngle = sunWorldAngle - cam.angle; // relative to camera heading
        const sunX = W/2 + Math.cos(relAngle)*W*0.4;
        const sunY = Math.max(20, horizon - sunUp * horizon * 0.75 - cam.pitch*H*0.6);
        const sunR = 18 + (isDusk ? 14 : 0);
        const sunAlpha = Math.min(1, Math.max(0, sunUp*3+0.1));
        // Wide atmospheric glow
        const sg = ctx.createRadialGradient(sunX,sunY,0,sunX,sunY,sunR*10);
        sg.addColorStop(0, `rgba(255,240,200,${sunAlpha*0.25})`);
        sg.addColorStop(0.2, `rgba(255,225,160,${sunAlpha*0.12})`);
        sg.addColorStop(0.5, `rgba(255,210,140,${sunAlpha*0.04})`);
        sg.addColorStop(1, 'transparent');
        ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(sunX,sunY,sunR*10,0,Math.PI*2); ctx.fill();
        // Disc
        const dg = ctx.createRadialGradient(sunX,sunY,0,sunX,sunY,sunR);
        dg.addColorStop(0, `rgba(255,252,235,${sunAlpha*0.95})`);
        dg.addColorStop(0.7, `rgba(255,230,170,${sunAlpha*0.6})`);
        dg.addColorStop(1, `rgba(255,200,100,${sunAlpha*0.2})`);
        ctx.fillStyle=dg; ctx.beginPath(); ctx.arc(sunX,sunY,sunR,0,Math.PI*2); ctx.fill();
      }

      // ── Night stars ──
      if (isNight) {
        for(let i=0;i<120;i++){
          const sx=sn(i,7)*W, sy=sn(i,13)*horizon*0.8;
          const tw=0.3+0.2*Math.sin(time*2+i);
          ctx.beginPath(); ctx.arc(sx,sy,0.5+sn(i,3)*0.8,0,Math.PI*2);
          ctx.fillStyle=`rgba(255,255,240,${tw})`; ctx.fill();
        }
        // Moon
        const moonX=W*0.7+Math.cos(cam.angle*0.3)*100, moonY=horizon*0.25;
        const mg=ctx.createRadialGradient(moonX,moonY,0,moonX,moonY,18);
        mg.addColorStop(0,'rgba(230,230,245,0.9)');mg.addColorStop(0.5,'rgba(200,200,220,0.3)');mg.addColorStop(1,'transparent');
        ctx.fillStyle=mg;ctx.beginPath();ctx.arc(moonX,moonY,18,0,Math.PI*2);ctx.fill();
      }

      // ── GROUND ──
      const gndHue=isNight?25:38, gndSat=isNight?15:30, gndLum=isNight?12:Math.min(65,48+energy*8);
      const gndG = ctx.createLinearGradient(0,horizon,0,H);
      gndG.addColorStop(0, `hsl(${gndHue},${gndSat}%,${gndLum+8}%)`);
      gndG.addColorStop(0.3, `hsl(${gndHue},${gndSat}%,${gndLum}%)`);
      gndG.addColorStop(1, `hsl(${gndHue},${gndSat-5}%,${gndLum-5}%)`);
      ctx.fillStyle=gndG; ctx.fillRect(0,horizon,W,H-horizon);

      // ── World-to-screen (top-down world projected onto horizon perspective) ──
      const toScreen = (wx,wy,elev) => {
        let dx=wx-cam.x, dy=wy-cam.y;
        if(dx>100)dx-=200;if(dx<-100)dx+=200;
        if(dy>100)dy-=200;if(dy<-100)dy+=200;
        // Rotate by camera angle
        const cos=Math.cos(-cam.angle), sin=Math.sin(-cam.angle);
        const rx=dx*cos-dy*sin, ry=dx*sin+dy*cos;
        if(ry<0.5) return {visible:false};
        const perspective = 1/ry;
        const sx = W/2 + rx*W*0.5*perspective;
        const sy = horizon + (1-elev)*H*0.4*perspective - cam.pitch*H*perspective*0.3;
        return {x:sx,y:sy,visible:sx>-100&&sx<W+100&&sy>horizon-50&&sy<H+50,scale:perspective,dist:Math.sqrt(dx*dx+dy*dy)};
      };

      // ── Distant mountains (haze-faded layered silhouettes) ──
      mountains.forEach(m => {
        const s = toScreen(m.x,m.y,0);
        if(!s.visible||s.dist<20) return;
        const mw = m.w*s.scale*W*0.35, mh = m.h*s.scale*H*0.12;
        const alpha = Math.max(0,Math.min(0.25, 0.3-s.dist*0.002));
        const lum = isNight?m.lum-8:m.lum+(isDusk?8:20);
        // Gradient fill — fades into sky/haze at top
        const mg = ctx.createLinearGradient(s.x,s.y-mh,s.x,s.y);
        mg.addColorStop(0,`hsla(${m.hue},${isNight?4:8}%,${lum+15}%,${alpha*0.3})`);
        mg.addColorStop(0.4,`hsla(${m.hue},${isNight?5:10}%,${lum+5}%,${alpha*0.7})`);
        mg.addColorStop(1,`hsla(${m.hue},${isNight?6:12}%,${lum}%,${alpha})`);
        ctx.fillStyle=mg;
        // Irregular ridgeline with multiple peaks
        ctx.beginPath(); ctx.moveTo(s.x-mw/2,s.y);
        const seed = m.x*7+m.y*3;
        const peaks = 5 + Math.floor(sn(seed,1)*4);
        for(let p=0;p<=peaks;p++){
          const t=p/peaks;
          const px=s.x-mw/2+t*mw;
          const peakH=mh*(0.4+sn(seed+p,2)*0.65);
          ctx.lineTo(px, s.y-peakH);
        }
        ctx.lineTo(s.x+mw/2,s.y); ctx.closePath(); ctx.fill();
      });

      // ── Sand dunes ──
      dunes.forEach(d => {
        const s = toScreen(d.x,d.y,0);
        if(!s.visible||s.dist>60) return;
        const dw=d.w*s.scale*W*0.12, dh=d.h*s.scale*H*0.04;
        const alpha=Math.max(0.05,Math.min(0.6,1-s.dist*0.015));
        const shadowSide = Math.cos(sunAngle-cam.angle)>0?1:-1;
        // Dune body
        const dl=isNight?20:d.hue>42?55:48;
        ctx.fillStyle=`hsla(${d.hue},${isNight?10:28}%,${dl}%,${alpha})`;
        ctx.beginPath();
        ctx.moveTo(s.x-dw/2,s.y);
        ctx.quadraticCurveTo(s.x+shadowSide*dw*0.1,s.y-dh,s.x+dw/2,s.y);
        ctx.fill();
        // Shadow
        if(!isNight&&sunUp>0.1){
          ctx.fillStyle=`rgba(80,60,30,${alpha*0.25})`;
          ctx.beginPath();
          ctx.moveTo(s.x+shadowSide*dw*0.1,s.y);
          ctx.quadraticCurveTo(s.x+shadowSide*dw*0.3,s.y-dh*0.4,s.x+shadowSide*dw/2,s.y);
          ctx.fill();
        }
      });

      // ── Heat shimmer / mirage (day only) ──
      if(!isNight&&sunUp>0.2){
        mirageTimer+=0.02;
        for(let i=0;i<3;i++){
          const mx=W*(0.2+i*0.3)+Math.sin(mirageTimer+i)*40;
          const my=horizon+30+i*15;
          const mw=80+Math.sin(mirageTimer*0.7+i*2)*30;
          const mg=ctx.createRadialGradient(mx,my,0,mx,my,mw);
          mg.addColorStop(0,`rgba(230,220,190,${0.06+energy*0.02})`);
          mg.addColorStop(1,'transparent');
          ctx.fillStyle=mg;ctx.beginPath();ctx.arc(mx,my,mw,0,Math.PI*2);ctx.fill();
        }
      }

      // ── Dust particles ──
      dustP.forEach(p => {
        p.x+=p.dx+(stormActive?stormIntensity*0.15:0);
        p.y+=p.dy+(stormActive?stormIntensity*0.05:0);
        if(p.x<0)p.x+=200;if(p.x>=200)p.x-=200;
        if(p.y<0)p.y+=200;if(p.y>=200)p.y-=200;
        const s=toScreen(p.x,p.y,p.z*0.3);
        if(!s.visible) return;
        const r=p.s*Math.max(0.5,s.scale*3);
        const a=Math.min(0.5,0.15+energy*0.1)*(stormActive?2:1);
        const dustHue=isNight?30:40;
        const pg=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,r*2);
        pg.addColorStop(0,`hsla(${dustHue},30%,${isNight?40:70}%,${a})`);
        pg.addColorStop(1,'transparent');
        ctx.fillStyle=pg;ctx.beginPath();ctx.arc(s.x,s.y,r*2,0,Math.PI*2);ctx.fill();
      });

      // ── Atmospheric haze (distance fog) ──
      const hazeAlpha = isNight?0.15:0.25+energy*0.05;
      const hazeG=ctx.createLinearGradient(0,horizon,0,horizon+H*0.15);
      hazeG.addColorStop(0,`rgba(${isNight?'20,18,30':'210,195,170'},${hazeAlpha})`);
      hazeG.addColorStop(1,'transparent');
      ctx.fillStyle=hazeG;ctx.fillRect(0,horizon,W,H*0.15);

      // ── Birds ──
      birds.forEach(b => {
        b.phase+=b.spd;
        const bx=b.x+Math.cos(b.phase)*b.r;
        const by=b.y+Math.sin(b.phase*0.5)*b.r*0.3;
        const s=toScreen(bx,by,b.h);
        if(!s.visible||s.dist>40) return;
        const wing=Math.sin(time*8+b.phase)*3*s.scale*20;
        const sz=Math.max(1,s.scale*15);
        ctx.strokeStyle=`rgba(${isNight?'180,180,200':'60,40,20'},${Math.min(0.6,0.8-s.dist*0.02)})`;
        ctx.lineWidth=Math.max(0.5,sz*0.15);
        ctx.beginPath();
        ctx.moveTo(s.x-sz,s.y+wing*0.5);ctx.quadraticCurveTo(s.x-sz*0.3,s.y-wing,s.x,s.y);
        ctx.quadraticCurveTo(s.x+sz*0.3,s.y-wing,s.x+sz,s.y+wing*0.5);
        ctx.stroke();
      });

      // ── Rare sandstorm ──
      if(!stormActive&&Math.random()<0.0001) { stormActive=true; stormPhase=0; stormIntensity=0; }
      if(stormActive){
        stormPhase+=0.005;
        stormIntensity=Math.sin(stormPhase*Math.PI)*0.8;
        if(stormPhase>1){stormActive=false;stormIntensity=0;}
        // Full-screen dust overlay
        ctx.fillStyle=`rgba(${isNight?'40,30,20':'190,170,130'},${stormIntensity*0.4})`;
        ctx.fillRect(0,0,W,H);
        // Streaking dust
        for(let i=0;i<Math.floor(stormIntensity*60);i++){
          const sx=Math.random()*W,sy=Math.random()*H;
          const sl=20+Math.random()*40;
          ctx.strokeStyle=`rgba(${isNight?'80,60,40':'220,200,160'},${stormIntensity*0.3})`;
          ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx+sl,sy+sl*0.2);ctx.stroke();
        }
      }

      // ── Night desert eeriness ──
      if(isNight){
        // Distant eyes (rare, creepy)
        if(Math.random()<0.0005){
          const ex=Math.random()*W, ey=horizon+30+Math.random()*(H-horizon-60);
          ctx.fillStyle='rgba(200,180,50,0.3)';
          ctx.beginPath();ctx.arc(ex,ey,1.5,0,Math.PI*2);ctx.fill();
          ctx.beginPath();ctx.arc(ex+6,ey,1.5,0,Math.PI*2);ctx.fill();
        }
        // Eerie ground fog
        for(let i=0;i<5;i++){
          const fx=sn(time*0.1+i,5)*W, fy=horizon+20+i*25;
          const fw=100+sn(i,9)*80;
          const fg=ctx.createRadialGradient(fx,fy,0,fx,fy,fw);
          fg.addColorStop(0,'rgba(30,25,40,0.08)');fg.addColorStop(1,'transparent');
          ctx.fillStyle=fg;ctx.beginPath();ctx.arc(fx,fy,fw,0,Math.PI*2);ctx.fill();
        }
      }

      // ── Global dust haze overlay (harmattan signature) ──
      if(!isNight){
        ctx.fillStyle=`rgba(220,210,185,${0.03+energy*0.02+bass*0.01})`;
        ctx.fillRect(0,0,W,H);
      }
    };

    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} style={{ position:'fixed',inset:0,zIndex:0,pointerEvents:'none' }} />;
}
