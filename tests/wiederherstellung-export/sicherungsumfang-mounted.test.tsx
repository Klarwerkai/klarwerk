// @vitest-environment jsdom
// ================================================================================================
// produkt:20261010:poc-wiederherstellung-export · PV-01-01 / PV-01-03 — DIE FLÄCHE DES UMFANGS.
// ================================================================================================
//
// Über den Nutzerweg `/admin?bereich=system&detail=sicherung` an der echten Karte mit echter i18n.
// Das Netz beantwortet genau `GET /api/admin/sicherungen` mit einer fiktiven Auskunft: ADMIN-13 grün,
// aber ein Protokoll OHNE Kategorie `assistenz` (ältere Drillfassung).
//
//   S1  „Sicherungsumfang je Bereich" steht da, gebunden an Version und Commit
//   S2  Gespräche, Aufgaben, Name/Avatar und Avatarbilder je einzeln: im Dump, ausgeschlossen (mit
//       Grund und Folge) oder nicht vorhanden — und für die Assistenzbereiche ausdrücklich
//       „nicht gemessen" statt eines rückwirkenden Belegs
//   S3  die Vergleichszeile „Private Assistenzspeicher" im Restore-Nachweis
//   S4  de/en/nl: kein roher Schlüssel
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

import type { SicherungenAuskunft } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { adminHref } from "../../apps/web/src/lib/adminSections";
import {
  type Stand,
  abbauen,
  beruhige,
  montiere,
  setzeStufe2,
  sprache,
} from "../admin-navigation/vorrichtung";

const WEG = "/api/admin/sicherungen";
const t = (key: string, opts?: Record<string, unknown>): string => i18n.t(key, opts ?? {});

function kategorie(tabellen: [string, number | null, number | null][], zustand = "gleich") {
  return {
    zustand: zustand as "gleich" | "abweichend" | "nicht_gemessen",
    tabellen: tabellen.map(([tabelle, dump, datenbank]) => ({ tabelle, dump, datenbank })),
  };
}

const AUSKUNFT: SicherungenAuskunft = {
  zustand: "gelesen",
  verzeichnis: "/data/backups",
  gelesenUtc: "2026-10-11T08:00:00.000Z",
  sicherungen: [],
  schutzwege: {
    verzeichnisQuelle: "BACKUP_DIR",
    letzterLauf: { zustand: "unbekannt", grund: "fehlt" },
    restore: {
      zustand: "erfolg",
      luecken: [],
      widersprueche: [],
      beginnUtc: "2026-10-11T04:00:00.000Z",
      zeitUtc: "2026-10-11T04:02:00.000Z",
      exitcode: 0,
      grund: "Drill bestanden.",
      sicherung: "klarwerk-20261011T030000Z.dump",
      sicherungZeitpunktUtc: "2026-10-11T03:00:00.000Z",
      pruefsumme: { zustand: "passt", sha256: "e".repeat(64) },
      ziel: "klarwerk_ziel_fiktiv",
      vergleich: {
        beitraege: kategorie([["kos", 3, 3]]),
        anhaenge: { ...kategorie([["objects", 1, 1]]), belegeOhneAnhang: 0 },
        beziehungen: kategorie([["ko_kanten", 1, 1]]),
        rechte: {
          ...kategorie([["users", 2, 2]]),
          rollenDump: "admin/t=1 experte/t=1",
          rollenDatenbank: "admin/t=1 experte/t=1",
        },
        assistenz: kategorie([], "nicht_gemessen"),
      },
      wissensnachweis: null,
    },
    export: { zustand: "keiner", bibliothek: null, auditkette: null },
    papierkorb: { zustand: "unbekannt", grund: "protokoll_unlesbar" },
  },
  umfang: {
    produkt: { version: "1.0.0-beta.1.fiktiv", commit: "abc1234fiktiv" },
    tabellenImDump: 63,
    bereiche: [
      { id: "datenbank", art: "kern", zustand: "im_dump", tabellen: [], beleg: "belegt" },
      {
        id: "anhangsbytes",
        art: "kern",
        zustand: "im_dump",
        tabellen: ["objects", "ko_evidence"],
        beleg: "belegt",
      },
      {
        id: "assistenzprofil",
        art: "assistenz",
        zustand: "im_dump",
        tabellen: ["assistenz_profile"],
        beleg: "nicht_gemessen",
      },
      {
        id: "gespraeche",
        art: "assistenz",
        zustand: "im_dump",
        tabellen: ["klara_gespraeche"],
        beleg: "nicht_gemessen",
      },
      {
        id: "gedaechtnis",
        art: "assistenz",
        zustand: "im_dump",
        tabellen: ["interaktions_gedaechtnis"],
        beleg: "nicht_gemessen",
      },
      {
        id: "sitzungen",
        art: "assistenz",
        zustand: "im_dump",
        tabellen: ["klara_sessions", "klara_session_consents"],
        beleg: "nicht_gemessen",
      },
      {
        id: "avatarmotive",
        art: "assistenz",
        zustand: "ausgeschlossen",
        tabellen: [],
        beleg: "kein_beleg",
      },
      {
        id: "eigeneavatare",
        art: "assistenz",
        zustand: "nicht_vorhanden",
        tabellen: [],
        beleg: "kein_beleg",
      },
      {
        id: "aufgaben",
        art: "assistenz",
        zustand: "nicht_vorhanden",
        tabellen: [],
        beleg: "kein_beleg",
      },
      {
        id: "endgeraet",
        art: "assistenz",
        zustand: "ausgeschlossen",
        tabellen: [],
        beleg: "kein_beleg",
      },
    ],
  },
};

