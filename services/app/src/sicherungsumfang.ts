// ================================================================================================
// produkt:20261010:poc-wiederherstellung-export (PV-01-01, PV-01-03) — WAS EINE SICHERUNG ENTHÄLT,
// UND WAS NICHT. JE BEREICH, MIT GRUND UND WIEDERHERSTELLUNGSFOLGE.
// ================================================================================================
//
// `docs/operations/sicherungsbestand.md` nennt die vier Schutzwege (Export, Sicherung, Papierkorb,
// Restore-Nachweis). Was diese Datei hinzufügt, ist die Frage DARUNTER: welcher Bereich des Produkts
// liegt im Dump, welcher bewusst nicht — und wo liegt das, was nicht im Dump liegt? Die Antwort steht
// hier EINMAL, als Daten; `GET /api/admin/sicherungen` reicht sie an die Karte „Sicherung" durch, und
// `tests/wiederherstellung-export/sicherungsumfang.test.ts` hält jede genannte Tabelle gegen die
// Pflichtliste des Restore-Drills und die Migration.
//
// DREI GETRENNTE AUSSAGEN, die eine Anzeige nicht vermischen darf (Auftrag: „Dump, Anhangsbytes und
// private Assistenzspeicher getrennt erfassen"):
//   · DATENBANK-DUMP   — `pg_dump` der ganzen Produktdatenbank (`scripts/backup/backup.sh`).
//   · ANHANGSBYTES     — die Originaldateien liegen in DERSELBEN Datenbank (`objects.data`,
//                        `services/object-store/src/repo-pg.ts`), also im selben Dump. Es gibt keine
//                        zweite Objektablage, die eigens zu sichern wäre.
//   · PRIVATE ASSISTENZSPEICHER — Profil, Gespräche, Gedächtnis, Sitzungen: ebenfalls Tabellen im Dump,
//                        und seit diesem Auftrag eine EIGENE Vergleichskategorie im Drillprotokoll
//                        (`vergleich.assistenz`).
//
// KEIN RÜCKWIRKENDER BELEG: Ob ein Bereich in einer Wiederherstellungsprobe tatsächlich gemessen
// wurde, sagt nicht diese Liste, sondern das Drillprotokoll — und zwar nur, wenn es die Tabelle mit
// beiden Zahlen führt. Ein Protokoll aus einer Fassung vor diesem Auftrag kennt die Kategorie
// `assistenz` nicht; der Bereich steht dann als „im Restore-Nachweis nicht gemessen" da, auch wenn
// die Tabelle heute im Dump liegt (`belegFuer`).
//
// NICHT VORHANDEN IST NICHT GESICHERT: Für Bereiche, die das Produkt in dieser Fassung gar nicht
// speichert (eigene oder generierte Avatarbilder, persönliche Aufgabenlisten), steht ausdrücklich
// `nicht_vorhanden` — keine Tabelle, kein Beleg, keine Behauptung.

/** Wo der Bereich liegt — und damit, ob ein Dump ihn überhaupt enthalten kann. */
export type UmfangZustand =
  /** Tabellen der Produktdatenbank — im `pg_dump` enthalten. */
  | "im_dump"
  /** Bewusst nicht im Dump; Grund und Wiederherstellungsfolge stehen in der Oberfläche. */
  | "ausgeschlossen"
  /** In dieser Produktfassung gibt es keine Ablage dafür — also auch nichts zu sichern. */
  | "nicht_vorhanden";

export type UmfangArt = "kern" | "assistenz";

export interface UmfangBereich {
  /** Stabile Kennung; die Oberfläche übersetzt Titel, Grund und Folge über sie. */
  id: string;
  art: UmfangArt;
  zustand: UmfangZustand;
  /** Die Tabellen aus `migrate()` — leer bei allem, was nicht in der Datenbank liegt. */
  tabellen: readonly string[];
}

/**
 * Der Sicherungsumfang dieser Fassung. Reihenfolge = Anzeige-Reihenfolge: erst der Kern (Dump,
 * Anhangsbytes), dann die persönlichen Assistenzbereiche einzeln.
 */
export const SICHERUNGSUMFANG: readonly UmfangBereich[] = [
  // Der Dump als Ganzes — die Tabellenliste ist die Pflichtliste des Drills, nicht hier abgeschrieben.
  { id: "datenbank", art: "kern", zustand: "im_dump", tabellen: [] },
  // Originaldateien der Anhänge: `objects` (Bytes als Daten-URL) und die Zuordnung Datei→Beitrag.
  { id: "anhangsbytes", art: "kern", zustand: "im_dump", tabellen: ["objects", "ko_evidence"] },
  // produkt:20261010:assistenz-name-avatar — Name, Motivkennung, Bewegung, Ersteinrichtung.
  { id: "assistenzprofil", art: "assistenz", zustand: "im_dump", tabellen: ["assistenz_profile"] },
  // produkt:20261008:klara-basis — persönliche Gespräche samt letztem begonnenem Schritt.
  { id: "gespraeche", art: "assistenz", zustand: "im_dump", tabellen: ["klara_gespraeche"] },
  // Interaktionsgedächtnis — gemerkte Fragen/Antworten je Konto, mit Verfallsfrist.
  {
    id: "gedaechtnis",
    art: "assistenz",
    zustand: "im_dump",
    tabellen: ["interaktions_gedaechtnis"],
  },
  // Klara-Sitzungen und Zustimmungen zur externen KI.
  {
    id: "sitzungen",
    art: "assistenz",
    zustand: "im_dump",
    tabellen: ["klara_sessions", "klara_session_consents"],
  },
  // Die dreizehn Motive sind Bilddateien des Anwendungspakets (`apps/web`), kein Nutzerinhalt.
  { id: "avatarmotive", art: "assistenz", zustand: "ausgeschlossen", tabellen: [] },
  // Eigene, hochgeladene oder generierte Avatarbilder: in dieser Fassung nicht gebaut.
  { id: "eigeneavatare", art: "assistenz", zustand: "nicht_vorhanden", tabellen: [] },
  // Persönliche Aufgabenlisten: keine eigene Ablage in dieser Fassung.
  { id: "aufgaben", art: "assistenz", zustand: "nicht_vorhanden", tabellen: [] },
  // Browser-Speicher der Person (Sitzungscookie, lokale Einstellungen).
  { id: "endgeraet", art: "assistenz", zustand: "ausgeschlossen", tabellen: [] },
];

