type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

function capacitor(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as { Capacitor?: CapacitorGlobal }).Capacitor;
}

// The Android build carries its own capture services, so what is offered on iOS
// has to be told apart from the web rather than from native in general.
export function isIosApp(): boolean {
  const bridge = capacitor();
  if (bridge?.isNativePlatform?.() !== true) return false;
  return bridge.getPlatform?.() === "ios";
}
