// AUFTRAG-mega13 Block A: der ZURÜCK-Wächter — Kern ohne React, damit er einzeln prüfbar ist.
//
// Wir erfinden hier nichts. React Router macht für seinen Data-Router-Blocker genau diese Mechanik;
// wir haben sie nachgelesen und bauen sie in unserem (BrowserRouter-)Aufbau nach. Fundstellen in
// `apps/web/node_modules/@remix-run/router/dist/router.js`:
//
//   :264/:341/:348  Jeder Eintrag trägt `history.state.idx` — ein vom Router gestempelter Index.
//   :334-343        Fehlt der Index beim Start, wird er als 0 nachgestempelt ⇒ belastbar ab Eintrag 1.
//   :367            push:    `index = getIndex() + 1`   (neuer Eintrag ⇒ Index + 1, monoton)
//   :397            replace: `index = getIndex()`       (kein neuer Eintrag ⇒ derselbe Index)
//   :353            handlePop: `delta = nextIndex - index` — das EXAKTE Delta, nicht pauschal 1.
//   :1579           Warnung: POP auf einen Eintrag ohne Index scheitert sonst STILL.
//   :1590           Sperre: `init.history.go(delta * -1)` stellt die Adresszeile wieder her.
//   :1605           Weitergehen: ERST wenn die Wiederherstellung durch ist, `go(delta)` — genau einmal.
//   :3023           „A router only supports one blocker at a time" — es gibt genau EINE Autorität.
//
// Zwei Dinge machen wir bewusst ANDERS als der Router — beide, weil wir außerhalb seines Blocker-
// Pfades sitzen und dadurch sogar mehr können:
//
//  (1) Wir unterdrücken den POP für den Router (`stopImmediatePropagation`), statt ihn erst wirken zu
//      lassen und dann zurückzurollen. Grund: rollt man zurück, ist die schmutzige Seite in der
//      Zwischenzeit AUSGEHÄNGT — ihr React-Zustand ist weg, und der Wächter hätte den Verlust selbst
//      verursacht. Damit das trägt, muss unser Listener VOR dem des Routers hängen; darum wird er beim
//      MODUL-LADEN registriert (siehe `installPopGuardListener`), denn der Router registriert seinen
//      erst in einem Layout-Effekt (`react-router-dom/dist/index.js:634` → `history.listen`,
//      `router.js:433`). Modulauswertung liegt immer vor dem ersten Render.
//  (2) Der Dialog erscheint ERST, wenn die Adresszeile wieder auf dem UI-Ort steht (Kante 10). Beim
//      Router läuft die Wiederherstellung parallel zum bereits sichtbaren Blocker-Zustand.

/** Der Ort, auf den ein POP gezeigt hat. */
export interface PopTarget {
  pathname: string;
  search: string;
  hash: string;
}

/**
 * Alles, was der Kern von seiner Umgebung braucht. Die React-Seite (NavGuardContext) füllt es;
 * Tests füllen es mit einer Attrappe und können damit jede Kante ohne Browser durchfahren.
 */
export interface PopGuardHost {
  /** Index des Eintrags, auf dem die UI steht (vor dem POP) — `null`, wenn ungestempelt. */
  anchorIndex: () => number | null;
  /** Index des Eintrags, auf dem der Browser JETZT steht (nach dem POP). */
  currentIndex: () => number | null;
  /** Ort, auf dem der Browser JETZT steht. */
  currentTarget: () => PopTarget;
  /** Liegt etwas vor, das dieser Wechsel verlieren würde? */
  shouldBlock: (target: PopTarget) => boolean;
  /** `window.history.go` — die EINZIGE Stelle, an der der Wächter die History bewegt. */
  go: (delta: number) => void;
  /**
   * Dialog zeigen. Liefert `false`, wenn schon ein Wächter-Dialog offen ist — dann gibt es genau
   * EINEN Dialog (Kante 3) und der POP wird nur aufgefangen, nicht zusätzlich gefragt.
   */
  showDialog: (target: PopTarget) => boolean;
  /** Dialog schließen. */
  hideDialog: () => void;
}

/** Was mit dem POP-Ereignis geschehen soll: an den Router weitergeben oder verschlucken. */
export type PopDisposition = "pass" | "swallow";

