// ================================================================================================
// ADMIN-11 · WISSENSKENNZAHLEN — HANDLUNGSBEDARF ZUERST, JEDE ZAHL MIT GRUNDMENGE UND DATENSTAND.
// ================================================================================================
//
// produkt:20261009:admin-wissenskennzahlen. Ausgangslage (09.10.2026): Analytics, Qualitätswert,
// Unsicherheit und Frage-/Lückendaten bestehen, sind aber schwer lesbar und führen kaum in Arbeit.
//
// WAS DIESE DATEI IST: eine Auswertung VORHANDENER Quellen, keine neue Erhebung.
//   Handlungsbedarf — die Vorgänge aus ADMIN-10 (`ladeQualitaetsaufgaben`), dieselbe Rechte- und
//                     Zählregel; jede Zahl trägt ihre Einträge, die Detailliste ist also dieselbe
//                     Menge wie die Zahl.
//   Fragen          — das vorhandene Protokoll `ask.query` (FR-ANA-02). Es trägt keinen Fragetext
//                     und keinen Space.
//   Neue Lücken     — `AskService.listGaps`, gezählt nach `createdAt`.
//   Fragebedarf     — offene Lücken mit ihrer vorhandenen Häufigkeit (`askCount`, D-032). Der
//                     zugeordnete Vorgang ist die Lücke selbst; hier entsteht keine Aufgabe.
//
// EHRLICHE LAGE JE ZAHL (Kriterium 1): `gemessen` — Quelle geliefert, Zeitraum vollständig nach dem
// belegten Erhebungsbeginn; `unvollstaendig` — der Zeitraum beginnt vor dem ersten belegten
// Ereignis; `nicht_erhoben` — die Quelle führt das Merkmal nicht (z. B. Space bei Fragen);
// `unbekannt` — die Quelle hat nicht geliefert. Eine 0 steht nur bei `gemessen` als Null da.
//
// TREND (Kriterium 3): nur für Zeitraum-Zahlen und nur, wenn auch der Vorzeitraum gleicher Länge
// vollständig erhoben ist. Momentaufnahmen haben keinen Verlauf — es gibt keine historischen
// Stände, und es werden keine erfunden.
//
// SUCHEN: erfolglose Suchen (`nulltreffer.ts`) sind je Person geführt und nur für die eigene Liste
// lesbar; eine Sicht über die Suchen anderer ist dort bewusst nicht gebaut. Ausgewertet wird deshalb
// genau der vorhandene Leseweg `fuer(user.id)` — die EIGENEN Suchen, kumuliert und ohne Zeitraum —
// und jeder Begriff mit der offenen Lücke derselben Frage verbunden (Nacharbeit 3, Ben).
//
// RECHTE (Kriterium 5): Routenrecht `users.manage`. Vorgänge laufen durch denselben
// Sichtbarkeitsfilter wie ADMIN-10; Fragetexte nur nach `redactGapForViewer`; Filterwerte sind nur
// Spaces, deren Inhalte der Betrachter lesen darf, und Teams, die an mindestens einen davon gebunden
// sind. Ein unbekannter oder nicht lesbarer Filterwert ist ein Eingabefehler — keine Existenzauskunft.
import {
  NULLTREFFER_DECKEL,
  type NulltrefferRepo,
  nulltrefferBegriff,
  redactGapForViewer,
} from "../../ask";
import type { SessionUser } from "./http";
import {
  type QualitaetsDeps,
  type QualitaetsVorgang,
  type VorgangTyp,
  type VorgangZustand,
  ladeQualitaetsaufgaben,
} from "./qualitaetsaufgaben";
import type { Sichtbarkeitsfilter } from "./sichtbarkeit";
import type { TeamsRepo } from "./teams";

const TAG_MS = 86_400_000;

/** Die wählbaren Zeiträume in Tagen. */
export const ZEITRAEUME = [7, 30, 90] as const;
export type Zeitraum = (typeof ZEITRAEUME)[number];
export const STANDARD_ZEITRAUM: Zeitraum = 30;

