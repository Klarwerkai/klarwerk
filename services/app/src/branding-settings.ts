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
// WAS HIER FEHLT, UND WARUM — BITTE VOR DEM WEITERBAUEN LESEN.
// ================================================================================================
//
// Es gibt hier HEUTE NUR die In-Memory-Ablage. Ein Postgres-Repo fehlt, und das ist keine
// Bequemlichkeit, sondern eine benannte Auftragsgrenze: Eine neue Tabelle braucht eine exportierte
// `*_SCHEMA`-DDL, die in `db.ts` migriert wird — und JEDE solche Stufe muss zusätzlich in der
// Migrations-Sollliste `services/app/src/migrationsbeleg.ts` stehen. Zwei Wächter erzwingen das
// beidseitig (`db.migrate.test.ts:93` für die Migration, `:248-263` und `:306` für die Sollliste).
// `migrationsbeleg.ts` liegt AUSSERHALB der Zielpfade dieses Auftrags; in JOB 3510 Runde 2 wurde
// der Versuch, die Tabelle ohne diesen Eintrag zu migrieren, im Tor mit genau drei roten Fällen
// quittiert. Die Bahn nimmt den Pfad nicht eigenmächtig.
//
// DIE EHRLICHE FOLGE, ungeschminkt: Die Markenwahl überlebt keinen Neustart und keinen Deploy.
// Nach jedem Neustart steht sie wieder auf der Vorgabe (kein Profil, aus) und muss neu gesetzt
// werden. Für die Vorführung heisst das: NACH dem letzten Deploy setzen, nicht davor.
//
// WAS DIE ABLÖSUNG BRAUCHT (klein und vollständig benannt): `migrationsbeleg.ts` freigeben, dort
// `{ stufe: "BRANDING_SETTINGS_SCHEMA", risiko: "ADDITIV" }` hinter `LESEVARIANTEN_SCHEMA`
// eintragen, hier `BRANDING_SETTINGS_SCHEMA` + `PgBrandingSettingsRepo` ergänzen und in
// `build-app.ts` (`buildPgServices`) einhängen. Der Wächter in
// `tests/demo-firmen-ci-server/branding-speicher.test.ts` wird rot, sobald jemand die Hälfte davon
// tut — genau dafür steht er dort.
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
