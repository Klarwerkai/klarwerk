// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · GESAMT-BESTANDSRESET — DIE FLÄCHE DES ADMINISTRATIVEN AUFRUFS (Nacharbeit 2).
// ================================================================================================
//
// Peters Entscheidung vom 11.10.: „deine empfehlung, zweifache passworteingabe und checkbox zum
// klicken." Diese Datei fährt den NUTZERWEG an der echten Verwaltung (`/admin?bereich=system&
// detail=werk`) mit echter i18n und misst, was der Admin sieht und was die Fläche abschickt:
//
//   M1  Die Folgenvorschau steht da: Wissensobjekte, davon Papierkorb, was bleibt.
//   M2  Der Knopf bleibt gesperrt, bis BEIDE Passworteingaben übereinstimmen UND das Häkchen sitzt;
//       erst dann geht genau EIN POST hinaus — mit beiden Eingaben, dem Häkchen und der Kennung
//       genau der gezeigten Vorschau. Vorher geht KEIN schreibender Ruf hinaus.
//   M3  Ohne Datenbank sagt die Fläche „nicht verfügbar" und bietet keinen Knopf an.
//
// Dass der Server dieselben Bedingungen noch einmal selbst prüft (die Oberfläche ist nicht die
// Sicherung), misst `services/app/src/routes/admin-bestandsreset.test.ts`; dass er gegen echtes
// Postgres löscht und erhält, `tests/db-tx/bestandsreset-e9-pg.integration.test.ts` (P4).
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

import { act } from "../../apps/web/node_modules/react";
import type { BestandsresetAuskunft } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { adminHref } from "../../apps/web/src/lib/adminSections";
import {
  type Stand,
  abbauen,
  beruhige,
  feldMitBeschriftung,
  klicke,
  montiere,
  setzeStufe2,
  sprache,
  tippe,
} from "../admin-navigation/vorrichtung";

const WEG = "/api/admin/bestandsreset";
const KENNUNG = "a".repeat(64);
const t = (key: string): string => i18n.t(key);

const VERFUEGBAR: BestandsresetAuskunft = {
  verfuegbar: true,
  vorschau: {
    geloescht: [
      { tabelle: "kos", zeilen: 7 },
      { tabelle: "drafts", zeilen: 2 },
    ],
    wissensobjekte: 7,
    papierkorb: 5,
    erhalten: { konten: 2, begriffe: 3 },
    kennung: KENNUNG,
  },
  letzterLauf: null,
};

let auskunft: BestandsresetAuskunft = VERFUEGBAR;
let posts: { pfad: string; rumpf: unknown }[] = [];

function netz(): void {
  posts = [];
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: async (eingabe: unknown, init?: { method?: string; body?: string }) => {
      const pfad = String(eingabe);
      const methode = (init?.method ?? "GET").toUpperCase();
      const antworte = (status: number, wert: unknown) => ({
        status,
        ok: status < 400,
        statusText: status < 400 ? "OK" : "Fehler",
        text: async () => JSON.stringify(wert),
      });
      if (methode !== "GET") {
        posts.push({ pfad, rumpf: init?.body ? JSON.parse(init.body) : undefined });
        if (pfad.endsWith(WEG)) {
          return antworte(200, {
            ok: true,
            laufId: "lauf-1",
            befund: { zustand: "OK", erfolgMeldbar: true, begruendung: "" },
            protokolliert: true,
          });
        }
        throw new Error(`kein Netz in diesem Prüfstand: ${methode} ${pfad}`);
      }
      if (pfad.endsWith(WEG)) {
        return antworte(200, auskunft);
      }
      if (pfad.endsWith("/api/admin/factory-reset")) {
        return antworte(200, { available: false });
      }
      throw new Error(`kein Netz in diesem Prüfstand: ${methode} ${pfad}`);
    },
  });
}

let stand: Stand | null = null;

beforeEach(() => {
  setzeStufe2(true);
  auskunft = VERFUEGBAR;
  netz();
});

afterEach(async () => {
  if (stand) {
    abbauen(stand);
    stand = null;
  }
  await sprache("de");
  vi.clearAllMocks();
});

async function karte(): Promise<Stand> {
  const s = montiere(adminHref("system", "werk"));
  stand = s;
  await beruhige();
  return s;
}

function abschnitt(s: Stand): Element | null {
  return s.container.querySelector('[data-testid="abschnitt-bestandsreset"]');
}

function knopf(s: Stand, text: string): HTMLButtonElement | undefined {
  const knoepfe = [...(abschnitt(s)?.querySelectorAll("button") ?? [])];
  return knoepfe.find((b) => (b.textContent ?? "").includes(text));
}

