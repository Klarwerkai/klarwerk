// ================================================================================================
// JOB 3272 · UX-25 — DIE EINE ZUORDNUNGSREGEL VON BELEG ZU ORIGINAL, UND DIE META-ZEILE DANEBEN.
// ================================================================================================
//
// Hier steht die reine Hälfte von UX-25: `belegOriginal` entscheidet aus einer Belegzeile und der
// Anhangsliste des Objekts, ob es ein Original gibt („vorhanden"), ob der Beleg auf eines zeigt,
// das dieses Objekt nicht (mehr) trägt („fehlt"), oder ob er gar keinen Bezug trägt („keiner").
// Die gemountete Wirkung misst `tests/ux25-beleg-zum-original/belegkarte-zum-original.test.tsx`.
//
// Die Fälle zur `meta`-Zeile sind kein Beiwerk: `koEvidence.ts:24` hat die rohe Kennung
// `object:<id>` als Anzeigetext gebaut. Sie ist ERSETZT, nicht danebengelegt — und die übrigen
// Angaben (`v<n>`, Anbieter, MIME, Adresse) müssen dabei unverändert bleiben.
import { describe, expect, it } from "vitest";
import type { EvidenceRecord, KoAttachment } from "../api/types";
import { belegOriginal, evidenceKindLabel, evidenceRows } from "./koEvidence";

function rec(overrides: Partial<EvidenceRecord>): EvidenceRecord {
  return {
    id: "ev-1",
    koId: "ko-1",
    koVersion: 1,
    kind: "source",
    label: "Quelle",
    createdBy: "pedi",
    createdAt: "2026-06-26T10:00:00.000Z",
    ...overrides,
  };
}

function att(overrides: Partial<KoAttachment>): KoAttachment {
  return {
    id: "att-1",
    name: "foto.png",
    mime: "image/png",
    author: "pedi",
    at: "2026-06-26T10:00:00.000Z",
    ...overrides,
  };
}

/** Die eine Zeile, aus der die Regel liest — so, wie `evidenceRows` sie baut. */
const zeile = (o: { attachmentId?: string; objectId?: string }) => o;

describe("koEvidence · Zeilenbildung", () => {
  it("sortiert Evidence neueste zuerst und baut Metadaten ehrlich", () => {
    const rows = evidenceRows([
      rec({ id: "old", createdAt: "2026-06-26T10:00:00.000Z" }),
      rec({
        id: "new",
        kind: "attachment",
        label: "Foto",
        koVersion: 2,
        mime: "image/jpeg",
        objectId: "obj-1",
        createdAt: "2026-06-26T11:00:00.000Z",
      }),
    ]);
    expect(rows.map((r) => r.key)).toEqual(["new", "old"]);
    // Die rohe Kennung ist WEG — der Bezug wird jetzt als Weg angeboten, nicht als Programmwort.
    expect(rows[0]).toMatchObject({
      kind: "attachment",
      title: "Foto",
      meta: ["v2", "image/jpeg"],
    });
  });

  it("die übrigen meta-Angaben bleiben unverändert: v<n>, Anbieter, MIME, Adresse", () => {
    const [row] = evidenceRows([
      rec({
        koVersion: 7,
        provider: "example.org",
        mime: "application/pdf",
        url: "https://example.org/a.pdf",
        objectId: "obj-9",
      }),
    ]);
    expect(row?.meta).toEqual([
      "v7",
      "example.org",
      "application/pdf",
      "https://example.org/a.pdf",
    ]);
    expect(row?.meta.join(" · ")).not.toContain("object:");
  });

  it("trägt den Originalbezug weiter, statt ihn wegzuwerfen", () => {
    const [row] = evidenceRows([
      rec({ kind: "attachment", attachmentId: "att-1", objectId: "obj-1" }),
    ]);
    expect(row?.attachmentId).toBe("att-1");
    expect(row?.objectId).toBe("obj-1");
  });

  it("liefert stabile Kind-Labels", () => {
    expect(evidenceKindLabel("source")).toBe("source");
    expect(evidenceKindLabel("attachment")).toBe("attachment");
  });
});

