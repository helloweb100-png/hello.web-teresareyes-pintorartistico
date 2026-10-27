/* ==========================================================================
   TERESA REYES · ARTISTA VISUAL — app.js
   Vanilla JS, sin dependencias. Cada módulo es independiente.
   --------------------------------------------------------------------------
   00 Configuración (¡editar aquí el WhatsApp!)   12 Series (tarjetas apiladas)
   01 Utilidades                                  13 Zoom a pantalla completa
   02 Motor de scroll (inercia + bus de frames)   14 Archivo + filtros
   03 Loader                                      15 Visor (lightbox)
   04 WhatsApp                                    16 Color (flood)
   05 Header, menú, progreso, spy                 17 Proceso (barco en la ruta)
   06 Reveals + titulares por palabras            18 Artista (parallax, contadores)
   07 Hero (parallax + partículas)                19 Formulario → WhatsApp
   08 Pincel y cursor                             20 Botones magnéticos
   09 Cintas (marquee por velocidad)              21 Botón flotante
   10 Filosofía (luna que se abre)                22 Arranque
   11 Obra destacada (scroll horizontal)
   ========================================================================== */
(() => {
  'use strict';

  /* ── 00 CONFIGURACIÓN ──────────────────────────────────────────────────── */
  const CONFIG = {
    // Número de WhatsApp de Teresa: código de país + número, SOLO dígitos.
    // Ejemplo México: '5215512345678'. Mientras esté vacío, los botones abren
    // WhatsApp para elegir contacto con el mensaje ya escrito.
    whatsappNumber: '',
    defaultMessage: 'Hola Teresa, vi tu portafolio y me encantaría conversar contigo.',
  };

  /* ── 01 UTILIDADES ─────────────────────────────────────────────────────── */
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp  = (a, b, t) => a + (b - a) * t;
  const easeIO  = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  const html = document.documentElement;
  const body = document.body;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer  = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const view = { w: innerWidth, h: innerHeight, max: 0 };
  const isDesktop = () => view.w >= 900;

  /* ── 02 MOTOR DE SCROLL ────────────────────────────────────────────────── */
  // Un solo requestAnimationFrame alimenta a todos los módulos: lee scrollY una
  // vez por frame y reparte. Los módulos cachean su geometría para no forzar layout.
  const frames = [];
  const measures = [];
  const geos = [];
  const onFrame = fn => frames.push(fn);
  const onMeasure = fn => measures.push(fn);
  const track = el => { const g = { el, top: 0, h: 0 }; geos.push(g); return g; };
  const inView = (g, pad = 0) => scrollY + view.h + pad > g.top && scrollY - pad < g.top + g.h;

  // Los módulos (onMeasure) solo recalculan su layout si cambió el viewport o se fuerza (carga, fuentes).
  // Si únicamente cambió la altura de la página (p. ej. una imagen lazy), se actualizan solo las posiciones cacheadas.
  let lastW = 0, lastH = 0;
  function measureAll(force = false) {
    const changed = force || innerWidth !== lastW || innerHeight !== lastH;
    view.w = lastW = innerWidth; view.h = lastH = innerHeight;
    if (changed) measures.forEach(fn => fn());
    geos.forEach(g => { const r = g.el.getBoundingClientRect(); g.top = r.top + scrollY; g.h = r.height; });
    view.max = Math.max(0, html.scrollHeight - view.h);
  }
  const absTop = el => el.getBoundingClientRect().top + scrollY;

  // Desplazamiento suave con inercia (solo ratón; en táctil se respeta el scroll nativo)
  const smooth = (() => {
    const enabled = finePointer && !reduceMotion;
    let target = scrollY, current = scrollY, locked = false;
    const maxY = () => Math.max(0, html.scrollHeight - innerHeight);

    function onWheel(e) {
      if (!enabled || locked || e.ctrlKey || e.defaultPrevented) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (e.target.closest && e.target.closest('[data-native-scroll]')) return;
      e.preventDefault();
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 32; else if (e.deltaMode === 2) dy *= innerHeight;
      target = clamp(target + dy * .92, 0, maxY());
    }
    if (enabled) {
      addEventListener('wheel', onWheel, { passive: false });
      // Si el scroll lo mueve algo externo (teclado, barra, ancla) nos resincronizamos
      addEventListener('scroll', () => { if (Math.abs(scrollY - current) > 2.5) target = current = scrollY; }, { passive: true });
    }
    return {
      enabled,
      update(dt) {
        if (!enabled || locked) { target = current = scrollY; return; }
        const d = target - current;
        if (Math.abs(d) < .1) return;
        current += d * (1 - Math.exp(-dt * 7));
        scrollTo(0, current);
      },
      to(y) {
        y = clamp(y, 0, maxY());
        if (enabled) target = y;
        else scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
      },
      jump(y) { target = current = y; scrollTo(0, y); },
      lock(on) { locked = on; html.classList.toggle('is-locked', on); if (!on) target = current = scrollY; },
    };
  })();

  let lastT = performance.now();
  let lastY = scrollY;
  const motion = { vy: 0 };
  function tick(now) {
    const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
    smooth.update(dt);
    const y = scrollY;
    motion.vy = lerp(motion.vy, y - lastY, .18);
    lastY = y;
    for (let i = 0; i < frames.length; i++) frames[i](y, motion.vy, now);
    requestAnimationFrame(tick);
  }

  let rzTimer;
  addEventListener('resize', () => {
    clearTimeout(rzTimer);
    rzTimer = setTimeout(() => {
      // En móvil la barra de direcciones cambia la altura: ignoramos cambios pequeños
      if (!finePointer && innerWidth === view.w && Math.abs(innerHeight - view.h) < 160) return;
      measureAll();
    }, 140);
  });

  // Navegación por anclas con el motor suave
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const el = document.getElementById(id.slice(1));
    if (!el) return;
    e.preventDefault();
    if (menu.isOpen()) menu.close();
    const go = a.dataset.filterGo;
    if (go) archive.setFilter(go);
    requestAnimationFrame(() => {
      smooth.to(id === '#inicio' ? 0 : absTop(el));
      history.replaceState(null, '', id);
    });
  });

  /* ── 03 LOADER ─────────────────────────────────────────────────────────── */
  function initLoader() {
    const loader = $('#loader');
    if (!loader) { body.classList.add('is-ready'); html.classList.remove('is-loading'); return; }
    const arc = $('#loader-arc'), pct = $('#loader-pct');
    const MIN = reduceMotion ? 300 : 1500, MAX = 6500;
    const heroImgs = $$('.hero img');
    const wait = img => new Promise(res => {
      if (img.complete) return res();
      img.addEventListener('load', res, { once: true });
      img.addEventListener('error', res, { once: true });
    });
    let assetsReady = false;
    Promise.all([...heroImgs.map(wait), document.fonts ? document.fonts.ready : null]).then(() => { assetsReady = true; });

    const t0 = performance.now();
    let progress = 0;
    (function step(now) {
      const el = now - t0;
      let goal = Math.min(92, (el / MIN) * 92);
      if ((assetsReady && el >= MIN) || el > MAX) goal = 100;
      progress += (goal - progress) * .11;
      if (goal === 100 && progress > 99.4) progress = 100;
      arc.style.strokeDashoffset = String(100 - progress);
      pct.textContent = String(Math.round(progress));
      if (progress < 100) return requestAnimationFrame(step);
      finish();
    })(t0);

    function finish() {
      loader.classList.add('is-leaving');
      setTimeout(() => { body.classList.add('is-ready'); html.classList.remove('is-loading'); }, reduceMotion ? 0 : 820);
      setTimeout(() => {
        loader.classList.add('is-gone');
        measureAll(true);
        const hash = location.hash;
        const target = hash.length > 1 && document.getElementById(hash.slice(1));
        if (target) smooth.jump(absTop(target));
      }, reduceMotion ? 50 : 2000);
    }
  }

  /* ── 04 WHATSAPP ───────────────────────────────────────────────────────── */
  const waNumber = () => (CONFIG.whatsappNumber || '').replace(/\D/g, '');
  const waUrl = msg => `https://wa.me/${waNumber()}?text=${encodeURIComponent(msg || CONFIG.defaultMessage)}`;
  function initWhatsApp() {
    $$('[data-wa]').forEach(a => { a.href = waUrl(a.dataset.waMsg); a.target = '_blank'; a.rel = 'noopener'; });
    const n = waNumber();
    if (n) $$('[data-wa-display]').forEach(el => { el.textContent = '+' + n; });
  }

  /* ── 05 HEADER, MENÚ, PROGRESO, SPY ────────────────────────────────────── */
  const menu = (() => {
    const el = $('#menu'), burger = $('#burger');
    const inertTargets = () => $$('main, footer, .fab');
    let open = false;
    function set(on) {
      open = on;
      el.classList.toggle('is-open', on);
      el.inert = !on;                                   // cerrado: fuera del orden de foco y del árbol de accesibilidad
      burger.setAttribute('aria-expanded', String(on));
      burger.setAttribute('aria-label', on ? 'Cerrar menú' : 'Abrir menú');
      html.classList.toggle('menu-open', on);
      inertTargets().forEach(t => { t.inert = on; });
      smooth.lock(on);
    }
    burger.addEventListener('click', () => set(!open));
    addEventListener('keydown', e => { if (e.key === 'Escape' && open) { set(false); burger.focus(); } });
    addEventListener('resize', () => { if (open && isDesktop()) set(false); });
    return { isOpen: () => open, close: () => set(false) };
  })();

  function initHeader() {
    const header = $('#site-header'), progress = $('.progress');
    let prevY = 0, solid = false, hidden = false, lastP = -1;
    onFrame(y => {
      const p = view.max > 0 ? clamp(y / view.max) : 0;
      if (Math.abs(p - lastP) > .0005) { progress.style.setProperty('--p', p.toFixed(4)); lastP = p; }
      const s = y > 40;
      if (s !== solid) { solid = s; header.classList.toggle('is-solid', s); }
      const d = y - prevY;
      if (Math.abs(d) > 6) {
        const hide = d > 0 && y > 360 && !menu.isOpen() && !html.classList.contains('is-locked');
        if (hide !== hidden) { hidden = hide; header.classList.toggle('is-hidden', hide); }
        prevY = y;
      }
      if (y < 200 && hidden) { hidden = false; header.classList.remove('is-hidden'); }
    });
  }

  function initSpy() {
    const links = $$('.nav a[data-spy]');
    const byId = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      const a = byId.get(e.target.id);
      if (!a || !e.isIntersecting) return;
      links.forEach(l => { l.classList.remove('is-active'); l.removeAttribute('aria-current'); });
      a.classList.add('is-active'); a.setAttribute('aria-current', 'true');
    }), { rootMargin: '-45% 0px -50% 0px' });
    byId.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }

  /* ── 06 REVEALS + TITULARES POR PALABRAS ───────────────────────────────── */
  function splitWords(root, wrapClass, innerClass) {
    let k = 0;
    const walk = node => {
      Array.from(node.childNodes).forEach(child => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const outer = document.createElement('span');
            outer.className = wrapClass;
            if (innerClass) {
              const inner = document.createElement('span');
              inner.className = innerClass; inner.style.setProperty('--k', k++); inner.textContent = part;
              outer.appendChild(inner);
            } else outer.textContent = part;
            frag.appendChild(outer);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') walk(child);
      });
    };
    walk(root);
  }

  function initReveal() {
    $$('[data-split]').forEach(el => splitWords(el, 'w', 'w__i'));
    if (!('IntersectionObserver' in window)) { $$('[data-reveal], [data-split]').forEach(el => el.classList.add('is-in')); return; }
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in'); io.unobserve(e.target);
    }), { threshold: .15, rootMargin: '0px 0px -8% 0px' });
    $$('[data-reveal], [data-split]').forEach(el => io.observe(el));
  }

  /* ── 07 HERO: PARALLAX + PARTÍCULAS ────────────────────────────────────── */
  function initHero() {
    const hero = $('.hero');
    if (!hero) return;
    const g = track(hero);

    // Parallax con el mouse sobre las capas .px
    const layers = $$('.px', hero).map(el => ({ el, depth: parseFloat(el.dataset.depth) || 0 }));
    let mx = 0, my = 0, tx = 0, ty = 0;
    if (finePointer && !reduceMotion) {
      addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        mx = (e.clientX / view.w - .5) * 2; my = (e.clientY / view.h - .5) * 2;
      }, { passive: true });
    }
    const inner = $('.hero__inner', hero), bg = $('.hero__bg', hero);
    let wx = 0, wy = 0, wscroll = -1;
    onFrame(y => {
      if (!inView(g)) return;
      tx = lerp(tx, mx, .07); ty = lerp(ty, my, .07);
      if (Math.abs(tx - wx) > .0008 || Math.abs(ty - wy) > .0008) {             // solo si el mouse movió algo
        wx = tx; wy = ty;
        layers.forEach(l => { l.el.style.transform = `translate3d(${(-tx * l.depth * 620).toFixed(2)}px, ${(-ty * l.depth * 620).toFixed(2)}px, 0)`; });
      }
      if (!reduceMotion && Math.abs(y - wscroll) > .5) {                          // solo si hubo scroll
        wscroll = y;
        inner.style.transform = `translate3d(0, ${(y * .1).toFixed(1)}px, 0)`;
        bg.style.transform = `translate3d(0, ${(y * .22).toFixed(1)}px, 0)`;
      }
    });

    // Partículas: gotas de pintura y barquitos a la deriva (se pausan fuera de pantalla)
    const cv = $('#hero-canvas');
    if (!cv || reduceMotion) return;
    const ctx = cv.getContext('2d');
    const colors = ['#FF3D9A', '#FF6A1F', '#FFC61A', '#14C2B0', '#2447E0'];
    const boat = new Path2D('M6 50h108L94 76H26z M60 6 18 50h84z');
    let W = 0, H = 0, parts = [], running = false, pointer = { x: -999, y: -999 };

    const spawn = (i, initial) => {
      const isBoat = i % 6 === 0;
      return {
        x: Math.random() * W, y: initial ? Math.random() * H : H + 30,
        r: isBoat ? 14 + Math.random() * 14 : 2.5 + Math.random() * 7,
        boat: isBoat, c: colors[i % colors.length], ph: Math.random() * 6.28,
        vx: (Math.random() - .5) * .22, vy: -(.1 + Math.random() * .32),
        a: .2 + Math.random() * .3, rot: (Math.random() - .5) * .5,
      };
    };
    function resize() {
      const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.5);
      if (Math.abs(r.width - W) < 1 && Math.abs(r.height - H) < 1 && parts.length) return;
      W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      parts = Array.from({ length: W < 700 ? 14 : 26 }, (_, i) => spawn(i, true));
    }
    resize(); onMeasure(resize);
    hero.addEventListener('pointermove', e => {
      const r = cv.getBoundingClientRect(); pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { pointer.x = pointer.y = -999; });

    function draw(t) {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.x += p.vx + Math.sin(t * .0007 + p.ph) * .28;
        p.y += p.vy;
        const dx = p.x - pointer.x, dy = p.y - pointer.y, d2 = dx * dx + dy * dy;
        if (d2 < 14400) { const d = Math.sqrt(d2) || 1, f = (120 - d) / 120; p.x += (dx / d) * f * 3; p.y += (dy / d) * f * 3; }
        if (p.y < -40 || p.x < -40 || p.x > W + 40) Object.assign(p, spawn(parts.indexOf(p), false));
        ctx.save();
        ctx.globalAlpha = p.a;
        if (p.boat) {
          const s = p.r / 60;
          ctx.translate(p.x, p.y); ctx.rotate(Math.sin(t * .0009 + p.ph) * .3 + p.rot); ctx.scale(s, s);
          ctx.fillStyle = '#fff'; ctx.strokeStyle = '#16121C'; ctx.lineWidth = 3 / s; ctx.lineJoin = 'round';
          ctx.fill(boat); ctx.stroke(boat);
        } else {
          ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
          ctx.globalAlpha = p.a * .6; ctx.beginPath(); ctx.arc(p.x + p.r * 1.5, p.y - p.r * .6, p.r * .32, 0, 6.2832); ctx.fill();
        }
        ctx.restore();
      }
      requestAnimationFrame(draw);
    }
    new IntersectionObserver(([e]) => {
      const should = e.isIntersecting && !document.hidden;
      if (should && !running) { running = true; requestAnimationFrame(draw); } else if (!should) running = false;
    }).observe(hero);
    document.addEventListener('visibilitychange', () => { if (document.hidden) running = false; });
  }

  /* ── 08 PINCEL Y CURSOR ────────────────────────────────────────────────── */
  function initBrush() {
    if (!finePointer || reduceMotion) return;
    const cv = $('#brush'), cur = $('#cursor'), label = $('#cursor-label');
    if (!cv || !cur) return;
    const ctx = cv.getContext('2d');
    let W = 0, H = 0;
    const size = () => { if (W === innerWidth && H === innerHeight) return; W = cv.width = innerWidth; H = cv.height = innerHeight; };
    size(); onMeasure(size);

    const palette = ['#FF3D9A', '#FF6A1F', '#FFC61A', '#14C2B0', '#2447E0'];
    let mx = -200, my = -200, cx = -200, cy = -200, lx = null, ly = null, w = 8, hue = 0, idle = 999, first = true;
    const drops = [];

    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      mx = e.clientX; my = e.clientY;
      if (first) { cx = mx; cy = my; first = false; }
      if (lx === null) { lx = mx; ly = my; }
      if (html.classList.contains('is-locked')) { lx = mx; ly = my; return; }
      const dx = mx - lx, dy = my - ly, d = Math.hypot(dx, dy);
      if (d < 3) return;
      w = lerp(w, clamp(5 + d * .45, 5, 24), .25);
      hue += d * .004;
      const nx = -dy / d, ny = dx / d;
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineCap = 'round'; ctx.strokeStyle = palette[Math.floor(hue) % palette.length]; ctx.globalAlpha = .55;
      for (let k = -1; k <= 1; k++) {                       // 3 "cerdas" del pincel
        ctx.lineWidth = w * (k === 0 ? .6 : .32);
        ctx.beginPath();
        ctx.moveTo(lx + nx * k * w * .32, ly + ny * k * w * .32);
        ctx.lineTo(mx + nx * k * w * .32, my + ny * k * w * .32);
        ctx.stroke();
      }
      lx = mx; ly = my; idle = 0;
    }, { passive: true });

    // Clic: salpicadura de pintura
    addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || html.classList.contains('is-locked')) return;
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * 6.283, s = 2 + Math.random() * 6;
        drops.push({ x: e.clientX, y: e.clientY, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 2 + Math.random() * 5, c: palette[i % 5], life: 1 });
      }
      idle = 0;
    });

    // Estados del cursor
    document.addEventListener('pointerover', e => {
      const t = e.target;
      if (!t.closest) return;
      const lab = t.closest('[data-cursor]');
      if (lab) { label.textContent = lab.dataset.cursor; cur.classList.add('is-label'); cur.classList.remove('is-link'); return; }
      cur.classList.remove('is-label');
      cur.classList.toggle('is-link', !!t.closest('a, button, select, input, textarea, label'));
    });
    document.documentElement.addEventListener('mouseleave', () => { cur.style.opacity = '0'; });
    document.documentElement.addEventListener('mouseenter', () => { cur.style.opacity = '1'; });

    onFrame(() => {
      cx = lerp(cx, mx, .24); cy = lerp(cy, my, .24);
      cur.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
      idle++;
      if (idle < 220 || drops.length) {
        ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(0,0,0,.05)'; ctx.fillRect(0, 0, W, H);       // desvanece el trazo
        ctx.globalCompositeOperation = 'source-over';
      } else if (idle === 220) ctx.clearRect(0, 0, W, H);
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.x += d.vx; d.y += d.vy; d.vx *= .91; d.vy = d.vy * .91 + .16; d.life -= .022;
        if (d.life <= 0) { drops.splice(i, 1); continue; }
        ctx.globalAlpha = d.life * .85; ctx.fillStyle = d.c;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r * d.life + .6, 0, 6.2832); ctx.fill();
      }
    });
  }

  /* ── 09 CINTAS (la velocidad del scroll acelera el marquee) ────────────── */
  function initRibbons() {
    const ribbons = $$('.ribbon');
    if (!ribbons.length || reduceMotion) return;
    const items = ribbons.map(r => {
      const track = $('.ribbon__track', r);
      return { r, track, base: track.innerHTML, dir: parseInt(r.dataset.ribbon, 10) || 1, anim: null, rate: 1 };
    });
    const build = it => {
      it.track.innerHTML = it.base;
      const w1 = it.track.getBoundingClientRect().width;
      if (!w1) return;
      const copies = Math.ceil((view.w * 1.4) / w1) + 1;
      for (let i = 0; i < copies; i++) it.track.insertAdjacentHTML('beforeend', it.base);
      if (it.anim) it.anim.cancel();
      it.anim = it.track.animate(
        [{ transform: 'translateX(0)' }, { transform: `translateX(${-w1}px)` }],
        { duration: (w1 / 70) * 1000, iterations: Infinity, direction: it.dir < 0 ? 'reverse' : 'normal', easing: 'linear' }
      );
    };
    onMeasure(() => items.forEach(build));
    onFrame((y, vy) => {
      const target = 1 + Math.min(Math.abs(vy) * .32, 7);
      items.forEach(it => { if (!it.anim) return; it.rate = lerp(it.rate, target, .08); it.anim.playbackRate = it.rate; });
    });
  }

  /* ── 10 FILOSOFÍA: el texto se enciende y la luna se abre ──────────────── */
  function initManifesto() {
    const sec = $('#filosofia');
    if (!sec) return;
    const g = track(sec);
    const title = $('#manifesto-title');
    const moon = $('#moon');
    splitWords(title, 'sw');
    const words = $$('.sw', title);
    let lit = -1;
    if (reduceMotion) return;

    onFrame(y => {
      if (!inView(g)) return;
      const range = g.h - view.h;
      const p = clamp((y - g.top) / range);

      const n = Math.round(clamp(p / .46) * words.length);       // fase 1: palabras
      if (n !== lit) { words.forEach((w, i) => w.classList.toggle('is-lit', i < n)); lit = n; }

      const out = clamp((p - .46) / .16);                         // fase 2: el texto se desvanece
      sec.style.setProperty('--to', (1 - out).toFixed(3));
      sec.style.setProperty('--ts', (1 + out * .07).toFixed(3));
      sec.style.setProperty('--tb', (out * 10).toFixed(1) + 'px');

      const open = clamp((p - .5) / .42);                         // fase 3: la luna se abre
      moon.style.clipPath = `circle(${(easeIO(open) * 150).toFixed(2)}% at 50% 50%)`;
      sec.style.setProperty('--ms', (1.3 - open * .3).toFixed(3));
      sec.style.setProperty('--vo', clamp((p - .8) / .14).toFixed(3));
      sec.style.setProperty('--qo', clamp((p - .86) / .12).toFixed(3));
    });
  }

  /* ── 11 OBRA DESTACADA: el scroll vertical mueve la galería horizontal ─── */
  function initHScroll() {
    const sec = $('#galeria');
    if (!sec || reduceMotion) return;
    const sticky = $('.hscroll__sticky', sec), trackEl = $('.hscroll__track', sec);
    const g = track(sec);
    let travel = 0, cards = [];

    onMeasure(() => {
      sec.classList.add('is-pinned');
      sec.style.removeProperty('--hs-h');
      trackEl.style.transform = 'none';
      travel = Math.max(0, trackEl.offsetWidth - view.w);
      sec.style.setProperty('--hs-h', (travel + view.h) + 'px');
      cards = $$('.hcard', trackEl).map(el => ({
        el, img: $('.hcard__media img', el), left: el.offsetLeft, w: el.offsetWidth,
      }));
    });

    onFrame(y => {
      if (!inView(g, view.h)) return;
      const p = travel ? clamp((y - g.top) / travel) : 0;
      const x = -p * travel;
      trackEl.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
      for (const c of cards) {                                    // parallax de cada pintura
        const center = c.left + c.w / 2 + x;
        const off = clamp((center - view.w / 2) / view.w, -1, 1);
        c.img.style.setProperty('--px', (off * -9).toFixed(2) + '%');
      }
    });

    // Accesibilidad: si el foco llega a una tarjeta fuera de vista, llevamos el scroll hasta ella
    sticky.addEventListener('focusin', e => {
      sticky.scrollLeft = 0;
      const card = e.target.closest('.hcard');
      if (!card || !travel) return;
      const c = cards.find(k => k.el === card);
      if (!c) return;
      const p = clamp((c.left - (view.w - c.w) / 2) / travel);
      smooth.to(g.top + p * travel);
    });
  }

  /* ── 12 SERIES: tarjetas que se apilan y se empequeñecen ───────────────── */
  function initSeries() {
    const stack = $('[data-stack]');
    if (!stack || reduceMotion) return;
    const g = track(stack);
    const cards = $$('.scard', stack);
    onFrame(() => {
      if (!inView(g)) return;
      cards.forEach((c, i) => {
        const next = cards[i + 1];
        if (!next) return;
        const cr = c.getBoundingClientRect(), nr = next.getBoundingClientRect();
        const p = clamp(1 - (nr.top - cr.top) / (cr.height * .92));
        c.style.transform = `scale(${(1 - p * .06).toFixed(4)}) translateY(${(-p * 12).toFixed(1)}px)`;
      });
    });
  }

  /* ── 13 ZOOM: el cuadro se abre hasta ocupar toda la pantalla ──────────── */
  function initZoom() {
    const sec = $('#campo');
    if (!sec || reduceMotion) return;
    const g = track(sec);
    onFrame(y => {
      if (!inView(g)) return;
      const p = clamp((y - g.top) / (g.h - view.h));
      const open = easeIO(clamp(p / .6));
      const mobile = view.w < 700;
      sec.style.setProperty('--zy', lerp(mobile ? 30 : 24, 0, open).toFixed(2) + '%');
      sec.style.setProperty('--zx', lerp(mobile ? 9 : 15, 0, open).toFixed(2) + '%');
      sec.style.setProperty('--zr', lerp(34, 0, open).toFixed(1) + 'px');
      sec.style.setProperty('--zs', lerp(1.4, 1, open).toFixed(3));
      sec.style.setProperty('--zo', clamp((p - .52) / .26).toFixed(3));
      sec.style.setProperty('--co', clamp((p - .66) / .2).toFixed(3));
      sec.style.setProperty('--zp', p.toFixed(3));
    });
  }

  /* ── 14 ARCHIVO: revelado escalonado + filtros ─────────────────────────── */
  const archive = (() => {
    const grid = $('#grid');
    if (!grid) return { setFilter() {} };
    const tiles = $$('.tile', grid), chips = $$('.chip');
    const io = new IntersectionObserver(entries => {
      let i = 0;
      entries.filter(e => e.isIntersecting).forEach(e => {
        e.target.style.setProperty('--d', (i++ * .08).toFixed(2) + 's');
        e.target.classList.add('is-in'); io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: .06 });
    tiles.forEach(t => io.observe(t));

    function setFilter(cat) {
      chips.forEach(c => { const on = c.dataset.filter === cat; c.classList.toggle('is-on', on); c.setAttribute('aria-pressed', String(on)); });
      tiles.forEach(t => {
        const show = cat === 'all' || t.dataset.cat === cat;
        t.classList.toggle('is-off', !show);
        if (!show) return;
        t.classList.remove('is-in'); t.style.removeProperty('--d');
        void t.offsetWidth;
        io.observe(t);
      });
      requestAnimationFrame(() => measureAll());
    }
    chips.forEach(c => c.addEventListener('click', () => setFilter(c.dataset.filter)));
    return { setFilter };
  })();

  /* ── 15 VISOR (lightbox) ───────────────────────────────────────────────── */
  const lightbox = (() => {
    const lb = $('#lightbox');
    if (!lb) return {};
    const img = $('#lb-img'), stage = $('#lb-stage');
    const cur = $('#lb-cur'), total = $('#lb-total'), title = $('#lb-title'), tech = $('#lb-tech'), note = $('#lb-note'), cta = $('#lb-cta');
    const pieceInput = $('#f-piece');
    const items = $$('#grid .art-open');
    const byId = Object.fromEntries(items.map((b, i) => [b.dataset.id, i]));
    const shell = () => $$('main, header, footer, .fab, .progress');
    let idx = -1, opener = null, zoomed = false, busy = false;
    total.textContent = String(items.length).padStart(2, '0');
    if (pieceInput) pieceInput.addEventListener('input', () => { pieceInput.dataset.touched = '1'; });

    const prefetch = i => { const d = items[(i + items.length) % items.length]?.dataset; if (d) { const im = new Image(); im.src = d.full; } };
    items.forEach((b, i) => b.addEventListener('pointerenter', () => prefetch(i), { once: true }));

    async function fill(i) {
      const d = items[i].dataset;
      idx = i;
      img.src = d.full; img.width = +d.w; img.height = +d.h;
      img.alt = `${d.title} — ${d.tech}, de Teresa Reyes`;
      cur.textContent = String(i + 1).padStart(2, '0');
      title.textContent = d.title; tech.textContent = d.tech; note.textContent = d.note;
      cta.href = waUrl(`Hola Teresa, vi la obra «${d.title}» en tu portafolio y me gustaría saber más.`);
      if (pieceInput && !pieceInput.dataset.touched) pieceInput.value = d.title;
      try { await img.decode(); } catch (_) { /* la imagen se mostrará al cargar */ }
      prefetch(i + 1); prefetch(i - 1);
    }

    async function open(i, from) {
      if (i < 0) return;
      opener = from || document.activeElement;
      zoomed = false; lb.classList.remove('is-zoom');
      lb.hidden = false;
      html.classList.add('lightbox-open');
      shell().forEach(el => { el.inert = true; });
      smooth.lock(true);
      await fill(i);
      void lb.offsetWidth;
      lb.classList.add('is-open');
      $('[data-lb-close]', lb).focus({ preventScroll: true });
      const src = from && from.querySelector('img');          // FLIP desde la miniatura
      if (src && !reduceMotion) {
        const a = src.getBoundingClientRect(), b = img.getBoundingClientRect();
        if (a.width && b.width) {
          img.animate([
            { transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})` },
            { transform: 'none' },
          ], { duration: 750, easing: 'cubic-bezier(.22,1,.36,1)' });
        }
      }
    }

    function close() {
      lb.classList.remove('is-open', 'is-zoom');
      setTimeout(() => {
        lb.hidden = true;
        html.classList.remove('lightbox-open');
        shell().forEach(el => { el.inert = false; });
        smooth.lock(false);
        if (opener && opener.focus) opener.focus({ preventScroll: true });
      }, reduceMotion ? 0 : 420);
    }

    async function go(dir) {
      if (busy) return;
      busy = true; zoomed = false; lb.classList.remove('is-zoom'); lb.classList.add('is-swap');
      await new Promise(r => setTimeout(r, reduceMotion ? 0 : 230));
      await fill((idx + dir + items.length) % items.length);
      lb.classList.remove('is-swap'); busy = false;
    }

    document.addEventListener('click', e => {
      const b = e.target.closest('.art-open');
      if (b && b.dataset.id in byId) { e.preventDefault(); open(byId[b.dataset.id], b); }
    });
    $('[data-lb-close]', lb).addEventListener('click', close);
    $('[data-lb-prev]', lb).addEventListener('click', () => go(-1));
    $('[data-lb-next]', lb).addEventListener('click', () => go(1));
    stage.addEventListener('click', e => { if (e.target === stage) close(); });

    // Zoom con clic (y el mouse "recorre" la imagen ampliada)
    const setOrigin = e => {
      const r = img.getBoundingClientRect();
      lb.style.setProperty('--zx', clamp((e.clientX - r.left) / r.width, 0, 1) * 100 + '%');
      lb.style.setProperty('--zy', clamp((e.clientY - r.top) / r.height, 0, 1) * 100 + '%');
    };
    img.addEventListener('click', e => { setOrigin(e); zoomed = !zoomed; lb.classList.toggle('is-zoom', zoomed); });
    img.addEventListener('pointermove', e => { if (zoomed && e.pointerType === 'mouse') setOrigin(e); });

    // Deslizar para cambiar de obra (táctil)
    let sx = 0, sy = 0;
    stage.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
    stage.addEventListener('pointerup', e => {
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!zoomed && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? 1 : -1);
    });

    addEventListener('keydown', e => {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Tab') {                                 // trampa de foco
        const f = $$('button, a[href]', lb).filter(el => !el.hidden && el.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    return { open, close };
  })();

  /* ── 16 COLOR: el color "inunda" la sección desde el panel elegido ─────── */
  function initColorPlay() {
    const sec = $('#color');
    if (!sec) return;
    const flood = $('#flood'), mood = $('#mood'), cta = $('#color-cta');
    const swatches = $$('.swatch', sec);
    let busy = false;

    function pick(btn) {
      if (busy || btn.getAttribute('aria-checked') === 'true') return;
      busy = true;
      swatches.forEach(s => { const on = s === btn; s.setAttribute('aria-checked', String(on)); s.tabIndex = on ? 0 : -1; });
      const r = sec.getBoundingClientRect(), b = btn.getBoundingClientRect();
      const fx = ((b.left + b.width / 2 - r.left) / r.width) * 100, fy = ((b.top + b.height / 2 - r.top) / r.height) * 100;
      flood.style.setProperty('--flood', btn.dataset.bg);
      mood.style.opacity = '0';
      const a = flood.animate([
        { clipPath: `circle(0% at ${fx}% ${fy}%)` },
        { clipPath: `circle(150% at ${fx}% ${fy}%)` },
      ], { duration: reduceMotion ? 1 : 1100, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
      a.onfinish = () => { sec.style.setProperty('--bg', btn.dataset.bg); a.cancel(); busy = false; };
      setTimeout(() => { mood.textContent = btn.dataset.mood; mood.style.opacity = '1'; }, reduceMotion ? 0 : 420);
      mood.style.transition = 'opacity .4s';
      const name = btn.dataset.color;
      const msg = `Hola Teresa, elegí el color ${name} en tu portafolio y me gustaría conversar contigo.`;
      cta.dataset.waMsg = msg; cta.href = waUrl(msg);
    }
    swatches.forEach((s, i) => {
      s.tabIndex = s.getAttribute('aria-checked') === 'true' ? 0 : -1;
      s.addEventListener('click', () => pick(s));
      s.addEventListener('keydown', e => {                          // flechas = radiogroup accesible
        const k = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!k) return;
        e.preventDefault();
        const n = swatches[(i + k + swatches.length) % swatches.length];
        n.focus(); pick(n);
      });
    });
  }

  /* ── 17 PROCESO: un barco navega por el camino mientras haces scroll ───── */
  function initProcess() {
    const rail = $('#rail');
    if (!rail) return;
    const svg = $('#proc-svg'), bg = $('#proc-bg'), fg = $('#proc-fg'), boat = $('#proc-boat');
    const dots = $$('.step__dot', rail);
    const g = track(rail);
    let len = 0;

    onMeasure(() => {
      const rr = rail.getBoundingClientRect();
      const pts = dots.map(d => { const r = d.getBoundingClientRect(); return { x: r.left + r.width / 2 - rr.left, y: r.top + r.height / 2 - rr.top }; });
      if (pts.length < 2) return;
      const amp = isDesktop() ? 78 : 18;
      let d = `M ${pts[0].x.toFixed(1)} ${Math.max(0, pts[0].y - 46).toFixed(1)} L ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], dy = b.y - a.y, s = i % 2 ? 1 : -1;
        d += ` C ${(a.x + s * amp).toFixed(1)} ${(a.y + dy * .33).toFixed(1)}, ${(b.x - s * amp).toFixed(1)} ${(a.y + dy * .66).toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
      }
      svg.setAttribute('viewBox', `0 0 ${rr.width.toFixed(1)} ${rr.height.toFixed(1)}`);
      bg.setAttribute('d', d); fg.setAttribute('d', d);
      len = fg.getTotalLength();
      fg.style.strokeDasharray = String(len);
    });

    onFrame((y, vy, t) => {
      if (!len || !inView(g, view.h * .3)) return;
      const p = clamp((y + view.h * .6 - g.top) / (g.h * .96));
      const L = len * p;
      fg.style.strokeDashoffset = String(len - L);
      const pt = fg.getPointAtLength(L);
      const bob = reduceMotion ? 0 : Math.sin(t * .003) * 3;
      const tilt = reduceMotion ? 0 : Math.sin(t * .0021) * 5;
      boat.style.transform = `translate3d(${pt.x.toFixed(1)}px, ${(pt.y + bob).toFixed(1)}px, 0) rotate(${tilt.toFixed(1)}deg)`;
    });
  }

  /* ── 18 ARTISTA: parallax de fotos + contadores ────────────────────────── */
  function initArtist() {
    const photos = $$('[data-parallax]');
    if (photos.length && !reduceMotion) {
      const sec = $('.artist__photos');
      const g = track(sec);
      onFrame(y => {
        if (!inView(g, 200)) return;
        const off = (y + view.h / 2) - (g.top + g.h / 2);
        photos.forEach(p => { p.style.transform = `translate3d(0, ${(off * parseFloat(p.dataset.parallax)).toFixed(1)}px, 0)`; });
      });
    }
    const fmt = n => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const el = e.target, end = +el.dataset.count, dur = reduceMotion ? 1 : 1900, t0 = performance.now();
      (function step(now) {
        const t = clamp((now - t0) / dur);
        el.textContent = fmt(Math.round(end * easeOut(t)));
        if (t < 1) requestAnimationFrame(step);
      })(t0);
    }), { threshold: .6 });
    $$('[data-count]').forEach(el => io.observe(el));
  }

  /* ── 19 FORMULARIO → WHATSAPP ──────────────────────────────────────────── */
  function initForm() {
    const form = $('#contact-form');
    if (!form) return;
    const name = $('#f-name'), topic = $('#f-topic'), piece = $('#f-piece'), msg = $('#f-msg'), ok = $('#form-ok');

    const fail = (input, errId, text) => {
      $('#' + errId).textContent = text;
      input.closest('.field').classList.add('has-err');
      input.setAttribute('aria-invalid', 'true');
    };
    const clear = input => {
      const f = input.closest('.field');
      f.classList.remove('has-err'); input.removeAttribute('aria-invalid');
      const err = $('.field__err', f); if (err) err.textContent = '';
    };
    [name, topic].forEach(i => i.addEventListener('input', () => clear(i)));

    form.addEventListener('submit', e => {
      e.preventDefault();
      [name, topic].forEach(clear);
      let bad = null;
      if (name.value.trim().length < 2) { fail(name, 'err-name', 'Cuéntale cómo te llamas para que sepa con quién habla.'); bad = bad || name; }
      if (!topic.value) { fail(topic, 'err-topic', 'Elige qué te trae por aquí.'); bad = bad || topic; }
      if (bad) { bad.focus(); return; }

      let text = `Hola Teresa, soy ${name.value.trim()}.\n\n${topic.value}.`;
      if (piece.value.trim()) text += `\nLa obra que me llamó: ${piece.value.trim()}.`;
      if (msg.value.trim()) text += `\n\n${msg.value.trim()}`;
      ok.hidden = false;
      const url = waUrl(text);
      // Sin 'noopener' en las features: con él window.open() devuelve siempre null y creeríamos que el navegador bloqueó la ventana
      const w = window.open(url, '_blank');
      if (w) { try { w.opener = null; } catch (_) { /* ignorar */ } } else location.href = url;
    });
  }

  /* ── 20 BOTONES: origen del "salpicón" y efecto magnético ──────────────── */
  function initButtons() {
    const setOrigin = (btn, e) => {
      const r = btn.getBoundingClientRect();
      btn.style.setProperty('--x', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      btn.style.setProperty('--y', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    };
    document.addEventListener('pointerover', e => {
      const b = e.target.closest && e.target.closest('.btn');
      if (b && !b.contains(e.relatedTarget)) setOrigin(b, e);
    });
    document.addEventListener('pointerout', e => {
      const b = e.target.closest && e.target.closest('.btn');
      if (b && !b.contains(e.relatedTarget)) setOrigin(b, e);
    });
    if (!finePointer || reduceMotion) return;
    $$('[data-magnetic]').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        el.style.translate = `${((e.clientX - r.left - r.width / 2) * .22).toFixed(1)}px ${((e.clientY - r.top - r.height / 2) * .32).toFixed(1)}px`;
      });
      el.addEventListener('pointerleave', () => { el.style.translate = ''; });
    });
  }

  /* ── 21 BOTÓN FLOTANTE ─────────────────────────────────────────────────── */
  function initFab() {
    const fab = $('#fab');
    if (!fab) return;
    setTimeout(() => {
      fab.classList.add('show-tip');
      setTimeout(() => fab.classList.remove('show-tip'), 5200);
    }, 5000);
  }

  /* ── 22 ARRANQUE ───────────────────────────────────────────────────────── */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!location.hash) scrollTo(0, 0);
  const yearEl = $('#year'); if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  initWhatsApp();
  initHeader();
  initSpy();
  initReveal();
  initHero();
  initBrush();
  initRibbons();
  initManifesto();
  initHScroll();
  initSeries();
  initZoom();
  initColorPlay();
  initProcess();
  initArtist();
  initForm();
  initButtons();
  initFab();
  initLoader();

  measureAll(true);
  addEventListener('load', () => measureAll(true));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => measureAll(true));
  if ('ResizeObserver' in window) {
    let t; new ResizeObserver(() => { clearTimeout(t); t = setTimeout(measureAll, 250); }).observe(body);
  }
  requestAnimationFrame(tick);
})();
