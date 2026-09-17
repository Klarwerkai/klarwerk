// ================================================================================================
// JOB 4086 — DER WEG AUF DER OBERFLÄCHE: AUSWÄHLEN → ABRUFEN → IMPORTIEREN.
// ================================================================================================
//
// Bis hierher stand SharePoint im Importkatalog als „geplant" — eine Kachel ohne Weg dahinter.
// Dieser Bereich IST der Weg: Er zeigt die Dateien, auf die das hinterlegte Konto Rechte hat, lässt
// eine Auswahl treffen und stellt sie in die vorhandene Prüf-Warteschlange.
//
// ================================================================================================
// KEIN ZWEITER IMPORTRAHMEN. KEIN ZWEITER STEPPER. KEIN ZWEITER KATALOG.
// ================================================================================================
//
// Dieser Bereich hängt in `ImportReview` (`pages/Stufe2.tsx`) — derselben Seite, auf der auch der
// Confluence-Weg, der JSON-Upload und die Prüf-Warteschlange liegen. Er baut KEINE eigene
// Schrittleiste: die geführte Linie gehört dem Confluence-/JSON-Fluss im Cockpit, und eine zweite
// daneben wäre eine zweite Erzählung über dieselbe Seite. Was hier entsteht, endet in DERSELBEN
// Warteschlange darunter — und der Ergebnistext sagt das ausdrücklich, damit niemand glaubt, mit
// dem Import sei die Sache schon im Bestand.
//
// ================================================================================================
// DAS ZUSTANDSMODELL — JEDE ANGEZEIGTE AUSSAGE HÄNGT AN IHRER VORAUSSETZUNG.
// ================================================================================================
//
//   ROLLE OHNE users.manage  → der Bereich wird GAR NICHT angeboten. Kein 403-Rauschen, dieselbe
//                              Regel wie beim Confluence-Zugangskasten.
//   ZUGANG UNBEKANNT         → nichts. Eine Fläche, die „unbekannt" anzeigt, ist für jemanden, der
//                              ohnehin nichts daran ändern kann, nur Rauschen.
//   ZUGANG NICHT ABRUFBAR    → (JOB 4125) der übersetzte Satz aus `fehlerlagen.ts` UND ein erreich-
//                              barer erneuter Versuch. Vorher verschwand hier der ganze Bereich —
//                              das sah aus wie „diesen Import gibt es nicht" und war eine Sackgasse.
//   ZUGANG NICHT BENUTZBAR   → NUR die Zugangskarte. Kein Abrufversuch, kein 503 als Bedienweg —
//                              die Auskunft trägt das Bild, BEVOR irgendetwas versucht wird.
//   LADEN                    → Ladezustand. KEINE Aussage über Anzahl oder Rechte; „keine Dateien"
//                              wird nie während des Ladens behauptet.
//   ERFOLGREICH LEER         → „hier liegt nichts, was du sehen darfst" — eine Aussage über das
//                              FRISCHE Ergebnis, nicht über die Bibliothek an sich.
//   FEHLER                   → EIN Satz aus den vier Lagen, in der Sprache der Oberfläche. KEINE
//                              Zahl, KEIN Code — und ausdrücklich KEINE Dateiliste daneben.
//   AUFFRISCHUNG LÄUFT       → die vorhandene Liste bleibt sichtbar und ist als NICHT FRISCH
//                              gekennzeichnet. Sie wird nicht als aktueller Stand ausgegeben.
//   AUFFRISCHUNG GESCHEITERT → der Fehlersatz gilt, und die alte Liste verliert ihre
//                              Gültigkeitsaussage — sie verschwindet. EINE GECACHTE LISTE IST KEIN
//                              ERFOLGREICHES NACHLESEN (Korrekturpflicht aus JOB 4075 R1). Genau
//                              dafür steht `liste.isError` VOR `liste.data` in der Verzweigung
//                              unten; react-query hält die alten Daten nämlich fest.
//   OFFLINE                  → ZWEI Gestalten, und bis JOB 4232 R4 kannte diese Fläche nur die
//                              erste: (a) der Abruf LÄUFT und scheitert — ein Fehler ohne deutbaren
//                              Code, der auf „Verbindung abgelaufen oder nicht erreichbar" fällt;
//                              (b) der Abruf läuft GAR NICHT, react-query hält ihn auf `paused` und
//                              der alte Stand bleibt als `data` liegen. In (b) ist weder `isError`
//                              noch `isFetching` wahr — deshalb wird `fetchStatus` ausdrücklich
//                              gelesen (s. `probePausiert`). In BEIDEN wird NICHTS über den Bestand
//                              in SharePoint behauptet und nichts übernommen.
//
// ================================================================================================
// JOB 4232 — DIE NEUE AUSSAGE „INHALT ODER NUR MERKMALE" UND WORAN SIE HÄNGT.
// ================================================================================================
//
// Sie steht je Dateizeile INNERHALB des `liste.data`-Zweigs, und das ist keine Platzierung, sondern
// die Zusage selbst: Sie erbt damit jeden Zustand der Liste, ohne ihn ein zweites Mal auslegen zu
// müssen.
//
//   LADEN                    → keine Liste, also auch keine Inhaltsaussage. Weder „Inhalt" noch
//                              „nur Merkmale" steht da, solange die Messung läuft.
//   ERFOLGREICH LEER         → eine Datei, deren Inhalt nachweislich leer ist, heisst „leer" —
//                              nicht „übernommen" und nicht „nur Merkmale". Dritter Fall, dritter
//                              Satz (`imp.sharepoint.vorschau.leer`).
//   AUFFRISCHUNG LÄUFT       → die Liste ist als NICHT FRISCH gekennzeichnet; aus ihr wird KEINE
//                              neue Zusage abgeleitet, sie bleibt der Stand von vorhin.
//   AUFFRISCHUNG GESCHEITERT → `liste.isError` steht VOR `liste.data`: die Liste verschwindet, und
//                              mit ihr jede Inhaltszusage. Eine gecachte Zeile ist kein
//                              erfolgreiches Nachlesen — es gibt hier also keine Zusage, die einen
//                              gescheiterten Abruf überlebt.
//   FEHLER / OFFLINE         → ein Satz aus den vier Lagen, und die Inhaltsaussage entfällt GANZ.
//                              Ohne Liste gibt es auch keine Auswahl und keine Annahme.
//   UNBEKANNTER BEFUND       → gar keine Anzeige. „nur Merkmale" wäre hier geraten (s. `satzKey`).
//
// UND NACH DER ÜBERNAHME gilt die MESSUNG, nicht die Vorschau: das Ergebnisbild zeigt je Datei, was
// wirklich ankam, und listet die Dateien, die wegen ihres Inhalts NICHT übernommen wurden, mit dem
// Grund. Die Vorschau ist eine Ankündigung; überschrieben wird sie von dem, was gemessen wurde.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { useRole } from "../../app/RoleContext";
import { formatKoTimestamp } from "../../lib/koDates";
import { Button, Card, SectionLabel } from "../ui";
import { SharePointZugangKarte } from "./SharePointZugangKarte";
import { SHAREPOINT_BEREICH_ANKER } from "./anker";
import { type SharePointUebernahme, sharepointApi } from "./api";
import { sharepointFehlertextKey } from "./fehlerlagen";

