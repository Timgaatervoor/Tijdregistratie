export interface HoldProgressState {
  progress: number;
  remainingSeconds: number;
  isCompleted: boolean;
}

export function calculateHoldProgress(elapsedMs: number, totalDurationSeconds: number): HoldProgressState {
  const totalMs = Math.max(100, totalDurationSeconds * 1000);
  const safeElapsed = Math.max(0, elapsedMs);
  const progress = Math.min(1, safeElapsed / totalMs);
  return {
    progress: Number(progress.toFixed(4)),
    remainingSeconds: Math.max(0, Math.ceil(Math.max(0, totalMs - safeElapsed) / 1000)),
    isCompleted: progress >= 1,
  };
}

export function validateTypeConfirmation(userInput: string, requiredKeyword = 'BEVESTIG'): boolean {
  if (!userInput || !requiredKeyword) return false;
  return userInput.trim().toUpperCase() === requiredKeyword.trim().toUpperCase();
}

export function isValidDoubleClick(firstClickTimestamp: number, secondClickTimestamp: number, maxWindowMs = 3500): boolean {
  const difference = secondClickTimestamp - firstClickTimestamp;
  return difference > 50 && difference <= maxWindowMs;
}

export function createActionGate() {
  let running = false;
  return {
    enter() { if (running) return false; running = true; return true; },
    leave() { running = false; },
    get running() { return running; },
  };
}
