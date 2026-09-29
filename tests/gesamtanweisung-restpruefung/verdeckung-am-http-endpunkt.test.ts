// ================================================================================================
// RESTPRÜFUNG GESAMTANWEISUNG · VOLLSTÄNDIGE VERDECKUNG AM ECHTEN HTTP-ENDPUNKT, MIT DEM ECHTEN
// ROLLENPRÄDIKAT.
// ================================================================================================
//
// DIE LÜCKE, GEGEN DIE DIESE DATEI STEHT. `a11-liste-rollenmatrix.test.ts` misst die Verdeckung an
// `app.inject` auf der Bühne der Rollenabnahme — ohne Socket, ohne Keks, mit Bearer-Kopf. Dieser
// Fall misst dieselbe Frage an einem ECHTEN Port (`starteStrecke`, `listen` auf 127.0.0.1), mit den
// Sitzungskeksen, die auch die Fläche benutzt, und über ALLE Lese- und Schreibtüren einer
// Anweisung, deren einziger Baustein dem Betrachter verborgen ist:
//
//     Liste · Einzelabruf · Stände · Vergleich · Kopf ändern · Reihenfolge · Vorlegen
//
// DAS ROLLENPRÄDIKAT WIRD NICHT ABGESCHRIEBEN, SONDERN BEFRAGT: für jede Rolle wird die Erwartung
// aus `darfSehen` (`services/app/src/sichtbarkeit.ts`) gebildet — derselben Funktion, die die Routen
// benutzen (`gesamtanweisung-routes.ts`, `sichtbarFuer`). Eine abgeschriebene Rollenliste wäre am
// Tag ihrer Entstehung richtig und danach still falsch. Und damit die Befragung nicht leer läuft,
// wird zugesichert, dass das Prädikat hier WIRKLICH trennt (zwei Rollen dürfen, zwei nicht).
//
// GEMESSEN WIRD AM ROHEN KÖRPER: Titel, Kennung und Rumpfmerkmal des geschützten Eintrags dürfen in
// keiner Antwort an einen Nicht-Berechtigten stehen — auch nicht in einer Absage. Die GEGENPROBE
// steht daneben: die Berechtigten bekommen genau diese Angaben im Einzelabruf, sonst wäre „kommt
// nicht vor" auch dann wahr, wenn es nichts zu verbergen gäbe.
//
// NICHT GEMESSEN: Haltbarkeit über einen Neustart (die Instanz läuft mit den Speicherfassungen;
// den Prozesswechsel gegen PostgreSQL misst `tests/gesamtanweisung-nutzerweg/**`).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SessionUser } from "../../services/app/src/http";
import { darfSehen } from "../../services/app/src/sichtbarkeit";
import {
  type Sitzung,
  type Strecke,
  ersteinrichtung,
  starteStrecke,
} from "../gast-nutzerweg/strecke";
import {
  type Bestand,
  GEHEIMMARKE,
  KO_GESCHUETZT,
  TITEL_VERBORGEN,
  kontoMitRolle,
  legeBestandAn,
} from "./bestand";

const MARKE = "RESTPRUEFUNG VERDECKUNG";
const ROLLEN = ["viewer", "experte", "controller", "admin"] as const;
type Rolle = (typeof ROLLEN)[number];

let strecke: Strecke;
let bestand: Bestand;
let adminId = "";
const sitzung = {} as Record<Rolle, Sitzung>;
const nutzer = {} as Record<Rolle, SessionUser>;

beforeAll(async () => {
  strecke = await starteStrecke();
  const ersteinrichtet = await ersteinrichtung(strecke, "admin@restpruefung-verdeckung.test");
  sitzung.admin = ersteinrichtet.sitzung;
  adminId = ersteinrichtet.admin.id;
  nutzer.admin = { id: adminId, role: "admin" };
  for (const rolle of ["viewer", "experte", "controller"] as const) {
    sitzung[rolle] = strecke.profil(rolle);
    nutzer[rolle] = await kontoMitRolle(
      sitzung.admin,
      sitzung[rolle],
      rolle,
      `${rolle}@restpruefung-verdeckung.test`,
    );
  }
  bestand = await legeBestandAn(sitzung.admin);
}, 120_000);

afterAll(async () => {
  await strecke?.schliessen();
});

/** Die Erwartung für diese Rolle — aus dem echten Prädikat, mit den Fakten des Eintrags. */
function darf(rolle: Rolle): boolean {
  return darfSehen(nutzer[rolle], { confidentiality: "vertraulich", author: adminId });
}

/** Keine Spur des geschützten Eintrags im rohen Körper. */
function ohneSpur(rumpf: string, wer: string, tuer: string): void {
  for (const [was, zeichen] of [
    ["Titel", KO_GESCHUETZT],
    ["Kennung", bestand.geschuetzt.koId],
    ["Rumpfmerkmal", GEHEIMMARKE],
  ] as const) {
    expect(
      rumpf,
      `${MARKE}: ${wer} bekommt an ${tuer} den ${was} des geschützten Eintrags`,
    ).not.toContain(zeichen);
  }
}

