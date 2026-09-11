import type { Pool } from "pg";

// ================================================================================================
// JOB 3510 · DEMO-FIRMEN-CI — DIE EINE ZENTRALE MARKENWAHL EINER INSTANZ.
// ================================================================================================
//
// WOZU DAS DA IST: Für die Vorführung soll die Demo im Erscheinungsbild des Kunden laufen (Pedi am
// 10.09. mit „Setz es um" freigegeben, Wortlaut in `gespraech/ci-advisor/AUFTRAGSGRUNDLAGE.md`).
// KLARWERK, Klara/Word und die Chrome-Erweiterung müssen dabei DASSELBE zeigen — also gibt es
// GENAU EINE gespeicherte Wahl, hier, und drei Verbraucher, die sie lesen. Keine drei getrennten
// Benutzerschalter, keine drei unabhängig gepflegten Farbsätze.
//
// WARUM EIN GESPEICHERTER SATZ UND KEIN UMGEBUNGSSCHALTER: Die Schalter dieses Hauses stehen im
// Registry (`feature-flags.ts`) und kommen aus der Umgebung — sie sind BEWUSST nicht zur Laufzeit
// umschaltbar (Begründung im Kopf von `routes/features-routes.ts`). Die Markenwahl muss aber genau
// das sein: ein Administrator kippt sie vor der Vorführung, ohne Deploy. Deshalb folgt sie dem
// zweimal belegten Muster fachbezogener Einstellungen — Schnittstelle + Ablage dahinter
// (`services/validation/src/settings.ts:43`, `services/conflicts/src/overlap-settings.ts:54`).
// Kein zweiter Speichermechanismus, keine Datei auf der Platte.
//
// ================================================================================================
// WIE DIE WAHL NEUSTART UND DEPLOY ÜBERLEBT (JOB 3578) — BITTE VOR DEM WEITERBAUEN LESEN.
// ================================================================================================
//
// Es gibt hier ZWEI Ablagen, und sie sind kein zweiter Weg, sondern eine Ablösung mit benanntem
// Rest: `PgBrandingSettingsRepo` ist die haltbare Ablage des Postgres-Betriebs
// (`build-app.ts`, `buildPgServices` hängt sie ein); `InMemoryBrandingSettingsRepo` bleibt für
// Tests und den Dev-Betrieb ohne Datenbank der Rückfall von `assembleServices` — dieselbe Bauform
// wie bei `lesevarianten` und `klaraSessions`.
//
// DREI DINGE GEHÖREN ZUSAMMEN, und keins davon geht allein: die DDL `BRANDING_SETTINGS_SCHEMA`
// unten, ihr Eintrag in der ausgeführten `schemas`-Liste (`db.ts`) und ihr Eintrag in der
// Migrations-Sollliste (`migrationsbeleg.ts`). Zwei Wächter erzwingen das beidseitig
// (`db.migrate.test.ts:93` für die Migration, `:248-263` und `:306` für die Sollliste), ein dritter
// fängt den halben Weg eine Runde früher ab (`tests/demo-firmen-ci-server/branding-speicher.test.ts`).
// In JOB 3510 Runde 2 wurde der Versuch, die Tabelle ohne den Sollliste-Eintrag zu migrieren, im
// Tor mit genau drei roten Fällen quittiert — wer die Tabelle anfasst, fasst alle drei an.
//
// WARUM `version` KEIN SCHMUCK IST: Eine bereits geöffnete Oberfläche (ein Word-Taskpane, ein
// Chrome-Panel) merkt AUSSCHLIESSLICH an dieser Zahl, dass sich etwas geändert hat. Sie steigt
// deshalb bei JEDER Änderung um 1 — auch wenn nur `aktiv` kippt und auch, wenn dieselbe Wahl
// erneut gesetzt wird. Eine Version, die bei „gleicher Wert" stehen bliebe, ließe eine offene
// Fläche gefärbt zurück, obwohl der Betrieb ausgeschaltet hat.
//
// WAS HIER AUSDRÜCKLICH NICHT PASSIERT: Diese Datei kennt keine Demodaten, keinen Seed und kein
// Modell. Das Markenprofil ist vom Demo-Datenpaket völlig unabhängig; Umschalten lädt nichts,
// löscht nichts und überträgt nichts.

