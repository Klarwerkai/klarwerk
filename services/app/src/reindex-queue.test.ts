// ================================================================================================
// JOB 1163 D1 — DIE DREI ZUSAGEN DER REINDEX-WARTESCHLANGE, EINZELN GEMESSEN.
// ================================================================================================
//
// BENs Wuerdigung des verlorenen Standes nennt genau drei Eigenschaften: „eine serielle
// Warteschlange, die den Aufrufer nicht blockiert und Fehler eines Eintrags isoliert". Jede
// bekommt hier EINEN Fall, und jeder Fall ist so gebaut, dass die zugehoerige Gegenmutation ihn
// — und nur ihn — rot macht.
//
// WAS HIER AUSDRUECKLICH NICHT GEPRUEFT WIRD, weil es nicht gebaut ist (Auftrag §5.6): kein
// dauerhafter Store, keine Nachfuellung, keine Verdrahtung an Revision oder Vertraulichkeit, kein
// Anschluss an Service-Hook oder Route. Die Schlange weiss nicht, was ein Reindex IST — sie
// bekommt ihn als Abhaengigkeit herein.
//
// JOB 1163 D2 kommt der MELDEVERTRAG dazu. BEN hat an D1 zu Recht beanstandet, dass ein optionaler
// `onError` eine Warteschlange erlaubt, in der Fehler lautlos verschwinden. Deshalb traegt jetzt
// JEDE Konstruktion hier einen Melder — auch die beiden Faelle, die gar keinen Fehler erwarten:
// Sie sichern zu, dass dabei auch keiner anfaellt, statt ihn stillschweigend fallen zu lassen.
import { describe, expect, it, vi } from "vitest";
import { createReindexQueue } from "./reindex-queue";

/** Ein Makrotask Pause — laesst die Schlange einen Schritt weiterlaufen, ohne echte Zeit. */
function einTick(): Promise<void> {
  return new Promise((aufloesen) => {
    setTimeout(aufloesen, 0);
  });
}

