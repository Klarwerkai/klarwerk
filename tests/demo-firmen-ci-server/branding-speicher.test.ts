// ================================================================================================
// JOB 3510 · DER SPEICHER DER MARKENWAHL — und der Pin auf seine Haltbarkeit (JOB 3578).
// ================================================================================================
//
// STAND SEIT JOB 3578: Die Markenwahl ist HALTBAR. Hinter `dienste.branding` steht im
// Postgres-Betrieb `PgBrandingSettingsRepo`; die In-Memory-Ablage bleibt für Tests und den
// Dev-Betrieb ohne Datenbank und ist FÜR SICH weiterhin flüchtig — das ist dort gewollt und wird
// unten vorgeführt statt behauptet.
//
// Der letzte Fall dieser Datei hält den halben Weg versperrt: Eine Postgres-Ablage braucht DREI
// Dinge gleichzeitig (DDL in `branding-settings.ts`, Migration in `db.ts`, Eintrag in der
// Sollliste `migrationsbeleg.ts`). Wer eins davon wieder herausnimmt, bekommt genau die drei roten
// Fälle in `services/app/src/db.migrate.test.ts`, die in JOB 3510 Runde 2 das Tor gestoppt haben —
// dieser Fall fängt das eine Runde früher ab. Er misst alle drei Stufen GEMEINSAM und ist deshalb
// in beide Richtungen scharf: „keins" war bis JOB 3578 der grüne Zustand, „alle drei" ist es jetzt.
import { readFileSync } from "node:fs";
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import {
  BRANDING_PROFILE,
  BRANDING_VORGABE,
  InMemoryBrandingSettingsRepo,
  PgBrandingSettingsRepo,
  brandingAntwort,
  normalisiereBrandingWahl,
} from "../../services/app/src/branding-settings";
import { buildPgServices } from "../../services/app/src/build-app";