/** Der Fehlercode einer Antwort — oder `null`, wenn der Fehler gar nicht vom Server kam. */
function fehlercode(err: unknown): string | null {
  return err instanceof ApiError ? err.code : null;
}

// ================================================================================================
// JOB 4232 — FÜNF BEFUNDE ÜBER DEN INHALT, FÜNF SÄTZE. UND FÜR UNBEKANNTES KEINEN.
// ================================================================================================
//
// DIESELBE BAUFORM WIE `fehlerlagen.ts`: Befund hinein, i18n-Schlüssel heraus — ohne DOM, ohne
// Sprache, übersetzt wird erst dort, wo die Sprache bekannt ist. (Ihr ehrlicher Platz wäre
// `fehlerlagen.ts` neben der Fehlerabbildung; die Datei liegt ausserhalb der Zielpfade dieses
// Auftrags, und ein Diff ausserhalb der Zielpfade ist ungeprüfter Code. Das steht in der Rückgabe.)
//
// WARUM `null` FÜR UNBEKANNTES UND NICHT EIN AUFFANGSATZ: Bei den vier Fehlerlagen ist „die
// Verbindung steht gerade nicht" eine Aussage, die für jeden unbekannten Code WAHR bleibt. Hier gibt
// es keine solche Aussage — wer einen Befund nicht kennt, weiss über den Inhalt GAR NICHTS, und „nur
// Merkmale" wäre dann eine geratene Zusage. Die ehrliche Anzeige ist deshalb KEINE Anzeige.
// DREI ABBILDUNGEN UND NICHT EINE, weil ein Satz nicht in zwei Zeitformen zugleich stehen kann:
// vor der Annahme ist „Inhalt wird übernommen" eine Ankündigung, danach eine Feststellung. Ein
// gemeinsamer Satz für beides wäre an einer der zwei Stellen falsch — und falsch ist hier teurer
// als doppelt.
// ================================================================================================
// JOB 4232 RUNDE 2 — ANKÜNDIGUNG UND MESSWERT SIND ZWEI VERSCHIEDENE SÄTZE (bens Pflicht 2).
// ================================================================================================
//
// DER BEFUND: In Runde 1 stand an einer `text/plain`-Zeile „Inhalt kommt mit", sobald Medientyp und
// Grösse passten. Ben hat den Download mit 403 antworten lassen — die Fläche behauptete weiter
// Inhalt, obwohl nie einer geholt worden war. Eine Zusage ohne Deckung.
//
// AB HIER GILT: Der Satz „Inhalt kommt mit" (`vorschau.text`) fällt NUR noch nach einer WIRKLICH
// erfolgreichen Messung. Solange nur die Merkmale vorliegen, steht die ehrliche Ankündigung da
// („Textdatei — der Inhalt wird beim Import geprüft"). Gemessen wird für die AUSGEWÄHLTEN Dateien,
// vor der Annahme, über denselben lesenden Weg.
const ANKUENDIGUNG_SATZ: Record<string, string> = {
  // Nur diese eine Zeile ist eine Ankündigung: bei `text` steht die Messung noch aus. Die drei
  // anderen Befunde sind an den Merkmalen bereits ENTSCHIEDEN — ein anderer Medientyp bleibt ein
  // anderer, eine 0-Byte-Datei bleibt leer, eine zu grosse bleibt zu gross.
  text: "imp.sharepoint.vorschau.textdatei",
  leer: "imp.sharepoint.vorschau.leer",
  "nur-merkmale": "imp.sharepoint.vorschau.nurMerkmale",
  "zu-gross": "imp.sharepoint.vorschau.zuGross",
};

