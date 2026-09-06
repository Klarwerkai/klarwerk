// @vitest-environment jsdom
// ================================================================================================
// JOB 3112 · V3 · RUNDE 2 · KORREKTURPFLICHT 2 — DER TEILERFOLG WIRD NICHT VERSCHWIEGEN.
// ================================================================================================
//
// BENS BEFUND (06.09.2026, Runde 1 ROT): „Nach erfolgreichem `confidentiality` und fehlgeschlagenem
// `rate` bleibt die Einstufung gespeichert, während `i18n.ts:554` ‚Nicht gespeichert' meldet. Der
// Fehlerpfad aktualisiert den Bestand ebenfalls nicht."
//
// Das ist keine Formsache: der Mensch liest „nicht gespeichert", klickt erneut auf eine ANDERE Stufe
// — und stuft ein Objekt um, ohne zu wissen, dass er es tut. Zwei getrennte Aussagen sind nötig,
// weil es zwei Zustände sind:
//   · nichts kam an          → „Nicht gespeichert — es wurde nichts freigegeben."
//   · die Stufe kam an       → „Die Stufe „…" ist gespeichert. Die Freigabe selbst schlug fehl."
// Und der Bestand muss den zweiten Fall NACHLADEN, sonst behauptet die Karte weiter „nicht
// eingestuft" — eine Aussage, die seit diesem Aufruf nicht mehr stimmt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stand = vi.hoisted(() => ({ rolle: "admin" }));
vi.mock("../../apps/web/src/api/endpoints", async () =>
  (await import("./kulisse-mocks")).endpunktMock(),
);
vi.mock("../../apps/web/src/app/AuthContext", async (o) =>
  (await import("./kulisse-mocks")).authMock(o as never),
);
vi.mock("../../apps/web/src/app/RoleContext", async (o) =>
  (await import("./kulisse-mocks")).rolleMock(o as never, stand),
);
vi.mock("../../apps/web/src/app/ToastContext", async (o) =>
  (await import("./kulisse-mocks")).toastMock(o as never),
);

import { ApiError } from "../../apps/web/src/api/client";
import { endpoints } from "../../apps/web/src/api/endpoints";
import type { KoAction } from "../../apps/web/src/api/endpoints";
import {
  type Brett,
  de,
  finde,
  klick,
  knopfMitText,
  mounteBrett,
  putFolge,
  zeile,
} from "./kulisse";

let brett: Brett;

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  stand.rolle = "admin";
});
afterEach(() => brett?.abbauen());

const FRAGE = '[data-testid="pruefen-stufenfrage"]';
const FEHLER = '[data-testid="pruefen-stufenfrage-fehler"]';
const WIEDERHOLEN = '[data-testid="pruefen-stufenfrage-wiederholen"]';
const FREIGEBEN = '[data-testid="pruefen-entscheidung-up"]';

type Fn = ReturnType<typeof vi.fn>;

/** Die Stufe geht durch, der genannte Abschluss-Aufruf scheitert — der Teilerfolg. */
function nurStufeGeht(scheitert: "rate" | "admin-validate"): void {
  (endpoints.ko.act as unknown as Fn).mockImplementation((async (_id: string, body: KoAction) => {
    if (body.action === scheitert) {
      throw new ApiError(500, "server_error", "Freigabe kaputt");
    }
    return {};
  }) as never);
}

const boardMock = (): Fn => endpoints.validation.board as unknown as Fn;

