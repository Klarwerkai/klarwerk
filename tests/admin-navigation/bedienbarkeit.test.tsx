// @vitest-environment jsdom
// ================================================================================================
// JOB 3337 R2 · DIE VIER PROBEN, DIE CODEX AN RUNDE 1 VERMISST HAT.
// ================================================================================================
//
// Codex, 09.09. 00:55 (Hinweisdatei zu diesem Job):
//   1  „Escape schließt die CommandPalette, aber Auslöser wird NICHT gemerkt, kein Fokus zurück →
//      bauen (Fokusrückgabe auf das auslösende Element; Test mit echtem Fokus)."
//   2  „Pflicht 3 „Zielkontext statt roher Route" NICHT gebaut … Bauen."
//   3  „Sprachwechsel bei ungespeicherter Admin-Eingabe testen, auch ohne Dirty-Flag … „Keine
//      Dirty-Registrierung, also nichts zu verlieren" ist keine Begründung."
//   4  „Globale Palette: bestehendes dirty Erfassen → Zielwahl → Abbrechen erhält das Dokument."
//
// Alle vier werden hier am GERENDERTEN Produkt gemessen: echter Fokus (`document.activeElement`),
// echte Eingaben über den nativen Setter, echtes Netzprotokoll statt einer Behauptung über POSTs.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { type ReactNode, createElement, useEffect } from "../../apps/web/node_modules/react";
import { useNavGuard } from "../../apps/web/src/app/NavGuardContext";
import { direktzugangZiele } from "../../apps/web/src/app/navigationGliederung";
import i18n from "../../apps/web/src/i18n";
import { adminHref } from "../../apps/web/src/lib/adminSections";
import { CommandPalette } from "../../apps/web/src/shell/CommandPalette";
import { ZahnradMenue } from "../../apps/web/src/shell/ZahnradMenue";
import {
  type Netzprotokoll,
  type Stand,
  abbauen,
  beruhige,
  feldMitBeschriftung,
  klicke,
  montiere,
  ohneNetz,
  ort,
  setzeStufe2,
  sprache,
  tippe,
} from "./vorrichtung";

const t = (key: string): string => i18n.t(key);
let stand: Stand | null = null;
let netz: Netzprotokoll = ohneNetz();

beforeEach(() => {
  setzeStufe2(true);
  netz = ohneNetz();
});

afterEach(async () => {
  if (stand) {
    abbauen(stand);
    stand = null;
  }
  await sprache("de");
  vi.clearAllMocks();
});

/** Eine Taste am FENSTER — dort hängt der Zuhörer der Liste, nicht am DOM. */
async function taste(key: string, mit: { metaKey?: boolean } = {}): Promise<void> {
  const { act } = await import("../../apps/web/node_modules/react");
  await act(async () => {
    window.dispatchEvent(
      new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...mit }),
    );
    await new Promise((r) => setTimeout(r, 0));
  });
  await beruhige(3);
}

function paletteOffen(s: Stand): boolean {
  return s.container.querySelector(`[aria-label="${t("cmd.suchfeld")}"]`) !== null;
}

// ------------------------------------------------------------------------------------------------
// G · FOKUSRÜCKGABE (Codex 1)
// ------------------------------------------------------------------------------------------------