/** Der GEMESSENE Befund. `text` heisst hier: der Inhalt wurde geholt und gelesen. */
const GEMESSEN_SATZ: Record<string, string> = {
  text: "imp.sharepoint.vorschau.text",
  leer: "imp.sharepoint.vorschau.leer",
  "nur-merkmale": "imp.sharepoint.vorschau.nurMerkmale",
  "zu-gross": "imp.sharepoint.vorschau.zuGross",
  unlesbar: "imp.sharepoint.vorschau.unlesbar",
};

const UEBERNOMMEN_SATZ: Record<string, string> = {
  text: "imp.sharepoint.uebernommen.text",
  "nur-merkmale": "imp.sharepoint.uebernommen.nurMerkmale",
};

const NICHT_UEBERNOMMEN_SATZ: Record<string, string> = {
  leer: "imp.sharepoint.nichtUebernommen.leer",
  "zu-gross": "imp.sharepoint.nichtUebernommen.zuGross",
  unlesbar: "imp.sharepoint.nichtUebernommen.unlesbar",
};

/** Der Satz zu einem Befund aus der gegebenen Abbildung — oder `null`, wenn es keinen gibt. */
function satzKey(karte: Record<string, string>, befund: string | null | undefined): string | null {
  return (befund ? karte[befund] : undefined) ?? null;
}

// JOB 4232 — HIER STAND EINE LOKALE TYPERWEITERUNG UM `neuerStand`, weil `api.ts` in JOB 4125
// ausserhalb der Zielpfade lag. Sie ist ABGELÖST und nicht danebengestellt: das Feld steht jetzt in
// `api.ts` bei den übrigen Feldern der Antwort, und es gibt dafür EINE Stelle statt zwei. Die Fläche
// liest ab hier direkt `SharePointUebernahme`.

