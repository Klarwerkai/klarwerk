/**
 * JOB 3367: vor dem App-Code installiert, ohne Import im Browser ausführbar.
 * Beobachtet native Ereignisse und die sichtbare Guard-Folge. Ein preventDefault allein
 * beweist KEINE Sperre: auch der normale GuardedLink verhindert die Browsernavigation.
 * Interne React-Refs bleiben unbekannt. Es wird weder bestätigt noch navigiert.
 */
export function installiereNavDiagnose(): () => void {
  let aktiv = true;
  let nummer = 0;
  const abbau: (() => void)[] = [];
  // Keine Texte, Cookie-/Storage-Werte, Querys oder history.state.usr im Protokoll.
  const pfad = (url: string | URL): string => {
    try {
      return new URL(url, window.location.href).pathname;
    } catch {
      return "(ungültige URL)";
    }
  };
  const lage = () => ({
    pfad: window.location.pathname,
    index: typeof window.history.state?.idx === "number" ? window.history.state.idx : null,
    hinweis: document.querySelector('[data-testid="notice-banner"]') !== null,
    guardDialog: document.querySelector("[data-navguard-dialog]") !== null,
    kopfbandInert:
      document.querySelector("header")?.closest("[inert]") !== null &&
      document.querySelector("header") !== null,
    seiten: Array.from(document.querySelectorAll('[data-testid^="page-"]')).map((el) =>
      el.getAttribute("data-testid"),
    ),
  });
  const log = (art: string, detail: Record<string, unknown> = {}) => {
    if (aktiv)
      console.debug(
        "KW-NAV-DIAG",
        JSON.stringify({
          nummer: ++nummer,
          zeit: performance.timeOrigin + performance.now(),
          art,
          ...lage(),
          ...detail,
        }),
      );
  };
  // Bündeldatei + Zeile/Spalte bleiben zuordenbar, URL-Parameter werden entfernt.
  const stack = () =>
    (new Error().stack ?? "").replace(/https?:\/\/[^\s)]+/g, (url) =>
      url.replace(/[?#][^:\s)]*/g, ""),
    );
  const ziel = (event: Event) => {
    const el = event.target instanceof Element ? event.target : null;
    const link = el?.closest("a[href]");
    return {
      tag: el?.tagName ?? null,
      ziel: link ? pfad(link.getAttribute("href") ?? "") : null,
      punkt: link?.getAttribute("data-kopfband-punkt") ?? null,
      inert: el?.closest("[inert]") !== null && el !== null,
    };
  };
  const click = (event: MouseEvent) => {
    const detail = {
      ...ziel(event),
      x: event.clientX,
      y: event.clientY,
      taste: event.button,
      modifiziert: event.altKey || event.ctrlKey || event.metaKey || event.shiftKey,
    };
    log("click-capture", detail);
    // Nächste Aufgabe, auch bei stopImmediatePropagation. Eine Microtask kann bei einem
    // nativen Klick schon ZWISCHEN zwei Listenern laufen und wäre als Endstand falsch.
    // Kein Bereitschaftswarten der Sonde: nur der Zeitpunkt dieses Diagnoseeintrags.
    setTimeout(() => log("click-end", { ...detail, verhindert: event.defaultPrevented }), 0);
  };
  window.addEventListener("click", click, true);
  abbau.push(() => window.removeEventListener("click", click, true));

  for (const name of ["preventDefault", "stopPropagation", "stopImmediatePropagation"] as const) {
    const original = Event.prototype[name];
    Event.prototype[name] = function () {
      original.call(this);
      if (this.type === "click" || this.type === "popstate") {
        log(name, { ereignis: this.type, ...ziel(this), stack: stack() });
      }
    };
    abbau.push(() => {
      Event.prototype[name] = original;
    });
  }
  for (const name of ["pushState", "replaceState"] as const) {
    const original = window.history[name];
    window.history[name] = function (...args: Parameters<History[typeof name]>) {
      log(`${name}-call`, { ziel: args[2] == null ? null : pfad(args[2]), stack: stack() });
      try {
        const result = original.apply(this, args);
        log(`${name}-return`);
        return result;
      } catch (error) {
        log(`${name}-throw`, {
          fehler:
            error !== null && typeof error === "object" && "name" in error
              ? String(error.name)
              : "unbekannt",
        });
        throw error;
      }
    };
    abbau.push(() => {
      window.history[name] = original;
    });
  }
  const go = window.history.go;
  window.history.go = function (delta?: number) {
    log("go", { delta: delta ?? 0, stack: stack() });
    return go.call(this, delta);
  };
  abbau.push(() => {
    window.history.go = go;
  });
  const pop = () => log("popstate");
  window.addEventListener("popstate", pop, true);
  abbau.push(() => window.removeEventListener("popstate", pop, true));

  let zuletzt = "";
  const dom = () => {
    const jetzt = JSON.stringify(lage());
    if (jetzt !== zuletzt) {
      zuletzt = jetzt;
      log("dom");
    }
  };
  const observer = new MutationObserver(dom);
  observer.observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["inert", "data-testid", "data-navguard-dialog"],
  });
  dom();
  return () => {
    aktiv = false;
    observer.disconnect();
    for (const stop of abbau.reverse()) stop();
  };
}
