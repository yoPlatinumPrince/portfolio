/* ═══════════════════════════════════════════════════════════
   PLATINUM PRINCE — interactions
   ═══════════════════════════════════════════════════════════ */
(() => {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasPointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* ───────── Loader ───────── */
  const loader = $("#loader");
  function runLoader(done) {
    if (!loader) return done();
    const countEl = $("#loaderCount");
    const barEl   = $("#loaderBar");
    if (reduce) { loader.classList.add("loader--done"); return done(); }
    let n = 0;
    const tick = () => {
      n += Math.max(1, Math.round((100 - n) * 0.06) + Math.floor(Math.random() * 4));
      if (n >= 100) n = 100;
      countEl.textContent = n;
      barEl.style.width = n + "%";
      if (n < 100) {
        setTimeout(tick, 70 + Math.random() * 90);
      } else {
        setTimeout(() => { loader.classList.add("loader--done"); done(); }, 380);
      }
    };
    setTimeout(tick, 200);
  }

  /* ───────── Custom cursor ───────── */
  function initCursor() {
    if (!hasPointer) return;
    const cur = $("#cursor");
    const label = $("#cursorLabel");
    let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
    addEventListener("mousemove", (e) => { x = e.clientX; y = e.clientY; }, { passive: true });
    const loop = () => {
      cx += (x - cx) * 0.2; cy += (y - cy) * 0.2;
      cur.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      requestAnimationFrame(loop);
    };
    loop();

    const set = (mode) => {
      cur.classList.toggle("cursor--big", mode === "play");
      cur.classList.toggle("cursor--view", mode === "view");
      label.textContent = mode === "play" ? "Play" : mode === "view" ? "View" : "";
    };
    $$("[data-cursor]").forEach((el) => {
      el.addEventListener("mouseenter", () => set(el.dataset.cursor));
      el.addEventListener("mouseleave", () => set(""));
    });
    addEventListener("mousedown", () => cur.style.scale = "0.8");
    addEventListener("mouseup",   () => cur.style.scale = "1");
  }

  /* ───────── Hover-to-play videos ───────── */
  function initHoverVideos() {
    $$("[data-hover-video]").forEach((v) => {
      const card = v.closest(".tile, .interlude") || v;
      // Unmute on hover so reels play with sound; if the browser blocks unmuted
      // playback (no user gesture yet), fall back to muted so the video still plays.
      const play = () => {
        v.muted = false;
        v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
      };
      const stop = () => { v.pause(); v.muted = true; };
      if (hasPointer) {
        card.addEventListener("mouseenter", play);
        card.addEventListener("mouseleave", stop);
      }
    });

    // autoplay interlude when in view (and on touch devices, autoplay tiles softly)
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          const v = e.target;
          if (e.isIntersecting) v.play().catch(() => {});
          else v.pause();
        });
      }, { threshold: 0.5 });
      $$("[data-autoplay-inview]").forEach((v) => io.observe(v));

      if (!hasPointer) {
        const io2 = new IntersectionObserver((entries) => {
          entries.forEach((e) => { e.isIntersecting ? e.target.play().catch(() => {}) : e.target.pause(); });
        }, { threshold: 0.55 });
        $$("[data-hover-video]").forEach((v) => io2.observe(v));
      }
    }

    // Music videos: play muted in view (data-autoplay-inview); unmute on hover, re-mute on leave (keep playing).
    if (hasPointer) {
      $$("[data-featured-video]").forEach((feat) => {
        feat.addEventListener("mouseenter", () => { feat.muted = false; feat.play().catch(() => { feat.muted = true; }); });
        feat.addEventListener("mouseleave", () => { feat.muted = true; });
      });
    }
  }

  /* ───────── Split text into masked words ───────── */
  function makeWord(content, isHTML) {
    const ln = document.createElement("span"); ln.className = "ln";
    const inner = document.createElement("span"); inner.className = "ln__i";
    if (isHTML) inner.innerHTML = content; else inner.textContent = content;
    ln.appendChild(inner);
    return ln;
  }
  function splitWords(el) {
    const out = document.createDocumentFragment();
    [...el.childNodes].forEach((node) => {
      if (node.nodeType === 3) {
        node.textContent.split(/(\s+)/).forEach((p) => {
          if (p === "") return;
          if (/^\s+$/.test(p)) { out.appendChild(document.createTextNode(" ")); return; }
          out.appendChild(makeWord(p, false));
        });
      } else if (node.nodeName === "BR") {
        out.appendChild(document.createElement("br"));
      } else {
        out.appendChild(makeWord(node.outerHTML, true));
      }
    });
    el.innerHTML = "";
    el.appendChild(out);
    el.classList.add("split");
    return $$(".ln__i", el);
  }

  /* ───────── Reveals (GSAP if present, else IO fallback) ───────── */
  function splitStatement() {
    const el = $("[data-reveal-words]");
    if (!el) return;
    const html = el.innerHTML;
    // wrap plain words while preserving <em> tags
    const frag = document.createElement("div");
    frag.innerHTML = html;
    const wrap = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const words = child.textContent.split(/(\s+)/);
          const out = document.createDocumentFragment();
          words.forEach((w) => {
            if (w.trim() === "") { out.appendChild(document.createTextNode(w)); return; }
            const s = document.createElement("span");
            s.className = "word"; s.textContent = w;
            out.appendChild(s);
          });
          node.replaceChild(out, child);
        } else if (child.nodeType === 1) {
          child.classList && child.classList.add("word");
        }
      });
    };
    wrap(frag);
    el.innerHTML = frag.innerHTML;
  }

  function initReveals() {
    splitStatement();

    if (window.gsap && window.ScrollTrigger && !reduce) {
      gsap.registerPlugin(ScrollTrigger);

      // — Hero entrance: masked line reveal —
      $$(".hero__title .line").forEach((el) => {
        const i = document.createElement("span");
        i.className = "ln__i"; i.innerHTML = el.innerHTML;
        el.innerHTML = ""; el.appendChild(i);
      });
      const heroLines = $$(".hero__title .ln__i");
      gsap.set(heroLines, { yPercent: 120 });
      const intro = gsap.timeline({ delay: 0.1 });
      intro.to(heroLines, { yPercent: 0, duration: 1.25, ease: "expo.out", stagger: 0.13 })
           .from(".hero__top > *", { yPercent: -120, opacity: 0, duration: 1, ease: "expo.out", stagger: 0.1 }, 0.2)
           .from(".hero__lede, .hero__cue", { y: 30, opacity: 0, duration: 1, ease: "power3.out", stagger: 0.12 }, 0.45);

      // — Headings: word-by-word mask reveal —
      $$(".section-head__title, .chapter__label, .contact__big").forEach((el) => {
        const items = splitWords(el);
        gsap.set(items, { yPercent: 125 });
        gsap.to(items, {
          yPercent: 0, duration: 1, ease: "expo.out", stagger: 0.07,
          scrollTrigger: { trigger: el, start: "top 88%" }
        });
      });

      // — Generic block reveals —
      $$("[data-reveal]").forEach((el) => {
        gsap.fromTo(el, { opacity: 0, y: 40 }, {
          opacity: 1, y: 0, duration: 1.1, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%" }
        });
      });

      // — Chapter rule draws across —
      $$(".chapter__line").forEach((el) => {
        gsap.fromTo(el, { scaleX: 0 }, {
          scaleX: 1, duration: 1.3, ease: "expo.out",
          scrollTrigger: { trigger: el, start: "top 92%" }
        });
      });

      // — Tile reveals: clip uncover + inner scale, then live parallax —
      $$(".tile__frame").forEach((frame) => {
        const vid = frame.querySelector("video");
        gsap.set(frame, { clipPath: "inset(100% 0% 0% 0%)" });
        gsap.set(vid, { scale: 1.35 });
        gsap.timeline({ scrollTrigger: { trigger: frame, start: "top 90%" } })
          .to(frame, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.3, ease: "expo.out" })
          .to(vid,   { scale: 1.08, duration: 1.5, ease: "expo.out" }, 0);
        gsap.fromTo(vid, { yPercent: -4 }, {
          yPercent: 4, ease: "none",
          scrollTrigger: { trigger: frame, start: "top bottom", end: "bottom top", scrub: true }
        });
      });

      // — Index rows: staggered rise —
      gsap.from(".idx-row", {
        opacity: 0, y: 36, duration: 0.85, ease: "power3.out", stagger: 0.06,
        scrollTrigger: { trigger: "#idxList", start: "top 82%" }
      });

      // — About statement: word fade on scrub —
      const words = $$("[data-reveal-words] .word");
      if (words.length) {
        gsap.fromTo(words, { opacity: 0.14 }, {
          opacity: 1, duration: 0.6, ease: "none", stagger: 0.04,
          scrollTrigger: { trigger: "[data-reveal-words]", start: "top 80%", end: "bottom 62%", scrub: 0.6 }
        });
      }

      // — Stat count-up —
      $$("[data-count]").forEach((el) => {
        const end = +el.dataset.count;
        const pad = +(el.dataset.pad || 0);
        const o = { v: 0 };
        gsap.to(o, {
          v: end, duration: 1.7, ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 92%" },
          onUpdate: () => {
            const n = Math.round(o.v);
            el.firstChild.textContent = pad ? String(n).padStart(pad, "0") : String(n);
          }
        });
      });

      // — Hero video parallax —
      gsap.to(".hero__video", {
        yPercent: 18, ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
      });

      ScrollTrigger.refresh();
    } else {
      // fallback
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
      }, { threshold: 0.15 });
      $$("[data-reveal], [data-reveal-line]").forEach((el) => io.observe(el));
      $$("[data-reveal-words] .word").forEach((w) => (w.style.opacity = 1));
    }
  }

  /* ───────── Smooth scroll (Lenis) ───────── */
  function initLenis() {
    if (reduce || typeof Lenis === "undefined") {
      // native anchor scrolling fallback
      $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
        const t = $(a.getAttribute("href"));
        if (t) { e.preventDefault(); t.scrollIntoView({ behavior: "smooth" }); }
      }));
      return;
    }
    const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
    if (window.gsap && window.ScrollTrigger) {
      // single source of truth: drive lenis from the GSAP ticker only
      // velocity-reactive marquee
      const track = $(".marquee__track");
      let mq = null, mqTarget = 1, mqCur = 1;
      if (track && !reduce) {
        track.style.animation = "none";
        mq = gsap.to(track, { xPercent: -50, repeat: -1, duration: 26, ease: "none" });
      }
      lenis.on("scroll", (e) => {
        ScrollTrigger.update();
        if (mq) {
          const v = e.velocity || 0;
          mqTarget = (v < 0 ? -1 : 1) * (1 + Math.min(Math.abs(v) * 0.35, 6));
        }
      });
      if (mq) {
        gsap.ticker.add(() => {
          mqCur += (mqTarget - mqCur) * 0.08;   // ease toward target speed
          mqTarget += (1 - mqTarget) * 0.04;     // decay target back to idle
          mq.timeScale(mqCur);
        });
      }
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
    $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
      const sel = a.getAttribute("href");
      const t = sel === "#top" ? 0 : $(sel);
      if (t !== null) { e.preventDefault(); lenis.scrollTo(t, { offset: 0, duration: 1.4 }); }
    }));
  }

  /* ───────── Nav hide on scroll-down ───────── */
  function initNav() {
    const nav = $("#nav");
    let last = 0;
    addEventListener("scroll", () => {
      const y = scrollY;
      if (y > last && y > 200) nav.classList.add("nav--hidden");
      else nav.classList.remove("nav--hidden");
      last = y;
    }, { passive: true });
  }

  /* ───────── Index list hover preview ───────── */
  function initIndexPreview() {
    if (!hasPointer) return;
    const prev = $("#idxPreview");
    const img  = $("#idxPreviewImg");
    if (!prev) return;
    let tx = 0, ty = 0, px = 0, py = 0, raf;
    const loop = () => { px += (tx - px) * 0.14; py += (ty - py) * 0.14; prev.style.transform = `translate(${px}px, ${py}px) translate(-50%, -50%)`; raf = requestAnimationFrame(loop); };

    $$(".idx-row").forEach((row) => {
      row.addEventListener("mouseenter", () => {
        img.src = row.dataset.preview;
        prev.classList.add("idx-preview--on");
        if (!raf) loop();
      });
      row.addEventListener("mouseleave", () => prev.classList.remove("idx-preview--on"));
    });
    addEventListener("mousemove", (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
  }

  /* ───────── Magnetic elements ───────── */
  function initMagnetic() {
    if (!hasPointer || reduce || !window.gsap) return;
    $$("[data-magnetic]").forEach((el) => {
      const strength = parseFloat(el.dataset.magnetic) || 0.3;
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const mx = e.clientX - (r.left + r.width / 2);
        const my = e.clientY - (r.top + r.height / 2);
        gsap.to(el, { x: mx * strength, y: my * strength, duration: 0.6, ease: "power3.out" });
      });
      el.addEventListener("mouseleave", () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.4)" });
      });
    });
  }

  /* ───────── Boot ───────── */
  const start = () => {
    initCursor();
    initHoverVideos();
    initLenis();
    initNav();
    initIndexPreview();
    initMagnetic();
    document.documentElement.style.scrollBehavior = "auto";
    requestAnimationFrame(initReveals);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => runLoader(start));
  } else {
    runLoader(start);
  }
})();
