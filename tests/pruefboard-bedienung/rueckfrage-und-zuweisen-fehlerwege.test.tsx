// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · PRÜFBOARD-BEDIENUNG — Rückfrage/Ablehnung und Zuweisen am Fehlerweg.
// ================================================================================================
//
// R1 · TEILERFOLG DER RÜCKFRAGE. Rückfrage und Ablehnung sind zwei Aufrufe: erst die Begründung
//      (`comment`), dann die Bewertung (`rate`). Scheitert nur die Bewertung, liegt die Begründung
//      am Server. Bisher meldete die Fläche dann „Konnte nicht gespeichert werden", und der zweite
//      Versuch schrieb dieselbe Begründung ein zweites Mal. Jetzt: eigener Satz, und die
//      Wiederholung schickt ausschliesslich die Bewertung.
// R2 · SCHEITERT SCHON DIE BEGRÜNDUNG, bleibt es bei der alten, wahren Meldung — und die
//      Wiederholung schickt beides.
// Z1 · ZUWEISEN meldet Erfolg und Fehler. Bisher blieb ein Fehlschlag ohne jede Meldung.
// Z2 · DIE ZUSTÄNDIGKEIT HAT EINEN NAMEN: die offen Zugewiesenen stehen im „Mehr", und eine schon
//      zugewiesene Person ist im Auswahlfeld nicht ein zweites Mal wählbar.
//
// Gemockt ist der Endpunkt, nicht der Haken — dieselbe Kulisse wie `tests/validierung-stufe/`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stand = vi.hoisted(() => ({
  rolle: "controller",
  toasts: [] as Array<{ art: string; text: string }>,
}));
vi.mock("../../apps/web/src/api/endpoints", async () =>
  (await import("../validierung-stufe/kulisse-mocks")).endpunktMock(),
);
vi.mock("../../apps/web/src/app/AuthContext", async (o) =>
  (await import("../validierung-stufe/kulisse-mocks")).authMock(o as never),
);
vi.mock("../../apps/web/src/app/RoleContext", async (o) =>
  (await import("../validierung-stufe/kulisse-mocks")).rolleMock(o as never, stand),
);
// Die Meldungen werden MITGESCHRIEBEN statt verschluckt — sie sind hier der Gegenstand.
vi.mock("../../apps/web/src/app/ToastContext", async (o) => ({
  ...((await (o as () => Promise<Record<string, unknown>>)()) as Record<string, unknown>),
  useToast: () => ({
    push: (art: string, text: string) => stand.toasts.push({ art, text }),
  }),
}));

import { act } from "../../apps/web/node_modules/react";
import { ApiError } from "../../apps/web/src/api/client";
import { endpoints } from "../../apps/web/src/api/endpoints";
import type { KoAction } from "../../apps/web/src/api/endpoints";
import i18n from "../../apps/web/src/i18n";
import {
  type Brett,
  de,
  finde,
  flush,
  klick,
  knopfMitText,
  mounteBrett,
  putFolge,
  zeile,
} from "../validierung-stufe/kulisse";

type Fn = ReturnType<typeof vi.fn>;
let brett: Brett;

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  stand.toasts.length = 0;
  // `clearAllMocks` behält eine gesetzte Implementierung — ohne diese Zeile erbte ein Fall die
  // Fehlerantwort seines Vorgängers.
  antworten(() => undefined);
});
afterEach(() => brett?.abbauen());

const RUECKFRAGE = '[data-testid="pruefen-entscheidung-warn"]';
const ABLEHNEN = '[data-testid="pruefen-entscheidung-down"]';
const TEILERFOLG = '[data-testid="pruefen-begruendung-teilerfolg"]';
const FEHLER = '[data-testid="pruefen-begruendung-fehler"]';

function antworten(regel: (body: KoAction) => void): void {
  (endpoints.ko.act as unknown as Fn).mockImplementation((async (_id: string, body: KoAction) => {
    regel(body);
    return {};
  }) as never);
}

