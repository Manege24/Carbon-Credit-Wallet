type Listener = () => void;
let listener: Listener | null = null;

export function onSessionExpired(fn: Listener) {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

export function notifySessionExpired() {
  listener?.();
}