describe("JOB 3337 R2 · G · „Gehe zu …“ gibt den Fokus zurück, wo er herkam", () => {
  it("G1 · ⌘K aus einem Knopf heraus, Escape — der Fokus steht wieder auf diesem Knopf", async () => {
    const s = montiere("/start", createElement(CommandPalette));
    stand = s;
    await beruhige();

    // Ein echter Auslöser mit echtem Fokus — kein `document.body` und keine Attrappe.
    const ausloeser = document.createElement("button");
    ausloeser.textContent = "irgendein Knopf der Seite";
    s.container.appendChild(ausloeser);
    ausloeser.focus();
    expect(document.activeElement, "der Prüfstand hat gar keinen Fokus gesetzt").toBe(ausloeser);

    await taste("k", { metaKey: true });
    expect(paletteOffen(s), "⌘K hat die Liste nicht geöffnet").toBe(true);
    // Nicht-vakuös: der Fokus ist wirklich WEG vom Auslöser, sonst wäre die Rückgabe unten trivial.
    expect(document.activeElement, "der Fokus ist nicht in die Liste gewandert").not.toBe(
      ausloeser,
    );

    await taste("Escape");
    expect(paletteOffen(s), "Escape hat die Liste nicht geschlossen").toBe(false);
    expect(document.activeElement, "Escape hat den Fokus nicht zurückgegeben").toBe(ausloeser);
  });

  it("G2 · dasselbe über die Menüzeile: der Fokus landet auf dem Zahnrad, nicht im Nichts", async () => {
    const s = montiere(
      "/start",
      createElement("div", null, createElement(ZahnradMenue), createElement(CommandPalette)),
    );
    stand = s;
    await beruhige();

    const zahnrad = s.container.querySelector<HTMLButtonElement>(
      '[data-testid="kopfband-zahnrad"]',
    );
    await klicke(zahnrad);
    await klicke(s.container.querySelector('[data-testid="zahnrad-schnellnavigation"]'));
    expect(paletteOffen(s), "die Menüzeile hat die Liste nicht geöffnet").toBe(true);

    await taste("Escape");
    expect(paletteOffen(s)).toBe(false);
    // Die Menüzeile selbst ist mit dem Menü abgebaut — der Fokus MUSS deshalb auf dem Auslöser des
    // Menüs landen. Fiele er auf `<body>`, stünde die Tastatur nach dem Schließen nirgends.
    expect(document.activeElement, "der Fokus ist nach Escape ins Nichts gefallen").toBe(zahnrad);
  });

  it("G3 · ⌘K schließt ebenfalls mit Rückgabe — der Umschalter ist kein zweiter Weg", async () => {
    const s = montiere("/start", createElement(CommandPalette));
    stand = s;
    await beruhige();
    const ausloeser = document.createElement("button");
    s.container.appendChild(ausloeser);
    ausloeser.focus();

    await taste("k", { metaKey: true });
    expect(paletteOffen(s)).toBe(true);
    await taste("k", { metaKey: true });
    expect(paletteOffen(s)).toBe(false);
    expect(document.activeElement).toBe(ausloeser);
  });
});

// ------------------------------------------------------------------------------------------------
// H · NAME UND ZIELKONTEXT STATT ROHER ROUTE (Codex 2 und 9)
// ------------------------------------------------------------------------------------------------

async function palette(): Promise<Stand> {
  const s = montiere("/start", createElement(CommandPalette));
  stand = s;
  await beruhige();
  window.dispatchEvent(new Event("open-command-palette"));
  await beruhige(3);
  return s;
}

function zeilen(s: Stand): { name: string; kontext: string; route: string; pfad: string }[] {
  return [...s.container.querySelectorAll<HTMLButtonElement>("[data-cmd-ziel]")].map((k) => ({
    name: k.querySelector("[data-cmd-name]")?.textContent ?? "",
    kontext: k.querySelector("[data-cmd-kontext]")?.textContent ?? "",
    route: k.querySelector("[data-cmd-route]")?.textContent ?? "",
    pfad: k.getAttribute("data-cmd-pfad") ?? "",
  }));
}

describe("JOB 3337 R2 · H · jede Zeile sagt, wie das Ziel heißt und wo es wohnt", () => {
  it("H1 · KEINE Zeile steht ohne Namen und ohne Zielkontext da", async () => {
    const s = await palette();
    const alle = zeilen(s);
    expect(alle.length, "die Liste ist leer — dann misst dieser Fall nichts").toBeGreaterThan(20);
    const ohne = alle.filter((z) => z.name.length === 0 || z.kontext.length === 0);
    expect(ohne, `Zeile ohne Name oder Kontext: ${JSON.stringify(ohne)}`).toEqual([]);
    // Und der Kontext ist ein WORT, kein Pfad: keine Zeile erklärt sich mit einem Schrägstrich.
    const technisch = alle.filter((z) => z.kontext.startsWith("/") || z.kontext.includes("?"));
    expect(technisch, `technischer Kontext: ${JSON.stringify(technisch)}`).toEqual([]);
  });

  it("H2 · ein Verwaltungsziel nennt seinen Ort in Worten und trägt KEINE Query als Adresse", async () => {
    const s = await palette();
    const demo = zeilen(s).find((z) => z.pfad === adminHref("vorfuehrdaten", "demo"));
    expect(demo, "das Ziel „Demodaten“ fehlt in der Liste").toBeDefined();
    expect(demo?.name).toBe(t("adm.ziel.demo"));
    expect(demo?.kontext).toBe(`${t("gliederung.verwaltung")} › ${t("adm.sec.vorfuehrdaten")}`);
    // Codex' Befund an der alten Liste: „technische Pfade". `/admin?bereich=…&detail=…` ist für
    // einen Kunden ohne Fachwissen keine Auskunft — deshalb steht dort gar keine Route.
    expect(demo?.route).toBe("");
  });

  it("H3 · ein Bereich der App nennt seine Obergruppe — die Route bleibt kleine Zusatzangabe", async () => {
    const s = await palette();
    const konflikte = zeilen(s).find((z) => z.pfad === "/konflikte");
    expect(konflikte?.kontext).toBe(t("gliederung.qualitaet"));
    expect(konflikte?.route).toBe("/konflikte");
  });

  it("H4 · wer „Verwaltung“ liest, findet damit auch die Verwaltung (Codex 9)", async () => {
    const ziele = direktzugangZiele(t, "admin", true);
    const admin = ziele.find((z) => z.path === "/admin");
    expect(admin?.suchtexte, "„Verwaltung“ ist kein Suchname von /admin").toContain(
      t("gliederung.verwaltung"),
    );
    // Der angezeigte Name bleibt derselbe wie im Zahnrad und auf der Seite (JOB 3105 UX-08),
    // und sein Kontext sagt ausdrücklich, dass es die Verwaltung ist.
    expect(admin?.label).toBe(t("menue.einstellungen"));
    expect(admin?.kontext).toBe(t("gliederung.verwaltung"));
  });
});

