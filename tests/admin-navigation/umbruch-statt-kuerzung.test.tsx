// @vitest-environment jsdom
// ================================================================================================
// R-1581 · „390px-Screenshot zeigt abgeschnittene Nutzer-/Rollenlabels; responsive Gestaltung prüfen."
// ================================================================================================
//
// Die Zeile selbst kürzt seit JOB 3117 nicht mehr (`components/einstellungen/Zeilenkarte.tsx`,
// Umbruchvertrag). Zwei Stellen der Verwaltung lagen aber AUSSERHALB dieses Vertrags:
//
//   1  der Titel der Detailkarte (`Detailkarte.tsx`) — er IST der Name des Kontos oder der Rolle und
//      trug `truncate`; auf einem Telefon neben „Zurück" und „?" blieb davon ein Rest mit „…".
//   2  der Kurzlink (`pages/Admin.tsx`, `Kurzlink`) — sein Wert-Block war `shrink-0`, die Zeile
//      ohne `flex-wrap`; ein langer Bereichsname musste dem Pfeil weichen.
//
// WAS DIESE DATEI MISST UND WAS NICHT: jsdom rechnet kein Layout. Gemessen wird deshalb der
// Klassenvertrag am ECHT gemounteten Produktpfad (kein Kürzungsmerkmal, Umbruch erlaubt) und dass
// der volle Text im DOM steht — NICHT die sichtbare Breite bei 390 px. Die bleibt eine Browser-
// bzw. Sichtprüfung und wird hier nicht behauptet.
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

import i18n from "../../apps/web/src/i18n";
import { adminHref } from "../../apps/web/src/lib/adminSections";
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

const t = (key: string): string => i18n.t(key);
let stand: Stand | null = null;

/** Ein Name, der auf keinem Telefon in eine Zeile passt — mit und ohne Leerzeichen. */
const LANGER_NAME = "Maximiliane Wilhelmine Kunigunde von Hohenzollern-Sigmaringen-Bergheim";

const KUERZUNG = ["truncate", "text-ellipsis", "whitespace-nowrap", "overflow-hidden"];

function klassen(el: Element | null | undefined): string[] {
  return (el?.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
}

function ohneKuerzung(el: Element | null | undefined, was: string): void {
  expect(el, `${was} steht nicht im DOM`).toBeTruthy();
  const k = klassen(el);
  for (const merkmal of KUERZUNG) {
    expect(k, `${was} trägt das Kürzungsmerkmal „${merkmal}“`).not.toContain(merkmal);
  }
  expect(k, `${was} darf nicht umbrechen`).toContain("break-words");
  expect(k, `${was} kann im Flex-Engpass nicht schrumpfen`).toContain("min-w-0");
}

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

describe("R-1581 · Nutzer- und Rollenlabels werden umgebrochen, nicht abgeschnitten", () => {
  it("U1 · der Titel der Nutzerkarte trägt den VOLLEN Namen und kein Kürzungsmerkmal", async () => {
    ohneNetz({
      "/api/users": [
        {
          id: "u-lang",
          name: LANGER_NAME,
          email: "lang@r1581.test",
          role: "experte",
          approved: true,
        },
      ],
    });
    const s = montiere(adminHref("konten"));
    stand = s;
    await beruhige();

    const zeile = [
      ...s.container.querySelectorAll('[data-testid="flaeche-nutzer"] [data-einst="zeile"]'),
    ].find((el) => (el.textContent ?? "").includes(LANGER_NAME));
    expect(zeile, "die Nutzerzeile steht nicht auf der Fläche").toBeDefined();
    await klicke(zeile);

    const titel = s.container.querySelector(
      '[data-testid="detail-nutzer"] [data-einst="detailtitel"]',
    );
    expect(titel?.textContent).toBe(LANGER_NAME);
    ohneKuerzung(titel, "der Titel der Nutzerkarte");
  });

  it("U2 · der Titel der Rollenkarte — in DE, EN und NL", async () => {
    ohneNetz();
    for (const lng of ["de", "en", "nl"]) {
      await sprache(lng);
      const s = montiere(adminHref("konten", "rolle:experte"));
      stand = s;
      await beruhige();
      const titel = s.container.querySelector(
        '[data-testid="detail-rolle"] [data-einst="detailtitel"]',
      );
      expect(titel?.textContent, `Rollentitel (${lng})`).toBe(
        i18n.getFixedT(lng)("role.name.experte"),
      );
      ohneKuerzung(titel, `der Titel der Rollenkarte (${lng})`);
      abbauen(s);
      stand = null;
    }
  });

  it("U3 · die Kurzlinks der Verwaltung folgen demselben Umbruchvertrag wie die Zeile", async () => {
    ohneNetz();
    const s = montiere(adminHref("berichte"));
    stand = s;
    await beruhige();

    const pfeile = [...s.container.querySelectorAll('[data-einst="kurzlink"]')];
    // Nicht-vakuös: mit eingeschalteter Stufe 2 stehen hier Analytics, Audit, Auswertungen,
    // Wissensgraph und Kapital als Kurzlinks.
    expect(pfeile.length, "keine Kurzlinks auf „Berichte und Analyse“").toBeGreaterThanOrEqual(4);
    for (const pfeil of pfeile) {
      const link = pfeil.closest("a");
      const name = link?.querySelector('[data-einst="label"]')?.textContent ?? "?";
      expect(klassen(link), `Kurzlink „${name}“ bricht nicht um`).toContain("flex-wrap");
      ohneKuerzung(link?.querySelector('[data-einst="label"]'), `Beschriftung „${name}“`);
      // Der Wert-Block (Träger von Wert und Pfeil) darf schrumpfen; unteilbar ist nur der Pfeil.
      const wertBlock = pfeil.parentElement;
      expect(klassen(wertBlock), `Wert-Block „${name}“ ist starr`).not.toContain("shrink-0");
      expect(klassen(pfeil), `Pfeil „${name}“ schrumpft mit`).toContain("shrink-0");
    }
    expect(s.container.textContent).toContain(t("nav.capital"));
  });
});
