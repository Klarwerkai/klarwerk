// ================================================================================================
// JOB 4325 · DIE KETTENPRÜFUNG — OHNE DATENBANK, DAMIT SIE SELBST GEPRÜFT WERDEN KANN.
// ================================================================================================
//
// WARUM DIESE DATEI VON `strecke.ts` GETRENNT IST. Der Prüfer, der über den Audit-Bestand urteilt,
// ist selbst ein Stück Logik — und ein Prüfer, der immer „ganz" sagt, sieht aus wie ein grüner Lauf.
// Hier steht er deshalb ohne jede Datenbankkante: `tests/rueckweg-gleichzeitig/kettenpruefung.test.ts`
// fährt ihn im normalen Tor gegen von Hand gebaute Ketten — ganz, mit Lücke, mit gebrochenem
// Vorgängerhash, mit verfälschtem Inhalt, mit doppelter Nummer. Erst damit trägt sein „ganz" im
// PostgreSQL-Lauf etwas.
//
// DIE VERSIONSWAHL WIRD NICHT NACHGEBAUT. `hashEntryFuerVersion` (`services/audit/src/chain.ts`) ist
// die EINE Stelle des Hauses, die entscheidet, welches Hashmaterial für einen Eintrag gilt; sie ist
// ausdrücklich fail-closed (unbekannte Version → `undefined`). Eine zweite Auslegung hier wäre die,
// die eines Tages auseinanderläuft.
import type { AuditEntry } from "../../services/audit";
import { GENESIS, hashEntryFuerVersion } from "../../services/audit";

/** Das Urteil über einen Audit-Bestand: was er umfasst und was an ihm nicht stimmt. */
export interface Kettenbefund {
  readonly anzahl: number;
  /** Die kleinste und die größte gelesene Nummer — `null`, wenn gar nichts dasteht. */
  readonly von: number | null;
  readonly bis: number | null;
  /** Leer heißt: lückenlos, richtig verkettet, jeder Hash nachgerechnet. */
  readonly maengel: readonly string[];
}

/** Die Kurzform für Meldungen: `seq 12 ko.revised@ko-a-3`. */
export function benenne(eintrag: AuditEntry): string {
  return `seq ${eintrag.seq} ${eintrag.action}@${eintrag.target}`;
}

/**
 * Lückenlos ab 1, `prevHash[i] = hash[i-1]`, erster Vorgänger GENESIS, jeder Hash nachgerechnet.
 *
 * Die Eingabe MUSS nach `seq` aufsteigend sortiert sein (`ORDER BY seq`) — die Reihenfolge ist
 * Gegenstand der Prüfung und wird deshalb nicht hier hergestellt.
 */
export function pruefeKette(eintraege: readonly AuditEntry[]): Kettenbefund {
  const maengel: string[] = [];
  if (eintraege.length === 0) {
    return {
      anzahl: 0,
      von: null,
      bis: null,
      maengel: ["Der Audit-Bestand ist leer — es wurde nichts belegt."],
    };
  }
  const gesehen = new Set<number>();
  let vorher: AuditEntry | undefined;
  for (const eintrag of eintraege) {
    if (gesehen.has(eintrag.seq)) {
      maengel.push(
        `${benenne(eintrag)}: die Nummer ${eintrag.seq} steht ein zweites Mal im Bestand.`,
      );
    }
    gesehen.add(eintrag.seq);

    const erwarteteNummer = vorher === undefined ? 1 : vorher.seq + 1;
    if (eintrag.seq !== erwarteteNummer) {
      const woher = vorher === undefined ? "(Anfang)" : `seq ${vorher.seq}`;
      maengel.push(
        `Lücke in der Kette: nach ${woher} steht seq ${eintrag.seq}, erwartet war ${erwarteteNummer}.`,
      );
    }

    const erwarteterVorgaenger = vorher === undefined ? GENESIS : vorher.hash;
    if (eintrag.prevHash !== erwarteterVorgaenger) {
      maengel.push(
        `${benenne(eintrag)}: prevHash ist ${eintrag.prevHash}, erwartet war ${erwarteterVorgaenger}.`,
      );
    }

    const nachgerechnet = hashEntryFuerVersion(eintrag);
    if (nachgerechnet === undefined) {
      maengel.push(
        `${benenne(eintrag)}: unbekannte Hashversion ${String(eintrag.hashVersion)} — nicht nachrechenbar.`,
      );
    } else if (nachgerechnet !== eintrag.hash) {
      maengel.push(
        `${benenne(eintrag)}: der gespeicherte Hash ${eintrag.hash} ist nicht der nachgerechnete ${nachgerechnet}.`,
      );
    }
    vorher = eintrag;
  }
  const erste = eintraege[0];
  const letzte = eintraege[eintraege.length - 1];
  return {
    anzahl: eintraege.length,
    von: erste === undefined ? null : erste.seq,
    bis: letzte === undefined ? null : letzte.seq,
    maengel,
  };
}