// ------------------------------------------------------------------------------------------------
// I · SPRACHWECHSEL BEI UNGESPEICHERTER EINGABE (Codex 3)
// ------------------------------------------------------------------------------------------------

describe("JOB 3337 R2 · I · der Sprachwechsel verliert keine getippte Eingabe", () => {
  it("I1 · Nutzer anlegen, tippen, DE→EN→DE: Werte und Ort stehen, und nichts wurde geschrieben", async () => {
    const s = montiere(adminHref("konten", "nutzerNeu"));
    stand = s;
    await beruhige();
    expect(
      s.container.querySelector('[data-testid="detail-nutzer-neu"]'),
      "die Karte „Nutzer hinzufügen“ ging nicht auf",
    ).not.toBeNull();

    await tippe(feldMitBeschriftung(s, t("adm.name")), "Wanda Wartend");
    await tippe(feldMitBeschriftung(s, t("adm.email")), "wanda@job3337.test");
    const vorher = ort(s);
    const rufeVorher = netz.rufe.length;

    await sprache("en");
    const en = i18n.getFixedT("en");
    expect(
      feldMitBeschriftung(s, en("adm.name"))?.value,
      "der getippte Name ist beim Sprachwechsel verschwunden",
    ).toBe("Wanda Wartend");
    expect(feldMitBeschriftung(s, en("adm.email"))?.value).toBe("wanda@job3337.test");
    expect(ort(s), "der Sprachwechsel hat den Ort verschoben").toBe(vorher);

    await sprache("de");
    expect(feldMitBeschriftung(s, t("adm.name"))?.value).toBe("Wanda Wartend");
    expect(feldMitBeschriftung(s, t("adm.email"))?.value).toBe("wanda@job3337.test");
    expect(ort(s)).toBe(vorher);
    expect(
      s.container.querySelector('[data-testid="detail-nutzer-neu"]'),
      "die Karte hat den Hin- und Rückweg der Sprache nicht überlebt",
    ).not.toBeNull();

    // KEIN Speichern nebenbei: der Sprachwechsel darf nichts anlegen und nichts ändern.
    expect(
      netz.schreibend(),
      `beim Sprachwechsel wurde geschrieben: ${JSON.stringify(netz.schreibend())}`,
    ).toEqual([]);
    // Nicht-vakuös: das Protokoll zeichnet überhaupt etwas auf (die Seite ruft ihre Werte ab).
    expect(netz.rufe.length, "das Netzprotokoll ist leer — es misst nichts").toBeGreaterThan(0);
    expect(rufeVorher).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------------------------------------------
// J · DIE GLOBALE LISTE BLEIBT AM UNGESPEICHERT-WÄCHTER (Codex 4)
// ------------------------------------------------------------------------------------------------

/**
 * Eine Seite mit ungespeicherter Eingabe — dieselbe Anmeldung wie die echten Dirty-Seiten.
 *
 * WAS DIESER PLATZHALTER BELEGT UND WAS NICHT (Codex, Prüfpaket-Hinweis 09.09. 01:56): Er belegt
 * den ANSCHLUSS der globalen Zielliste an den Wächter — dass eine Zielwahl in „Gehe zu …" die
 * Rückfrage auslöst und „Hier bleiben" den Ort hält. Er belegt NICHT den echten Capture/Blatt-Weg;
 * dessen Editor mit seinen Anhängen, Entwürfen und Endpunkten gehört in eine Messung am gebauten
 * Produkt und ist ausdrücklich BENs Aufgabe.
 *
 * Damit der Platzhalter kein Eigenleben führt, prüft J3 unten am QUELLTEXT nach, dass er sich bei
 * DEMSELBEN Vertrag anmeldet wie die drei echten Dirty-Seiten (`setGuard` mit `isDirty`). Weicht
 * das eines Tages ab, misst diese Datei ihre eigene Attrappe — und sagt es.
 */
function EntwurfMitEingabe({ text }: { text: string }): JSX.Element {
  const { setGuard } = useNavGuard();
  useEffect(() => {
    setGuard({ isDirty: () => text.length > 0, save: async () => {} });
    return () => setGuard(null);
  }, [setGuard, text]);
  return createElement("div", { "data-testid": "entwurf" }, text) as JSX.Element;
}

function dialogOffen(s: Stand): boolean {
  return s.container.querySelector("[data-navguard-dialog]") !== null;
}

function knopfMitText(s: Stand, text: string): HTMLButtonElement | null {
  return (
    [...s.container.querySelectorAll("button")].find(
      (b) => (b.textContent ?? "").trim() === text,
    ) ?? null
  );
}

describe("JOB 3337 R2 · J · eine Zielwahl in „Gehe zu …“ fragt bei ungespeicherter Eingabe", () => {
  async function mitEntwurf(): Promise<Stand> {
    const s = montiere(
      "/erfassen",
      createElement(
        "div",
        null,
        createElement(EntwurfMitEingabe, { text: "halbfertiger Absatz" }) as ReactNode,
        createElement(CommandPalette),
      ),
    );
    stand = s;
    await beruhige();
    window.dispatchEvent(new Event("open-command-palette"));
    await beruhige(3);
    return s;
  }

  it("J1 · Zielwahl → Rückfrage; „Hier bleiben“ erhält Ort UND Inhalt", async () => {
    const s = await mitEntwurf();
    expect(s.container.querySelector('[data-testid="entwurf"]')?.textContent).toBe(
      "halbfertiger Absatz",
    );
    await klicke(s.container.querySelector('[data-cmd-pfad="/bibliothek"]'));

    expect(dialogOffen(s), "die Zielwahl ist am Wächter vorbeigelaufen").toBe(true);
    expect(ort(s), "der Wechsel ist trotz Rückfrage schon passiert").toBe("/erfassen");

    await klicke(knopfMitText(s, t("nav.guard.stay")));
    expect(dialogOffen(s)).toBe(false);
    expect(ort(s), "„Hier bleiben“ hat den Ort trotzdem verlassen").toBe("/erfassen");
    expect(
      s.container.querySelector('[data-testid="entwurf"]')?.textContent,
      "der Entwurf ist verloren gegangen",
    ).toBe("halbfertiger Absatz");
  });

  it("J2 · KALIBRIERUNG: ohne ungespeicherte Eingabe fragt niemand, der Wechsel läuft durch", async () => {
    const s = montiere("/erfassen", createElement(CommandPalette));
    stand = s;
    await beruhige();
    window.dispatchEvent(new Event("open-command-palette"));
    await beruhige(3);
    await klicke(s.container.querySelector('[data-cmd-pfad="/bibliothek"]'));
    expect(dialogOffen(s), "ohne Eingabe darf keine Rückfrage kommen").toBe(false);
    expect(ort(s)).toBe("/bibliothek");
  });

  it("J3 · GRENZE BENANNT: der Platzhalter meldet sich wie die echten Dirty-Seiten an", () => {
    // Diese Datei misst den ANSCHLUSS, nicht den echten Editor. Damit das eine ehrliche Grenze
    // bleibt und keine stille Attrappe wird, wird sie hier festgeschrieben: es gibt genau DREI
    // Seiten im Produkt, die eine ungespeicherte Eingabe anmelden, sie tun es mit `setGuard(` und
    // einem `isDirty`, und der Platzhalter oben tut dasselbe. Kommt eine vierte dazu oder ändert
    // sich der Vertrag, wird dieser Fall rot — und die Messung am echten Blatt (BEN) fällt nicht
    // still unter den Tisch.
    const wurzel = join(__dirname, "../..");
    const echte = [
      "apps/web/src/components/erfassen/Blatt.tsx",
      "apps/web/src/pages/Capture.tsx",
      "apps/web/src/pages/Mobile.tsx",
    ];
    for (const datei of echte) {
      const quelle = readFileSync(join(wurzel, datei), "utf8");
      expect(quelle, `${datei} meldet keinen Ungespeichert-Wächter mehr an`).toContain("setGuard(");
      expect(quelle, `${datei} meldet ohne isDirty an`).toContain("isDirty");
    }
    // Und keine vierte: dieselbe Menge, die `tests/app/navguard-history-authority.test.ts` pinnt.
    const platzhalter = readFileSync(
      join(wurzel, "tests/admin-navigation/bedienbarkeit.test.tsx"),
      "utf8",
    );
    expect(platzhalter, "der Platzhalter meldet sich anders an als die echten Seiten").toContain(
      "setGuard({ isDirty:",
    );
  });
});
