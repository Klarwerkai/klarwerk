// ================================================================================================
// ADMIN-09 · DIE REINEN REGELN (produkt:20261009:admin-freigaberegeln) — `freigaberegeln.ts`.
// ================================================================================================
//
// Zuordnung zu den Originalkriterien:
//   K1 · Prüferkreis: wer nach der Regel prüfen darf und warum jemand trotz Nennung nicht kann.
//   K2 · Regelvergleich und Mindestzahl: laufende Vorgänge nur nach oben, Freigaben unverändert.
//   K3 · Selbstprüfung (Autor und Erstautor), fehlende unabhängige Prüfer.
//   K4 · Vorgangszustand aus vorhandenen fachlichen Zuständen; eine Stimme ist keine Freigabe.
//   K6 · Frist: Fälligkeit und Überfälligkeit.
// Alle Kennungen sind erfunden.
import { describe, expect, it } from "vitest";
import {
  type Konto,
  entscheidungsurteil,
  faelligAm,
  istAktiv,
  istUeberfaellig,
  pruefeFreigabeRegel,
  prueferkreis,
  regelAenderungen,
  unabhaengigePruefer,
  vorgangszustand,
  wirksameZustimmungen,
} from "../../services/app/src/freigaberegeln";
import { type FreigabeRegel, type SpaceFassung, SpaceFehler } from "../../services/app/src/spaces";

const JETZT = Date.parse("2026-10-09T08:00:00.000Z");

const konten: Konto[] = [
  { id: "carla", name: "Carla Controller", role: "controller", approved: true },
  { id: "paul", name: "Paul Prüfer", role: "controller", approved: true },
  { id: "ulli", name: "Ulli Unbefugt", role: "controller", approved: true },
  { id: "erik", name: "Erik Experte", role: "experte", approved: true },
  { id: "gast", name: "Gerd Gesperrt", role: "controller", approved: false },
  {
    id: "alt",
    name: "Alma Abgelaufen",
    role: "controller",
    approved: true,
    accessExpiresAt: "2026-01-01T00:00:00.000Z",
  },
  { id: "draussen", name: "Dora Draussen", role: "controller", approved: true },
];

const space: SpaceFassung = {
  id: "werkstatt",
  version: 1,
  name: "Werkstatt (fiktiv)",
  zweck: "Prüfmittel.",
  verantwortlich: "carla",
  zugang: "mitglieder",
  mitglieder: ["paul", "ulli", "erik", "gast", "alt"].map((nutzer) => ({
    nutzer,
    recht: "lesen" as const,
  })),
  ansichten: [],
  angelegtVon: "carla",
  angelegtAm: "2026-10-01T00:00:00.000Z",
  geaendertVon: "carla",
  geaendertAm: "2026-10-01T00:00:00.000Z",
};

const regel = (teil: Partial<FreigabeRegel> = {}): FreigabeRegel => ({
  zustimmungen: 2,
  pruefer: [],
  prueferTeams: [],
  fristTage: null,
  vertretungen: [],
  ...teil,
});

