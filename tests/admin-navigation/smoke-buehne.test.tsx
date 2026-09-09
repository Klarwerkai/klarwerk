// @vitest-environment jsdom
// ================================================================================================
// JOB 3337 · RUNDE 4 — DIE BÜHNE DES UI-SMOKE HÄNGT AN EINEM ANKER, UND DER ANKER WIRD GEPRÜFT.
// ================================================================================================
//
// WAS PASSIERT IST, und es ist die teuerste Bauform dieses Jobs gewesen: `tests-smoke/
// ersteinrichtung.setup.ts` belegte „die Verwaltung rendert als Admin" über den ABGESCHRIEBENEN
// Namen eines einzelnen Reiters — `getByRole("button", { name: "Daten", exact: true })`. Dieser
// Job hat den Reiter „Daten" aufgelöst (er trug Demodaten, Werkseinstellungen, Papierkorb UND das
// Audit-Log; s. `lib/adminSections.ts`), und der Smoke ist daran zerbrochen. Nicht falsch — aber
// erst im Cloud-Tor, nach drei Runden, an einer Stelle, die kein lokaler Lauf berührt hatte.
//
// DIE LEHRE IST NICHT „den Namen nachziehen". Sie ist: ein Literal in der Bühne weiss nichts von
// einem Umbau. Der Anker liest seine Erwartung deshalb seit dieser Runde aus `ADMIN_SECTIONS` —
// derselben Quelle, aus der `pages/Admin.tsx:435` die Reiterspalte füllt.
//
// DIESE DATEI SCHLIESST DIE VERBLEIBENDE LÜCKE: dass niemand merkt, wenn der neue Anker seinerseits
// ins Leere greift. Der UI-Smoke braucht einen echten Chromium und einen echten Server; er läuft
// im Tor, nicht in der Sandkiste einer Bahn. Hier wird stattdessen GENAU SEIN VERTRAG an der
// gemounteten Fläche gemessen — und zwar mit SEINEM Selektor, aus seiner Datei gelesen, nicht mit
// einer Kopie davon. Weicht die Bühne von der Fläche ab, ist diese Datei rot, bevor das Tor es ist.
//
// EHRLICHE GRENZE, die hier stehen bleiben soll: das ist jsdom, kein Browser. Bewiesen wird, dass
// der Anker die richtigen Elemente TRIFFT — nicht, dass Chromium sie zeichnet. Letzteres bleibt
// Sache des Tors.
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
import { ADMIN_SECTIONS, adminSectionFuerDetail } from "../../apps/web/src/lib/adminSections";
import { CommandPalette } from "../../apps/web/src/shell/CommandPalette";
import {
  type Stand,
  abbauen,
  beruhige,
  klicke,
  montiere,
  ohneNetz,
  setzeStufe2,
} from "./vorrichtung";

const WURZEL = join(__dirname, "../..");
const BUEHNE = "tests-smoke/ersteinrichtung.setup.ts";
const buehnentext = readFileSync(join(WURZEL, BUEHNE), "utf8");
const UI_SMOKE = "tests-smoke/ui-smoke.spec.ts";
const uiSmoketext = readFileSync(join(WURZEL, UI_SMOKE), "utf8");

/**
 * DER SELEKTOR DES SMOKE — GELESEN, NICHT KOPIERT.
 *
 * Stünde er hier ein zweites Mal als Literal, hätte dieser Test genau den Fehler wiederholt, den er
 * verhindern soll: er bliebe grün, während die Bühne längst auf etwas anderes zeigt.
 */
function selektorDerBuehne(): string {
  const treffer = buehnentext.match(/const ADMIN_REITER = '([^']+)';/)?.[1];
  if (treffer === undefined) {
    throw new Error(
      `${BUEHNE} nennt kein \`const ADMIN_REITER = '…'\` mehr — der Anker ist umgebaut worden, ohne diesen Wächter mitzunehmen.`,
    );
  }
  return treffer;
}

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
  vi.clearAllMocks();
});

/** `/admin` ohne Query — genau der Weg, den der Smoke nach `page.goto("/admin")` vorfindet. */
async function verwaltungAlsAdmin(): Promise<Stand> {
  const s = montiere("/admin");
  stand = s;
  await beruhige();
  return s;
}

