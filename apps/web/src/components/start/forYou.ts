// ================================================================================================
// JOB 3064 H5 — „FÜR DICH": WAS AUF MICH WARTET, ALS DREI ZEILEN STATT ALS ZEHN BLÖCKE.
// ================================================================================================
//
// Pedi 04.09. („Text über Text über Text … Absolut unmöglich."): die Startseite trug zehn Blöcke,
// von denen keiner sagte, was der Mensch als Nächstes tun soll. Das Zielbild `Main.dc.html` (Z.45–64)
// zeigt stattdessen EINE Karte mit Kicker, Zahl-Pille und bis zu drei Zeilen — Zustandspunkt, Text,
// Meta, Chevron.
//
// DIESES MODUL IST DOM-FREI und trägt die zwei Entscheidungen, die man ohne Browser prüfen muss:
//   1. WELCHE Zeilen entstehen (aus den drei bestehenden Quellen: Arbeitsübersicht, Meldungen,
//      Kollision am eigenen Wissen) und in welcher Reihenfolge (kritisch vor heute vor später,
//      innerhalb einer Dringlichkeit stabil in Eingabereihenfolge).
//   2. WELCHE LAGE die Karte hat. §9 des Auftrags ist hier streng: die Pille und die Zeilen stehen
//      erst nach einem erfolgreichen frischen Abruf ALLER Quellen. Vorher ist die Karte leer —
//      kein „lädt", keine 0, keine Negativaussage aus fehlenden Daten.
//
// WARUM EINE EIGENE LAGE UND NICHT `lib/loadingState.ts`: dort gibt es `loading | loaded | error`
// plus `isGroupStale`, aber KEIN Offline. Die Lehren aus JOB 3037 R5 und JOB 3044 R2 sagen dasselbe
// zweimal: ein pausierter Abruf (`isPaused`) ist weder „lädt" noch „Fehler", und er muss aus dem
// tatsächlichen Zustand der Abfrage kommen, nicht aus einer Vermutung. Ohne Daten ist er eine
// Störung (`gescheitert`), mit Daten eine veraltete Anzeige (`veraltet`) — nie ein stilles Leer.
//
// ------------------------------------------------------------------------------------------------
// JOB 3098 (Q6b) — UND `isPaused` ALLEIN REICHTE NICHT.
// ------------------------------------------------------------------------------------------------
//
// Der Absatz darüber beschrieb bis hierher genau die Lücke, die er selbst nicht schloss: `isPaused`
// entsteht NUR an einem Abruf, den jemand will. Innerhalb der `staleTime` von 30 s (`main.tsx:21`)
// will nach dem Zurückkommen auf die Seite niemand einen — die Abfrage steht auf `idle`, `data`
// liegt vor, und diese Funktion las daraus `frisch`. Dieselbe Lücke hatte `quellenlage()`
// (`lib/eigeneKollision.ts:99-150`) bis JOB 3084; sie ist dort mit demselben Griff geschlossen
// worden, aus dem Befund R-1585 heraus (05.09.2026, `https://app.klarwerk.ai`).
//
// DER ONLINEZUSTAND IST DESHALB EIN PFLICHTPARAMETER, kein Zusatz mit Vorgabewert: ein Vorgabewert
// „online" ließe genau den Aufrufer durchgehen, der ihn vergisst — und das war drei Aufträge lang
// `pages/Start.tsx`. Die Quelle ist `lib/netzzustand.ts` (`onlineManager`, dieselbe, aus der Query
// sein `paused` ableitet); die Funktion bleibt dabei DOM-frei und ohne React-Abhängigkeit.
//
// ES ENTSTEHT KEINE FÜNFTE LAGE. `!online` fällt in die BESTEHENDEN zwei: mit Daten `veraltet`,
// ohne Daten `gescheitert` — dieselbe Behandlung wie `isPaused`, weil es derselbe Sachverhalt ist
// (es kann gerade nicht geprüft werden). Dass TanStack Query den einen meldet und den anderen
// nicht, ist eine Eigenschaft seiner Frist und keine Aussage über den Bestand.
//
// ------------------------------------------------------------------------------------------------
// RESTSCHULD, EHRLICH BENANNT (JOB 3098 Runde 2/3) — DIE LAGE STIMMT, DIE ANZEIGE NOCH NICHT.
// ------------------------------------------------------------------------------------------------
//
// `forYouLage()` beantwortet den Onlinezustand seit JOB 3098 richtig. WAS DIE KARTE DARAUS MACHT,
// entscheidet sie aber selbst — und dort ist es noch falsch. Ben hat es an der gemounteten Seite
// gemessen (Runde 1, wörtlich): „online leer laden, Netz trennen, am selben QueryClient neu mounten
// ergibt wörtlich `Nichts offen.Veraltet – Aktualisierung fehlgeschlagenErneut versuchen`."
// Drei Fehler in einer Zeile, und KEINER davon steckt in dieser Datei:
//   1. „Nichts offen." ist eine VERNEINUNG des Bestands aus einem Stand, der nicht mehr gilt. Sie
//      hängt an `zeigtBestand()` (unten), das für `frisch` UND `veraltet` wahr ist — richtig für
//      die geholten WERTE (REGELN §7: nie leeren), falsch für die Verneinung. Beides hängt heute
//      an einem einzigen Merkmal.
//   2. „Aktualisierung fehlgeschlagen" (`loadstate.stale`) behauptet einen gescheiterten Versuch —
//      offline hat es gar keinen gegeben; die Abfrage ruht. Die richtigen Sätze bestehen bereits:
//      `kollision.lage.pausiert` (mit Stand) und `…pausiertOhneStand` (ohne).
//   3. „Erneut versuchen" verspricht eine Handlung, die ohne Netz nichts bewirken kann (REGELN §7,
//      Auftrag §9). `lib/eigeneKollision.ts:205-207` (`wiederholenSinnvoll`) trifft dieselbe
//      Entscheidung für die Kollisionsauskunft seit JOB 3084 richtig.
//
// WARUM ES HIER NICHT BEHOBEN IST: alle drei Stellen stehen in `components/start/StartKarten.tsx`
// (`:113` die Verneinung, `:133-153` Satz und Knopf), und diese Datei liegt AUSSERHALB der
// Zielpfade von JOB 3098. Ben hat die Aufnahme in seiner Korrekturpflicht 3 ausdrücklich verlangt
// („dafür `StartKarten.tsx` ausdrücklich in die Zielpfade aufnehmen"); die Vorprüfung des Tors
// (`takt/schritte.py:822`) hat Runde 2 daran rot gemacht, bevor das Tor überhaupt lief. Der Weg ist
// damit eine Auftragsentscheidung und keine Bauentscheidung — und ein Vorbau hier wäre toter Code
// ohne Aufrufer (`tests/capture/aufrufer-waechter.test.ts`).
//
// ES ENTSTÜNDE AUCH DANN KEINE FÜNFTE LAGE: die drei Entscheidungen lesen die vier bestehenden
// Lagen zusammen mit dem Onlinezustand, den `forYouLage` ohnehin schon kennt.
export type ForYouSeverity = "critical" | "today" | "later";