describe("JOB 3112 · T1: Stufe gespeichert, Freigabe gescheitert — die Fläche sagt genau das", () => {
  it("beide Aufrufe liefen, in der verbindlichen Reihenfolge", async () => {
    nurStufeGeht("rate");
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, FREIGEBEN));
    await klick(finde(brett.container, '[data-testid="pruefen-stufenfrage-wahl-vertraulich"]'));

    expect(putFolge()).toEqual([
      { action: "confidentiality", level: "vertraulich" },
      { action: "rate", verdict: "up" },
    ]);
  });

  it("die Meldung nennt die gespeicherte Stufe — und sagt NICHT „Nicht gespeichert“", async () => {
    nurStufeGeht("rate");
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, FREIGEBEN));
    await klick(finde(brett.container, '[data-testid="pruefen-stufenfrage-wahl-vertraulich"]'));

    const text = finde(brett.container, FEHLER)?.textContent ?? "";
    expect(text).toContain(de("conf.level.vertraulich"));
    expect(text).toContain("ist gespeichert");
    expect(text).not.toContain(de("val.stufenfrage.fehler"));
    expect(brett.container.textContent).not.toContain(de("val.stufenfrage.fehler"));
  });

  it("keine Erfolgsquittung, und die Frage bleibt offen", async () => {
    nurStufeGeht("rate");
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, FREIGEBEN));
    await klick(finde(brett.container, '[data-testid="pruefen-stufenfrage-wahl-intern"]'));

    expect(finde(brett.container, '[data-testid="pruefen-quittung"]')).toBeNull();
    expect(brett.container.textContent).not.toContain(de("val.decisionSaved"));
    expect(finde(brett.container, FRAGE)).not.toBeNull();
  });

  it("die Stufenknöpfe sind weg — beantwortet ist beantwortet; es fehlt nur die Freigabe", async () => {
    nurStufeGeht("rate");
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, FREIGEBEN));
    await klick(finde(brett.container, '[data-testid="pruefen-stufenfrage-wahl-vertraulich"]'));

    expect(
      brett.container.querySelectorAll('[data-testid^="pruefen-stufenfrage-wahl-"]').length,
    ).toBe(0);
    expect(finde(brett.container, '[data-testid="pruefen-stufenfrage-ohne"]')).toBeNull();
    expect(finde(brett.container, WIEDERHOLEN)).not.toBeNull();
    expect(finde(brett.container, FRAGE)?.textContent).toContain(
      de("val.stufenfrage.nurNochFreigeben"),
    );
  });
});

describe("JOB 3112 · T2: der Bestand wird nachgeladen — aber nur, wenn wirklich etwas ankam", () => {
  it("Teilerfolg → das Brett wird neu geholt, und die gespeicherte Stufe steht in der Antwort", async () => {
    nurStufeGeht("rate");
    brett = await mounteBrett({ zeilen: [zeile()] });
    expect(boardMock()).toHaveBeenCalledTimes(1);
    // Der Server hat die Stufe; die nächste Antwort trägt sie.
    boardMock().mockResolvedValue([
      zeile({ confidentiality: "vertraulich", confidentialityProvenance: "ko" }),
    ] as never);

    await klick(finde(brett.container, FREIGEBEN));
    await klick(finde(brett.container, '[data-testid="pruefen-stufenfrage-wahl-vertraulich"]'));

    expect(boardMock().mock.calls.length).toBeGreaterThan(1);
    // RUNDE 3 (Bens Prüflücke 6): nicht nur ZÄHLEN, dass nachgeladen wurde — die Karte muss die
    // gespeicherte Stufe danach auch WIRKLICH anzeigen. Die Zeile steht im „Mehr" (`<details>`,
    // zugeklappt trotzdem im Baum) und trägt ihre Lage als Datum.
    const stufenzeile = finde(brett.container, '[data-testid="val-stufe"]');
    expect(stufenzeile?.dataset.lage).toBe("eingestuft");
    expect(stufenzeile?.textContent).toContain(de("conf.level.vertraulich"));
  });

  it("Gegenprobe: scheitert schon die STUFE, wird nichts nachgeladen — es hat sich nichts geändert", async () => {
    (endpoints.ko.act as unknown as Fn).mockImplementation((async (_id: string, body: KoAction) => {
      if (body.action === "confidentiality") {
        throw new ApiError(403, "forbidden", "Herabstufung nicht erlaubt.");
      }
      return {};
    }) as never);
    brett = await mounteBrett({ zeilen: [zeile()] });
    const vorher = boardMock().mock.calls.length;

    await klick(finde(brett.container, FREIGEBEN));
    await klick(finde(brett.container, '[data-testid="pruefen-stufenfrage-wahl-vertraulich"]'));

    expect(boardMock().mock.calls.length).toBe(vorher);
    expect(finde(brett.container, FEHLER)?.textContent).toContain(de("val.stufenfrage.fehler"));
    expect(finde(brett.container, WIEDERHOLEN)).toBeNull();
  });
});

describe("JOB 3112 · T3: die Wiederholung schickt GENAU den einen fehlenden Aufruf", () => {
  it("Fußband: `rate` allein, kein zweites `confidentiality`", async () => {
    nurStufeGeht("rate");
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, FREIGEBEN));
    await klick(finde(brett.container, '[data-testid="pruefen-stufenfrage-wahl-vertraulich"]'));
    // Der Server hat sich gefangen.
    (endpoints.ko.act as unknown as Fn).mockImplementation((async () => ({})) as never);
    await klick(finde(brett.container, WIEDERHOLEN));

    expect(putFolge()).toEqual([
      { action: "confidentiality", level: "vertraulich" },
      { action: "rate", verdict: "up" },
      { action: "rate", verdict: "up" },
    ]);
    expect(putFolge().filter((p) => p.action === "confidentiality").length).toBe(1);
  });

  it("nach geglückter Wiederholung schliesst die Frage und die Quittung erscheint", async () => {
    nurStufeGeht("rate");
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, FREIGEBEN));
    await klick(finde(brett.container, '[data-testid="pruefen-stufenfrage-wahl-vertraulich"]'));
    (endpoints.ko.act as unknown as Fn).mockImplementation((async () => ({})) as never);
    await klick(finde(brett.container, WIEDERHOLEN));

    expect(finde(brett.container, FRAGE)).toBeNull();
    expect(finde(brett.container, '[data-testid="pruefen-quittung"]')).not.toBeNull();
  });
});

