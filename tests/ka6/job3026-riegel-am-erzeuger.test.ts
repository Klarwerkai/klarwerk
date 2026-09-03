// ================================================================================================
// JOB 3026 · KA6 STUFE 2 — DER RIEGEL LIEGT IM ERZEUGER, UND EIN CLIENT-BOOL ÖFFNET IHN NIE MEHR.
// ================================================================================================
//
// Pedis Satz: „Klara schreibt auf Zuruf, und der Riegel hält: ohne Einwilligung für dieses Dokument
// verlässt kein Text das Haus."
//
// BIS HIERHER HIELT ER NICHT. `ZurufEingabe` trug ein Feld `einwilligung: boolean`, und `schlageVor`
// prüfte es. Geprüft wurde damit nicht die Einwilligung, sondern die BEHAUPTUNG des Aufrufers, es
// gäbe eine. Genau das nennt der Bestand an anderer Stelle wörtlich unzulässig
// (`services/app/src/routes/ask-routes.ts:110-111`: „Ein Client-Bool gibt es nicht und darf es nie
// geben.").
//
// WAS DIESE DATEI MISST, ist deshalb nicht „ein Fehler kam", sondern zweierlei am Verhalten:
//   · Der Formulierer ZÄHLT seine Aufrufe. „Nicht gerufen" ist hier eine Messung, keine Ableitung
//     aus einem Rückgabewert.
//   · Das Sitzungstor ZÄHLT seine Fragen. So ist auch belegbar, wann NICHT gefragt wurde (Fall (e)
//     und der Reihenfolgefall) und WOMIT gefragt wurde (letzter Block, „gefragt, nicht behauptet").
//
// SERVERINTERN. Diese Grenze hängt an keiner Oberfläche und bekommt in diesem Auftrag auch keine:
// eine Route gäbe es nicht, weil `KLARA_EXTERNAL_EXECUTION_MIGRATED`
// (`services/reasoner/src/klara-policy.ts:161`) auf `false` steht und `pruefeExterneAusfuehrung`
// heute gar kein `erlaubt: true` liefern kann. Erst die Grenze schließen, dann öffnen.
import { describe, expect, it, vi } from "vitest";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import {
  type Formulierer,
  type Ka6Einwilligungspruefer,
  type ZurufBindung,
  type ZurufEingabe,
  ZurufError,
  ZurufService,
} from "../../services/output";

/** Eine vollständige, unverdächtige Bindung — vier opake Kennungen, sonst nichts. */
const BINDUNG: ZurufBindung = {
  sessionId: "sess-1",
  actorId: "anna",
  addinInstanceId: "inst-1",
  documentContextId: "doc-1",
};

/** Zählt jeden Aufruf. Ohne diesen Zähler wäre „nichts ging hinaus" eine Behauptung. */
function formulierer() {
  const zaehler = { aufrufe: 0 };
  const f: Formulierer = {
    async formuliere() {
      zaehler.aufrufe += 1;
      return "Ein Vorschlag.";
    },
  };
  return { formulierer: f, zaehler };
}

type Frage = {
  sessionId: string;
  bindung: { actorId: string; addinInstanceId: string; documentContextId: string };
};

/** Ein Sitzungstor, das seine Fragen mitschreibt und antwortet, wie der Fall es verlangt. */
function tor(antwort: () => Promise<{ erlaubt: boolean; grund?: string }>) {
  const fragen: Frage[] = [];
  const pruefer: Ka6Einwilligungspruefer = {
    async pruefeExterneAusfuehrung(sessionId, bindung) {
      fragen.push({ sessionId, bindung });
      return antwort();
    },
  };
  return { pruefer, fragen };
}

function aufbau(pruefer?: Ka6Einwilligungspruefer) {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  const bestand = vi.spyOn(koService, "get");
  const f = formulierer();
  const zuruf = new ZurufService({
    koService,
    formulierer: f.formulierer,
    ...(pruefer ? { einwilligungspruefer: pruefer } : {}),
    now: () => Date.parse("2026-09-03T12:00:00Z"),
  });
  return { zuruf, bestand, ...f };
}

async function fehlercode(lauf: Promise<unknown>): Promise<string> {
  try {
    await lauf;
    return "KEIN FEHLER — haette werfen muessen";
  } catch (e) {
    expect(e).toBeInstanceOf(ZurufError);
    return (e as ZurufError).code;
  }
}

