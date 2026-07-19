"use client";

import { useEffect, useRef, useState } from "react";

const GOLD = "#d4b98c";
const IVORY = "#f2efe7";
const MIST = "#8f9ab0";

/**
 * The Atlas Moment — the home itself, held in your hands.
 * A Higgsfield-generated 3D lift of the hero home, slowly orbiting inside
 * the night. Drag to turn it. Three points of memory glow on its surface —
 * the details HomeAtlas never forgets. If the mesh cannot load, the scene
 * falls back to the cinematic still with the same memory points.
 *
 * three.js is imported dynamically inside the effect so the library only
 * downloads when this section actually mounts.
 */

const MEMORIES = [
  { key: "gate", label: "The gate code", detail: "Noted once. Never asked again." },
  { key: "west", label: "The west windows", detail: "Hard water tracked, treated each visit." },
  { key: "screen", label: "The spring screen", detail: "Promised in autumn. Delivered in spring." },
] as const;

export function AtlasMoment({ glbUrl, fallbackSrc }: { glbUrl: string | null; fallbackSrc: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"loading" | "mesh" | "fallback">("loading");
  const [activeMemory, setActiveMemory] = useState<(typeof MEMORIES)[number]["key"] | null>(null);

  useEffect(() => {
    if (!glbUrl) {
      setMode("fallback");
      return;
    }
    const mount = mountRef.current;
    if (!mount) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      try {
        const THREE = await import("three");
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        if (disposed) return;

        const width = mount.clientWidth;
        const height = mount.clientHeight;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
        camera.position.set(0, 0.42, 2.55);
        camera.lookAt(0, -0.04, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(width, height);
        mount.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight(0x8f9ab0, 0.7));
        const warm = new THREE.DirectionalLight(0xffd9a0, 2.2);
        warm.position.set(2, 3, 4);
        scene.add(warm);
        const cool = new THREE.DirectionalLight(0x6a7ba8, 0.8);
        cool.position.set(-3, 1, -2);
        scene.add(cool);

        const gltf = await new GLTFLoader().loadAsync(glbUrl);
        if (disposed) { renderer.dispose(); return; }

        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const scale = 2.5 / Math.max(size.x, size.y, size.z);
        model.scale.setScalar(scale);
        model.position.sub(center.multiplyScalar(scale));
        const pivot = new THREE.Group();
        pivot.add(model);
        scene.add(pivot);

        let targetRotY = 0.35;
        let rotY = 0.35;
        let dragging = false;
        let lastX = 0;

        const onPointerDown = (e: PointerEvent) => { dragging = true; lastX = e.clientX; };
        const onPointerMove = (e: PointerEvent) => {
          if (!dragging) return;
          targetRotY += (e.clientX - lastX) * 0.005;
          lastX = e.clientX;
        };
        const onPointerUp = () => { dragging = false; };
        renderer.domElement.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);

        let raf = 0;
        const tick = () => {
          if (!dragging && !reduced) targetRotY += 0.0016;
          rotY += (targetRotY - rotY) * 0.06;
          pivot.rotation.y = rotY;
          renderer.render(scene, camera);
          raf = requestAnimationFrame(tick);
        };
        if (reduced) {
          pivot.rotation.y = rotY;
          renderer.render(scene, camera);
        } else {
          raf = requestAnimationFrame(tick);
        }

        const onResize = () => {
          const w = mount.clientWidth;
          const h = mount.clientHeight;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
          if (reduced) renderer.render(scene, camera);
        };
        window.addEventListener("resize", onResize);

        setMode("mesh");
        cleanup = () => {
          cancelAnimationFrame(raf);
          window.removeEventListener("resize", onResize);
          renderer.domElement.removeEventListener("pointerdown", onPointerDown);
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", onPointerUp);
          renderer.dispose();
          mount.removeChild(renderer.domElement);
        };
      } catch {
        if (!disposed) setMode("fallback");
      }
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [glbUrl]);

  return (
    <section aria-label="Your home's Atlas" className="relative z-10 px-5 py-28 sm:px-12 sm:py-36">
      <div className="text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: GOLD }}>
          Property Memory
        </p>
        <h2 className="mt-4 font-serif text-4xl font-light leading-[0.98] sm:text-6xl" style={{ color: IVORY }}>
          Your home, held
          <br />
          <em className="night-shimmer-text">in living memory.</em>
        </h2>
      </div>

      <div className="relative mx-auto mt-14 max-w-4xl">
        <div
          className="relative overflow-hidden rounded-[2rem] border"
          style={{ borderColor: "rgba(242,239,231,0.12)", background: "radial-gradient(ellipse 70% 60% at 50% 40%, rgba(143,154,176,0.09), rgba(7,8,12,0))" }}
        >
          <div ref={mountRef} className="aspect-[16/10] w-full touch-pan-y" style={{ cursor: mode === "mesh" ? "grab" : "default" }}>
            {mode !== "mesh" ? (
              <img
                src={fallbackSrc}
                alt="The hero home at twilight — the house HomeAtlas remembers"
                className="h-full w-full object-cover"
                style={{ opacity: mode === "loading" ? 0.35 : 1, transition: "opacity 0.8s" }}
                draggable={false}
              />
            ) : null}
          </div>
          {mode === "mesh" ? (
            <p className="pointer-events-none absolute bottom-4 left-0 right-0 text-center font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: `${MIST}99` }}>
              Drag to turn the home
            </p>
          ) : null}
        </div>

        <ul className="mt-8 grid gap-4 sm:grid-cols-3">
          {MEMORIES.map((m) => (
            <li key={m.key}>
              <button
                type="button"
                onClick={() => setActiveMemory(activeMemory === m.key ? null : m.key)}
                aria-expanded={activeMemory === m.key}
                className="w-full rounded-xl border px-4 py-4 text-left transition-colors duration-300"
                style={{
                  borderColor: activeMemory === m.key ? "rgba(212,185,140,0.6)" : "rgba(242,239,231,0.12)",
                  background: activeMemory === m.key ? "rgba(212,185,140,0.07)" : "transparent",
                }}
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: GOLD, boxShadow: "0 0 10px 2px rgba(212,185,140,0.5)" }}
                  />
                  <span className="font-serif text-lg font-light" style={{ color: IVORY }}>{m.label}</span>
                </span>
                <span
                  className="mt-2 block overflow-hidden text-sm leading-relaxed transition-all duration-500"
                  style={{ color: MIST, maxHeight: activeMemory === m.key ? 80 : 0, opacity: activeMemory === m.key ? 1 : 0 }}
                >
                  {m.detail}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <p className="mx-auto mt-8 max-w-xl text-center text-sm leading-relaxed" style={{ color: MIST }}>
          Three small things, remembered forever. HomeAtlas keeps a thousand
          more — every photo, every observation, every promise, for as long
          as your home is in the family.
        </p>
      </div>
    </section>
  );
}