describe("JOB 3337 · S · der Anker des UI-Smoke trifft die Verwaltung", () => {
  it("S1 · die Bühne nennt keinen abgeschriebenen Reiternamen mehr, sondern liest ADMIN_SECTIONS", () => {
    expect(
      buehnentext,
      "die Bühne prüft wieder einen einzelnen Reiternamen als Literal — genau daran ist R3 im Tor zerbrochen",
    ).not.toMatch(/name:\s*"Daten"/);
    expect(
      buehnentext,
      "die Bühne leitet ihre Erwartung nicht mehr aus ADMIN_SECTIONS ab",
    ).toContain("ADMIN_SECTIONS.length");
    // Nur die Untergrenze: eine leere Quelle machte die Zusage des Smoke inhaltslos („null Reiter
    // gefunden, null erwartet" wäre grün). Die ECHTE Zahl misst S2 gegen die gezeichnete Fläche.
    expect(ADMIN_SECTIONS.length).toBeGreaterThan(0);
  });

  it("S2 · der Selektor der Bühne findet in der Verwaltung genau die Themen aus ADMIN_SECTIONS", async () => {
    const s = await verwaltungAlsAdmin();
    expect(
      s.container.querySelector('[data-testid="page-admin"]'),
      "der Seitenanker `page-admin` fehlt — der Smoke belegt „Verwaltung als Admin“ dann über nichts",
    ).not.toBeNull();
    const reiter = s.container.querySelectorAll(selektorDerBuehne());
    expect(
      reiter.length,
      `der Anker des Smoke greift ins Leere: ${reiter.length} Reiter gefunden, ${ADMIN_SECTIONS.length} Themen in ADMIN_SECTIONS`,
    ).toBe(ADMIN_SECTIONS.length);
  });

  it("S3 · der Seed-Weg des Smoke öffnet über denselben Selektor die Demodaten-Zeile", async () => {
    const s = await verwaltungAlsAdmin();
    // Denselben Index rechnet die Bühne aus — aus dem Produkt, nicht aus einem Reiternamen.
    const thema = adminSectionFuerDetail("demo");
    const index = ADMIN_SECTIONS.findIndex((abschnitt) => abschnitt.id === thema);
    expect(
      index,
      'die Detailkennung „demo" hat kein Thema in ADMIN_SECTIONS',
    ).toBeGreaterThanOrEqual(0);
    await klicke(s.container.querySelectorAll(selektorDerBuehne())[index]);
    expect(
      s.container.querySelector('[data-testid="zeile-demodaten"]'),
      "der Seed-Weg `smoke:ui:gate:daten` findet die Zeile „Demodaten“ nicht mehr",
    ).not.toBeNull();
  });

  // ==============================================================================================
  // S4 — DERSELBE FEHLER, ZWEITER SCHAUPLATZ: die Liste „Gehe zu …" im UI-Smoke.
  // ==============================================================================================
  //
  // `ui-smoke.spec.ts` suchte das Suchfeld der Palette über ein Bruchstück seines PLATZHALTERS
  // („Zu Seite springen"). Dieser Auftrag hat den Platzhalter auf Pedis Wortlaut umgestellt, und der
  // Fall lief im Tor in eine Zeitüberschreitung — obwohl an der Palette nichts fehlte. Es war der
  // einzige rote Fall des R4-Tors und, nach dem Reiter „Daten", der zweite Fall derselben Bauform.
  //
  // Beide Enden werden deshalb hier festgehalten: das Produkt trägt den benannten Griff, und die
  // Bühne benutzt IHN statt eines sichtbaren Textes. Fällt eines von beiden weg, ist das rot —
  // hier, in Sekunden, statt im Tor nach einer halben Stunde.
  it("S4 · die Bühne greift die Liste „Gehe zu …“ über ihren benannten Griff, nicht über Wortlaut", async () => {
    const s = montiere("/start", createElement(CommandPalette));
    stand = s;
    await beruhige();
    await new Promise<void>((auf) => {
      window.dispatchEvent(new Event("open-command-palette"));
      setTimeout(auf, 0);
    });
    await beruhige(3);

    // (a) Das Produkt trägt den Griff — sonst zeigt die Bühne ins Leere.
    expect(
      s.container.querySelector('[data-cmd="suchfeld"]'),
      'das Suchfeld der Palette hat keinen `data-cmd="suchfeld"` mehr — der UI-Smoke greift damit ins Leere',
    ).not.toBeNull();

    // (b) Die Bühne benutzt ihn auch wirklich …
    expect(
      uiSmoketext,
      `${UI_SMOKE} sucht die Palette nicht mehr über ihren benannten Griff`,
    ).toContain('[data-cmd="suchfeld"]');

    // (c) … und NICHT mehr über den sichtbaren Text. `getByPlaceholder` auf die Palette ist genau
    //     der Griff, der im R4-Tor gerissen ist; er darf für dieses Feld nicht zurückkommen.
    expect(
      uiSmoketext,
      `${UI_SMOKE} sucht die Palette wieder über ihren Platzhalter — genau daran ist das R4-Tor zerbrochen`,
    ).not.toMatch(/getByPlaceholder\(\/(Zu Seite springen|Gehe zu)/);
  });
});