export function SharePointImportBereich(): JSX.Element | null {
  const { t, i18n } = useTranslation();
  const { role } = useRole();
  const qc = useQueryClient();
  const [gewaehlt, setGewaehlt] = useState<string[]>([]);
  const [ergebnis, setErgebnis] = useState<SharePointUebernahme | null>(null);

  // Die Routen verlangen `users.manage`. Wer es nicht trägt, fragt gar nicht erst.
  const istVerwalter = role === "admin";
  const zugang = useQuery({
    queryKey: ["sharepoint-zugang"],
    queryFn: sharepointApi.zugang,
    enabled: istVerwalter,
    retry: false,
  });

  const benutzbar = zugang.data?.enabled === true && zugang.data.credentialsUsable === true;
  const liste = useQuery({
    queryKey: ["sharepoint-dateien"],
    queryFn: () => sharepointApi.dateien(),
    // Erst fragen, wenn die Auskunft sagt, dass es etwas zu fragen gibt. Ein Abruf „auf Verdacht"
    // wäre genau der 503 als Bedienweg, den die Zugangs-Auskunft abgelöst hat.
    enabled: istVerwalter && benutzbar,
    retry: false,
  });

  // ============================================================================================
  // JOB 4232 R2 — DIE MESSUNG VOR DER ANNAHME.
  // ============================================================================================
  //
  // Sie läuft für GENAU DIE Dateien, die angekreuzt sind, und für keine andere: ein Blick in die
  // Liste darf nicht die halbe Bibliothek herunterladen. Der Schlüssel trägt die SORTIERTE Auswahl,
  // damit dieselbe Menge in anderer Klickreihenfolge dieselbe Messung ist und nicht eine zweite.
  //
  // DAS ZUSTANDSMODELL FÄLLT DAMIT VON SELBST RICHTIG (§9): `isPending` ist der Ladezustand (keine
  // Aussage), `isError` nimmt jede Zusage zurück (Fehler VOR Daten, s. unten), und ohne Auswahl
  // läuft sie gar nicht.
  //
  // ============================================================================================
  // JOB 4232 R3 — DER BEFUND HÄNGT AM DATEISTAND, NICHT NUR AN DER KENNUNG (bens Pflicht 2).
  // ============================================================================================
  //
  // DER BEFUND: Ben hat gemessen, dass eine erfolgreiche Messung eine spätere ÄNDERUNG der Datei
  // überlebt — „Neu laden" holte nur die Liste, der Messwert blieb unter demselben Schlüssel liegen
  // („expected 'Inhalt kommt mit' to be 'nicht als Text lesbar'"). Eine Zusage über einen Stand, den
  // es nicht mehr gibt, ist genau die Sorte Unwahrheit, gegen die dieser ganze Auftrag steht.
  //
  // DIE ANTWORT STEHT IM SCHLÜSSEL: er trägt je gewählter Datei die Kennung UND ihren Quellstand aus
  // der AKTUELLEN Liste. Bringt eine Auffrischung einen neuen Stand, ist es ein anderer Schlüssel —
  // und damit zwingend eine neue Messung, ohne dass irgendwo ein Invalidieren vergessen werden kann.
  // Der Stand kommt aus derselben Liste, die der Mensch vor sich sieht; verschwindet die Liste, gibt
  // es auch keinen Schlüssel mehr (s. `gemessenerBefund`).
  const auswahlSchluessel = [...gewaehlt].sort();
  const standVon = (id: string): string =>
    liste.data?.dateien.find((d) => d.id === id)?.geaendertAm ?? "";
  const messSchluessel = auswahlSchluessel.map((id) => `${id}@${standVon(id)}`);
  const probe = useQuery({
    queryKey: ["sharepoint-inhalte", messSchluessel],
    queryFn: () => sharepointApi.inhalte(auswahlSchluessel),
    enabled: istVerwalter && benutzbar && auswahlSchluessel.length > 0,
    retry: false,
  });

  const uebernehmen = useMutation({
    mutationFn: (ids: string[]) => sharepointApi.uebernehmen(ids),
    onSuccess: (antwort) => {
      setErgebnis(antwort);
      setGewaehlt([]);
      // Die Prüf-Warteschlange DARUNTER hat jetzt neue Einträge, und die Zeile „zuletzt erfolgreich
      // importiert" im Zugangskasten hat einen neuen Beleg. Beide werden aufgefrischt, damit die
      // Seite ohne Neuladen stimmt.
      void qc.invalidateQueries({ queryKey: ["import-candidates"] });
      void qc.invalidateQueries({ queryKey: ["sharepoint-zugang"] });
      void liste.refetch();
    },
  });

  // OHNE VERWALTERRECHT BLEIBT ES BEI NICHTS. Das ist kein Fehler, sondern eine Zuständigkeit: die
  // Routen verlangen `users.manage`, und wer es nicht trägt, kann an diesem Zustand ohnehin nichts
  // ändern. Ein Fehlersatz wäre hier Rauschen.
  if (!istVerwalter) {
    return null;
  }

  // ==============================================================================================
  // JOB 4125 — SCHEITERT DIE ZUGANGSAUSKUNFT, STEHT DORT EIN SATZ. NICHT NICHTS.
  // ==============================================================================================
  //
  // BIS HIERHER stand an dieser Stelle `if (!istVerwalter || !zugang.data) return null;`. Ein
  // Fehler der Auskunft lässt `zugang.data` undefiniert — der ganze Bereich verschwand wortlos, und
  // mit ihm der einzige Weg, die Auskunft neu zu holen. Codex hat genau das an Paket 1 gemessen
  // („Scheitert die Zugangsauskunft, entsteht ein leeres DOM ohne Fehlersatz", `LEHREN.md:5441`).
  //
  // DIE REIHENFOLGE IST DIE EHRLICHKEITSREGEL, dieselbe wie bei der Dateiliste unten: FEHLER VOR
  // DATEN. react-query hält die alte Antwort bei einer gescheiterten Auffrischung fest; stünde
  // `zugang.data` zuerst, würde ein alter Zugangszustand als aktueller ausgegeben.
  //
  // KEIN ZWEITER FEHLERSATZKATALOG: der Satz kommt aus `fehlerlagen.ts` — derselben Abbildung, aus
  // der Liste und Übernahme ihre Sätze holen.
  const zugangFehler = zugang.isError ? t(sharepointFehlertextKey(fehlercode(zugang.error))) : null;
  if (zugangFehler !== null) {
    return (
      <Card id={SHAREPOINT_BEREICH_ANKER} className="mb-5 scroll-mt-4">
        <SectionLabel>{t("imp.sharepoint.titel")}</SectionLabel>
        <p
          data-testid="sharepoint-zugangsfehler"
          className="mt-2 rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text"
        >
          {zugangFehler}
        </p>
        {/* EIN SATZ OHNE WEG WÄRE EINE SACKGASSE. Der erneute Versuch holt genau die Auskunft neu,
            die gescheitert ist — er verspricht nichts über SharePoint selbst. */}
        <div className="mt-2">
          <Button
            variant="outline"
            data-testid="sharepoint-zugang-erneut"
            disabled={zugang.isFetching}
            onClick={() => void zugang.refetch()}
          >
            <RefreshCw size={14} />
            {t("imp.sharepoint.zugangErneut")}
          </Button>
        </div>
      </Card>
    );
  }

  // ZUGANG UNBEKANNT (die Auskunft läuft noch, ohne Fehler): nichts. Eine Fläche, die „unbekannt"
  // anzeigt, ist Rauschen — unverändert die Regel aus JOB 4086.
  if (!zugang.data) {
    return null;
  }

  const umschalten = (id: string): void =>
    setGewaehlt((vorher) =>
      vorher.includes(id) ? vorher.filter((x) => x !== id) : [...vorher, id],
    );

  const listenFehler = liste.isError ? t(sharepointFehlertextKey(fehlercode(liste.error))) : null;
  // JOB 4232 R2 — FEHLER VOR DATEN, auch hier: Scheitert die Messung, gilt der Fehlersatz, und es
  // wird über den Inhalt NICHTS mehr behauptet. react-query hält die alte Antwort bei einer
  // gescheiterten Auffrischung fest; stünde `probe.data` zuerst, käme ein alter Messwert als
  // aktueller heraus — genau die Korrekturpflicht aus JOB 4075 R1, eine Ebene tiefer.
  // ============================================================================================
  // JOB 4232 R4 — EIN PAUSIERTER ABRUF IST KEIN FEHLER UND TROTZDEM KEINE GRUNDLAGE.
  // ============================================================================================
  //
  // BENS BEFUND AN RUNDE 3, wörtlich: „ein geworfener Netzwerkfehler ersetzt keinen pausierten
  // Offlineabruf mit Cache." Er hat den Weg gemessen: erfolgreiche Vorschau → offline → auffrischen
  // → der Übernahmeknopf blieb offen („expected false to be true").
  //
  // WARUM RUNDE 3 IHN NICHT SAH: Sie hing die ganze Sperre an `isError` und `isFetching`. Offline
  // ist BEIDES falsch. react-query fährt den Abruf gar nicht erst — er steht auf `paused`, und der
  // Befund von vorhin bleibt als `data` liegen. Ein Zustand also, in dem nichts gescheitert ist,
  // nichts läuft und trotzdem nichts gemessen wurde: genau die Lücke, durch die eine Zusage ohne
  // frische Grundlage stehen blieb (§9 des Auftrags).
  //
  // ER GILT WIE EIN FEHLER, weil er für den Menschen einer ist: Er bekommt den Satz aus denselben
  // vier Lagen — „die Verbindung steht gerade nicht" —, es gibt keine Inhaltszusage und keine
  // Übernahme. Kein fünfter Satz, kein neuer Schlüssel, kein Code auf der Fläche.
  const probePausiert = probe.fetchStatus === "paused";
  const probeFehler = probe.isError
    ? t(sharepointFehlertextKey(fehlercode(probe.error)))
    : probePausiert
      ? // Kein Servercode, weil kein Server geantwortet hat. `null` fällt auf genau den Satz, der
        // hier wahr ist (`fehlerlagen.ts:58-62`).
        t(sharepointFehlertextKey(null))
      : null;
  /**
   * Läuft gerade eine Messung? Dann gilt KEIN alter Messwert mehr.
   *
   * JOB 4232 R3: `isFetching` deckt auch die AUFFRISCHUNG einer bereits beantworteten Messung ab —
   * react-query hält die alte Antwort in dieser Zeit fest, und aus einem festgehaltenen Stand darf
   * keine Zusage abgeleitet werden (§9). Während der Auffrischung steht deshalb der Ladezustand da,
   * nicht das Ergebnis von vorhin.
   */
  const probeLaeuft = probe.isFetching || (probe.isPending && gewaehlt.length > 0);
  /** Der GEMESSENE Befund einer Kennung — oder `null`, solange es keinen GÜLTIGEN FRISCHEN gibt. */
  const gemessenerBefund = (id: string): string | null => {
    if (probeFehler !== null || probeLaeuft || !probe.data || !gewaehlt.includes(id)) {
      return null;
    }
    return probe.data.befunde.find((b) => b.id === id)?.befund ?? null;
  };
  // ============================================================================================
  // JOB 4232 R3 — OHNE GÜLTIGE MESSUNG KEINE ÜBERNAHME (bens Korrekturpflicht 3).
  // ============================================================================================
  //
  // DER BEFUND: Der Knopf sah bisher nur auf die Auswahl und den laufenden Import. Damit liess sich
  // übernehmen, WÄHREND die Prüfung lief und NACHDEM sie gescheitert war — die Messung war eine
  // Anzeige, keine Voraussetzung. Ein Mensch konnte also genau das auslösen, was diese Runde
  // verhindern soll: eine Übernahme auf einer Grundlage, die niemand kennt.
  //
  // AB HIER IST SIE EINE BEDINGUNG. Übernommen wird nur, wenn zu JEDER gewählten Datei ein frischer,
  // erfolgreicher Befund vorliegt. Fehlt einer, läuft die Messung noch oder ist sie gescheitert,
  // bleibt der Knopf zu — und daneben steht, WORAUF gewartet wird. Ein gesperrter Knopf ohne Grund
  // wäre eine Sackgasse.
  const alleGemessen = gewaehlt.length > 0 && gewaehlt.every((id) => gemessenerBefund(id) !== null);
  const uebernahmeErlaubt = alleGemessen && !uebernehmen.isPending;
  /** Warum der Knopf zu ist — oder `null`, wenn er offen ist. Immer ein Satz, nie ein leeres Bild. */
  const wartegrund =
    gewaehlt.length === 0 || uebernahmeErlaubt || probeFehler !== null
      ? null
      : probeLaeuft
        ? "imp.sharepoint.pruefungLaeuft"
        : "imp.sharepoint.pruefungFehlt";
  const uebernahmeFehler = uebernehmen.isError
    ? t(sharepointFehlertextKey(fehlercode(uebernehmen.error)))
    : null;

  return (
    <Card id={SHAREPOINT_BEREICH_ANKER} className="mb-5 scroll-mt-4">
      <SectionLabel>{t("imp.sharepoint.titel")}</SectionLabel>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{t("imp.sharepoint.was")}</p>
      {/* EHRLICHKEIT VOR OPTIK — UND SEIT JOB 4232 EINE ANDERE WAHRHEIT ALS VORHER. Bis hierher
          stand hier „Der Inhalt der Datei wird dabei nicht gelesen" (`imp.sharepoint.ohneInhalt`).
          Für Textdateien ist dieser Satz seit dieser Runde FALSCH — und ein falscher Satz vor dem
          Import ist genau die Sorte Zusage, gegen die er einmal geschrieben wurde. Er ist deshalb
          ABGELÖST durch den Satz, der beides sagt: was gelesen wird und was nicht. Wie es je Datei
          wirklich steht, sagt die Zeile in der Liste — diese hier ist die Regel, nicht die Messung.
          (Der alte Schlüssel bleibt in `i18n.ts` stehen: die Sprachdatei ist in diesem Auftrag
          ausdrücklich nur ADDITIV zu ändern, §4 Auflage 1. Das steht in der Rückgabe.) */}
      <p className="mt-1 text-[12px] leading-relaxed text-muted-2">
        {t("imp.sharepoint.inhaltRegel")}
      </p>

      <div className="mt-3">
        <SharePointZugangKarte zugang={zugang.data} />
      </div>

      {benutzbar ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">
              {t("imp.sharepoint.listeTitel")}
            </span>
            {/* JOB 4232 R3 — „NEU LADEN" FRISCHT BEIDES AUF (bens Pflicht 2). Bis hierher holte der
                Knopf NUR die Liste; ein Messwert von vorhin blieb daneben stehen und galt weiter,
                auch wenn die Datei sich inzwischen geändert hatte. Ein Mensch, der auffrischt, will
                den aktuellen Stand — und zwar den ganzen, nicht die Hälfte davon. Der Schlüssel der
                Messung trägt zusätzlich den Dateistand (s. oben); beides zusammen heisst: nach einem
                Auffrischen gibt es keine Zusage mehr, die nicht neu gemessen wurde. */}
            <Button
              variant="outline"
              data-testid="sharepoint-neu-laden"
              disabled={liste.isFetching || probe.isFetching}
              onClick={() => {
                void liste.refetch();
                void probe.refetch();
              }}
            >
              <RefreshCw size={14} />
              {t("imp.sharepoint.neuLaden")}
            </Button>
          </div>

          {/* Die Reihenfolge dieser Verzweigung IST die Ehrlichkeitsregel: Fehler VOR Daten. */}
          {listenFehler !== null ? (
            <p
              data-testid="sharepoint-listenfehler"
              className="mt-2 rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text"
            >
              {listenFehler}
            </p>
          ) : liste.data ? (
            <>
              {/* Eine Liste, die gerade aufgefrischt wird, ist nicht der aktuelle Stand — sie ist
                  der letzte, und das steht daneben.
                  JOB 4232 R4: Der PAUSIERTE Abruf gehört dazu. Offline steht `isFetching` auf
                  `false`, obwohl die Auffrischung offen ist — ohne diese Zeile sähe die Liste von
                  vorhin aus wie der frische Stand (§9: „der alte Stand bleibt sichtbar UND ist als
                  solcher erkennbar"). */}
              {liste.isFetching || liste.fetchStatus === "paused" ? (
                <p data-testid="sharepoint-nicht-frisch" className="mt-2 text-[12px] text-muted-2">
                  {t("imp.sharepoint.nichtFrisch")}
                </p>
              ) : null}
              {liste.data.dateien.length === 0 ? (
                <p data-testid="sharepoint-leer" className="mt-2 text-[12.5px] text-muted">
                  {t("imp.sharepoint.leer")}
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {liste.data.dateien.map((datei) => {
                    const stand = formatKoTimestamp(datei.geaendertAm, i18n.language);
                    // JOB 4232 — DIE VORSCHAU JE DATEI: Inhalt oder nur Merkmale, VOR der Annahme.
                    // Sie hängt an DIESER Liste: Während des Ladens gibt es sie nicht (dann steht
                    // hier gar keine Liste), und scheitert die Auffrischung, verschwindet die Liste
                    // samt dieser Zusage — die Verzweigung „Fehler VOR Daten" weiter oben ist genau
                    // das. Ein unbekannter Befund zeigt NICHTS statt eines geratenen Satzes.
                    //
                    // JOB 4232 R2 — DREI STUFEN, IN DIESER REIHENFOLGE (bens Korrekturpflicht 2):
                    //   1. GEMESSEN  → der Befund des wirklich gefahrenen Inhaltsabrufs. Er schlägt
                    //                  jede Ankündigung; hier und nur hier darf „Inhalt kommt mit"
                    //                  stehen.
                    //   2. MESSUNG LÄUFT → ein Ladezustand, KEINE Aussage über den Inhalt.
                    //   3. ANKÜNDIGUNG → was die Merkmale hergeben, als Ankündigung formuliert.
                    // Scheitert die Messung, fällt sie auf Stufe 3 zurück UND der Fehlersatz steht
                    // unter der Liste — behauptet wird dann nichts Positives mehr.
                    const gemessen = gemessenerBefund(datei.id);
                    // JOB 4232 R3: `probeLaeuft` deckt auch die AUFFRISCHUNG ab — während sie läuft,
                    // steht der Ladezustand da und nicht der Messwert von vorhin.
                    const misst = gewaehlt.includes(datei.id) && probeLaeuft && !probeFehler;
                    const inhaltKey =
                      gemessen !== null
                        ? satzKey(GEMESSEN_SATZ, gemessen)
                        : misst
                          ? "imp.sharepoint.vorschau.laeuft"
                          : satzKey(ANKUENDIGUNG_SATZ, datei.inhaltstyp);
                    // Der grüne Ton ist der Ton einer ZUSAGE — er steht deshalb nur da, wo wirklich
                    // gemessen wurde. Eine Ankündigung bekommt ihn nicht.
                    const zusage = gemessen === "text";
                    return (
                      <li key={datei.id}>
                        <label className="flex cursor-pointer items-center gap-2.5 rounded-input border border-hairline px-2.5 py-2 hover:bg-hairline-soft">
                          <input
                            type="checkbox"
                            data-testid={`sharepoint-datei-${datei.id}`}
                            checked={gewaehlt.includes(datei.id)}
                            onChange={() => umschalten(datei.id)}
                          />
                          <span className="min-w-0 flex-1 truncate text-[13px] text-text">
                            {datei.name}
                          </span>
                          {/* ZWEI ABZEICHEN STATT EINER BERECHNETEN KLASSENKETTE. Die naheliegende
                              Schreibweise wäre ein Ton im Template (`${… ? "bg-trust-pos-bg" : …}`)
                              — sie kostet den Klassensammler
                              (`tests/app/mega47-modale-flaechen-sammler.test.tsx`) eine weitere
                              unauflösbare Bindung, gemessen im Torlauf (222 statt 221). Diese Liste
                              soll schrumpfen und nicht wachsen. So geschrieben liest der Sammler
                              BEIDE Klassenketten flach — die Fläche wird von seiner Deckung
                              wirklich erfasst, statt nur gezählt zu werden. */}
                          {inhaltKey === null ? null : zusage ? (
                            <span
                              data-testid={`sharepoint-inhaltstyp-${datei.id}`}
                              data-inhaltstyp={datei.inhaltstyp}
                              data-gemessen={gemessen ?? ""}
                              className="shrink-0 rounded-btn bg-trust-pos-bg px-1.5 py-0.5 text-[10.5px] text-trust-pos-text"
                            >
                              {t(inhaltKey)}
                            </span>
                          ) : (
                            <span
                              data-testid={`sharepoint-inhaltstyp-${datei.id}`}
                              data-inhaltstyp={datei.inhaltstyp}
                              data-gemessen={gemessen ?? ""}
                              className="shrink-0 rounded-btn bg-hairline-soft px-1.5 py-0.5 text-[10.5px] text-muted-2"
                            >
                              {t(inhaltKey)}
                            </span>
                          )}
                          {/* Kein Platzhalter-Datum: steht kein lesbarer Stand in der Quelle,
                              steht hier nichts. */}
                          {stand !== null ? (
                            <span className="shrink-0 font-mono text-[10px] text-muted-2">
                              {t("imp.sharepoint.stand", { zeit: stand })}
                            </span>
                          ) : null}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
              {liste.data.truncated ? (
                <p data-testid="sharepoint-gedeckelt" className="mt-1.5 text-[12px] text-muted-2">
                  {t("imp.sharepoint.gedeckelt")}
                </p>
              ) : null}
              {/* JOB 4232 R2 — SCHEITERT DIE MESSUNG, STEHT DAS DA. Nicht als Inhaltsaussage (die
                  entfällt ganz, s. `gemessenerBefund`), sondern als der Satz aus den vier Lagen —
                  derselbe Katalog wie überall. Der Mensch sieht damit, dass er gerade NICHT weiss,
                  was in den gewählten Dateien steckt, statt es aus dem Ausbleiben zu schliessen. */}
              {probeFehler !== null ? (
                <p
                  data-testid="sharepoint-probefehler"
                  className="mt-2 rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text"
                >
                  {probeFehler}
                </p>
              ) : null}
              {/* WARUM DER KNOPF ZU IST — sonst wäre er eine Sackgasse. Der Fehlersatz der Messung
                  steht schon darüber; hier steht der Grund für die zwei stillen Fälle: die Messung
                  läuft noch, oder zu einer gewählten Datei gibt es keinen Befund. */}
              {wartegrund !== null ? (
                <p data-testid="sharepoint-wartegrund" className="mt-2 text-[12px] text-muted">
                  {t(wartegrund)}
                </p>
              ) : null}
              <div className="mt-3">
                <Button
                  variant="primary"
                  data-testid="sharepoint-uebernehmen"
                  disabled={!uebernahmeErlaubt}
                  onClick={() => uebernehmen.mutate(gewaehlt)}
                >
                  {uebernehmen.isPending ? <Loader2 size={15} className="animate-spin" /> : null}
                  {uebernehmen.isPending
                    ? t("imp.sharepoint.uebernahmeLaeuft")
                    : t("imp.sharepoint.uebernehmen")}
                </Button>
              </div>
            </>
          ) : (
            // Ladezustand: KEINE Aussage über Anzahl oder Rechte.
            <p data-testid="sharepoint-laedt" className="mt-2 text-[12.5px] text-muted">
              {t("imp.sharepoint.laedt")}
            </p>
          )}

          {uebernahmeFehler !== null ? (
            <p
              data-testid="sharepoint-uebernahmefehler"
              className="mt-2 rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text"
            >
              {uebernahmeFehler}
            </p>
          ) : null}

          {/* DAS ERGEBNISBILD: Name, Originaladresse, Importstand — und die drei ehrlichen
              Nebenausgänge. Es steht nur da, wenn wirklich eine Übernahme gelaufen ist. */}
          {ergebnis !== null && uebernahmeFehler === null ? (
            <div
              data-testid="sharepoint-ergebnis"
              className="mt-3 rounded-card border border-hairline bg-page px-3 py-2"
            >
              <span className="block font-mono text-[9.5px] font-semibold uppercase tracking-wide text-muted-2">
                {t("imp.sharepoint.ergebnisTitel")}
              </span>
              {/* JOB 4125 — „NICHTS ÜBERNOMMEN" IST EINE AUSSAGE UND KEINE LEERSTELLE. Beim
                  Wiederholimport einer unveränderten Datei ist `dateien` leer; bis hierher stand
                  unter der Überschrift „Aus SharePoint geholt" dann einfach nichts, und der Mensch
                  musste aus dem Fehlen schliessen, was geschehen ist. Die Gründe stehen in den
                  Zeilen darunter (schon vorgemerkt / verschwunden / nicht übernommen). */}
              {ergebnis.dateien.length === 0 ? (
                <p data-testid="sharepoint-nichts-neu" className="mt-1.5 text-[12.5px] text-muted">
                  {t("imp.sharepoint.nichtsNeu")}
                </p>
              ) : null}
              <ul className="mt-1.5 space-y-1">
                {ergebnis.dateien.map((datei) => {
                  const stand = formatKoTimestamp(datei.geaendertAm, i18n.language);
                  // JOB 4232 — WAS WIRKLICH ANKAM, an DIESER Übernahme gemessen. Nicht die Vorschau
                  // von vorhin: die beiden können auseinanderliegen, und dann gilt die Messung.
                  const inhaltKey = satzKey(UEBERNOMMEN_SATZ, datei.inhalt);
                  return (
                    <li key={datei.id} className="text-[12.5px] text-text">
                      <span className="font-semibold">{datei.name}</span>
                      {inhaltKey !== null ? (
                        <span
                          data-testid={`sharepoint-ergebnis-inhalt-${datei.id}`}
                          data-inhalt={datei.inhalt}
                          className="ml-2 text-[11.5px] text-muted"
                        >
                          {t(inhaltKey)}
                        </span>
                      ) : null}
                      {stand !== null ? (
                        <span className="ml-2 font-mono text-[10px] text-muted-2">
                          {t("imp.sharepoint.stand", { zeit: stand })}
                        </span>
                      ) : null}
                      {/* Die Originaladresse ist ein echter Weg zurück zur Quelle — kein
                          abgetippter Text. Fehlt sie, steht kein Link da. */}
                      {datei.url !== null ? (
                        <a
                          href={datei.url}
                          target="_blank"
                          rel="noreferrer"
                          data-testid={`sharepoint-quelle-${datei.id}`}
                          className="ml-2 inline-flex items-center gap-1 text-[11.5px] text-ai underline underline-offset-2"
                        >
                          <ExternalLink size={12} aria-hidden />
                          {t("imp.sharepoint.quelleOeffnen")}
                        </a>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {/* JOB 4125 — DER NEUE STAND EINER SCHON WARTENDEN QUELLE. Er ist kein Erstimport,
                  auch wenn er wie einer zählt: zu derselben Datei steht ein ÄLTERER Vorgang in der
                  Prüfung. Der Satz sagt beides, damit niemand die zweite Zeile dort für eine
                  Dublette hält. Die Zahl kommt aus der Antwort (`neuerStand`) — kein Zähler ohne
                  Erzeuger; fehlt das Feld, steht hier nichts. */}
              {ergebnis.neuerStand.length > 0 ? (
                <p data-testid="sharepoint-neuer-stand" className="mt-1.5 text-[12px] text-muted">
                  {t("imp.sharepoint.neuerStand", { n: ergebnis.neuerStand.length })}
                </p>
              ) : null}
              {/* JOB 4232 — WAS NICHT ÜBERNOMMEN WURDE, WEIL SEIN INHALT NICHT TRÄGT. Jede dieser
                  Dateien wurde WIRKLICH gelesen, und das Ergebnis war leer, zu gross oder nicht als
                  Text dekodierbar. Es entstand deshalb KEIN Eintrag — und der Mensch liest je Datei
                  den Grund, nicht einen Sammelsatz. Ohne diese Zeile sähe „nichts Neues übernommen"
                  aus wie ein Wiederholimport, obwohl etwas ganz anderes passiert ist. */}
              {ergebnis.ohneInhalt.length > 0 ? (
                <ul data-testid="sharepoint-ohne-inhalt" className="mt-1.5 space-y-0.5">
                  {ergebnis.ohneInhalt.map((eintrag) => {
                    const key = satzKey(NICHT_UEBERNOMMEN_SATZ, eintrag.befund);
                    return key === null ? null : (
                      <li
                        key={eintrag.id}
                        data-testid={`sharepoint-ohne-inhalt-${eintrag.id}`}
                        data-befund={eintrag.befund}
                        className="text-[12px] text-muted"
                      >
                        {t(key)}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {ergebnis.alreadyQueued > 0 ? (
                <p className="mt-1.5 text-[12px] text-muted">
                  {t("imp.sharepoint.schonVorgemerkt", { n: ergebnis.alreadyQueued })}
                </p>
              ) : null}
              {ergebnis.notFound.length > 0 ? (
                <p className="mt-1 text-[12px] text-muted">
                  {t("imp.sharepoint.verschwunden", { n: ergebnis.notFound.length })}
                </p>
              ) : null}
              {ergebnis.failed.length > 0 ? (
                <p className="mt-1 text-[12px] text-muted">
                  {t("imp.sharepoint.gescheitert", { n: ergebnis.failed.length })}
                </p>
              ) : null}
              {/* KEIN WISSENSOBJEKT OHNE MENSCH: Der Import legt Kandidaten an, nichts weiter. */}
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                {t("imp.sharepoint.weiterInDerPruefung")}
              </p>
            </div>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
