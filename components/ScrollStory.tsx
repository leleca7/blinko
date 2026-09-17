"use client";

import { useEffect, useRef } from "react";
import styles from "./scroll-story.module.css";

export default function ScrollStory() {
  const storyRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const story = storyRef.current;
    if (!story) return;

    let frame = 0;

    const update = () => {
      frame = 0;

      const rect = story.getBoundingClientRect();
      const viewport = window.innerHeight;
      const travel = Math.max(story.offsetHeight - viewport, 1);
      const progress = Math.min(1, Math.max(0, -rect.top / travel));
      const scene = progress < 1 / 3 ? "surface" : progress < 2 / 3 ? "layers" : "root";
      const state = rect.top > 0 ? "before" : rect.bottom <= viewport ? "after" : "active";

      story.style.setProperty("--story-progress", String(progress));
      if (story.dataset.scene !== scene) story.dataset.scene = scene;
      if (story.dataset.state !== state) story.dataset.state = state;
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    update();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <section ref={storyRef} className={styles.story} aria-label="Do sinal até a prioridade">
      <div className={styles.stage}>
        <div className={styles.scenes}>
          <article className={`${styles.scene} ${styles.scene1}`}>
            <span>SINAL</span>
            <h3>Algo na empresa pede atenção.</h3>
            <p>O primeiro relato mostra onde o incômodo aparece — mas ainda não explica, sozinho, por que ele existe.</p>
          </article>

          <article className={`${styles.scene} ${styles.scene2}`}>
            <span>HIPÓTESES</span>
            <h3>O problema pode atravessar várias áreas.</h3>
            <p>Marca, atendimento, operação, gestão e tecnologia entram na leitura antes de qualquer solução ser escolhida.</p>
          </article>

          <article className={`${styles.scene} ${styles.scene3}`}>
            <span>VALIDAÇÃO</span>
            <h3>A evidência mostra o que precisa mudar primeiro.</h3>
            <p>Quando uma causa se sustenta, ela vira prioridade. A intervenção passa a ter motivo, ordem e direção.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
