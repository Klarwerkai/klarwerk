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

/**
 * JOB 4357 · DER SCHLÜSSEL DER BESTANDSLISTE — bewusst NICHT unter `anweisungSchluessel`.
 *
 * `anweisungSchluessel(id)` ist `["gesamtanweisung", id]`, und `invalidateQueries` arbeitet über
 * PRÄFIXE. Läge die Liste unter `["gesamtanweisung", …]`, würde jede Mutation an EINER Anweisung
 * auch sie für ungültig erklären — und umgekehrt könnte ein Präfix über die Liste eines Tages die
 * Lesestände mitreissen. Zwei Gegenstände, zwei Wurzeln.
 */
export function anweisungslisteSchluessel(): readonly unknown[] {
  return ["gesamtanweisungen"];
}

/**
 * Der gespeicherte Bestand — die eine Abfrage, die keine Kennung braucht.
 *
 * ================================================================================================
 * RUNDE 4 · HIER STAND EIN SATZ, DEN BEN WIDERLEGT HAT — ER IST ERSETZT, NICHT ERGÄNZT.
 * ================================================================================================
 *
 * Bis Runde 3 stand hier: „SIE WIRD NICHT NACH EINER MUTATION FÜR UNGÜLTIG ERKLÄRT … die Liste ist
 * in diesem Augenblick nicht mehr gezeichnet; react-query holt sie beim nächsten Aufbau des Bereichs
 * ohnehin neu." Der zweite Halbsatz war eine ANNAHME und ist falsch.
 *
 * BEN HAT ES GEMESSEN (Cloud-Auftrag 223078d8e968459f9f0b25d0bf34de18, unverändertes Produkt, am
 * betrieblichen `staleTime`): leere Liste → bestätigte Anlage → sofortige Rückkehr → „Eintrag fehlt,
 * Leersatz bleibt", Ausgabe `BEN_CACHE: gespeichert=true, Listenabrufe=1`. Der Grund steht in
 * `main.tsx:44`: der Betrieb fährt `staleTime: ZAEHLER_FRISCHE_MS` (30 s). Ein ABBAU der Abfrage
 * löscht ihren Eintrag nicht — er bleibt bis `gcTime` im Zwischenspeicher, und beim nächsten Aufbau
 * gilt er noch als FRISCH. React-query holt dann gar nichts, sondern zeichnet den alten, leeren
 * Bestand.
 *
 * DAS IST DIE TEUERSTE LAGE DIESER GANZEN LIEFERUNG, und zwar genau umgekehrt zu dem, wogegen der
 * Leersatz gebaut ist: der Mensch hat gerade gespeichert, bekommt „Es ist bisher nichts gespeichert"
 * zu lesen — und legt dieselbe Anweisung ein zweites Mal an. Ein Satz, der aus einer BELEGTEN
 * Antwort stammt, wird hier durch einen VERALTETEN Beleg zur Unwahrheit.
 *
 * DIE ANTWORT IST DIE INVALIDIERUNG AN DER MUTATION, nicht ein kürzeres `staleTime` an dieser
 * Abfrage: eine eigene Frist hier wäre eine zweite Auslegung von „wie frisch muss es sein" neben der
 * einen Hausregel in `main.tsx` — und sie würde das Loch nur verkleinern, nicht schliessen (innerhalb
 * der Frist bliebe der falsche Leersatz stehen). `invalidateQueries` sagt dagegen genau das
 * Zutreffende: dieser Bestand ist durch einen Schreibvorgang überholt.
 */
export function useAnweisungsListe() {
  return useQuery({
    queryKey: anweisungslisteSchluessel(),
    queryFn: () => endpoints.gesamtanweisung.list(),
  });
}

/**
 * Den gespeicherten Bestand für überholt erklären — die EINE Stelle dafür.
 *
 * Sie steht hier und nicht dreimal abgeschrieben in den Mutationen: wer den Schlüssel einmal falsch
 * tippt, bekommt keinen Fehler, sondern einen Aufruf ohne Wirkung — und genau der fiele niemandem
 * auf, weil die Liste danach ja trotzdem irgendwann neu lädt.
 *
 * `refetchType: "all"` und nicht die Vorgabe `"active"`: der Fall, um den es geht, ist die Liste,
 * die gerade ABGEBAUT wird (die Fläche springt im selben Augenblick auf die neue Anweisung). Eine
 * Invalidierung, die nur AKTIVE Abfragen anfasst, liesse genau diesen Eintrag als „frisch" stehen —
 * das wäre die Reparatur, die den gemessenen Fall nicht trifft.
 */
function entwerteBestand(client: ReturnType<typeof useQueryClient>): void {
  void client.invalidateQueries({ queryKey: anweisungslisteSchluessel(), refetchType: "all" });
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
 *
 * SIE ENTWERTET DEN BESTAND (JOB 4357 R4): sie ist die einzige Mutation, die eine Anweisung
 * HINZUFÜGT. Ohne diesen Schritt zeigt die Liste nach der Rückkehr den Stand von davor — gemessen,
 * Begründung bei `useAnweisungsListe`.
 */
export function useAnweisungAnlegen() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ titel }: { titel: string }) => endpoints.gesamtanweisung.create({ titel }),
    onSuccess: () => {
      entwerteBestand(client);
    },
  });
}

/**
 * Jede Mutation an EINER Anweisung — Lesestand UND Bestandsliste werden überholt.
 *
 * WARUM AUCH DIE LISTE, obwohl keine dieser Mutationen eine Anweisung hinzufügt oder entfernt: jede
 * von ihnen ändert Felder, die in der Liste STEHEN. `vorlegen` und `entscheiden` ändern den `stand`,
 * `bausteinAufnehmen` ändert die Zahl der sichtbaren Bausteine, und ALLE ändern `version` und
 * `geaendertAm` — letzteres ist zugleich die Reihenfolge der Liste und ihre Standzeile
 * (`GesamtanweisungBereich`, `juengsteAenderung`). Ohne diesen Schritt zeigte die Liste nach dem
 * Zurückgehen „Entwurf", wo der Mensch gerade „Vorgelegt" gemacht hat — dieselbe Klasse Unwahrheit
 * wie der falsche Leersatz, nur leiser (BENs Korrekturpflicht 2, zweiter Satz: „Statusänderungen
 * entsprechend absichern").
 *
 * ZWEI AUFRUFE UND KEIN GEMEINSAMES PRÄFIX: die beiden Schlüsselwurzeln sind bewusst getrennt
 * (Begründung an `anweisungslisteSchluessel`). Sie hier zusammenzuziehen hiesse, die Trennung wieder
 * aufzugeben, um einen Aufruf zu sparen.
 */
function useAnweisungsMutation<TEingabe>(
  id: string | null,
  lauf: (eingabe: TEingabe) => Promise<Anweisung>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: lauf,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: anweisungSchluessel(id ?? "") });
      entwerteBestand(client);
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
