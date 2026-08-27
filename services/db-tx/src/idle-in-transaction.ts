// ================================================================================================
// JOB 2363 D1 — I10 PUNKT 2: WAS NACH EINEM KONSOLENABBRUCH ZU TUN IST.
// ================================================================================================
//
// DIE REGEL, woertlich aus der Ursprungsakte `PAPIERKORB-AUFRAEUMEN-26072026.md:58`:
//
//   „Pruefung nach jedem Abbruch. Bricht eine Datenbankkonsole ab, verliert die Verbindung oder
//    gibt eine neue Shell aus, wird ZUERST geprueft, ob eine Sitzung offen haengt, bevor etwas
//    Neues gestartet wird … Steht dort eine Zeile, wird sie mit
//    `select pg_terminate_backend(<pid>);` beendet und das Ergebnis protokolliert. Erst danach
//    beginnt der naechste Versuch."
//
// WAS DIESES MODUL IST — und was es ausdruecklich NICHT ist.
// Es ist ein ENTSCHEIDUNGSHELFER: es formuliert den Pruefbefehl und beurteilt sein Ergebnis. Es
// oeffnet KEINE Verbindung, fuehrt NICHTS aus und beendet NICHTS. Das Beenden einer fremden
// Sitzung ist ein Eingriff in laufenden Betrieb; er bleibt bei dem Menschen, der die Konsole in
// der Hand hat. Dieses Modul nimmt ihm nur das Raten ab.
//
// WARUM DAS RATEN DAS PROBLEM WAR. `pg_stat_activity.state` kennt Zustaende, die einander zum
// Verwechseln aehnlich sehen und entgegengesetzt behandelt werden muessen:
//
//   `idle in transaction`  — offene Transaktion, wartet auf Eingabe. HAELT IHRE SPERREN.
//                            Das ist der Fall, den die Regel meint: beenden.
//   `idle`                 — ruhende Verbindung OHNE Transaktion. Haelt nichts. Wer sie beendet,
//                            wirft eine gesunde Verbindung weg und hat nichts gewonnen.
//   `active`               — arbeitet gerade. Sie zu beenden hiesse, laufende Arbeit
//                            abzuschneiden — auch nach 900 Sekunden. Hier gilt: warten.
//   `idle in transaction (aborted)` — eigener Zustand, die Transaktion ist bereits gescheitert.
//                            Deshalb wird der Zustand EXAKT verglichen und nicht per Teilstring:
//                            ein `includes("idle in transaction")` griffe diesen Fall mit ab.
//
// Ein Timeout, das der naechste Versuch von einer haengenden Vorgaengersitzung erbt, sieht aus wie
// ein Fehler des neuen Versuchs und ist keiner. Genau diese Fehlzuordnung schliesst die Regel.
//
// DIE ZUSICHERUNGEN stehen in `idle-in-transaction.test.ts` als P1–P7 und K1–K5. Sie sind aus
// `RUECKGABE-PRO-JOB-678-D3-KORREKTUR.md:133-160` uebernommen, wo sie mit vier Gegenmutationen
// gemessen wurden.
//
// KEINE IMPORTZEILE — und das ist gepinnt (P7b). Ohne Import kann hier weder `pg` noch
// `node:child_process` hereinkommen; die Reinheit ist damit an der Struktur belegt und nicht an
// einer Zusage im Kommentar.
// ================================================================================================

/**
 * Der Zustand, den die Regel meint. EXAKT dieser — siehe Kopfkommentar zu
 * `idle in transaction (aborted)`.
 */
export const ZUSTAND_HAENGT = "idle in transaction";

/** Eine arbeitende Sitzung. Sie wird nicht beendet, sondern abgewartet. */
export const ZUSTAND_ARBEITET = "active";

/** Eine Zeile aus `pg_stat_activity`, in genau den Spalten, die `pruefbefehl()` anfordert. */
export interface PgAktivitaetszeile {
  readonly pid: number;
  readonly state: string;
  /**
   * `now() - xact_start` in Sekunden. Das SQL liefert ein Intervall; die Umrechnung geschieht
   * beim Ablesen, damit dieses Modul ohne Datums- oder Datenbankabhaengigkeit auskommt.
   */
  readonly offenSekunden: number;
  readonly query: string;
}

