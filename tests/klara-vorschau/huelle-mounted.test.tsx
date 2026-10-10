// @vitest-environment jsdom
// ================================================================================================
// KLARA-VORSCHAU (produkt:20261007:klara-vorschau) — Klara in der ECHTEN Hülle auf der ECHTEN
// Fragen-Seite, mit dem VORHANDENEN Tutorial.
// ================================================================================================
//
// Gemessen wird dieselbe Montage wie in FE-003 (`tests/fe003-tutorial-fragen/huelle.tsx`): AppShell,
// Ask, Netz auf `fetch`-Ebene. Klara ist über ihren Schalter eingeschaltet, wie nach dem Einstieg
// `/klara-vorschau`. jsdom hat kein Layout; wo der Zeiger ein sichtbares Element braucht, bekommen
// genau die Tutorial-Ziele eine Fläche (`mitLayout`). Das echte Layout, Ziehen mit Maus und Touch
// und die Breiten prüft `tests-smoke/klara-vorschau-browser.spec.ts`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "../../apps/web/node_modules/react";
import { setzeKlaraVorschauAktiv } from "../../apps/web/src/components/klara-vorschau/aktiv";
import { DEMO_ARTIKEL, artikelPfad } from "../../apps/web/src/components/klara-vorschau/artikel";
import {
  type Auswahl,
  aendere,
  leseZustand,
  zuruecksetzenGanz,
} from "../../apps/web/src/components/klara-vorschau/zustand";
import i18n from "../../apps/web/src/i18n";
import {
  type Montiert,
  alle,
  bis,
  echtesFeld,
  klick,
  medienStub,
  montiere,
  mutationen,
  netz,
  netzStub,
  q,
  taste,
  tippe,
  warte,
} from "../fe003-tutorial-fragen/huelle";

let m: Montiert | null = null;

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  zuruecksetzenGanz();
  setzeKlaraVorschauAktiv(true);
  // Klara 01 (produkt:20261008:klara-basis): der echte Betrieb ist jetzt der Anfang. Diese Datei
  // belegt die gelieferte Vorschau mit ihren vorgefertigten Antworten — also den Demo-Betrieb, den
  // die Person ausdrücklich wählt. Den echten Betrieb misst `tests/klara-basis/`.
  aendere((z) => ({ ...z, betrieb: "demo" }));
  netz.anfragen = [];
  netz.lage = { kiAktiv: true, rolle: "experte" };
  medienStub();
  vi.stubGlobal("fetch", vi.fn(netzStub));
  await i18n.changeLanguage("de");
});

afterEach(() => {
  m?.abbauen();
  m = null;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setzeKlaraVorschauAktiv(false);
  zuruecksetzenGanz();
});

const ROLLE = DEMO_ARTIKEL[0];

function artikelAuswahl(nr: number): Auswahl {
  const absatz = ROLLE?.absaetze.find((a) => a.nr === nr);
  return {
    id: `a-${nr}`,
    text: absatz?.text ?? "",
    herkunft: {
      pfad: artikelPfad(ROLLE?.id ?? ""),
      seite: "artikel",
      seitenName: "Artikel",
      objekt: `„${ROLLE?.titel ?? ""}“`,
      artikelId: ROLLE?.id ?? "",
      absatz: nr,
    },
  };
}

/** Gibt den Tutorial-Zielen (und nur ihnen) eine Fläche — jsdom misst sonst alles mit 0 × 0. */
function mitLayout(): void {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const flaeche =
      this.hasAttribute("data-tutorial-ziel") || this.hasAttribute("data-tutorial-demo");
    const w = flaeche ? 120 : 0;
    const h = flaeche ? 24 : 0;
    const rahmen = {
      x: 10,
      y: 10,
      left: 10,
      top: 10,
      right: 10 + w,
      bottom: 10 + h,
      width: w,
      height: h,
      toJSON: () => ({}),
    };
    return rahmen as DOMRect;
  });
}

async function figur(): Promise<HTMLButtonElement> {
  await bis(() => Boolean(q(document, "klara-figur")), 120);
  const f = q<HTMLButtonElement>(document, "klara-figur");
  if (!f) {
    throw new Error("Klara-Figur fehlt");
  }
  return f;
}

function huelle(): HTMLElement {
  const h = q(document, "klara-figur-huelle");
  if (!h) {
    throw new Error("Hülle der Figur fehlt");
  }
  return h;
}