// ================================================================================================
// INTEGRITÄT UND VOLLSTÄNDIGKEIT SIND ZWEI FRAGEN — RUNDE 1 HAT NUR DIE ERSTE GESTELLT.
// ================================================================================================
//
// DER BEFUND DES PRÜFERS ZU RUNDE 1, wörtlich: „Die Audit-Prüfung überlebt den vollständigen Ausfall
// aller 40 Rückgabe-Belege in Fall (d). `ketteIstGanz` prüft ausschließlich die vorhandene Kette;
// deren korrekte Verkettung beweist keine Vollständigkeit." Er hat es gemessen: beide `audit.record`
// in `reviseUndFreigeben` (`services/knowledge-object/src/service.ts:4549-4558`) unterdrückt, und
// die Abnahme blieb grün — `Tests 2 passed | 3 skipped`, Exit 0, bei `seq 1–14 (14 Belege, 0 Mängel)`.
//
// WARUM `pruefeKette` DAS NICHT SEHEN KANN, und warum das keine Nachlässigkeit ist, sondern ihre
// Grenze: Fehlen die Belege am ENDE, ist die verbleibende Kette weiterhin lückenlos ab 1, richtig
// verkettet und Hash für Hash nachrechenbar. Sie ist nach jedem Massstab der INTEGRITÄT heil. Die
// Frage „steht für jeden wirksamen Vorgang auch ein Beleg?" ist eine ANDERE, und sie braucht einen
// Bezugspunkt ausserhalb des Protokolls: den tatsächlich eingetretenen Zustand.
//
// DIESE FUNKTION IST DIESE ZWEITE FRAGE. Sie vergleicht nicht das Protokoll mit sich selbst, sondern
// mit dem, was wirklich geschah. Die zwei Belegnamen sind am Produkt nachgeschlagen, nicht geraten:
// beide Schreibwege einer neuen freigegebenen Fassung legen GENAU DIESES PAAR an —
// `reviseUndFreigeben` (`service.ts:4549-4558`: `ko.revised` mit `version`, `ko.admin-validated` mit
// `koVersion`) und `decideProposal` beim Übernehmen (`service.ts:4738-4757`, dieselben zwei, dazu
// `proposalId`).

/** Der Beleg der neuen Inhaltsfassung. Trägt die entstandene Fassung im Feld `version`. */
export const FASSUNGSBELEG = "ko.revised";
/** Der Beleg der Freigabe. Trägt dieselbe Fassung im Feld `koVersion`. */
export const FREIGABEBELEG = "ko.admin-validated";

