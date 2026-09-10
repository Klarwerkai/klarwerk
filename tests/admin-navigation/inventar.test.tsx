// @vitest-environment jsdom
// ================================================================================================
// JOB 3337 · ADMIN-NAVIGATION — DAS INVENTAR: KEIN ZIEL OHNE WEG, ÜBER MENÜ **UND** „GEHE ZU".
// ================================================================================================
//
// Pedi 08.09.: „Die Direktfunktion ist unvollständig und schwer zu erkennen."
//
// Codex hat gemessen, WORIN sie unvollständig war (`ADMIN-NAVIGATION-AUFTRAG.md`, Livebefund an
// 1.0.0-beta.1.198): „Admin-Unterziele wie KI-Zugänge, Demodaten und Papierkorb fehlen tatsächlich
// als direkte Einträge dieser Liste." Und die Vorlage nennt den Prüfmaßstab namentlich: 20
// ALL_ITEMS-Ziele plus der Audit-Deep-Link, dazu 17 Admin-Detailkennungen.
//
// JOB 3503 hat die Navigationsquelle um „Meine Entwürfe" (`/entwuerfe`) erweitert — es sind seither
// 21 ALL_ITEMS-Ziele. Die Zahl unten ist nachgeführt, die Regel unverändert: JEDES Ziel der Quelle
// braucht einen Weg im Direktzugang und einen Ort im Menü, sonst ist dieser Test rot. Genau das ist
// der Grund, warum der neue Punkt in `NAV_GROUPS` steht und nicht in einer Nebenliste: nur so wird
// er von „Gehe zu …" überhaupt gesehen.
//
// DIE 17 STEHEN NICHT IN DIESER DATEI. Sie werden aus `pages/Admin.tsx` GELESEN — aus den
// `case`-Zweigen und den beiden `startsWith`-Präfixen des Detail-Switch. Eine abgeschriebene Liste
// wäre eine zweite Wahrheit: sie bliebe grün, wenn morgen eine Karte aus dem Switch fiele. So wird
// jede künftige Kennung automatisch Gegenstand — und eine ohne Weg macht diesen Test rot.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Ohne Netz: die Rolle kommt aus einer echten, aber abgeschnittenen Sitzung.
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
import { ALL_ITEMS } from "../../apps/web/src/app/navigation";
import {
  OBERGRUPPEN,
  direktzugangZiele,
  isAdminDetailId,
} from "../../apps/web/src/app/navigationGliederung";
import i18n from "../../apps/web/src/i18n";
import { ADMIN_DETAILS, ADMIN_SECTIONS, adminHref } from "../../apps/web/src/lib/adminSections";
import { ANALYTICS_AUDIT_PATH } from "../../apps/web/src/lib/analyticsSections";
import { CommandPalette } from "../../apps/web/src/shell/CommandPalette";
import { KopfbandPunkteListe } from "../../apps/web/src/shell/KopfbandPunkte";
import { ZahnradEintraege } from "../../apps/web/src/shell/ZahnradMenue";
import {
  type Stand,
  abbauen,
  beruhige,
  klicke,
  montiere,
  ohneNetz,
  setzeStufe2,
  sprache,
} from "./vorrichtung";

const WURZEL = join(__dirname, "../..");
const t = (key: string): string => i18n.t(key);

let stand: Stand | null = null;

beforeEach(() => {
  setzeStufe2(true);
  // Je Fall ein frischer Prüfstand ohne Netz — kein Fall sieht die Rufe eines anderen.
  ohneNetz();
});

afterEach(async () => {
  if (stand) {
    abbauen(stand);
    stand = null;
  }
  await sprache("de");
  vi.clearAllMocks();
});

// ------------------------------------------------------------------------------------------------
// DAS INVENTAR, ABGELEITET STATT ABGESCHRIEBEN.
// ------------------------------------------------------------------------------------------------

/** Jede Detailkennung, die der Switch in `pages/Admin.tsx` wirklich bedient. */
function kennungenAusQuelltext(): string[] {
  const quelle = readFileSync(join(WURZEL, "apps/web/src/pages/Admin.tsx"), "utf8");
  const schalter = quelle.slice(quelle.indexOf("function detailKarte("));
  const faelle = [...schalter.matchAll(/case "([a-zA-Z]+)":/g)].map((m) => m[1] ?? "");
  const dynamisch = [...schalter.matchAll(/detail\.startsWith\("([a-zA-Z]+):"\)/g)].map(
    (m) => `${m[1]}:`,
  );
  return [...dynamisch, ...faelle];
}

