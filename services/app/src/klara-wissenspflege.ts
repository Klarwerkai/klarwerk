import { createHash } from "node:crypto";
import type { NotizSchreibbedingung } from "./klara-notiz";

/** Drei fachliche Varianten derselben vorhandenen Routine, keine eigene Zeitsteuerung. */
export const PFLEGE_VORLAGEN = ["offene_pruefungen", "quellaenderung", "aktualitaet"] as const;
export type PflegeVorlage = (typeof PFLEGE_VORLAGEN)[number];
export const PFLEGE_QUELLEN_MAX = 20;

export interface PflegeAuftrag {
  readonly vorlage: PflegeVorlage;
  readonly quellen: readonly string[];
  readonly bereich: "ausgewaehlte_wissensobjekte";
  readonly ausloeser: "zeitplan" | "quellstand_polling";
  readonly erlaubteArbeit: "pruefunterlagen";
  readonly verantwortlich: "auftraggeber";
  readonly empfaenger: "auftraggeber";
  /** Das tatsächliche Ende steht im vorhandenen Zeitplan; kein zweites Serienende. */
  readonly ende: "zeitplan";
  /** Ausdrücklicher enger Zusatzauftrag am vorhandenen Quellenpolling; keine Fachannahme. */
  readonly normbekanntmachungen?: "belege_vorbereiten";
  /** Nur vom Server aus den tatsächlich gelesenen Fassungen gesetzt. */
  readonly ausgangsstand: readonly { id: string; fassung: number }[];
}

export class PflegeEingabeFehler extends Error {}

/** Eingaben begrenzen keine impliziten Rechte und dürfen keinen behaupteten Vorstand einspeisen. */
export function pflegeAus(roh: unknown): PflegeAuftrag {
  if (!roh || typeof roh !== "object" || Array.isArray(roh))
    throw new PflegeEingabeFehler("wissenspflege ist ein Auftrag.");
  const o = roh as Record<string, unknown>;
  const erlaubt = new Set([
    "vorlage",
    "quellen",
    "bereich",
    "ausloeser",
    "erlaubteArbeit",
    "verantwortlich",
    "empfaenger",
    "ende",
    "ausgangsstand",
    "normbekanntmachungen",
  ]);
  if (Object.keys(o).some((k) => !erlaubt.has(k)))
    throw new PflegeEingabeFehler("Unbekannte Wissenspflege-Wirkung oder Einstellung.");
  if (!(PFLEGE_VORLAGEN as readonly unknown[]).includes(o.vorlage))
    throw new PflegeEingabeFehler("Bitte eine der drei Wissenspflegevorlagen wählen.");
  if (
    !Array.isArray(o.quellen) ||
    o.quellen.length < 1 ||
    o.quellen.length > PFLEGE_QUELLEN_MAX ||
    o.quellen.some((id) => typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,200}$/.test(id))
  )
    throw new PflegeEingabeFehler(
      "Wissenspflege braucht 1 bis 20 ausdrücklich ausgewählte Wissensobjekte.",
    );
  const vorlage = o.vorlage as PflegeVorlage;
  if (o.normbekanntmachungen !== undefined &&
    (o.normbekanntmachungen !== "belege_vorbereiten" || vorlage !== "quellaenderung"))
    throw new PflegeEingabeFehler("Normereignisbelege brauchen den ausdrücklich bestellten begrenzten Quellenwatch.");
  const ausloeser = vorlage === "quellaenderung" ? "quellstand_polling" : "zeitplan";
  const fest = {
    bereich: "ausgewaehlte_wissensobjekte",
    ausloeser,
    erlaubteArbeit: "pruefunterlagen",
    verantwortlich: "auftraggeber",
    empfaenger: "auftraggeber",
    ende: "zeitplan",
  } as const;
  for (const [k, wert] of Object.entries(fest))
    if (o[k] !== undefined && o[k] !== wert)
      throw new PflegeEingabeFehler(`${k}: Dieser persönliche Auftrag erlaubt nur ${wert}.`);
  return { ...fest, vorlage, quellen: [...new Set(o.quellen as string[])], ausgangsstand: [],
    ...(o.normbekanntmachungen === "belege_vorbereiten" ? { normbekanntmachungen: "belege_vorbereiten" as const } : {}),
  };
}

