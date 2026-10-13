// produkt:20261008:klara-eigeninitiative — der Drahtvertrag des persönlichen Unterstützungsmodus
// (Spiegel von `services/app/src/routes/assistenz-profil-routes.ts`). Das Konto bestimmt allein die
// Sitzung; der Client schickt nie eine Kontokennung mit.
import { api } from "./client";

export type EigeninitiativeModus = "nachfrage" | "hinweise" | "auftraege";

export const EIGENINITIATIVE_MODI: readonly EigeninitiativeModus[] = [
  "nachfrage",
  "hinweise",
  "auftraege",
];

export type HinweisAblageStand = "geschlossen" | "zurueckgestellt";

export interface HinweisAblage {
  schluessel: string;
  stand: HinweisAblageStand;
  /** Bis dahin bietet die Assistenz diesen Hinweis nicht erneut an. */
  bis: string;
}

export interface EigeninitiativeAntwort {
  modus: EigeninitiativeModus;
  /** `false`: nie bewusst gewählt — es gilt die Vorgabe „Nur auf Nachfrage". */
  gewaehlt: boolean;
  geaendertAm: string | null;
  hinweise: HinweisAblage[];
}

export const eigeninitiativeApi = {
  lesen: (): Promise<EigeninitiativeAntwort> =>
    api.get<EigeninitiativeAntwort>("/me/assistenz/eigeninitiative"),
  modus: (modus: EigeninitiativeModus): Promise<EigeninitiativeAntwort> =>
    api.put<EigeninitiativeAntwort>("/me/assistenz/eigeninitiative", { modus }),
  hinweisAblegen: (
    schluessel: string,
    stand: HinweisAblageStand,
  ): Promise<EigeninitiativeAntwort> =>
    api.post<EigeninitiativeAntwort>("/me/assistenz/eigeninitiative/hinweise", {
      schluessel,
      stand,
    }),
};
