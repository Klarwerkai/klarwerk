// ================================================================================================
// JOB 3510 · DER SPEICHER DER MARKENWAHL — und der Pin auf seine heute noch fehlende Haltbarkeit.
// ================================================================================================
//
// Die Markenwahl liegt HEUTE nur im Speicher; sie überlebt keinen Neustart. Das ist kein Versehen,
// sondern eine Auftragsgrenze — der vollständige Grund steht im Kopf von
// `services/app/src/branding-settings.ts`. Der letzte Fall dieser Datei hält den Weg dorthin offen
// und den halben Weg versperrt: Eine Postgres-Ablage braucht DREI Dinge gleichzeitig (DDL hier,
// Migration in `db.ts`, Eintrag in der Sollliste `migrationsbeleg.ts`). Wer nur zwei davon tut,
// bekommt genau die drei roten Fälle in `services/app/src/db.migrate.test.ts`, die in JOB 3510
// Runde 2 das Tor gestoppt haben — dieser Fall fängt das eine Runde früher ab.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BRANDING_PROFILE,
  BRANDING_VORGABE,
  InMemoryBrandingSettingsRepo,
  brandingAntwort,
  normalisiereBrandingWahl,
} from "../../services/app/src/branding-settings";

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

  it("die Ablage ist heute FLÜCHTIG — ein Neustart verliert die Wahl, und das steht auch so da", async () => {
    // Der Neustart, nachgestellt: derselbe Vertrag, ein neuer Prozess. Heute gibt es hinter dem
    // Feld `brandingSettings` nichts Haltbares, also ist die eingestellte Marke danach weg. Dieser
    // Fall behauptet die Einschränkung nicht — er führt sie vor.
    const vorNeustart = new InMemoryBrandingSettingsRepo();
    await vorNeustart.setze({ profil: "advisor", aktiv: true });
    expect(await vorNeustart.lies()).toEqual({ profil: "advisor", aktiv: true, version: 1 });

    const nachNeustart = new InMemoryBrandingSettingsRepo();
    expect(await nachNeustart.lies()).toEqual(BRANDING_VORGABE);

    // Und die Einschränkung steht dort, wo ein Weiterbauender sie sehen MUSS: an der
    // Einhängestelle selbst. Ohne diesen Satz wäre die fehlende Haltbarkeit eine stille Falle.
    expect(readFileSync("services/app/src/build-app.ts", "utf8")).toMatch(
      /HIER FEHLT DIE MARKENWAHL, UND ZWAR WISSENTLICH/,
    );
  });

  it("der halbe Weg zur Haltbarkeit ist versperrt: DDL, Migration und Sollliste nur gemeinsam", () => {
    const quelle = readFileSync("services/app/src/branding-settings.ts", "utf8");
    const db = readFileSync("services/app/src/db.ts", "utf8");
    const beleg = readFileSync("services/app/src/migrationsbeleg.ts", "utf8");

    const start = db.indexOf("const schemas = [");
    expect(start, "schemas-Liste in db.ts nicht gefunden").toBeGreaterThanOrEqual(0);

    // 1. Gibt es hier überhaupt eine DDL-Konstante? 2. Wird sie migriert? 3. Steht sie im
    // Migrations-Risikoinventar? Die Lehre SCRUM-496 und JOB 727 D2 verlangen: entweder alle drei
    // oder keins. Heute ist es keins (flüchtige Ablage), nach der Ablösung sind es alle drei.
    const stufen = {
      ddlVorhanden: /export const \w+_SCHEMA\s*=\s*`/.test(quelle),
      wirdMigriert: db.slice(start, db.indexOf("];", start)).includes("BRANDING"),
      imRisikoinventar: beleg.includes("BRANDING_SETTINGS_SCHEMA"),
    };

    expect(
      new Set(Object.values(stufen)).size,
      `halber Weg: ${JSON.stringify(stufen)} — DDL, migrate()-Eintrag und Sollliste in migrationsbeleg.ts gehören zusammen; fehlt einer, ist db.migrate.test.ts rot`,
    ).toBe(1);
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
