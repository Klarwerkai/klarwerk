/** Herkunft des tatsächlich berechtigt gelesenen Originals, kein zweiter Quellenbestand. */
interface Notizbindung {
  readonly id: string;
  readonly fassung: number;
  readonly titel: string;
}

export type KlaraAuftragsnotiz = Notizbindung &
  (
    | { readonly weg?: "gespraech"; readonly gespraechId: string; readonly nachrichtId: string }
    | { readonly weg: "geschrieben"; readonly gespraechId?: never; readonly nachrichtId?: never }
  );
