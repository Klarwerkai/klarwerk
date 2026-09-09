// @vitest-environment jsdom
// ================================================================================================
// JOB 3337 · ADMIN-NAVIGATION — DER ZUSTAND HAT EINE ADRESSE, UND DIE ADRESSE WIRD GEPRÜFT.
// ================================================================================================
//
// Codex' Befund an 1.0.0-beta.1.198 (`ADMIN-NAVIGATION-AUFTRAG.md`, Codebelege): „`pages/Admin.tsx`
// :93-95 (Reiter/Detail nur lokaler Zustand)". Die Folge war messbar und wird in der Abnahmeliste
// der Vorlage ausdrücklich verlangt: „Browser Zurück/Vorwärts und Reload prüfen, kein Rückfall nach
// Konten."
//
// DIE ZWEITE HÄLFTE IST DIE GEFAHR, DIE MAN SICH DABEI EINHANDELT. Ein Zustand aus der Adresse ist
// ein Zustand aus FREMDER Hand. Vorlage, Punkt 4: „Keine beliebigen Komponenten aus Querytext
// aufrufen." Deshalb steht hier neben jedem erlaubten Wert auch ein unerlaubter — und die Zusage,
// dass er auf der Übersicht landet statt in einer Karte oder einer Fehlerfläche.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../apps/web/src/api/auth")>();
  return {
    ...original,
    authApi: {
      ...original.authApi,
      status: vi.fn(async () => ({ needsSetup: false })),
      me: vi.fn(async () => ({ id: "u-admin", name: "Ada", email: "a@x.de", role: "admin" })),
    },
  };
});

import { createElement } from "../../apps/web/node_modules/react";
import i18n from "../../apps/web/src/i18n";
import { adminHref } from "../../apps/web/src/lib/adminSections";
import { CommandPalette } from "../../apps/web/src/shell/CommandPalette";
import {
  type Stand,
  abbauen,
  aktivesThema,
  beruhige,
  klicke,
  montiere,
  neuLaden,
  ohneNetz,
  ort,
  setzeStufe2,
  sprache,
  verlauf,
} from "./vorrichtung";

const t = (key: string): string => i18n.t(key);
let stand: Stand | null = null;

beforeAll(() => {
  ohneNetz();
});

beforeEach(() => {
  setzeStufe2(true);
});

afterEach(async () => {
  if (stand) {
    abbauen(stand);
    stand = null;
  }
  await sprache("de");
  vi.clearAllMocks();
});

async function admin(adresse: string): Promise<Stand> {
  const s = montiere(adresse);
  stand = s;
  await beruhige();
  return s;
}

function detailOffen(s: Stand): boolean {
  return s.container.querySelector('[data-einst="detail"]') !== null;
}

function pfadzeile(s: Stand): string {
  return s.container.querySelector('[data-einst="pfad"]')?.textContent ?? "";
}

