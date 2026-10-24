/** Ausschließlich serverseitiger D→G-Port. Quelltext und Browserfelder erteilen keine Befugnis. */
export interface KlaraDNormAuftragsEingabe {
  readonly kontoId: string;
  /** D bindet diesen eigenen Eingang vor dem G-Aufruf per bestehendem Norm-Ereignis-CAS. */
  readonly gespraechId: string;
  readonly erinnerungId: string;
  readonly erinnerungFassung: number;
  readonly routineFassung: number;
  readonly normId: string;
  readonly ereignisId: string;
  /** Bestehender stabiler Sachvorgang; keine neue Identität je Lauf, Kopie oder Zustellversuch. */
  readonly pruefVorgang: string;
  /** Wirklich gespeicherter eigener D-Bericht, kein fingierter menschlicher Gesprächsbeitrag. */
  readonly notiz: { readonly id: string; readonly fassung: number };
  readonly titel: string;
}