// ------------------------------------------------------------------------------------------------
// DER RED-FIRST-FALL
// ------------------------------------------------------------------------------------------------
describe("JOB 3026 · eine behauptete Einwilligung erreicht den Formulierer nicht", () => {
  it("eine behauptete Einwilligung erreicht den Formulierer nicht", async () => {
    const t = aufbau(); // KEIN Sitzungstor verdrahtet, also keine bestaetigte Einwilligung.

    // So sah ein Aufruf VOR diesem Bau aus: der Aufrufer setzte das Feld selbst. Der Typ kennt es
    // nicht mehr (Prüfpunkt 1), deshalb der ausdrückliche Umweg — genau diesen Weg soll ein
    // künftiger Endpunkt nicht mehr haben.
    const behauptet = {
      art: "erstellen",
      text: "Ein Thema",
      bindung: BINDUNG,
      einwilligung: true,
    } as unknown as ZurufEingabe;

    expect(await fehlercode(t.zuruf.schlageVor(behauptet))).toBe("CONSENT_MISSING");
    expect(t.zaehler.aufrufe).toBe(0);
  });

  it("`ZurufEingabe` hat kein Feld mehr, mit dem sich eine Einwilligung behaupten liesse", () => {
    // Statische Zusicherung: wäre `einwilligung` noch im Vertrag, stünde hier `true` und `tsc`
    // würde die Zuweisung ablehnen. Der Ablösungsnachweis zu Prüfpunkt 7, im Typsystem geführt.
    const imVertrag: "einwilligung" extends keyof ZurufEingabe ? true : false = false;
    expect(imVertrag).toBe(false);
  });
});

// ------------------------------------------------------------------------------------------------
// FAIL-CLOSED IN JEDER RICHTUNG (Lieferung 3 · Fälle a bis e)
// ------------------------------------------------------------------------------------------------
describe("JOB 3026 · fail-closed: kein unklarer Zustand fuehrt zur Freigabe", () => {
  it("(a) kein Pruefer verdrahtet — der geschlossene Zustand ist der Ruhezustand", async () => {
    const t = aufbau();
    expect(
      await fehlercode(t.zuruf.schlageVor({ art: "erstellen", text: "Thema", bindung: BINDUNG })),
    ).toBe("CONSENT_MISSING");
    expect(t.zaehler.aufrufe).toBe(0);
  });

  it("(b) ein Pruefer ohne die Methode `pruefeExterneAusfuehrung` oeffnet nichts", async () => {
    const kaputt = {
      pruefeExterneAusfuehrung: "ja, unbedingt",
    } as unknown as Ka6Einwilligungspruefer;
    const t = aufbau(kaputt);
    expect(
      await fehlercode(t.zuruf.schlageVor({ art: "erstellen", text: "Thema", bindung: BINDUNG })),
    ).toBe("CONSENT_MISSING");
    expect(t.zaehler.aufrufe).toBe(0);
  });

  it("(c) `erlaubt: false` — eine Absage bleibt eine Absage", async () => {
    const g = tor(async () => ({ erlaubt: false, grund: "external_not_migrated" }));
    const t = aufbau(g.pruefer);
    expect(
      await fehlercode(t.zuruf.schlageVor({ art: "erstellen", text: "Thema", bindung: BINDUNG })),
    ).toBe("CONSENT_MISSING");
    expect(t.zaehler.aufrufe).toBe(0);
    expect(g.fragen).toHaveLength(1);
  });

  it("(d) ein werfender Pruefer ist eine Absage, kein Serverfehler", async () => {
    const g = tor(async () => {
      throw new Error("NOT_FOUND");
    });
    const t = aufbau(g.pruefer);
    // Entscheidend: es kommt KEIN `NOT_FOUND` heraus, sondern die unveraenderte Enge.
    expect(
      await fehlercode(t.zuruf.schlageVor({ art: "erstellen", text: "Thema", bindung: BINDUNG })),
    ).toBe("CONSENT_MISSING");
    expect(t.zaehler.aufrufe).toBe(0);
    expect(g.fragen).toHaveLength(1);
  });

  it("(e) eine unvollstaendige Bindung wird gar nicht erst gefragt", async () => {
    // Jedes der vier Felder, je einmal leer und einmal nur Leerzeichen: eine halbe Bindung deckt
    // nie eine Einwilligung, und eine halbe Frage waere eine Frage nach einer fremden Sitzung.
    for (const feld of ["sessionId", "actorId", "addinInstanceId", "documentContextId"] as const) {
      for (const leerwert of ["", "   "]) {
        const g = tor(async () => ({ erlaubt: true }));
        const t = aufbau(g.pruefer);
        const bindung: ZurufBindung = { ...BINDUNG, [feld]: leerwert };
        expect(
          await fehlercode(t.zuruf.schlageVor({ art: "erstellen", text: "Thema", bindung })),
        ).toBe("CONSENT_MISSING");
        expect(g.fragen).toHaveLength(0);
        expect(t.zaehler.aufrufe).toBe(0);
      }
    }
  });

  it("(f) eine Antwort ohne `erlaubt` oeffnet nicht — nur genau `erlaubt === true` tut es", async () => {
    for (const antwort of [{}, { erlaubt: undefined }, { erlaubt: "true" }, undefined]) {
      const g = tor(async () => antwort as { erlaubt: boolean });
      const t = aufbau(g.pruefer);
      expect(
        await fehlercode(t.zuruf.schlageVor({ art: "erstellen", text: "Thema", bindung: BINDUNG })),
      ).toBe("CONSENT_MISSING");
      expect(t.zaehler.aufrufe).toBe(0);
    }
  });
});

