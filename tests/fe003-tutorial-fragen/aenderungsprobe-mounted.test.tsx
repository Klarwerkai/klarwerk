// @vitest-environment jsdom
// ================================================================================================
// FE-003 · E4 — DIE ÄNDERUNGSPROBE: eine Änderung am gemeinsamen Baustein erscheint auf der echten
// Seite UND in der Tutorialansicht.
// ================================================================================================
//
// WIE DIE PROBE GEBAUT IST: Die gemeinsamen Bausteine werden NUR in diesem Testlauf verändert
// (`vi.mock` mit dem Original darunter) — jeder rendert zusätzlich eine sichtbare Probemarke. Im
// Produkt bleibt nichts zurück. Erscheint die Marke auf `/fragen` UND in der Demo, dann rendern
// beide Orte denselben Baustein; eine nachgezeichnete zweite Oberfläche im Tutorial bliebe ohne
// Marke und machte diesen Test rot.
//
// Dazu die Quelltextseite derselben Zusage: das Tutorial enthält keine Bilder, Videos oder eigene
// Formular-Nachzeichnung und importiert weder `endpoints` noch `useMutation`.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/components/fragen/FrageFeld", async (original) => {
  const echt = await original<typeof import("../../apps/web/src/components/fragen/FrageFeld")>();
  const { createElement, Fragment } = await import("../../apps/web/node_modules/react");
  return {
    FrageFeld: (p: Parameters<typeof echt.FrageFeld>[0]) =>
      createElement(
        Fragment,
        null,
        createElement("span", { "data-aenderungsprobe": "FrageFeld" }, "PROBE"),
        createElement(echt.FrageFeld, p),
      ),
  };
});
vi.mock("../../apps/web/src/components/fragen/Quellenplaketten", async (original) => {
  const echt =
    await original<typeof import("../../apps/web/src/components/fragen/Quellenplaketten")>();
  const { createElement, Fragment } = await import("../../apps/web/node_modules/react");
  return {
    ...echt,
    QuellenChipInhalt: (p: Parameters<typeof echt.QuellenChipInhalt>[0]) =>
      createElement(
        Fragment,
        null,
        createElement("span", { "data-aenderungsprobe": "QuellenChipInhalt" }, "PROBE"),
        createElement(echt.QuellenChipInhalt, p),
      ),
  };
});
vi.mock("../../apps/web/src/components/fragen/Antwortbausteine", async (original) => {
  const echt =
    await original<typeof import("../../apps/web/src/components/fragen/Antwortbausteine")>();
  const { createElement, Fragment } = await import("../../apps/web/node_modules/react");
  return {
    ...echt,
    KiNichtVerfuegbar: (p: Parameters<typeof echt.KiNichtVerfuegbar>[0]) =>
      createElement(
        Fragment,
        null,
        createElement("span", { "data-aenderungsprobe": "KiNichtVerfuegbar" }, "PROBE"),
        createElement(echt.KiNichtVerfuegbar, p),
      ),
  };
});
vi.mock("../../apps/web/src/components/fragen/QuellenListe", async (original) => {
  const echt = await original<typeof import("../../apps/web/src/components/fragen/QuellenListe")>();
  const { createElement, Fragment } = await import("../../apps/web/node_modules/react");
  return {
    ...echt,
    QuellenListe: (p: Parameters<typeof echt.QuellenListe>[0]) =>
      createElement(
        Fragment,
        null,
        createElement("span", { "data-aenderungsprobe": "QuellenListe" }, "PROBE"),
        createElement(echt.QuellenListe, p),
      ),
  };
});
vi.mock("../../apps/web/src/components/start/OverflowMenu", async (original) => {
  const echt = await original<typeof import("../../apps/web/src/components/start/OverflowMenu")>();
  const { createElement, Fragment } = await import("../../apps/web/node_modules/react");
  return {
    ...echt,
    OverflowMenu: (p: Parameters<typeof echt.OverflowMenu>[0]) =>
      createElement(
        Fragment,
        null,
        createElement("span", { "data-aenderungsprobe": "OverflowMenu" }, "PROBE"),
        createElement(echt.OverflowMenu, p),
      ),
  };
});
vi.mock("../../apps/web/src/components/start/AntwortText", async (original) => {
  const echt = await original<typeof import("../../apps/web/src/components/start/AntwortText")>();
  const { createElement, Fragment } = await import("../../apps/web/node_modules/react");
  return {
    AntwortText: (p: Parameters<typeof echt.AntwortText>[0]) =>
      createElement(
        Fragment,
        null,
        createElement("span", { "data-aenderungsprobe": "AntwortText" }, "PROBE"),
        createElement(echt.AntwortText, p),
      ),
  };
});