describe("Bestandsreset · die Fläche", () => {
  it("M1 · die Folgenvorschau nennt, was gelöscht wird und was bleibt", async () => {
    const s = await karte();
    expect(abschnitt(s), "der Abschnitt fehlt in der Karte Werkseinstellungen").not.toBeNull();
    const vorschau = s.container.querySelector('[data-testid="bestandsreset-vorschau"]');
    expect(vorschau?.textContent).toContain(
      i18n.t("bestandsreset.wissensobjekte", { anzahl: 7, papierkorb: 5 }),
    );
    expect(vorschau?.textContent).toContain(
      i18n.t("bestandsreset.erhalten", { konten: 2, begriffe: 3 }),
    );
    expect(abschnitt(s)?.textContent).toContain(t("bestandsreset.erhaltenHinweis"));
    expect(knopf(s, t("bestandsreset.starten"))).toBeDefined();
  });

  it("M2 · gesperrt bis zweimal dasselbe Passwort UND Häkchen — dann genau ein POST mit der Kennung", async () => {
    const s = await karte();
    await klicke(knopf(s, t("bestandsreset.starten")));
    const ausfuehren = (): HTMLButtonElement | undefined => knopf(s, t("bestandsreset.ausfuehren"));
    expect(ausfuehren()?.disabled).toBe(true);

    await tippe(feldMitBeschriftung(s, t("bestandsreset.passwort")), "geheim-123");
    expect(ausfuehren()?.disabled, "nur eine Eingabe genügt nicht").toBe(true);

    await tippe(feldMitBeschriftung(s, t("bestandsreset.passwortWiederholung")), "geheim-124");
    expect(abschnitt(s)?.textContent).toContain(t("bestandsreset.ungleich"));
    expect(ausfuehren()?.disabled, "ungleiche Eingaben genügen nicht").toBe(true);

    await tippe(feldMitBeschriftung(s, t("bestandsreset.passwortWiederholung")), "geheim-123");
    expect(abschnitt(s)?.textContent).not.toContain(t("bestandsreset.ungleich"));
    expect(ausfuehren()?.disabled, "ohne Häkchen läuft nichts").toBe(true);

    await klicke(abschnitt(s)?.querySelector('input[type="checkbox"]'));
    expect(ausfuehren()?.disabled).toBe(false);
    expect(posts, "vor dem Klick darf nichts geschrieben worden sein").toEqual([]);

    await klicke(ausfuehren());
    expect(posts).toHaveLength(1);
    expect(posts[0]?.pfad).toContain(WEG);
    expect(posts[0]?.rumpf).toEqual({
      passwort: "geheim-123",
      passwortWiederholung: "geheim-123",
      folgenBestaetigt: true,
      vorschauKennung: KENNUNG,
    });
  });

  it("M4 · Nacharbeit 7: ändert sich die Vorschau im offenen Formular, ist die Bestätigung hinfällig", async () => {
    const s = await karte();
    await klicke(knopf(s, t("bestandsreset.starten")));
    const ausfuehren = (): HTMLButtonElement | undefined => knopf(s, t("bestandsreset.ausfuehren"));
    await tippe(feldMitBeschriftung(s, t("bestandsreset.passwort")), "geheim-123");
    await tippe(feldMitBeschriftung(s, t("bestandsreset.passwortWiederholung")), "geheim-123");
    await klicke(abschnitt(s)?.querySelector('input[type="checkbox"]'));
    expect(ausfuehren()?.disabled, "vor der Änderung vollständig bestätigt").toBe(false);

    // Der Bestand ändert sich, und die Fläche holt die Vorschau neu — so wie es React Query bei der
    // Rückkehr ins Fenster ohnehin tut (refetchOnWindowFocus ist nicht abgeschaltet).
    const NEU = "b".repeat(64);
    auskunft = {
      verfuegbar: true,
      vorschau: {
        geloescht: [{ tabelle: "kos", zeilen: 8 }],
        wissensobjekte: 8,
        papierkorb: 5,
        erhalten: { konten: 2, begriffe: 3 },
        kennung: NEU,
      },
      letzterLauf: null,
    };
    await act(async () => {
      window.dispatchEvent(new Event("visibilitychange"));
      await new Promise((r) => setTimeout(r, 0));
    });
    await beruhige();

    expect(
      s.container.querySelector('[data-testid="bestandsreset-vorschau-geaendert"]')?.textContent,
    ).toBe(t("bestandsreset.vorschauGeaendert"));
    const haken = abschnitt(s)?.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    expect(haken?.checked, "das Häkchen gilt der alten Vorschau").toBe(false);
    expect(feldMitBeschriftung(s, t("bestandsreset.passwort"))?.value).toBe("");
    expect(feldMitBeschriftung(s, t("bestandsreset.passwortWiederholung"))?.value).toBe("");
    expect(ausfuehren()?.disabled, "ohne erneute Bestätigung läuft nichts").toBe(true);
    expect(posts, "die geänderte Löschmenge darf nicht ungefragt hinausgehen").toEqual([]);

    // Erneut bestätigt — jetzt für die NEUE Vorschau, und genau ihre Kennung geht hinaus.
    await tippe(feldMitBeschriftung(s, t("bestandsreset.passwort")), "geheim-123");
    await tippe(feldMitBeschriftung(s, t("bestandsreset.passwortWiederholung")), "geheim-123");
    await klicke(abschnitt(s)?.querySelector('input[type="checkbox"]'));
    await klicke(ausfuehren());
    expect(posts).toHaveLength(1);
    expect((posts[0]?.rumpf as { vorschauKennung?: string }).vorschauKennung).toBe(NEU);
  });

  it("M3 · ohne Datenbank: „nicht verfügbar“ und kein Knopf", async () => {
    auskunft = { verfuegbar: false };
    const s = await karte();
    expect(abschnitt(s)?.textContent).toContain(t("bestandsreset.nichtVerfuegbar"));
    expect(abschnitt(s)?.textContent).toContain(t("bestandsreset.erhaltenHinweis"));
    expect(knopf(s, t("bestandsreset.starten"))).toBeUndefined();
  });
});
