/* ══════════════════════════════════════════════════════════
   VANTA — Model 03 Nocturne
   Lenis + GSAP ScrollTrigger. Every set-piece is scrubbed.
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var hasGSAP = typeof window.gsap !== 'undefined';
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (hasGSAP) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.config({ nullTargetWarn: false });
    if (window.ScrollToPlugin) gsap.registerPlugin(ScrollToPlugin);
    if (window.CustomEase) {
      try { CustomEase.create('vanta', '0.16,1,0.3,1'); } catch (e) { /* noop */ }
    }
  }
  var EASE = (window.CustomEase && hasGSAP) ? 'vanta' : 'power3.out';

  /* ─────────────────────────────────────────────
     1 · SMOOTH SCROLL (Lenis → ScrollTrigger)
     ───────────────────────────────────────────── */
  var lenis = null;
  function initLenis() {
    if (typeof window.Lenis === 'undefined' || REDUCED) return;
    lenis = new Lenis({
      duration: 1.15,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      touchMultiplier: 1.6
    });
    if (hasGSAP) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }

  /* ─────────────────────────────────────────────
     2 · CUSTOM CURSOR
     ───────────────────────────────────────────── */
  function initCursor() {
    var dot = $('#cursorDot'), ring = $('#cursorRing'), label = $('#cursorLabel');
    if (!dot || !ring) return;
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return;

    var mx = window.innerWidth / 2, my = window.innerHeight / 2;
    var dx = mx, dy = my, rx = mx, ry = my, shown = false;

    window.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
      if (!shown) {
        shown = true;
        dot.style.opacity = '1';
        ring.style.opacity = '1';
      }
    }, { passive: true });

    document.addEventListener('mouseleave', function () {
      dot.style.opacity = '0'; ring.style.opacity = '0'; shown = false;
    });

    (function loop() {
      dx += (mx - dx) * 0.36;  dy += (my - dy) * 0.36;
      rx += (mx - rx) * 0.13;  ry += (my - ry) * 0.13;
      dot.style.transform  = 'translate3d(' + dx + 'px,' + dy + 'px,0)';
      ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
      requestAnimationFrame(loop);
    })();

    var targets = 'a, button, [data-cursor]';
    document.addEventListener('mouseover', function (e) {
      var t = e.target.closest ? e.target.closest(targets) : null;
      if (!t) return;
      ring.classList.add('is-active');
      label.textContent = t.getAttribute('data-cursor') || '';
    });
    document.addEventListener('mouseout', function (e) {
      var t = e.target.closest ? e.target.closest(targets) : null;
      if (!t) return;
      if (e.relatedTarget && t.contains(e.relatedTarget)) return;
      ring.classList.remove('is-active');
      label.textContent = '';
    });
  }

  /* ─────────────────────────────────────────────
     3 · SCROLL-SCRUBBED VIDEO
     Pause, wait for metadata, lerp currentTime toward
     the scroll-derived target so it never looks steppy.
     Falls back to the poster still if the file is absent.
     ───────────────────────────────────────────── */
  function Scrubber(video) {
    this.el = video;
    this.ready = false;
    this.dead = false;
    this.duration = 0;
    this.target = 0;
    this.current = 0;
    this.onchange = null;
  }

  Scrubber.prototype.attach = function () {
    var self = this, v = this.el;
    if (!v) { this.dead = true; return Promise.resolve(false); }
    var src = v.getAttribute('data-src');
    if (!src) { this.dead = true; return Promise.resolve(false); }

    return probe(src).then(function (exists) {
      if (exists === false) { self.fail(); return false; }
      return new Promise(function (resolve) {
        var settled = false;
        var done = function (ok) {
          if (settled) return;
          settled = true;
          if (!ok) self.fail(); else self.arm();
          resolve(ok);
        };
        v.addEventListener('loadedmetadata', function () { done(true); }, { once: true });
        v.addEventListener('error', function () { done(false); }, { once: true });
        // hard timeout so a stalled/absent file never blocks the page
        setTimeout(function () { done(v.readyState >= 1); }, 6000);
        try { v.src = src; v.load(); } catch (e) { done(false); }
      });
    });
  };

  Scrubber.prototype.fail = function () {
    this.dead = true;
    this.ready = false;
    if (this.el) {
      this.el.removeAttribute('src');
      this.el.style.display = 'none';
    }
  };

  Scrubber.prototype.arm = function () {
    var v = this.el;
    try { v.pause(); } catch (e) { /* noop */ }
    v.currentTime = 0;
    this.duration = (isFinite(v.duration) && v.duration > 0) ? v.duration : 0;
    if (!this.duration) { this.fail(); return; }
    this.ready = true;
    v.classList.add('is-live');
  };

  Scrubber.prototype.seek = function (p) {
    if (!this.ready) return;
    this.target = Math.max(0, Math.min(1, p)) * (this.duration - 0.05);
  };

  Scrubber.prototype.tick = function () {
    if (!this.ready) return false;
    var d = this.target - this.current;
    if (Math.abs(d) < 0.004) return false;
    this.current += d * 0.32;              // scrub:1 feel — lerp, never raw
    try { this.el.currentTime = this.current; } catch (e) { /* noop */ }
    return true;
  };

  // HEAD-probe so an unrendered clip never wedges the page.
  // Returns true / false / null (unknown — e.g. file:// where fetch is blocked).
  function probe(url) {
    if (location.protocol === 'file:' || typeof fetch !== 'function') {
      return Promise.resolve(null);
    }
    return fetch(url, { method: 'HEAD', cache: 'no-store' })
      .then(function (r) { return r.ok; })
      .catch(function () { return null; });
  }

  var revealScrub = new Scrubber($('#revealVideo'));
  var driveScrub  = new Scrubber($('#driveVideo'));

  /* ─────────────────────────────────────────────
     4 · PRELOADER
     ───────────────────────────────────────────── */
  var HERO_IMAGES = [
    'assets/img/vanta-veiled.jpg?v=20260827',
    'assets/img/vanta-hero.jpg?v=20260827',
    'assets/img/vanta-desert.jpg?v=20260827',
    'assets/img/vanta-silhouette.jpg',
    'assets/img/vanta-wheel.jpg',
    'assets/img/outro-bg.jpg?v=20260827'
  ];
  var STATUS = [
    'WAKING THE SYSTEM',
    'READING CARDS',
    'STARTING THE CLOCK',
    'ALL READY'
  ];

  function preload() {
    var loaded = 0, total = HERO_IMAGES.length + 1; // + the video probe pass
    var shown = 0;
    var numEl = $('#preCount'), fillEl = $('#preFill'), statusEl = $('#preStatus');

    function paint() {
      var real = loaded / total;
      // ease the displayed number toward the real number so it never jumps
      shown += (real - shown) * 0.18;
      var pct = Math.min(99, Math.round(shown * 100));
      if (numEl) numEl.textContent = pct;
      if (fillEl) fillEl.style.width = pct + '%';
      if (statusEl) {
        var s = STATUS[Math.min(STATUS.length - 1, Math.floor(shown * STATUS.length))];
        if (statusEl.textContent !== s) statusEl.textContent = s;
      }
      if (loaded < total || pct < 99) { schedule(paint); }
      else {
        if (numEl) numEl.textContent = '100';
        if (fillEl) fillEl.style.width = '100%';
        finish();
      }
    }
    schedule(paint);

    HERO_IMAGES.forEach(function (src) {
      var img = new Image();
      var bump = function () { loaded++; };
      img.onload = bump;
      img.onerror = bump;
      img.src = src;
      if (img.decode) { img.decode().catch(function () {}); }
    });

    Promise.all([revealScrub.attach(), driveScrub.attach()])
      .catch(function () { return null; })
      .then(function () { loaded++; });

    // absolute safety valve
    setTimeout(function () { loaded = total; }, 9000);
  }

  var booted = false;
  function finish() {
    if (booted) return;
    booted = true;
    var pre = $('#preloader');

    splitHeadline();
    var hero = hasGSAP ? heroIntro() : null;   // built paused so there is no flash

    var go = function () {
      if (pre) pre.setAttribute('hidden', '');
      document.body.classList.add('is-ready');
      buildScroll();
      if (hasGSAP) ScrollTrigger.refresh();
      if (hero) hero.play();
    };

    if (!hasGSAP || REDUCED) {
      if (pre) pre.style.display = 'none';
      go();
      return;
    }

    var slats = $$('.pre-shutter i');
    gsap.timeline()
      .to('.pre-inner', { opacity: 0, y: -18, duration: 0.3, ease: 'power2.in' })
      .set(pre, { background: 'transparent' })
      .set(slats, { scaleY: 1, transformOrigin: 'bottom' })
      .to(slats, {                                   // hard, staggered cut-out
        scaleY: 0, transformOrigin: 'top',
        duration: 0.62, ease: 'power4.inOut', stagger: 0.055
      }, '>-0.02')
      .add(go, '<0.12');
  }

  /* ─────────────────────────────────────────────
     5 · HERO INTRO
     ───────────────────────────────────────────── */
  var splitDone = false;
  function splitHeadline() {
    if (splitDone) return;
    splitDone = true;
    if (typeof window.SplitType === 'undefined') return;
    $$('[data-split]').forEach(function (el) {
      try {
        var s = new SplitType(el, { types: 'chars', tagName: 'span' });
        s.chars.forEach(function (c) { c.classList.add('hchar'); });
      } catch (e) { /* noop */ }
    });
  }

  function heroIntro() {
    if (!hasGSAP) return null;
    var chars = $$('.display--hero .hchar');
    var tl = gsap.timeline({ defaults: { ease: EASE }, paused: true });

    if (REDUCED) {
      gsap.set(chars.length ? chars : '.display--hero .line', { yPercent: 0, opacity: 1 });
      gsap.set(['.topbar', '.idle', '.reveal-copy .kicker', '.reveal-copy .lede',
                '.edge-stat', '.reveal-trio span', '.scroll-cue'], { opacity: 1, y: 0 });
      return tl;
    }

    if (chars.length) {
      tl.from(chars, { yPercent: 118, duration: 1.05, stagger: 0.018 }, 0);
    } else {
      tl.from('.display--hero .line', { yPercent: 110, duration: 1, stagger: 0.08 }, 0);
    }
    tl.from('.reveal-copy .kicker', { opacity: 0, y: 14, duration: 0.7 }, 0.15)
      .from('.reveal-copy .lede',   { opacity: 0, y: 16, duration: 0.8 }, 0.5)
      .from('.edge-stat',           { opacity: 0, y: 12, duration: 0.7, stagger: 0.09 }, 0.35)
      .from('.reveal-trio span',    { opacity: 0, x: 18, duration: 0.6, stagger: 0.08 }, 0.55)
      .from('.scroll-cue',          { opacity: 0, duration: 0.6 }, 0.9)
      .to('.topbar',                { opacity: 1, y: 0, duration: 0.7 }, 0.1)
      .to('.idle',                  { opacity: 1, y: 0, duration: 0.7 }, 0.7);
    return tl;
  }

  /* ─────────────────────────────────────────────
     6 · OCCLUDER — draws the live drive frame into a
     canvas that sits ABOVE the giant wordmark and is
     feather-masked to the car + dust plume, so the car
     passes in front of the letterforms.
     ───────────────────────────────────────────── */
  var occ = {
    canvas: $('#driveOccluder'),
    ctx: null,
    src: null,
    w: 0, h: 0,
    dirty: true,
    active: false
  };

  function occSize() {
    if (!occ.canvas) return;
    // offsetWidth/Height, not getBoundingClientRect — the canvas carries the
    // same scale transform as the media and the backing store must ignore it.
    var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    var w = Math.max(2, Math.round(occ.canvas.offsetWidth * dpr));
    var h = Math.max(2, Math.round(occ.canvas.offsetHeight * dpr));
    if (w === occ.w && h === occ.h) return;
    occ.w = occ.canvas.width = w;
    occ.h = occ.canvas.height = h;
    occ.dirty = true;
  }

  function occDraw() {
    if (!occ.canvas || !occ.ctx) return;
    var src = (driveScrub.ready && driveScrub.el) ? driveScrub.el : occ.src;
    if (!src) return;
    var sw = src.videoWidth || src.naturalWidth || 0;
    var sh = src.videoHeight || src.naturalHeight || 0;
    if (!sw || !sh) return;
    var scale = Math.max(occ.w / sw, occ.h / sh);
    var dw = sw * scale, dh = sh * scale;
    occ.ctx.clearRect(0, 0, occ.w, occ.h);
    try {
      occ.ctx.drawImage(src, (occ.w - dw) / 2, (occ.h - dh) / 2, dw, dh);
    } catch (e) { /* noop */ }
    occ.dirty = false;
  }

  function initOccluder() {
    if (!occ.canvas) return;
    occ.ctx = occ.canvas.getContext('2d');
    var plate = $('#drivePlate');
    if (plate) {
      if (plate.complete && plate.naturalWidth) { occ.src = plate; occ.dirty = true; }
      else plate.addEventListener('load', function () { occ.src = plate; occ.dirty = true; }, { once: true });
    }
    occSize();
    window.addEventListener('resize', function () { occSize(); occ.dirty = true; }, { passive: true });
    // If the canvas had no layout at boot (hidden ancestor, late font/layout pass) the
    // backing store would stay degenerate forever — re-measure on every refresh.
    if (hasGSAP) {
      ScrollTrigger.addEventListener('refresh', function () { occSize(); occ.dirty = true; });
    }
  }

  /* one rAF loop drives both scrubbers and the occluder repaint */
  function mediaLoop() {
    var moved = revealScrub.tick() || driveScrub.tick();
    if (occ.active && (moved || occ.dirty)) occDraw();
    requestAnimationFrame(mediaLoop);
  }

  /* ─────────────────────────────────────────────
     7 · SCROLL CHOREOGRAPHY
     ───────────────────────────────────────────── */
  function buildScroll() {
    initOccluder();
    requestAnimationFrame(mediaLoop);
    initConfigurator();
    initIdle();
    initMarquee();
    buildOutroLetters();

    if (!hasGSAP) {
      noGsapStatics();
      return;
    }

    /* HUD progress rail — always on */
    gsap.to('#hudProgress', {
      scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.4 }
    });

    runCounters(REDUCED);

    var mm = gsap.matchMedia();

    /* ══ REDUCED MOTION — end states, no scrub ══ */
    mm.add('(prefers-reduced-motion: reduce)', function () {
      gsap.set('#veilPlate', { opacity: 0 });
      gsap.set('.stage-plate--under', { scale: 1 });
      gsap.set('.gcard', { opacity: 1, y: 0, clipPath: 'inset(0% 0% 0% 0%)' });
      gsap.set('#driveWord', { xPercent: 0, scale: 1, opacity: 1 });
      gsap.set('.outro-letters .ch', { yPercent: 0, opacity: 1, rotateX: 0 });
      gsap.set('.outro-bg', { yPercent: 0, scale: 1 });
      gsap.set('.slab', { opacity: 1, y: 0 });
      // park both clips on their final frame — the reveal must read as revealed
      [revealScrub, driveScrub].forEach(function (s) {
        if (!s.ready) return;
        s.current = s.target = s.duration - 0.05;
        try { s.el.currentTime = s.current; } catch (e) { /* noop */ }
      });
      occ.active = true; occ.dirty = true;
    });

    /* ══ DESKTOP / TABLET — full pinned scrub ══ */
    mm.add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', function () {
      var kills = [];

      /* ── 01 · SHEET REVEAL ─────────────────── */
      var revealTL = gsap.timeline({
        scrollTrigger: {
          trigger: '#reveal',
          start: 'top top',
          end: '+=260%',
          pin: '#revealStage',
          pinSpacing: true,
          scrub: 1,
          onUpdate: function (self) { revealScrub.seek(self.progress); }
        }
      });
      revealTL
        .to('#veilPlate', {
          yPercent: -74, scale: 1.42, opacity: 0,
          filter: 'blur(14px) brightness(1.25)',
          ease: 'power1.in', duration: 0.62
        }, 0.06)
        .to('.stage-plate--under', { scale: 1, ease: 'none', duration: 0.86 }, 0)
        .to('.display--hero .hchar', {
          yPercent: -110, opacity: 0, stagger: { each: 0.006, from: 'start' },
          ease: 'power2.in', duration: 0.22
        }, 0.66)
        .to(['.reveal-copy .kicker', '.reveal-copy .lede'], { opacity: 0, y: -20, duration: 0.16 }, 0.66)
        .to('.scroll-cue', { opacity: 0, duration: 0.1 }, 0.04)
        .fromTo('.reveal-trio span',
          { color: 'rgba(255,255,255,.46)' },
          { color: '#FF4D14', stagger: 0.1, duration: 0.2, ease: 'none' }, 0.5)
        .to('.reveal-stage', { opacity: 0.15, duration: 0.14, ease: 'none' }, 0.86);

      kills.push(revealTL);

      /* ── 03 · DESERT DRIVE ─────────────────── */
      var driveTL = gsap.timeline({
        scrollTrigger: {
          trigger: '#drive',
          start: 'top top',
          end: '+=320%',
          pin: '#driveStage',
          pinSpacing: true,
          scrub: 1,
          onToggle: function (self) { occSize(); occ.active = self.isActive; occ.dirty = true; },
          onUpdate: function (self) { driveScrub.seek(self.progress); occ.dirty = true; }
        }
      });

      // media + occluder must move IDENTICALLY or the fake occlusion doubles up
      var media = ['#drivePlate', '#driveVideo', '#driveOccluder'];
      driveTL
        .fromTo(media, { scale: 1.16 }, { scale: 1, ease: 'none', duration: 1 }, 0)
        .fromTo('#driveWord',
          { xPercent: 22, scale: 1.22, opacity: 0 },
          { opacity: 1, duration: 0.12, ease: 'none' }, 0.02)
        .to('#driveWord', { xPercent: -22, scale: 1, ease: 'none', duration: 0.92 }, 0.04)
        .fromTo('.gcard',
          { yPercent: 42, opacity: 0, clipPath: 'inset(0% 0% 100% 0%)' },
          {
            yPercent: 0, opacity: 1, clipPath: 'inset(0% 0% 0% 0%)',
            stagger: 0.07, duration: 0.2, ease: 'power2.out'
          }, 0.52)
        .fromTo('.drive-caption', { opacity: 0 }, { opacity: 1, duration: 0.08 }, 0.14);

      kills.push(driveTL);

      /* ── 04 · HORIZONTAL DETAIL GALLERY ────── */
      var track = $('#galleryTrack');
      var galleryTL = null;
      if (track) {
        var shift = function () {
          return Math.max(0, track.scrollWidth - window.innerWidth + 24);
        };
        galleryTL = gsap.to(track, {
          x: function () { return -shift(); },
          ease: 'none',
          scrollTrigger: {
            trigger: '#gallery',
            start: 'top top',
            end: function () { return '+=' + (shift() + window.innerHeight * 0.6); },
            pin: '#galleryPin',
            pinSpacing: true,
            scrub: 1,
            invalidateOnRefresh: true,
            onUpdate: function (self) {
              gsap.set('#galleryRailFill', { scaleX: 0.08 + self.progress * 0.92 });
            }
          }
        });
        kills.push(galleryTL);
      }

      /* ── 05 · TRACKED OUTRO ────────────── */
      var outroTL = gsap.timeline({
        scrollTrigger: {
          trigger: '#outro',
          start: 'top top',
          end: '+=220%',
          pin: '#outroPin',
          pinSpacing: true,
          scrub: 1
        }
      });
      outroTL
        .fromTo('.outro-bg', { yPercent: 12, scale: 1.1 }, { yPercent: -6, scale: 1, ease: 'none', duration: 1 }, 0)
        .fromTo('.outro-letters .ch',
          { yPercent: 108, opacity: 0 },
          { yPercent: 0, opacity: 1, stagger: 0.055, duration: 0.34, ease: 'power3.out' }, 0.05)
        .fromTo('.outro-kicker', { opacity: 0, letterSpacing: '.16em' }, { opacity: 1, letterSpacing: '.36em', duration: 0.25 }, 0.1)
        .fromTo('.outro-sub', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.22 }, 0.62);
      kills.push(outroTL);

      /* ── section entrances ─────────────────── */
      var reveals = [
        ['#specs .sec-head > *', '#specs'],
        ['#config .config-head > *', '#config'],
        ['#config .config-stage', '#config'],
        ['#config .sw', '.swatches'],
        ['.reserve-wrap > *', '#reserve'],
        ['.foot-col', '.foot-grid']
      ];
      reveals.forEach(function (pair) {
        var els = $$(pair[0]);
        if (!els.length) return;
        var t = gsap.from(els, {
          opacity: 0, y: 34, duration: 0.9, stagger: 0.07, ease: EASE,
          scrollTrigger: { trigger: pair[1], start: 'top 78%', once: true }
        });
        kills.push(t);
      });

      gsap.from('.spec', {
        opacity: 0, y: 40, duration: 0.9, stagger: 0.09, ease: EASE,
        scrollTrigger: { trigger: '.spec-row', start: 'top 82%', once: true }
      });

      return function () {
        kills.forEach(function (t) { if (t && t.scrollTrigger) t.scrollTrigger.kill(); if (t) t.kill(); });
      };
    });

    /* ══ MOBILE — pins collapse to plain reveals ══ */
    mm.add('(max-width: 900px) and (prefers-reduced-motion: no-preference)', function () {
      var kills = [];

      // hero: veil still lifts, but on a short un-pinned scrub
      var t1 = gsap.timeline({
        scrollTrigger: { trigger: '#reveal', start: 'top top', end: 'bottom top', scrub: 0.8,
          onUpdate: function (self) { revealScrub.seek(self.progress); } }
      });
      t1.to('#veilPlate', { yPercent: -60, scale: 1.3, opacity: 0, ease: 'power1.in', duration: 0.7 }, 0)
        .to('.stage-plate--under', { scale: 1, ease: 'none', duration: 1 }, 0);
      kills.push(t1);

      var t2 = gsap.timeline({
        scrollTrigger: { trigger: '#drive', start: 'top bottom', end: 'bottom top', scrub: 0.8,
          onToggle: function (self) { occSize(); occ.active = self.isActive; occ.dirty = true; },
          onUpdate: function (self) { driveScrub.seek(self.progress); occ.dirty = true; } }
      });
      t2.fromTo(['#drivePlate', '#driveVideo', '#driveOccluder'], { scale: 1.14 }, { scale: 1, ease: 'none', duration: 1 }, 0)
        .fromTo('#driveWord', { xPercent: 14 }, { xPercent: -14, ease: 'none', duration: 1 }, 0);
      kills.push(t2);

      var t3 = gsap.from('.gcard', {
        opacity: 0, y: 24, stagger: 0.08, duration: 0.7, ease: EASE,
        scrollTrigger: { trigger: '#drive', start: 'top 30%', once: true }
      });
      kills.push(t3);

      gsap.set('#galleryTrack', { clearProps: 'transform' });
      var t4 = gsap.from('.slab', {
        opacity: 0, y: 36, duration: 0.8, stagger: 0.1, ease: EASE,
        scrollTrigger: { trigger: '#gallery', start: 'top 80%', once: true }
      });
      kills.push(t4);

      var t5 = gsap.from('.outro-letters .ch', {
        yPercent: 100, opacity: 0, stagger: 0.04, duration: 0.7, ease: EASE,
        scrollTrigger: { trigger: '#outro', start: 'top 70%', once: true }
      });
      kills.push(t5);
      gsap.set(['.outro-kicker', '.outro-sub'], { opacity: 1 });

      [['#specs .sec-head > *', '#specs'], ['.spec', '.spec-row'],
       ['#config .config-head > *', '#config'], ['.reserve-wrap > *', '#reserve']
      ].forEach(function (pair) {
        var els = $$(pair[0]);
        if (!els.length) return;
        kills.push(gsap.from(els, {
          opacity: 0, y: 26, duration: 0.8, stagger: 0.07, ease: EASE,
          scrollTrigger: { trigger: pair[1], start: 'top 85%', once: true }
        }));
      });

      occ.active = true; occ.dirty = true;

      return function () {
        kills.forEach(function (t) { if (t && t.scrollTrigger) t.scrollTrigger.kill(); if (t) t.kill(); });
      };
    });

    /* smooth in-page anchors through Lenis */
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (!id || id === '#') return;
        var el = document.querySelector(id);
        if (!el) return;
        e.preventDefault();
        if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.3 });
        else el.scrollIntoView();
      });
    });

    window.addEventListener('resize', debounce(function () {
      ScrollTrigger.refresh();
      occSize(); occ.dirty = true;
    }, 220), { passive: true });
  }

  function noGsapStatics() {
    // no GSAP at all — make sure nothing is stuck hidden
    var veil = $('#veilPlate');
    if (veil) veil.style.opacity = '0.18';
    occ.active = true; occ.dirty = true;
    runCounters(true);
  }

  /* ─────────────────────────────────────────────
     8 · COUNT-UPS
     ───────────────────────────────────────────── */
  var countersRun = false;
  function runCounters(instant) {
    if (countersRun) return;
    countersRun = true;
    $$('.count').forEach(function (el) {
      var to = parseFloat(el.getAttribute('data-count')) || 0;
      var dec = parseInt(el.getAttribute('data-dec'), 10) || 0;
      var fmt = function (v) {
        return dec ? v.toFixed(dec)
                   : Math.round(v).toLocaleString('en-US');
      };
      if (instant || !hasGSAP) { el.textContent = fmt(to); return; }
      var obj = { v: 0 };
      gsap.to(obj, {
        v: to, duration: 2.1, ease: 'power2.out',
        onUpdate: function () { el.textContent = fmt(obj.v); },
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });
  }

  /* ─────────────────────────────────────────────
     9 · FINISH CONFIGURATOR (masked wipe swap)
     ───────────────────────────────────────────── */
  function initConfigurator() {
    var view = $('#configView');
    var swatches = $$('.sw');
    if (!view || !swatches.length) return;
    var busy = false;

    function apply(btn) {
      if (busy || btn.classList.contains('is-active')) return;
      busy = true;

      swatches.forEach(function (s) { s.classList.remove('is-active'); s.removeAttribute('aria-current'); });
      btn.classList.add('is-active');
      btn.setAttribute('aria-current', 'true');

      var next = document.createElement('img');
      next.className = 'config-img';
      next.src = btn.getAttribute('data-img');
      next.alt = btn.getAttribute('data-alt') || '';
      next.style.filter = btn.getAttribute('data-grade');
      next.style.clipPath = 'inset(0% 0% 0% 100%)';
      next.style.zIndex = '2';
      view.appendChild(next);

      var swap = function () {
        var old = $('.config-img.is-live', view);
        next.classList.add('is-live');
        if (old && old !== next) old.remove();
        next.style.zIndex = '';
        busy = false;
      };

      // readout
      $('#configName').textContent  = btn.getAttribute('data-name');
      $('#configDesc').textContent  = btn.getAttribute('data-desc');
      $('#configCode').textContent  = btn.getAttribute('data-code');
      $('#configStatA').textContent = btn.getAttribute('data-stat-a');
      $('#configStatB').textContent = btn.getAttribute('data-stat-b');
      document.documentElement.style.setProperty('--accent', btn.getAttribute('data-accent'));

      if (!hasGSAP || REDUCED) {
        next.style.clipPath = 'inset(0% 0% 0% 0%)';
        swap();
        return;
      }
      gsap.timeline({ onComplete: swap })
        .fromTo(next,
          { clipPath: 'inset(0% 0% 0% 100%)', scale: 1.06 },
          { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: 0.82, ease: EASE }, 0)
        .fromTo('#configCode', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4 }, 0.25)
        .fromTo('#configName', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5 }, 0.14);
    }

    swatches.forEach(function (btn) {
      btn.addEventListener('click', function () { apply(btn); });
    });
    swatches[0].setAttribute('aria-current', 'true');
  }

  /* ─────────────────────────────────────────────
     10 · OUTRO LETTERS
     ───────────────────────────────────────────── */
  function buildOutroLetters() {
    var host = $('#outroLetters');
    if (!host) return;
    var word = host.textContent.trim();
    host.textContent = '';
    word.split('').forEach(function (ch) {
      var wrap = document.createElement('span');
      wrap.style.overflow = 'hidden';
      wrap.style.display = 'inline-block';
      wrap.style.paddingBottom = '.06em';
      var inner = document.createElement('span');
      inner.className = 'ch';
      inner.textContent = ch;
      wrap.appendChild(inner);
      host.appendChild(wrap);
    });
  }

  /* ─────────────────────────────────────────────
     11 · MARQUEE + IDLE INDICATOR
     ───────────────────────────────────────────── */
  function initMarquee() {
    var track = $('#marqueeTrack');
    if (!track || !hasGSAP || REDUCED) return;
    gsap.to(track, { xPercent: -50, duration: 26, ease: 'none', repeat: -1 });
  }

  function initIdle() {
    var btn = $('#idleToggle'), state = $('#idleState');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var on = btn.getAttribute('aria-pressed') === 'true';
      btn.setAttribute('aria-pressed', String(!on));
      if (state) state.textContent = on ? 'OFF' : 'ON';
    });
  }

  /* ─────────────────────────────────────────────
     util
     ───────────────────────────────────────────── */
  /* rAF is throttled to zero in a background tab — the preloader must still
     be able to finish, otherwise the page is stuck behind it on arrival. */
  function schedule(fn) {
    if (document.visibilityState === 'hidden') setTimeout(fn, 32);
    else requestAnimationFrame(fn);
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var a = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, a); }, ms);
    };
  }

  /* ─────────────────────────────────────────────
     BOOT
     ───────────────────────────────────────────── */
  initLenis();
  initCursor();
  if (hasGSAP && !REDUCED) {
    gsap.set('.topbar', { opacity: 0, y: -12 });
    gsap.set('.idle', { opacity: 0, y: 12 });
  }
  preload();

  window.addEventListener('load', function () {
    if (hasGSAP) ScrollTrigger.refresh();
  });
})();