/**
 * `laedt`       — noch nicht alle Quellen haben geantwortet, keine ist gescheitert. Karte leer.
 * `gescheitert` — mindestens eine Quelle hat ohne eigene Daten aufgegeben (Fehler oder offline).
 *                 Karte leer, aber die Störung ist sichtbar (Wiederholen-Knopf) — eine Störung
 *                 darf nicht wie Leere aussehen.
 * `frisch`      — alle Quellen haben geantwortet, keine steht in Fehler/Pause, das Gerät ist online.
 *                 Zeilen + Pille.
 * `veraltet`    — alle Quellen haben Daten, eine Auffrischung scheiterte oder ruht (offline).
 *                 Die zuletzt erfolgreich geholten Werte bleiben SICHTBAR und werden markiert.
 */
export type ForYouLage = "laedt" | "gescheitert" | "frisch" | "veraltet";

/** Die schmalste Sicht auf eine react-query-Abfrage, die für die Lage reicht. */
export interface ForYouQuelle {
  readonly data: unknown;
  readonly isError?: boolean;
  readonly isPaused?: boolean;
}

/**
 * @param online Der Onlinezustand des Geräts, aus `lib/netzzustand.ts`. OHNE Vorgabewert — s. den
 *   Kopfkommentar: ein Vorgabewert wäre die Erlaubnis, ihn zu vergessen.
 */
export function forYouLage(quellen: readonly ForYouQuelle[], online: boolean): ForYouLage {
  // `!online` steht IN `gestoert` und nicht als eigener Vorabzweig: die Fallunterscheidung „mit
  // Daten / ohne Daten" darunter ist für offline dieselbe wie für `isPaused`, und zwei Wege zu
  // demselben Ergebnis wären zwei Wege, die auseinanderlaufen können.
  const gestoert = (q: ForYouQuelle): boolean =>
    !online || q.isError === true || q.isPaused === true;
  if (quellen.every((q) => q.data !== undefined)) {
    return quellen.some(gestoert) ? "veraltet" : "frisch";
  }
  if (quellen.some((q) => q.data === undefined && gestoert(q))) {
    return "gescheitert";
  }
  return "laedt";
}

/** Trägt die Lage überhaupt eine Aussage über den Bestand? Nur `frisch` und `veraltet`. */
export function zeigtBestand(lage: ForYouLage): boolean {
  return lage === "frisch" || lage === "veraltet";
}

// ------------------------------------------------------------------------------------------------
// Die Zeile
// ------------------------------------------------------------------------------------------------
export interface ForYouZeile {
  /** Stabiler React-Schlüssel und Testanker. */
  id: string;
  severity: ForYouSeverity;
  /** Übersetzbarer Text (`textKey`) ODER ein bereits vorliegender Titel (`text`) — nie beides. */
  textKey?: string;
  textWerte?: Record<string, number | string>;
  text?: string;
  /** Meta rechts: übersetzbarer Bereichsname (`metaKey`) oder eine Zahl (`meta`). */
  metaKey?: string;
  meta?: string;
  /** Ziel des Klicks. `null` = die Quelle kennt kein eindeutiges Ziel → keine Sackgasse bauen. */
  to: string | null;
  /** Wie viele offene Einträge diese Zeile bündelt — die Summe trägt die Pille. */
  count: number;
}