type Phase =
  | { kind: "idle" }
  | {
      kind: "held";
      /** Index des UI-Orts, auf den wir zurückstellen. */
      anchor: number;
      /** Das ursprüngliche, exakte Delta des blockierten POP (negativ = zurück). */
      delta: number;
      target: PopTarget;
      /** Adresszeile wieder auf dem Anker? Vorher wird nichts abgespielt (Kante 5/10). */
      settled: boolean;
      /** „Verwerfen"/„Speichern" wurde geklickt, während noch zurückgestellt wurde. */
      proceedQueued: boolean;
      /** Der Dialog wurde für DIESEN POP schon geöffnet (kein Stapeln). */
      dialogShown: boolean;
    }
  /** Unser eigenes `go(delta)` läuft — der nächste POP gehört dem Router. */
  | { kind: "replaying" };

export interface PopGuard {
  /** Ein POP ist eingetroffen. Entscheidet, ob der Router ihn sehen darf. */
  handlePop: () => PopDisposition;
  /** „Hier bleiben": nichts weiter tun — wir stehen bereits auf dem Anker. */
  stay: () => void;
  /** „Verwerfen" bzw. erfolgreiches „Speichern": das ursprüngliche Delta genau einmal abspielen. */
  proceed: () => void;
  /** Die Seite/der Provider verschwindet: jede Zuständigkeit fallen lassen. */
  reset: () => void;
  /** Nur für Tests/Belege: der innere Zustand als Wort. */
  phase: () => Phase["kind"];
  /** Nur für Tests/Belege: steht die Adresszeile wieder auf dem Anker? */
  isSettled: () => boolean;
}

export function createPopGuard(host: PopGuardHost): PopGuard {
  let phase: Phase = { kind: "idle" };

  // Die Wiederherstellung ist ein FIXPUNKT, kein Rechenwerk: bei jedem POP, den wir besitzen, wird
  // erneut auf den Anker gezielt. Damit sind schnelle Doppel-/Mehrfach-Klicks auf Zurück ohne
  // Buchhaltung erledigt — jeder weitere POP läuft in dieselbe Korrektur (Kante 3).
  const steerToAnchor = (held: Extract<Phase, { kind: "held" }>): PopDisposition => {
    const current = host.currentIndex();
    // Kante 9, fail-closed: ohne belastbaren Index gibt es kein belastbares Delta. Dann wird NICHT
    // geraten (ein geratener Sprung landet irgendwo) — wir verschlucken den POP und bleiben stehen.
    // Es geht nichts verloren; nur „Zurück" ist bis zur nächsten App-Navigation wirkungslos.
    if (current === null) {
      held.settled = false;
      return "swallow";
    }
    if (current !== held.anchor) {
      held.settled = false;
      host.go(held.anchor - current);
      return "swallow";
    }
    // Angekommen. Ab hier — und erst ab hier — stimmt die Adresszeile wieder (Kante 10).
    held.settled = true;
    if (held.proceedQueued) {
      replay(held);
      return "swallow";
    }
    if (!held.dialogShown) {
      if (!host.showDialog(held.target)) {
        // Es ist bereits ein Wächter-Dialog offen. Er stellt dieselbe Frage; eine zweite Frage wäre
        // ein Dialogstapel. Der POP ist aufgefangen (Adresszeile steht wieder), seine Absicht wird
        // verworfen — die Antwort des Nutzers gilt der bereits laufenden Navigation.
        phase = { kind: "idle" };
        return "swallow";
      }
      held.dialogShown = true;
    }
    return "swallow";
  };

  const replay = (held: Extract<Phase, { kind: "held" }>): void => {
    const { delta } = held;
    // Zuerst umschalten, DANN springen: der ausgelöste POP findet „replaying" vor und geht an den
    // Router. Ein zweiter Klick findet kein „held" mehr — genau einmal (Kante 5).
    phase = { kind: "replaying" };
    host.hideDialog();
    host.go(delta);
  };

  return {
    handlePop(): PopDisposition {
      if (phase.kind === "replaying") {
        phase = { kind: "idle" };
        return "pass";
      }
      if (phase.kind === "held") {
        return steerToAnchor(phase);
      }

      const anchor = host.anchorIndex();
      const current = host.currentIndex();
      const target = host.currentTarget();
      if (anchor === null || current === null) {
        // Kante 9, fail-closed. Ohne Index kein Delta: nicht springen. Ist etwas zu verlieren, wird
        // der POP verschluckt (die Seite bleibt samt Inhalt stehen); ist nichts zu verlieren, macht
        // der Router seine normale Arbeit.
        return host.shouldBlock(target) ? "swallow" : "pass";
      }
      const delta = current - anchor;
      // Derselbe Eintrag (z. B. ein POP, den der Router schon selbst ausgeglichen hat): nichts zu tun.
      if (delta === 0) {
        return "pass";
      }
      if (!host.shouldBlock(target)) {
        return "pass";
      }
      const held: Extract<Phase, { kind: "held" }> = {
        kind: "held",
        anchor,
        delta,
        target,
        settled: false,
        proceedQueued: false,
        dialogShown: false,
      };
      phase = held;
      // Exaktes Gegen-Delta (Kante 2) — `router.js:1590` macht denselben Griff.
      host.go(-delta);
      return "swallow";
    },

    stay(): void {
      if (phase.kind !== "held") {
        return;
      }
      // Es wurde nur mit `go()` gearbeitet: kein pushState, also KEIN zusätzlicher Verlaufseintrag,
      // und die Vorwärts-Einträge stehen unberührt (Kante 4).
      phase = { kind: "idle" };
      host.hideDialog();
    },

    proceed(): void {
      if (phase.kind !== "held") {
        return;
      }
      if (!phase.settled) {
        // Kante 5: erst die Restauration abwarten. Der Klick wird gemerkt, nicht verworfen.
        phase.proceedQueued = true;
        return;
      }
      replay(phase);
    },

    reset(): void {
      phase = { kind: "idle" };
    },

    phase: () => phase.kind,
    isSettled: () => phase.kind === "held" && phase.settled,
  };
}

