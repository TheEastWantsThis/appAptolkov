export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCK_MINUTES = 15;

export function shouldLockLogin(failedAttempts: number): boolean {
  return failedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;
}

export function nextLoginUnlockTime(now = new Date()): Date {
  return new Date(now.getTime() + LOGIN_LOCK_MINUTES * 60 * 1000);
}