/** Was die Arbeitsübersicht (`lib/workCenter.ts`) liefert — strukturell, kein Import nötig. */
export interface ArbeitZeile {
  key: string;
  count: number;
  to: string;
  severity: ForYouSeverity;
}

/** Was eine Meldung beisteuert — strukturell wie `api/types.ts:Notification`. */
export interface MeldungZeile {
  id: string;
  kind: "conflict" | "duplicate" | "gap" | "assignment" | "impact";
  title: string;
  seen?: boolean;
  redacted?: boolean;
  to: string | null;
}

/** Die Kollisionszeile am eigenen Wissen (A27/JOB 3025) — nur „im Fall". */
export interface KollisionZeile {
  satzKey: string;
  anzahl: number;
  art: "dublette" | "konflikt" | "beides";
  to: string | null;
}

const RANG: Record<ForYouSeverity, number> = { critical: 0, today: 1, later: 2 };

// Meldungsart → Dringlichkeit. Ein Konflikt ist Arbeit von jetzt, eine Zuweisung und ein Duplikat
// sind Arbeit von heute, Lücke und Wirkungs-Rückmeldung sind später. Dieselbe Skala wie die
// Arbeitsübersicht, damit eine Reihung über beide Quellen überhaupt bedeutet, was sie sagt.
const MELDUNG_SEVERITY: Record<MeldungZeile["kind"], ForYouSeverity> = {
  conflict: "critical",
  duplicate: "today",
  assignment: "today",
  gap: "later",
  impact: "later",
};

/** Bereichsname je Meldungsart (i18n-Schlüssel) — steht als Meta rechts in der Zeile. */
export function meldungMetaKey(kind: MeldungZeile["kind"]): string {
  return `start.fuerdich.art.${kind}`;
}

/**
 * Die drei Quellen zu EINER geordneten Liste. Ungelesene Meldungen zählen, gelesene nicht — sie
 * warten nicht mehr auf jemanden. Eine redigierte Wissenslücke trägt NIE ihren Fragetext (die
 * Regel aus FUNKE-FIX3 P0), sondern die neutrale Bezeichnung.
 */
export function forYouZeilen(input: {
  arbeit: readonly ArbeitZeile[];
  meldungen: readonly MeldungZeile[];
  kollision: KollisionZeile | null;
  /**
   * §5a: die Erststart-Führung steht beim ERSTEN Besuch einer Administratorin zusätzlich als Zeile
   * hier. Sie kommt von der Fläche, weil nur die den Vermerk („war schon einmal da") kennt.
   */
  ersteinrichtung?: { textKey: string; to: string };
}): ForYouZeile[] {
  const zeilen: ForYouZeile[] = [];
  if (input.ersteinrichtung) {
    zeilen.push({
      id: "ersteinrichtung",
      severity: "today",
      textKey: input.ersteinrichtung.textKey,
      meta: "1",
      to: input.ersteinrichtung.to,
      count: 1,
    });
  }
  if (input.kollision && input.kollision.anzahl > 0) {
    const k = input.kollision;
    zeilen.push({
      id: `kollision-${k.art}`,
      severity: k.art === "dublette" ? "today" : "critical",
      textKey: k.satzKey,
      textWerte: { n: k.anzahl },
      meta: String(k.anzahl),
      to: k.to,
      count: k.anzahl,
    });
  }
  for (const a of input.arbeit) {
    if (a.count <= 0) {
      continue;
    }
    zeilen.push({
      id: `arbeit-${a.key}`,
      severity: a.severity,
      textKey: `work.${a.key}`,
      meta: String(a.count),
      to: a.to,
      count: a.count,
    });
  }
  for (const m of input.meldungen) {
    if (m.seen === true) {
      continue;
    }
    const kind = MELDUNG_SEVERITY[m.kind] === undefined ? "later" : MELDUNG_SEVERITY[m.kind];
    const redigiert = m.kind === "gap" && (m.redacted === true || m.title.trim().length === 0);
    zeilen.push({
      id: `meldung-${m.id}`,
      severity: kind,
      ...(redigiert ? { textKey: "topbar.notifGapRedacted" } : { text: m.title }),
      metaKey: meldungMetaKey(m.kind),
      to: m.to,
      count: 1,
    });
  }
  // Stabil: `sort` in V8 ist stabil, gleiche Dringlichkeit behält die Eingabereihenfolge.
  return [...zeilen].sort((a, b) => RANG[a.severity] - RANG[b.severity]);
}

/** Die Zahl der Pille: ALLE offenen Einträge, nicht die drei sichtbaren (§5.2). */
export function forYouGesamt(zeilen: readonly ForYouZeile[]): number {
  return zeilen.reduce((summe, z) => summe + z.count, 0);
}

/** Wie viele Zeilen die Karte zeigt (Zielbild `Main.dc.html`: drei). */
export const FUER_DICH_ZEILEN = 3;