async function tippen(c: HTMLElement, text: string): Promise<void> {
  const feld = finde(c, '[data-testid="pruefen-begruendung"] textarea') as HTMLTextAreaElement;
  expect(feld, "das Begründungsfeld fehlt").toBeTruthy();
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await flush();
}

async function waehlen(sel: HTMLSelectElement, wert: string): Promise<void> {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    setter?.call(sel, wert);
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flush();
}

function zuweisenFeld(c: HTMLElement): HTMLSelectElement {
  const sel = finde(c, `select[aria-label="${de("val.assign")}"]`) as HTMLSelectElement | null;
  expect(sel, "das Zuweisen-Feld fehlt im ···-Menü").toBeTruthy();
  return sel as HTMLSelectElement;
}

describe("R1 · Begründung gespeichert, Bewertung gescheitert", () => {
  it("sagt den Teilerfolg statt „nicht gespeichert“ und zeigt keine Quittung", async () => {
    antworten((b) => {
      if (b.action === "rate") throw new ApiError(500, "server_error", "kaputt");
    });
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, RUECKFRAGE));
    await tippen(brett.container, "Quelle fehlt");
    await klick(knopfMitText(brett.container, de("val.feedback.submit")));

    expect(putFolge().map((p) => p.action)).toEqual(["comment", "rate"]);
    expect(finde(brett.container, TEILERFOLG)?.textContent).toBe(
      de("pruefboard.begruendungGespeichert"),
    );
    expect(finde(brett.container, FEHLER)).toBeNull();
    expect(finde(brett.container, '[data-testid="pruefen-quittung"]')).toBeNull();
  });

  it("die Wiederholung schickt NUR die Bewertung — keine zweite Begründung", async () => {
    antworten((b) => {
      if (b.action === "rate") throw new ApiError(500, "server_error", "kaputt");
    });
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, ABLEHNEN));
    await tippen(brett.container, "Widerspricht der Norm");
    await klick(knopfMitText(brett.container, de("val.feedback.submit")));

    antworten(() => undefined);
    await klick(knopfMitText(brett.container, de("pruefboard.bewertungSenden")));

    expect(putFolge()).toEqual([
      { action: "comment", text: "Validierungsfeedback (Ablehnung): Widerspricht der Norm" },
      { action: "rate", verdict: "down" },
      { action: "rate", verdict: "down" },
    ]);
    expect(finde(brett.container, '[data-testid="pruefen-quittung"]')).not.toBeNull();
  });

  it("Abbrechen und erneut öffnen vergisst die gespeicherte Begründung nicht", async () => {
    antworten((b) => {
      if (b.action === "rate") throw new ApiError(500, "server_error", "kaputt");
    });
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, RUECKFRAGE));
    await tippen(brett.container, "Quelle fehlt");
    await klick(knopfMitText(brett.container, de("val.feedback.submit")));
    await klick(knopfMitText(brett.container, de("val.feedback.cancel")));
    await klick(finde(brett.container, RUECKFRAGE));

    const feld = finde(
      brett.container,
      '[data-testid="pruefen-begruendung"] textarea',
    ) as HTMLTextAreaElement;
    expect(feld.value).toBe("Quelle fehlt");
    expect(feld.readOnly).toBe(true);
    expect(finde(brett.container, TEILERFOLG)).not.toBeNull();

    antworten(() => undefined);
    await klick(knopfMitText(brett.container, de("pruefboard.bewertungSenden")));
    expect(putFolge().filter((p) => p.action === "comment")).toHaveLength(1);
  });
});

