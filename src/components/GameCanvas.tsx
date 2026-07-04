"use client";

import { useEffect, useRef } from "react";
import { createGame } from "@/game/createGame";
import styles from "./GameCanvas.module.css";

export default function GameCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const canvas = document.createElement("canvas");
    host.appendChild(canvas);
    const cleanup = createGame(canvas);

    return () => {
      cleanup();
      host.removeChild(canvas);
    };
  }, []);

  return <div ref={hostRef} className={styles.canvasHost} />;
}
