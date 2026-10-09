// @vitest-environment jsdom
// ================================================================================================
// ADMIN-13 · DIE FLÄCHE — vier Schutzwege, vier Befunde, in der Karte „Sicherung".
// ================================================================================================
//
// Gemessen wird über den Nutzerweg `/admin?bereich=system&detail=sicherung` an der echten Karte mit
// echter i18n. Das Netz beantwortet genau EINE Adresse — `GET /api/admin/sicherungen` — mit einer
// fiktiven Auskunft; die Karte darf keine zweite fragen und nichts schreiben.
//
//   F1  Exportdatei, Backup-Lauf, Papierkorb und Restore-Nachweis stehen getrennt, je mit Marke
//   F2  ein belegter Restore zeigt Datum, Sicherungsstand, isoliertes Ziel und vier Vergleiche — und
//       den Satz, dass Prüfsumme und Wiederherstellung getrennte Nachweise sind
//   F3  beschädigte Sicherung (Exit 11): Fehler-Marke, Grund, nächster Schritt
//   F4  unbekannt: Grund und nächster Schritt; das fehlende Vorgabeverzeichnis wird nicht als
//       „keine Sicherung" gelesen
//   F5  de/en/nl: kein roher Schlüssel, jede Sprache eigen
//   F6  nur lesend, nur diese eine Adresse
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

const BELEGT: SicherungenAuskunft = {
  zustand: "gelesen",
  verzeichnis: "/data/backups",
  gelesenUtc: "2026-10-09T08:00:00.000Z",
  sicherungen: [
    {
      datei: "klarwerk-20261009T030000Z.dump",
      zeitpunktUtc: "2026-10-09T03:00:00.000Z",
      groesseBytes: 4096,
      beglaubigt: true,
      pruefsumme: "c".repeat(64),
      folgeNummer: 1,
    },
  ],
  schutzwege: {
    verzeichnisQuelle: "BACKUP_DIR",
    letzterLauf: {
      zustand: "erfolg",
      zeitUtc: "2026-10-09T03:00:05.000Z",
      exitcode: 0,
      grund: "Lesepruefung: pg_restore --list",
      datei: "klarwerk-20261009T030000Z.dump",
    },
    restore: {
      zustand: "erfolg",
      beginnUtc: "2026-10-09T04:00:00.000Z",
      zeitUtc: "2026-10-09T04:03:12.000Z",
      exitcode: 0,
      grund: "Drill bestanden.",
      sicherung: "klarwerk-20261009T030000Z.dump",
      sicherungZeitpunktUtc: "2026-10-09T03:00:00.000Z",
      pruefsumme: { zustand: "passt", sha256: "c".repeat(64) },
      ziel: "klarwerk_drill_fiktiv_20261009",
      vergleich: {
        beitraege: kategorie([
          ["kos", 3, 3],
          ["ko_versions", 4, 4],
        ]),
        anhaenge: {
          ...kategorie([
            ["objects", 1, 1],
            ["ko_evidence", 1, 1],
          ]),
          belegeOhneAnhang: 0,
        },
        beziehungen: kategorie([
          ["ko_kanten", 1, 1],
          ["ko_kanten_beitrag", 1, 1],
        ]),
        rechte: {
          ...kategorie([["users", 2, 2]]),
          rollenDump: "admin/t=1 experte/t=1",
          rollenDatenbank: "admin/t=1 experte/t=1",
        },
      },
      wissensnachweis: "Wissensobjekt ko-1 mit Beleg auf obj-1 zurueckgelesen.",
    },
    export: {
      zustand: "vorhanden",
      bibliothek: { zeitUtc: "2026-10-08T12:00:00.000Z", format: "json", anzahl: 3, gesamt: 2 },
      auditkette: null,
    },
    papierkorb: {
      zustand: "gelesen",
      anzahl: 1,
      aufbewahrungTage: 30,
      naechsteEndloeschungUtc: "2026-11-07T10:00:00.000Z",
      ereignisseProtokolliert: true,
      letzteWiederherstellungUtc: null,
      letzteEndloeschungUtc: null,
    },
  },
};

const BESCHAEDIGT: SicherungenAuskunft = {
  ...BELEGT,
  schutzwege: {
    ...(BELEGT.schutzwege as NonNullable<SicherungenAuskunft["schutzwege"]>),
    restore: {
      zustand: "fehler",
      beginnUtc: "2026-10-09T04:00:00.000Z",
      zeitUtc: "2026-10-09T04:00:01.000Z",
      exitcode: 11,
      grund: "Pruefsumme passt nicht zum Dump - die Sicherung ist beschaedigt.",
      sicherung: "klarwerk-20261009T030000Z.dump",
      sicherungZeitpunktUtc: "2026-10-09T03:00:00.000Z",
      pruefsumme: { zustand: "abweichend", sha256: "d".repeat(64) },
      ziel: "klarwerk_drill_fiktiv_20261009",
      vergleich: {
        beitraege: kategorie([], "nicht_gemessen"),
        anhaenge: { ...kategorie([], "nicht_gemessen"), belegeOhneAnhang: null },
        beziehungen: kategorie([], "nicht_gemessen"),
        rechte: { ...kategorie([], "nicht_gemessen"), rollenDump: null, rollenDatenbank: null },
      },
      wissensnachweis: null,
    },
  },
};