// ------------------------------------------------------------------------------------------------
// DIE ERWARTUNG IST EINE UNION — „wirksam, aber niemand genannt" lässt sich gar nicht erst schreiben.
// ------------------------------------------------------------------------------------------------
//
// RUNDE 2 HATTE HIER EIN OPTIONALES FELD GEDACHT UND KEINES GEBAUT: die Erwartung trug nur Objekt und
// Fassung, und der Prüfer hat es gemessen — 40 Belege mit FREMDEM Akteur, und die Abnahme blieb grün
// (`Tests 2 passed | 3 skipped`, Exit 0). Ein optionales Feld hätte denselben Ausgang genommen, weil
// niemand es hätte füllen MÜSSEN.
//
// Deshalb eine diskriminierte Union: wer eine wirksame Fassung behauptet, MUSS beide Akteure nennen —
// der Compiler lässt nichts anderes zu. Das ist die einzige Bauform, bei der dieselbe Lücke nicht
// durch Vergessen zurückkommen kann.
export type Belegerwartung =
  | {
      readonly target: string;
      /** Es ist keine Fassung entstanden — dann darf auch kein Beleg dastehen. */
      readonly wirksameFassung: undefined;
    }
  | {
      readonly target: string;
      /**
       * Die Fassung, die WIRKLICH entstanden ist — aus dem zurückgelesenen Objekt, nicht aus dem
       * Protokoll. Beides aus derselben Quelle zu nehmen wäre die Rückkehr zu genau dem Fehler, den
       * diese Prüfung schliesst.
       */
      readonly wirksameFassung: number;
      /**
       * Wer die neue Fassung GESCHRIEBEN hat.
       *
       * Die beiden Schreibwege unterscheiden sich hier, und das ist kein Zufall, sondern die Aussage
       * des Belegs: `reviseUndFreigeben` nennt den Zurückgebenden (`service.ts:4551`), die Übernahme
       * eines Vorschlags dagegen den EINREICHER (`service.ts:4741`, `actor: vorschlag.author`) — er
       * hat den Text verfasst, nicht der Entscheidende.
       */
      readonly fassungsAkteur: string;
      /** Wer FREIGEGEBEN hat — bei der Übernahme der Entscheidende (`service.ts:4751`). */
      readonly freigabeAkteur: string;
    };

/** Eine wirksame Fassung samt der zwei Menschen, die dahinterstehen. */
export function erwarteFassung(
  target: string,
  wirksameFassung: number,
  fassungsAkteur: string,
  freigabeAkteur: string,
): Belegerwartung {
  return { target, wirksameFassung, fassungsAkteur, freigabeAkteur };
}

/** Kein wirksamer Vorgang — und deshalb auch kein Beleg. */
export function erwarteKeineFassung(target: string): Belegerwartung {
  return { target, wirksameFassung: undefined };
}

function zahlAus(eintrag: AuditEntry, feld: string): number | undefined {
  const wert = (eintrag.payload as Record<string, unknown>)[feld];
  return typeof wert === "number" ? wert : undefined;
}

/**
 * Steht für den wirklich eingetretenen Zustand auch der Beleg da — und für nichts anderes?
 *
 * Zwei Richtungen, beide nötig: ein FEHLENDER Beleg lässt eine wirksame Änderung unbelegt (der
 * Ausfall, den der Prüfer nachgestellt hat); ein ÜBERZÄHLIGER Beleg behauptet etwas, das nie geschah
 * (der verwaiste Beleg, den Fall (b) bereits misst). Geprüft werden zusätzlich die genannte Fassung
 * und der genannte MENSCH: ein Beleg, der eine andere Fassung oder eine andere Person nennt, belegt
 * einen anderen Vorgang. „Wer hat das getan?" ist die Frage, wegen der es ein Prüfprotokoll gibt —
 * ein Beleg mit falschem Namen ist schlimmer als keiner, weil er eine Auskunft vortäuscht.
 */
