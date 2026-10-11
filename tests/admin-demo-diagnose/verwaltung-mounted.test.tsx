// @vitest-environment jsdom
// ================================================================================================
// ADMIN-16 · K1/K3/K5/K6 — DER BETRIEB-/DEMOEINSTIEG IN DER VERWALTUNG, GEMOUNTET.
// ================================================================================================
//
// produkt:20261009:admin-demo-diagnose. Gemessen an der echten Seite `pages/Admin` unter den echten
// Anbietern (`tests/admin-navigation/vorrichtung.tsx`), mit echten Übersetzungen und ohne Netz —
// eine Antwort gibt es nur, wo ein Fall sie ausdrücklich nennt.
//
//   K1  Die tägliche Verwaltung (Startseite: Menschen, Spaces, Qualität; Thema „Benutzer und
//       Rollen") führt keinen Vorführweg. Das Thema „Vorführdaten" steht zuletzt in der
//       Themenleiste und auf der Startseite unter „Organisation und Betrieb".
//   K3  Das Öffnen der Karten schreibt nichts; der Wert der Zeile sagt vorher, worum es geht.
//   K5  Pfad, Rückweg und Neuladen tragen den Kontext; die Seitenhilfe nennt keine internen
//       Modulnamen.
//   K6  Sind die Demopakete nicht abrufbar oder nicht hinterlegt, steht Grund (und Zuständigkeit)
//       da — und kein Ladeknopf, der ins Leere führte.
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
import { ADMIN_SECTIONS, adminHref } from "../../apps/web/src/lib/adminSections";
import { VERWALTUNG_GRUPPEN } from "../../apps/web/src/lib/adminUebersicht";
import {
  type Netzprotokoll,
  type Stand,
  abbauen,
  beruhige,
  klicke,
  montiere,
  neuLaden,
  ohneNetz,
  ort,
  reiterNamen,
  setzeStufe2,
  sprache,
} from "../admin-navigation/vorrichtung";

const t = (key: string): string => i18n.t(key);
let stand: Stand | null = null;
let netz: Netzprotokoll;

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

async function admin(adresse: string): Promise<Stand> {
  const s = montiere(adresse);
  stand = s;
  await beruhige();
  return s;
}

function zeile(s: Stand, testId: string): Element | null {
  return s.container.querySelector(`[data-testid="${testId}"]`);
}

function pfadzeile(s: Stand): string {
  return s.container.querySelector('[data-einst="pfad"]')?.textContent ?? "";
}

describe("ADMIN-16 · K1 · Vorführwerkzeuge sind nachgeordnet und eindeutig auffindbar", () => {
  it("Startseite: Menschen, Spaces und Qualität führen keinen Vorführweg; Betrieb führt alle drei", () => {
    const vorfuehr = (id: string) =>
      (VERWALTUNG_GRUPPEN.find((g) => g.id === id)?.ziele ?? []).filter(
        (z) => z.art === "verwaltung" && z.section === "vorfuehrdaten",
      );
    for (const taeglich of ["menschen", "spaces", "qualitaet"]) {
      expect(vorfuehr(taeglich), `${taeglich} bietet einen Vorführweg an`).toEqual([]);
    }
    const betrieb = vorfuehr("betrieb").map((z) => (z.art === "verwaltung" ? z.detail : ""));
    expect(betrieb).toEqual(expect.arrayContaining(["demo", "pakete", "testimporte"]));
  });

  it("die Themenleiste beginnt mit „Benutzer und Rollen“ und endet mit „Vorführdaten“", async () => {
    const s = await admin(adminHref("konten"));
    const namen = reiterNamen(s);
    expect(namen).toHaveLength(ADMIN_SECTIONS.length);
    expect(namen[0]).toBe(t("adm.sec.konten"));
    expect(namen[namen.length - 1]).toBe(t("adm.sec.vorfuehrdaten"));
  });

  it("„Benutzer und Rollen“ trägt keine Paket- oder Aufräumzeile", async () => {
    const s = await admin(adminHref("konten"));
    expect(zeile(s, "zeile-demopakete")).toBeNull();
    expect(zeile(s, "zeile-testimporte")).toBeNull();
    expect(s.container.textContent).not.toContain(t("betriebdemo.ziel.pakete"));
  });

  it("unter „Vorführdaten“ stehen Demodaten, Pakete und Testimporte — mit ehrlichem Wert", async () => {
    const s = await admin(adminHref("vorfuehrdaten"));
    expect(zeile(s, "zeile-demodaten")).not.toBeNull();
    expect(zeile(s, "zeile-demopakete")?.textContent).toContain(t("betriebdemo.wert.fiktiv"));
    expect(zeile(s, "zeile-testimporte")?.textContent).toContain(t("betriebdemo.wert.alleImporte"));
  });
});