// ================================================================================================
// DAS EINE PROFIL — genau die belegten Werte, nichts daneben.
// ================================================================================================
//
// Die beiden Farben sind die IM ORIGINAL-SVG hinterlegten (`gespraech/ci-advisor/adv-logo.svg`,
// 5567 Bytes, viewBox `0 0 173.1 39.19`): Blau `#0578b7`, dunkler Schriftzug `#161417`. Sie sind
// belegte Logofarben und kein geprüfter CI-Leitfaden — deshalb stehen hier genau zwei Werte und
// keine erfundene „Hausfarbenpalette". Das generische WordPress-Farbinventar der Advisor-Webseite
// ist ausdrücklich NICHT übernommen.
//
// Der Logopfad ist der Ort, an dem JOB 3511 das feste, mitgelieferte Original ablegt. Er ist eine
// LOKALE Auslieferung: keine Laufzeitabhängigkeit von advisor.nl, kein externes Stylesheet, kein
// Webfont.
export interface BrandingMarke {
  name: string;
  farben: { primaer: string; schrift: string };
  logo: string;
}

export const BRANDING_PROFILE = {
  advisor: {
    name: "Advisor",
    farben: { primaer: "#0578b7", schrift: "#161417" },
    logo: "/marke/advisor/adv-logo.svg",
  },
} as const satisfies Record<string, BrandingMarke>;

export type BrandingProfil = keyof typeof BRANDING_PROFILE;

/** Ist das ein Profilname, den diese Instanz wirklich kennt? Nur dann darf er gespeichert werden. */
export function istBekanntesProfil(wert: unknown): wert is BrandingProfil {
  return typeof wert === "string" && Object.hasOwn(BRANDING_PROFILE, wert);
}

// ================================================================================================
// DIE WAHL UND IHR STAND
// ================================================================================================

/** Was ein Administrator setzt: welches Profil, und ob es verwendet wird. */
export interface BrandingWahl {
  profil: BrandingProfil | null;
  aktiv: boolean;
}

/** Die Wahl mit ihrer Änderungszahl — das, was Verbraucher lesen. */
export interface BrandingStand extends BrandingWahl {
  version: number;
}

/**
 * Eine frisch aufgesetzte Instanz sieht normal aus.
 *
 * Kein Vorbelegen der Advisor-Wahl: Ein vorgefärbtes KLARWERK wäre der Fehler, den niemand meldet,
 * weil er wie eine Funktion aussieht. `version: 0` heißt „noch nie gesetzt" und ist damit von der
 * ersten echten Änderung (`1`) unterscheidbar.
 */
export const BRANDING_VORGABE: BrandingStand = Object.freeze({
  profil: null,
  aktiv: false,
  version: 0,
});

/** Die Antwort des Lesewegs: der Stand plus die AUFGELÖSTE Marke (oder ehrlich `null`). */
export interface BrandingAntwort extends BrandingStand {
  marke: BrandingMarke | null;
}

/**
 * Die Marke hängt an BEIDEN Voraussetzungen — einem gewählten Profil UND dem gesetzten Schalter.
 * Fehlt eine davon, steht `null` da und nicht die stärkere Aussage: Die Oberfläche soll „keine
 * Firmen-CI" nicht von „Firmen-CI, aber ohne Werte" unterscheiden müssen.
 */
export function brandingAntwort(stand: BrandingStand): BrandingAntwort {
  return {
    profil: stand.profil,
    aktiv: stand.aktiv,
    version: stand.version,
    marke: stand.aktiv && stand.profil ? BRANDING_PROFILE[stand.profil] : null,
  };
}

/**
 * Ehrliche Normalisierung einer eingehenden Wahl: `undefined` = Bedienfehler (HTTP 400).
 *
 * Beide Felder sind PFLICHT und werden nicht ergänzt. Ein fehlendes `aktiv` still auf `false` zu
 * drehen hieße, aus einer halben Angabe eine ganze Entscheidung zu machen — und ein unbekannter
 * Profilname wird abgewiesen und nicht gespeichert: Ein Profil, das die Instanz nicht kennt,
 * ergäbe später eine Wahl ohne Marke, die von „aus" ununterscheidbar wäre.
 */
