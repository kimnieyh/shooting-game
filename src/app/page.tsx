import GameCanvas from "@/components/GameCanvas";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <div className={styles.frame}>
        <GameCanvas />
      </div>
    </div>
  );
}