describe("ADMIN-09 · pruefeFreigabeRegel — nur zulässige Einstellungen", () => {
  const ids = new Set(konten.map((k) => k.id));
  const teams = new Set(["team-1"]);

  it("bereinigt eine gültige Regel (doppelte Nennungen einmal)", () => {
    expect(
      pruefeFreigabeRegel(
        {
          zustimmungen: 3,
          pruefer: ["carla", "paul", "carla"],
          prueferTeams: ["team-1"],
          fristTage: 5,
          vertretungen: [
            { fuer: "paul", durch: "ulli" },
            { fuer: "paul", durch: "ulli" },
          ],
        },
        ids,
        teams,
      ),
    ).toEqual({
      zustimmungen: 3,
      pruefer: ["carla", "paul"],
      prueferTeams: ["team-1"],
      fristTage: 5,
      vertretungen: [{ fuer: "paul", durch: "ulli" }],
    });
  });

  it.each([
    ["0 Zustimmungen", { zustimmungen: 0 }],
    ["6 Zustimmungen", { zustimmungen: 6 }],
    ["Bruchzahl", { zustimmungen: 1.5 }],
    ["Frist 0", { zustimmungen: 2, fristTage: 0 }],
    ["Frist 91", { zustimmungen: 2, fristTage: 91 }],
    ["unbekanntes Konto", { zustimmungen: 2, pruefer: ["niemand"] }],
    ["unbekanntes Team", { zustimmungen: 2, prueferTeams: ["team-x"] }],
    ["Selbstvertretung", { zustimmungen: 2, vertretungen: [{ fuer: "paul", durch: "paul" }] }],
  ])("weist ab: %s", (_name, roh) => {
    expect(() => pruefeFreigabeRegel(roh, ids, teams)).toThrow(SpaceFehler);
  });
});

describe("ADMIN-09 · K1 · der Prüferkreis", () => {
  it("ohne Gruppe: alle mit Prüfrecht — berechtigt nur, wer aktiv ist und den Space lesen darf", () => {
    const kreis = prueferkreis(space, regel(), konten, [], JETZT);
    const lage = Object.fromEntries(kreis.map((p) => [p.id, p.hindernis]));
    expect(lage).toEqual({
      carla: null,
      paul: null,
      ulli: null,
      gast: "inaktiv",
      alt: "inaktiv",
      draussen: "ohne_spacezugang",
    });
    expect(
      kreis.some((p) => p.id === "erik"),
      "ohne Prüfrecht kein Prüfer",
    ).toBe(false);
  });

  it("mit Gruppe: genannte Konten, aktive Teammitglieder und Vertretungen — eine Nennung verleiht nichts", () => {
    const kreis = prueferkreis(
      space,
      regel({
        pruefer: ["paul", "erik"],
        prueferTeams: ["team-1", "team-alt"],
        vertretungen: [{ fuer: "paul", durch: "ulli" }],
      }),
      konten,
      [
        { id: "team-1", name: "Messtechnik", mitglieder: ["alt"], archiviert: false },
        { id: "team-alt", name: "Archiv", mitglieder: ["carla"], archiviert: true },
      ],
      JETZT,
    );
    const nach = (id: string) => kreis.find((p) => p.id === id);
    expect(nach("paul")).toMatchObject({ wege: ["konto"], berechtigt: true });
    expect(nach("erik")).toMatchObject({ berechtigt: false, hindernis: "ohne_pruefrecht" });
    expect(nach("alt")).toMatchObject({ wege: ["team"], berechtigt: false, hindernis: "inaktiv" });
    expect(nach("ulli")).toMatchObject({
      wege: ["vertretung"],
      vertritt: ["paul"],
      berechtigt: true,
    });
    expect(nach("carla"), "ein archiviertes Team trägt niemanden bei").toBeUndefined();
  });

  it("ein unlesbares Ablaufdatum zählt nicht als aktiv", () => {
    expect(istAktiv({ approved: true, accessExpiresAt: "irgendwann" }, JETZT)).toBe(false);
    expect(istAktiv({ approved: true }, JETZT)).toBe(true);
  });
});