export interface PflegeQuelle {
  readonly id: string;
  readonly fassung: number;
  readonly titel: string;
  readonly aussage: string;
  readonly offenePruefung: { readonly stand: number; readonly seit: string | null } | null;
  readonly frische: {
    readonly stufe: "frisch" | "altert" | "faellig" | "veraltet";
    readonly bezugAm: string | null;
    readonly haltbarBis: string | null;
    /** Ungeprüfter Konfliktstand bleibt ausdrücklich ungeprüft. */
    readonly konflikt: "nicht_erhoben";
  };
}

export interface GelesenePflegeQuelle {
  readonly quelle: PflegeQuelle;
  readonly bedingung: NotizSchreibbedingung;
  readonly nochAktuell: () => Promise<boolean>;
}

/** Die Kompositionswurzel bindet den aktuellen Konto-/Space-/KO-/Lebenszyklus-Leseweg. */
export interface PflegeLeser {
  lies(kontoId: string, id: string): Promise<GelesenePflegeQuelle | null>;
}

export interface PflegeErgebnis {
  readonly vorlage: PflegeVorlage;
  readonly geprueftAm: string;
  readonly stand: "vorbereitet" | "ohne_quellaenderung" | "ungeprueft" | "ergebnis_entfernt";
  readonly quellen: readonly {
    id: string;
    fassung: number | null;
    stand: "gelesen" | "ungeprueft";
    letzteErfolgreichePruefung: string | null;
  }[];
  /** Eindeutiger belegter Stand, ohne Zeitablauf als Änderungssignal auszugeben. */
  readonly aenderung: string | null;
  readonly normbekanntmachungen?: { readonly stand: "belege_vorbereitet" | "ungeprueft" | "keine_erkannten_belege" };
}

export interface PflegeEntwurf {
  readonly ergebnis: PflegeErgebnis;
  readonly titel: string;
  readonly inhalt: string;
  readonly gelesen: readonly GelesenePflegeQuelle[];
}

export const PFLEGE_TITEL: Record<PflegeVorlage, string> = {
  offene_pruefungen: "Offene Prüfungen erinnern",
  quellaenderung: "Geänderte Quellen melden",
  aktualitaet: "Regelmäßige Aktualitätsprüfung",
};

function hash(wert: unknown): string {
  return createHash("sha256").update(JSON.stringify(wert)).digest("hex");
}

/** Auch zwanzig große Quellen bleiben innerhalb der vorhandenen Notizgrenze. */
function auszug(text: string, laenge: number): string {
  if (text.length <= laenge) return text;
  let ende = laenge - 1;
  const letztes = text.charCodeAt(ende - 1);
  if (letztes >= 0xd800 && letztes <= 0xdbff) ende--;
  return `${text.slice(0, ende)}…`;
}

/** Vorschau und Aktivierung lesen denselben tatsächlichen Ausgangsbestand. Kein Schreibaufruf. */
export async function pflegeAusgangsstand(
  auftrag: PflegeAuftrag,
  kontoId: string,
  leser: PflegeLeser,
): Promise<PflegeAuftrag> {
  const stand: { id: string; fassung: number }[] = [];
  for (const id of auftrag.quellen) {
    const q = await leser.lies(kontoId, id);
    if (!q) throw new PflegeEingabeFehler("Eine ausgewählte Quelle ist aktuell nicht lesbar.");
    stand.push({ id, fassung: q.quelle.fassung });
  }
  return { ...auftrag, ausgangsstand: stand };
}

