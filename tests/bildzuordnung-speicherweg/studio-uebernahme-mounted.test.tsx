// @vitest-environment jsdom
// ================================================================================================
// JOB 3083 · Q5 — DIE ZUORDNUNG ÜBERLEBT DEN ECHTEN SPEICHERWEG: STUDIO → ÜBERNAHME → RUMPF
// ================================================================================================
//
// WARUM DIESE DATEI UND NICHT `tests/fussnote-zuordnen`: die drei Tests dort messen bis zum
// `onChange` DES EDITORS, in dem der Autor geklickt hat. Genau das reichte nicht. Codex' Befund
// R-1619 (05.09.2026, `app.klarwerk.ai` 1.0.0-beta.1.92, Rolle Administrator) lautet wörtlich:
// „Innerer Studio-Editor enthält korrekt beschriftetes Bild; gespeichertes bodyHtml enthält leere
// Bildcaption und weiterhin externe figcaption mit alter Kennung." Gemessen wird hier deshalb
// ausschließlich die Fassung, die beim VERBRAUCHER ankommt und gespeichert würde — nie das DOM
// eines Editors.
//
// DER AUFBAU IST DER ECHTE VERBRAUCHER, nachgebaut aus `BibliothekLesen.tsx:779-808` (JOB 3084
// hält die Datei; sie wird hier nicht angefasst, nur ihre Verdrahtung nachgestellt): EIN Zustand
// `bodyHtml`, daran hängen ZWEI Dinge GLEICHZEITIG — das Studio (`bodyHtml` + `onApply`) und der
// äußere `RichTextEditor` (`value` + `onChange`). Diese Verschachtelung IST der Fehlerort; ein
// Studio ohne den äußeren Editor daneben wäre ein anderer Weg als der des Autors.
//
// ── DIE VERLUSTSTELLE, an den Abnahmebelegen bewiesen (Lieferpunkt 1) ───────────────────────────
//
// `laeufe/R-1619-zugeordnet-03/zugeordnet-editor.txt` ist EINE Aufnahme unmittelbar nach der
// Zuordnung, und sie zeigt BEIDE Editoren untereinander:
//   · der Editor IM Studio (zwischen der Überschrift „Knowledge Studio" und dem Knopf „In den
//     Entwurf übernehmen"): noch „✎ Bildbeschreibung hinzufügen …" PLUS die verwaiste Beschreibung
//     daneben — also der ALTE Stand;
//   · der Editor DARUNTER (der äußere): die Zuordnung fertig, die Beschreibung sitzt am Bild.
// Einen Klick später steht in `vor-revision.txt` wieder der alte Stand, und genau der wird
// gespeichert (`gespeichertes-objekt.json`).
//
// Die Ursache ist damit benannt und liegt NICHT am Zuordnungsweg: `KnowledgeInputStudio` zog den
// Entwurf ausschließlich BEIM ÖFFNEN aus dem Rumpf (`useEffect(…, [open])`, Kommentar „bewusst nur
// beim Öffnen synchronisieren"). Jede Änderung, die den Rumpf erreichte, während das Studio offen
// stand, war dem Entwurf unbekannt — und „In den Entwurf übernehmen" schrieb den alten Entwurf
// darüber. Ein stiller Verlust ohne einen Satz an der Fläche.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import "../../apps/web/src/i18n";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { D44_EDITOR_MARKE } from "../../apps/web/src/components/D44Gliederung";
import { KnowledgeInputStudio } from "../../apps/web/src/components/KnowledgeInputStudio";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import i18n from "../../apps/web/src/i18n";
import {
  beschreibungsfeld,
  klickWieBrowser,
  mitBildbeschreibung,
} from "../capture/bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Der Körper des Abnahmelaufs R-1619, Zeichen für Zeichen bis auf die Bildquelle (jsdom lädt keine
 *  Bilder; Kennungen und Reihenfolge sind unverändert). */
const VERWAIST = "CODEX-ABNAHME Beschreibung ohne Bild";
const INHALT = [
  "<p>Eigene Abnahme einer nicht zugeordneten Bildbeschreibung.</p>",
  '<figure data-image-id="abnahme-bild-a">',
  '<img data-image-id="abnahme-bild-a" alt="Abnahmebild A" src="/api/objects/a/raw">',
  '<figcaption data-image-id="abnahme-bild-a"></figcaption></figure>',
  `<figcaption data-image-id="abnahme-ohne-bild">${VERWAIST}</figcaption>`,
].join("");