// ------------------------------------------------------------------------------------------------
// DIE REIHENFOLGE UND DER BESTAND (Lieferung 4)
// ------------------------------------------------------------------------------------------------
describe("JOB 3026 · die Reihenfolge bleibt die zugesagte", () => {
  it("ohne Einwilligung wird der Bestand nicht ein einziges Mal beruehrt", async () => {
    const g = tor(async () => ({ erlaubt: false }));
    const t = aufbau(g.pruefer);
    expect(
      await fehlercode(
        t.zuruf.schlageVor({
          art: "umformulieren",
          text: "Alter Text",
          bindung: BINDUNG,
          koIds: ["K1", "K2"],
        }),
      ),
    ).toBe("CONSENT_MISSING");
    expect(t.bestand).not.toHaveBeenCalled();
    expect(t.zaehler.aufrufe).toBe(0);
  });

  it("ein unbekannter Zuruf wird abgewiesen, BEVOR das Sitzungstor gefragt wird", async () => {
    const g = tor(async () => ({ erlaubt: true }));
    const t = aufbau(g.pruefer);
    expect(
      await fehlercode(
        t.zuruf.schlageVor({ art: "loeschen" as never, text: "Thema", bindung: BINDUNG }),
      ),
    ).toBe("UNKNOWN_ART");
    expect(g.fragen).toHaveLength(0);
  });
});

// ------------------------------------------------------------------------------------------------
// KEIN GRUND VERLÄSST DEN ERZEUGER (Lieferung 5)
// ------------------------------------------------------------------------------------------------
describe("JOB 3026 · der Grund des Sitzungstors bleibt drinnen", () => {
  it("weder Grund noch Kennungen stehen in der Fehlermeldung", async () => {
    const g = tor(async () => ({ erlaubt: false, grund: "zustimmung_deckt_bindung_nicht" }));
    const t = aufbau(g.pruefer);
    try {
      await t.zuruf.schlageVor({ art: "erstellen", text: "Thema", bindung: BINDUNG });
      throw new Error("haette werfen muessen");
    } catch (e) {
      expect(e).toBeInstanceOf(ZurufError);
      const meldung = (e as ZurufError).message;
      expect(meldung).toBe(
        "Ohne Einwilligung fuer dieses Dokument wird nichts formuliert und nichts gesendet.",
      );
      for (const verboten of [
        "zustimmung_deckt_bindung_nicht",
        BINDUNG.sessionId,
        BINDUNG.actorId,
        BINDUNG.addinInstanceId,
        BINDUNG.documentContextId,
      ]) {
        expect(meldung).not.toContain(verboten);
      }
    }
  });
});

// ------------------------------------------------------------------------------------------------
// DER EINE WEG, DER ÖFFNET
// ------------------------------------------------------------------------------------------------
describe("JOB 3026 · gefragt, nicht behauptet", () => {
  it("mit `erlaubt: true` laeuft der heutige Ablauf weiter — und das Tor wurde WOMIT gefragt", async () => {
    const g = tor(async () => ({ erlaubt: true }));
    const t = aufbau(g.pruefer);
    const v = await t.zuruf.schlageVor({ art: "erstellen", text: "Thema", bindung: BINDUNG });

    expect(v.vorschlag).toBe("Ein Vorschlag.");
    expect(v.aiGenerated).toBe(true);
    expect(t.zaehler.aufrufe).toBe(1);
    // Die Sitzung steht im ERSTEN Argument, die drei Bindungsfelder im zweiten — dieselbe Form wie
    // `ka4Freigabe` (`ask-routes.ts:172-176`). Eine zweite Auslegung gibt es nicht.
    expect(g.fragen).toEqual([
      {
        sessionId: BINDUNG.sessionId,
        bindung: {
          actorId: BINDUNG.actorId,
          addinInstanceId: BINDUNG.addinInstanceId,
          documentContextId: BINDUNG.documentContextId,
        },
      },
    ]);
  });
});
