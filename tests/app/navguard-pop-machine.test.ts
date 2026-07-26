// AUFTRAG-mega13 Block A: der Kern des Zurück-Wächters an bens Abnahmekanten — OHNE React und ohne
// Browser, damit jede Kante einzeln und deterministisch belegbar ist. Die gemounteten Belege
// (navguard-pop-mounted.test.tsx) fahren danach denselben Kern durch den echten Router, die
// Playwright-Sonde durch einen echten Browser.
//
// Die Attrappe hier ist ein VOLLSTÄNDIGER History-Stapel mit Indizes: `go(delta)` verschiebt den
// Zeiger und liefert — wie der Browser — ein ASYNCHRONES popstate-Ereignis. Genau daran entscheidet
// sich Kante 3/5: würde man synchron zurückstellen, gäbe es die Rennen gar nicht, die wir prüfen.
import { beforeEach, describe, expect, it } from "vitest";
import { type PopGuardHost, createPopGuard } from "../../apps/web/src/app/navHistory";

interface Entry {
  path: string;
  /** `null` = ein Eintrag, den nicht der Router gestempelt hat (Kante 9). */
  idx: number | null;
}

/** Ein History-Stapel mit Zeiger + Aufgabenschlange, so wie der Browser es tut. */
class FakeHistory {
  entries: Entry[];
  pointer: number;
  queue: Array<() => void> = [];
  goCalls: number[] = [];

  constructor(entries: Entry[], pointer: number) {
    this.entries = entries;
    this.pointer = pointer;
  }

  go(delta: number): void {
    this.goCalls.push(delta);
    const next = this.pointer + delta;
    if (next < 0 || next >= this.entries.length) {
      return; // Wie der Browser: außerhalb des Stapels passiert nichts.
    }
    this.pointer = next;
    // Der Ortswechsel ist SOFORT sichtbar, das Ereignis kommt SPÄTER — genau wie im Browser.
    this.queue.push(() => this.onPop());
  }

  /** Nutzer drückt Zurück/Vorwärts: identisch zu go(), nur von außen. */
  user(delta: number): void {
    const next = this.pointer + delta;
    if (next < 0 || next >= this.entries.length) {
      return;
    }
    this.pointer = next;
    this.queue.push(() => this.onPop());
  }

  current(): Entry {
    const entry = this.entries[this.pointer];
    if (!entry) {
      throw new Error("Zeiger außerhalb des Stapels");
    }
    return entry;
  }

  /** Alle anstehenden Ereignisse abarbeiten (auch die, die dabei neu entstehen). */
  flush(limit = 50): void {
    let steps = 0;
    while (this.queue.length > 0) {
      if (++steps > limit) {
        throw new Error("popstate-Schlange läuft nicht leer (Endlosschleife im Wächter?)");
      }
      const next = this.queue.shift();
      next?.();
    }
  }

  onPop: () => void = () => {};
}

interface Rig {
  history: FakeHistory;
  guard: ReturnType<typeof createPopGuard>;
  dialogs: number;
  dialogOpen: boolean;
  /** Was der Router zu sehen bekam: die Orte, an denen ein POP DURCHgelassen wurde. */
  routerSaw: string[];
  dirty: boolean;
  otherDialogOpen: boolean;
}

function makeRig(paths: string[], startAt: number, dirty = true): Rig {
  const history = new FakeHistory(
    paths.map((path, i) => ({ path, idx: i })),
    startAt,
  );
  const rig: Rig = {
    history,
    dialogs: 0,
    dialogOpen: false,
    routerSaw: [],
    dirty,
    otherDialogOpen: false,
    guard: undefined as unknown as ReturnType<typeof createPopGuard>,
  };
  // Der Anker: der Ort, auf dem die UI steht. Er bleibt stehen, solange kein POP durchgelassen wurde.
  let anchor = { index: history.current().idx, pathname: history.current().path };

  const host: PopGuardHost = {
    anchorIndex: () => anchor.index,
    currentIndex: () => history.current().idx,
    currentTarget: () => ({ pathname: history.current().path, search: "", hash: "" }),
    shouldBlock: (target) => rig.dirty && target.pathname !== anchor.pathname,
    go: (delta) => history.go(delta),
    showDialog: () => {
      if (rig.dialogOpen || rig.otherDialogOpen) {
        return false;
      }
      rig.dialogOpen = true;
      rig.dialogs += 1;
      return true;
    },
    hideDialog: () => {
      rig.dialogOpen = false;
    },
  };
  rig.guard = createPopGuard(host);
  history.onPop = () => {
    if (rig.guard.handlePop() === "pass") {
      // Der Router würde jetzt navigieren — und damit den Anker mitziehen.
      rig.routerSaw.push(history.current().path);
      anchor = { index: history.current().idx, pathname: history.current().path };
    }
  };
  return rig;
}