/** Derselbe Körper, aber das Bild trägt SCHON eine Beschreibung (Lieferpunkt 4 / V7-Zusage). */
const BILD_SCHON_BESCHRIEBEN = [
  "<p>Eigene Abnahme einer nicht zugeordneten Bildbeschreibung.</p>",
  '<figure data-image-id="abnahme-bild-a">',
  '<img data-image-id="abnahme-bild-a" alt="Abnahmebild A" src="/api/objects/a/raw">',
  '<figcaption data-image-id="abnahme-bild-a">Fremde Beschreibung</figcaption></figure>',
  `<figcaption data-image-id="abnahme-ohne-bild">${VERWAIST}</figcaption>`,
].join("");

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
/** Der Zustand des Verbrauchers — DAS, was gespeichert würde. Kein Editor-DOM. */
let koerper = "";
let start = INHALT;

function Host(): JSX.Element {
  const [body, setBody] = useState(start);
  const [offen, setOffen] = useState(false);
  koerper = body;
  return mitBildbeschreibung(
    createElement(
      "div",
      null,
      createElement(
        "button",
        { type: "button", "data-testid": "studio-auf", onClick: () => setOffen(true) },
        "Studio",
      ),
      // Wie BibliothekLesen.tsx:779 — das Studio hängt am selben Zustand wie der Editor unten und
      // gibt seinen Entwurf NUR bei bewusster Übernahme heraus.
      createElement(KnowledgeInputStudio, {
        open: offen,
        onClose: () => setOffen(false),
        bodyHtml: body,
        onApply: (next: string) => setBody(next),
        runAssist: async () => "",
        documentTitle: "Wartungsnotiz",
      }),
      // Wie BibliothekLesen.tsx:806 — der äußere Editor am selben Zustand.
      createElement(RichTextEditor, {
        value: body,
        documentTitle: "Wartungsnotiz",
        onChange: (html: string) => setBody(html),
      }),
    ),
    async () => ({ text: "Vorschlag", demo: false }),
  );
}

function mount(inhalt: string = INHALT): void {
  start = inhalt;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() =>
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(MemoryRouter, { initialEntries: ["/wissen/1"] }, createElement(Host)),
          ),
        ),
      ),
    ),
  );
}

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

/** Die Editorfläche IM Studio (D44-Marke) — daran hängt der innere Editor. */
function studioFlaeche(): HTMLElement | null {
  const el = document.querySelector(`[${D44_EDITOR_MARKE}]`);
  return el instanceof HTMLElement ? el : null;
}

function studioFlaechePflicht(): HTMLElement {
  const el = studioFlaeche();
  if (el === null) {
    throw new Error("Das Studio ist nicht offen");
  }
  return el;
}

/** Der contenteditable-Knoten des ÄUSSEREN Editors — der einzige außerhalb der Studio-Fläche. */
function aussenEditor(): HTMLElement {
  const studio = studioFlaeche();
  const el = Array.from(document.querySelectorAll('[contenteditable="true"].prose-kw')).find(
    (e) => studio === null || !studio.contains(e),
  );
  if (!(el instanceof HTMLElement)) {
    throw new Error("Der äußere Editor ist nicht gerendert");
  }
  return el;
}

function studioOeffnen(): void {
  const knopf = document.querySelector('[data-testid="studio-auf"]');
  if (!(knopf instanceof HTMLElement)) {
    throw new Error("Der Studio-Knopf fehlt");
  }
  act(() => knopf.click());
}