/** Was zu tun ist. Genau drei Lagen — jede andere Antwort waere geraten. */
export type Handlung = "beenden" | "warten" | "frei";

export interface Abbruchbefund {
  readonly handeln: Handlung;
  /** Bei `beenden`: die betroffenen PIDs, laengste offene Transaktion zuerst. Sonst leer. */
  readonly pids: readonly number[];
  /** Zu jeder PID der fertige Befehl, in derselben Reihenfolge. Sonst leer. */
  readonly befehle: readonly string[];
  /** Klartext fuer das Protokoll, das die Regel verlangt („und das Ergebnis protokolliert"). */
  readonly begruendung: string;
}

/**
 * Der Pruefbefehl aus der Regel, unveraendert.
 *
 * EIN einziger `psql -c`-Aufruf — das ist nicht Formatierung, sondern Punkt 1 derselben Regel:
 * „Eine Transaktion, die auf eine Eingabe wartet, wird nicht geoeffnet." Eine Pruefung, die selbst
 * eine interaktive Sitzung aufmacht, waere der Fehler, den sie sucht.
 *
 * `order by xact_start` gehoert dazu: ohne die Sortierung ist „laengste zuerst" schon an der
 * Quelle verloren.
 */
export function pruefbefehl(): string {
  return `psql -c "select pid, state, now() - xact_start as offen, query from pg_stat_activity where state = '${ZUSTAND_HAENGT}' order by xact_start;"`;
}

/** Der Befehl aus der Regel, als vollstaendige abgeschlossene Anweisung. */
export function beendigungsbefehl(pid: number): string {
  return `select pg_terminate_backend(${pid});`;
}

/**
 * Beurteilt das Ergebnis des Pruefbefehls.
 *
 * REIHENFOLGE DER LAGEN, und warum sie so ist:
 *
 *  1. Haengt mindestens eine Sitzung, ist das die Antwort — auch wenn daneben etwas arbeitet.
 *     Die haengende haelt die Sperre, an der die arbeitende sonst als Naechstes auflaeuft. Wer
 *     hier „warten" antwortete, liesse genau die Blockade stehen, die er aufloesen soll.
 *  2. Arbeitet etwas und haengt nichts, wird gewartet. Es gibt nichts zu beenden.
 *  3. Sonst ist der Weg frei.
 *
 * Die Funktion ist rein: sie liest die Eingabe, veraendert sie nicht und fuehrt nichts aus.
 */
export function bewerte(zeilen: readonly PgAktivitaetszeile[]): Abbruchbefund {
  // `[...]` vor `sort`, weil `sort` an Ort und Stelle sortiert — die Eingabe des Aufrufers bleibt
  // dadurch unangetastet (P7).
  const haengend = [...zeilen]
    .filter((z) => z.state === ZUSTAND_HAENGT)
    .sort((a, b) => b.offenSekunden - a.offenSekunden);

  if (haengend.length > 0) {
    const pids = haengend.map((z) => z.pid);
    const laengste = haengend[0];
    return {
      handeln: "beenden",
      pids,
      befehle: pids.map(beendigungsbefehl),
      begruendung: `${haengend.length} Sitzung(en) im Zustand '${ZUSTAND_HAENGT}': PID ${pids.join(", ")} — laengste offen seit ${laengste?.offenSekunden ?? 0} s. Sie halten ihre Sperren; erst beenden und protokollieren, dann neu starten.`,
    };
  }

  if (zeilen.some((z) => z.state === ZUSTAND_ARBEITET)) {
    return {
      handeln: "warten",
      pids: [],
      befehle: [],
      begruendung: `Keine Sitzung im Zustand '${ZUSTAND_HAENGT}', aber mindestens eine im Zustand '${ZUSTAND_ARBEITET}'. Eine arbeitende Sitzung wird nicht beendet — abwarten und danach erneut pruefen.`,
    };
  }

  return {
    handeln: "frei",
    pids: [],
    befehle: [],
    begruendung: `Keine Sitzung im Zustand '${ZUSTAND_HAENGT}' und keine arbeitende Sitzung. Der naechste Versuch kann beginnen.`,
  };
}