/** Reine Vorbereitung nach aktuellen Lesungen; weder fachliche Bestätigung noch Pflegeausführung. */
export async function bereiteWissenspflegeVor(
  auftrag: PflegeAuftrag,
  kontoId: string,
  leser: PflegeLeser,
  geprueftAm: string,
  vorher: PflegeErgebnis | null,
): Promise<PflegeEntwurf> {
  const gelesen: GelesenePflegeQuelle[] = [];
  const quellen: PflegeErgebnis["quellen"][number][] = [];
  for (const id of auftrag.quellen) {
    let q: GelesenePflegeQuelle | null;
    try {
      q = await leser.lies(kontoId, id);
    } catch {
      q = null;
    }
    if (q) gelesen.push(q);
    quellen.push({
      id,
      fassung: q?.quelle.fassung ?? null,
      stand: q ? "gelesen" : "ungeprueft",
      letzteErfolgreichePruefung: q
        ? geprueftAm
        : (vorher?.quellen.find((alt) => alt.id === id)?.letzteErfolgreichePruefung ?? null),
    });
  }
  const vollstaendig = gelesen.length === auftrag.quellen.length;
  const aenderungen = gelesen
    .map((q) => q.quelle)
    .filter((q) => auftrag.ausgangsstand.find((alt) => alt.id === q.id)?.fassung !== q.fassung)
    .map((q) => [q.id, q.fassung] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  const quellwatch = auftrag.ausloeser === "quellstand_polling";
  const ohneAenderung = quellwatch && aenderungen.length === 0;
  const ergebnis: PflegeErgebnis = {
    vorlage: auftrag.vorlage,
    geprueftAm,
    quellen,
    stand: !vollstaendig ? "ungeprueft" : ohneAenderung ? "ohne_quellaenderung" : "vorbereitet",
    aenderung: vollstaendig && quellwatch && !ohneAenderung ? hash(aenderungen) : null,
  };
  const zeilen = [
    PFLEGE_TITEL[auftrag.vorlage],
    "Vorbereitete Prüfunterlagen für die ausdrücklich ausgewählten Wissensobjekte.",
    "Dies bestätigt keine fachliche Gültigkeit, Wartung, Einarbeitung oder Verantwortungsübergabe.",
    "Konflikte und vollständige Dokumenttexte wurden in dieser Vorlage nicht geprüft.",
    "Titel und Kernaussagen erscheinen als begrenzte Auszüge. Die fachliche Prüfung erfolgt am verlinkten Original.",
  ];
  if (!vollstaendig) {
    zeilen.push("", "Ungeprüft: Mindestens eine Quelle ist aktuell nicht lesbar. Kein Nullbefund.");
  } else if (ohneAenderung) {
    zeilen.push("", "Keine neue Quellfassung gegenüber dem ausdrücklich gelesenen Ausgangsstand.");
  } else {
    for (const { quelle: q } of gelesen) {
      const betroffen =
        auftrag.vorlage !== "quellaenderung" || aenderungen.some(([id]) => id === q.id);
      if (!betroffen) continue;
      zeilen.push(
        "",
        `## ${auszug(q.titel, 120)}`,
        `[wissensobjekt ${q.id}, Fassung ${q.fassung}]`,
      );
      if (auftrag.vorlage === "offene_pruefungen") {
        zeilen.push(
          q.offenePruefung
            ? `Offene Folgeprüfung, Stand ${q.offenePruefung.stand}${q.offenePruefung.seit ? ` seit ${q.offenePruefung.seit}` : ""}. Bitte den belegten Anlass am Original prüfen.`
            : "Zum gelesenen Stand keine offene Folgeprüfung. Dies ist keine fachliche Bestätigung.",
        );
      } else if (auftrag.vorlage === "quellaenderung") {
        const alt = auftrag.ausgangsstand.find((s) => s.id === q.id);
        zeilen.push(
          `Neue Quellfassung ${q.fassung}; ausdrücklich gelesener Ausgangsstand ${alt?.fassung ?? "unbekannt"}.`,
          "Welche Aussagen und belegten Abhängigkeiten müssen anhand dieser Änderung überprüft werden?",
        );
      } else {
        zeilen.push(
          `Klarwerk-Frische: ${q.frische.stufe}; Bezug ${q.frische.bezugAm ?? "unbekannt"}; Haltbarkeit ${q.frische.haltbarBis ?? "unbekannt"}.`,
          "Trifft die Aussage im heutigen Anwendungsfall noch zu? Welche Unterlagen oder Rückfragen fehlen für eine fachliche Prüfung?",
        );
      }
      zeilen.push(`Auszug aus der gelesenen Kernaussage: ${auszug(q.aussage, 250)}`);
    }
  }
  return { ergebnis, titel: PFLEGE_TITEL[auftrag.vorlage], inhalt: zeilen.join("\n"), gelesen };
}

/** Derselbe Quellenstand erhält je ausdrücklich bestellter Routine genau denselben Ergebnisschlüssel. */
export function pflegeVorgang(
  erinnerungId: string,
  routineFassung: number,
  vorkommenId: string,
  ergebnis: PflegeErgebnis,
): string {
  return `kwp-${hash([erinnerungId, routineFassung, ergebnis.aenderung ?? vorkommenId])}`;
}