describe("JOB 3337 · D · der Reiter- und Detailzustand ist adressierbar", () => {
  it("D1 · ein Link auf Bereich und Detail landet genau dort — mit lesbarem Pfad darüber", async () => {
    const s = await admin(adminHref("vorfuehrdaten", "demo"));
    expect(detailOffen(s), "die Karte ist nicht aufgegangen").toBe(true);
    expect(aktivesThema(s)).toBe(t("adm.sec.vorfuehrdaten"));
    expect(pfadzeile(s)).toBe(
      [t("gliederung.verwaltung"), t("adm.sec.vorfuehrdaten"), t("adm.ziel.demo")].join(" › "),
    );
  });

  it("D2 · das Thema folgt dem Detail, auch wenn der Link nur das Detail nennt", async () => {
    const s = await admin("/admin?detail=papierkorb");
    expect(detailOffen(s)).toBe(true);
    expect(aktivesThema(s)).toBe(t("adm.sec.quellen"));
  });

  it("D3 · ein unerlaubter Detailwert ruft KEINE Komponente auf, sondern zeigt die Übersicht", async () => {
    for (const boese of [
      "werkX",
      "../../etc",
      "<script>",
      "nutzer:hat leerzeichen",
      "rolle:root",
      "NutzerNeu",
    ]) {
      const s = await admin(`/admin?bereich=system&detail=${encodeURIComponent(boese)}`);
      expect(detailOffen(s), `„${boese}" hat eine Karte geöffnet`).toBe(false);
      // Auch NICHT die Fehlkarte „Diese Karte gibt es nicht" — ein unerlaubter Wert ist kein
      // Zustand, über den die Fläche berichten müsste; sie zeigt schlicht ihr Thema.
      expect(s.container.textContent).not.toContain(t("einst.detail.unbekannt"));
      expect(aktivesThema(s)).toBe(t("adm.sec.system"));
      abbauen(s);
      stand = null;
    }
  });

  it("D4 · ein unerlaubter Bereichswert fällt auf das erste Thema zurück", async () => {
    const s = await admin("/admin?bereich=geheim");
    expect(aktivesThema(s)).toBe(t("adm.sec.konten"));
    expect(detailOffen(s)).toBe(false);
  });

  it("D5 · der alte Weg `/admin` ohne Query bleibt wortgleich gültig", async () => {
    const s = await admin("/admin");
    expect(aktivesThema(s)).toBe(t("adm.sec.konten"));
    expect(s.container.querySelector('[data-testid="page-admin"]')).not.toBeNull();
  });

  it("D6 · Browser-Zurück und -Vorwärts bleiben am richtigen Ort (Abnahmeliste der Vorlage)", async () => {
    const s = await admin(adminHref("sicherheit"));
    await klicke(s.container.querySelector('[data-testid="zeile-pruefprotokoll"]'));
    expect(detailOffen(s), "die Karte ging nicht auf").toBe(true);
    expect(ort(s)).toContain("detail=protokoll");

    await verlauf(s, -1);
    expect(detailOffen(s), "Zurück blieb in der Karte").toBe(false);
    expect(aktivesThema(s), "Zurück fiel auf ein fremdes Thema").toBe(t("adm.sec.sicherheit"));

    await verlauf(s, 1);
    expect(detailOffen(s), "Vorwärts kam nicht zurück in die Karte").toBe(true);
    expect(ort(s)).toContain("detail=protokoll");
  });

  it("D7 · ein Neuladen landet wieder in derselben Karte, nicht bei „Benutzer und Rollen“", async () => {
    const s = await admin(adminHref("system", "werk"));
    expect(detailOffen(s)).toBe(true);
    const frisch = neuLaden(s);
    stand = frisch;
    await beruhige();
    expect(detailOffen(frisch), "nach dem Neuladen war die Karte zu").toBe(true);
    expect(aktivesThema(frisch)).toBe(t("adm.sec.system"));
  });

  it("D9 · eine Vorschaurolle schließt die Karte, die sie gleich wegnimmt", async () => {
    // JOB 3337 R3: Der adressierbare Zustand ist ein Gewinn — und genau hier war er eine Falle.
    // Wer in „Ansicht als Rolle" eine FREMDE Rolle wählt, dem nimmt der Rollen-Guard `/admin` weg;
    // bliebe die Karte in der Adresse stehen, stünde man nach dem Rückweg „Zur Admin-Ansicht"
    // wieder mitten in ihr statt auf der Übersicht. Genau das hat die Chromium-Messung
    // `h1-funktionsinventar` (Z-vorschau-rueckweg) ab der zweiten Vorschaurolle gemeldet.
    const s = await admin(adminHref("konten", "ansichtRolle"));
    expect(detailOffen(s), "die Karte „Ansicht als Rolle“ ging nicht auf").toBe(true);

    const betrachter = [
      ...s.container.querySelectorAll<HTMLButtonElement>(
        '[data-testid="detail-ansicht-rolle"] button[aria-pressed]',
      ),
    ].find((b) => (b.textContent ?? "").trim() === t("role.name.viewer"));
    await klicke(betrachter);

    expect(detailOffen(s), "die Karte blieb offen, obwohl die Rolle sie wegnimmt").toBe(false);
    expect(ort(s), "die Adresse zeigt weiter auf die weggenommene Karte").toBe(adminHref("konten"));
    expect(
      s.container.querySelector('[data-testid="zeile-ansicht-rolle"]'),
      "die Zeile steht nach dem Rückweg nicht wieder auf der Übersicht",
    ).not.toBeNull();
  });

  it("D10 · die eigene Rolle „Administrator“ schließt sie NICHT — dort bleibt man in der Karte", async () => {
    // Die Gegenrichtung, sonst wäre D9 auch mit „schließe immer" erfüllt: wer von einer Vorschau
    // auf „Administrator" zurückstellt, arbeitet in dieser Karte weiter.
    const s = await admin(adminHref("konten", "ansichtRolle"));
    const adminKnopf = [
      ...s.container.querySelectorAll<HTMLButtonElement>(
        '[data-testid="detail-ansicht-rolle"] button[aria-pressed]',
      ),
    ].find((b) => (b.textContent ?? "").trim() === t("role.name.admin"));
    await klicke(adminKnopf);
    expect(detailOffen(s), "die eigene Rolle hat die Karte geschlossen").toBe(true);
    expect(ort(s)).toBe(adminHref("konten", "ansichtRolle"));
  });

  it("D8 · DE↔EN: das offene Detail und das Thema überleben den Sprachwechsel", async () => {
    const s = await admin(adminHref("ki", "kiZugaenge"));
    expect(detailOffen(s)).toBe(true);
    const vorher = ort(s);

    await sprache("en");
    expect(detailOffen(s), "der Sprachwechsel hat die Karte geschlossen").toBe(true);
    expect(ort(s), "der Sprachwechsel hat den Ort verschoben").toBe(vorher);
    // Menü, Seite und Pfad sprechen dieselbe Sprache — und es steht kein roher Schlüssel da.
    expect(aktivesThema(s)).toBe(i18n.getFixedT("en")("adm.sec.ki"));
    expect(pfadzeile(s)).toContain(i18n.getFixedT("en")("gliederung.verwaltung"));
    expect(pfadzeile(s)).not.toContain("gliederung.");
  });
});

