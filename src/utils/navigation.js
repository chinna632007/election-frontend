export const routeListeners = new Set();

export function navigateTo(url) {
  if (!url) return;
  if (typeof window !== "undefined") {
    if (window.location.pathname !== url) {
      window.history.pushState(null, "", url);
    }
    routeListeners.forEach((fn) => fn(url));
    window.scrollTo(0, 0);
  }
}

if (typeof window !== "undefined") {
  window.navigateTo = navigateTo;
}