async function oeffnen(): Promise<void> {
  await klick(await figur());
  await bis(() => Boolean(q(document, "klara-gespraech")));
}

function kapitelAktuell(): string | null {
  return (
    document
      .querySelector('[data-testid="tutorial-kapitel"][aria-current="step"]')
      ?.getAttribute("data-schritt") ?? null
  );
}

function abspielenGedrueckt(): string | null {
  return q(document, "tutorial-abspielen")?.getAttribute("aria-pressed") ?? null;
}

function letzteKlaraNachricht(): string {
  const n = alle(document, "klara-nachricht").filter((el) => el.dataset.von === "klara");
  return n[n.length - 1]?.textContent ?? "";
}

describe("K1/K3 · Klara ersetzt bei eingeschalteter Vorschau den Hilfeknopf", () => {
  it("die Figur trägt den Avatar über eine relative Adresse; der alte Hilfeknopf ist weg", async () => {
    m = await montiere("/fragen");
    const f = await figur();
    expect(f.querySelector("img")?.getAttribute("src")).toBe("/klara/klara-avatar-v1.png");
    expect(document.querySelector(`[aria-label="${i18n.t("klara.open")}"]`)).toBeNull();
  });

  // produkt:20261010:assistenz-produkteinstieg: ohne Schalter steht dieselbe Figur im
  // Produktbetrieb da — neben dem Hilfeknopf, ohne Demo-Betrieb. Den Produktweg misst
  // `tests/klara-produkt/produkteinstieg-am-server.test.tsx`.
  it("ohne Schalter: Produktbetrieb neben dem Hilfeknopf, kein Demo", async () => {
    setzeKlaraVorschauAktiv(false);
    m = await montiere("/fragen");
    const f = await figur();
    expect(f.dataset.betriebsart).toBe("produkt");
    expect(f.dataset.betrieb).toBe("echt");
    expect(q(document, "klara-figur-demo")).toBeNull();
    expect(document.querySelector(`[aria-label="${i18n.t("klara.open")}"]`)).not.toBeNull();
  });
});

describe("K2/K3 · Tastatur, Öffnen, Schliessen, Verkleinern, Fokus", () => {
  it("Pfeiltasten verschieben, Pos1 setzt zurück — ohne das Gespräch zu öffnen", async () => {
    m = await montiere("/fragen");
    const f = await figur();
    const start = { left: huelle().style.left, top: huelle().style.top };
    await taste(f, "ArrowLeft");
    await taste(f, "ArrowUp");
    expect(Number.parseFloat(huelle().style.left)).toBe(Number.parseFloat(start.left) - 16);
    expect(Number.parseFloat(huelle().style.top)).toBe(Number.parseFloat(start.top) - 16);
    expect(q(document, "klara-gespraech")).toBeNull();
    await act(async () => {
      f.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", shiftKey: true, bubbles: true }),
      );
    });
    expect(Number.parseFloat(huelle().style.left)).toBe(Number.parseFloat(start.left) - 80);
    await taste(f, "Home");
    expect({ left: huelle().style.left, top: huelle().style.top }).toEqual(start);
    expect(q(document, "klara-ansage")?.textContent).toBe("Klara ist zurück an ihrem Startplatz.");
  });

  it("Klick öffnet, Escape schliesst, Verkleinern und Wiederöffnen — der Fokus kehrt zurück", async () => {
    m = await montiere("/fragen");
    await oeffnen();
    const f = await figur();
    expect(f.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement?.textContent).toBe("Klara");

    await taste(q(document, "klara-gespraech") as HTMLElement, "Escape");
    expect(q(document, "klara-gespraech")).toBeNull();
    await bis(() => document.activeElement === f);
    expect(document.activeElement).toBe(f);

    await oeffnen();
    await klick(q(document, "klara-minimieren"));
    expect(q(document, "klara-gespraech")).toBeNull();
    expect((await figur()).dataset.minimiert).toBe("true");
    await bis(() => document.activeElement === q(document, "klara-figur"));
    expect(document.activeElement).toBe(q(document, "klara-figur"));

    await oeffnen();
    expect((await figur()).dataset.minimiert).toBe("false");
    await klick(q(document, "klara-ansicht"));
    expect(q(document, "klara-gespraech")?.dataset.ansicht).toBe("seitlich");
    await klick(q(document, "klara-schliessen"));
    expect(q(document, "klara-gespraech")).toBeNull();
  });
});