describe("JOB 3337 · E · Modul aus ist nicht fehlende Rolle", () => {
  beforeEach(() => {
    setzeStufe2(false);
  });

  it("E1 · ein erlaubter, ausgeschalteter Bereich steht sichtbar da — als „Modul aus“, ohne Link", async () => {
    const s = await admin(adminHref("berichte"));
    const zeile = s.container.querySelector('[data-testid="zeile-output"]');
    expect(zeile, "der ausgeschaltete Bereich fehlt ganz").not.toBeNull();
    expect(zeile?.textContent).toContain(t("einst.modul.aus"));
    // Kein Zugriff: die Zeile ist kein Link und kein Knopf, sie führt nirgendwohin.
    expect(zeile?.tagName).toBe("DIV");
    expect(zeile?.querySelector("a")).toBeNull();
    // Und der bestehende Aktivierungsweg steht darunter — keine stille Aktivierung.
    expect(s.container.textContent).toContain(t("einst.modul.weg"));
  });

  it("E2 · mit eingeschaltetem Modul wird aus derselben Zeile ein Weg", async () => {
    setzeStufe2(true);
    const s = await admin(adminHref("berichte"));
    const zeile = s.container.querySelector('[data-testid="zeile-output"]');
    expect(zeile?.tagName).toBe("A");
    expect(zeile?.textContent).not.toContain(t("einst.modul.aus"));
    // Nicht-vakuös: E1 und E2 messen dieselbe Zeile, nur mit anderem Schalter.
    expect(s.container.textContent).not.toContain(t("einst.modul.weg"));
  });

  it("E3 · der Schalter dafür wohnt unter „System“ und sagt seinen Zustand", async () => {
    const s = await admin(adminHref("system"));
    const zeile = s.container.querySelector('[data-testid="zeile-stufe2"]');
    expect(zeile, "der Schalter „Erweiterte Module“ fehlt unter System").not.toBeNull();
    expect(zeile?.textContent).toContain(t("einst.aus"));
    expect(zeile?.querySelector('input[type="checkbox"]')).not.toBeNull();
  });

  it("E4 · auch der Verweis auf die Beispielpakete bietet kein gesperrtes Ziel an", async () => {
    // JOB 3337 R2 (Codex, Befund 7): dieser Verweis stand als UNBEDINGT aktiver Kurzlink da,
    // obwohl er nach `/import` führt — und `/import` ist ein Stufe-2-Bereich. Bei ausgeschaltetem
    // Modul wurde also ein gesperrtes Ziel angeboten, während dieselbe Fläche einen Zeilenabstand
    // weiter oben denselben Fall korrekt als „Modul aus" erklärte. Beide gehen jetzt durch dieselbe
    // Regel.
    const s = await admin(adminHref("vorfuehrdaten"));
    const zeile = s.container.querySelector('[data-testid="zeile-demopakete"]');
    expect(zeile, "der Verweis auf die Beispielpakete fehlt ganz").not.toBeNull();
    expect(zeile?.textContent).toContain(t("einst.modul.aus"));
    expect(zeile?.tagName, "das gesperrte Ziel wird trotzdem als Link angeboten").toBe("DIV");
    expect(s.container.querySelector('[data-testid="zeile-demopakete"] a')).toBeNull();
    // Der bestehende Aktivierungsweg steht auch hier — keine stille Aktivierung, kein Sackgassen-
    // Hinweis „geht nicht" ohne Ausweg.
    expect(s.container.textContent).toContain(t("einst.modul.weg"));
  });

  it("E5 · mit eingeschaltetem Modul führt derselbe Verweis auf den Anker im Import", async () => {
    setzeStufe2(true);
    const s = await admin(adminHref("vorfuehrdaten"));
    const zeile = s.container.querySelector('[data-testid="zeile-demopakete"]');
    expect(zeile?.tagName).toBe("A");
    // Der Anker ist der, den `components/ExamplePackages.tsx` wirklich setzt (`id="demopakete"`).
    expect(zeile?.getAttribute("href")).toBe("/import#demopakete");
    expect(zeile?.textContent).not.toContain(t("einst.modul.aus"));
  });
});