/** So viele offene Lücken nennt der Fragebedarf höchstens — die häufigsten zuerst. */
export const BEDARF_DECKEL = 10;

export interface KennzahlAnfrage {
  tage: Zeitraum;
  space: string | null;
  team: string | null;
}

export type Messlage = "gemessen" | "unvollstaendig" | "nicht_erhoben" | "unbekannt";

export type TrendGrund =
  | "verglichen"
  | "momentaufnahme"
  | "vorperiode_unvollstaendig"
  | "nenner_null"
  | "nicht_erhoben"
  | "unbekannt";

/** Ein Vorgang hinter einer Handlungsbedarf-Zahl — derselbe Eintrag wie in ADMIN-10. */
export interface KennzahlEintrag {
  schluessel: string;
  typ: VorgangTyp;
  zustand: VorgangZustand;
  /** Titel des betroffenen Inhalts bzw. Fragetext; `null` = zurückgehalten. */
  titel: string | null;
  arbeitsweg: string;
  spaces: string[];
  seit: string | null;
  ueberfaellig: boolean;
}

export const HANDLUNGSBEDARF = [
  "pruefung",
  "revalidierung",
  "konflikt",
  "duplikat",
  "luecke",
  "rueckmeldung",
  "rueckmeldung_unklar",
] as const;
export type HandlungsbedarfSchluessel = (typeof HANDLUNGSBEDARF)[number];

export const NUTZUNG = ["fragen", "beantwortet", "antwortquote", "neue_luecken"] as const;
export type NutzungSchluessel = (typeof NUTZUNG)[number];

export interface Kennzahl {
  schluessel: HandlungsbedarfSchluessel | NutzungSchluessel;
  art: "momentaufnahme" | "zeitraum";
  einheit: "anzahl" | "prozent";
  /** `null` bei `unbekannt`/`nicht_erhoben` und bei einer Quote mit Nenner 0. */
  wert: number | null;
  /** Nur bei Quoten: Zähler und Nenner, aus denen `wert` gerechnet ist. */
  zaehler: number | null;
  nenner: number | null;
  lage: Messlage;
  /** Erstes belegtes Ereignis der Quelle; `null` = keins. Nur bei Zeitraum-Zahlen. */
  erhobenSeit: string | null;
  trend: { vorher: number; differenz: number } | null;
  trendGrund: TrendGrund;
  /** Der Weg in die vorhandene Arbeitsliste mit derselben Auswahl; `null` = nur die Details hier. */
  arbeitsliste: string | null;
  /** Nur bei Handlungsbedarf: genau die gezählten Vorgänge. */
  eintraege?: KennzahlEintrag[];
}

export interface BedarfEintrag {
  lueckeId: string;
  /** Der Fragetext nur, wenn der Betrachter ihn nach R-0585 sehen darf. */
  frage: string | null;
  /** Wie oft dieselbe Frage zu dieser Lücke führte; `null` = bei Altbeständen nicht gezählt. */
  haeufigkeit: number | null;
  zugeordnet: boolean;
  seit: string;
  /** Der vorhandene Vorgang dieser Lücke (Arbeitsweg) und sein Schlüssel in ADMIN-10. */
  arbeitsweg: string;
  vorgang: string;
}

/** Eine eigene Suche ohne Treffer — so, wie die Ablage sie je Person führt. */
export interface SuchEintrag {
  begriff: string;
  /** Wie oft seit der ersten Erfassung — KEINE Zahl je Zeitraum. */
  anzahl: number;
  zuletzt: string;
  /** Filter der Suche, Feld → Wert; leer heisst: im ganzen sichtbaren Bestand gesucht. */
  eingrenzung: Record<string, string>;
  /** Die offene Lücke mit derselben formnormalisierten Frage — der vorhandene Vorgang. */
  vorgang: { schluessel: string; arbeitsweg: string } | null;
}

