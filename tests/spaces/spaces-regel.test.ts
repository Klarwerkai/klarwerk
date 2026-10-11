// ================================================================================================
// SPACES · DIE REGEL — führender Space in `darfSehen` und im SQL-Trim, Eingabeprüfung, Rechte.
// ================================================================================================
//
// Reine Funktionen, kein Server. Was hier steht, ist die EINE Sichtbarkeitsregel, die Detail,
// Liste, Suche, Anhänge und Klara gemeinsam benutzen (`services/app/src/sichtbarkeit.ts`):
//   K3/K6 · ein Objekt mit führendem Space sieht nur, wer dessen Inhalte lesen darf — zusätzlich
//           zur Stufenregel, ohne Rollen-Durchgriff, fail-closed ohne Spaceangabe am Betrachter.
//   K1    · Eingabeprüfung eines Space (Zweck, Zuständigkeit, Mitglieder müssen echte Konten sein).
//   K5    · Spacezuständigkeit ist eine eigene Angabe, nicht die Artikelverantwortung.
import { describe, expect, it } from "vitest";
import type { SessionUser } from "../../services/app/src/http";
import { darfSehen, sqlSichtbarkeitFuer } from "../../services/app/src/sichtbarkeit";
import {
  type SpaceFassung,
  SpaceFehler,
  darfInSpaceSchreiben,
  darfSpaceBearbeiten,
  darfSpaceSehen,
  eigenesSpaceRecht,
  lesbareSpaces,
  pruefeSpaceEingabe,
} from "../../services/app/src/spaces";

function space(teil: Partial<SpaceFassung> & { id: string }): SpaceFassung {
  return {
    name: teil.id,
    zweck: "Testzweck",
    verantwortlich: "u-lea",
    zugang: "mitglieder",
    mitglieder: [],
    ansichten: [],
    version: 1,
    angelegtVon: "u-carla",
    angelegtAm: "2026-10-07T10:00:00.000Z",
    geaendertVon: "u-carla",
    geaendertAm: "2026-10-07T10:00:00.000Z",
    ...teil,
  };
}

const WERKSTATT = space({
  id: "s-werkstatt",
  mitglieder: [
    { nutzer: "u-erik", recht: "schreiben" },
    { nutzer: "u-vera", recht: "lesen" },
  ],
});
const OFFEN = space({ id: "s-offen", zugang: "alle", verantwortlich: "u-carla" });
const SPACES = [WERKSTATT, OFFEN];

function sitzung(id: string, role: SessionUser["role"]): SessionUser {
  return { id, role, spaceLesbar: lesbareSpaces(SPACES, id) };
}

describe("darfSehen · der führende Space ist eine zweite, unabhängige Bedingung", () => {
  const intern = { confidentiality: "intern" as const, author: "u-erik", spaceId: "s-werkstatt" };

  it("Mitglieder und Zuständige sehen, Nichtmitglieder nicht — auch nicht Controller oder Admin", () => {
    expect(darfSehen(sitzung("u-erik", "experte"), intern)).toBe(true);
    expect(darfSehen(sitzung("u-vera", "viewer"), intern)).toBe(true);
    expect(darfSehen(sitzung("u-lea", "experte"), intern)).toBe(true);
    expect(darfSehen(sitzung("u-fritz", "experte"), intern)).toBe(false);
    expect(darfSehen(sitzung("u-carla", "controller"), intern)).toBe(false);
    expect(darfSehen(sitzung("u-admin", "admin"), intern)).toBe(false);
  });

  it("ein offener Space öffnet nichts Vertrauliches; ohne Space gilt die bisherige Regel", () => {
    const vertraulichOffen = {
      confidentiality: "vertraulich" as const,
      author: "u-erik",
      spaceId: "s-offen",
    };
    expect(darfSehen(sitzung("u-fritz", "experte"), vertraulichOffen)).toBe(false);
    expect(darfSehen(sitzung("u-carla", "controller"), vertraulichOffen)).toBe(true);
    const ohneSpace = { confidentiality: "intern" as const, author: "u-erik" };
    expect(darfSehen(sitzung("u-fritz", "experte"), ohneSpace)).toBe(true);
    expect(darfSehen({ id: "u-fritz", role: "experte" }, ohneSpace)).toBe(true);
  });

  it("fail-closed: unbekannter Space oder Betrachter ohne Spaceangabe sieht nichts mit Space", () => {
    const geloescht = { ...intern, spaceId: "s-geloescht" };
    expect(darfSehen(sitzung("u-erik", "experte"), geloescht)).toBe(false);
    expect(darfSehen({ id: "u-erik", role: "experte" }, intern)).toBe(false);
  });
});