/** Die Ziele des Direktzugangs für einen Admin mit Stufe 2 — dieselbe Quelle wie die Fläche. */
function alleZiele(): ReturnType<typeof direktzugangZiele> {
  return direktzugangZiele(t, "admin", true);
}

describe("JOB 3337 · A · der Bestand ist vollständig und adressierbar", () => {
  it("A0 · KALIBRIERUNG: der Griff in den Quelltext greift die 17 Kennungen der Vorlage", () => {
    const kennungen = kennungenAusQuelltext();
    // Die Vorlage nennt 17. Weniger hieße: der Griff hat den Switch verfehlt (und alles Folgende
    // wäre über einer zu kleinen Menge trivial grün).
    expect(kennungen, `gefunden: ${kennungen.join(" · ")}`).toHaveLength(17);
    for (const pflicht of ["nutzer:", "rolle:", "ki", "demo", "werk", "papierkorb", "audit"]) {
      expect(kennungen).toContain(pflicht);
    }
  });

  it("A1 · jede Kennung ist ein erlaubter Navigationswert und hat ein Thema", () => {
    const ohneThema: string[] = [];
    for (const kennung of kennungenAusQuelltext()) {
      const beispiel = kennung.endsWith(":")
        ? `${kennung}${kennung === "rolle:" ? "admin" : "u-1"}`
        : kennung;
      if (!isAdminDetailId(beispiel)) {
        ohneThema.push(`${kennung}: nicht adressierbar`);
      }
    }
    expect(ohneThema, ohneThema.join(" · ")).toEqual([]);
  });

  it("A2 · alle 22 Routenziele der Vorlage stehen im Direktzugang", () => {
    const pfade = alleZiele().map((z) => z.path);
    const fehlend = [...ALL_ITEMS.map((i) => i.path), ANALYTICS_AUDIT_PATH].filter(
      (p) => !pfade.includes(p),
    );
    expect(ALL_ITEMS, "die Quelle selbst ist geschrumpft").toHaveLength(21);
    expect(fehlend, `ohne Weg im Direktzugang: ${fehlend.join(" · ")}`).toEqual([]);
  });

  it("A3 · jede statische Detailkennung ist ein EIGENES Ziel des Direktzugangs", () => {
    const ziele = alleZiele();
    const statisch = kennungenAusQuelltext().filter((k) => !k.endsWith(":"));
    const fehlend = statisch.filter((k) => !ziele.some((z) => z.path === adminHref(sekt(k), k)));
    expect(statisch, "der Griff fand keine statische Kennung").toHaveLength(15);
    expect(fehlend, `kein direktes Ziel: ${fehlend.join(" · ")}`).toEqual([]);
  });

  it("A4 · und jedes Thema der Verwaltung ist selbst adressierbar", () => {
    const pfade = alleZiele().map((z) => z.path);
    const fehlend = ADMIN_SECTIONS.filter((s) => !pfade.includes(adminHref(s.id))).map((s) => s.id);
    expect(ADMIN_SECTIONS, "die sieben Themen der Vorlage").toHaveLength(7);
    expect(fehlend, `Thema ohne Weg: ${fehlend.join(" · ")}`).toEqual([]);
  });

  it("A5 · kein personenbezogener Name in der globalen Liste (Vorlage, Vollständigkeitsinventar)", () => {
    // Der Doppelpunkt ist der Unterschied: `detail=nutzerNeu` ist die (unbedenkliche) Karte
    // „Nutzer hinzufügen", `detail=nutzer%3A<id>` wäre eine benannte Person.
    const dynamisch = alleZiele().filter(
      (z) => z.path.includes("detail=nutzer%3A") || z.path.includes("detail=rolle%3A"),
    );
    expect(dynamisch.map((z) => z.label)).toEqual([]);
  });

  it("A6 · jedes Ziel trägt genau eine der vier Obergruppen", () => {
    const bekannt = new Set(OBERGRUPPEN.map((g) => g.id));
    const fremd = alleZiele().filter((z) => !bekannt.has(z.gruppe));
    expect(OBERGRUPPEN).toHaveLength(4);
    expect(fremd.map((z) => `${z.label}: ${z.gruppe}`)).toEqual([]);
  });
});

