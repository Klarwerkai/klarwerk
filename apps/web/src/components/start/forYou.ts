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
// JOB 3118 (Q6e) — WAS DIE KARTE AUS DER LAGE MACHT, ENTSCHEIDET JETZT AUCH DIESE DATEI.
// ------------------------------------------------------------------------------------------------
//
// `forYouLage()` beantwortete den Onlinezustand seit JOB 3098 richtig; die Karte machte daraus
// weiterhin drei Unwahrheiten. Ben hat sie an der gemounteten Seite gemessen (JOB 3098 Runde 1,
// wörtlich): „online leer laden, Netz trennen, am selben QueryClient neu mounten ergibt wörtlich
// `Nichts offen.Veraltet – Aktualisierung fehlgeschlagenErneut versuchen`." Alle drei standen in
// `components/start/StartKarten.tsx`, das AUSSERHALB der Zielpfade von JOB 3098 lag; die Vorprüfung
// des Tors (`takt/schritte.py:822`) hat Runde 2 daran rot gemacht. JOB 3118 nimmt die Datei auf und
// löst die drei Entscheidungen aus der Anzeige heraus — hierher, DOM-frei und ohne React:
//   1. `entwarnungErlaubt()` — eine VERNEINUNG des Bestands („Nichts offen.", „Noch nichts
//      erfasst.") steht nur, wenn ein frischer, abgeschlossener Abruf sie trägt. Bis hierher hing
//      sie an `zeigtBestand()`, das für `frisch` UND `veraltet` wahr ist: richtig für die geholten
//      WERTE (REGELN §7: nie leeren), falsch für die Verneinung. Das sind zwei Fragen, und sie
//      haben jetzt zwei Funktionen. Runde 2 hat den dritten Eingang ergänzt: solange ein Abruf
//      LÄUFT (`auffrischungLaeuft()`), steht keine Verneinung — Bens Korrekturpflicht 1. Runde 3
//      hat ihn an ALLE DREI Entscheidungen gereicht (`Kartenlage`), nachdem er in Runde 2 nur bei
//      dieser einen ankam.
//   2. `datenlageKey()` — „Aktualisierung fehlgeschlagen" (`loadstate.stale`) behauptet einen
//      gescheiterten Versuch; offline hat es gar keinen gegeben, die Abfrage ruht. Ohne Netz steht
//      deshalb `kollision.lage.pausiert` (mit sichtbarem Stand) bzw. `…pausiertOhneStand` (ohne).
//   3. `wiederholenSinnvoll()` — „Erneut versuchen" verspricht eine Handlung, die ohne Netz nichts
//      bewirken kann (REGELN §7). Der Knopf steht nur, wenn ein Versuch jetzt etwas ändern kann.
//
// DAS VORBILD IST `lib/eigeneKollision.ts:166-207` (`bestandsaussageErlaubt`, `datenlageKeyFuer`,
// `wiederholenSinnvoll`), das dieselben drei Fragen für die Kollisionsauskunft seit JOB 3084 richtig
// beantwortet. Der EINE Unterschied, der die Signaturen erklärt: dort trägt die Lage `pausiert` das
// Offline schon in sich, hier fällt `!online` in die BESTEHENDEN Lagen `veraltet`/`gescheitert` —
// dieselbe Lage entsteht also aus zwei verschiedenen Sachverhalten, und nur der Onlinezustand
// unterscheidet sie. Deshalb ist er Eingang aller drei Funktionen, wie schon bei `forYouLage`.
//
// ES ENTSTEHT KEINE FÜNFTE LAGE: die drei Entscheidungen lesen die vier bestehenden Lagen zusammen
// mit dem Onlinezustand, den `forYouLage` ohnehin schon kennt.
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
  /**
   * Läuft an dieser Quelle GERADE ein Abruf? (react-query `isFetching` — der Erstabruf ebenso wie
   * die Auffrischung.) Sie steht NICHT in `forYouLage`: ein laufender Nachlauf ist keine eigene
   * Lage, er ändert nichts an den Daten, die dastehen. Er ändert nur, ob man JETZT schon etwas
   * über den Bestand BEHAUPTEN darf — s. `auffrischungLaeuft()` und `entwarnungErlaubt()`.
   */
  readonly isFetching?: boolean;
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