describe("K4/K5 · Seite, Objekt und die Herkunft eines Ausschnitts", () => {
  it("auf Fragen: Seite und Frage aus dem echten Feld; der Artikel-Ausschnitt bleibt dem Artikel zugeordnet", async () => {
    aendere((z) => ({ ...z, auswahl: artikelAuswahl(2) }));
    m = await montiere("/fragen");
    await oeffnen();
    expect(q(document, "klara-ort-seite")?.textContent).toBe("Fragen");
    expect(q(document, "klara-ort-objekt")?.textContent).toBe("Noch keine Frage eingegeben");

    await tippe(echtesFeld(document), "Wie lange dauert der Testlauf?");
    await bis(() => (q(document, "klara-ort-objekt")?.textContent ?? "").includes("Testlauf"));
    expect(q(document, "klara-ort-objekt")?.textContent).toBe(
      "Frage „Wie lange dauert der Testlauf?“",
    );

    const herkunft = q(document, "klara-auswahl-herkunft")?.textContent ?? "";
    expect(herkunft).toContain("Artikel");
    expect(herkunft).toContain(ROLLE?.titel ?? "—");
    expect(herkunft).toContain("Absatz 2");
    expect(q(document, "klara-auswahl-andere-seite")).not.toBeNull();
  });
});

describe("K6/K9 · Status und bewusste Übernahme", () => {
  it("läuft → Antwort bereit → Entscheidung nötig; der Artikel ändert sich erst bei Übernahme", async () => {
    aendere((z) => ({ ...z, auswahl: artikelAuswahl(1) }));
    m = await montiere("/fragen");
    await oeffnen();

    await klick(q(document, "klara-aktion-erklaeren"));
    expect((await figur()).dataset.status).toBe("laeuft");
    expect(q(document, "klara-status-text")?.textContent).toBe("Anfrage läuft …");
    await warte(800);
    expect((await figur()).dataset.status).toBe("antwort");
    expect(q(document, "klara-status-text")?.textContent).toBe("Antwort bereit");
    expect(letzteKlaraNachricht()).toContain("Demo-Antwort · vorgefertigt");

    await klick(q(document, "klara-aktion-umformulieren"));
    await warte(800);
    expect((await figur()).dataset.status).toBe("entscheidung");
    expect(q(document, "klara-status-text")?.textContent).toBe("Entscheidung nötig");
    expect(q(document, "klara-vorschlag-original")?.textContent).toBe(ROLLE?.absaetze[0]?.text);
    expect(leseZustand().artikelText).toEqual({});

    await klick(q(document, "klara-vorschlag-verwerfen"));
    expect(leseZustand().artikelText).toEqual({});
    expect(q(document, "klara-vorschlag-ergebnis")?.textContent).toContain("unverändert");

    await klick(q(document, "klara-aktion-umformulieren"));
    await warte(800);
    const offen = alle(document, "klara-vorschlag").filter((v) => v.dataset.status === "offen");
    await klick(offen[0]?.querySelector('[data-testid="klara-vorschlag-uebernehmen"]'));
    expect(leseZustand().artikelText).toEqual({
      [`${ROLLE?.id}#1`]: ROLLE?.absaetze[0]?.umformulierung,
    });
    expect((await figur()).dataset.status).toBe("antwort");
  });
});