/** Das Thema einer statischen Kennung — aus der Registry, nicht geraten. */
function sekt(kennung: string): (typeof ADMIN_SECTIONS)[number]["id"] {
  const ziel = ADMIN_DETAILS.find((d) => d.id === kennung);
  if (!ziel) {
    throw new Error(`Kennung ohne Registereintrag: ${kennung}`);
  }
  return ziel.section;
}

// ------------------------------------------------------------------------------------------------
// DER WEG ÜBER „GEHE ZU" — an der gerenderten Fläche, nicht an der Datenquelle.
// ------------------------------------------------------------------------------------------------

function paletteOeffnen(): Promise<void> {
  return new Promise((aufloesen) => {
    window.dispatchEvent(new Event("open-command-palette"));
    setTimeout(aufloesen, 0);
  });
}

async function palette(eingabe?: string): Promise<Stand> {
  const s = montiere("/start", createElement(CommandPalette));
  stand = s;
  await beruhige();
  await paletteOeffnen();
  await beruhige(3);
  if (eingabe !== undefined) {
    const feld = s.container.querySelector<HTMLInputElement>(
      `input[aria-label="${t("cmd.suchfeld")}"]`,
    );
    if (!feld) {
      throw new Error("Die Liste „Gehe zu …“ hat kein benanntes Suchfeld.");
    }
    const setzer = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    await beruhige(0);
    await klicke(feld);
    setzer?.call(feld, eingabe);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await beruhige(3);
  }
  return s;
}

/** Die Kennungen der gerenderten Trefferzeilen (`data-cmd-ziel`). */
function trefferKennungen(s: Stand): string[] {
  return [...s.container.querySelectorAll("[data-cmd-ziel]")].map(
    (b) => b.getAttribute("data-cmd-ziel") ?? "",
  );
}

describe("JOB 3337 · B · der Direktzugang „Gehe zu …“ auf der Fläche", () => {
  it("B0 · KALIBRIERUNG: die Sitzung ist wirklich Admin, sonst wäre alles Folgende leer", async () => {
    const s = await palette();
    expect(trefferKennungen(s)).toContain("nav:admin");
  });

  it("B1 · alle Routenziele UND alle statischen Verwaltungsziele stehen als Zeile darin", async () => {
    const s = await palette();
    const gerendert = trefferKennungen(s);
    const erwartet = [
      ...ALL_ITEMS.map((i) => `nav:${i.id}`),
      "deep:audit",
      ...kennungenAusQuelltext()
        .filter((k) => !k.endsWith(":"))
        .map((k) => `det:${k}`),
      ...ADMIN_SECTIONS.map((sec) => `sec:${sec.id}`),
    ];
    const fehlend = erwartet.filter((id) => !gerendert.includes(id));
    expect(fehlend, `nicht in „Gehe zu …“: ${fehlend.join(" · ")}`).toEqual([]);
  });

  it("B2 · die Liste sagt, wie viele Ziele dastehen, und ordnet sie unter den vier Obergruppen", async () => {
    const s = await palette();
    const zahl = s.container.querySelector('[data-cmd="trefferzahl"]')?.textContent ?? "";
    expect(zahl).toContain(String(trefferKennungen(s).length));
    const gruppen = [...s.container.querySelectorAll("[data-cmd-gruppe]")].map(
      (g) => g.getAttribute("data-cmd-gruppe") ?? "",
    );
    // Ein Admin mit Stufe 2 sieht Ziele in ALLEN vier Gruppen — keine bleibt leer.
    expect([...gruppen].sort()).toEqual(["arbeiten", "persoenlich", "qualitaet", "verwaltung"]);
  });

  it("B3 · das Suchfeld hat einen eigenen zugänglichen Namen (Codex' Livebefund)", async () => {
    const s = await palette();
    const feld = s.container.querySelector(`input[aria-label="${t("cmd.suchfeld")}"]`);
    expect(feld, "Suchfeld ohne zugänglichen Namen").not.toBeNull();
    // Nicht-vakuös: der Name ist ein Name und nicht der durchgereichte Schlüssel.
    expect(t("cmd.suchfeld")).not.toBe("cmd.suchfeld");
  });

  it("B4 · die Kunden-Suchbegriffe der Abnahme finden ihr Ziel (DE)", async () => {
    for (const [eingabe, kennung] of [
      ["Demodaten", "det:demo"],
      ["Papierkorb", "det:papierkorb"],
      ["Prüfprotokoll", "det:protokoll"],
      ["audit", "deep:audit"],
      ["KI-Anbieter", "det:ki"],
      ["Import", "nav:import"],
    ] as const) {
      const s = await palette(eingabe);
      expect(trefferKennungen(s), `„${eingabe}“ findet ${kennung} nicht`).toContain(kennung);
      abbauen(s);
      stand = null;
    }
  });

  it("B5 · dieselben Fragen auf Englisch", async () => {
    await sprache("en");
    for (const [eingabe, kennung] of [
      ["demo data", "det:demo"],
      ["trash", "det:papierkorb"],
      ["audit", "deep:audit"],
    ] as const) {
      const s = await palette(eingabe);
      expect(trefferKennungen(s), `„${eingabe}“ findet ${kennung} nicht (en)`).toContain(kennung);
      abbauen(s);
      stand = null;
    }
  });
});