describe("JOB 3112 · T4: der Administratorweg trägt denselben Zwischenstand", () => {
  it("`admin-validate` scheitert nach gesetzter Stufe → dieselbe ehrliche Meldung", async () => {
    nurStufeGeht("admin-validate");
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, '[data-testid="pruefen-menue-karte"]'));
    await klick(knopfMitText(brett.container, de("val.markTrue")));
    await klick(knopfMitText(brett.container, de("val.markTrueYes")));
    await klick(finde(brett.container, '[data-testid="pruefen-stufenfrage-wahl-intern"]'));

    expect(putFolge()).toEqual([
      { action: "confidentiality", level: "intern" },
      { action: "admin-validate" },
    ]);
    const text = finde(brett.container, FEHLER)?.textContent ?? "";
    expect(text).toContain(de("conf.level.intern"));
    expect(text).not.toContain(de("val.stufenfrage.fehler"));
    expect(brett.container.textContent).not.toContain(de("val.markTrueDone"));
  });
});

// ================================================================================================
// RUNDE 3 · BENS KORREKTURPFLICHT — EINE BESTÄTIGTE SPEICHERUNG VERSCHWINDET NIE WIEDER.
// ================================================================================================
//
// BENS BEFUND (06.09.2026, Runde 2 ROT): „Der Wiederholknopf übergibt `stufe: null`; beim nächsten
// Fehler trägt deshalb auch `FreigabeFehler` keine gespeicherte Stufe mehr. Die Anzeige fällt auf
// ‚Nicht gespeichert' und erneute Stufenwahl zurück."
//
// Der Denkfehler von Runde 2 war der ORT des Wissens: der Zwischenstand hing am LETZTEN Fehler statt
// am VORGANG. Ein Fehler ist ein Ereignis, kein Gedächtnis. Was der Server bestätigt hat, ist eine
// Tatsache über den laufenden Vorgang — und Tatsachen werden von späteren Fehlschlägen nicht wahr
// oder falsch. Dieselbe Regel wie im Zustandsmodell des Auftrags (§9): eine POSITIVE Aussage („es
// liegt etwas") verschwindet nie wegen eines Fehlers, denn Verschwinden wäre die Entwarnung.
describe("JOB 3112 · T5: Fußband — auch die ZWEITE und DRITTE gescheiterte Freigabe vergisst nichts", () => {
  /** Stufe gesetzt, Freigabe scheitert — und sie scheitert auch beim Wiederholen weiter. */
  async function bisZweitemFehlschlag(): Promise<void> {
    nurStufeGeht("rate");
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, FREIGEBEN));
    await klick(finde(brett.container, '[data-testid="pruefen-stufenfrage-wahl-vertraulich"]'));
    await klick(finde(brett.container, WIEDERHOLEN));
  }

  it("die Meldung nennt die Stufe WEITERHIN — nicht „Nicht gespeichert“", async () => {
    await bisZweitemFehlschlag();

    const text = finde(brett.container, FEHLER)?.textContent ?? "";
    expect(text).toContain(de("conf.level.vertraulich"));
    expect(text).not.toContain(de("val.stufenfrage.fehler"));
    expect(brett.container.textContent).not.toContain(de("val.stufenfrage.fehler"));
  });

  it("es wird NICHT erneut nach der Stufe gefragt", async () => {
    await bisZweitemFehlschlag();

    expect(
      brett.container.querySelectorAll('[data-testid^="pruefen-stufenfrage-wahl-"]').length,
    ).toBe(0);
    expect(finde(brett.container, '[data-testid="pruefen-stufenfrage-ohne"]')).toBeNull();
    expect(finde(brett.container, WIEDERHOLEN)).not.toBeNull();
    expect(finde(brett.container, FRAGE)?.textContent).toContain(
      de("val.stufenfrage.nurNochFreigeben"),
    );
  });

  it("keine Erfolgsquittung, und weitere Wiederholungen schicken NUR die Freigabe", async () => {
    await bisZweitemFehlschlag();
    await klick(finde(brett.container, WIEDERHOLEN));

    expect(finde(brett.container, '[data-testid="pruefen-quittung"]')).toBeNull();
    expect(putFolge()).toEqual([
      { action: "confidentiality", level: "vertraulich" },
      { action: "rate", verdict: "up" },
      { action: "rate", verdict: "up" },
      { action: "rate", verdict: "up" },
    ]);
    expect(putFolge().filter((p) => p.action === "confidentiality").length).toBe(1);
  });

  it("gibt der Server nach dem dritten Versuch nach, schliesst der Vorgang sauber", async () => {
    await bisZweitemFehlschlag();
    (endpoints.ko.act as unknown as Fn).mockImplementation((async () => ({})) as never);
    await klick(finde(brett.container, WIEDERHOLEN));

    expect(finde(brett.container, FRAGE)).toBeNull();
    expect(finde(brett.container, '[data-testid="pruefen-quittung"]')).not.toBeNull();
  });

  // Der zweite Weg zurück in denselben Vorgang: nicht der Wiederholknopf, sondern noch einmal der
  // grosse Knopf im Fußband. Er ist erreichbar, solange die frische Antwort mit der gespeicherten
  // Stufe noch unterwegs ist — und er darf die Bestätigung genauso wenig wegwerfen.
  it("noch einmal „Freigeben“ im Fußband erbt den Zwischenstand desselben Eintrags", async () => {
    nurStufeGeht("rate");
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, FREIGEBEN));
    await klick(finde(brett.container, '[data-testid="pruefen-stufenfrage-wahl-vertraulich"]'));
    await klick(finde(brett.container, FREIGEBEN));

    expect(
      brett.container.querySelectorAll('[data-testid^="pruefen-stufenfrage-wahl-"]').length,
    ).toBe(0);
    expect(finde(brett.container, FRAGE)?.textContent).toContain(
      de("val.stufenfrage.nurNochFreigeben"),
    );
    expect(putFolge().filter((p) => p.action === "confidentiality").length).toBe(1);
  });

  it("wer abbricht, beginnt einen NEUEN Vorgang — der alte Zwischenstand wird nicht geerbt", async () => {
    await bisZweitemFehlschlag();
    await klick(finde(brett.container, '[data-testid="pruefen-stufenfrage-abbrechen"]'));
    expect(finde(brett.container, FRAGE)).toBeNull();
    // Die Karte trägt (in dieser Antwort) weiterhin keine Stufe → es wird wieder gefragt.
    await klick(finde(brett.container, FREIGEBEN));

    expect(
      brett.container.querySelectorAll('[data-testid^="pruefen-stufenfrage-wahl-"]').length,
    ).toBe(3);
    expect(finde(brett.container, WIEDERHOLEN)).toBeNull();
    expect(finde(brett.container, FEHLER)).toBeNull();
  });
});