describe("sqlSichtbarkeitFuer · dieselbe Regel als SQL-Prädikat vor dem LIMIT", () => {
  it("mit Spaceangabe reist die Menge lesbarer Spaces als dritter Parameter", () => {
    const trim = sqlSichtbarkeitFuer(sitzung("u-erik", "experte"));
    expect(trim.params).toEqual([false, "u-erik", ["s-werkstatt", "s-offen"]]);
    const sql = trim.sql("kos", 4);
    expect(sql).toContain("$4::boolean");
    expect(sql).toContain("$5");
    expect(sql).toContain("kos.data->>'spaceId' = ANY($6::text[])");
    expect(sql).toContain("jsonb_typeof(kos.data->'spaceId') IS DISTINCT FROM 'string'");
  });

  it("ohne Spaceangabe bleibt die Parameterliste die bisherige, und jedes Objekt mit Space fällt weg", () => {
    const trim = sqlSichtbarkeitFuer({ id: "u-bert", role: "experte" });
    expect(trim.params).toEqual([false, "u-bert"]);
    const sql = trim.sql("kos", 1);
    expect(sql).not.toContain("$3");
    expect(sql).toContain("jsonb_typeof(kos.data->'spaceId') IS DISTINCT FROM 'string'");
  });

  it("trifftZu ist zeichengleich darfSehen samt Papierkorb", () => {
    const erik = sitzung("u-erik", "experte");
    const fritz = sitzung("u-fritz", "experte");
    const basis = { confidentiality: "intern" as const, author: "u-x" };
    type Fall = {
      confidentiality: "intern";
      author: string;
      spaceId?: string;
      deletedAt?: string;
    };
    const faelle: Fall[] = [
      { ...basis, spaceId: "s-werkstatt" },
      { ...basis, spaceId: "s-offen" },
      { ...basis },
      { ...basis, spaceId: "s-werkstatt", deletedAt: "2026-10-07" },
    ];
    for (const ko of faelle) {
      for (const wer of [erik, fritz]) {
        expect(sqlSichtbarkeitFuer(wer).trifftZu(ko)).toBe(!ko.deletedAt && darfSehen(wer, ko));
      }
    }
  });
});

describe("Spacerechte und Eingabeprüfung", () => {
  it("lesen, schreiben, bearbeiten und sehen sind getrennte Fragen", () => {
    expect([...lesbareSpaces(SPACES, "u-fritz")]).toEqual(["s-offen"]);
    expect(darfInSpaceSchreiben(WERKSTATT, { id: "u-erik", role: "experte" })).toBe(true);
    expect(darfInSpaceSchreiben(WERKSTATT, { id: "u-vera", role: "viewer" })).toBe(false);
    expect(darfInSpaceSchreiben(OFFEN, { id: "u-fritz", role: "experte" })).toBe(true);
    expect(darfInSpaceSchreiben(OFFEN, { id: "u-viewer", role: "viewer" })).toBe(false);
    expect(darfSpaceBearbeiten(WERKSTATT, { id: "u-lea", role: "experte" })).toBe(true);
    expect(darfSpaceBearbeiten(WERKSTATT, { id: "u-erik", role: "experte" })).toBe(false);
    expect(darfSpaceBearbeiten(WERKSTATT, { id: "u-admin", role: "admin" })).toBe(true);
    expect(darfSpaceSehen(WERKSTATT, { id: "u-fritz", role: "experte" })).toBe(false);
    expect(darfSpaceSehen(WERKSTATT, { id: "u-admin", role: "admin" })).toBe(true);
    expect(eigenesSpaceRecht(WERKSTATT, { id: "u-admin", role: "admin" })).toBe("verwalten");
    expect(eigenesSpaceRecht(WERKSTATT, { id: "u-lea", role: "experte" })).toBe("zustaendig");
  });

  it("Zuständige und Mitglieder müssen bestehende Konten sein; Doppelte werden zusammengeführt", () => {
    const konten = new Set(["u-lea", "u-erik"]);
    const gut = pruefeSpaceEingabe(
      {
        name: "  Werkstatt   Nord ",
        zweck: "Prüfmittel",
        verantwortlich: "u-lea",
        mitglieder: [
          { nutzer: "u-erik", recht: "lesen" },
          { nutzer: "u-erik", recht: "schreiben" },
        ],
        ansichten: [{ name: "Prüfmittel aktuell", tag: "pruefmittel" }],
      },
      konten,
    );
    expect(gut).toEqual({
      name: "Werkstatt Nord",
      zweck: "Prüfmittel",
      verantwortlich: "u-lea",
      zugang: "mitglieder",
      mitglieder: [{ nutzer: "u-erik", recht: "schreiben" }],
      ansichten: [{ id: "prufmittel-aktuell", name: "Prüfmittel aktuell", tag: "pruefmittel" }],
    });
    expect(() =>
      pruefeSpaceEingabe({ name: "X", zweck: "Y", verantwortlich: "u-fremd" }, konten),
    ).toThrow(SpaceFehler);
    expect(() =>
      pruefeSpaceEingabe(
        { name: "X", zweck: "Y", verantwortlich: "u-lea", mitglieder: [{ nutzer: "u-fremd" }] },
        konten,
      ),
    ).toThrow(SpaceFehler);
    expect(() => pruefeSpaceEingabe({ name: "X", verantwortlich: "u-lea" }, konten)).toThrow(
      SpaceFehler,
    );
  });
});