export interface Wissenskennzahlen {
  stand: string;
  anfrage: KennzahlAnfrage;
  zeitraum: { von: string; bis: string };
  vorperiode: { von: string; bis: string };
  handlungsbedarf: Kennzahl[];
  nutzung: Kennzahl[];
  bedarf: {
    lage: Messlage;
    /** Offene Lücken insgesamt; `null`, wenn der Bedarf für diese Auswahl nicht auswertbar ist. */
    offen: number | null;
    /** Offene Lücken ohne gezählte Häufigkeit (Altbestand). */
    ohneZaehlung: number | null;
    eintraege: BedarfEintrag[];
  };
  /** Die EIGENEN erfolglosen Suchen des Betrachters (s. Kopf) — kumuliert, ohne Zeitraum. */
  suche: {
    lage: Messlage;
    /** Höchstzahl, die die Ablage je Person liefert — die Liste ist nie mehr als das. */
    deckel: number;
    eintraege: SuchEintrag[];
  };
  filterwerte: {
    spaces: { id: string; name: string }[];
    teams: { id: string; name: string; spaces: string[] }[];
  };
  quellen: {
    vorgaenge: "ok" | "teilweise" | "fehler";
    fragen: "ok" | "fehler";
    luecken: "ok" | "fehler";
  };
}

/**
 * Dieselben Quellen wie ADMIN-10 — dazu die Teams für den Teamfilter und der vorhandene Leseweg
 * der EIGENEN erfolglosen Suchen (fehlt er, ist die Suche „nicht erhoben").
 */
export interface KennzahlDeps extends QualitaetsDeps {
  teams: Pick<TeamsRepo, "aktuelle">;
  nulltreffer?: Pick<NulltrefferRepo, "fuer">;
}

export class KennzahlFilterFehler extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KennzahlFilterFehler";
  }
}

/** Die Anfrage aus Abfrageparametern; ein unbekannter Zeitraum fällt auf den Standard zurück. */
export function anfrageAus(query: Record<string, unknown>): KennzahlAnfrage {
  const text = (v: unknown): string | null =>
    typeof v === "string" && v.trim() !== "" ? v.trim() : null;
  const tage = Number(text(query.tage));
  const gueltig = (ZEITRAEUME as readonly number[]).includes(tage);
  return {
    tage: gueltig ? (tage as Zeitraum) : STANDARD_ZEITRAUM,
    space: text(query.space),
    team: text(query.team),
  };
}

async function versuche<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

function imZeitraum(at: string, von: number, bis: number): boolean {
  const ms = Date.parse(at);
  return !Number.isNaN(ms) && ms >= von && ms < bis;
}

function frueheste(zeiten: readonly string[]): string | null {
  let erste: number | null = null;
  for (const z of zeiten) {
    const ms = Date.parse(z);
    if (!Number.isNaN(ms) && (erste === null || ms < erste)) {
      erste = ms;
    }
  }
  return erste === null ? null : new Date(erste).toISOString();
}

/** Ein offener Handlungsbedarf je Schlüssel: Typ und — für Rückmeldungen — der Zustand. */
interface BedarfRegel {
  typ: VorgangTyp;
  zustand?: VorgangZustand;
}

const BEDARF_REGEL: Record<HandlungsbedarfSchluessel, BedarfRegel> = {
  pruefung: { typ: "pruefung" },
  revalidierung: { typ: "revalidierung" },
  konflikt: { typ: "konflikt" },
  duplikat: { typ: "duplikat" },
  luecke: { typ: "luecke" },
  rueckmeldung: { typ: "rueckmeldung", zustand: "offen" },
  rueckmeldung_unklar: { typ: "rueckmeldung", zustand: "unklar" },
};

/** Typen, deren Quelle keinen Space trägt — mit Space-/Teamfilter nicht auswertbar. */
const OHNE_SPACE: ReadonlySet<VorgangTyp> = new Set(["luecke"]);

/** Ein ADMIN-10-Vorgang als Detailzeile — Titel wie dort: Inhalte vor Beschreibung. */
function eintragVon(v: QualitaetsVorgang): KennzahlEintrag {
  return {
    schluessel: v.schluessel,
    typ: v.typ,
    zustand: v.zustand,
    titel: v.inhalt.length > 0 ? v.inhalt.map((i) => i.titel).join(" ↔ ") : v.titel,
    arbeitsweg: v.arbeitsweg,
    spaces: v.spaces,
    seit: v.seit,
    ueberfaellig: v.ueberfaellig,
  };
}