describe("Zurück-Wächter — Kern", () => {
  let rig: Rig;

  beforeEach(() => {
    // /start → /bibliothek → /erfassen (die UI steht auf /erfassen, Index 2)
    rig = makeRig(["/start", "/bibliothek", "/erfassen"], 2);
  });

  // ── Kante 2 ──────────────────────────────────────────────────────────────────────────────────────
  describe("Kante 2: exaktes Delta bei Ein- UND Mehrschritt-POP", () => {
    it("Einschritt-Zurück wird mit go(+1) zurückgestellt, nicht pauschal", () => {
      rig.history.user(-1);
      rig.history.flush();
      expect(rig.history.goCalls).toEqual([1]);
      expect(rig.history.current().path).toBe("/erfassen");
      expect(rig.routerSaw).toEqual([]);
      expect(rig.dialogs).toBe(1);
    });

    it("Mehrschritt-Zurück (2 Einträge auf einmal) wird mit dem EXAKTEN Delta go(+2) zurückgestellt", () => {
      // Genau der Fall, den ein pauschales go(1) still falsch machen würde: der Nutzer landet
      // sonst auf /bibliothek statt auf /erfassen.
      rig.history.user(-2);
      rig.history.flush();
      expect(rig.history.goCalls).toEqual([2]);
      expect(rig.history.current().path).toBe("/erfassen");
      expect(rig.routerSaw).toEqual([]);
    });

    it("das abgespielte Delta ist ebenfalls das exakte (Mehrschritt bleibt Mehrschritt)", () => {
      rig.history.user(-2);
      rig.history.flush();
      rig.guard.proceed();
      rig.history.flush();
      // go(+2) zum Zurückstellen, dann go(-2) zum Abspielen — kein anderer Sprung.
      expect(rig.history.goCalls).toEqual([2, -2]);
      expect(rig.history.current().path).toBe("/start");
      expect(rig.routerSaw).toEqual(["/start"]);
    });
  });

  // ── Kante 3 ──────────────────────────────────────────────────────────────────────────────────────
  describe("Kante 3: genau eine Navigation, genau ein Dialog, kein Rennen", () => {
    it("schnelles Doppel-Zurück (zwei POPs vor der Zurückstellung) stapelt keine Dialoge", () => {
      // Beide Zurück-Klicks landen in der Schlange, BEVOR der Wächter zum Zurückstellen kommt.
      rig.history.user(-1);
      rig.history.user(-1);
      rig.history.flush();
      expect(rig.dialogs).toBe(1);
      expect(rig.dialogOpen).toBe(true);
      expect(rig.history.current().path).toBe("/erfassen");
      expect(rig.routerSaw).toEqual([]);
    });

    it("dreifaches Zurück + Vorwärts durcheinander endet auf dem Anker mit EINEM Dialog", () => {
      rig.history.user(-1);
      rig.history.user(-1);
      rig.history.user(1);
      rig.history.user(-1);
      rig.history.flush();
      expect(rig.dialogs).toBe(1);
      expect(rig.history.current().path).toBe("/erfassen");
      expect(rig.guard.phase()).toBe("held");
      expect(rig.guard.isSettled()).toBe(true);
    });

    it("weitere POPs WÄHREND des offenen Dialogs werden aufgefangen, ohne zweiten Dialog", () => {
      rig.history.user(-1);
      rig.history.flush();
      expect(rig.dialogs).toBe(1);
      rig.history.user(-2);
      rig.history.flush();
      expect(rig.dialogs).toBe(1);
      expect(rig.history.current().path).toBe("/erfassen");
    });

    it('ein zweiter Klick auf „Verwerfen" spielt das Delta NICHT zweimal ab', () => {
      rig.history.user(-1);
      rig.history.flush();
      rig.guard.proceed();
      rig.guard.proceed();
      rig.guard.proceed();
      rig.history.flush();
      expect(rig.history.goCalls).toEqual([1, -1]);
      expect(rig.routerSaw).toEqual(["/bibliothek"]);
    });

    it("liegt bereits ein Dialog einer Navigationsquelle vor, fragt der POP nicht zusätzlich", () => {
      rig.otherDialogOpen = true;
      rig.history.user(-1);
      rig.history.flush();
      // Aufgefangen (Adresszeile steht wieder), aber kein zweiter Dialog und keine zweite Navigation.
      expect(rig.dialogs).toBe(0);
      expect(rig.history.current().path).toBe("/erfassen");
      expect(rig.routerSaw).toEqual([]);
      expect(rig.guard.phase()).toBe("idle");
    });
  });

  // ── Kante 4 ──────────────────────────────────────────────────────────────────────────────────────
  describe('Kante 4: „Hier bleiben" stellt alles wieder her', () => {
    it("Ausgangsort, Index und Vorwärts-Einträge bleiben; danach geht Zurück UND Vorwärts wieder", () => {
      const stackBefore = rig.history.entries.length;
      rig.history.user(-1);
      rig.history.flush();
      rig.guard.stay();
      expect(rig.history.current().path).toBe("/erfassen");
      expect(rig.history.current().idx).toBe(2);
      // KEIN zusätzlicher Verlaufseintrag: der Wächter benutzt ausschließlich go().
      expect(rig.history.entries.length).toBe(stackBefore);
      expect(rig.guard.phase()).toBe("idle");

      // Zurück funktioniert unverändert (fragt wieder), Vorwärts danach ebenso.
      rig.dirty = false;
      rig.history.user(-1);
      rig.history.flush();
      expect(rig.routerSaw).toEqual(["/bibliothek"]);
      rig.history.user(1);
      rig.history.flush();
      expect(rig.routerSaw).toEqual(["/bibliothek", "/erfassen"]);
    });
  });

  // ── Kante 5 ──────────────────────────────────────────────────────────────────────────────────────
  describe("Kante 5: erst Restauration abwarten, dann das Delta genau einmal abspielen", () => {
    it('„Verwerfen" WÄHREND die Zurückstellung noch läuft wartet und spielt danach genau einmal ab', () => {
      rig.history.user(-2);
      // Der Zurück-Klick liegt in der Schlange, der Wächter hat ihn noch nicht gesehen.
      expect(rig.history.queue.length).toBe(1);

      // Erster POP → Wächter stellt zurück; wir klicken SOFORT, noch vor dem Restaurations-Ereignis.
      const first = rig.history.queue.shift();
      first?.();
      expect(rig.guard.isSettled()).toBe(false);
      rig.guard.proceed();
      // Nichts abgespielt, solange die Adresszeile nicht wieder stimmt:
      expect(rig.history.goCalls).toEqual([2]);
      expect(rig.routerSaw).toEqual([]);

      rig.history.flush();
      expect(rig.history.goCalls).toEqual([2, -2]);
      expect(rig.routerSaw).toEqual(["/start"]);
      expect(rig.history.current().path).toBe("/start");
    });

    it("das Abspielen wird vom Router gesehen (genau EIN durchgelassener POP)", () => {
      rig.history.user(-1);
      rig.history.flush();
      rig.guard.proceed();
      rig.history.flush();
      expect(rig.routerSaw).toEqual(["/bibliothek"]);
      expect(rig.guard.phase()).toBe("idle");
    });
  });

  // ── Kante 6 ──────────────────────────────────────────────────────────────────────────────────────
  describe("Kante 6: Speicherfehler bleibt am Ausgangsort", () => {
    it("kein proceed() ⇒ Ort, Index, Stapel und Wächter unverändert, Dialog offen", () => {
      const before = {
        path: rig.history.current().path,
        idx: rig.history.current().idx,
        len: rig.history.entries.length,
      };
      rig.history.user(-1);
      rig.history.flush();
      // Speichern schlägt fehl: der Aufrufer ruft NICHT proceed(). Der Zustand muss unberührt sein.
      expect(rig.history.current().path).toBe(before.path);
      expect(rig.history.current().idx).toBe(before.idx);
      expect(rig.history.entries.length).toBe(before.len);
      expect(rig.dialogOpen).toBe(true);
      expect(rig.guard.phase()).toBe("held");
      expect(rig.routerSaw).toEqual([]);

      // Und ein zweiter Versuch nach dem Fehler funktioniert noch.
      rig.guard.proceed();
      rig.history.flush();
      expect(rig.routerSaw).toEqual(["/bibliothek"]);
    });
  });

  // ── Kante 8 ──────────────────────────────────────────────────────────────────────────────────────
  describe("Kante 8: der Vertrag je Navigationsart", () => {
    it("POP auf DENSELBEN Pfad (nur Query/Hash) läuft durch — die Seite bleibt eingehängt", () => {
      const same = makeRig(["/bibliothek", "/bibliothek"], 1);
      same.history.user(-1);
      same.history.flush();
      expect(same.dialogs).toBe(0);
      expect(same.routerSaw).toEqual(["/bibliothek"]);
      expect(same.history.goCalls).toEqual([]);
    });

    it("POP auf einen ANDEREN Pfad wird angehalten", () => {
      rig.history.user(-1);
      rig.history.flush();
      expect(rig.dialogs).toBe(1);
    });

    it("ohne ungespeicherte Eingabe läuft jeder POP unverändert durch (keine Gängelung)", () => {
      const clean = makeRig(["/start", "/bibliothek", "/erfassen"], 2, false);
      clean.history.user(-2);
      clean.history.flush();
      expect(clean.dialogs).toBe(0);
      expect(clean.routerSaw).toEqual(["/start"]);
      expect(clean.history.goCalls).toEqual([]);
    });
  });

  // ── Kante 9 ──────────────────────────────────────────────────────────────────────────────────────
  describe("Kante 9: Eintrag ohne gültigen Index wird fail-closed behandelt", () => {
    it("POP auf einen ungestempelten Eintrag springt NICHT geraten und verliert nichts", () => {
      const odd = makeRig(["/fremd", "/erfassen"], 1);
      // Ein Eintrag, den nicht der Router gestempelt hat (`history.state.idx == null`).
      const entry = odd.history.entries[0];
      if (entry) {
        entry.idx = null;
      }
      odd.history.user(-1);
      odd.history.flush();
      // Kein Sprung (kein belastbares Delta), kein Dialog mit Versprechen, die nicht zu halten sind —
      // und vor allem: der Router hat NICHT navigiert, die Seite steht samt Inhalt.
      expect(odd.history.goCalls).toEqual([]);
      expect(odd.routerSaw).toEqual([]);
      expect(odd.dialogs).toBe(0);
      // Der Wächter bleibt arbeitsfähig: Vorwärts zurück auf den Anker heilt die Lage.
      expect(odd.guard.phase()).toBe("idle");
    });

    it("ohne ungespeicherte Eingabe läuft derselbe POP durch (fail-closed nur, wenn es etwas kostet)", () => {
      const odd = makeRig(["/fremd", "/erfassen"], 1, false);
      const entry = odd.history.entries[0];
      if (entry) {
        entry.idx = null;
      }
      odd.history.user(-1);
      odd.history.flush();
      expect(odd.routerSaw).toEqual(["/fremd"]);
    });
  });

  // ── GEGENPROBE ───────────────────────────────────────────────────────────────────────────────────
  it("GEGENPROBE: ohne den Wächter erreicht derselbe POP den Router und die Seite ist weg", () => {
    const rigOhne = makeRig(["/start", "/bibliothek", "/erfassen"], 2);
    // „Ohne Wächter" = die Autorität sagt zu allem „pass" (der Zustand vor mega13).
    rigOhne.history.onPop = () => {
      rigOhne.routerSaw.push(rigOhne.history.current().path);
    };
    rigOhne.history.user(-1);
    rigOhne.history.flush();
    expect(rigOhne.routerSaw).toEqual(["/bibliothek"]);
    expect(rigOhne.dialogs).toBe(0);
  });
});