describe("JOB 3112 · T6: Administratorweg — dieselbe Beständigkeit über Wiederholungen hinweg", () => {
  async function bisZweitemFehlschlag(): Promise<void> {
    nurStufeGeht("admin-validate");
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, '[data-testid="pruefen-menue-karte"]'));
    await klick(knopfMitText(brett.container, de("val.markTrue")));
    await klick(knopfMitText(brett.container, de("val.markTrueYes")));
    await klick(finde(brett.container, '[data-testid="pruefen-stufenfrage-wahl-intern"]'));
    await klick(finde(brett.container, WIEDERHOLEN));
  }

  it("die Meldung nennt die Stufe weiterhin, und es wird nicht erneut gefragt", async () => {
    await bisZweitemFehlschlag();

    const text = finde(brett.container, FEHLER)?.textContent ?? "";
    expect(text).toContain(de("conf.level.intern"));
    expect(text).not.toContain(de("val.stufenfrage.fehler"));
    expect(
      brett.container.querySelectorAll('[data-testid^="pruefen-stufenfrage-wahl-"]').length,
    ).toBe(0);
  });

  it("weitere Wiederholungen schicken ausschliesslich `admin-validate`", async () => {
    await bisZweitemFehlschlag();
    await klick(finde(brett.container, WIEDERHOLEN));

    expect(putFolge()).toEqual([
      { action: "confidentiality", level: "intern" },
      { action: "admin-validate" },
      { action: "admin-validate" },
      { action: "admin-validate" },
    ]);
    expect(brett.container.textContent).not.toContain(de("val.markTrueDone"));
  });
});
