/* ═══════════════════════════════════════════════════════════
   3D MACBOOK PRO 16" (M3, 2024) — glTF model, video-textured screen
   Three.js (global THREE, r128) + GLTFLoader (+ Draco) + RoomEnvironment.
   Model: assets/models/macbook-pro-16.glb (nodes: Base, HingePivot > Lid > Screen)

   The Maybach film (#mbVideo) is both the stage backdrop and the texture on the
   laptop screen. "Play film" flies the laptop to face the camera, takes the stage
   fullscreen and hands over to the film itself, with sound.
   ═══════════════════════════════════════════════════════════ */
(() => {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasPointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const MODEL_URL = "assets/models/macbook-pro-16.glb";

  function showFallback(canvas) {
    const v = document.createElement("video");
    Object.assign(v, { src: "assets/videos/maybach-music-video.mp4", autoplay: true, loop: true, muted: true, playsInline: true });
    v.className = "showcase__fallback";
    canvas.replaceWith(v);
  }

  function boot() {
    const canvas = document.getElementById("mbCanvas");
    const video  = document.getElementById("mbVideo");
    const stage  = document.getElementById("mbStage") || (canvas && canvas.parentElement);
    const playBtn = document.getElementById("mbPlay");
    const closeBtn = document.getElementById("mbClose");
    if (!canvas || !video || !stage || typeof THREE === "undefined" || typeof THREE.GLTFLoader === "undefined") {
      if (canvas) showFallback(canvas);
      return;
    }

    let W = stage.clientWidth, H = stage.clientHeight;

    /* ── Renderer ── */
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (err) {
      showFallback(canvas);            // no WebGL — plain video instead of a blank stage
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);
    if ("outputEncoding" in renderer) renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;

    /* ── Scene + camera ── */
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 100);
    const IDLE_LOOK = new THREE.Vector3(0, 0.0, 0);
    const idleCamPos = new THREE.Vector3();
    // close in so the laptop fills the stage; pull back on narrow (portrait) stages so the
    // whole laptop, sway included, stays in frame
    function frameCamera() {
      const z = Math.max(3.5, 5.9 / camera.aspect);
      idleCamPos.set(0, 0.72 * (z / 3.5), z);
    }
    frameCamera();
    camera.position.copy(idleCamPos);
    camera.lookAt(IDLE_LOOK);

    // soft studio reflections for the aluminium (metallic PBR needs an environment)
    if (typeof THREE.RoomEnvironment !== "undefined") {
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    }

    /* ── Lights ── */
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9c958a, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(3.5, 6, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xfff3e8, 0.35);
    fill.position.set(-5, 2, 3);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xdfe6ff, 0.5);
    rim.position.set(-1, 3, -5);
    scene.add(rim);

    /* ── Video texture for the display ── */
    const tex = new THREE.VideoTexture(video);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.flipY = false;                       // glTF UVs have their origin top-left
    if ("encoding" in tex) tex.encoding = THREE.sRGBEncoding;
    const screenMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    // Letterbox, never crop: anything the display shows outside the film's UV square is black.
    screenMat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `vec4 texelColor = texture2D( map, vUv );
         if ( vUv.x < 0.0 || vUv.x > 1.0 || vUv.y < 0.0 || vUv.y > 1.0 ) texelColor = vec4( 0.0, 0.0, 0.0, 1.0 );
         texelColor = mapTexelToLinear( texelColor );
         diffuseColor *= texelColor;`
      );
    };

    let SCREEN_ASPECT = 16 / 10;             // updated from the mesh once loaded
    function fitTexture() {
      const vw = video.videoWidth, vh = video.videoHeight;
      if (!vw || !vh) return;
      const videoAspect = vw / vh;
      // "contain": the film fills the display's width (or height) and the rest is black bars
      tex.center.set(0.5, 0.5);
      tex.offset.set(0, 0);
      if (videoAspect > SCREEN_ASPECT) tex.repeat.set(1, videoAspect / SCREEN_ASPECT);
      else tex.repeat.set(SCREEN_ASPECT / videoAspect, 1);
    }
    video.addEventListener("loadedmetadata", fitTexture);

    const playVideo = () => video.play().catch(() => {});
    video.addEventListener("canplay", playVideo);
    playVideo();

    /* ── Laptop rig ── */
    const laptop = new THREE.Group();
    scene.add(laptop);
    const RIG_Y = -0.62, RIG_SCALE = 0.78;      // framing inside the stage
    laptop.position.set(0, RIG_Y, 0);
    laptop.scale.setScalar(RIG_SCALE);
    laptop.rotation.x = -0.04;

    // lid: model ships open; we fold it shut and swing it open in view
    let hingePivot = null, screenMesh = null;
    const OPEN = 0;                 // model's own resting angle (≈110° open)
    let CLOSED = 1.86;              // computed from the lid's up-vector once loaded
    let CINEMA_LID = 0.35;          // lid straight up, facing the camera
    const LID_DUR = 1.6;
    const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
    const easeInOut = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    let wantOpen = true, lidStart = null, loaded = false;

    /* ── Cinema mode state ── */
    // idle → toCinema → cinema → toIdle → idle
    let mode = "idle", blendStart = null, k = 0;
    const CINEMA_DUR = 1.5;
    const cinema = { center: new THREE.Vector3(0, 0.35, 0), camPos: new THREE.Vector3(0, 0.35, 3) };

    function computeCinemaPose() {
      if (!hingePivot || !screenMesh) return;
      const keep = { ry: laptop.rotation.y, rx: laptop.rotation.x, py: laptop.position.y, lid: hingePivot.rotation.x };
      laptop.rotation.set(0, 0, 0); laptop.position.y = RIG_Y; hingePivot.rotation.x = CINEMA_LID;
      laptop.updateMatrixWorld(true);
      const sb = new THREE.Box3().setFromObject(screenMesh);
      sb.getCenter(cinema.center);
      const h = sb.max.y - sb.min.y, w = sb.max.x - sb.min.x;
      const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const dist = Math.max((h / 2) / t, (w / 2) / (t * camera.aspect)) * 1.02;
      cinema.camPos.set(cinema.center.x, cinema.center.y, cinema.center.z + dist);
      laptop.rotation.set(keep.rx, keep.ry, 0); laptop.position.y = keep.py; hingePivot.rotation.x = keep.lid;
    }

    const loader = new THREE.GLTFLoader();
    if (typeof THREE.DRACOLoader !== "undefined") {
      const draco = new THREE.DRACOLoader();
      draco.setDecoderPath("js/vendor/draco/");
      loader.setDRACOLoader(draco);
    }
    loader.load(MODEL_URL, (gltf) => {
      const model = gltf.scene;
      model.updateMatrixWorld(true);   // bake node transforms before measuring anything

      // recentre on the base footprint, feet on y = 0
      const base = model.getObjectByName("Base") || model;
      const bb = new THREE.Box3().setFromObject(base);
      const c = bb.getCenter(new THREE.Vector3());
      model.position.set(-c.x, -bb.min.y, -c.z);
      laptop.add(model);
      model.updateMatrixWorld(true);

      // materials: video on the display, PBR tidy-up elsewhere
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.frustumCulled = false;
        if (o.name === "Screen") {
          screenMesh = o;
          o.material = screenMat;
          const sb = new THREE.Box3().setFromObject(o);
          const size = sb.getSize(new THREE.Vector3());
          const h = Math.hypot(size.y, size.z);
          if (size.x && h) SCREEN_ASPECT = size.x / h;
          fitTexture();
          o.renderOrder = 2;
        } else if (o.name === "ScreenGlass") {
          o.material.polygonOffset = true; o.material.polygonOffsetFactor = 1; o.material.polygonOffsetUnits = 1;
        } else if (o.material && o.material.isMeshStandardMaterial) {
          o.material.envMapIntensity = 0.9;
        }
      });

      // hinge: re-parent the lid under our own pivot so rotation.x is a clean world-X swing
      const lid = model.getObjectByName("Lid");
      const pivotNode = model.getObjectByName("HingePivot");
      if (lid && pivotNode) {
        const p = pivotNode.getWorldPosition(new THREE.Vector3());
        hingePivot = new THREE.Group();
        laptop.worldToLocal(p);
        hingePivot.position.copy(p);
        laptop.add(hingePivot);
        hingePivot.attach(lid);

        // closed angle: swing the lid's in-plane "up" vector down onto the base (+z)
        const sb = new THREE.Box3().setFromObject(screenMesh || lid);
        const hi = new THREE.Vector3(0, sb.max.y, sb.min.z), lo = new THREE.Vector3(0, sb.min.y, sb.max.z);
        laptop.worldToLocal(hi); laptop.worldToLocal(lo);
        const up = hi.sub(lo);
        const openAngle = Math.atan2(up.y, up.z);   // angle of the lid from the base plane
        CLOSED = openAngle - 0.02;
        CINEMA_LID = openAngle - Math.PI / 2;        // vertical, square to the camera
        hingePivot.rotation.x = reduce ? OPEN : CLOSED;
      }
      laptop.updateMatrixWorld(true);
      computeCinemaPose();
      loaded = true;
      if (reduce) renderer.render(scene, camera);
    }, undefined, (err) => { console.error("MacBook model failed to load", err); showFallback(canvas); });

    /* ── Interaction state ── */
    let pointerX = 0, pointerY = 0, tX = 0, tY = 0;
    if (hasPointer && !reduce) {
      window.addEventListener("mousemove", (e) => {
        tX = (e.clientX / window.innerWidth) * 2 - 1;
        tY = (e.clientY / window.innerHeight) * 2 - 1;
      }, { passive: true });
    }
    const texts = [...stage.querySelectorAll(".showcase__text")].map((el) => ({ el, d: parseFloat(el.dataset.parallax) || 1.5 }));

    /* ── Cinema mode ── */
    const setCinema = (on) => window.dispatchEvent(new CustomEvent("cinema", { detail: on }));

    function enterCinema() {
      if (!loaded || mode !== "idle") return;
      mode = "toCinema"; blendStart = null;
      stage.classList.add("is-cinema");
      document.documentElement.classList.add("cinema-lock");
      setCinema(true);
      if (stage.requestFullscreen) stage.requestFullscreen().catch(() => {});
      video.muted = false;
      try { video.currentTime = 0; } catch (e) {}
      video.play().catch(() => {});
      resize();
    }
    function exitCinema() {
      if (mode === "idle" || mode === "toIdle") return;
      mode = "toIdle"; blendStart = null;
      stage.classList.remove("is-cinema-video");
      video.controls = false;
      video.muted = true;
      if (document.fullscreenElement === stage && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
    function finishExit() {
      stage.classList.remove("is-cinema");
      document.documentElement.classList.remove("cinema-lock");
      setCinema(false);
      resize();
    }
    if (playBtn) playBtn.addEventListener("click", enterCinema);
    canvas.addEventListener("click", enterCinema);
    if (closeBtn) closeBtn.addEventListener("click", exitCinema);
    window.addEventListener("keydown", (e) => { if (e.key === "Escape") exitCinema(); });
    document.addEventListener("fullscreenchange", () => {
      if (!document.fullscreenElement && (mode === "cinema" || mode === "toCinema")) exitCinema();
      resize();
    });

    /* ── Resize ── */
    function resize() {
      W = stage.clientWidth; H = stage.clientHeight;
      if (!W || !H) return;
      camera.aspect = W / H; camera.updateProjectionMatrix();
      frameCamera();
      if (loaded) computeCinemaPose();
      renderer.setSize(W, H, false);
    }
    window.addEventListener("resize", resize);
    if ("ResizeObserver" in window) new ResizeObserver(() => resize()).observe(stage);

    /* ── Run only while in view ── */
    let running = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((ents) => {
        ents.forEach((e) => {
          if (mode !== "idle") return;           // never interrupt the film in cinema mode
          running = e.isIntersecting;
          if (running) { playVideo(); start(); } else { video.pause(); }
        });
      }, { threshold: 0.05 }).observe(document.getElementById("showcase"));
    }

    /* ── Render loop ── */
    let raf = null;
    const idleLook = new THREE.Vector3(), look = new THREE.Vector3();
    function frame(t) {
      if (!running && mode === "idle") { raf = null; return; }
      const time = t * 0.001;
      pointerX += (tX - pointerX) * 0.05;
      pointerY += (tY - pointerY) * 0.05;

      // lid opening (runs once, the first time the model is on screen)
      let idleLid = OPEN;
      if (loaded && hingePivot && wantOpen) {
        if (lidStart === null) lidStart = time + 0.25;
        const p = Math.min(1, Math.max(0, (time - lidStart) / LID_DUR));
        idleLid = CLOSED + (OPEN - CLOSED) * easeOutCubic(p);
        if (p >= 1) wantOpen = false;
      }

      // cinema blend: 0 = idle pose, 1 = screen square to the camera
      if (mode === "toCinema" || mode === "toIdle") {
        if (blendStart === null) blendStart = time;
        const p = Math.min(1, (time - blendStart) / CINEMA_DUR);
        k = mode === "toCinema" ? easeInOut(p) : 1 - easeInOut(p);
        if (p >= 1) {
          if (mode === "toCinema") { mode = "cinema"; stage.classList.add("is-cinema-video"); video.controls = true; }
          else { mode = "idle"; finishExit(); }
        }
      } else k = mode === "cinema" ? 1 : 0;

      // the film backdrop reacts to the cursor (parallax — background moves opposite)
      if (k === 0) {
        video.style.transform = `scale(1.35) translate3d(${(-pointerX * 1.6).toFixed(2)}%, ${(-pointerY * 1.1).toFixed(2)}%, 0)`;
      } else if (video.style.transform) video.style.transform = "";
      // floating scene text reacts to the cursor (foreground parallax — moves with it)
      for (let i = 0; i < texts.length; i++) {
        texts[i].el.style.transform =
          `translate3d(${(pointerX * texts[i].d * 8).toFixed(1)}px, ${(pointerY * texts[i].d * 6).toFixed(1)}px, 0)`;
      }

      // idle: gentle float + auto sway + pointer parallax; cinema: dead straight, screen to camera
      const swayY = Math.sin(time * 0.32) * 0.28 + pointerX * 0.45;
      const swayX = -0.04 + Math.sin(time * 0.45) * 0.015 + pointerY * 0.12;
      const bob = RIG_Y + Math.sin(time * 0.7) * 0.045;
      laptop.rotation.y = swayY * (1 - k);
      laptop.rotation.x = swayX * (1 - k);
      laptop.position.y = bob + (RIG_Y - bob) * k;
      if (hingePivot) hingePivot.rotation.x = idleLid + (CINEMA_LID - idleLid) * k;

      camera.position.lerpVectors(idleCamPos, cinema.camPos, k);
      look.lerpVectors(idleLook.copy(IDLE_LOOK), cinema.center, k);
      camera.lookAt(look);

      // Force the video frame onto the GPU every render (VideoTexture auto-update is
      // unreliable for a video composited behind the canvas).
      if (video.readyState >= video.HAVE_CURRENT_DATA) tex.needsUpdate = true;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf) raf = requestAnimationFrame(frame); }

    if (reduce) { renderer.render(scene, camera); } else { start(); }
    // cinema mode must animate even if the stage was scrolled out of view
    window.addEventListener("cinema", (e) => { if (e.detail) { running = true; start(); } });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else { boot(); }
})();