describe("JOB 3510 · Lieferung 1/2: der Speicher", () => {
  it("die Vorgabe eines nie gesetzten Speichers ist AUS", async () => {
    const repo = new InMemoryBrandingSettingsRepo();
    expect(await repo.lies()).toEqual({ profil: null, aktiv: false, version: 0 });
    expect(BRANDING_VORGABE).toEqual({ profil: null, aktiv: false, version: 0 });
  });

  it("`setze` gibt den ALTEN und den NEUEN Stand zurück — das Audit braucht beide", async () => {
    const repo = new InMemoryBrandingSettingsRepo();
    const erste = await repo.setze({ profil: "advisor", aktiv: true });
    expect(erste.vorher).toEqual({ profil: null, aktiv: false, version: 0 });
    expect(erste.nachher).toEqual({ profil: "advisor", aktiv: true, version: 1 });

    const zweite = await repo.setze({ profil: "advisor", aktiv: false });
    expect(zweite.vorher).toEqual(erste.nachher);
    expect(zweite.nachher).toEqual({ profil: "advisor", aktiv: false, version: 2 });
  });

  it("die Vorgabe-Konstante wird nicht mitverändert (kein geteiltes Objekt)", async () => {
    const repo = new InMemoryBrandingSettingsRepo();
    await repo.setze({ profil: "advisor", aktiv: true });
    expect(BRANDING_VORGABE).toEqual({ profil: null, aktiv: false, version: 0 });
    expect(await new InMemoryBrandingSettingsRepo().lies()).toEqual(BRANDING_VORGABE);
  });

  it("die In-Memory-Ablage ist FÜR SICH flüchtig — und der Postgres-Betrieb benutzt sie nicht", async () => {
    // Der Neustart, nachgestellt: derselbe Vertrag, ein neuer Prozess. Die In-Memory-Ablage
    // verliert die Wahl dabei, und das ist für Tests und den Dev-Betrieb ohne Datenbank gewollt.
    // Dieser Fall behauptet es nicht — er führt es vor.
    const vorNeustart = new InMemoryBrandingSettingsRepo();
    await vorNeustart.setze({ profil: "advisor", aktiv: true });
    expect(await vorNeustart.lies()).toEqual({ profil: "advisor", aktiv: true, version: 1 });

    const nachNeustart = new InMemoryBrandingSettingsRepo();
    expect(await nachNeustart.lies()).toEqual(BRANDING_VORGABE);

    // JOB 3578: UND GENAU DESHALB steht sie im Postgres-Betrieb nicht mehr da. Gemessen an der
    // GEBAUTEN Komposition und nicht an einem Textmuster in `build-app.ts`: ein Kommentar über die
    // Einhängestelle wäre wieder nur eine Behauptung, ein `instanceof` ist die Verdrahtung selbst.
    const dienste = buildPgServices({} as unknown as Pool);
    expect(dienste.brandingSettings).toBeInstanceOf(PgBrandingSettingsRepo);
    expect(dienste.brandingSettings).not.toBeInstanceOf(InMemoryBrandingSettingsRepo);
  });

  it("der halbe Weg zur Haltbarkeit ist versperrt: DDL, Migration und Sollliste nur gemeinsam", () => {
    const quelle = readFileSync("services/app/src/branding-settings.ts", "utf8");
    const db = readFileSync("services/app/src/db.ts", "utf8");
    const beleg = readFileSync("services/app/src/migrationsbeleg.ts", "utf8");

    const start = db.indexOf("const schemas = [");
    expect(start, "schemas-Liste in db.ts nicht gefunden").toBeGreaterThanOrEqual(0);

    // 1. Gibt es hier überhaupt eine DDL-Konstante? 2. Wird sie migriert? 3. Steht sie im
    // Migrations-Risikoinventar? Die Lehre SCRUM-496 und JOB 727 D2 verlangen: entweder alle drei
    // oder keins. Bis JOB 3510 war es keins (flüchtige Ablage), seit JOB 3578 sind es alle drei.
    const stufen = {
      ddlVorhanden: /export const \w+_SCHEMA\s*=\s*`/.test(quelle),
      wirdMigriert: db.slice(start, db.indexOf("];", start)).includes("BRANDING"),
      imRisikoinventar: beleg.includes("BRANDING_SETTINGS_SCHEMA"),
    };

    expect(
      new Set(Object.values(stufen)).size,
      `halber Weg: ${JSON.stringify(stufen)} — DDL, migrate()-Eintrag und Sollliste in migrationsbeleg.ts gehören zusammen; fehlt einer, ist db.migrate.test.ts rot`,
    ).toBe(1);

    // JOB 3578 — DIE RICHTUNG, festgehalten: Es sind ALLE DREI, nicht „keins". Ohne diese Zeile
    // bliebe der Fall oben auch dann grün, wenn jemand die Haltbarkeit vollständig zurückbaute:
    // „keins" erfüllt die Gemeinsamkeitsprüfung genauso gut wie „alle drei".
    expect(stufen, "die Haltbarkeit ist zurückgebaut worden").toEqual({
      ddlVorhanden: true,
      wirdMigriert: true,
      imRisikoinventar: true,
    });
  });
});

describe("JOB 3510 · Lieferung 7: genau ein Profil, genau die belegten Werte", () => {
  it("es gibt GENAU das Advisor-Profil — keine erfundene Hausfarbenpalette", () => {
    expect(Object.keys(BRANDING_PROFILE)).toEqual(["advisor"]);
    expect(BRANDING_PROFILE.advisor).toEqual({
      name: "Advisor",
      // Die beiden im Original-SVG hinterlegten Farben (gespraech/ci-advisor/AUFTRAGSGRUNDLAGE.md).
      farben: { primaer: "#0578b7", schrift: "#161417" },
      logo: "/marke/advisor/adv-logo.svg",
    });
    expect(Object.keys(BRANDING_PROFILE.advisor.farben)).toEqual(["primaer", "schrift"]);
  });

  it("`normalisiereBrandingWahl` nimmt genau zwei Profilwerte an und weist alles andere ab", () => {
    expect(normalisiereBrandingWahl({ profil: "advisor", aktiv: true })).toEqual({
      profil: "advisor",
      aktiv: true,
    });
    expect(normalisiereBrandingWahl({ profil: null, aktiv: false })).toEqual({
      profil: null,
      aktiv: false,
    });
    for (const schlecht of [
      { profil: "acme", aktiv: true },
      { profil: " advisor", aktiv: true },
      { profil: "ADVISOR", aktiv: true },
      { profil: undefined, aktiv: true },
      { profil: "advisor", aktiv: 1 },
      { profil: "advisor" },
      { aktiv: true },
      null,
      undefined,
      "advisor",
    ]) {
      expect(
        normalisiereBrandingWahl(schlecht),
        `angenommen wurde: ${JSON.stringify(schlecht)}`,
      ).toBeUndefined();
    }
  });

  it("die Marke hängt an BEIDEN Voraussetzungen — Profil UND Schalter", () => {
    expect(brandingAntwort({ profil: "advisor", aktiv: true, version: 1 }).marke).toEqual(
      BRANDING_PROFILE.advisor,
    );
    expect(brandingAntwort({ profil: "advisor", aktiv: false, version: 2 }).marke).toBeNull();
    expect(brandingAntwort({ profil: null, aktiv: true, version: 3 }).marke).toBeNull();
    expect(brandingAntwort({ profil: null, aktiv: false, version: 0 })).toEqual({
      profil: null,
      aktiv: false,
      version: 0,
      marke: null,
    });
  });
});