/** Die verwaiste Beschreibung in DIESEM Editor anklicken — wie der Browser: erst Fokus, dann Klick. */
function oeffneVerwaisteIn(editor: HTMLElement): void {
  const cap = Array.from(editor.querySelectorAll("figcaption")).find(
    (f) => (f.textContent ?? "").trim() === VERWAIST,
  );
  if (!(cap instanceof HTMLElement)) {
    throw new Error("Die verwaiste Beschreibung steht nicht in diesem Editor");
  }
  act(() => {
    cap.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    cap.focus();
    cap.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function kandidaten(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll('[data-testid="caption-form-assign-option"]'),
  ) as HTMLElement[];
}

function beschreibungTippen(text: string): void {
  act(() => {
    const feld = beschreibungsfeld();
    feld.focus();
    feld.innerHTML = text;
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function uebernehmen(): void {
  const knopf = Array.from(document.querySelectorAll("button")).find(
    (b) => (b.textContent ?? "").trim() === i18n.t("studio.apply"),
  );
  if (knopf === undefined) {
    throw new Error("Der Übernahme-Knopf fehlt");
  }
  act(() => {
    knopf.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    knopf.focus();
    knopf.click();
  });
}

/** Die übernommene Fassung als Baum — HIER wird gemessen, was gespeichert würde. */
function uebernommeneFassung(): HTMLDivElement {
  const pruef = document.createElement("div");
  pruef.innerHTML = koerper;
  return pruef;
}

function figureDesBildes(baum: HTMLElement): HTMLElement | null {
  const el = Array.from(baum.querySelectorAll("figure")).find(
    (f) => f.querySelector(":scope > img")?.getAttribute("data-image-id") === "abnahme-bild-a",
  );
  return el instanceof HTMLElement ? el : null;
}

/** Zuordnen und Beschreibung speichern — im übergebenen Editor, mit dem Formular dieses Editors. */
function zuordnenUndSpeichern(editor: HTMLElement, beschreibung?: string): void {
  oeffneVerwaisteIn(editor);
  act(() => klickWieBrowser("caption-form-assign-option"));
  if (beschreibung !== undefined) {
    beschreibungTippen(beschreibung);
  }
  act(() => klickWieBrowser("caption-form-save"));
}

// ================================================================================================
// S1/S2 — DER GEMESSENE WEG DES BEFUNDS: DIE ZUORDNUNG GESCHIEHT, WÄHREND DAS STUDIO OFFEN STEHT
// ================================================================================================
//
// Genau die Reihenfolge aus `zugeordnet-editor.txt`: das Studio steht offen, die Zuordnung erreicht
// den Rumpf über den äußeren Editor, danach „In den Entwurf übernehmen". Vor der Reparatur
// überschrieb der eingefrorene Entwurf des Studios die Zuordnung.
describe("JOB 3083 · S1/S2 — die Zuordnung steht in der ÜBERNOMMENEN Fassung", () => {
  beforeEach(() => mount());

  it("S1 (2a) · die Beschreibung steht in der figcaption GENAU DIESES Bildes", () => {
    studioOeffnen();
    zuordnenUndSpeichern(aussenEditor(), "Die neue Beschreibung");
    uebernehmen();
    const figure = figureDesBildes(uebernommeneFassung());
    expect(figure, "die figure des Bildes fehlt in der übernommenen Fassung").not.toBeNull();
    const caps = Array.from(figure?.querySelectorAll(":scope > figcaption") ?? []);
    expect(caps.length, "die figure trägt nicht genau EINE direkte Fußnote").toBe(1);
    expect(caps[0]?.getAttribute("data-image-id")).toBe("abnahme-bild-a");
    expect(caps[0]?.textContent).toBe("Die neue Beschreibung");
  });

  it("S2 (2b) · die verwaiste figcaption mit der alten Kennung kommt nicht mehr vor", () => {
    studioOeffnen();
    zuordnenUndSpeichern(aussenEditor(), "Die neue Beschreibung");
    uebernehmen();
    const baum = uebernommeneFassung();
    expect(
      baum.querySelector('figcaption[data-image-id="abnahme-ohne-bild"]'),
      "die verwaiste Beschreibung steht weiterhin mit ihrer alten Kennung im Rumpf",
    ).toBeNull();
    expect(koerper).not.toContain("abnahme-ohne-bild");
    // Und keine Fußnote steht mehr außerhalb einer figure — der Zustand, den Codex als „weiterhin
    // externe figcaption" gemessen hat.
    for (const f of Array.from(baum.querySelectorAll("figcaption"))) {
      expect(
        f.closest("figure"),
        "eine Fußnote steht weiterhin außerhalb jeder figure",
      ).not.toBeNull();
    }
  });

  it("S3 · der Editor IM Studio zieht die fremde Änderung nach, statt sie später zu überschreiben", () => {
    // Die Verluststelle selbst, eine Etage tiefer gemessen: der innere Editor zeigte im
    // Abnahmebeleg noch den alten Stand, während der äußere die Zuordnung schon trug.
    studioOeffnen();
    zuordnenUndSpeichern(aussenEditor(), "Die neue Beschreibung");
    const innen = studioFlaechePflicht();
    expect(
      innen.querySelector('figcaption[data-image-id="abnahme-ohne-bild"]'),
      "der Studio-Editor führt weiterhin die verwaiste Beschreibung",
    ).toBeNull();
    expect(innen.textContent).toContain("Die neue Beschreibung");
  });
});

// ================================================================================================
// S4 — DIE ZUORDNUNG IM STUDIO SELBST (der Weg, den Q5 im Titel verspricht)
// ================================================================================================
describe("JOB 3083 · S4 — im Studio zugeordnet, dann übernommen", () => {
  beforeEach(() => mount());

  it("S4 · die im Studio hergestellte Zuordnung steht in der übernommenen Fassung", () => {
    studioOeffnen();
    zuordnenUndSpeichern(studioFlaechePflicht(), "Im Studio beschrieben");
    uebernehmen();
    const figure = figureDesBildes(uebernommeneFassung());
    expect(figure?.querySelector(":scope > figcaption")?.getAttribute("data-image-id")).toBe(
      "abnahme-bild-a",
    );
    expect(figure?.querySelector(":scope > figcaption")?.textContent).toBe("Im Studio beschrieben");
    expect(koerper).not.toContain("abnahme-ohne-bild");
  });
});

// ================================================================================================
// S5 — KEIN AUTO-SAVE (Lieferpunkt 5)
// ================================================================================================
describe("JOB 3083 · S5 — ohne Übernahme verlässt nichts das Studio", () => {
  beforeEach(() => mount());

  it("S5 · im Studio zuordnen und verwerfen lässt den äußeren Inhalt byteweise unverändert", () => {
    const vorher = koerper;
    studioOeffnen();
    zuordnenUndSpeichern(studioFlaechePflicht(), "Im Studio beschrieben");
    expect(koerper, "das Studio hat ohne Übernahme geschrieben").toBe(vorher);
    // Verwerfen: erst der Ausgang, dann die Rückfrage (SCRUM-339).
    const klickText = (text: string): boolean => {
      const knopf = Array.from(document.querySelectorAll("button")).find(
        (b) => (b.textContent ?? "").trim() === text,
      );
      if (knopf === undefined) {
        return false;
      }
      act(() => knopf.click());
      return true;
    };
    expect(klickText(i18n.t("studio.cancel")), "der Verwerfen-Knopf fehlt").toBe(true);
    expect(klickText(i18n.t("studio.confirmDiscard.discard")), "die Rückfrage fehlt").toBe(true);
    expect(studioFlaeche(), "das Studio ist noch offen — der Weg ist nicht gemessen").toBeNull();
    expect(koerper, "ohne Übernahme hat das Studio den Inhalt verändert").toBe(vorher);
  });
});

// ================================================================================================
// S6 — DIE V7-ZUSAGE VON JOB 3055 BLEIBT (Lieferpunkt 4)
// ================================================================================================
describe("JOB 3083 · S6 — eine vorhandene fremde Beschreibung wird nicht überschrieben", () => {
  beforeEach(() => mount(BILD_SCHON_BESCHRIEBEN));

  it("S6 · das beschriebene Bild ist kein Kandidat, und sein Text steht danach unverändert da", () => {
    studioOeffnen();
    oeffneVerwaisteIn(studioFlaechePflicht());
    expect(kandidaten().length, "ein schon beschriebenes Bild wurde als Ziel angeboten").toBe(0);
    uebernehmen();
    const baum = uebernommeneFassung();
    expect(figureDesBildes(baum)?.querySelector(":scope > figcaption")?.textContent).toBe(
      "Fremde Beschreibung",
    );
    // Und die verwaiste Beschreibung steht sichtbar daneben, statt still zu verschwinden.
    expect(baum.querySelector('figcaption[data-image-id="abnahme-ohne-bild"]')?.textContent).toBe(
      VERWAIST,
    );
  });
});

// ================================================================================================
// S7 — DER ENTWURF DES AUTORS WIRD NICHT UNTER IHM WEGGEZOGEN (Prüfpunkt 6)
// ================================================================================================
describe("JOB 3083 · S7 — die Nachführung nimmt dem Autor nichts weg", () => {
  beforeEach(() => mount());

  it("S7 · hat der Autor im Studio gearbeitet, bleibt SEIN Entwurf stehen", () => {
    studioOeffnen();
    // Der Autor arbeitet im Studio …
    const innen = studioFlaechePflicht().querySelector('[contenteditable="true"].prose-kw');
    if (!(innen instanceof HTMLElement)) {
      throw new Error("Der Studio-Editor ist nicht gerendert");
    }
    act(() => {
      innen.focus();
      innen.insertAdjacentHTML("beforeend", "<p>Im Studio ergaenzt</p>");
      innen.dispatchEvent(new Event("input", { bubbles: true }));
    });
    // … und draußen ändert sich der Rumpf. Der Entwurf des Autors darf davon NICHT ersetzt werden.
    zuordnenUndSpeichern(aussenEditor(), "Draussen beschrieben");
    expect(
      studioFlaechePflicht().textContent,
      "der Entwurf des Autors wurde unter ihm ersetzt",
    ).toContain("Im Studio ergaenzt");
    uebernehmen();
    expect(koerper, "die bewusste Übernahme hat den Entwurf des Autors verloren").toContain(
      "Im Studio ergaenzt",
    );
  });
});