export function normalisiereBrandingWahl(eingabe: unknown): BrandingWahl | undefined {
  if (typeof eingabe !== "object" || eingabe === null) {
    return undefined;
  }
  const roh = eingabe as Record<string, unknown>;
  if (typeof roh.aktiv !== "boolean" || !("profil" in roh)) {
    return undefined;
  }
  if (roh.profil === null) {
    return { profil: null, aktiv: roh.aktiv };
  }
  return istBekanntesProfil(roh.profil) ? { profil: roh.profil, aktiv: roh.aktiv } : undefined;
}

// ================================================================================================
// DIE ABLAGE
// ================================================================================================

export interface BrandingSettingsRepo {
  /** Der aktuelle Stand — nie gesetzt heißt `BRANDING_VORGABE`, nicht `null`. */
  lies(): Promise<BrandingStand>;
  /**
   * Setzt die Wahl und erhöht die Version um 1. Gibt ALTEN und NEUEN Stand zurück, weil der
   * Audit-Eintrag beide braucht („alt → neu") und ein getrenntes Vorher-Lesen in der Route ein
   * zweites Zeitfenster wäre, in dem sich der Stand ändern kann.
   */
  setze(wahl: BrandingWahl): Promise<{ vorher: BrandingStand; nachher: BrandingStand }>;
}

export class InMemoryBrandingSettingsRepo implements BrandingSettingsRepo {
  private stand: BrandingStand = { ...BRANDING_VORGABE };

  lies(): Promise<BrandingStand> {
    return Promise.resolve({ ...this.stand });
  }

  setze(wahl: BrandingWahl): Promise<{ vorher: BrandingStand; nachher: BrandingStand }> {
    const vorher = this.stand;
    const nachher: BrandingStand = {
      profil: wahl.profil,
      aktiv: wahl.aktiv,
      version: vorher.version + 1,
    };
    this.stand = nachher;
    return Promise.resolve({ vorher: { ...vorher }, nachher: { ...nachher } });
  }
}

// ================================================================================================
// DIE HALTBARE ABLAGE (JOB 3578)
// ================================================================================================

/**
 * Die Tabelle der einen Markenwahl — dieselbe Bauform wie `OVERLAP_SETTINGS_SCHEMA`
 * (`services/conflicts/src/overlap-settings.ts:54`): ein fester Schlüssel, eine Zeile.
 *
 * REIN ADDITIV UND WIEDERHOLBAR: `CREATE TABLE IF NOT EXISTS`, kein `DROP`, kein `DELETE FROM`,
 * kein `TRUNCATE`, kein `UPDATE … SET`, kein Fremdschlüssel, keine Extension. Damit trifft KEIN
 * einziger Marker aus `RISIKOMARKER` (`migrationsbeleg.ts:60-71`), und die Stufe ist `ADDITIV` —
 * nicht behauptet, sondern von `klassifiziereStufe` gemessen.
 *
 * UND AUSDRÜCKLICH KEIN SEED. Eine vorbelegte Zeile hätte eine Versionszahl, und damit wäre
 * `version: 0` verbraucht: Genau diese Null heisst „noch nie gesetzt" und muss von der ersten
 * echten Änderung (`1`) unterscheidbar bleiben (s. `BRANDING_VORGABE`). Eine frisch aufgesetzte
 * Instanz hat hier deshalb KEINE Zeile, und `lies()` antwortet aus der Vorgabe.
 *
 * `profil` ist nullbar („aus, ohne Profil"), `aktiv` und `version` sind es nicht: Ein Stand ohne
 * Schalter oder ohne Änderungszahl wäre keine Wahl, sondern eine halbe Angabe.
 */
export const BRANDING_SETTINGS_SCHEMA = `
CREATE TABLE IF NOT EXISTS branding_settings (
  key text PRIMARY KEY,
  profil text,
  aktiv boolean NOT NULL,
  version integer NOT NULL
);
`;

