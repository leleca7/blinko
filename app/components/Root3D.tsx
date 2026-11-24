"use client";

import { useEffect, useRef, useState } from "react";
import EarthCutaway from "./EarthCutaway";
import styles from "../immersive-home.module.css";

/**
 * Adaptação restrita das RAÍZES 3D do HTML fornecido:
 * TubeGeometry / CatmullRomCurve3, ramificação e revelação na rolagem.
 * Todo o restante do HTML (papéis, grama, planta, cards) foi excluído.
 */
export default function Root3D() {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches || window.matchMedia("(max-width: 760px)").matches) return;

    let cancelled = false;
    let clean = () => {};
    let frame = 0;

    const load = async () => {
      try {
        const T = await import("three");
        if (cancelled) return;
        const renderer = new T.WebGLRenderer({
          canvas, alpha: true, antialias: true, powerPreference: "low-power",
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
        renderer.setClearColor(0x000000, 0);

        const scene = new T.Scene();
        const camera = new T.PerspectiveCamera(40, 1, 0.1, 80);
        scene.add(new T.HemisphereLight(0xfff5dc, 0x4c352e, 1.7));
        const light = new T.DirectionalLight(0xffe8cc, 1.55);
        light.position.set(-5, 6, 10);
        scene.add(light);

        const wood = new T.MeshStandardMaterial({
          color: 0xcfae80, roughness: 0.88, metalness: 0,
          side: T.FrontSide,
        });
        const roots: Array<{
          mesh: InstanceType<typeof T.Mesh>;
          tubularSegments: number;
          start: number;
          duration: number;
        }> = [];
        let seed = 11;
        const rnd = () => {
          seed = (seed * 16807) % 2147483647;
          return seed / 2147483647;
        };

        const branch = (
          x: number, y: number, direction: number,
          length: number, radius: number, generation: number,
        ) => {
          const points: InstanceType<typeof T.Vector3>[] = [];
          let cx = x, cy = y, angle = direction;
          const steps = Math.max(5, Math.round(length * 2.2));
          for (let i = 0; i <= steps; i++) {
            points.push(new T.Vector3(cx, cy, 0.8));
            angle += (rnd() - 0.5) * 0.55;
            angle *= 0.93;
            cx += Math.sin(angle) * length / steps;
            cy -= Math.cos(angle) * length / steps;
          }
          const tubularSegments = steps * 8;
          const geometry = new T.TubeGeometry(
            new T.CatmullRomCurve3(points), tubularSegments,
            radius, 5, false,
          );
          const mesh = new T.Mesh(geometry, wood);
          scene.add(mesh);
          roots.push({
            mesh, tubularSegments,
            start: Math.max(0, -y / 11),
            duration: generation ? 0.22 : 1,
          });

          if (generation < 3) {
            const count = generation ? 2 : 11;
            for (let i = 0; i < count; i++) {
              const pt = points[Math.floor(2 + rnd() * (steps - 3))];
              branch(
                pt.x, pt.y,
                (rnd() < 0.5 ? -1 : 1) * (0.7 + rnd() * 0.7),
                length * (generation ? 0.42 : 0.32) + rnd(),
                radius * 0.55, generation + 1,
              );
            }
          }
        };
        branch(0, -0.1, 0, 11, 0.055, 0);

        const story = box.closest("section");
        let targetX = 0, targetY = 0;
        let currentProgress = 0;
        let visible = true;
        let running = false;

        const pointer = (event: PointerEvent) => {
          if (event.pointerType === "touch") return;
          targetX = event.clientX / window.innerWidth - 0.5;
          targetY = event.clientY / window.innerHeight - 0.5;
        };
        const resize = () => {
          const width = Math.max(1, box.clientWidth);
          const height = Math.max(1, box.clientHeight);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        const render = () => {
          if (!visible || cancelled) { running = false; return; }
          const progressText = story
            ? getComputedStyle(story).getPropertyValue("--story-progress")
            : "0";
          const target = Math.min(1, Math.max(0, Number(progressText) || 0));
          currentProgress += (target - currentProgress) * 0.09;

          // Mesmo movimento vertical do HTML original: começamos perto
          // do tronco e descemos junto com as raízes. Distância ajustada
          // à coluna mais estreita da home (o HTML era tela cheia).
          const focusY = 0.15 - 9.35 * currentProgress;
          const z = 8.8 / Math.min(1, Math.max(camera.aspect * 1.1, 0.57));
          camera.position.set(targetX * 0.5, focusY - targetY * 0.3, z);
          camera.lookAt(targetX * 0.2, focusY, 0);

          for (const root of roots) {
            const fraction = Math.min(1, Math.max(0,
              (currentProgress * 1.12 - root.start) / root.duration));
            root.mesh.visible = fraction > 0.001;
            root.mesh.geometry.setDrawRange(
              0, Math.floor(fraction * root.tubularSegments) * 30,
            );
          }
          renderer.render(scene, camera);
          frame = window.requestAnimationFrame(render);
        };
        const start = () => {
          if (!running && !cancelled) {
            visible = true;
            running = true;
            frame = window.requestAnimationFrame(render);
          }
        };
        const observer = new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          if (visible) start();
        }, { rootMargin: "100px" });
        observer.observe(box);
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(box);
        window.addEventListener("pointermove", pointer, { passive: true });
        resize();
        start();
        setReady(true);

        const contextLost = (event: Event) => {
          event.preventDefault();
          setReady(false); // SVG de reserva permanece disponível.
          visible = false;
        };
        canvas.addEventListener("webglcontextlost", contextLost);

        clean = () => {
          window.cancelAnimationFrame(frame);
          observer.disconnect();
          resizeObserver.disconnect();
          window.removeEventListener("pointermove", pointer);
          canvas.removeEventListener("webglcontextlost", contextLost);
          for (const root of roots) root.mesh.geometry.dispose();
          wood.dispose();
          renderer.dispose();
        };
      } catch {
        if (!cancelled) setReady(false);
      }
    };
    void load();
    return () => { cancelled = true; clean(); };
  }, []);

  return (
    <div ref={boxRef} className={styles.root3DContainer} aria-hidden="true">
      <div className={ready ? styles.root3DFallbackHidden : styles.root3DFallback}>
        <EarthCutaway />
      </div>
      <canvas ref={canvasRef} className={ready ? styles.root3DCanvasReady : styles.root3DCanvas} />
    </div>
  );
}
