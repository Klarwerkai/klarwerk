// ==================================================================================================
// JOB 4154 · DIE ABFRAGEN DIESES BEREICHS — HIER UND NICHT IN `api/hooks.ts`.
// ==================================================================================================
//
// `apps/web/src/api/hooks.ts` ist Zielpfad von JOB 4153. Zwei Bahnen an derselben Produktdatei sind
// verboten (Nacht 02./03.09.). Es entsteht dabei KEIN zweiter Client: gerufen wird
// `endpoints.gesamtanweisung` aus dem geteilten Katalog, also derselbe Fetch-Weg mit
// Sitzungs-Cookie, Sprachkopf und `ApiError`-Abbildung wie überall. Dasselbe Vorgehen und derselbe
// Grund wie in `components/sharepoint-import/api.ts:1-12`.
//
// JEDE MUTATION MACHT DEN LESESTAND UNGÜLTIG, und das ist kein Komfort: der Server erhöht bei jedem
// Schreibvorgang die Version, und wer danach mit der alten weiterarbeitet, bekommt 409. Die
// Oberfläche würde dann grundlos scheitern, obwohl sie den neuen Stand längst hätte holen können.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endpoints } from "../../api/endpoints";
import type { Anweisung } from "../../api/types";

/** Der Schlüsselstamm dieses Bereichs. Eine Stelle, damit kein Aufruf danebengreift. */
export function anweisungSchluessel(id: string): readonly unknown[] {
  return ["gesamtanweisung", id];
}

export function useAnweisung(id: string | null) {
  return useQuery({
    queryKey: anweisungSchluessel(id ?? ""),
    queryFn: () => endpoints.gesamtanweisung.get(id ?? ""),
    enabled: id !== null,
  });
}

export function useAnweisungStaende(id: string | null) {
  return useQuery({
    queryKey: [...anweisungSchluessel(id ?? ""), "staende"],
    queryFn: () => endpoints.gesamtanweisung.staende(id ?? ""),
    enabled: id !== null,
  });
}

/**
 * Der Vergleich zweier Stände.
 *
 * `enabled` erst, wenn BEIDE Stände gewählt sind. Ein Vergleich gegen einen leeren zweiten Stand
 * wäre eine Aussage ohne Gegenstück — und der Auftrag verbietet ausdrücklich, aus einer nicht
 * geführten Prüfung eine Gleichheitsaussage zu machen.
 */
export function useAnweisungVergleich(id: string | null, von: number | null, bis: number | null) {
  return useQuery({
    queryKey: [...anweisungSchluessel(id ?? ""), "vergleich", von, bis],
    queryFn: () => endpoints.gesamtanweisung.vergleich(id ?? "", von ?? 0, bis ?? 0),
    enabled: id !== null && von !== null && bis !== null,
  });
}

/**
 * JOB 4156 · DIE ERSTANLAGE — die einzige Mutation dieses Bereichs OHNE Kennung.
 *
 * Sie läuft deshalb nicht über `useAnweisungsMutation`: es gibt vor dem Erfolg keinen Lesestand,
 * den man ungültig machen könnte. Der Aufrufer bekommt die angelegte Anweisung zurück und geht mit
 * ihrer Kennung auf die Seite — der Lesestand entsteht dort zum ersten Mal.
 *
 * NUR DER TITEL: `anweisungAnlegen` (`gesamtanweisung-service.ts`) verlangt genau ihn als
 * Pflichtangabe; Zweck, Geltungsbereich und Voraussetzungen sind Freitext und bleiben leer, bis
 * jemand sie setzt. Ein vorbelegter Zweck wäre ein Satz, den niemand geschrieben hat.
 */
export function useAnweisungAnlegen() {
  return useMutation({
    mutationFn: ({ titel }: { titel: string }) => endpoints.gesamtanweisung.create({ titel }),
  });
}

function useAnweisungsMutation<TEingabe>(
  id: string | null,
  lauf: (eingabe: TEingabe) => Promise<Anweisung>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: lauf,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: anweisungSchluessel(id ?? "") });
    },
  });
}

// KEIN `useKopfAendern`: Titel, Zweck, Geltungsbereich und Voraussetzungen der Anweisung werden in
// DIESER Lieferung beim Anlegen gesetzt; ihre Bearbeitung steht nicht in den Pflichtlieferungen
// (Auftrag 5.5 nennt Aufnahme, Reihenfolge/Voraussetzungen, Lesestand, Vergleich, Vorlage). Der
// Endpunkt `updateKopf` ist im Drahtkatalog vorhanden und getestet (F8) — ein Hook ohne Bedienung
// wäre genau der Baustein, der gebaut wird und nie gerufen (`tests/capture/aufrufer-waechter`).
export function useBausteinAufnehmen(id: string | null) {
  return useAnweisungsMutation(
    id,
    ({
      version,
      koId,
      koVersion,
      nachweisHash,
    }: {
      version: number;
      koId: string;
      koVersion: number;
      nachweisHash: string | null;
    }) =>
      endpoints.gesamtanweisung.addBaustein(id ?? "", version, { koId, koVersion, nachweisHash }),
  );
}

export function useReihenfolgeSetzen(id: string | null) {
  return useAnweisungsMutation(
    id,
    ({ version, reihenfolge }: { version: number; reihenfolge: string[] }) =>
      endpoints.gesamtanweisung.setReihenfolge(id ?? "", version, reihenfolge),
  );
}

export function useVoraussetzungSetzen(id: string | null) {
  return useAnweisungsMutation(
    id,
    ({
      version,
      bausteinId,
      voraussetzung,
    }: { version: number; bausteinId: string; voraussetzung: string | null }) =>
      endpoints.gesamtanweisung.setVoraussetzung(id ?? "", version, bausteinId, voraussetzung),
  );
}

export function useVorlegen(id: string | null) {
  return useAnweisungsMutation(id, ({ version }: { version: number }) =>
    endpoints.gesamtanweisung.vorlegen(id ?? "", version),
  );
}

export function useEntscheiden(id: string | null) {
  return useAnweisungsMutation(
    id,
    ({ version, entscheidung }: { version: number; entscheidung: "angenommen" | "abgelehnt" }) =>
      endpoints.gesamtanweisung.entscheiden(id ?? "", version, entscheidung),
  );
}