describe("Restprüfung · vollständige Verdeckung am echten Socket, entschieden von darfSehen", () => {
  it("das echte Prädikat trennt hier wirklich — sonst misst die Befragung unten nichts", () => {
    expect(ROLLEN.filter((r) => darf(r))).toEqual(["controller", "admin"]);
    expect(ROLLEN.filter((r) => !darf(r))).toEqual(["viewer", "experte"]);
    expect(bestand.verborgen.length).toBeGreaterThan(0);
  });

  it("Liste: jede Rolle sieht den Kopf; die Zahlen folgen dem Prädikat; kein Bausteininhalt im Körper", async () => {
    for (const rolle of ROLLEN) {
      const antwort = await sitzung[rolle].sende("GET", "/api/gesamtanweisungen");
      expect(antwort.status, `${rolle}: ${antwort.text.slice(0, 200)}`).toBe(200);
      const eintrag = (
        antwort.json as {
          eintraege: {
            id: string;
            titel: string;
            sichtbareBausteine: number;
            verborgeneBausteine: number;
            unvollstaendig: boolean;
          }[];
        }
      ).eintraege.find((e) => e.id === bestand.verborgen);
      expect(eintrag?.titel, `${rolle}: die ganz verborgene Anweisung fehlt in der Liste`).toBe(
        TITEL_VERBORGEN,
      );
      const soll = darf(rolle) ? { s: 1, v: 0, u: false } : { s: 0, v: 1, u: true };
      expect(
        {
          s: eintrag?.sichtbareBausteine,
          v: eintrag?.verborgeneBausteine,
          u: eintrag?.unvollstaendig,
        },
        `${rolle}: Zählung weicht vom Prädikat ab`,
      ).toEqual(soll);
      // Die Liste trägt grundsätzlich keine Bausteinangaben — für NIEMANDEN.
      ohneSpur(antwort.text, rolle, "GET /api/gesamtanweisungen");
    }
  });

  it("Einzelabruf: Nicht-Berechtigte bekommen 0 sichtbar / 1 verborgen und keine Spur; Berechtigte den Eintrag (Gegenprobe)", async () => {
    for (const rolle of ROLLEN) {
      const antwort = await sitzung[rolle].sende(
        "GET",
        `/api/gesamtanweisungen/${bestand.verborgen}`,
      );
      expect(antwort.status, `${rolle}: ${antwort.text.slice(0, 200)}`).toBe(200);
      const stand = antwort.json as { bausteine: unknown[]; verborgeneBausteine: number };
      if (darf(rolle)) {
        expect(stand.bausteine.length, `${rolle}: Baustein fehlt`).toBe(1);
        expect(stand.verborgeneBausteine).toBe(0);
        // GEGENPROBE: die Angabe existiert im Bestand, und der Berechtigte bekommt sie.
        expect(antwort.text, `${rolle}: Kennung fehlt im Einzelabruf`).toContain(
          bestand.geschuetzt.koId,
        );
        expect(antwort.text, `${rolle}: Titel fehlt im Einzelabruf`).toContain(KO_GESCHUETZT);
      } else {
        expect(stand.bausteine, `${rolle}: ein verborgener Baustein wird ausgeliefert`).toEqual([]);
        expect(stand.verborgeneBausteine).toBe(1);
        ohneSpur(antwort.text, rolle, "GET /api/gesamtanweisungen/:id");
      }
    }
  });

  it("Stände und Vergleich: Nicht-Berechtigte bekommen 403 FORBIDDEN ohne Spur; Berechtigte 200", async () => {
    for (const rolle of ROLLEN) {
      for (const pfad of [
        `/api/gesamtanweisungen/${bestand.verborgen}/staende`,
        `/api/gesamtanweisungen/${bestand.verborgen}/vergleich?von=1&bis=2`,
      ]) {
        const antwort = await sitzung[rolle].sende("GET", pfad);
        if (darf(rolle)) {
          expect(antwort.status, `${rolle} ${pfad}: ${antwort.text.slice(0, 200)}`).toBe(200);
        } else {
          expect(antwort.status, `${rolle} ${pfad}: ${antwort.text.slice(0, 200)}`).toBe(403);
          expect((antwort.json as { error: string }).error).toBe("FORBIDDEN");
          ohneSpur(antwort.text, rolle, pfad);
        }
      }
    }
  });

  it("Schreibtüren: der Experte (ko.create, aber kein Sehrecht) wird abgewiesen, ohne Spur und ohne Änderung", async () => {
    const vorher = await sitzung.admin.sende("GET", `/api/gesamtanweisungen/${bestand.verborgen}`);
    const { version, titel } = vorher.json as { version: number; titel: string };
    const tueren: [string, string, Record<string, unknown>][] = [
      ["PUT", `/api/gesamtanweisungen/${bestand.verborgen}`, { version, titel: "uebernommen" }],
      [
        "PUT",
        `/api/gesamtanweisungen/${bestand.verborgen}/reihenfolge`,
        { version, reihenfolge: [] },
      ],
      ["POST", `/api/gesamtanweisungen/${bestand.verborgen}/vorlegen`, { version }],
    ];
    for (const [verfahren, pfad, rumpf] of tueren) {
      const antwort = await sitzung.experte.sende(verfahren, pfad, rumpf);
      expect(antwort.status, `experte ${verfahren} ${pfad}: ${antwort.text.slice(0, 200)}`).toBe(
        403,
      );
      expect((antwort.json as { error: string }).error).toBe("FORBIDDEN");
      ohneSpur(antwort.text, "experte", `${verfahren} ${pfad}`);
    }
    // Der Viewer hat nicht einmal das Schreibrecht — das Rechtetor sagt nein, bevor gelesen wird.
    const viewer = await sitzung.viewer.sende(
      "POST",
      `/api/gesamtanweisungen/${bestand.verborgen}/vorlegen`,
      { version },
    );
    expect(viewer.status).toBe(403);
    ohneSpur(viewer.text, "viewer", "POST …/vorlegen");

    const nachher = await sitzung.admin.sende("GET", `/api/gesamtanweisungen/${bestand.verborgen}`);
    expect(
      nachher.json as { version: number; titel: string; stand: string },
      `${MARKE}: eine abgewiesene Schreibtür hat die Anweisung trotzdem verändert`,
    ).toMatchObject({ version, titel, stand: "entwurf" });
  });
});