// ------------------------------------------------------------------------------------------------
// F · „Gehe zu …": Sprachwechsel und Tastaturweg.
// ------------------------------------------------------------------------------------------------

async function paletteMitEingabe(eingabe: string): Promise<Stand> {
  const s = montiere("/start", createElement(CommandPalette));
  stand = s;
  await beruhige();
  window.dispatchEvent(new Event("open-command-palette"));
  await beruhige(3);
  const feld = s.container.querySelector<HTMLInputElement>(
    `input[aria-label="${t("cmd.suchfeld")}"]`,
  );
  if (!feld) {
    throw new Error("Die Liste „Gehe zu …“ hat kein benanntes Suchfeld.");
  }
  const setzer = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setzer?.call(feld, eingabe);
  feld.dispatchEvent(new Event("input", { bubbles: true }));
  await beruhige(3);
  return s;
}

function feldWert(s: Stand): string {
  return s.container.querySelector<HTMLInputElement>("input[aria-label]")?.value ?? "(kein Feld)";
}

function trefferKennungen(s: Stand): string[] {
  return [...s.container.querySelectorAll("[data-cmd-ziel]")].map(
    (b) => b.getAttribute("data-cmd-ziel") ?? "",
  );
}

describe("JOB 3337 · F · der Direktzugang verliert beim Sprachwechsel nichts", () => {
  it("F1 · Suchbegriff und Trefferliste überstehen DE→EN", async () => {
    const s = await paletteMitEingabe("Papierkorb");
    expect(trefferKennungen(s)).toContain("det:papierkorb");
    await sprache("en");
    expect(feldWert(s), "der Suchbegriff ist verschwunden").toBe("Papierkorb");
    // „Papierkorb" steht auf Englisch weiterhin als Synonym in der Suche — der Weg bleibt offen.
    expect(trefferKennungen(s), "das Ziel ging beim Sprachwechsel verloren").toContain(
      "det:papierkorb",
    );
  });

  it("F2 · die Tastaturmarkierung wandert und wird in Sicht gezogen", async () => {
    const gezogen: Element[] = [];
    const vorher = Element.prototype.scrollIntoView;
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: function (this: Element): void {
        gezogen.push(this);
      },
    });
    try {
      // Bewusst eine TEILEINGABE: „KI" wäre der volle Name eines Ziels und damit nach der Regel
      // aus `trefferFuer` ein exklusiver Treffer — ein Tastaturweg über EINE Zeile misst nichts.
      const s = await paletteMitEingabe("Daten");
      const feld = s.container.querySelector<HTMLInputElement>("input[aria-label]");
      const anzahl = trefferKennungen(s).length;
      expect(anzahl, "zu wenige Treffer für einen Tastaturweg").toBeGreaterThan(2);
      for (let i = 0; i < anzahl + 2; i += 1) {
        await klicke(feld);
        feld?.dispatchEvent(
          new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
        );
        await beruhige(2);
      }
      const markiert = s.container.querySelector('[data-cmd-aktiv="true"]');
      expect(markiert, "keine Markierung nach dem Wandern").not.toBeNull();
      // Sie steht auf dem LETZTEN Treffer und ist dorthin gezogen worden — genau die Zusage aus
      // Punkt 7 der Vorlage („Pfeiltasten scrollen aktiven Treffer in Sicht").
      expect(markiert?.getAttribute("data-cmd-ziel")).toBe(trefferKennungen(s)[anzahl - 1]);
      expect(gezogen, "die Markierung wurde nie in Sicht gezogen").toContain(markiert);
    } finally {
      Object.defineProperty(Element.prototype, "scrollIntoView", {
        configurable: true,
        writable: true,
        value: vorher,
      });
    }
  });

  // WAS DIESER FALL IST UND WAS NICHT (BEN, Runde 6): Er vergleicht KLASSEN und DOM-Anwesenheit.
  // In jsdom gibt es kein Layout — ob die letzte Zeile wirklich im Fenster steht, kann er nicht
  // wissen, und genau das hat er in R6 auch nicht gewusst: die Liste ragte bei 683×384 aus dem
  // Bild, und hier war alles grün. Die echte Messung steht seit R7 in
  // `tests/design/job3337-palette-flaches-fenster-chromium.test.ts` (Chromium, BENs Maß).
  // Dieser Fall bleibt trotzdem nützlich, aber als das, was er ist: ein billiger Wächter über die
  // drei Klassen, an denen die Begrenzung hängt — `min-h-0` ist die wichtigste davon, ohne sie
  // weigert sich ein Flex-Kind mit eigenem Überlauf zu schrumpfen und der R6-Fehler wäre zurück.
  it("F3 · die Liste ist scrollbar begrenzt und darf schrumpfen — die letzte Zeile bleibt erreichbar", async () => {
    const s = await paletteMitEingabe("");
    const liste = s.container.querySelector("ul");
    expect(liste?.className).toContain("overflow-y-auto");
    expect(liste?.className).toContain("max-h-80");
    expect(
      liste?.className,
      "ohne `min-h-0` schrumpft die Liste im engen Fenster nicht — der R6-Befund wäre zurück",
    ).toContain("min-h-0");
    // Die letzte Zeile ist wirklich im Baum (nicht abgeschnitten gerendert).
    const kennungen = trefferKennungen(s);
    expect(kennungen.length).toBeGreaterThan(20);
    expect(
      s.container.querySelector(`[data-cmd-ziel="${kennungen[kennungen.length - 1]}"]`),
    ).not.toBeNull();
  });
});