/**
 * Die Kennzahlen für EINEN Betrachter und EINE Auswahl. Wirft `KennzahlFilterFehler`, wenn der
 * gewählte Space oder das Team für diesen Betrachter nicht wählbar ist.
 */
export async function ladeWissenskennzahlen(
  deps: KennzahlDeps,
  user: SessionUser,
  darfSehen: Sichtbarkeitsfilter,
  anfrage: KennzahlAnfrage,
): Promise<Wissenskennzahlen> {
  const jetzt = deps.jetzt?.() ?? new Date();
  const bis = jetzt.getTime();
  const von = bis - anfrage.tage * TAG_MS;
  const vorVon = von - anfrage.tage * TAG_MS;

  const [spaces, teams] = await Promise.all([
    versuche(() => deps.spaces.aktuelle()),
    versuche(() => deps.teams.aktuelle()),
  ]);
  const lesbar = user.spaceLesbar ?? new Set<string>();
  const spaceWerte = (spaces ?? [])
    .filter((s) => lesbar.has(s.id))
    .map((s) => ({ id: s.id, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const lesbareIds = new Set(spaceWerte.map((s) => s.id));
  const teamWerte = (teams ?? [])
    .filter((t) => !t.archiviert)
    .map((t) => ({
      id: t.id,
      name: t.name,
      spaces: (spaces ?? [])
        .filter((s) => lesbareIds.has(s.id) && (s.teams ?? []).some((b) => b.team === t.id))
        .map((s) => s.id)
        .sort(),
    }))
    .filter((t) => t.spaces.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

  if (anfrage.space !== null && !lesbareIds.has(anfrage.space)) {
    throw new KennzahlFilterFehler("Dieser Space ist nicht wählbar.");
  }
  const team = anfrage.team === null ? null : teamWerte.find((t) => t.id === anfrage.team);
  if (anfrage.team !== null && !team) {
    throw new KennzahlFilterFehler("Dieses Team ist nicht wählbar.");
  }
  // Die Spacemenge der Auswahl: ein Space, die Spaces eines Teams, beides (Schnitt) oder alle.
  let auswahl: Set<string> | null = null;
  if (anfrage.space !== null) {
    auswahl = new Set([anfrage.space]);
  }
  if (team) {
    const teamSpaces = new Set(team.spaces);
    auswahl = auswahl ? new Set([...auswahl].filter((s) => teamSpaces.has(s))) : teamSpaces;
  }
  const gefiltert = auswahl !== null;
  const trifft = (v: QualitaetsVorgang): boolean =>
    auswahl === null || v.spaces.some((s) => auswahl?.has(s));

  const [uebersicht, fragen, luecken] = await Promise.all([
    versuche(() => ladeQualitaetsaufgaben(deps, user, darfSehen)),
    versuche(() => deps.audit.list({ action: "ask.query" })),
    versuche(() => deps.ask.listGaps()),
  ]);

  // ── Handlungsbedarf: Momentaufnahmen aus ADMIN-10 ────────────────────────────────────────────
  const arbeitsliste = (regel: BedarfRegel): string | null => {
    // Die Arbeitsliste kennt einen Space, aber kein Team — mit Teamfilter bleiben die Details hier.
    if (team) {
      return null;
    }
    const p = new URLSearchParams({ typ: regel.typ });
    if (regel.zustand) {
      p.set("zustand", regel.zustand);
    }
    if (anfrage.space !== null) {
      p.set("space", anfrage.space);
    }
    return `/qualitaetsaufgaben?${p.toString()}`;
  };
  const handlungsbedarf = HANDLUNGSBEDARF.map((schluessel): Kennzahl => {
    const regel = BEDARF_REGEL[schluessel];
    const basis = {
      schluessel,
      art: "momentaufnahme" as const,
      einheit: "anzahl" as const,
      zaehler: null,
      nenner: null,
      erhobenSeit: null,
      trend: null,
    };
    if (!uebersicht || uebersicht.quellen[regel.typ] === "fehler") {
      return {
        ...basis,
        wert: null,
        lage: "unbekannt",
        trendGrund: "unbekannt",
        arbeitsliste: null,
      };
    }
    if (gefiltert && OHNE_SPACE.has(regel.typ)) {
      return {
        ...basis,
        wert: null,
        lage: "nicht_erhoben",
        trendGrund: "nicht_erhoben",
        arbeitsliste: null,
      };
    }
    const passend = uebersicht.vorgaenge.filter(
      (v) =>
        v.typ === regel.typ &&
        v.zustand !== "erledigt" &&
        (regel.zustand === undefined || v.zustand === regel.zustand) &&
        trifft(v),
    );
    const eintraege = passend.map(eintragVon);
    return {
      ...basis,
      wert: eintraege.length,
      lage: "gemessen",
      trendGrund: "momentaufnahme",
      arbeitsliste: arbeitsliste(regel),
      eintraege,
    };
  });

  // ── Nutzung: Zeitraum-Zahlen aus dem Frageprotokoll und den Lücken ───────────────────────────
  const fragenSeit = fragen ? frueheste(fragen.map((f) => f.at)) : null;
  const lueckenSeit = luecken ? frueheste(luecken.map((g) => g.createdAt)) : null;
  /** Lage einer Zeitraum-Zahl und ob ein Vorzeitraum-Vergleich zulässig ist. */
  const lageVon = (
    geliefert: boolean,
    ohneSpace: boolean,
    seit: string | null,
  ): { lage: Messlage; vergleichbar: boolean; grund: TrendGrund } => {
    if (!geliefert) {
      return { lage: "unbekannt", vergleichbar: false, grund: "unbekannt" };
    }
    if (gefiltert && ohneSpace) {
      return { lage: "nicht_erhoben", vergleichbar: false, grund: "nicht_erhoben" };
    }
    const seitMs = seit === null ? null : Date.parse(seit);
    if (seitMs === null || seitMs > von) {
      return { lage: "unvollstaendig", vergleichbar: false, grund: "vorperiode_unvollstaendig" };
    }
    return seitMs <= vorVon
      ? { lage: "gemessen", vergleichbar: true, grund: "verglichen" }
      : { lage: "gemessen", vergleichbar: false, grund: "vorperiode_unvollstaendig" };
  };

  const anzahlKennzahl = (
    schluessel: NutzungSchluessel,
    l: ReturnType<typeof lageVon>,
    seit: string | null,
    jetztWert: number,
    vorherWert: number,
  ): Kennzahl => {
    const bekannt = l.lage === "gemessen" || l.lage === "unvollstaendig";
    return {
      schluessel,
      art: "zeitraum",
      einheit: "anzahl",
      wert: bekannt ? jetztWert : null,
      zaehler: null,
      nenner: null,
      lage: l.lage,
      erhobenSeit: bekannt ? seit : null,
      trend: l.vergleichbar ? { vorher: vorherWert, differenz: jetztWert - vorherWert } : null,
      trendGrund: l.grund,
      arbeitsliste: null,
    };
  };

  const fragenLage = lageVon(fragen !== null, true, fragenSeit);
  const fragenJetzt = (fragen ?? []).filter((f) => imZeitraum(f.at, von, bis));
  const fragenVorher = (fragen ?? []).filter((f) => imZeitraum(f.at, vorVon, von));
  const beantwortet = (zeilen: typeof fragenJetzt): number =>
    zeilen.filter((f) => f.payload.answered === true).length;
  const quote = (z: number, n: number): number | null =>
    n > 0 ? Math.round((z / n) * 1000) / 10 : null;
  const quoteJetzt = quote(beantwortet(fragenJetzt), fragenJetzt.length);
  const quoteVorher = quote(beantwortet(fragenVorher), fragenVorher.length);
  const quoteBekannt = fragenLage.lage === "gemessen" || fragenLage.lage === "unvollstaendig";
  const quoteTrend =
    fragenLage.vergleichbar && quoteJetzt !== null && quoteVorher !== null
      ? { vorher: quoteVorher, differenz: Math.round((quoteJetzt - quoteVorher) * 10) / 10 }
      : null;
  const quoteGrund: TrendGrund =
    fragenLage.vergleichbar && (quoteJetzt === null || quoteVorher === null)
      ? "nenner_null"
      : fragenLage.grund;

  const lueckenLage = lageVon(luecken !== null, true, lueckenSeit);
  const neu = (a: number, b: number) =>
    (luecken ?? []).filter((g) => imZeitraum(g.createdAt, a, b)).length;
  // Nacharbeit 3 (Ben): die Detailmenge ist GENAU die gezählte — Zeitraum und Status (offen wie
  // geschlossen) wie die Zahl. Jeder Eintrag öffnet die Lücke im Risikobereich, der beide führt.
  const neueLuecken = (luecken ?? [])
    .filter((g) => imZeitraum(g.createdAt, von, bis))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map((g): KennzahlEintrag => {
      const sicht = redactGapForViewer(g, { viewerId: user.id });
      let zustand: VorgangZustand = "erledigt";
      if (g.status === "offen") {
        zustand = g.assignee ? "in_arbeit" : "offen";
      }
      return {
        schluessel: `luecke:${g.id}`,
        typ: "luecke",
        zustand,
        titel: sicht.redacted ? null : sicht.question,
        arbeitsweg: `/risiko?fall=${encodeURIComponent(g.id)}`,
        spaces: [],
        seit: g.createdAt,
        ueberfaellig: false,
      };
    });
  const neueLueckenZahl = anzahlKennzahl(
    "neue_luecken",
    lueckenLage,
    lueckenSeit,
    neu(von, bis),
    neu(vorVon, von),
  );
  // Kein Weg in die Arbeitsliste: sie kennt weder Zeitraum noch geschlossene Lücken. Die Liste
  // hier ist dieselbe Menge wie die Zahl — und fehlt, wo die Zahl fehlt (nicht erhoben, unbekannt).
  let neueLueckenMitListe: Kennzahl = neueLueckenZahl;
  if (neueLueckenZahl.wert !== null) {
    neueLueckenMitListe = { ...neueLueckenZahl, eintraege: neueLuecken };
  }

  const nutzung: Kennzahl[] = [
    anzahlKennzahl("fragen", fragenLage, fragenSeit, fragenJetzt.length, fragenVorher.length),
    anzahlKennzahl(
      "beantwortet",
      fragenLage,
      fragenSeit,
      beantwortet(fragenJetzt),
      beantwortet(fragenVorher),
    ),
    {
      schluessel: "antwortquote",
      art: "zeitraum",
      einheit: "prozent",
      wert: quoteBekannt ? quoteJetzt : null,
      zaehler: quoteBekannt ? beantwortet(fragenJetzt) : null,
      nenner: quoteBekannt ? fragenJetzt.length : null,
      lage: fragenLage.lage,
      erhobenSeit: quoteBekannt ? fragenSeit : null,
      trend: quoteTrend,
      trendGrund: quoteGrund,
      arbeitsliste: null,
    },
    neueLueckenMitListe,
  ];

  // ── Eigene Suchen ohne Treffer: der vorhandene Leseweg, nur für DIESEN Betrachter ───────────
  // Die Ablage führt je Person und Begriff eine kumulierte Anzahl und den letzten Zeitpunkt — keinen
  // Verlauf. Deshalb gibt es hier weder Zeitraumzahl noch Trend, und ohne Space-Angabe auch keine
  // Auswertung unter Space- oder Teamfilter. Verbunden wird ein Begriff nur mit einer OFFENEN Lücke
  // derselben formnormalisierten Frage (dieselbe Regel wie D-032); es entsteht nichts Neues.
  const offeneNachSchluessel = new Map<string, string>();
  for (const g of luecken ?? []) {
    if (g.status === "offen" && g.compareKey && !offeneNachSchluessel.has(g.compareKey)) {
      offeneNachSchluessel.set(g.compareKey, g.id);
    }
  }
  const vorgangZu = (begriff: string): SuchEintrag["vorgang"] => {
    const schluessel = nulltrefferBegriff(begriff)?.vergleichsschluessel;
    const lueckeId = schluessel ? offeneNachSchluessel.get(schluessel) : undefined;
    if (!lueckeId) {
      return null;
    }
    return {
      schluessel: `luecke:${lueckeId}`,
      arbeitsweg: `/risiko?fall=${encodeURIComponent(lueckeId)}`,
    };
  };
  const ablage = deps.nulltreffer;
  const lies = () => (ablage ? versuche(() => ablage.fuer(user.id, NULLTREFFER_DECKEL)) : null);
  const eigeneSuchen = await lies();
  let sucheLage: Messlage = "gemessen";
  if (!ablage || gefiltert) {
    sucheLage = "nicht_erhoben";
  } else if (eigeneSuchen === null) {
    sucheLage = "unbekannt";
  }
  const suchEintraege: SuchEintrag[] = [];
  if (sucheLage === "gemessen") {
    for (const s of eigeneSuchen ?? []) {
      suchEintraege.push({
        begriff: s.begriff,
        anzahl: s.anzahl,
        zuletzt: s.zuletzt,
        eingrenzung: { ...s.eingrenzung },
        vorgang: vorgangZu(s.begriff),
      });
    }
  }

  // ── Fragebedarf: offene Lücken mit ihrer vorhandenen Häufigkeit ──────────────────────────────
  const offeneLuecken = (luecken ?? []).filter((g) => g.status === "offen");
  let bedarfLage: Messlage = "gemessen";
  if (!luecken) {
    bedarfLage = "unbekannt";
  } else if (gefiltert) {
    bedarfLage = "nicht_erhoben";
  }
  const haeufigste = [...offeneLuecken].sort(
    (a, b) =>
      (b.askCount ?? 0) - (a.askCount ?? 0) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
  // Der Fragetext nach R-0585; der Name einer zugeordneten Person gehört nicht in die Auswertung.
  const alsBedarf = (g: (typeof offeneLuecken)[number]): BedarfEintrag => {
    const sicht = redactGapForViewer(g, { viewerId: user.id });
    return {
      lueckeId: g.id,
      frage: sicht.redacted ? null : sicht.question,
      haeufigkeit: typeof g.askCount === "number" ? g.askCount : null,
      zugeordnet: g.assignee !== null,
      seit: g.createdAt,
      arbeitsweg: `/risiko?fall=${encodeURIComponent(g.id)}`,
      vorgang: `luecke:${g.id}`,
    };
  };
  const bedarfGemessen = bedarfLage === "gemessen";
  const bedarf = bedarfGemessen ? haeufigste.slice(0, BEDARF_DECKEL).map(alsBedarf) : [];
  const ohneZaehlung = offeneLuecken.filter((g) => typeof g.askCount !== "number").length;

  let vorgaengeLage: Wissenskennzahlen["quellen"]["vorgaenge"] = "ok";
  if (!uebersicht) {
    vorgaengeLage = "fehler";
  } else if (Object.values(uebersicht.quellen).some((q) => q === "fehler")) {
    vorgaengeLage = "teilweise";
  }
  return {
    stand: jetzt.toISOString(),
    anfrage: { tage: anfrage.tage, space: anfrage.space, team: anfrage.team },
    zeitraum: { von: new Date(von).toISOString(), bis: new Date(bis).toISOString() },
    vorperiode: { von: new Date(vorVon).toISOString(), bis: new Date(von).toISOString() },
    handlungsbedarf,
    nutzung,
    bedarf: {
      lage: bedarfLage,
      offen: bedarfGemessen ? offeneLuecken.length : null,
      ohneZaehlung: bedarfGemessen ? ohneZaehlung : null,
      eintraege: bedarf,
    },
    suche: { lage: sucheLage, deckel: NULLTREFFER_DECKEL, eintraege: suchEintraege },
    filterwerte: { spaces: spaceWerte, teams: teamWerte },
    quellen: {
      vorgaenge: vorgaengeLage,
      fragen: fragen ? "ok" : "fehler",
      luecken: luecken ? "ok" : "fehler",
    },
  };
}