/**
 * Dürfen die zuletzt geholten WERTE dastehen (Zeilen, Einträge, Zahl-Pille)? `frisch` und
 * `veraltet` — REGELN §7, erster Satz: eine gescheiterte oder ruhende Auffrischung leert nichts.
 *
 * DIESE FUNKTION TRÄGT SEIT JOB 3118 NICHT MEHR DIE VERNEINUNG. Dass „hier stehen die alten Werte"
 * und „hier steht, dass es nichts gibt" an einem einzigen Merkmal hingen, WAR der Fehler; die
 * Verneinung beantwortet `entwarnungErlaubt()` unten.
 */
export function zeigtBestand(lage: ForYouLage): boolean {
  return lage === "frisch" || lage === "veraltet";
}

// ------------------------------------------------------------------------------------------------
// Die drei Entscheidungen der Karte (JOB 3118 · Q6e) — DOM-frei, für beide Karten dieselben
// ------------------------------------------------------------------------------------------------

/**
 * Läuft an irgendeiner Quelle der Karte gerade ein Abruf?
 *
 * BENS BEFUND AN RUNDE 1 (Korrekturpflicht 1), gemessen: leerer Erstabruf, danach ein hängender
 * Nachlauf — `fetchStatus: "fetching"` bestätigt — und die Karte schrieb weiter „Nichts offen."
 * bzw. „Noch nichts erfasst.". Die Zeile „Cache + laufende Auffrischung → keine Verneinung" aus §9
 * des Auftrags fehlte. `forYouLage` kann sie nicht tragen: mit Daten und ohne Störung ist die Lage
 * `frisch`, und ein laufender Nachlauf ist KEINE fünfte Lage (Auftrag §10) — er nimmt der Anzeige
 * nichts weg, er nimmt ihr nur das Recht auf die Behauptung.
 */
export function auffrischungLaeuft(quellen: readonly ForYouQuelle[]): boolean {
  return quellen.some((q) => q.isFetching === true);
}

/**
 * DIE DREI EINGÄNGE JEDER ANZEIGEENTSCHEIDUNG — als benanntes Bündel, nicht als drei Wahrheitswerte
 * in einer Reihe.
 *
 * RUNDE 3, aus Bens Befund gelernt: der laufende Abruf war in Runde 2 nur bei EINER der drei Fragen
 * angekommen. Genau so entsteht dieser Fehler — jede Runde ein Eingang mehr, und irgendwo bleibt
 * eine Frage zurück. Das Bündel macht daraus einen Griff: die Karte baut es EINMAL und reicht es an
 * alle drei. Wer einen vierten Eingang ergänzt, ergänzt ihn hier und sieht sofort jede Stelle, die
 * ihn lesen müsste; und `datenlageKey(kartenlage, hatStand)` kann seine zwei Angaben nicht mehr
 * lautlos vertauschen, weil sie verschiedene Typen haben.
 */
export interface Kartenlage {
  readonly lage: ForYouLage;
  /** Onlinezustand des Geräts (`lib/netzzustand.ts`). */
  readonly online: boolean;
  /** `auffrischungLaeuft()` über DIESELBEN Quellen, aus denen `lage` stammt. */
  readonly auffrischung: boolean;
}

/**
 * Darf eine VERNEINUNG des Bestands stehen („Nichts offen.", „Noch nichts erfasst.")?
 *
 * Nur aus `frisch`, genau wie `bestandsaussageErlaubt()` im Vorbild (`lib/eigeneKollision.ts:166`).
 * Eine Verneinung ist eine Tatsachenaussage über JETZT; ein Zwischenspeicher von vorhin trägt sie
 * nicht — und ein Abruf, der gerade läuft, ist die ausdrückliche Auskunft, dass der Stand von
 * vorhin nicht mehr für JETZT einsteht. Dieselbe Trennung wie im Vorbild, wo `auffrischung_laeuft`
 * eine eigene Lage ist und `bestandsaussageErlaubt()` dort falsch liefert
 * (`lib/eigeneKollision.ts:166-168`).
 *
 * WARUM `online` TROTZDEM DASTEHT, obwohl `forYouLage(quellen, online)` bei `!online` nie `frisch`
 * liefert: die Zusage „ohne Netz keine Verneinung" hängt sonst an einer Herleitung durch eine
 * ZWEITE Funktion. Sie ist hier ausgesprochen und in `tests/kollision-netztrennung/…` einzeln
 * geprüft, statt aus dem Zusammenspiel zu folgen.
 */
