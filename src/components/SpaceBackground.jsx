import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import { useUIStore } from '../stores/uiStore';

// Simple smooth noise (avoid heavy Perlin lib)
function smoothNoise(t, seed) {
  const s = Math.sin(t * 0.7 + seed * 127.1) * 43758.5453;
  return s - Math.floor(s);
}
function smoothRandom(t, seed) {
  const a = smoothNoise(Math.floor(t), seed);
  const b = smoothNoise(Math.floor(t) + 1, seed);
  const f = t - Math.floor(t);
  const ease = f * f * (3 - 2 * f);
  return a + (b - a) * ease;
}

export default function SpaceBackground() {
  const canvasRef = useRef(null);
  const staticRef = useRef(null); // offscreen canvas for static stars

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    let raf;
    let lastFrame = 0;
    const FPS = 30;
    const frameDuration = 1000 / FPS;

    const resize = () => {
      const W = window.innerWidth, H = window.innerHeight;
      canvas.width = W; canvas.height = H;
    };

    resize();
    window.addEventListener('resize', resize);

    // ══════ WORLD SPACE — everything in world coords, camera moves ══════
    // World is large: 0-30 normalized. Camera viewport is ~1.0 wide.
    const cam = { x: 15, y: 15, vx: 0, vy: 0, zoom: 1, targetZoom: 1, noiseT: Math.random() * 1000 };
    let supernovas = [];
    let wormholeActive = false;
    let wormholePhase = 0;

    let orbitingSys = null;
    let orbitPhase = 0;
    let orbitTargetPhase = 0;
    let orbitCooldownSys = null;
    let orbitCooldownTimer = 0;

    // ── Distant galaxies (fewer, spread across vast 30x30 world) ──
    const galaxies = [];
    const solarSystems = [];
    for (let i = 0; i < 3; i++) {
      const type = Math.random() > 0.65 ? 'elliptical' : (Math.random() > 0.85 ? 'irregular' : 'spiral');
      const gx = 2 + Math.random() * 26;
      const gy = 2 + Math.random() * 26;
      galaxies.push({
        type, x: gx, y: gy,
        angle: Math.random() * Math.PI * 2,
        rotSpeed: 0.0008 + Math.random() * 0.0015,
        size: 0.2 + Math.random() * 0.6,
        hue: [220, 280, 340, 200, 310][i],
        arms: 2 + Math.floor(Math.random() * 3),
        tilt: 0.3 + Math.random() * 0.7, // perspective tilt
      });

      // Tie a solar system to the center of this galaxy
      const isSupernova = Math.random() < 0.1; // 10% chance
      if (!isSupernova) {
        const starHue = [50, 40, 30, 55, 45][i];
        const starSize = Math.random() * 5 + 3;
        const planets = [];
        const pCount = 3 + Math.floor(Math.random() * 4);
        for (let p = 0; p < pCount; p++) {
          const dist = 0.12 + p * 0.1 + Math.random() * 0.06;
          const moons = [];
          const moonCount = Math.random() > 0.4 ? 1 + Math.floor(Math.random() * 2) : 0;
          for (let mi = 0; mi < moonCount; mi++) {
            moons.push({ dist: 0.025 + mi * 0.015 + Math.random() * 0.01, phase: Math.random() * Math.PI * 2, speed: 0.3 + Math.random() * 0.5, size: 1.5 + Math.random() * 2, hue: Math.random() * 360 });
          }
          planets.push({
            dist, phase: Math.random() * Math.PI * 2,
            speed: 0.015 + Math.random() * 0.025,
            size: 5 + Math.random() * 14,
            hue: Math.random() * 360,
            hasRing: Math.random() > 0.7, // Rings are slightly rarer
            hasAtmosphere: Math.random() > 0.3,
            bands: Math.random() > 0.6 ? 2 + Math.floor(Math.random() * 4) : 0,
            moons,
          });
        }
        solarSystems.push({ cx: gx, cy: gy, starHue, starSize, planets });
      } else {
         // It's a supernova system. We don't add planets, we just mark it.
         solarSystems.push({ cx: gx, cy: gy, isSupernova: true, hasTriggered: false });
      }
    }

    // ── Nebulae (extremely sparse in 30x30) ──
    const nebulae = [];
    for (let i = 0; i < 4; i++) {
      nebulae.push({
        x: Math.random() * 30, y: Math.random() * 30,
        radius: 0.6 + Math.random() * 0.8,
        hue: [280, 340, 200, 160][i], hue2: [310, 20, 230, 190][i],
        opacity: 0.015 + Math.random() * 0.012,
      });
    }

    // ── Asteroid belts (rare standalone arcs) ──
    const asteroidBelts = [];
    for (let i = 0; i < 2; i++) {
      const belt = [];
      const bx = Math.random() * 30, by = Math.random() * 30;
      const bRadius = 0.3 + Math.random() * 0.3;
      for (let j = 0; j < 20; j++) {
        const angle = Math.random() * Math.PI * 2;
        const r = bRadius + (Math.random() - 0.5) * 0.06;
        belt.push({ angle, r, size: 0.5 + Math.random() * 1.5, speed: 0.005 + Math.random() * 0.01 });
      }
      asteroidBelts.push({ cx: bx, cy: by, rocks: belt });
    }

    // ── True 3D Starfield (parallax + forward flight) ──
    const fgStars = [];
    for (let i = 0; i < 2000; i++) {
      fgStars.push({
        x: (Math.random() - 0.5) * 8, y: (Math.random() - 0.5) * 6,
        z: 0.05 + Math.random() * 1.8, size: 0.3 + Math.random() * 1.0,
        twinkleSpeed: 0.2 + Math.random() * 0.5,  // Slow twinkle
        twinklePhase: Math.random() * Math.PI * 2,
        hue: 190 + Math.random() * 80,
      });
    }

    // ── Binary stars ──
    const binaryStars = [];
    for (let i = 0; i < 2; i++) {
      binaryStars.push({
        x: Math.random() * 30, y: Math.random() * 30,
        sep: 0.03 + Math.random() * 0.02,
        phase: Math.random() * Math.PI * 2,
        speed: 0.05 + Math.random() * 0.05,
        hueA: 40 + Math.random() * 20, hueB: 200 + Math.random() * 60,
        sizeA: 2 + Math.random() * 2, sizeB: 1.5 + Math.random() * 1.5,
      });
    }

    // ── Dust lanes (subtle wide gradient bands — no sharp lines) ──
    const dustLanes = [];
    for (let i = 0; i < 2; i++) {
      dustLanes.push({ x: Math.random() * 10, y: Math.random() * 10, angle: Math.random() * Math.PI, len: 0.8 + Math.random() * 0.6, opacity: 0.008 + Math.random() * 0.005 });
    }

    // ── Comets ──
    let comets = [];

    // ── Shooting stars ──
    let shootingStars = [];

    // Audio buffer
    const audioData = new Uint8Array(64);
    let time = 0;

    // ══════ MAIN DRAW LOOP ══════
    const draw = (timestamp) => {
      raf = requestAnimationFrame(draw);
      // Throttle to 30fps
      if (timestamp - lastFrame < frameDuration) return;
      lastFrame = timestamp;

      time += 0.033;
      const W = canvas.width, H = canvas.height;
      if (W === 0 || H === 0) return;

      // Read state once (cheap)
      const analyser = usePlayerStore.getState().analyserRef?.current;
      const isPlaying = usePlayerStore.getState().isPlaying;
      const spaceMode = useUIStore.getState().spaceAdventure; // 'off' | 'on' | 'immersive'
      const adventureActive = (spaceMode === 'on' || spaceMode === 'immersive') && isPlaying;

      // Audio
      let bass = 0, mid = 0, high = 0, energy = 0;
      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(audioData);
        for (let i = 0; i < 8; i++) bass += audioData[i];
        for (let i = 8; i < 32; i++) mid += audioData[i];
        for (let i = 32; i < 64; i++) high += audioData[i];
        bass /= 2040; mid /= 6120; high /= 8160;
        energy = bass * 0.5 + mid * 0.3 + high * 0.2;
      }

      // ── Camera movement ──
      if (adventureActive) {
        if (!wormholeActive) {
          cam.noiseT += 0.003 + energy * 0.01;
          // Smooth noise-based direction (non-predictable, non-circular)
          const nx = smoothRandom(cam.noiseT, 1) - 0.5;
          const ny = smoothRandom(cam.noiseT * 0.7, 2) - 0.5;
          const speed = 0.005 + energy * 0.018 + bass * 0.012;
          cam.vx += (nx * speed - cam.vx) * 0.02;
          cam.vy += (ny * speed - cam.vy) * 0.02;
          // Subtle zoom pulse on beat
          cam.zoom += (1.0 + bass * 0.15 - cam.zoom) * 0.03;
        }
      } else {
        // Idle: gentle sinusoidal float
        cam.vx += (Math.sin(time * 0.04) * 0.0003 - cam.vx) * 0.02;
        cam.vy += (Math.cos(time * 0.03) * 0.0002 - cam.vy) * 0.02;
      }

      // ── Wormhole Logic ──
      if (adventureActive && !wormholeActive && Math.random() < 0.00005) {
         wormholeActive = true;
         wormholePhase = 0;
      }
      if (wormholeActive) {
         wormholePhase += 0.01;
         if (wormholePhase > 1.0) {
            wormholeActive = false;
            // Teleport!
            cam.x = Math.random() * 30;
            cam.y = Math.random() * 30;
            cam.vx = (Math.random() - 0.5) * 1.5; // high speed exit
            cam.vy = (Math.random() - 0.5) * 1.5;
         } else {
            // Spin and accelerate
            const angle = Math.atan2(cam.vy, cam.vx) + 0.1 * wormholePhase;
            const spd = Math.sqrt(cam.vx*cam.vx + cam.vy*cam.vy) + 0.02 * wormholePhase;
            cam.vx = Math.cos(angle) * spd;
            cam.vy = Math.sin(angle) * spd;
         }
      }

      cam.x += cam.vx; cam.y += cam.vy;
      // Wrap world 30x30
      if (cam.x < 0) cam.x += 30; if (cam.x >= 30) cam.x -= 30;
      if (cam.y < 0) cam.y += 30; if (cam.y >= 30) cam.y -= 30;

      // Find closest solar system for zoom and gravitational pull
      let closestSystemDist = Infinity;
      let closestSys = null;
      
      if (orbitCooldownTimer > 0) orbitCooldownTimer -= 0.016;
      if (orbitCooldownTimer <= 0) orbitCooldownSys = null;

      solarSystems.forEach(sys => {
        let dx = sys.cx - cam.x, dy = sys.cy - cam.y;
        if (dx > 15) dx -= 30; if (dx < -15) dx += 30;
        if (dy > 15) dy -= 30; if (dy < -15) dy += 30;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestSystemDist) {
           closestSystemDist = dist;
           closestSys = sys;
        }
        
        // Gravitational pull toward galaxies when close enough, but not if we just exited it
        if (adventureActive && !wormholeActive && !orbitingSys && dist < 1.5 && dist > 0.05 && sys !== orbitCooldownSys) {
           cam.vx += (dx / dist) * 0.0008 * (1.5 - dist);
           cam.vy += (dy / dist) * 0.0008 * (1.5 - dist);
           
           // Enter orbit!
           if (dist < 0.6) {
               orbitingSys = sys;
               orbitPhase = Math.atan2(-dy, -dx); // Start angle where camera entered
               orbitTargetPhase = orbitPhase + Math.PI * 2 * (1 + Math.random() * 2); // Orbit 1 to 3 times
           }
        }
      });

      // ── Orbit Logic ──
      if (orbitingSys) {
          orbitPhase += 0.005 + energy * 0.01; // Orbit speed
          const r = 0.4; // Orbit radius
          cam.x = orbitingSys.cx + Math.cos(orbitPhase) * r;
          cam.y = orbitingSys.cy + Math.sin(orbitPhase) * r;
          closestSystemDist = r; // Force zoom

          // Exit orbit
          if (orbitPhase >= orbitTargetPhase) {
              const exitAngle = orbitPhase + Math.PI / 2; // Tangential exit
              const exitSpeed = 0.04 + energy * 0.02; // Slingshot speed
              cam.vx = Math.cos(exitAngle) * exitSpeed;
              cam.vy = Math.sin(exitAngle) * exitSpeed;
              orbitCooldownSys = orbitingSys;
              orbitCooldownTimer = 10.0; // 10 seconds cooldown
              orbitingSys = null;
          }
      }

      // Target zoom: if dist < 0.7, zoom = 3.8, else 1
      cam.targetZoom = closestSystemDist < 0.7 ? 3.8 : 1;
      cam.zoom += (cam.targetZoom - cam.zoom) * 0.05;

      // Deep space opacity: fade out when zoomed in (inside solar system)
      const deepSpaceOpacity = Math.max(0, 1 - (cam.zoom - 1) * 0.4);

      // World-to-screen converter with 3D depth scale and zoom
      const toScreen = (wx, wy, parallax = 1) => {
        let dx = wx - cam.x, dy = wy - cam.y;
        if (dx > 15) dx -= 30; if (dx < -15) dx += 30;
        if (dy > 15) dy -= 30; if (dy < -15) dy += 30;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const depthScale = Math.max(0.3, 1.8 - dist * 0.4) * parallax * cam.zoom;
        return {
          x: W / 2 + dx * W * parallax * cam.zoom,
          y: H / 2 + dy * H * parallax * cam.zoom,
          visible: Math.abs(dx * parallax * cam.zoom) < 1.5 && Math.abs(dy * parallax * cam.zoom) < 1.0,
          scale: depthScale, dist
        };
      };

      // ── Render ──
      // Static star background — with subtle parallax drift
      ctx.fillStyle = 'rgb(6,6,18)'; ctx.fillRect(0, 0, W, H);

      if (deepSpaceOpacity > 0) {
        ctx.save();
        ctx.globalAlpha = deepSpaceOpacity;

        // Dynamic Milky Way Band (drawn in screen space to prevent seams)
        const mwGrad = ctx.createLinearGradient(0, H * 0.3, W, H * 0.7);
        mwGrad.addColorStop(0, 'transparent');
        mwGrad.addColorStop(0.3, 'rgba(120,110,150,0.03)');
        mwGrad.addColorStop(0.5, 'rgba(140,130,180,0.05)');
        mwGrad.addColorStop(0.7, 'rgba(120,110,150,0.03)');
        mwGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = mwGrad;
        ctx.fillRect(0, 0, W, H);
        
        ctx.restore();
      }

      // ── Distant galaxies (diverse shapes) ──
      if (deepSpaceOpacity > 0) {
        ctx.save();
        ctx.globalAlpha = deepSpaceOpacity;
        galaxies.forEach(g => {
          g.angle += g.rotSpeed;
          const s = toScreen(g.x, g.y, 0.3);
          if (!s.visible) return;
          const sz = g.size * W * 0.35 * cam.zoom;
          const tilt = g.tilt || 0.5;
          
          if (g.type === 'spiral') {
            // Spiral arms with dense star clusters
            for (let arm = 0; arm < g.arms; arm++) {
              const armAngle = g.angle + (arm * Math.PI * 2) / g.arms;
              for (let p = 0; p < 40; p++) {
                const t = p / 40;
                const spiral = armAngle + t * 3.5;
                const r = t * sz;
                const px = s.x + Math.cos(spiral) * r;
                const py = s.y + Math.sin(spiral) * r * tilt;
                const dotR = (0.4 + t * 1.2 + (1 - t) * 0.6) * Math.max(1, cam.zoom * 0.5);
                ctx.beginPath(); ctx.arc(px, py, dotR, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${g.hue + t * 50}, 55%, 65%, ${0.12 * (1 - t * 0.4)})`;
                ctx.fill();
                // Scatter dust between arms
                if (p % 3 === 0) {
                  const jx = px + (Math.random() - 0.5) * sz * 0.15;
                  const jy = py + (Math.random() - 0.5) * sz * 0.1;
                  ctx.beginPath(); ctx.arc(jx, jy, (0.3 + Math.random() * 0.4) * Math.max(1, cam.zoom * 0.5), 0, Math.PI * 2);
                  ctx.fillStyle = `hsla(${g.hue + 20}, 40%, 55%, 0.04)`;
                  ctx.fill();
                }
              }
            }
          } else if (g.type === 'elliptical') {
             // Elliptical blob
             for (let p = 0; p < 150; p++) {
                const a = Math.random() * Math.PI * 2;
                const r = Math.pow(Math.random(), 2) * sz * 0.6;
                const px = s.x + Math.cos(a + g.angle) * r;
                const py = s.y + Math.sin(a + g.angle) * r * tilt;
                ctx.beginPath(); ctx.arc(px, py, (0.5 + Math.random()) * Math.max(1, cam.zoom * 0.5), 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${g.hue + Math.random()*20}, 40%, 75%, ${0.05 + Math.random() * 0.05})`;
                ctx.fill();
             }
          } else {
             // Irregular
             for (let p = 0; p < 80; p++) {
                const ox = (Math.random() - 0.5) * sz * 0.8;
                const oy = (Math.random() - 0.5) * sz * 0.8 * tilt;
                ctx.beginPath(); ctx.arc(s.x + ox, s.y + oy, (1 + Math.random() * 2) * Math.max(1, cam.zoom * 0.5), 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${g.hue + ox}, 50%, 65%, ${0.03 + Math.random() * 0.04})`;
                ctx.fill();
             }
          }

          // Core glow (bright center)
          const cg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, sz * 0.2);
          cg.addColorStop(0, `hsla(${g.hue + 10}, 50%, 85%, 0.2)`);
          cg.addColorStop(0.4, `hsla(${g.hue}, 40%, 65%, 0.08)`);
          cg.addColorStop(1, 'transparent');
          ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(s.x, s.y, sz * 0.2, 0, Math.PI * 2); ctx.fill();
          // Outer halo
          const oh = ctx.createRadialGradient(s.x, s.y, sz * 0.15, s.x, s.y, sz * 0.5);
          oh.addColorStop(0, `hsla(${g.hue}, 30%, 50%, 0.03)`);
          oh.addColorStop(1, 'transparent');
          ctx.fillStyle = oh; ctx.beginPath(); ctx.arc(s.x, s.y, sz * 0.5, 0, Math.PI * 2); ctx.fill();
        });
        ctx.restore();
      }

      if (deepSpaceOpacity > 0) {
        ctx.save();
        ctx.globalAlpha = deepSpaceOpacity;
        
        // ── Nebulae (layered, dual-hue) ──
        nebulae.forEach(n => {
          const s = toScreen(n.x, n.y, 0.4);
          const r = n.radius * W * 0.4 * cam.zoom;
          if (Math.abs(s.x - W / 2) > r + W / 2 || Math.abs(s.y - H / 2) > r + H / 2) return;
          const breathe = 1 + bass * 0.06;
          // Primary cloud
          const gr = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * breathe);
          gr.addColorStop(0, `hsla(${n.hue}, 65%, 45%, ${n.opacity * 1.2 + energy * 0.005})`);
          gr.addColorStop(0.35, `hsla(${n.hue + 20}, 55%, 35%, ${n.opacity * 0.5})`);
          gr.addColorStop(0.7, `hsla(${n.hue2 || n.hue + 60}, 45%, 28%, ${n.opacity * 0.2})`);
          gr.addColorStop(1, 'transparent');
          ctx.fillStyle = gr;
          ctx.fillRect(s.x - r * breathe, s.y - r * breathe, r * 2 * breathe, r * 2 * breathe);
          // Secondary wisp (offset)
          const gr2 = ctx.createRadialGradient(s.x + r * 0.3, s.y - r * 0.2, 0, s.x + r * 0.3, s.y - r * 0.2, r * 0.6);
          gr2.addColorStop(0, `hsla(${n.hue2 || n.hue + 60}, 50%, 50%, ${n.opacity * 0.6})`);
          gr2.addColorStop(1, 'transparent');
          ctx.fillStyle = gr2;
          ctx.beginPath(); ctx.arc(s.x + r * 0.3, s.y - r * 0.2, r * 0.6, 0, Math.PI * 2); ctx.fill();
        });

        // ── Dust lanes (soft gradient bands, no sharp lines) ──
        dustLanes.forEach(d => {
          const s = toScreen(d.x, d.y, 0.3);
          if (!s.visible) return;
          const len = d.len * W * 0.3 * cam.zoom;
          const ex = Math.cos(d.angle) * len;
          const ey = Math.sin(d.angle) * len;
          const perpX = -Math.sin(d.angle) * 40 * cam.zoom;
          const perpY = Math.cos(d.angle) * 40 * cam.zoom;
          const gr = ctx.createLinearGradient(s.x + perpX, s.y + perpY, s.x - perpX, s.y - perpY);
          gr.addColorStop(0, 'transparent');
          gr.addColorStop(0.3, `rgba(120,130,180,${d.opacity})`);
          gr.addColorStop(0.7, `rgba(120,130,180,${d.opacity})`);
          gr.addColorStop(1, 'transparent');
          ctx.fillStyle = gr;
          ctx.beginPath();
          ctx.moveTo(s.x - ex + perpX, s.y - ey + perpY);
          ctx.lineTo(s.x + ex + perpX, s.y + ey + perpY);
          ctx.lineTo(s.x + ex - perpX, s.y + ey - perpY);
          ctx.lineTo(s.x - ex - perpX, s.y - ey - perpY);
          ctx.closePath(); ctx.fill();
        });

        // ── Asteroid belts ──
        asteroidBelts.forEach(belt => {
          belt.rocks.forEach(rock => {
            rock.angle += rock.speed * 0.016;
            const wx = belt.cx + Math.cos(rock.angle) * rock.r;
            const wy = belt.cy + Math.sin(rock.angle) * rock.r;
            const s = toScreen(wx, wy, 0.7);
            if (!s.visible) return;
            ctx.beginPath(); ctx.arc(s.x, s.y, rock.size * cam.zoom, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(160,140,120,0.35)';
            ctx.fill();
          });
        });

        // ── True 3D Starfield (2000 round dots) ──
        fgStars.forEach(st => {
          // Move star forward based on speed to simulate 3D flight
          if (adventureActive) {
             const flightSpeed = 0.001 + energy * 0.003;
             st.z += flightSpeed * (wormholeActive ? 5 : 1);
          }
          // Reset to distant background if it flies past the camera
          if (st.z > 2.0) {
             st.z = 0.05;
             st.x = (Math.random() - 0.5) * 8;
             st.y = (Math.random() - 0.5) * 6;
          }

          // Anchor stars directly around camera coordinates to ensure visibility
          const stWorldX = cam.x + st.x;
          const stWorldY = cam.y + st.y;
          const s = toScreen(stWorldX, stWorldY, st.z);
          if (!s.visible) return;
          
          // Very gentle twinkling — slow and subtle, with soft music shimmer
          const twinkle = 0.55 + 0.15 * Math.sin(time * st.twinkleSpeed + st.twinklePhase);
          const shimmer = energy * 0.12;
          const renderSize = (st.size + shimmer) * Math.max(0.2, Math.pow(st.z, 1.5)) * Math.max(1, cam.zoom * 0.8);
          
          ctx.fillStyle = `hsla(${st.hue}, 25%, ${82 + energy * 12}%, ${twinkle + shimmer * 0.3})`;
          
          // Draw streak only during wormhole, otherwise round dots
          if (wormholeActive) {
             const stretch = 40;
             ctx.fillRect(s.x, s.y, renderSize, renderSize + stretch * st.z);
          } else {
             ctx.beginPath();
             ctx.arc(s.x, s.y, Math.max(0.4, renderSize * 0.5), 0, Math.PI * 2);
             ctx.fill();
          }
        });
        
        ctx.restore();
      }

      // ── Binary stars ──
      binaryStars.forEach(bs => {
        bs.phase += bs.speed * 0.016;
        const s = toScreen(bs.x, bs.y, 0.6);
        if (!s.visible) return;
        const ox = Math.cos(bs.phase) * bs.sep * W * 0.6;
        const oy = Math.sin(bs.phase) * bs.sep * W * 0.3;
        // Star A
        ctx.beginPath(); ctx.arc(s.x + ox, s.y + oy, bs.sizeA, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${bs.hueA}, 60%, 75%, 0.8)`; ctx.fill();
        // Star B
        ctx.beginPath(); ctx.arc(s.x - ox, s.y - oy, bs.sizeB, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${bs.hueB}, 50%, 70%, 0.7)`; ctx.fill();
      });

      // ── Solar systems ──
      solarSystems.forEach(sys => {
        const ss = toScreen(sys.cx, sys.cy, 0.8);
        if (!ss.visible) return;
        const scale = W * 0.8;
        const ds = ss.scale; // depth scale — grows when approaching

        if (sys.isSupernova) {
           // Trigger explosion when we get close
           if (ss.dist < 0.8 && !sys.hasTriggered) {
              sys.hasTriggered = true;
              sys.novaRadius = 0;
           }
           if (sys.hasTriggered) {
              sys.novaRadius += (2.0 - sys.novaRadius) * 0.05;
              const r = sys.novaRadius * W * ds;
              const flashOpacity = Math.max(0, 1 - sys.novaRadius / 2.0);
              
              // Blinding full-screen flash
              if (flashOpacity > 0.01) {
                 ctx.fillStyle = `rgba(255,255,255,${flashOpacity})`;
                 ctx.fillRect(0, 0, W, H);
              }
              
              // Remnant Nebula expanding
              const remG = ctx.createRadialGradient(ss.x, ss.y, 0, ss.x, ss.y, r);
              remG.addColorStop(0, `hsla(280, 80%, 70%, ${0.5 * (1 - flashOpacity)})`);
              remG.addColorStop(0.5, `hsla(190, 70%, 50%, ${0.2 * (1 - flashOpacity)})`);
              remG.addColorStop(1, 'transparent');
              ctx.fillStyle = remG;
              ctx.beginPath(); ctx.arc(ss.x, ss.y, r, 0, Math.PI*2); ctx.fill();
           } else {
              // Pre-nova dying star (pulsing violently, red supergiant)
              const pulse = 1.0 + Math.sin(time * 25) * 0.15;
              const starR = (8 + energy * 4) * ds * pulse;
              const sg = ctx.createRadialGradient(ss.x, ss.y, 0, ss.x, ss.y, starR * 4);
              sg.addColorStop(0, `hsla(10, 90%, 70%, ${0.6 + bass * 0.2})`);
              sg.addColorStop(1, 'transparent');
              ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(ss.x, ss.y, starR * 4, 0, Math.PI * 2); ctx.fill();

              ctx.beginPath(); ctx.arc(ss.x, ss.y, starR, 0, Math.PI * 2);
              ctx.fillStyle = `hsla(10, 90%, 85%, 0.9)`; ctx.fill();
           }
           return;
        }

        // Central star glow
        const starR = (sys.starSize + energy * 3) * ds;
        const sg = ctx.createRadialGradient(ss.x, ss.y, 0, ss.x, ss.y, starR * 6);
        sg.addColorStop(0, `hsla(${sys.starHue}, 80%, 80%, ${0.3 + bass * 0.15})`);
        sg.addColorStop(0.3, `hsla(${sys.starHue}, 70%, 60%, 0.08)`);
        sg.addColorStop(1, 'transparent');
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(ss.x, ss.y, starR * 6, 0, Math.PI * 2); ctx.fill();
        // Star core
        ctx.beginPath(); ctx.arc(ss.x, ss.y, starR, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${sys.starHue}, 80%, 85%, 0.9)`; ctx.fill();

        // Planets
        sys.planets.forEach((p, pi) => {
          p.phase += p.speed * 0.016;
          const px = ss.x + Math.cos(p.phase) * p.dist * scale;
          const py = ss.y + Math.sin(p.phase) * p.dist * scale * 0.5;
          const pr = (p.size + (pi === 0 ? bass : pi === 1 ? mid : high) * 3) * ds;

          // Orbit path (faint)
          ctx.beginPath(); ctx.ellipse(ss.x, ss.y, p.dist * scale, p.dist * scale * 0.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(100,120,160,0.06)'; ctx.lineWidth = 0.5; ctx.stroke();

          // Planet glow
          const pg = ctx.createRadialGradient(px, py, pr * 0.3, px, py, pr + p.size * 0.6);
          pg.addColorStop(0, `hsla(${p.hue}, 50%, 55%, 0.12)`);
          pg.addColorStop(1, 'transparent');
          ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, pr + p.size * 0.6, 0, Math.PI * 2); ctx.fill();

          // Planet body
          const bg = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, 0, px, py, pr);
          bg.addColorStop(0, `hsl(${p.hue}, 45%, 58%)`);
          bg.addColorStop(1, `hsl(${p.hue + 30}, 30%, 18%)`);
          ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();

          // Gas giant bands
          if (p.bands && pr > 4) {
            ctx.save(); ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.clip();
            for (let b = 0; b < p.bands; b++) {
              const by = py - pr + (pr * 2 / (p.bands + 1)) * (b + 1);
              ctx.fillStyle = `hsla(${p.hue + b * 15}, 30%, ${40 + b * 8}%, 0.15)`;
              ctx.fillRect(px - pr, by - 1.5, pr * 2, 3);
            }
            ctx.restore();
          }

          // Atmosphere halo
          if (p.hasAtmosphere && pr > 3) {
            ctx.beginPath(); ctx.arc(px, py, pr * 1.15, 0, Math.PI * 2);
            ctx.strokeStyle = `hsla(${p.hue + 40}, 60%, 65%, 0.12)`;  ctx.lineWidth = 1.5; ctx.stroke();
          }

          // Ring
          if (p.hasRing) {
            ctx.strokeStyle = `hsla(${p.hue + 20}, 40%, 60%, 0.3)`;
            ctx.lineWidth = 2; ctx.beginPath();
            ctx.ellipse(px, py, pr * 2, pr * 0.45, 0.3, 0, Math.PI * 2); ctx.stroke();
            // Inner ring
            ctx.strokeStyle = `hsla(${p.hue + 10}, 35%, 55%, 0.15)`;
            ctx.lineWidth = 1; ctx.beginPath();
            ctx.ellipse(px, py, pr * 1.6, pr * 0.35, 0.3, 0, Math.PI * 2); ctx.stroke();
          }

          // Moons
          p.moons.forEach(m => {
            m.phase += m.speed * 0.016;
            const mx = px + Math.cos(m.phase) * m.dist * scale;
            const my = py + Math.sin(m.phase) * m.dist * scale * 0.6;
            ctx.beginPath(); ctx.arc(mx, my, m.size * ds, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${m.hue}, 30%, 60%, 0.7)`; ctx.fill();
          });
        });
      });

      // ── Comets (longer-lived than shooting stars) ──
      if (Math.random() < 0.004) {
        comets.push({
          wx: cam.x + (Math.random() - 0.5) * 1.5, wy: cam.y + (Math.random() - 0.5),
          vx: (Math.random() - 0.5) * 0.01, vy: Math.random() * 0.005 + 0.002,
          life: 1, hue: 180 + Math.random() * 60,
        });
      }
      comets = comets.filter(c => {
        c.wx += c.vx; c.wy += c.vy; c.life -= 0.003;
        if (c.life <= 0) return false;
        const s = toScreen(c.wx, c.wy, 0.7);
        if (!s.visible) return c.life > 0;
        // Coma
        ctx.beginPath(); ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${c.hue}, 50%, 80%, ${c.life * 0.8})`; ctx.fill();
        // Ion tail
        const tailLen = 40 * c.life;
        const tg = ctx.createLinearGradient(s.x, s.y, s.x - c.vx * tailLen * 500, s.y - c.vy * tailLen * 500);
        tg.addColorStop(0, `hsla(${c.hue}, 60%, 70%, ${c.life * 0.4})`);
        tg.addColorStop(1, 'transparent');
        ctx.beginPath(); ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - c.vx * tailLen * 500, s.y - c.vy * tailLen * 500);
        ctx.strokeStyle = tg; ctx.lineWidth = 1; ctx.stroke();
        return true;
      });

      // ── Shooting stars (rare and elegant) ──
      if (Math.random() < (adventureActive ? 0.004 : 0.002)) {
        shootingStars.push({
          x: Math.random() * W, y: Math.random() * H * 0.5,
          len: 40 + Math.random() * 60, spd: 5 + Math.random() * 5,
          angle: Math.PI / 4 + Math.random() * 0.4, life: 1,
        });
      }
      shootingStars = shootingStars.filter(s => {
        s.x += Math.cos(s.angle) * s.spd; s.y += Math.sin(s.angle) * s.spd; s.life -= 0.02;
        if (s.life <= 0) return false;
        ctx.beginPath(); ctx.moveTo(s.x, s.y);
        const tx = s.x - Math.cos(s.angle) * s.len * s.life;
        const ty = s.y - Math.sin(s.angle) * s.len * s.life;
        ctx.lineTo(tx, ty);
        const g = ctx.createLinearGradient(s.x, s.y, tx, ty);
        g.addColorStop(0, `rgba(255,255,255,${s.life * 0.8})`); g.addColorStop(1, 'transparent');
        ctx.strokeStyle = g; ctx.lineWidth = 1; ctx.stroke();
        return true;
      });

      // ── Meteor Showers (extremely rare — ~once every 3-5 minutes) ──
      if (adventureActive && Math.random() < 0.00008) {
         const angle = Math.PI / 4 + (Math.random() - 0.5);
         for(let i=0; i<8; i++) {
           setTimeout(() => {
             shootingStars.push({
               x: Math.random() * W, y: Math.random() * H * 0.5,
               len: 40 + Math.random() * 60, spd: 5 + Math.random() * 8,
               angle: angle, life: 1.2,
             });
           }, Math.random() * 1200);
         }
      }

      // ── Supernovas ──
      // Extremely rare large explosion
      if (adventureActive && Math.random() < 0.0001) {
         supernovas.push({
            wx: cam.x + (Math.random() - 0.5) * 8,
            wy: cam.y + (Math.random() - 0.5) * 8,
            life: 1.0,
            hue: Math.random() * 360
         });
      }

      supernovas = supernovas.filter(sn => {
         sn.life -= 0.002;
         if (sn.life <= 0) return false;
         const s = toScreen(sn.wx, sn.wy, 0.4);
         if (!s.visible) return true;
         const t = 1 - sn.life; // 0 to 1
         const r = t * W * 0.8 * cam.zoom;
         const alpha = sn.life;
         
         // Flash
         if (t < 0.1) {
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * (1 - t*10) * 0.5})`;
            ctx.fillRect(0, 0, W, H);
         }

         // Expanding shell
         ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
         ctx.lineWidth = (2 + t * 10) * cam.zoom;
         ctx.strokeStyle = `hsla(${sn.hue}, 80%, 70%, ${alpha * 0.4})`;
         ctx.stroke();

         // Nebula remnant
         const gr = ctx.createRadialGradient(s.x, s.y, r * 0.2, s.x, s.y, r);
         gr.addColorStop(0, `hsla(${sn.hue + 40}, 60%, 80%, ${alpha * 0.2})`);
         gr.addColorStop(0.5, `hsla(${sn.hue}, 50%, 50%, ${alpha * 0.1})`);
         gr.addColorStop(1, 'transparent');
         ctx.fillStyle = gr;
         ctx.fill();

         return true;
      });

      // ── Warp streaks (adventure + heavy bass only) ──
      if (adventureActive && bass > 0.65) {
        const n = Math.floor((bass - 0.65) * 6);
        for (let i = 0; i < n; i++) {
          const sx = Math.random() * W, sy = Math.random() * H;
          const len = 8 + bass * 15;
          ctx.beginPath(); ctx.moveTo(sx, sy);
          ctx.lineTo(sx + cam.vx * len * 3000, sy + cam.vy * len * 3000);
          ctx.strokeStyle = `rgba(180,200,255,${0.04 + bass * 0.06})`; ctx.lineWidth = 0.5; ctx.stroke();
        }
      }
    };

    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />;
}
