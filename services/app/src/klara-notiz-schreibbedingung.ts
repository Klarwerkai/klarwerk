/**
 * Eine zusätzliche Bedingung, unter der eine Notiz geschrieben werden darf — für Notizen, die eine
 * andere Steuerung als WIRKUNG anlegt (produkt:20261007:klara-erinnerungen-kalender, EQF-07: der
 * Routinenbericht darf nur entstehen, solange Routine, Konto und gelesene Quellen gelten). Die
 * Notizablage kennt deren Inhalt nicht: Speicher prüft `gilt` unmittelbar und synchron vor dem
 * Schreiben, PostgreSQL hängt `sql` in DENSELBEN Befehl.
 */
export interface NotizSchreibbedingung {
  readonly gilt?: () => boolean;
  /** `start`: der nächste freie Parameterindex (`$start`). */
  readonly sql?: (start: number) => { und: readonly string[]; params: readonly unknown[] };
}