// ── Die EINE Registrierung am Fenster ─────────────────────────────────────────────────────────────
//
// Beim Modul-Laden, nicht im Effekt: nur so hängt unser Listener VOR dem des Routers und kann den
// blockierten POP per `stopImmediatePropagation` von ihm fernhalten (Begründung oben, Punkt 1).
// Der Listener selbst tut nichts, solange keine Autorität angemeldet ist.

// Absichtlich OHNE DOM-Typen: `tools/build` prüft dieses Modul mit dem Wurzel-tsc (ohne `lib.dom`),
// die App selbst mit ihrem eigenen Build. Ein strukturelles Minimum ist hier ohnehin die ehrlichere
// Beschreibung — der Wächter braucht vom Fenster genau zwei Dinge.
interface PopEventLike {
  stopImmediatePropagation: () => void;
}
interface WindowLike {
  history: { state: unknown };
  addEventListener: (type: string, listener: (event: PopEventLike) => void) => void;
}

function ambientWindow(): WindowLike | undefined {
  return (globalThis as { window?: WindowLike }).window;
}

type PopAuthority = () => PopDisposition;

let authority: PopAuthority | null = null;

function dispatchPop(event: PopEventLike): void {
  if (!authority) {
    return;
  }
  if (authority() === "swallow") {
    // Hält den POP vom Router (und allen später registrierten Listenern) fern.
    event.stopImmediatePropagation();
  }
}

let listenerInstalled = false;

/**
 * Wird beim Import ausgeführt. Idempotent, damit ein zweiter Import (Testläufe) nicht doppelt hängt.
 */
export function installPopGuardListener(win: WindowLike | undefined = ambientWindow()): void {
  if (listenerInstalled || !win) {
    return;
  }
  listenerInstalled = true;
  win.addEventListener("popstate", dispatchPop);
}

/**
 * Genau EINE Autorität — der Zustand ist ein einzelnes Feld, es KANN keine zwei Wächter geben.
 * Doppelte Anmeldung wird gemeldet und der neueste gilt; genau so hält es der Router mit seinem
 * Blocker (`router.js:3023`: Warnung, und `entries[entries.length - 1]` gewinnt).
 */
export function setPopAuthority(next: PopAuthority): void {
  if (authority !== null && authority !== next) {
    console.warn(
      "NavGuard: zwei Zurück-Wächter angemeldet (zwei NavGuardProvider im Baum?) — der neueste gilt.",
    );
  }
  authority = next;
}

/**
 * Abmelden IDENTITÄTSGEBUNDEN: ein Provider, der spät aufräumt, darf einen inzwischen angemeldeten
 * Nachfolger nicht abräumen (Kante 7 — kein abgemeldeter Wächter, der die Folgeseite lähmt).
 */
export function releasePopAuthority(prev: PopAuthority): void {
  if (authority === prev) {
    authority = null;
  }
}

/** Nur für Tests: die Anmeldung hart räumen (z. B. nach einem abgebrochenen Lauf). */
export function clearPopAuthorityForTests(): void {
  authority = null;
}

/** Der vom Router gestempelte Index des aktuellen Eintrags (`router.js:348`). */
export function readHistoryIndex(win: WindowLike | undefined = ambientWindow()): number | null {
  const state = win?.history.state as { idx?: unknown } | null | undefined;
  const idx = state?.idx;
  return typeof idx === "number" ? idx : null;
}

installPopGuardListener();
