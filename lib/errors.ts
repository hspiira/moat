/**
 * Turn an unknown thrown value into a user-facing message. Prefers the Error's
 * own message when it reads like a sentence, else the provided fallback — so we
 * never surface `[object Object]` or an empty string to the user.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}