const OHNE_ORT: SicherungenAuskunft = {
  zustand: "kein_verzeichnis",
  verzeichnis: "/app/backups",
  gelesenUtc: "2026-10-09T08:00:00.000Z",
  schutzwege: {
    verzeichnisQuelle: "vorgabe",
    letzterLauf: { zustand: "unbekannt", grund: "kein_verzeichnis" },
    restore: { zustand: "unbekannt", grund: "kein_verzeichnis" },
    export: { zustand: "keiner", bibliothek: null, auditkette: null },
    papierkorb: { zustand: "unbekannt", grund: "protokoll_unlesbar" },
  },
};

let antwort: SicherungenAuskunft = BELEGT;
let protokoll: { verfahren: string; pfad: string }[] = [];
let stand: Stand | null = null;

function netz(): void {
  protokoll = [];
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: async (eingabe: unknown, init?: { method?: string }) => {
      const pfad = String(eingabe);
      if (!pfad.endsWith(WEG)) {
        throw new Error(`kein Netz in diesem Prüfstand: ${pfad}`);
      }
      protokoll.push({ verfahren: (init?.method ?? "GET").toUpperCase(), pfad });
      return {
        status: 200,
        ok: true,
        statusText: "OK",
        text: async () => JSON.stringify(antwort),
      };
    },
  });
}