/** Die eine Zeile. Wie bei den Überschneidungs-Einstellungen ein fester Schlüssel, kein Zähler. */
const BRANDING_SCHLUESSEL = "branding_settings";

interface BrandingZeile {
  vorher_profil: string | null;
  vorher_aktiv: boolean | null;
  vorher_version: number | null;
  nachher_profil: string | null;
  nachher_aktiv: boolean;
  nachher_version: number;
}

/**
 * Ein Profilname AUS DER ABLAGE ist eine Zeichenkette und noch keine Wahl. Kennt diese Instanz ihn
 * nicht, steht hier `null` — die schwächere und belegte Aussage. Sonst entstünde eine Wahl, deren
 * Marke sich nicht auflösen lässt, und die Fläche könnte „an" nicht von „aus" unterscheiden
 * (s. `brandingAntwort`). Die Änderungszahl bleibt davon unberührt: sie ist eine Tatsache der
 * Ablage und keine Folgerung aus dem Profil.
 */
function profilAusAblage(wert: string | null): BrandingProfil | null {
  return istBekanntesProfil(wert) ? wert : null;
}

/**
 * ================================================================================================
 * DIE HALTBARE MARKENWAHL — EINE ZEILE, EINE ANWEISUNG JE VORGANG.
 * ================================================================================================
 *
 * WAS DIESE KLASSE ZUSAGT:
 *
 *   · `lies()` auf leerer Tabelle gibt `BRANDING_VORGABE` zurück — nicht `null`, nicht einen
 *     Fehler. Das ist der Vertrag von `BrandingSettingsRepo.lies` und zugleich die ehrliche
 *     Auskunft „noch nie gesetzt".
 *   · `setze()` braucht GENAU EINE Datenbankanweisung und liefert `vorher` und `nachher` aus
 *     ebendieser. Ein getrenntes Vorher-Lesen wäre das zweite Zeitfenster, das
 *     `routes/branding-routes.ts:69-70` ausdrücklich ausschliesst.
 *   · Die Version steigt bei JEDER Änderung um 1, und sie steigt AUS DEM GESPEICHERTEN WERT
 *     (`version = branding_settings.version + 1`), nie aus einem in JavaScript gemerkten. Sonst
 *     zählte ein zweiter Prozess über derselben Datenbank an der Wahrheit vorbei.
 *   · Ein Datenbankfehler wird DURCHGEREICHT. Eine stillschweigend gelieferte Vorgabe wäre die
 *     Tatsachenaussage „keine Firmen-CI" ohne frische Datengrundlage — die Fläche soll nicht
 *     behaupten, was sie gerade nicht weiss.
 *
 * WAS SIE ZUR NEBENLÄUFIGKEIT ZUSAGT — UND WAS NICHT:
 *
 *   ZUSAGE: Zwei gleichzeitige `setze`-Aufrufe ergeben ZWEI VERSCHIEDENE Versionen. Das trägt
 *   `ON CONFLICT … DO UPDATE`: Der zweite Schreiber wartet auf die Zeilensperre des ersten und
 *   rechnet danach aus dem dann gespeicherten Wert weiter. Die Zahl, an der jede offene Fläche
 *   eine Änderung erkennt, ist damit lückenlos.
 *
 *   KEINE ZUSAGE: `vorher` kann unter echter Gleichzeitigkeit der Stand VOR dem konkurrierenden
 *   Schreiben sein — die drei `vorher_*`-Spalten kommen aus dem Schnappschuss, den die Anweisung
 *   zu ihrem Beginn sieht, die Versionsrechnung dagegen aus der gesperrten Zeile. DAS IST
 *   ABSICHTLICH SO GEWÄHLT: Der Preis trifft ausschliesslich den Audit-Eintrag „alt → neu", der
 *   dann einen Zwischenstand überspringt; die Alternative (`SELECT … FOR UPDATE`, dann `UPDATE`)
 *   wären ZWEI Anweisungen und damit genau das Zeitfenster, das der Vertrag oben ausschliesst.
 *   `nachher`, und mit ihm alles, was die Verbraucher lesen, ist in beiden Fällen exakt.
 *
 *   WAS DAVON GEMESSEN IST: die Form (eine Anweisung), die Herkunft der Versionszahl (aus dem
 *   Speicher, nicht aus dem Prozess), die Herkunft des Vorher-Standes und dass JEDE Spalte der
 *   Wahl wirklich zugewiesen wird — gegen einen Stellvertreter-Pool in
 *   `tests/demo-firmen-ci-haltbarkeit/`, dessen eigene Treue `stellvertreter-treue.test.ts` misst
 *   (ein Stellvertreter, der ergänzt, was im SQL fehlt, macht jeden Test darüber wertlos).
 *   NICHT gemessen ist das Verhalten echter Zeilensperren unter echter Gleichzeitigkeit: dafür
 *   bräuchte es ein echtes Postgres, und das Tor hat keins.
 */