describe("K7 · Tutorial „Fragen“ mit Klara", () => {
  it("Begleiten zeigt das echte Bedienelement; Zwischenfrage hält am selben Schritt; Fortsetzen, Zurück; Fehlziel wird erklärt", async () => {
    mitLayout();
    m = await montiere("/fragen");
    await oeffnen();
    const ab = netz.anfragen.length;
    await klick(q(document, "klara-modus-begleite"));
    await bis(() => Boolean(q(document, "tutorial-bereich") && q(document, "klara-tutorial")));
    expect(q(document, "klara-tutorial-schritt")?.textContent).toContain("Schritt 1 von 7");

    // Der Zeiger steht auf dem ECHTEN Fragefeld der Seite, nicht auf dem der Demo.
    await bis(() => q(document, "klara-zeiger")?.dataset.ort === "echt");
    expect(q(document, "klara-zeiger")?.dataset.ort).toBe("echt");
    expect(q(document, "klara-tutorial-zeigt")?.textContent).toContain("auf der echten Seite");

    await klick(q(document, "klara-tutorial-weiter"));
    expect(kapitelAktuell()).toBe("formulieren");
    expect(abspielenGedrueckt()).toBe("true");

    // Zwischenfrage: das Tutorial hält, und zwar an GENAU diesem Schritt.
    const eingabe = q<HTMLInputElement>(document, "klara-eingabe");
    if (!eingabe) {
      throw new Error("Eingabe an Klara fehlt");
    }
    await tippe(eingabe, "Was heisst Kontext?");
    await klick(q(document, "klara-senden"));
    expect(abspielenGedrueckt()).toBe("false");
    expect(kapitelAktuell()).toBe("formulieren");
    expect(q(document, "klara-tutorial-hinweis")?.textContent).toContain("Pausiert bei Schritt 2");
    await warte(800);
    expect(letzteKlaraNachricht()).toContain("Zwischenfrage zu Schritt 2");
    expect(kapitelAktuell()).toBe("formulieren");

    // Fortsetzen am selben Schritt.
    await klick(q(document, "klara-tutorial-fortsetzen"));
    expect(abspielenGedrueckt()).toBe("true");
    expect(kapitelAktuell()).toBe("formulieren");

    // Zurück.
    await klick(q(document, "klara-tutorial-zurueck"));
    expect(kapitelAktuell()).toBe("verstehen");

    // Fehlziel: im Schritt „Antwort“ gibt es auf der echten Seite noch keine Antwort.
    for (let i = 0; i < 3; i++) {
      await klick(q(document, "klara-tutorial-weiter"));
    }
    expect(kapitelAktuell()).toBe("antwort");
    await bis(() => Boolean(q(document, "klara-tutorial-fehlziel")));
    const fehlziel = q(document, "klara-tutorial-fehlziel");
    expect(fehlziel?.dataset.art).toBe("demo");
    expect(fehlziel?.textContent).toContain("auf der echten Seite gerade nicht zu sehen");
    expect(q(document, "klara-zeiger")?.dataset.ort).toBe("demo");

    // Nichts davon hat den Server verändert.
    expect(mutationen(ab)).toEqual([]);
  });

  it("ohne sichtbares Ziel sagt Klara das in Worten, statt ins Leere zu zeigen", async () => {
    m = await montiere("/fragen");
    await oeffnen();
    await klick(q(document, "klara-modus-zeige"));
    await bis(() => Boolean(q(document, "klara-tutorial")));
    expect(q(document, "klara-zeiger")).toBeNull();
    expect(q(document, "klara-tutorial-fehlziel")?.dataset.art).toBe("ganz");
    await warte(800);
    expect(letzteKlaraNachricht()).toContain("weder auf der Seite noch in der Demo");
  });
});

describe("K8 · Notizentwurf mit Rücklink — Speicherung, Erinnerung und Termin als Demo", () => {
  it("zeigt Inhalt und Artikelrücklink, kennzeichnet alles als Demo und schickt nichts an den Server", async () => {
    aendere((z) => ({ ...z, auswahl: artikelAuswahl(2) }));
    m = await montiere("/fragen");
    await oeffnen();
    const ab = netz.anfragen.length;
    await klick(q(document, "klara-aktion-notiz"));
    await warte(800);
    const entwurf = q(document, "klara-entwurf");
    expect(entwurf).not.toBeNull();
    expect(q<HTMLTextAreaElement>(document, "klara-entwurf-inhalt")?.value).toBe(
      ROLLE?.absaetze[1]?.zusammenfassung,
    );
    const ruecklink = q<HTMLAnchorElement>(document, "klara-entwurf-ruecklink");
    expect(ruecklink?.getAttribute("href")).toBe(`${artikelPfad(ROLLE?.id ?? "")}#absatz-2`);
    expect(ruecklink?.textContent).toContain("Absatz 2");
    expect(entwurf?.textContent).toContain("Erinnerung");
    expect(entwurf?.textContent).toContain("Termin");
    expect((entwurf?.textContent ?? "").match(/Demo/g)?.length ?? 0).toBeGreaterThanOrEqual(3);

    await klick(q(document, "klara-entwurf-art-aufgabe"));
    expect(entwurf?.dataset.art).toBe("aufgabe");
    await klick(q(document, "klara-entwurf-speichern"));
    expect(q(document, "klara-entwurf-gespeichert")?.textContent).toContain("Demo-Speicherung");
    expect(letzteKlaraNachricht()).toContain("Demo-Antwort · vorgefertigt");
    expect(mutationen(ab)).toEqual([]);
  });
});