import i18n from "../../apps/web/src/i18n";
import {
  type Montiert,
  bis,
  demo,
  echtesFeld,
  klick,
  medienStub,
  montiere,
  netz,
  netzStub,
  oeffneTutorial,
  q,
  tippe,
  zuKapitel,
  zuTeil,
} from "./huelle";

let m: Montiert | null = null;

beforeEach(async () => {
  netz.anfragen = [];
  netz.lage = { kiAktiv: true, rolle: "experte" };
  medienStub({ reduziert: true });
  vi.stubGlobal("fetch", vi.fn(netzStub));
  await i18n.changeLanguage("de");
});

afterEach(() => {
  m?.abbauen();
  m = null;
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

function proben(wurzel: ParentNode, baustein: string): { seite: number; demo: number } {
  const alle = Array.from(wurzel.querySelectorAll(`[data-aenderungsprobe="${baustein}"]`));
  return {
    seite: alle.filter((el) => !el.closest("[data-tutorial-demo]")).length,
    demo: alle.filter((el) => el.closest("[data-tutorial-demo]")).length,
  };
}

describe("E4 · eine Änderung am gemeinsamen Baustein erscheint auf der Seite UND im Tutorial", () => {
  it("Fragefeld, Antworttext und Quellenchip: dieselbe Probemarke an beiden Orten", async () => {
    m = await montiere("/fragen");
    const feld = echtesFeld(m.container);
    await tippe(feld, "Wie werden Reisen genehmigt?");
    await klick(feld.form?.querySelector('button[type="submit"]'));
    await bis(() => Boolean(q(m?.container as ParentNode, "ask-answer")));
    await oeffneTutorial(m.container);

    expect(proben(m.container, "FrageFeld").seite).toBe(1);
    expect(proben(m.container, "FrageFeld").demo).toBe(1);

    await zuKapitel(m.container, "antwort");
    expect(proben(m.container, "AntwortText").seite).toBe(1);
    expect(proben(m.container, "AntwortText").demo).toBe(1);
    expect(proben(m.container, "QuellenChipInhalt").seite).toBe(1);
    expect(proben(m.container, "QuellenChipInhalt").demo).toBe(1);
    expect(proben(m.container, "OverflowMenu").seite).toBe(1);
    expect(proben(m.container, "OverflowMenu").demo).toBe(1);
  });

  it("Quellenliste im Blatt „Mehr“: dieselbe Probemarke auf der Seite und in der Demo", async () => {
    m = await montiere("/fragen");
    const feld = echtesFeld(m.container);
    await tippe(feld, "Wie werden Reisen genehmigt?");
    await klick(feld.form?.querySelector('button[type="submit"]'));
    await bis(() => Boolean(q(m?.container as ParentNode, "ask-answer")));
    await klick(m.container.querySelector('[data-testid="ask-menu"]'));
    await klick(document.querySelector('[data-testid="ask-menu-punkt-mehr"]'));
    const echt = document.querySelector('[data-testid="ask-mehr"]');
    expect(echt?.querySelectorAll('[data-aenderungsprobe="QuellenListe"]').length).toBe(1);
    await klick(echt?.querySelector("div > button[aria-label]"));

    await oeffneTutorial(m.container);
    await zuKapitel(m.container, "quelle");
    await klick(demo(m.container).querySelector('[data-testid="tutorial-demo-menue"]'));
    await klick(document.querySelector('[data-testid="tutorial-demo-menue-punkt-mehr"]'));
    const blatt = document.querySelector('[data-testid="tutorial-demo-mehr"]');
    expect(blatt?.querySelectorAll('[data-aenderungsprobe="QuellenListe"]').length).toBe(1);
  });

  it("KI nicht verfügbar: derselbe Satz-Baustein auf der Seite und in der Vorführung", async () => {
    netz.lage.kiAktiv = false;
    m = await montiere("/fragen");
    await oeffneTutorial(m.container);
    await zuKapitel(m.container, "sonderfaelle");
    await zuTeil(m.container, 2);
    expect(demo(m.container).textContent).toContain(i18n.t("ai.unavailable.hint"));
    // Auf der Seite unter dem Feld (und im Übergang, falls sichtbar) — und in der Vorführung.
    expect(proben(m.container, "KiNichtVerfuegbar").seite).toBeGreaterThanOrEqual(1);
    expect(proben(m.container, "KiNichtVerfuegbar").demo).toBe(1);
  });
});

// ------------------------------------------------------------------------------------------------
const WURZEL = join(__dirname, "..", "..");
const TUTORIAL = join(WURZEL, "apps", "web", "src", "tutorial");

function dateien(verzeichnis: string): string[] {
  return readdirSync(verzeichnis).flatMap((name) => {
    const pfad = join(verzeichnis, name);
    return statSync(pfad).isDirectory() ? dateien(pfad) : [pfad];
  });
}

describe("E4 · keine Bildschirmfotos, keine Videos, keine nachgezeichnete zweite Oberfläche", () => {
  const quellen = dateien(TUTORIAL).map((pfad) => ({ pfad, text: readFileSync(pfad, "utf8") }));

  it("das Tutorial besteht nur aus Quelltext — keine Bild- oder Videodateien", () => {
    for (const { pfad } of quellen) {
      expect(pfad).toMatch(/\.(ts|tsx)$/);
    }
  });

  it("kein <img>, <video>, <canvas>, <iframe> und kein Verweis auf Bild-/Videodateien", () => {
    for (const { pfad, text } of quellen) {
      expect(text, pfad).not.toMatch(/<(img|video|canvas|iframe|picture)\b/);
      expect(text, pfad).not.toMatch(/\.(png|jpe?g|gif|webp|avif|mp4|webm|mov)\b/i);
    }
  });

  it("die Demo zeichnet kein eigenes Formular nach — Eingabe und Senden kommen aus `FrageFeld`", () => {
    for (const { pfad, text } of quellen) {
      expect(text, pfad).not.toMatch(/<(form|input|textarea)\b/);
    }
    // Was Seite UND Demo direkt einbinden — der Quellenweg eingeschlossen: Chip, Menü „…“, Blatt
    // „Mehr“ und die Quellenliste darin (FE-003 Runde 2).
    const GEMEINSAM = [
      "FrageFeld",
      "AntwortPlatzhalter",
      "AntwortText",
      "AiGeneratedNotice",
      "QuellenChipInhalt",
      "OverflowMenu",
      "Seitenblatt",
      "QuellenListe",
      "KiNichtVerfuegbar",
    ];
    const demoQuelle = readFileSync(join(TUTORIAL, "fragen", "FragenDemo.tsx"), "utf8");
    const ask = readFileSync(join(WURZEL, "apps", "web", "src", "pages", "Ask.tsx"), "utf8");
    for (const baustein of GEMEINSAM) {
      expect(demoQuelle, `${baustein} fehlt in der Demo`).toMatch(new RegExp(`<${baustein}\\b`));
      expect(ask, `${baustein} fehlt auf der Seite`).toMatch(new RegExp(`<${baustein}\\b`));
    }
    // Die Plaketten und die Quellenzeile stecken in der gemeinsamen Liste, nicht in einer Kopie.
    const liste = readFileSync(
      join(WURZEL, "apps", "web", "src", "components", "fragen", "QuellenListe.tsx"),
      "utf8",
    );
    for (const baustein of ["VerwendungsPlakette", "PruefstandPlakette", "AnswerSourceDetails"]) {
      expect(liste).toMatch(new RegExp(`<${baustein}\\b`));
      expect(demoQuelle, `${baustein} in der Demo nachgezeichnet`).not.toMatch(
        new RegExp(`<${baustein}\\b`),
      );
    }
  });

  it("das Tutorial kennt keinen Schreibweg: kein `endpoints`, kein `useMutation`, kein `fetch`", () => {
    for (const { pfad, text } of quellen) {
      expect(text, pfad).not.toMatch(/from "[^"]*api\/endpoints"/);
      expect(text, pfad).not.toMatch(/\buseMutation\b/);
      expect(text, pfad).not.toMatch(/\bfetch\(/);
    }
  });
});