// RUNDE 2 · BENS BEFUND B1: Runde 1 hielt EINEN Vorgang für die ganze Seite. Der Teilerfolg auf B
// verdrängte den von A, und A schrieb ihre Begründung danach doppelt. Die Fälle oben sahen das nicht,
// weil in ihnen nie zwei Vorgänge gleichzeitig offen waren.
describe("R3 · unterbrochene Rückfragen über mehrere Karten", () => {
  const eintraege = () =>
    brett.container.querySelectorAll('[data-testid="pruefen-warteschlange-eintrag"]');
  const feld = () =>
    finde(brett.container, '[data-testid="pruefen-begruendung"] textarea') as HTMLTextAreaElement;

  async function teilerfolg(index: number, text: string): Promise<void> {
    await klick(eintraege()[index]);
    await klick(finde(brett.container, RUECKFRAGE));
    await tippen(brett.container, text);
    await klick(knopfMitText(brett.container, de("val.feedback.submit")));
    expect(finde(brett.container, TEILERFOLG)).not.toBeNull();
    await klick(knopfMitText(brett.container, de("val.feedback.cancel")));
  }

  function kommentare(id: string): unknown[] {
    return (endpoints.ko.act as unknown as Fn).mock.calls.filter(
      ([kid, body]) => kid === id && (body as KoAction).action === "comment",
    );
  }

  it("der Teilerfolg auf B verdrängt den von A nicht — A wiederholt nur die Bewertung", async () => {
    antworten((b) => {
      if (b.action === "rate") throw new ApiError(500, "server_error", "kaputt");
    });
    brett = await mounteBrett({
      zeilen: [zeile({ id: "k1", title: "Karte A" }), zeile({ id: "k2", title: "Karte B" })],
    });
    await teilerfolg(0, "Quelle A fehlt");
    await teilerfolg(1, "Quelle B fehlt");

    await klick(eintraege()[0]);
    await klick(finde(brett.container, RUECKFRAGE));
    expect(feld().value).toBe("Quelle A fehlt");
    expect(feld().readOnly).toBe(true);
    expect(finde(brett.container, TEILERFOLG)).not.toBeNull();

    antworten(() => undefined);
    await klick(knopfMitText(brett.container, de("pruefboard.bewertungSenden")));
    expect(kommentare("k1")).toHaveLength(1);
  });

  it("der Abschluss von A lässt den offenen Vorgang von B stehen", async () => {
    antworten((b) => {
      if (b.action === "rate") throw new ApiError(500, "server_error", "kaputt");
    });
    brett = await mounteBrett({
      zeilen: [zeile({ id: "k1", title: "Karte A" }), zeile({ id: "k2", title: "Karte B" })],
    });
    await teilerfolg(0, "Quelle A fehlt");
    await teilerfolg(1, "Quelle B fehlt");

    antworten(() => undefined);
    await klick(eintraege()[0]);
    await klick(finde(brett.container, RUECKFRAGE));
    await klick(knopfMitText(brett.container, de("pruefboard.bewertungSenden")));

    await klick(eintraege()[1]);
    await klick(finde(brett.container, RUECKFRAGE));
    expect(feld().value).toBe("Quelle B fehlt");
    expect(feld().readOnly).toBe(true);
    await klick(knopfMitText(brett.container, de("pruefboard.bewertungSenden")));
    expect(kommentare("k2")).toHaveLength(1);
  });
});