describe("ADMIN-16 · K3/K5 · Karten öffnen ohne Wirkung, mit Pfad, Rückweg und Neuladen", () => {
  for (const [testId, detail, labelKey, detailTestId] of [
    ["zeile-demopakete", "pakete", "betriebdemo.ziel.pakete", "detail-pakete"],
    ["zeile-testimporte", "testimporte", "betriebdemo.ziel.testimporte", "detail-testimporte"],
  ] as const) {
    it(`${detail}: öffnen, Pfad lesen, neu laden, zurück — und nichts wurde geschrieben`, async () => {
      let s = await admin(adminHref("vorfuehrdaten"));
      await klicke(zeile(s, testId));
      expect(ort(s)).toBe(adminHref("vorfuehrdaten", detail));
      expect(zeile(s, detailTestId)).not.toBeNull();
      expect(pfadzeile(s)).toBe(
        [t("gliederung.verwaltung"), t("adm.sec.vorfuehrdaten"), t(labelKey)].join(" › "),
      );

      s = neuLaden(s);
      stand = s;
      await beruhige();
      expect(zeile(s, detailTestId), "nach dem Neuladen ist die Karte weg").not.toBeNull();

      await klicke(s.container.querySelector('[data-einst="zurueck"]'));
      expect(ort(s)).toBe(adminHref("vorfuehrdaten"));
      expect(zeile(s, testId)).not.toBeNull();
      expect(netz.schreibend(), "Öffnen/Zurück hat etwas geschrieben").toEqual([]);
    });
  }

  it("Testimporte: die Karte zeigt erst die Vorschau-Schaltfläche — Aufräumen braucht zwei Schritte", async () => {
    const s = await admin(adminHref("vorfuehrdaten", "testimporte"));
    const karte = zeile(s, "detail-testimporte");
    expect(karte?.textContent).toContain(t("imp.cleanup.desc"));
    const knoepfe = [...(karte?.querySelectorAll("button") ?? [])].map((b) =>
      (b.textContent ?? "").trim(),
    );
    expect(knoepfe).toContain(t("imp.cleanup.previewCta"));
    expect(knoepfe).not.toContain(t("imp.cleanup.confirmCta"));
  });

  it("die Seitenhilfe der beiden Karten nennt keine internen Modul- oder Bauteilnamen", () => {
    for (const sprachcode of ["de", "en", "nl"]) {
      for (const key of ["betriebdemo.hilfe.pakete.text", "betriebdemo.hilfe.testimporte.text"]) {
        const text = i18n.getFixedT(sprachcode)(key);
        expect(text).not.toBe(key);
        expect(text).not.toMatch(
          /ImportCleanup|ExamplePackages|DemoPackages|D-CLEAN|WP-B6|JOB \d|\/api\/|\.tsx?\b/,
        );
      }
    }
  });
});

describe("ADMIN-16 · K6 · nicht verfügbare Pakete sagen Grund und Zuständigkeit", () => {
  it("Paketliste nicht abrufbar: Grund, Zuständigkeit und „Erneut versuchen“, aber kein Paket-Ladeknopf", async () => {
    const s = await admin(adminHref("vorfuehrdaten", "pakete"));
    const karte = zeile(s, "detail-pakete");
    const meldung = karte?.querySelector('[data-testid="demopakete-nicht-abrufbar"]')?.textContent;
    expect(meldung).toBe(t("betriebdemo.pakete.nichtAbrufbar"));
    // Ben, Nacharbeit 1: die Meldung nennt auch, WER zuständig ist — in allen drei Sprachen.
    expect(meldung).toContain("Serverbetrieb");
    expect(i18n.getFixedT("en")("betriebdemo.pakete.nichtAbrufbar")).toContain("server operator");
    expect(i18n.getFixedT("nl")("betriebdemo.pakete.nichtAbrufbar")).toContain("serverbeheerder");
    expect(karte?.querySelector("[data-demopaket]")).toBeNull();
    const knoepfe = [...(karte?.querySelectorAll("button") ?? [])].map((b) =>
      (b.textContent ?? "").trim(),
    );
    expect(knoepfe).toContain(t("betriebdemo.pakete.erneut"));
    expect(knoepfe).not.toContain(t("dpk.remove"));
    expect(knoepfe).not.toContain(t("dpk.reset"));
  });

  it("kein Paket hinterlegt: der Satz nennt den Produktbetrieb als zuständig", async () => {
    netz = ohneNetz({ "/api/admin/demo-packages": { packages: [] } });
    const s = await admin(adminHref("vorfuehrdaten", "pakete"));
    const keine = zeile(s, "detail-pakete")?.querySelector('[data-testid="demopakete-keine"]');
    expect(keine?.textContent).toBe(t("betriebdemo.pakete.keine"));
    expect(t("betriebdemo.pakete.keine")).toContain("Produktbetrieb");
  });

  it("die kleinen Beispielpakete tragen vor dem Laden das Etikett „erfundene Demodaten“", async () => {
    const s = await admin(adminHref("vorfuehrdaten", "pakete"));
    const etiketten = zeile(s, "detail-pakete")?.querySelectorAll(
      '[data-testid="beispielpaket-fiktiv"]',
    );
    expect(etiketten?.length).toBe(3);
    for (const e of etiketten ?? []) {
      expect(e.textContent).toBe(t("dpk.fictional"));
    }
  });
});