describe("koEvidence · belegOriginal — die eine Zuordnungsregel", () => {
  const anhaenge = [
    att({ id: "att-1", objectId: "obj-1" }),
    att({ id: "att-2", objectId: "obj-2" }),
  ];

  it("vorhanden: die Anhangskennung trifft genau einen Anhang", () => {
    expect(belegOriginal(zeile({ attachmentId: "att-2" }), anhaenge)).toEqual({
      art: "vorhanden",
      anhangId: "att-2",
    });
  });

  it("vorhanden: ohne Anhangskennung trägt die Objektkennung", () => {
    expect(belegOriginal(zeile({ objectId: "obj-1" }), anhaenge)).toEqual({
      art: "vorhanden",
      anhangId: "att-1",
    });
  });

  it("fehlt: der Beleg trägt einen Bezug, den dieses Objekt nicht (mehr) trägt", () => {
    expect(belegOriginal(zeile({ objectId: "obj-weg" }), anhaenge)).toEqual({ art: "fehlt" });
    expect(belegOriginal(zeile({ attachmentId: "att-weg" }), anhaenge)).toEqual({ art: "fehlt" });
    expect(belegOriginal(zeile({ objectId: "obj-1" }), [])).toEqual({ art: "fehlt" });
  });

  it("Fall M · zwei Anhänge mit derselben Objektkennung: „fehlt“, keine willkürliche Wahl", () => {
    const doppelt = [
      att({ id: "att-1", objectId: "obj-1" }),
      att({ id: "att-2", objectId: "obj-1" }),
    ];
    expect(belegOriginal(zeile({ objectId: "obj-1" }), doppelt)).toEqual({ art: "fehlt" });
  });

  it("Fall M2 · die genauere Anhangskennung entscheidet, wo die Objektkennung raten müsste", () => {
    const doppelt = [
      att({ id: "att-1", objectId: "obj-1" }),
      att({ id: "att-2", objectId: "obj-1" }),
    ];
    expect(belegOriginal(zeile({ attachmentId: "att-2", objectId: "obj-1" }), doppelt)).toEqual({
      art: "vorhanden",
      anhangId: "att-2",
    });
  });

  // ----------------------------------------------------------------------------------------------
  // RUNDE 2 · BENs Gegenbeispiel (Korrekturpflicht 1) — die DOPPELTE ANHANGKENNUNG.
  // ----------------------------------------------------------------------------------------------
  //
  // Die erste Fassung prüfte Mehrdeutigkeit nur an der OBJEKTkennung (Fall M oben). Doppelte
  // ANHANGkennungen fielen durch: `genauEiner` meldete „kein Treffer" statt „mehrdeutig", die Regel
  // fiel auf die Objektkennung zurück, fand dort genau einen — und bot einen Weg an, der im DOM auf
  // dem ERSTEN gleichnamigen Anker landete, also am falschen Original.
  describe("Fall D · doppelte Anhangkennung — kein Rückfall, kein mehrdeutiger Anker", () => {
    /** Wörtlich Bens Bestand: zwei Anhänge, EINE Kennung, verschiedene Originale. */
    const doppelteKennung = [
      att({ id: "doppelt", objectId: "obj-1", name: "erstes.png" }),
      att({ id: "doppelt", objectId: "obj-2", name: "zweites.png" }),
    ];

    it("D1 · Bens Fall: `attachmentId` mehrdeutig, `objectId` trifft NUR den zweiten → „fehlt“", () => {
      // Vor der Behebung: `{ art: "vorhanden", anhangId: "doppelt" }` — und der Sprung landete auf
      // dem ersten. Der Rückfall macht aus einer mehrdeutigen Angabe keine eindeutige.
      expect(
        belegOriginal(zeile({ attachmentId: "doppelt", objectId: "obj-2" }), doppelteKennung),
      ).toEqual({ art: "fehlt" });
    });

    it("D2 · dieselbe Mehrdeutigkeit ohne Objektkennung → „fehlt“", () => {
      expect(belegOriginal(zeile({ attachmentId: "doppelt" }), doppelteKennung)).toEqual({
        art: "fehlt",
      });
    });

    it("D3 · auch der reine Objektweg darf keinen mehrdeutigen Anker liefern", () => {
      // Hier ist die Objektkennung eindeutig (nur der zweite Anhang trägt `obj-2`) — der ANKER ist
      // es nicht: „doppelt" steht zweimal im Bestand, und die Fläche sucht über die Kennung.
      expect(belegOriginal(zeile({ objectId: "obj-2" }), doppelteKennung)).toEqual({
        art: "fehlt",
      });
    });

    it("D5 · der Rückfall führt nicht zu einem GANZ ANDEREN Anhang", () => {
      // Der schärfste Fall: die Anhangkennung ist mehrdeutig, die Objektkennung zeigt auf einen
      // dritten, eindeutig benannten Anhang. Ohne den Abbruch bei mehreren Treffern (Grund (a))
      // spränge die Karte auf „att-3" — auf ein Original, das der Beleg nie gemeint hat.
      const gemischt = [
        att({ id: "doppelt", objectId: "obj-1" }),
        att({ id: "doppelt", objectId: "obj-2" }),
        att({ id: "att-3", objectId: "obj-3" }),
      ];
      expect(
        belegOriginal(zeile({ attachmentId: "doppelt", objectId: "obj-3" }), gemischt),
      ).toEqual({ art: "fehlt" });
    });

    it("D4 · ein eindeutiger Nachbar im selben Bestand bleibt erreichbar", () => {
      // Die Verschärfung darf nicht alles miterschlagen: der dritte Anhang trägt eine eigene
      // Kennung und bleibt anspringbar.
      const gemischt = [...doppelteKennung, att({ id: "att-3", objectId: "obj-3" })];
      expect(belegOriginal(zeile({ attachmentId: "att-3" }), gemischt)).toEqual({
        art: "vorhanden",
        anhangId: "att-3",
      });
      expect(belegOriginal(zeile({ objectId: "obj-3" }), gemischt)).toEqual({
        art: "vorhanden",
        anhangId: "att-3",
      });
    });
  });

  it("keiner: gar kein Bezug — eine reine Adressquelle bekommt keinen Weg angeboten", () => {
    expect(belegOriginal(zeile({}), anhaenge)).toEqual({ art: "keiner" });
  });

  it("Fall S · Leerstring und Leerraum sind KEIN Bezug: „keiner“, nicht „fehlt“", () => {
    expect(belegOriginal(zeile({ objectId: "" }), anhaenge)).toEqual({ art: "keiner" });
    expect(belegOriginal(zeile({ attachmentId: "   ", objectId: "  " }), anhaenge)).toEqual({
      art: "keiner",
    });
  });

  it("ein Anhang mit leerer Objektkennung wird von einem leeren Bezug nicht getroffen", () => {
    // Altbestand: Inline-Anhang ohne `objectId` (SCRUM-121). Ein Beleg mit Leerstring dürfte ihn
    // nicht „finden" — sonst führte der Weg auf einen beliebigen Altanhang.
    const alt = [att({ id: "att-alt" })];
    expect(belegOriginal(zeile({ objectId: "" }), alt)).toEqual({ art: "keiner" });
    expect(belegOriginal(zeile({ objectId: "obj-1" }), alt)).toEqual({ art: "fehlt" });
  });

  it("die Regel liest nur den Bezug, nicht die Belegart — auch ein Quellbeleg kann verankert sein", () => {
    const [row] = evidenceRows([rec({ kind: "source", attachmentId: "att-1" })]);
    expect(row && belegOriginal(row, anhaenge)).toEqual({ art: "vorhanden", anhangId: "att-1" });
  });
});