let stand: Stand | null = null;
let fragen: string[] = [];
let antwort: SicherungenAuskunft = AUSKUNFT;

beforeEach(() => {
  setzeStufe2(true);
  fragen = [];
  antwort = AUSKUNFT;
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: async (eingabe: unknown, init?: { method?: string }) => {
      const pfad = String(eingabe);
      if (!pfad.endsWith(WEG)) {
        throw new Error(`kein Netz in diesem Prüfstand: ${pfad}`);
      }
      fragen.push((init?.method ?? "GET").toUpperCase());
      return {
        status: 200,
        ok: true,
        statusText: "OK",
        text: async () => JSON.stringify(antwort),
      };
    },
  });
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
  const s = montiere(adminHref("system", "sicherung"));
  stand = s;
  await beruhige();
  expect(s.container.querySelector('[data-testid="detail-sicherung"]')).not.toBeNull();
  return s;
}

function bereich(s: Stand, id: string): Element {
  const el = s.container.querySelector(`[data-testid="sicherungsumfang"] [data-bereich="${id}"]`);
  expect(el, `der Bereich ${id} fehlt`).not.toBeNull();
  return el as Element;
}

describe("S1/S2 · der Umfang je Bereich, ohne rückwirkenden Beleg", () => {
  it("S1 · der Abschnitt nennt Fassung und Commit, an die er gebunden ist", async () => {
    const s = await karte();
    const abschnitt = s.container.querySelector('[data-testid="sicherungsumfang"]');
    expect(abschnitt?.querySelector("h3")?.textContent).toBe(
      t("sicherungsnachweise.bereiche.titel"),
    );
    const fassung = abschnitt?.querySelector('[data-testid="umfang-fassung"]')?.textContent ?? "";
    expect(fassung).toContain("1.0.0-beta.1.fiktiv");
    expect(fassung).toContain("abc1234fiktiv");
    expect(fassung).toContain("63");
    expect(fragen).toEqual(["GET"]);
  });

  it("S2 · Gespräche, Aufgaben, Name/Avatar und Avatarbilder stehen einzeln, mit Grund und Beleg", async () => {
    const s = await karte();
    for (const id of ["assistenzprofil", "gespraeche", "gedaechtnis", "sitzungen"]) {
      const el = bereich(s, id);
      expect(el.getAttribute("data-umfang"), id).toBe("im_dump");
      expect(el.getAttribute("data-beleg"), id).toBe("nicht_gemessen");
      expect(el.textContent, id).toContain(t("sicherungsnachweise.bereiche.beleg.nicht_gemessen"));
      expect(el.textContent, id).toContain(t(`sicherungsnachweise.bereiche.${id}.titel`));
    }
    expect(bereich(s, "assistenzprofil").textContent).toContain("assistenz_profile");
    for (const id of ["eigeneavatare", "aufgaben"]) {
      const el = bereich(s, id);
      expect(el.getAttribute("data-umfang"), id).toBe("nicht_vorhanden");
      expect(el.textContent, id).toContain(
        t("sicherungsnachweise.bereiche.zustand.nicht_vorhanden"),
      );
    }
    for (const id of ["avatarmotive", "endgeraet"]) {
      const el = bereich(s, id);
      expect(el.getAttribute("data-umfang"), id).toBe("ausgeschlossen");
      // Grund und Wiederherstellungsfolge stehen im Text des Bereichs.
      expect(el.textContent, id).toContain(t(`sicherungsnachweise.bereiche.${id}.text`));
    }
    expect(bereich(s, "anhangsbytes").getAttribute("data-beleg")).toBe("belegt");
  });

  // Nacharbeit 3 (Ben, PV-01-03): gleiche Zeilenzahlen privater Bereiche heißen „nur
  // Tabellenvergleich“ — die Karte darf sie nicht wie einen inhaltlichen Wiederherstellungsbeleg zeigen.
  it("S2b · ein reiner Tabellenvergleich steht als solcher da, nicht als belegt", async () => {
    const umfang = AUSKUNFT.umfang as NonNullable<SicherungenAuskunft["umfang"]>;
    antwort = {
      ...AUSKUNFT,
      umfang: {
        ...umfang,
        bereiche: umfang.bereiche.map((b) =>
          b.art === "assistenz" && b.zustand === "im_dump"
            ? { ...b, beleg: "zeilen_gleich" as const }
            : b,
        ),
      },
    };
    const s = await karte();
    for (const id of ["assistenzprofil", "gespraeche", "gedaechtnis", "sitzungen"]) {
      const el = bereich(s, id);
      expect(el.getAttribute("data-beleg"), id).toBe("zeilen_gleich");
      expect(el.textContent, id).toContain(t("sicherungsnachweise.bereiche.beleg.zeilen_gleich"));
      expect(el.textContent, id).not.toContain(t("sicherungsnachweise.bereiche.beleg.belegt"));
    }
    expect(t("sicherungsnachweise.bereiche.beleg.zeilen_gleich")).not.toBe(
      t("sicherungsnachweise.bereiche.beleg.belegt"),
    );
  });

  it("S3 · der Restore-Nachweis führt die Assistenzspeicher als eigene, ungemessene Zeile", async () => {
    const s = await karte();
    const zeile = s.container.querySelector(
      '[data-testid="schutzweg-restore"] [data-kategorie="assistenz"]',
    );
    expect(zeile?.getAttribute("data-vergleich")).toBe("nicht_gemessen");
    expect(zeile?.textContent).toContain(t("sicherungsnachweise.restore.kat.assistenz"));
  });
});

describe("S4 · drei Sprachen, kein roher Schlüssel", () => {
  for (const lng of ["de", "en", "nl"] as const) {
    it(`${lng}: der Umfang ist übersetzt`, async () => {
      await sprache(lng);
      const s = await karte();
      const text = s.container.querySelector('[data-testid="sicherungsumfang"]')?.textContent ?? "";
      expect(text.length).toBeGreaterThan(200);
      expect(text).not.toContain("sicherungsnachweise.");
      expect(text).toContain(t("sicherungsnachweise.bereiche.eigeneavatare.titel"));
    });
  }
});
