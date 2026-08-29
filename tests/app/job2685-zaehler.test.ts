// ================================================================================================
// JOB 2685 D1 (Review R2-30) — DER ZÄHLER: 200 Wissensobjekte à 1 MB, ein Bildabruf.
// ================================================================================================
//
// Der Auftrag verlangt eine Messung („200 KOs à 1 MB, GET /api/objects/:id/raw, DB-Transfer vorher
// und nachher"). In der Sandbox gibt es kein Postgres (connect EPERM) — also, wie §3 es vorsieht,
// „die Zahl der Abfragen (Zähler am Repo)": Hier zählen die Quellen selbst, was `beurteileAnhang`
// von ihnen verlangt — wie viele Objekte und wie viele Bytes `kos` liefern muss, und wie oft die
// Fassungen und Belege je Objekt nachgeladen werden.
//
// Der Fall ist der schlimmste des Reviews: das Bild steht NUR im Fließtext (Word-Import, kein
// `attachments`-Eintrag). Die billige Stufe findet dann keinen NACHWEIS, und die teure läuft —
// vorher über ALLE 200 Objekte (200 × Belege + 200 × Fassungen), nachher über den einen Träger.
import { describe, expect, it } from "vitest";
import type { SessionUser } from "../../services/app/src/http";
import {
  type AnhangFassung,
  type AnhangQuellen,
  type AnhangTraeger,
  KandidatenSpeicher,
  beurteileAnhang,
} from "../../services/app/src/sichtbarkeit";

const MB = 1024 * 1024;
const BESTAND = 200;
const BILD = "obj-bild-7f3c";
const HOCHLADENDER = "u-anna";

interface Zaehler {
  kosAufrufe: number;
  kosObjekte: number;
  kosBytes: number;
  versionenAufrufe: number;
  versionenBytes: number;
  belegeAufrufe: number;
  entwuerfeAufrufe: number;
}

function leer(): Zaehler {
  return {
    kosAufrufe: 0,
    kosObjekte: 0,
    kosBytes: 0,
    versionenAufrufe: 0,
    versionenBytes: 0,
    belegeAufrufe: 0,
    entwuerfeAufrufe: 0,
  };
}

// EIN 1-MB-Text, von allen Objekten geteilt — im Speicher 1 MB, in der Rechnung 200 MB, genau wie
// eine Datenbank ihn 200-mal über die Leitung schicken müsste.
const SATZ = "Anlage freischalten, Druck ablassen, Sicherung prüfen. ";
const FUELLTEXT = `<p>${SATZ.repeat(Math.ceil(MB / SATZ.length) + 1)}</p>`;

function bestand(): { kos: AnhangTraeger[]; versionen: Map<string, AnhangFassung[]> } {
  const kos: AnhangTraeger[] = [];
  const versionen = new Map<string, AnhangFassung[]>();
  for (let i = 0; i < BESTAND; i++) {
    const id = `ko-${i}`;
    const traegt = i === 137;
    const bodyHtml = traegt ? `${FUELLTEXT}<img src="/api/objects/${BILD}/raw">` : FUELLTEXT;
    const ko: AnhangTraeger = { id, confidentiality: "intern", author: HOCHLADENDER, bodyHtml };
    kos.push(ko);
    // Jedes Objekt hat eine Fassung — die erste, vom Hochladenden geschrieben (Word-Import).
    versionen.set(id, [{ author: HOCHLADENDER, stand: { ...ko } }]);
  }
  return { kos, versionen };
}

function bytes(k: AnhangTraeger): number {
  return typeof k.bodyHtml === "string" ? k.bodyHtml.length : 0;
}

function gezaehlt(
  b: ReturnType<typeof bestand>,
  vorsortieren: boolean,
): { quellen: AnhangQuellen; z: Zaehler } {
  const z = leer();
  const quellen: AnhangQuellen = {
    kos: async (objectId) => {
      z.kosAufrufe += 1;
      const geliefert = vorsortieren
        ? b.kos.filter((k) => typeof k.bodyHtml === "string" && k.bodyHtml.includes(objectId))
        : b.kos;
      z.kosObjekte += geliefert.length;
      z.kosBytes += geliefert.reduce((s, k) => s + bytes(k), 0);
      return geliefert;
    },
    versionen: async (koId) => {
      z.versionenAufrufe += 1;
      const f = b.versionen.get(koId) ?? [];
      z.versionenBytes += f.reduce((s, v) => s + bytes(v.stand), 0);
      return f;
    },
    belege: async () => {
      z.belegeAufrufe += 1;
      return [];
    },
    entwuerfe: async () => {
      z.entwuerfeAufrufe += 1;
      return [];
    },
  };
  return { quellen, z };
}

const BETRACHTER: SessionUser = { id: "u-bert", role: "viewer" };
const EIGEN = { confidentiality: null, author: HOCHLADENDER };