beforeEach(() => {
  setzeStufe2(true);
  antwort = BELEGT;
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

async function karte(a: SicherungenAuskunft): Promise<Stand> {
  antwort = a;
  const s = montiere(adminHref("system", "sicherung"));
  stand = s;
  await beruhige();
  expect(
    s.container.querySelector('[data-testid="detail-sicherung"]'),
    "die Karte ging nicht auf",
  ).not.toBeNull();
  return s;
}

function weg(s: Stand, name: string): Element {
  const el = s.container.querySelector(`[data-testid="schutzweg-${name}"]`);
  expect(el, `der Schutzweg ${name} fehlt`).not.toBeNull();
  return el as Element;
}

function marke(el: Element): string | null {
  return el.querySelector('[data-testid="weg-zustand"]')?.getAttribute("data-zustand") ?? null;
}

describe("ADMIN-13 · F1 · vier Schutzwege, getrennt", () => {
  it("Exportdatei, Backup-Lauf, Papierkorb und Restore-Nachweis stehen je mit Titel und Marke da", async () => {
    const s = await karte(BELEGT);
    const titel = ["export", "lauf", "papierkorb", "restore"].map(
      (n) => weg(s, n).querySelector("h3")?.textContent ?? "",
    );
    expect(titel).toEqual([
      t("sicherungsnachweise.export.titel"),
      t("sicherungsnachweise.lauf.titel"),
      t("sicherungsnachweise.papierkorb.titel"),
      t("sicherungsnachweise.restore.titel"),
    ]);
    expect(new Set(titel).size, "zwei Wege tragen denselben Titel").toBe(4);
    expect(marke(weg(s, "export"))).toBe("erfolg");
    expect(marke(weg(s, "lauf"))).toBe("erfolg");
    expect(marke(weg(s, "papierkorb"))).toBe("erfolg");
    expect(marke(weg(s, "restore"))).toBe("erfolg");
    // Jeder Weg nennt Umfang, Aufbewahrung und Zuständigkeit.
    for (const n of ["export", "lauf", "papierkorb", "restore"]) {
      const text = weg(s, n).textContent ?? "";
      expect(text, `${n}: Aufbewahrung fehlt`).toContain(
        t("sicherungsnachweise.aufbewahrung", { text: "" }).trim(),
      );
    }
    expect(weg(s, "papierkorb").textContent).toContain("30");
    expect(weg(s, "export").textContent).toContain("json");
  });
});

describe("ADMIN-13 · F2 · ein belegter Restore zeigt Datum, Stand, Ziel und vier Vergleiche", () => {
  it("die Angaben stehen im Restore-Abschnitt, die Prüfsumme als eigener Satz daneben", async () => {
    const s = await karte(BELEGT);
    const r = weg(s, "restore");
    expect(r.querySelector('[data-testid="restore-sicherung"]')?.textContent).toContain(
      "klarwerk-20261009T030000Z.dump",
    );
    expect(r.querySelector('[data-testid="restore-ziel"]')?.textContent).toContain(
      "klarwerk_drill_fiktiv_20261009",
    );
    expect(r.querySelector('[data-testid="restore-zeit"]')?.textContent).toContain("2026");
    const kategorien = [...r.querySelectorAll("[data-kategorie]")].map((e) => [
      e.getAttribute("data-kategorie"),
      e.getAttribute("data-vergleich"),
    ]);
    expect(kategorien).toEqual([
      ["beitraege", "gleich"],
      ["anhaenge", "gleich"],
      ["beziehungen", "gleich"],
      ["rechte", "gleich"],
    ]);
    expect(r.textContent).toContain("admin/t=1 experte/t=1");
    expect(r.querySelector('[data-testid="restore-getrennt"]')?.textContent).toBe(
      t("sicherungsnachweise.restore.getrennt"),
    );
    expect(
      r.querySelector('[data-testid="weg-schritt"]'),
      "ein Erfolg braucht keinen Schritt",
    ).toBeNull();
  });
});

describe("ADMIN-13 · F3 · beschädigte Sicherung: sichtbarer Fehlbefund mit nächstem Schritt (K5)", () => {
  it("Exit 11 trägt die Fehler-Marke, den Grund und den Schritt „nicht verwenden“", async () => {
    const s = await karte(BESCHAEDIGT);
    const r = weg(s, "restore");
    expect(marke(r)).toBe("fehler");
    expect(r.querySelector('[data-testid="weg-grund"]')?.textContent).toContain("11");
    expect(r.querySelector('[data-testid="restore-pruefsumme"]')?.textContent).toContain(
      t("sicherungsnachweise.restore.pruefsumme.abweichend"),
    );
    expect(r.querySelector('[data-testid="weg-schritt"]')?.textContent).toContain(
      t("sicherungsnachweise.restore.schritt.pruefsumme"),
    );
    // Getrennte Nachweise: die Liste darüber sagt weiter nur „Prüfsummendatei vorhanden".
    expect(s.container.querySelector('[data-testid="sicherung-marke"]')?.textContent).toBe(
      t("adm.backup.certified"),
    );
  });
});

describe("ADMIN-13 · F4 · unbekannt mit Grund — kein Rückschluss vom fehlenden Vorgabeverzeichnis", () => {
  it("fehlendes /app/backups: der Ort ist als Vorgabe benannt, /data/backups und Snapshots bleiben offen", async () => {
    const s = await karte(OHNE_ORT);
    const ort = s.container.querySelector('[data-testid="schutzwege-ort"]')?.textContent ?? "";
    expect(ort).toBe(t("sicherungsnachweise.ort.vorgabe"));
    expect(ort).toContain("/data/backups");
    for (const n of ["lauf", "restore", "papierkorb"]) {
      const w = weg(s, n);
      expect(marke(w), n).toBe("unbekannt");
      const grund = w.querySelector('[data-testid="weg-grund"]')?.textContent;
      const schritt = w.querySelector('[data-testid="weg-schritt"]')?.textContent;
      expect(grund, `${n}: Grund`).toBeTruthy();
      expect(schritt, `${n}: Schritt`).toBeTruthy();
    }
    expect(weg(s, "restore").querySelector('[data-testid="weg-grund"]')?.textContent).toContain(
      t("sicherungsnachweise.unbekannt.kein_verzeichnis"),
    );
    expect(marke(weg(s, "export"))).toBe("keiner");
    // Der bestehende Satz der Liste bleibt „nicht feststellbar" — nie „keine".
    expect(s.container.querySelector('[data-testid="sicherung-leer"]')).toBeNull();
  });
});

describe("ADMIN-13 · F5 · drei Sprachen", () => {
  it("de/en/nl: kein roher Schlüssel in der Karte, jede Sprache mit eigenem Titel", async () => {
    const titel: string[] = [];
    for (const lng of ["de", "en", "nl"] as const) {
      await sprache(lng);
      for (const a of [BELEGT, BESCHAEDIGT, OHNE_ORT]) {
        const s = await karte(a);
        const text =
          s.container.querySelector('[data-testid="detail-sicherung"]')?.textContent ?? "";
        expect(text, `${lng}: roher Schlüssel`).not.toContain("sicherungsnachweise.");
        expect(text, `${lng}: Platzhalter stehen geblieben`).not.toContain("{{");
        abbauen(s);
        stand = null;
      }
      titel.push(i18n.getFixedT(lng)("sicherungsnachweise.restore.titel"));
    }
    expect(new Set(titel).size, JSON.stringify(titel)).toBe(3);
  });
});

describe("ADMIN-13 · F6 · nur lesend, nur eine Adresse", () => {
  it("die Karte mit Schutzwegen fragt ausschließlich GET /api/admin/sicherungen", async () => {
    await karte(BELEGT);
    expect(protokoll.length).toBeGreaterThan(0);
    expect(protokoll.filter((r) => r.verfahren !== "GET")).toEqual([]);
    expect([...new Set(protokoll.map((r) => r.pfad))]).toEqual([WEG]);
  });
});