export function entwarnungErlaubt(k: Kartenlage): boolean {
  return k.online && !k.auffrischung && k.lage === "frisch";
}

/**
 * Welcher Satz beschreibt die Datenlage ehrlich — oder keiner?
 *
 * `frisch` und `laedt` tragen keinen: dort steht die Sache selbst bzw. ausdrücklich nichts (§9).
 * OHNE NETZ gibt es keinen gescheiterten Versuch, den man melden könnte: die Abfrage ruht. Dann
 * sagt der Satz nur, dass gerade nicht geprüft werden kann — mit sichtbarem Stand „Stand von
 * zuletzt", ohne ihn der Satz ohne Stand. Die Begründung dafür steht wortgleich in
 * `lib/eigeneKollision.ts:180-198`: wer beim kalten Offline-Einstieg „Stand von zuletzt" schreibt,
 * behauptet einen Stand, den es nie gab.
 *
 * WÄHREND EIN ABRUF LÄUFT, steht hier NICHTS (Bens Korrekturpflicht 1 aus Runde 2, gemessen:
 * Bestand laden, Auffrischung scheitert, Wiederholen klicken, Antwort verzögern — die Karte schrieb
 * weiter „Veraltet – Aktualisierung fehlgeschlagen"). Das ist ein Satz über den LETZTEN Versuch,
 * während der nächste schon unterwegs ist; §9 sagt für diese Zeile ausdrücklich „nichts".
 *
 * `gescheitert` MIT Netz trägt hier bewusst keinen Satz: dort steht die Störung als
 * Wiederholen-Knopf (§9, „Störung sichtbar"), und eine Knopfbeschriftung ist kein Erklärtext.
 *
 * @param hatStand Stehen wirklich Werte von vorhin auf der Karte? Nicht „es gab mal einen Abruf":
 *   eine leer geladene Karte zeigt nichts, und „Stand von zuletzt" wäre dort ein Verweis auf einen
 *   Stand, den der Mensch nirgends sieht.
 */
export function datenlageKey(k: Kartenlage, hatStand: boolean): string | null {
  if (k.lage === "frisch" || k.lage === "laedt") {
    return null;
  }
  if (!k.online) {
    // Vor der Auffrischungsfrage: ohne Netz RUHT jeder Abruf (`fetchStatus: "paused"`, nicht
    // `"fetching"`), und der Offline-Satz ist die stärkere Auskunft — er sagt, warum nichts geht.
    return hatStand ? "kollision.lage.pausiert" : "kollision.lage.pausiertOhneStand";
  }
  if (k.auffrischung) {
    return null;
  }
  return k.lage === "veraltet" ? "loadstate.stale" : null;
}

/**
 * Kann ein Versuch JETZT etwas ändern? Nur dann wird ein Knopf angeboten.
 *
 * Ohne Netz scheitert jeder Versuch, solange das Netz fehlt; bei `laedt` und WÄHREND EINES
 * LAUFENDEN ABRUFS läuft bereits einer — §9, „nein (läuft schon)". Der zweite Halbsatz ist Bens
 * Korrekturpflicht 1 aus Runde 2: nach einem Fehlschlag blieb der Knopf während der von ihm
 * ausgelösten Wiederholung stehen und lud zum zweiten Klick ein, der nichts hinzufügt. Ein Knopf,
 * der nichts bewirkt, wäre eine Scheinfunktion (REGELN §7) — dieselbe Entscheidung wie
 * `lib/eigeneKollision.ts:205-207`.
 */
export function wiederholenSinnvoll(k: Kartenlage): boolean {
  return k.online && !k.auffrischung && (k.lage === "gescheitert" || k.lage === "veraltet");
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
