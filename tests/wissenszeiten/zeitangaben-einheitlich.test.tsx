// @vitest-environment jsdom
// ==================================================================================================
// AUFNAHME gesamt-wissenszeiten · R-1010 — DATUMS- UND ZEITANGABEN SEHEN ÜBERALL GLEICH AUS.
// ==================================================================================================
//
// R-1010: „Datums- und Zeitangaben sehen überall gleich aus und stimmen. Offen ist, ob nur eine
// Stelle oder alle elf Erzeuger von Zeitstempeln angefasst werden." Gewählt ist der BREITE Schnitt
// für Zeitpunkte mit Datum UND Uhrzeit: die Bibliothek und die Validierung zeigten sie schon über
// `formatKoTimestamp` (JOB 528, `apps/web/src/pages/Library.timestamp.test.tsx`), elf weitere
// Stellen formatierten selbst — mit der Sprache des Browsers statt der Oberfläche
// (`toLocaleString()`), mit Sekunden (`toLocaleString(sprache)`) oder fest auf „de-DE"
// (`Intl.DateTimeFormat`), und ohne Schutz vor einem unlesbaren Wert („Invalid Date").
//
// NACHARBEIT 1 (Ben): auch die Live-Wand auf Startseite und Beamer (`StartPanel`, `LiveWallBeamer`,
// `LiveWallValidiert`) formatierte Datum + Uhrzeit selbst — ohne Jahr und für jede nichtenglische
// Sprache fest „de-DE". Für diese Ausnahme gibt es keinen Quellenbeleg; sie folgt jetzt derselben
// Regel.
//
// NICHT in diesem Schnitt, ausdrücklich: reine Kalendertage (`toLocaleDateString`) und reine
// Uhrzeiten („Stand 14:03"). Das sind andere Angaben, keine zweite Schreibweise desselben
// Zeitstempels.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { Draft } from "../../apps/web/src/api/types";
import { CaptureDraftList } from "../../apps/web/src/components/CaptureDraftList";
import i18n from "../../apps/web/src/i18n";
import { formatKoTimestamp } from "../../apps/web/src/lib/koDates";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Die Erzeuger, die bis hierher ihren Zeitstempel selbst formatierten (elf + Live-Wand; die zwei
 * Audit-Karten stehen seit der Integration gesondert, s. unten).
 */
const ERZEUGER = [
  "apps/web/src/components/start/StartPanel.tsx",
  "apps/web/src/components/start/LiveWallValidiert.tsx",
  "apps/web/src/pages/LiveWallBeamer.tsx",
  "apps/web/src/pages/AdminBetriebDetails.tsx",
  "apps/web/src/pages/Analytics.tsx",
  "apps/web/src/pages/Stufe2.tsx",
  "apps/web/src/pages/Firmenwoerterbuch.tsx",
  "apps/web/src/pages/Spaces.tsx",
  "apps/web/src/pages/MeineEntwuerfe.tsx",
  "apps/web/src/components/CaptureDraftList.tsx",
  "apps/web/src/components/wissensauskunft/WissensauskunftBereich.tsx",
  "apps/web/src/components/kenntnisnahme/KenntnisnahmeBereich.tsx",
] as const;

const quelle = (pfad: string): string => readFileSync(resolve(process.cwd(), pfad), "utf8");

