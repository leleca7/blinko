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
        scene.add(new T.HemisphereLight(0xfff5dc, 0x4c352e, 1.25));
        const light = new T.DirectionalLight(0xffe8cc, 2.0);
        light.position.set(-5, 6, 10);
        scene.add(light);

        const wood = new T.MeshStandardMaterial({
          color: 0xc3a17b, roughness: 0.96, metalness: 0,
          side: T.FrontSide,
        });
        const roots: Array<{
          mesh: InstanceType<typeof T.Mesh>;
          material: InstanceType<typeof T.MeshStandardMaterial>;
          start: number;
          duration: number;
        }> = [];
        let seed = 11;
        const rnd = () => {
          seed = (seed * 16807) % 2147483647;
          return seed / 2147483647;
        };

        // Root geometry: a tapered taproot and alternating lateral branches.
        // The reference algorithm remains procedural, but branches now have
        // natural tips, varying thickness and a balanced, compact silhouette.
        const branch = (
          x: number, y: number, direction: number,
          length: number, radius: number, generation: number, depth = 0.8,
        ) => {
          const points: InstanceType<typeof T.Vector3>[] = [];
          let cx = x, cy = y, angle = direction;
          const steps = Math.max(8, Math.round(length * 5));
          const phase = rnd() * Math.PI * 2;
          const side = direction < 0 ? -1 : 1;
          for (let i = 0; i <= steps; i++) {
            const u = i / steps;
            points.push(new T.Vector3(cx, cy, depth + Math.sin(u * Math.PI) * (generation ? 0.32 : 0.13) * side));
            const desired = generation === 0 ? Math.sin(u * 6 + phase) * 0.16 : direction * (1 - u * 0.55);
            angle += (desired - angle) * 0.19 + (rnd() - 0.5) * (generation === 0 ? 0.11 : 0.25);
            cx += Math.sin(angle) * length / steps;
            cy -= Math.cos(angle) * length / steps;
          }
          const tubularSegments = Math.max(24, steps * 3);
          const radialSegments = generation === 0 ? 9 : 6;
          const curve = new T.CatmullRomCurve3(points);
          const geometry = new T.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
          const pos = geometry.attributes.position;
          const center = new T.Vector3();
          for (let ring = 0; ring <= tubularSegments; ring++) {
            const u = ring / tubularSegments;
            curve.getPointAt(u, center);
            const taper = Math.max(0.018, Math.pow(1 - u, generation === 0 ? 0.85 : 1.15));
            for (let j = 0; j <= radialSegments; j++) {
              const k = ring * (radialSegments + 1) + j;
              pos.setXYZ(k, center.x + (pos.getX(k)-center.x)*taper,
                center.y + (pos.getY(k)-center.y)*taper,
                center.z + (pos.getZ(k)-center.z)*taper);
            }
          }
          pos.needsUpdate = true;
          geometry.computeVertexNormals();
          geometry.computeBoundingBox();
          const material = wood.clone();
          material.transparent = true;
          material.opacity = 0.001;
          const mesh = new T.Mesh(geometry, material);
          scene.add(mesh);
          roots.push({ mesh, material, start: generation === 0 ? 0 : Math.max(0, -y / 10 - 0.10), duration: generation ? 0.36 : 0.48 });
          if (generation < 3) {
            const count = generation === 0 ? 9 : generation === 1 ? 4 : 2;
            for (let i = 0; i < count; i++) {
              const u = 0.14 + i / count * 0.72 + rnd() * 0.055;
              const pt = curve.getPointAt(u);
              const lateral = generation === 0 ? (i % 2 === 0 ? -1 : 1) : (i % 2 === 0 ? side : -side);
              const childLength = generation === 0 ? (2.8 * (1 - u * .55) + rnd() * .6) : length * (.32 + rnd() * .16);
              branch(pt.x, pt.y, lateral * (.78 + rnd() * .50), childLength,
                radius * Math.pow(1-u, .85) * (generation === 0 ? .48 : .52), generation + 1, pt.z);
            }
          }
        };
        branch(0, -0.1, 0, 8.5, 0.105, 0);

        // A superfície revela primeiro uma pequena planta; a mesma
        // câmera depois desce pelas raízes, sem recipiente ou moldura.
        const plant = new T.Group();
        const foliage = new T.MeshStandardMaterial({ color: 0x789b63, roughness: 0.68, side: T.DoubleSide });
        const stemMaterial = new T.MeshStandardMaterial({ color: 0x526c40, roughness: 0.9 });
        const stemGeometry = new T.TubeGeometry(new T.CatmullRomCurve3([
          new T.Vector3(0,-0.1,0.8),new T.Vector3(-0.07,0.7,0.8),new T.Vector3(0.10,1.55,0.76)
        ]), 24, 0.045, 6, false);
        plant.add(new T.Mesh(stemGeometry, stemMaterial));
        const leafShape = new T.Shape();
        leafShape.moveTo(0,0);
        leafShape.bezierCurveTo(0.18,0.62,0.82,0.90,1.35,0.68);
        leafShape.bezierCurveTo(1.14,0.04,0.58,-0.22,0,0);
        const leafGeometry = new T.ShapeGeometry(leafShape, 16);
        for (const [x,y,turn,scale] of [[-0.04,0.48,2.7,0.78],[0.01,0.85,-0.12,0.94],[0.07,1.28,2.05,0.7]]) {
          const leaf = new T.Mesh(leafGeometry, foliage);
          leaf.position.set(x,y,0.8); leaf.rotation.set(0.18,turn > 1 ? -0.2 : 0.23,turn);
          leaf.scale.setScalar(scale); plant.add(leaf);
        }
        scene.add(plant);

        // Fit the complete plant/root silhouette to the actual canvas bounds.
        // No branch can be clipped by a camera push-in, even on a narrow desktop.
        scene.updateMatrixWorld(true);
        const bounds = new T.Box3();
        for (const root of roots) bounds.expandByObject(root.mesh);
        bounds.expandByObject(plant);
        const center = bounds.getCenter(new T.Vector3());
        const size = bounds.getSize(new T.Vector3());
        const halfFov = T.MathUtils.degToRad(camera.fov / 2);
        const story = box.closest("section");
        let targetX = 0, targetY = 0;
        let currentProgress = 0;
        let contextAvailable = true;
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
          if (!visible || cancelled || !contextAvailable) { running = false; return; }
          const progressText = story
            ? getComputedStyle(story).getPropertyValue("--story-progress")
            : "0";
          const target = Math.min(1, Math.max(0, Number(progressText) || 0));
          currentProgress += (target - currentProgress) * 0.09;

          // Keep a gentle vertical descent while retaining the entire root
          // silhouette. Camera fitting accounts for both canvas dimensions.
          const focusY = center.y + (0.5 - currentProgress) * 0.9;
          const focusX = center.x + targetX * 0.15;
          const vertical = size.y / 2 + Math.abs(focusY - center.y) + 0.5;
          const horizontal = size.x / 2 + Math.abs(focusX - center.x) + 0.45;
          const fit = Math.max(vertical / Math.tan(halfFov), horizontal / (Math.tan(halfFov) * camera.aspect));
          const z = bounds.max.z + fit * (1.10 - currentProgress * .025);
          camera.position.set(focusX, focusY - targetY * 0.10, z);
          camera.lookAt(focusX, focusY, center.z);

          // Fade in whole tapered branches instead of exposing cut tube ends.
          for (const root of roots) {
            const fraction = Math.min(1, Math.max(0, (currentProgress * 1.12 + .12 - root.start) / root.duration));
            const eased = fraction * fraction * (3 - 2 * fraction);
            root.mesh.visible = eased > 0.002;
            root.material.opacity = eased;
            root.material.depthWrite = eased > .95;
          }
          renderer.render(scene, camera);
          frame = window.requestAnimationFrame(render);
        };
        const start = () => {
          if (!running && !cancelled && contextAvailable) {
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
          contextAvailable = false;
        };
        canvas.addEventListener("webglcontextlost", contextLost);

        clean = () => {
          window.cancelAnimationFrame(frame);
          observer.disconnect();
          resizeObserver.disconnect();
          window.removeEventListener("pointermove", pointer);
          canvas.removeEventListener("webglcontextlost", contextLost);
          for (const root of roots) { root.mesh.geometry.dispose(); root.material.dispose(); }
          wood.dispose();
          stemGeometry.dispose(); leafGeometry.dispose(); foliage.dispose(); stemMaterial.dispose();
          renderer.dispose();
        };
      } catch {
        if (!cancelled) setReady(false);
      }
    };
    const loader = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { loader.disconnect(); void load(); }
    }, { rootMargin: "250px" });
    loader.observe(box);
    return () => { cancelled = true; loader.disconnect(); clean(); };
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
