/* ═══════════════════════════════════════════════════════════
   3D WHITE MACBOOK — procedural model, video-textured screen
   Three.js (global THREE, r128). Self-contained, no model file.
   ═══════════════════════════════════════════════════════════ */
(() => {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasPointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  function boot() {
    const canvas = document.getElementById("mbCanvas");
    const video  = document.getElementById("mbVideo");
    if (!canvas || !video || typeof THREE === "undefined") {
      // graceful fallback — show the plain video in the stage
      if (canvas) {
        const v = document.createElement("video");
        Object.assign(v, { src: "assets/videos/maybach-music-video.mp4", autoplay: true, loop: true, muted: true, playsInline: true });
        v.className = "showcase__fallback";
        canvas.replaceWith(v);
      }
      return;
    }

    const stage = canvas.parentElement;
    let W = stage.clientWidth, H = stage.clientHeight;

    /* ── Renderer ── */
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);
    if ("outputEncoding" in renderer) renderer.outputEncoding = THREE.sRGBEncoding;

    /* ── Scene + camera ── */
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 100);
    camera.position.set(0, 0.95, 5.0);
    camera.lookAt(0, 0.35, 0);

    /* ── Lights (matte white aluminium read) ── */
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9c958a, 0.95));
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(3.5, 6, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xfff3e8, 0.45);
    fill.position.set(-5, 2, 3);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xdfe6ff, 0.6);
    rim.position.set(-1, 3, -5);
    scene.add(rim);

    /* ── Materials ── */
    const alu = new THREE.MeshStandardMaterial({ color: 0xf3f1ec, metalness: 0.35, roughness: 0.42 });
    const aluDark = new THREE.MeshStandardMaterial({ color: 0xeae7e0, metalness: 0.4, roughness: 0.5 });
    const black = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, metalness: 0.2, roughness: 0.6 });

    /* ── Rounded slab helper (rounded rect → extruded) ── */
    function roundedSlab(w, d, thick, radius, material) {
      const s = new THREE.Shape();
      const x = -w / 2, y = -d / 2, r = radius;
      s.moveTo(x + r, y);
      s.lineTo(x + w - r, y);
      s.quadraticCurveTo(x + w, y, x + w, y + r);
      s.lineTo(x + w, y + d - r);
      s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
      s.lineTo(x + r, y + d);
      s.quadraticCurveTo(x, y + d, x, y + d - r);
      s.lineTo(x, y + r);
      s.quadraticCurveTo(x, y, x + r, y);
      const geo = new THREE.ExtrudeGeometry(s, {
        depth: thick, bevelEnabled: true,
        bevelThickness: thick * 0.28, bevelSize: thick * 0.28, bevelSegments: 3, curveSegments: 12
      });
      geo.center();
      return new THREE.Mesh(geo, material);
    }

    /* ── Laptop group ── */
    const laptop = new THREE.Group();
    scene.add(laptop);

    const BASE_W = 3.15, BASE_D = 2.15, BASE_T = 0.13;
    const LID_W = 3.15, LID_H = 2.02, LID_T = 0.08;

    // base (lies flat in XZ)
    const base = roundedSlab(BASE_W, BASE_D, BASE_T, 0.12, alu);
    base.rotation.x = -Math.PI / 2;
    base.position.y = BASE_T / 2;
    laptop.add(base);

    // keyboard well + trackpad hints (subtle, just for read)
    const well = new THREE.Mesh(
      new THREE.PlaneGeometry(BASE_W * 0.82, BASE_D * 0.55),
      aluDark
    );
    well.rotation.x = -Math.PI / 2;
    well.position.set(0, BASE_T + 0.001, BASE_D * 0.12);
    laptop.add(well);
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(BASE_W * 0.32, BASE_D * 0.26),
      aluDark
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, BASE_T + 0.002, BASE_D * 0.30);
    laptop.add(pad);

    // lid pivot at the rear hinge
    const hinge = new THREE.Group();
    hinge.position.set(0, BASE_T, -BASE_D / 2);
    laptop.add(hinge);

    const lid = roundedSlab(LID_W, LID_H, LID_T, 0.10, alu);
    lid.position.set(0, LID_H / 2, 0);
    hinge.add(lid);

    // black screen bezel + glass
    const bezel = new THREE.Mesh(new THREE.PlaneGeometry(LID_W * 0.90, LID_H * 0.90), black);
    bezel.position.set(0, LID_H / 2, LID_T / 2 + 0.05);
    hinge.add(bezel);

    // video screen
    const tex = new THREE.VideoTexture(video);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    if ("encoding" in tex) tex.encoding = THREE.sRGBEncoding;
    const screenMat = new THREE.MeshBasicMaterial({ map: tex });

    const SCREEN_W = LID_W * 0.93, SCREEN_H = LID_H * 0.93;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H), screenMat);
    screen.position.set(0, LID_H / 2, LID_T / 2 + 0.052);
    hinge.add(screen);

    // apple-ish hinge bar
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, LID_W * 0.96, 16), aluDark);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 0.03, 0);
    hinge.add(bar);

    // open the lid (lean back from vertical)
    const OPEN = -0.30; // radians back-tilt
    hinge.rotation.x = OPEN;

    // recentre the whole assembly in view
    laptop.position.set(0, -0.55, 0.2);
    laptop.rotation.x = -0.04;

    /* ── Cover-fit the video onto the screen plane ── */
    function fitTexture() {
      const vw = video.videoWidth, vh = video.videoHeight;
      if (!vw || !vh) return;
      const planeAspect = SCREEN_W / SCREEN_H;
      const videoAspect = vw / vh;
      tex.center.set(0.5, 0.5);
      if (videoAspect > planeAspect) {
        tex.repeat.set(planeAspect / videoAspect, 1);
      } else {
        tex.repeat.set(1, videoAspect / planeAspect);
      }
      tex.offset.set((1 - tex.repeat.x) / 2, (1 - tex.repeat.y) / 2);
    }
    video.addEventListener("loadedmetadata", fitTexture);
    if (video.videoWidth) fitTexture();

    const playVideo = () => video.play().catch(() => {});
    video.addEventListener("canplay", playVideo);
    playVideo();

    /* ── Interaction state ── */
    let pointerX = 0, pointerY = 0, tX = 0, tY = 0;
    if (hasPointer && !reduce) {
      window.addEventListener("mousemove", (e) => {
        tX = (e.clientX / window.innerWidth) * 2 - 1;
        tY = (e.clientY / window.innerHeight) * 2 - 1;
      }, { passive: true });
    }

    /* ── Resize ── */
    function resize() {
      W = stage.clientWidth; H = stage.clientHeight;
      camera.aspect = W / H; camera.updateProjectionMatrix();
      renderer.setSize(W, H, false);
    }
    window.addEventListener("resize", resize);

    /* ── Run only while in view ── */
    let running = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((ents) => {
        ents.forEach((e) => {
          running = e.isIntersecting;
          if (running) { playVideo(); start(); } else { video.pause(); }
        });
      }, { threshold: 0.05 }).observe(document.getElementById("showcase"));
    }

    /* ── Render loop ── */
    let raf = null, t0 = 0;
    function frame(t) {
      if (!running) { raf = null; return; }
      const time = t * 0.001;
      pointerX += (tX - pointerX) * 0.05;
      pointerY += (tY - pointerY) * 0.05;

      // gentle float + auto sway + pointer parallax (never a full spin, screen stays toward camera)
      laptop.rotation.y = Math.sin(time * 0.32) * 0.28 + pointerX * 0.45;
      laptop.rotation.x = -0.04 + Math.sin(time * 0.45) * 0.015 + pointerY * 0.12;
      laptop.position.y = -0.55 + Math.sin(time * 0.7) * 0.045;

      // Force the video frame onto the GPU every render. VideoTexture's auto-update
      // (via requestVideoFrameCallback) doesn't fire reliably for a video composited
      // behind the canvas, which left the screen blank white.
      if (video.readyState >= video.HAVE_CURRENT_DATA) tex.needsUpdate = true;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf) raf = requestAnimationFrame(frame); }

    if (reduce) { renderer.render(scene, camera); } else { start(); }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else { boot(); }
})();
