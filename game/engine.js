// ゲームループ（requestAnimationFrame ベース）

export function createLoop({ update, render }) {
  let rafId = null;
  let lastTime = null;
  let speedMultiplier = 1;
  let running = false;

  function frame(now) {
    if (!running) return;
    if (lastTime === null) lastTime = now;
    let dt = now - lastTime;
    lastTime = now;
    dt = Math.min(dt, 100); // タブが非アクティブだった場合の大ジャンプを防止
    update(dt * speedMultiplier);
    render();
    rafId = requestAnimationFrame(frame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      lastTime = null;
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
    },
    setSpeed(mult) {
      speedMultiplier = mult;
    },
    getSpeed() {
      return speedMultiplier;
    },
    isRunning() {
      return running;
    },
  };
}
