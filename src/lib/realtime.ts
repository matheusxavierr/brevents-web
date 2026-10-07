export function websocketBaseUrl(configured?: string) {
  return (configured || "ws://127.0.0.1:8000/ws")
    .replace(/^https:/i, "wss:")
    .replace(/^http:/i, "ws:")
    .replace(/\/+$/, "");
}

export function realtimeReconnectDelay(attempt: number) {
  return Math.min(1_000 * (2 ** Math.max(0, attempt)), 15_000);
}

export function isFatalRealtimeClose(code: number) {
  // 4401 can mean only that the short-lived event token expired. Reconnect to
  // obtain a fresh one; the HTTP endpoint will report if the account expired.
  return code === 4403;
}