describe("JOB 2685 D1 · Zähler: was ein Bildabruf von den Quellen verlangt", () => {
  it("VORHER: der ganze Bestand — 200 Objekte, 200 MB, dazu 200 × Fassungen (weitere 200 MB) und 200 × Belege", async () => {
    const b = bestand();
    const { quellen, z } = gezaehlt(b, false);
    const urteil = await beurteileAnhang(BETRACHTER, BILD, EIGEN, quellen);
    expect(urteil).toEqual({ sichtbar: true, vertraulich: false });
    expect(z.kosAufrufe).toBe(1);
    expect(z.kosObjekte).toBe(200);
    expect(z.kosBytes).toBeGreaterThanOrEqual(200 * MB);
    expect(z.entwuerfeAufrufe).toBe(1);
    expect(z.belegeAufrufe).toBe(200);
    expect(z.versionenAufrufe).toBe(200);
    expect(z.versionenBytes).toBeGreaterThanOrEqual(200 * MB);
  });

  it("NACHHER: nur der Träger — 1 Objekt, 1 MB, 1 × Fassungen, 1 × Belege; das Urteil ist dasselbe", async () => {
    const b = bestand();
    const { quellen, z } = gezaehlt(b, true);
    const urteil = await beurteileAnhang(BETRACHTER, BILD, EIGEN, quellen);
    expect(urteil).toEqual({ sichtbar: true, vertraulich: false });
    expect(z.kosAufrufe).toBe(1);
    expect(z.kosObjekte).toBe(1);
    expect(z.kosBytes).toBeLessThan(2 * MB);
    expect(z.entwuerfeAufrufe).toBe(1);
    expect(z.belegeAufrufe).toBe(1);
    expect(z.versionenAufrufe).toBe(1);
    expect(z.versionenBytes).toBeLessThan(2 * MB);
  });

  it("die Rechnung für eine Seite mit zehn Bildern, OHNE den Zwischenspeicher der Route: 10 × Träger statt 10 × Bestand", async () => {
    const b = bestand();
    // Zehn verschiedene Bilder, jedes in einem anderen Objekt.
    for (let i = 0; i < 10; i++) {
      const ko = b.kos[i * 7];
      if (ko) {
        ko.bodyHtml = `${FUELLTEXT}<img src="/api/objects/obj-seite-${i}/raw">`;
        b.versionen.set(ko.id, [{ author: HOCHLADENDER, stand: { ...ko } }]);
      }
    }
    const vorher = gezaehlt(b, false);
    const nachher = gezaehlt(b, true);
    for (let i = 0; i < 10; i++) {
      const a = await beurteileAnhang(BETRACHTER, `obj-seite-${i}`, EIGEN, vorher.quellen);
      const n = await beurteileAnhang(BETRACHTER, `obj-seite-${i}`, EIGEN, nachher.quellen);
      expect(n).toEqual(a);
    }
    expect(vorher.z.kosObjekte).toBe(10 * 200);
    expect(vorher.z.kosBytes).toBeGreaterThanOrEqual(10 * 200 * MB);
    expect(vorher.z.versionenAufrufe).toBe(10 * 200);
    expect(nachher.z.kosObjekte).toBe(10);
    expect(nachher.z.kosBytes).toBeLessThan(10 * 2 * MB);
    expect(nachher.z.versionenAufrufe).toBe(10);
  });

  it("D2 · eine Seite mit zehn Bildern MIT dem Kandidaten-Speicher: ZWEI Trägersuchen, nicht zehn — und zehn frische Einzellesungen", async () => {
    const b = bestand();
    // Alle zehn Bilder in EINEM Objekt — die Wissensobjekt-Seite.
    const seite = b.kos[42];
    const bilder = Array.from({ length: 10 }, (_, i) => `obj-seite-${i}`);
    if (seite) {
      seite.bodyHtml = `${FUELLTEXT}${bilder.map((id) => `<img src="/api/objects/${id}/raw">`).join("")}`;
      b.versionen.set(seite.id, [{ author: HOCHLADENDER, stand: { ...seite } }]);
    }
    const { quellen, z } = gezaehlt(b, true);
    let suchen = 0;
    let einzel = 0;
    const mit: AnhangQuellen = {
      ...quellen,
      kosFuer: async (ids) => {
        suchen += 1;
        return b.kos.filter(
          (k) => typeof k.bodyHtml === "string" && ids.some((id) => k.bodyHtml?.includes(id)),
        );
      },
      ko: async (koId) => {
        einzel += 1;
        return b.kos.find((k) => k.id === koId);
      },
      // D3: ein unveränderter Bestand hat einen unveränderten Schreibstand.
      stand: async () => "0",
    };
    const speicher = new KandidatenSpeicher({ fristMs: 5_000, jetzt: () => 0 });
    for (const id of bilder) {
      const urteil = await beurteileAnhang(BETRACHTER, id, EIGEN, mit, speicher);
      expect(urteil).toEqual({ sichtbar: true, vertraulich: false });
    }
    expect(suchen).toBe(2); // Bild 1, dann seine neun Geschwister — in EINER Abfrage
    expect(speicher.traegersuchen).toBe(2);
    expect(einzel).toBe(10); // je Urteil der eine Träger, frisch
    expect(z.kosAufrufe).toBe(0); // `kos` (Einzelsuche) lief gar nicht
    expect(z.versionenAufrufe).toBe(10); // Fassungen nur für den Träger, je Bild
  });
});