export function pruefeBelegvollstaendigkeit(
  eintraege: readonly AuditEntry[],
  erwartung: Belegerwartung,
): string[] {
  const maengel: string[] = [];
  const fassungsbelege = belegeFuer(eintraege, erwartung.target, FASSUNGSBELEG);
  const freigabebelege = belegeFuer(eintraege, erwartung.target, FREIGABEBELEG);

  if (erwartung.wirksameFassung === undefined) {
    if (fassungsbelege.length > 0) {
      maengel.push(
        `${erwartung.target}: ${fassungsbelege.length} ${FASSUNGSBELEG}-Belege, obwohl keine neue Fassung entstanden ist (${fassungsbelege.map(benenne).join(", ")}).`,
      );
    }
    if (freigabebelege.length > 0) {
      maengel.push(
        `${erwartung.target}: ${freigabebelege.length} ${FREIGABEBELEG}-Belege, obwohl keine Freigabe wirksam wurde (${freigabebelege.map(benenne).join(", ")}).`,
      );
    }
    return maengel;
  }

  const fassung = erwartung.wirksameFassung;
  const erste = fassungsbelege[0];
  if (fassungsbelege.length !== 1 || erste === undefined) {
    maengel.push(
      `${erwartung.target}: ${fassungsbelege.length} ${FASSUNGSBELEG}-Belege, erwartet genau 1 für die wirksame Fassung ${fassung} — die Änderung ist ${fassungsbelege.length === 0 ? "UNBELEGT" : "mehrfach belegt"}.`,
    );
  } else {
    if (zahlAus(erste, "version") !== fassung) {
      maengel.push(
        `${benenne(erste)}: nennt Fassung ${String(zahlAus(erste, "version"))}, wirksam wurde ${fassung} — der Beleg gehört zu einem anderen Vorgang.`,
      );
    }
    if (erste.actor !== erwartung.fassungsAkteur) {
      maengel.push(
        `${benenne(erste)}: nennt als Urheber „${erste.actor}", geschrieben hat „${erwartung.fassungsAkteur}" — der Beleg weist die Änderung der FALSCHEN Person zu.`,
      );
    }
  }

  const zweite = freigabebelege[0];
  if (freigabebelege.length !== 1 || zweite === undefined) {
    maengel.push(
      `${erwartung.target}: ${freigabebelege.length} ${FREIGABEBELEG}-Belege, erwartet genau 1 für die wirksame Fassung ${fassung} — die Freigabe ist ${freigabebelege.length === 0 ? "UNBELEGT" : "mehrfach belegt"}.`,
    );
  } else {
    if (zahlAus(zweite, "koVersion") !== fassung) {
      maengel.push(
        `${benenne(zweite)}: nennt Fassung ${String(zahlAus(zweite, "koVersion"))}, wirksam wurde ${fassung} — der Beleg gehört zu einem anderen Vorgang.`,
      );
    }
    if (zweite.actor !== erwartung.freigabeAkteur) {
      maengel.push(
        `${benenne(zweite)}: nennt als Freigebenden „${zweite.actor}", freigegeben hat „${erwartung.freigabeAkteur}" — der Beleg weist die Freigabe der FALSCHEN Person zu.`,
      );
    }
  }
  return maengel;
}

/** Alle Belege zu einem Wissensobjekt, in Kettenreihenfolge. */
export function belegeFuer(
  eintraege: readonly AuditEntry[],
  target: string,
  action?: string,
): AuditEntry[] {
  return eintraege.filter(
    (e) => e.target === target && (action === undefined || e.action === action),
  );
}

/** Die Vorschlagskennung aus dem Beleg — `undefined`, wenn der Beleg keine trägt. */
export function vorschlagskennung(eintrag: AuditEntry): string | undefined {
  const kennung = (eintrag.payload as { proposalId?: unknown }).proposalId;
  return typeof kennung === "string" ? kennung : undefined;
}

/**
 * Jeder `ko.proposed`-Beleg braucht seinen Vorschlag im gespeicherten Objekt.
 *
 * Steht ein Beleg ohne Vorschlag da, ist das KEIN Mangel der Kette, sondern ein VERWAISTER Beleg:
 * `KoService.mutateKo` (`services/knowledge-object/src/service.ts:766-780`) schreibt den Audit VOR
 * `repo.update` und ohne Transaktion — fällt der Write am Compare-and-Set, bleibt der Beleg für
 * etwas stehen, das nie geschah. Diese Funktion misst genau das und behauptet nichts darüber, ob es
 * vorkommt.
 */
export function verwaisteVorschlagsbelege(
  eintraege: readonly AuditEntry[],
  target: string,
  vorhandeneVorschlaege: readonly string[],
): string[] {
  const bekannt = new Set(vorhandeneVorschlaege);
  const verwaist: string[] = [];
  for (const beleg of belegeFuer(eintraege, target, "ko.proposed")) {
    const kennung = vorschlagskennung(beleg);
    if (kennung === undefined) {
      verwaist.push(`${benenne(beleg)}: der Beleg nennt keine proposalId.`);
    } else if (!bekannt.has(kennung)) {
      verwaist.push(
        `${benenne(beleg)}: Beleg für Vorschlag ${kennung}, der im gespeicherten Objekt nicht steht.`,
      );
    }
  }
  return verwaist;
}