describe("R-1010 · die Erzeuger formatieren nicht mehr selbst", () => {
  for (const pfad of ERZEUGER) {
    it(pfad, () => {
      const src = quelle(pfad);
      expect(src, "eigene Datum+Uhrzeit-Formatierung").not.toMatch(/\.toLocaleString\(/);
      expect(src, "feste Locale statt Sprache der Oberfläche").not.toContain("Intl.DateTimeFormat");
      expect(src).toMatch(/formatKoTimestamp\([^)]*, (i18n\.language|sprache|locale)\)/);
    });
  }

  // NACHARBEIT 2 (Integration): die beiden Audit-Karten formatieren NICHT mehr selbst — sie
  // rendern seit `produkt:20261009:admin-audit-verstaendlich` (ADMIN-03) die gemeinsame
  // `AuditTabelle` (`components/einstellungen/Auditprotokoll.tsx`), deren Zeitpunkt mit Zeitzone
  // jener Auftrag festlegt. Gemessen wird hier nur: keine eigene Formatierung mehr in der Karte.
  for (const pfad of [
    "apps/web/src/pages/AdminDatenDetails.tsx",
    "apps/web/src/pages/AdminSicherheitDetails.tsx",
  ]) {
    it(`${pfad} · delegiert an die gemeinsame AuditTabelle`, () => {
      const src = quelle(pfad);
      expect(src).not.toMatch(/\.toLocaleString\(/);
      expect(src).not.toContain("Intl.DateTimeFormat");
      expect(src).toContain("<AuditTabelle seite={seite} verzeichnis={verzeichnis} />");
    });
  }

  it("KALIBRIERUNG — der Wächter erkennt die alte Bauform wirklich", () => {
    const alt = "{new Date(e.at).toLocaleString()}";
    expect(alt).toMatch(/\.toLocaleString\(/);
  });
});

describe("R-1010 · die Regel selbst: eine Schreibweise, kein falsches Datum", () => {
  it("Datum + Uhrzeit ohne Sekunden, in der übergebenen Sprache", () => {
    const iso = "2026-09-20T08:05:42.000Z";
    const de = formatKoTimestamp(iso, "de");
    expect(de).toMatch(/^\d{2}\.\d{2}\.2026 \d{2}:\d{2}$/);
    expect(formatKoTimestamp(iso, "en")).not.toBe(de);
  });

  it("fehlender, leerer oder unlesbarer Wert → null; nie „Invalid Date“, nie 1970", () => {
    for (const wert of [undefined, null, "", "  ", "kein-datum"]) {
      expect(formatKoTimestamp(wert, "de"), String(wert)).toBeNull();
    }
  });
});

function entwurf(id: string, updatedAt: string): Draft {
  return {
    id,
    payload: { title: `Entwurf ${id}` },
    originalAuthor: "u1",
    lastEditor: "u1",
    createdAt: "2026-09-01T08:00:00.000Z",
    updatedAt,
  } as Draft;
}

describe("R-1010 · gemessen an der Seite „Meine Entwürfe“", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage("de");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    act(() => root.unmount());
    container.remove();
    await i18n.changeLanguage("de");
  });

  async function rendern(drafts: Draft[]): Promise<void> {
    await act(async () => {
      root.render(
        createElement(CaptureDraftList, {
          variant: "seite",
          drafts,
          highlightId: null,
          editingId: null,
          confirmDiscardId: null,
          onConfirmDiscard: () => {},
          discardPending: false,
          onDiscard: () => {},
          onResume: () => {},
          isAdmin: false,
          directory: [],
          scopeLabel: "Meine Entwürfe",
        }),
      );
    });
  }

  const zeile = (id: string): string =>
    (
      container.querySelector(`[data-testid="entwurfsliste-eintrag"][data-entwurfszeile="${id}"]`)
        ?.textContent ?? ""
    ).trim();

  it("„Gespeichert“ trägt dieselbe Schreibweise wie jede andere Zeitangabe — in DE und EN", async () => {
    const iso = "2026-09-20T08:05:00.000Z";
    await rendern([entwurf("a", iso)]);
    const de = formatKoTimestamp(iso, "de");
    expect(de).not.toBeNull();
    expect(zeile("a")).toContain(`Gespeichert: ${String(de)}`);

    await act(async () => {
      await i18n.changeLanguage("en");
    });
    const en = formatKoTimestamp(iso, "en");
    expect(zeile("a")).toContain(`Saved: ${String(en)}`);
    // Vorher stand hier fest „de-DE" — auch in der englischen Oberfläche.
    expect(zeile("a")).not.toContain(String(de));
  });

  it("ein unlesbarer Wert erzeugt kein Datum — kein „Invalid Date“, kein 1970", async () => {
    await rendern([entwurf("b", "kein-datum")]);
    expect(zeile("b")).not.toContain("Invalid Date");
    expect(zeile("b")).not.toContain("1970");
  });
});
