import type { CSSProperties } from "react";
import styles from "../immersive-home.module.css";

/**
 * Raízes isoladas da demonstração "Blinko — raiz em 3D.html".
 * Reutiliza o algoritmo de ramificação, curvas e semente determinística
 * fornecidos no HTML, sem as camadas de papel, planta, fotos ou cartões.
 * SVG responsivo: não depende de CDN/WebGL e respeita movimento reduzido.
 */
type Point = { x: number; y: number };
type Root = { d: string; width: number; generation: number; id: number };

function createRoots(): { roots: Root[]; viewBox: string } {
  let seed = 25;
  let index = 0;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  const roots: Root[] = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const toScreen = (point: Point) => ({
    x: 380 + point.x * 61,
    y: 58 - point.y * 52,
  });
  const smoothPath = (points: Point[]) => {
    const coords = points.map(toScreen);
    for (const point of coords) { minX = Math.min(minX,point.x); minY = Math.min(minY,point.y); maxX = Math.max(maxX,point.x); maxY = Math.max(maxY,point.y); }
    let data = "M " + coords[0].x.toFixed(2) + " " + coords[0].y.toFixed(2);
    for (let i = 1; i < coords.length; i++) {
      const point = coords[i];
      const next = coords[i + 1];
      if (next) {
        const mx = (point.x + next.x) / 2;
        const my = (point.y + next.y) / 2;
        data += " Q " + point.x.toFixed(2) + " " + point.y.toFixed(2) + " " + mx.toFixed(2) + " " + my.toFixed(2);
      } else {
        data += " L " + point.x.toFixed(2) + " " + point.y.toFixed(2);
      }
    }
    return data;
  };

  function branch(x: number, y: number, direction: number, length: number, radius: number, generation: number) {
    const points: Point[] = [];
    let cx = x, cy = y, angle = direction;
    const steps = Math.max(5, Math.round(length * 2.2));

    for (let i = 0; i <= steps; i++) {
      points.push({ x: cx, y: cy });
      angle += (random() - 0.5) * 0.55;
      angle *= 0.93;
      cx += Math.sin(angle) * length / steps;
      cy -= Math.cos(angle) * length / steps;
    }

    roots.push({
      d: smoothPath(points),
      width: Math.max(1.1, 13 * radius / 0.055),
      generation,
      id: index++,
    });

    if (generation < 3) {
      const number = generation === 0 ? 11 : 2;
      for (let i = 0; i < number; i++) {
        const at = Math.floor(2 + random() * (steps - 3));
        const point = points[at];
        // Alternância nos ramos principais para equilibrar a composição.
        const side = generation === 0 ? (i % 2 === 0 ? -1 : 1) : (random() < 0.5 ? -1 : 1);
        branch(point.x, point.y,
          side * (0.7 + random() * 0.7),
          length * (generation ? 0.42 : 0.32) + random(),
          radius * 0.55, generation + 1);
      }
    }
  }
  branch(0, -0.1, 0, 11, 0.055, 0);
  const margin = 45;
  return { roots, viewBox: [minX-margin,minY-margin,maxX-minX+2*margin,maxY-minY+2*margin].join(" ") };
}

const { roots: ROOTS, viewBox } = createRoots();
const REVEAL_BASE = [0.38, 0.94, 1.08, 1.21];

export default function EarthCutaway() {
  return (
    <div className={styles.rootSculpture} aria-hidden="true">
      <svg className={styles.rootSculptureSvg} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="blinko-root-wood" x1="0" y1="0" x2=".8" y2="1">
            <stop offset="0" stopColor="#fff1ce" />
            <stop offset=".38" stopColor="#e8c89e" />
            <stop offset=".72" stopColor="#bd9673" />
            <stop offset="1" stopColor="#8d654f" />
          </linearGradient>
          <linearGradient id="blinko-root-shine" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff5df" />
            <stop offset="1" stopColor="#b38a69" />
          </linearGradient>
          <filter id="blinko-root-shadow" x="-25%" y="-20%" width="160%" height="150%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>

        {ROOTS.map(root => {
          const reveal = {
            "--root-reveal-base": REVEAL_BASE[root.generation],
          } as CSSProperties;
          return (
            <g key={root.id} className={styles.rootStrokeGroup} style={reveal}>
              <path className={styles.rootRevealedPath} d={root.d} fill="none" stroke="#231a14"
                strokeWidth={root.width + 5} opacity=".28"
                strokeLinecap="round" strokeLinejoin="round" pathLength={1}
                filter="url(#blinko-root-shadow)" />
              <path className={styles.rootRevealedPath} d={root.d}
                fill="none" stroke="url(#blinko-root-wood)" strokeWidth={root.width}
                strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
              {root.generation <= 1 && (
                <path className={styles.rootRevealedPath} d={root.d}
                  fill="none" stroke="url(#blinko-root-shine)"
                  strokeOpacity=".46" strokeWidth={Math.max(1.3, root.width * .22)}
                  strokeLinecap="round" pathLength={1} />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