describe("JOB 1163 D1 · die Reindex-Warteschlange", () => {
  it("SERIELL · die Eintraege laufen der Reihe nach, nie zwei gleichzeitig", async () => {
    const protokoll: string[] = [];
    const unerwartet: unknown[] = [];
    const schlange = createReindexQueue({
      reindex: async (koId) => {
        protokoll.push(`start:${koId}`);
        await einTick();
        protokoll.push(`ende:${koId}`);
      },
      onError: (_koId, fehler) => {
        unerwartet.push(fehler);
      },
    });

    schlange.enqueue("ko-a");
    schlange.enqueue("ko-b");
    schlange.enqueue("ko-c");
    await schlange.idle();

    // DIE REIHENFOLGE IST DIE ZUSAGE, nicht die blosse Menge. Diese eine Behauptung traegt beides:
    // jedes `ende` steht VOR dem naechsten `start` (keine Ueberlappung), und die Kennungen stehen
    // in der Einreihungsfolge (Reihenfolge). Ein Vergleich der Endmenge wuerde beides verfehlen —
    // parallel abgearbeitet waere dieselbe Menge.
    expect(protokoll).toEqual([
      "start:ko-a",
      "ende:ko-a",
      "start:ko-b",
      "ende:ko-b",
      "start:ko-c",
      "ende:ko-c",
    ]);
    expect(unerwartet).toEqual([]);
  });

  it("NICHT BLOCKIEREND · der Aufrufer bekommt sofort die Kontrolle zurueck", async () => {
    const protokoll: string[] = [];
    const unerwartet: unknown[] = [];
    let freigeben: (() => void) | undefined;
    const schlange = createReindexQueue({
      reindex: async (koId) => {
        protokoll.push(`start:${koId}`);
        await new Promise<void>((aufloesen) => {
          freigeben = aufloesen;
        });
        protokoll.push(`ende:${koId}`);
      },
      onError: (_koId, fehler) => {
        unerwartet.push(fehler);
      },
    });

    schlange.enqueue("ko-lang");
    protokoll.push("aufrufer-laeuft-weiter");

    // DER KERN: Nach `enqueue` ist der Aufrufer dran — die Schlange hat noch NICHTS begonnen.
    // Ein synchron gestarteter Lauf schoebe `start:ko-lang` vor diese Zeile.
    expect(protokoll).toEqual(["aufrufer-laeuft-weiter"]);
    expect(schlange.queuedCount()).toBe(1);

    // Und waehrend die Schlange arbeitet, laeuft der Aufrufer weiter: der Eintrag haengt hier
    // absichtlich fest, trotzdem ist die Kontrolle laengst zurueck.
    const fertig = schlange.idle();
    await einTick();
    expect(protokoll).toEqual(["aufrufer-laeuft-weiter", "start:ko-lang"]);

    freigeben?.();
    await fertig;
    expect(protokoll).toEqual(["aufrufer-laeuft-weiter", "start:ko-lang", "ende:ko-lang"]);
    expect(schlange.queuedCount()).toBe(0);
    expect(unerwartet).toEqual([]);
  });

  it("FEHLERISOLATION · ein fehlgeschlagener Eintrag stoppt die uebrigen nicht und wird gemeldet", async () => {
    const protokoll: string[] = [];
    const gemeldet: { koId: string; fehler: unknown }[] = [];
    const bruch = new Error("Reindex von ko-b fehlgeschlagen");
    const schlange = createReindexQueue({
      reindex: async (koId) => {
        protokoll.push(koId);
        if (koId === "ko-b") {
          throw bruch;
        }
      },
      onError: (koId, fehler) => {
        gemeldet.push({ koId, fehler });
      },
    });

    schlange.enqueue("ko-a");
    schlange.enqueue("ko-b");
    schlange.enqueue("ko-c");
    await schlange.idle();

    // (1) STOPPT DIE UEBRIGEN NICHT: `ko-c` steht hinter dem gescheiterten `ko-b` und lief.
    expect(protokoll).toEqual(["ko-a", "ko-b", "ko-c"]);
    // (2) WIRD GEMELDET, NICHT VERSCHLUCKT: genau eine Meldung, mit Kennung UND dem echten Fehler.
    //     Ein `toBe` auf die Instanz — nicht auf die Meldung: ein neu gebauter Fehler mit gleichem
    //     Text waere schon eine andere Auskunft.
    expect(gemeldet).toHaveLength(1);
    expect(gemeldet[0]?.koId).toBe("ko-b");
    expect(gemeldet[0]?.fehler).toBe(bruch);
  });

  // ==============================================================================================
  // JOB 1163 D2 (BENs Pruefluecke 6.1) — DER MELDEVERTRAG, AN SEINEM RANDFALL.
  // ==============================================================================================
  //
  // BEN an D1: „Der Fehlerfall beweist Meldung und Weiterlauf nur fuer eine Queue mit uebergebenem
  // Fehler-Callback. Er widerlegt nicht den zulaessigen oeffentlichen Fall ohne Callback." Genau
  // dieser Fall steht jetzt hier — und er hat kein Ergebnis mehr, weil es ihn nicht mehr gibt.
  it("MELDEVERTRAG · ohne Melder ist die Konstruktion unmoeglich; mit ihm kommt DIESELBE Instanz an und der Folgeeintrag laeuft", async () => {
    // (1) DER RANDFALL SELBST: eine Warteschlange ohne Fehlerempfaenger gibt es nicht.
    //     Zwei Schranken, absichtlich beide — die Typschranke haelt jeden TypeScript-Aufrufer,
    //     die Laufzeitschranke haelt auch den, der sie mit `as` oder aus reinem JavaScript umgeht.
    //     Der `@ts-expect-error` ist zugleich der Waechter des Vertrags: Wuerde `onError` je
    //     wieder optional, waere die Anweisung ungenutzt und die Typpruefung schluege fehl.
    // @ts-expect-error - `onError` ist Pflicht; ohne ihn gibt es diese Warteschlange nicht.
    expect(() => createReindexQueue({ reindex: async () => {} })).toThrow(/onError/);

    // (2) MIT Melder: dieselbe Fehlerinstanz kommt an, und der Folgeeintrag laeuft ungestoert.
    const protokoll: string[] = [];
    const gemeldet: { koId: string; fehler: unknown }[] = [];
    const bruch = new Error("Reindex von ko-erst fehlgeschlagen");
    const schlange = createReindexQueue({
      // Wirft SYNCHRON, vor jedem `await`. Auch dieser Eintrittsweg muss im Melder herauskommen —
      // ein `try` um ein `await` faengt den synchronen Wurf mit.
      reindex: (koId) => {
        protokoll.push(koId);
        if (koId === "ko-erst") {
          throw bruch;
        }
        return Promise.resolve();
      },
      onError: (koId, fehler) => {
        gemeldet.push({ koId, fehler });
      },
    });

    schlange.enqueue("ko-erst");
    schlange.enqueue("ko-folge");
    await schlange.idle();

    // DIESELBE Instanz — nicht eine nachgebaute mit gleichem Text.
    expect(gemeldet).toHaveLength(1);
    expect(gemeldet[0]?.koId).toBe("ko-erst");
    expect(gemeldet[0]?.fehler).toBe(bruch);
    // UND der Folgeeintrag startet ungestoert.
    expect(protokoll).toEqual(["ko-erst", "ko-folge"]);
  });

  // ==============================================================================================
  // JOB 1163 D5 — DER LETZTE AUSGANG, JETZT GEFAHREN STATT BEHAUPTET.
  // ==============================================================================================
  //
  // D2 hat diesen Ausgang gebaut und in seiner eigenen Rueckgabe (§10.5) ehrlich ausgewiesen:
  // „Der letzte Ausgang auf stderr ist nicht durch einen Testfall belegt. … nach Regelwerk Z.493
  // kennzeichne ich seine Laufzeitwirkung ausdruecklich als UNBEWIESENE HYPOTHESE." BEN hat das
  // zum Gegenstand der Folgerunde gemacht. Dieser Fall loest die Hypothese ein.
  //
  // ER TRAEGT VIER ZUSAGEN IN EINEM ABLAUF, und die REIHENFOLGE ist Teil des Vertrags:
  // Weiterlauf (1) und Zurueckweisungsfreiheit (2) stehen VOR den Meldezusagen (3)/(4). Eine
  // Zusicherung hinter einer bereits scheiternden wird von Vitest nicht mehr erreicht und darf
  // nicht als „bleibt gruen" ausgegeben werden — das hat BEN an D2 zu Recht geruegt. So steht
  // unter jeder Gegenmutation fest, dass ausschliesslich die MELDUNG ausfaellt, nie die Isolation.
  it("LETZTER AUSGANG · wirft der Pflichtmelder selbst, meldet der Fallback beobachtbar — ohne Rohtext, ohne unbehandelte Zurueckweisung, und der Folgeeintrag startet", async () => {
    const protokoll: string[] = [];
    const empfangen: unknown[] = [];
    const zeilen: string[] = [];
    const unbehandelt: unknown[] = [];

    // Rohtexte, die NICHT austreten duerfen — sie sind der Messgegenstand des Datenschutzteils.
    const arbeitsfehler = new Error("GEHEIMER-ARBEITSFEHLER-ko-erst");
    const melderfehler = new RangeError("GEHEIMER-MELDERFEHLER");

    const spion = vi.spyOn(process.stderr, "write").mockImplementation((teil: unknown) => {
      zeilen.push(String(teil));
      return true;
    });
    const aufZurueckweisung = (grund: unknown): void => {
      unbehandelt.push(grund);
    };
    process.on("unhandledRejection", aufZurueckweisung);

    try {
      const schlange = createReindexQueue({
        reindex: (koId) => {
          protokoll.push(koId);
          if (koId === "ko-erst") {
            throw arbeitsfehler;
          }
          return Promise.resolve();
        },
        onError: (_koId, fehler) => {
          empfangen.push(fehler);
          throw melderfehler; // der Pflichtmelder scheitert selbst
        },
      });

      schlange.enqueue("ko-erst");
      schlange.enqueue("ko-folge");
      await schlange.idle();
      // Zwei Makrotasks: eine unbehandelte Zurueckweisung wird von Node NICHT synchron gemeldet.
      await einTick();
      await einTick();
    } finally {
      // Beides im `finally`: liefe der Spion aus, verloere eine spaetere Testdatei ihre Ausgabe.
      process.off("unhandledRejection", aufZurueckweisung);
      spion.mockRestore();
    }

    // (1) DER FOLGEEINTRAG STARTET — bewusst ZUERST.
    expect(protokoll).toEqual(["ko-erst", "ko-folge"]);
    // (2) KEINE UNBEHANDELTE ZURUECKWEISUNG.
    expect(unbehandelt).toEqual([]);
    // (3) BEOBACHTBAR, UND GENAU EINMAL — nicht je Eintrag, nicht zweimal.
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0]).toContain("ko-erst");
    // (4) DATENSCHUTZ: nur die Klassen, kein Rohtext. Die Muster sind bewusst an den Wortlaut
    //     gebunden — ein blosses toContain("Error") waere schon durch "RangeError" erfuellt.
    expect(zeilen[0]).toMatch(/fehlgeschlagen \(Error\)/);
    expect(zeilen[0]).toMatch(/scheiterte selbst \(RangeError\)/);
    expect(zeilen[0]).not.toContain("GEHEIMER-ARBEITSFEHLER");
    expect(zeilen[0]).not.toContain("GEHEIMER-MELDERFEHLER");
    // (5) Und der Melder hat DIESELBE Instanz bekommen, bevor er selbst warf.
    expect(empfangen).toEqual([arbeitsfehler]);
  });
});