/** Die Tabellen der privaten Assistenzspeicher — dieselbe Liste wie `vergleich.assistenz` im Drill. */
export function assistenzTabellen(umfang: readonly UmfangBereich[] = SICHERUNGSUMFANG): string[] {
  return umfang.filter((b) => b.art === "assistenz").flatMap((b) => [...b.tabellen]);
}

/** Eine gemessene Zeile aus dem Drillprotokoll (dieselbe Form wie in `admin-routes.ts`). */
export interface GemesseneTabelle {
  tabelle: string;
  dump: number | null;
  datenbank: number | null;
}

/**
 * Was die LETZTE Wiederherstellungsprobe über diesen Bereich belegt.
 *   belegt         — die Probe war insgesamt grün UND jede Tabelle des Bereichs steht mit beiden
 *                    Zahlen gleich im Protokoll. Gleiche Zahlen in einer gescheiterten Probe belegen
 *                    nichts (z. B. Exit 73: Zeilen gleich, Anhangsinhalt weg).
 *   abweichend     — eine Tabelle steht mit zwei verschiedenen Zahlen darin.
 *   nicht_gemessen — eine Tabelle fehlt im Protokoll (auch: älteres Protokoll) oder die Probe war
 *                    nicht grün.
 *   kein_beleg     — der Bereich liegt nicht in der Datenbank; eine Probe kann ihn nicht belegen.
 */
export type UmfangBeleg = "belegt" | "abweichend" | "nicht_gemessen" | "kein_beleg";

export function belegFuer(
  bereich: UmfangBereich,
  gemessen: readonly GemesseneTabelle[] | null,
  restoreErfolg: boolean,
): UmfangBeleg {
  if (bereich.zustand !== "im_dump") {
    return "kein_beleg";
  }
  if (gemessen === null) {
    return "nicht_gemessen";
  }
  if (bereich.tabellen.length === 0) {
    // Der Dump als Ganzes: belegt genau dann, wenn die Probe insgesamt grün war.
    return restoreErfolg ? "belegt" : "nicht_gemessen";
  }
  const zeilen = bereich.tabellen.map((t) => gemessen.find((g) => g.tabelle === t));
  if (zeilen.some((z) => z && z.dump !== null && z.datenbank !== null && z.dump !== z.datenbank)) {
    return "abweichend";
  }
  if (zeilen.some((z) => !z || z.dump === null || z.datenbank === null)) {
    return "nicht_gemessen";
  }
  return restoreErfolg ? "belegt" : "nicht_gemessen";
}

/**
 * Die Tabellennamen, die eine Menge von DDL-Stufen anlegt — dieselbe Lesung wie
 * `tests/backup-drill/pflichtsatz.ts` (`tabellenAusSchemas`), damit die Zahl in der Auskunft aus der
 * Migration kommt und nicht abgeschrieben ist.
 */
export function tabellenDerStufen(stufen: readonly string[]): string[] {
  const raus: string[] = [];
  for (const ddl of stufen) {
    for (const treffer of ddl.matchAll(/CREATE TABLE IF NOT EXISTS\s+"?([A-Za-z0-9_]+)"?/gi)) {
      const name = treffer[1] as string;
      if (!raus.includes(name)) {
        raus.push(name);
      }
    }
  }
  return raus;
}

/** Die Fassung, an die die Auskunft gebunden ist — Version aus `package.json`, Commit der Auslieferung. */
export interface Produktfassung {
  version: string;
  commit: string;
}

export interface UmfangAuskunft {
  produkt: Produktfassung;
  /** Wie viele Tabellen `migrate()` in dieser Fassung anlegt — alle liegen im Dump. */
  tabellenImDump: number;
  bereiche: (UmfangBereich & { beleg: UmfangBeleg })[];
}

export function umfangAuskunft(
  produkt: Produktfassung,
  tabellenImDump: number,
  gemessen: readonly GemesseneTabelle[] | null,
  restoreErfolg: boolean,
): UmfangAuskunft {
  return {
    produkt,
    tabellenImDump,
    bereiche: SICHERUNGSUMFANG.map((b) => ({
      ...b,
      tabellen: [...b.tabellen],
      beleg: belegFuer(b, gemessen, restoreErfolg),
    })),
  };
}