describe("ADMIN-09 · K3 · Mehr-Augen-Prinzip", () => {
  const kreis = prueferkreis(space, regel(), konten, [], JETZT);

  it("Autor und Erstautor prüfen nicht selbst — auch mit Prüfrecht", () => {
    expect(entscheidungsurteil({ author: "paul", originalAuthor: "erik" }, kreis, "paul")).toEqual({
      erlaubt: false,
      grund: "selbstpruefung",
    });
    expect(entscheidungsurteil({ author: "erik", originalAuthor: "ulli" }, kreis, "ulli")).toEqual({
      erlaubt: false,
      grund: "selbstpruefung",
    });
  });

  it("wer nicht berechtigt ist, entscheidet nicht; wer es ist, darf", () => {
    const ko = { author: "erik", originalAuthor: "erik" };
    expect(entscheidungsurteil(ko, kreis, "draussen")).toEqual({
      erlaubt: false,
      grund: "nicht_berechtigt",
    });
    expect(entscheidungsurteil(ko, kreis, "carla")).toEqual({ erlaubt: true });
  });

  it("unabhängige Prüfer: der Autor zählt nicht mit", () => {
    expect(unabhaengigePruefer({ author: "paul", originalAuthor: "paul" }, kreis)).toBe(2);
    expect(unabhaengigePruefer({ author: "erik", originalAuthor: "erik" }, kreis)).toBe(3);
  });
});

describe("ADMIN-09 · K2/K4 · Mindestzahl und Vorgangszustand", () => {
  it("ein laufender Vorgang braucht mindestens die Regel; eine Freigabe behält ihre Zahl", () => {
    expect(wirksameZustimmungen({ status: "offen", neededValidations: 1 }, regel())).toBe(2);
    expect(wirksameZustimmungen({ status: "offen", neededValidations: 4 }, regel())).toBe(4);
    expect(wirksameZustimmungen({ status: "validiert", neededValidations: 1 }, regel())).toBe(1);
    expect(wirksameZustimmungen({ status: "offen", neededValidations: 1 }, undefined)).toBe(1);
  });

  it("Zustände aus vorhandenen Feldern — eine Zustimmung allein ist nicht „freigegeben“", () => {
    expect(vorgangszustand({ status: "offen", version: 2 }, { warn: 0, down: 0 })).toBe(
      "eingereicht",
    );
    expect(vorgangszustand({ status: "offen", version: 2 }, { warn: 1, down: 0 })).toBe(
      "korrektur_noetig",
    );
    expect(vorgangszustand({ status: "validiert", version: 2 }, { warn: 0, down: 0 })).toBe(
      "freigegeben",
    );
    const veroeffentlicht = [
      { id: "v1", fassung: 2, art: "neu", meldung: "still", von: "carla", am: "x", empfaenger: 0 },
    ] as const;
    expect(
      vorgangszustand(
        { status: "validiert", version: 2, veroeffentlichungen: [...veroeffentlicht] },
        { warn: 0, down: 0 },
      ),
    ).toBe("veroeffentlicht");
    expect(
      vorgangszustand(
        { status: "validiert", version: 3, veroeffentlichungen: [...veroeffentlicht] },
        { warn: 0, down: 0 },
      ),
      "eine ältere veröffentlichte Fassung macht die neue nicht veröffentlicht",
    ).toBe("freigegeben");
  });

  it("Regelvergleich nennt jede Änderung", () => {
    expect(regelAenderungen(undefined, regel())).toEqual(["neu"]);
    expect(regelAenderungen(regel(), regel())).toEqual([]);
    expect(
      regelAenderungen(
        regel(),
        regel({
          zustimmungen: 3,
          pruefer: ["paul"],
          fristTage: 2,
          vertretungen: [{ fuer: "paul", durch: "ulli" }],
        }),
      ),
    ).toEqual(["zustimmungen", "pruefer", "frist", "vertretung"]);
  });
});

describe("ADMIN-09 · K6 · Frist", () => {
  it("fällig nach Ablauf der Tage ab Zuweisung; ohne Frist nie überfällig", () => {
    const seit = "2026-10-01T08:00:00.000Z";
    expect(faelligAm(seit, 3)).toBe("2026-10-04T08:00:00.000Z");
    expect(istUeberfaellig(faelligAm(seit, 3), JETZT)).toBe(true);
    expect(istUeberfaellig(faelligAm(seit, 30), JETZT)).toBe(false);
    expect(faelligAm(seit, null)).toBeNull();
    expect(istUeberfaellig(null, JETZT)).toBe(false);
  });
});