// R-0238 · DIE WIDERSPRECHENDE ABLEHNUNG an der Fläche. Der Serverweg samt Gegenfällen steht in
// `tests/validation/rework-flow-e2e.test.ts`; hier wird gemessen, dass die Fläche ihn bedient.
describe("W1 · Ablehnung mit Widerspruch", () => {
  const SUCHE = '[data-testid="pruefen-widerspruch-suche"]';
  async function tippeSuche(text: string): Promise<void> {
    const feld = finde(brett.container, SUCHE) as HTMLInputElement | null;
    expect(feld, "das Suchfeld des Widerspruchs fehlt").toBeTruthy();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(feld, text);
      feld?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await flush();
    await flush();
  }

  it("Gegenüber gesucht, Art gewählt → die Bewertung trägt den Widerspruch", async () => {
    (endpoints.library.search as unknown as Fn).mockResolvedValue([
      zeile({ id: "k1", title: "Selbst" }),
      zeile({ id: "k9", title: "Presse 8 bar" }),
    ] as never);
    brett = await mounteBrett({ zeilen: [zeile({ id: "k1", title: "Selbst" })] });
    await klick(finde(brett.container, ABLEHNEN));
    await tippen(brett.container, "Widerspricht dem 8-bar-Eintrag");
    await tippeSuche("Presse");

    // Das Objekt selbst steht nie in den Treffern.
    const treffer = [
      ...brett.container.querySelectorAll('[data-testid="pruefen-widerspruch-treffer"]'),
    ];
    expect(treffer.map((x) => x.textContent)).toEqual(["Presse 8 bar"]);
    await klick(treffer[0]);

    // Ohne Art bleibt „Absenden" gesperrt — die Art wird nicht geraten.
    const absenden = knopfMitText(brett.container, de("val.feedback.submit")) as HTMLButtonElement;
    expect(absenden.disabled).toBe(true);
    await waehlen(
      finde(brett.container, '[data-testid="pruefen-widerspruch-art"]') as HTMLSelectElement,
      "truth",
    );
    expect(absenden.disabled).toBe(false);
    await klick(absenden);

    expect(putFolge()).toEqual([
      {
        action: "comment",
        text: "Validierungsfeedback (Ablehnung): Widerspricht dem 8-bar-Eintrag",
      },
      {
        action: "rate",
        verdict: "down",
        widerspruch: { koB: "k9", type: "truth", description: "Widerspricht dem 8-bar-Eintrag" },
      },
    ]);
  });

  /** Ablehnung mit gewähltem Gegenüber „Presse 8 bar“ und Art „truth“ absenden. */
  async function ablehnenMitWiderspruch(): Promise<void> {
    (endpoints.library.search as unknown as Fn).mockResolvedValue([
      zeile({ id: "k9", title: "Presse 8 bar" }),
    ] as never);
    brett = await mounteBrett({ zeilen: [zeile({ id: "k1", title: "Selbst" })] });
    await klick(finde(brett.container, ABLEHNEN));
    await tippen(brett.container, "Widerspricht dem 8-bar-Eintrag");
    await tippeSuche("Presse");
    await klick(finde(brett.container, '[data-testid="pruefen-widerspruch-treffer"]'));
    await waehlen(
      finde(brett.container, '[data-testid="pruefen-widerspruch-art"]') as HTMLSelectElement,
      "truth",
    );
    await klick(knopfMitText(brett.container, de("val.feedback.submit")));
  }

  const WIDERSPRUCH = {
    koB: "k9",
    type: "truth",
    description: "Widerspricht dem 8-bar-Eintrag",
  };
  const letzte = () => {
    const folge = putFolge();
    return folge[folge.length - 1];
  };

  // Nacharbeit 7 (Ben): Begründung gespeichert, Bewertung gescheitert, Abbrechen, Wiederöffnen —
  // Gegenüber und Art kehren mit der Begründung zurück, und die Wiederholung trägt sie.
  it("Teilerfolg, Abbrechen, Wiederöffnen: der gewählte Widerspruch bleibt und wird wieder geschickt", async () => {
    antworten((b) => {
      if (b.action === "rate") throw new ApiError(500, "server_error", "kaputt");
    });
    await ablehnenMitWiderspruch();
    expect(finde(brett.container, TEILERFOLG)?.textContent).toBe(
      de("pruefboard.begruendungGespeichert"),
    );
    await klick(knopfMitText(brett.container, de("val.feedback.cancel")));
    await klick(finde(brett.container, ABLEHNEN));

    const ziel = finde(brett.container, '[data-testid="pruefen-widerspruch-ziel"]');
    expect(ziel?.textContent).toBe("Presse 8 bar");
    const art = finde(brett.container, '[data-testid="pruefen-widerspruch-art"]');
    expect((art as HTMLSelectElement | null)?.value).toBe("truth");

    antworten(() => undefined);
    await klick(knopfMitText(brett.container, de("pruefboard.bewertungSenden")));
    expect(putFolge().filter((p) => p.action === "comment")).toHaveLength(1);
    expect(letzte()).toEqual({
      action: "rate",
      verdict: "down",
      widerspruch: WIDERSPRUCH,
    });
  });

  // Nacharbeit 7/8 (Ben): die Ablehnung steht, nur der Konfliktvorschlag nicht — die Fläche sagt
  // genau das (nicht „Bewertung nicht gespeichert“) und setzt NUR den Vorschlag fort: die
  // Wiederholung trägt `fortsetzungFuerFassung` der abgelehnten Fassung und bewertet nicht neu.
  it("Server meldet KONFLIKTVORSCHLAG_OFFEN: eigener Satz, eigener Knopf, Fortsetzung an die Fassung gebunden", async () => {
    antworten((b) => {
      if (b.action === "rate") {
        throw new ApiError(500, "KONFLIKTVORSCHLAG_OFFEN", "Vorschlag fehlt.", {
          bewerteteFassung: 1,
        });
      }
    });
    await ablehnenMitWiderspruch();
    expect(finde(brett.container, TEILERFOLG)?.textContent).toBe(
      de("pruefboard.konfliktvorschlagOffen"),
    );

    antworten(() => undefined);
    await klick(knopfMitText(brett.container, de("pruefboard.konfliktvorschlagSenden")));
    expect(putFolge().filter((p) => p.action === "comment")).toHaveLength(1);
    expect(letzte()).toEqual({
      action: "rate",
      verdict: "down",
      widerspruch: WIDERSPRUCH,
      fortsetzungFuerFassung: 1,
    });
  });

  // Nacharbeit 8 (Ben): der Vorschlag STEHT schon, nur seine Folge fehlt — die Fläche sagt nicht
  // „Konfliktvorschlag nicht gespeichert“, sondern nennt den tatsächlich offenen Folgeschritt.
  it("Server meldet KONFLIKTFOLGE_OFFEN: der Vorschlag steht, genannt wird nur der offene Folgeschritt", async () => {
    antworten((b) => {
      if (b.action === "rate") {
        throw new ApiError(500, "KONFLIKTFOLGE_OFFEN", "Folge fehlt.", {
          bewerteteFassung: 1,
          konfliktAngelegt: true,
          konfliktId: "c1",
        });
      }
    });
    await ablehnenMitWiderspruch();
    const satz = finde(brett.container, TEILERFOLG)?.textContent;
    expect(satz).toBe(de("pruefboard.konfliktfolgeOffen"));
    expect(satz).not.toBe(de("pruefboard.konfliktvorschlagOffen"));

    antworten(() => undefined);
    await klick(knopfMitText(brett.container, de("pruefboard.konfliktfolgeSenden")));
    expect(putFolge().filter((p) => p.action === "comment")).toHaveLength(1);
    expect(letzte()).toEqual({
      action: "rate",
      verdict: "down",
      widerspruch: WIDERSPRUCH,
      fortsetzungFuerFassung: 1,
    });
  });

  // Nacharbeit 8 (Ben): zwischen Teilerfolg und Fortsetzung wurde überarbeitet — der Server weist
  // ab (nichts bewertet, nichts angelegt), und die Fläche sagt es; der alte Vorgang ist beendet.
  it("Fortsetzung nach Überarbeitung: 409 FASSUNG_UEBERARBEITET wird gesagt, der Vorgang endet", async () => {
    antworten((b) => {
      if (b.action === "rate") {
        throw new ApiError(500, "KONFLIKTVORSCHLAG_OFFEN", "Vorschlag fehlt.", {
          bewerteteFassung: 1,
        });
      }
    });
    await ablehnenMitWiderspruch();
    antworten((b) => {
      if (b.action === "rate") {
        throw new ApiError(409, "FASSUNG_UEBERARBEITET", "überarbeitet", { currentVersion: 2 });
      }
    });
    await klick(knopfMitText(brett.container, de("pruefboard.konfliktvorschlagSenden")));

    expect(
      finde(brett.container, '[data-testid="pruefen-begruendung-ueberarbeitet"]')?.textContent,
    ).toBe(de("pruefboard.fassungUeberarbeitet"));
    expect(finde(brett.container, TEILERFOLG)).toBeNull();
    // Kein Kommentar wurde ein zweites Mal geschrieben.
    expect(putFolge().filter((p) => p.action === "comment")).toHaveLength(1);
  });

  it("ohne Gegenüber bleibt die Ablehnung, wie sie war; die Rückfrage kennt keinen Widerspruch", async () => {
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, RUECKFRAGE));
    expect(finde(brett.container, '[data-testid="pruefen-widerspruch"]')).toBeNull();
    await klick(knopfMitText(brett.container, de("val.feedback.cancel")));

    await klick(finde(brett.container, ABLEHNEN));
    expect(finde(brett.container, '[data-testid="pruefen-widerspruch"]')).not.toBeNull();
    await tippen(brett.container, "Quelle fehlt");
    await klick(knopfMitText(brett.container, de("val.feedback.submit")));
    expect(putFolge()[1]).toEqual({ action: "rate", verdict: "down" });
    expect(endpoints.library.search as unknown as Fn).not.toHaveBeenCalled();
  });
});

