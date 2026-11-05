const keyFor = (auditId: string, url: string) => `aletheia.signin.${auditId}.${url}`;

/** Holds only the id, for the sign-out button during a check. The sign-in itself stays at TinyFish. */
export function rememberSignIn(auditId: string, url: string, signInId: string): void {
  try {
    sessionStorage.setItem(keyFor(auditId, url), signInId);
  } catch {
    // Without storage the check still runs; only the early sign-out button goes missing.
  }
}

export function recallSignIn(auditId: string, url: string): string | null {
  try {
    return sessionStorage.getItem(keyFor(auditId, url));
  } catch {
    return null;
  }
}