export class PgBrandingSettingsRepo implements BrandingSettingsRepo {
  constructor(private readonly pool: Pool) {}

  async lies(): Promise<BrandingStand> {
    const res = await this.pool.query<{ profil: string | null; aktiv: boolean; version: number }>(
      "SELECT profil, aktiv, version FROM branding_settings WHERE key=$1",
      [BRANDING_SCHLUESSEL],
    );
    const zeile = res.rows[0];
    if (!zeile) {
      return { ...BRANDING_VORGABE };
    }
    return {
      profil: profilAusAblage(zeile.profil),
      aktiv: zeile.aktiv,
      version: zeile.version,
    };
  }

  async setze(wahl: BrandingWahl): Promise<{ vorher: BrandingStand; nachher: BrandingStand }> {
    // EINE Anweisung, zwei Stände: Der benannte Ausdruck `vorher` liest die Zeile im Schnappschuss
    // dieser Anweisung, also VOR dem Schreiben darunter; `nachher` ist die geschriebene Zeile
    // selbst. Ein zweites `SELECT` davor gäbe es nicht umsonst — es wäre ein zweites Zeitfenster.
    const res = await this.pool.query<BrandingZeile>(
      `WITH vorher AS (
         SELECT profil, aktiv, version FROM branding_settings WHERE key=$1
       ), nachher AS (
         INSERT INTO branding_settings(key, profil, aktiv, version)
         VALUES($1,$2,$3,1)
         ON CONFLICT (key) DO UPDATE SET
           profil = EXCLUDED.profil,
           aktiv = EXCLUDED.aktiv,
           version = branding_settings.version + 1
         RETURNING profil, aktiv, version
       )
       SELECT
         (SELECT profil FROM vorher) AS vorher_profil,
         (SELECT aktiv FROM vorher) AS vorher_aktiv,
         (SELECT version FROM vorher) AS vorher_version,
         nachher.profil AS nachher_profil,
         nachher.aktiv AS nachher_aktiv,
         nachher.version AS nachher_version
       FROM nachher`,
      [BRANDING_SCHLUESSEL, wahl.profil, wahl.aktiv],
    );
    const zeile = res.rows[0];
    if (!zeile) {
      // Die Anweisung schreibt immer genau eine Zeile und gibt sie zurück. Bleibt sie trotzdem
      // leer, ist das ein unbekannter Zustand — dann wird geworfen und nicht geraten.
      throw new Error("branding_settings: die Schreibanweisung lieferte keine Zeile zurück");
    }
    // `vorher_version` ist die Unterscheidung zwischen „es gab keine Zeile" (alle drei Spalten
    // `null`) und „es gab eine Zeile, in der `profil` null ist". Ohne sie wäre „unbekannt" von
    // „aus, ohne Profil" nicht zu trennen.
    const vorher: BrandingStand =
      zeile.vorher_version === null
        ? { ...BRANDING_VORGABE }
        : {
            profil: profilAusAblage(zeile.vorher_profil),
            aktiv: zeile.vorher_aktiv === true,
            version: zeile.vorher_version,
          };
    return {
      vorher,
      nachher: {
        profil: profilAusAblage(zeile.nachher_profil),
        aktiv: zeile.nachher_aktiv,
        version: zeile.nachher_version,
      },
    };
  }
}