describe("R2 · scheitert schon die Begründung, wird nichts als gespeichert gemeldet", () => {
  it("alte Meldung, kein Teilerfolg, und die Wiederholung schickt beides", async () => {
    antworten((b) => {
      if (b.action === "comment") throw new ApiError(500, "server_error", "kaputt");
    });
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, RUECKFRAGE));
    await tippen(brett.container, "Quelle fehlt");
    await klick(knopfMitText(brett.container, de("val.feedback.submit")));

    expect(putFolge().map((p) => p.action)).toEqual(["comment"]);
    expect(finde(brett.container, FEHLER)?.textContent).toBe(de("val.feedback.error"));
    expect(finde(brett.container, TEILERFOLG)).toBeNull();

    antworten(() => undefined);
    await klick(knopfMitText(brett.container, de("val.feedback.submit")));
    expect(putFolge().map((p) => p.action)).toEqual(["comment", "comment", "rate"]);
  });
});

describe("Z1 · Zuweisen meldet sich", () => {
  it("Fehlschlag: eine Fehlermeldung mit dem Servertext", async () => {
    antworten((b) => {
      if (b.action === "assign") throw new ApiError(403, "forbidden", "Keine Berechtigung.");
    });
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, '[data-testid="pruefen-menue-karte"]'));
    await waehlen(zuweisenFeld(brett.container), "u1");

    expect(putFolge()).toEqual([{ action: "assign", userIds: ["u1"] }]);
    expect(stand.toasts).toEqual([
      {
        art: "error",
        text: i18n.t("pruefboard.zuweisenFehler", { grund: "Keine Berechtigung." }),
      },
    ]);
  });

  it("Erfolg: eine Bestätigung mit dem Namen", async () => {
    brett = await mounteBrett({ zeilen: [zeile()] });
    await klick(finde(brett.container, '[data-testid="pruefen-menue-karte"]'));
    await waehlen(zuweisenFeld(brett.container), "u1");

    expect(stand.toasts).toEqual([
      { art: "success", text: i18n.t("pruefboard.zuweisenErfolg", { name: "Prüfer" }) },
    ]);
  });
});

describe("Z2 · die Zuständigkeit hat einen Namen", () => {
  it("offen Zugewiesene stehen im „Mehr“ und sind nicht ein zweites Mal wählbar", async () => {
    brett = await mounteBrett({ zeilen: [zeile({ assignments: ["u1"] })] });

    expect(finde(brett.container, '[data-testid="pruefen-zugewiesen-an"]')?.textContent).toBe(
      "Prüfer",
    );
    await klick(finde(brett.container, '[data-testid="pruefen-menue-karte"]'));
    const option = zuweisenFeld(brett.container).querySelector(
      'option[value="u1"]',
    ) as HTMLOptionElement;
    expect(option.disabled).toBe(true);
    expect(option.textContent).toBe(i18n.t("pruefboard.bereitsZugewiesen", { name: "Prüfer" }));
  });

  it("ohne offene Zuweisung entsteht keine Zeile", async () => {
    brett = await mounteBrett({ zeilen: [zeile()] });
    expect(finde(brett.container, '[data-testid="pruefen-zugewiesen-an"]')).toBeNull();
  });
});