// ------------------------------------------------------------------------------------------------
// DER WEG ÜBER DAS MENÜ.
// ------------------------------------------------------------------------------------------------

describe("JOB 3337 · C · der Weg über das Menü", () => {
  it("C1 · jedes Routenziel steht im Kopfband, unter „Bereiche“ oder als Zeile „Einstellungen“", async () => {
    const s = montiere(
      "/start",
      createElement(
        "div",
        null,
        createElement(KopfbandPunkteListe),
        createElement(ZahnradEintraege),
      ),
    );
    stand = s;
    await beruhige();
    // Das Untermenü „Bereiche" aufklappen — geschlossen steht sein Inhalt gar nicht im DOM.
    await klicke(s.container.querySelector('[data-testid="zahnrad-weitere-bereiche"]'));

    const erreichbar = new Set<string>();
    for (const el of s.container.querySelectorAll("[data-testid]")) {
      const id = el.getAttribute("data-testid") ?? "";
      if (id.startsWith("drawer-punkt-")) {
        erreichbar.add(id.slice("drawer-punkt-".length));
      }
      if (id.startsWith("bereich-")) {
        erreichbar.add(id.slice("bereich-".length));
      }
      if (id === "zahnrad-einstellungen") {
        erreichbar.add("admin");
      }
    }
    const fehlend = ALL_ITEMS.map((i) => i.id).filter((id) => !erreichbar.has(id));
    expect(fehlend, `ohne Weg im Menü: ${fehlend.join(" · ")}`).toEqual([]);
  });

  it("C2 · die „Bereiche“ tragen die Obergruppen, und „Verwaltung“ steht ausdrücklich dabei", async () => {
    const s = montiere("/start", createElement(ZahnradEintraege));
    stand = s;
    await beruhige();
    await klicke(s.container.querySelector('[data-testid="zahnrad-weitere-bereiche"]'));
    const gruppen = [...s.container.querySelectorAll("[data-bereichsgruppe]")].map(
      (g) => g.getAttribute("data-bereichsgruppe") ?? "",
    );
    expect(gruppen).toEqual(["arbeiten", "qualitaet", "verwaltung", "persoenlich"]);
    // Und das Wort selbst steht da — nicht nur eine Kennung im Datenattribut.
    expect(s.container.textContent).toContain(t("gliederung.verwaltung"));
  });

  it("C3 · jede Verwaltungskarte hat eine Zeile, die GENAU SIE öffnet — Kennung und Ort geprüft", async () => {
    // JOB 3337 R2 (Codex, Befund 8): bis hierher prüfte dieser Fall nach dem Klick nur, dass
    // „irgendeine Detailkarte" offen ist. Zwei Zeilen, die dieselbe falsche Karte öffnen, wären
    // damit grün gewesen. Jetzt wird JE ZIEL nachgesehen, welche Kennung in der Adresse steht, in
    // welchem Thema sie landet und dass der lesbare Pfad denselben Namen trägt wie die Zeile.
    const befunde: string[] = [];
    for (const kennung of kennungenAusQuelltext().filter((k) => !k.endsWith(":"))) {
      const ziel = ADMIN_DETAILS.find((d) => d.id === kennung);
      if (!ziel) {
        befunde.push(`${kennung}: kein Registereintrag`);
        continue;
      }
      const s = montiere(adminHref(ziel.section));
      stand = s;
      await beruhige();
      const oeffner = [
        ...s.container.querySelectorAll('[data-einst="zeile"], [data-einst="flaechenknopf"]'),
      ].find((el) => (el.textContent ?? "").trim().startsWith(t(ziel.labelKey)));
      if (!oeffner) {
        befunde.push(`${kennung}: keine Zeile „${t(ziel.labelKey)}“ unter ${ziel.section}`);
      } else {
        await klicke(oeffner);
        const wegDanach = ortVon(s);
        const sollWeg = adminHref(ziel.section, ziel.id);
        if (s.container.querySelector('[data-einst="detail"]') === null) {
          befunde.push(`${kennung}: die Zeile öffnet keine Karte`);
        } else if (wegDanach !== sollWeg) {
          befunde.push(`${kennung}: führt nach „${wegDanach}“ statt nach „${sollWeg}“`);
        } else {
          // Der lesbare Pfad über der Karte nennt dasselbe Ziel, das die Zeile versprochen hat.
          const pfad = s.container.querySelector('[data-einst="pfad"]')?.textContent ?? "";
          if (!pfad.endsWith(t(ziel.labelKey))) {
            befunde.push(`${kennung}: Pfad „${pfad}“ endet nicht auf „${t(ziel.labelKey)}“`);
          }
        }
      }
      abbauen(s);
      stand = null;
    }
    expect(befunde, befunde.join(" · ")).toEqual([]);
  });

  it("C4 · auch die beiden personenbezogenen Karten gehen auf — an echtem Bestand", async () => {
    // JOB 3337 R2 (Codex, Befund 8): Runde 1 klickte hier nur die ROLLENZEILE und behauptete die
    // Nutzerkarte. Jetzt liegt ein Nutzer im Bestand, seine Zeile wird geöffnet, und geprüft wird,
    // dass GENAU SEINE Kennung in der Adresse steht und SEIN Name in der Karte.
    ohneNetz({
      "/api/users": [
        {
          id: "u-wanda",
          name: "Wanda Wartend",
          email: "wanda@job3337.test",
          role: "experte",
          approved: false,
        },
      ],
    });
    const s = montiere(adminHref("konten"));
    stand = s;
    await beruhige();

    const nutzerzeile = [
      ...s.container.querySelectorAll('[data-testid="flaeche-nutzer"] [data-einst="zeile"]'),
    ].find((el) => (el.textContent ?? "").includes("Wanda Wartend"));
    expect(nutzerzeile, "der Bestand steht nicht auf der Fläche").toBeDefined();
    await klicke(nutzerzeile);
    expect(s.container.querySelector('[data-testid="detail-nutzer"]')).not.toBeNull();
    expect(ortVon(s)).toContain("detail=nutzer%3Au-wanda");
    expect(
      s.container.querySelector('[data-testid="detail-nutzer"]')?.textContent,
      "die geöffnete Karte gehört nicht zu diesem Nutzer",
    ).toContain("wanda@job3337.test");

    // Und die Rollenkarte daneben, mit derselben Schärfe — nach dem Rückweg, denn solange eine
    // Karte offen ist, steht die Übersicht (und damit die Rollenzeile) nicht im DOM.
    await klicke(s.container.querySelector('[data-einst="zurueck"]'));
    await klicke(s.container.querySelector('[data-testid="zeile-rolle-viewer"]'));
    expect(s.container.querySelector('[data-einst="detail"]')).not.toBeNull();
    expect(ortVon(s)).toContain("detail=rolle%3Aviewer");
  });
});

function ortVon(s: Stand): string {
  return s.container.querySelector('[data-testid="ort"]')?.textContent ?? "";
}
