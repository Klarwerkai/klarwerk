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
//   OFFLINE                  → ein gescheiterter Abruf ohne deutbaren Code fällt auf „Verbindung
//                              abgelaufen oder nicht erreichbar" (`sharepointFehlertextKey`). Es
//                              wird NICHTS über den Bestand in SharePoint behauptet.
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

  if (!istVerwalter || !zugang.data) {
    return null;
  }

  const umschalten = (id: string): void =>
    setGewaehlt((vorher) =>
      vorher.includes(id) ? vorher.filter((x) => x !== id) : [...vorher, id],
    );

  const listenFehler = liste.isError ? t(sharepointFehlertextKey(fehlercode(liste.error))) : null;
  const uebernahmeFehler = uebernehmen.isError
    ? t(sharepointFehlertextKey(fehlercode(uebernehmen.error)))
    : null;

  return (
    <Card id={SHAREPOINT_BEREICH_ANKER} className="mb-5 scroll-mt-4">
      <SectionLabel>{t("imp.sharepoint.titel")}</SectionLabel>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{t("imp.sharepoint.was")}</p>
      {/* EHRLICHKEIT VOR OPTIK: Der Dateiinhalt wird NICHT gelesen (der Adapter ruft die Merkmale
          ab, nicht den Text). Wer das nicht weiss, hält das entstehende Objekt für den Inhalt der
          Datei. Der Satz steht deshalb VOR dem Import und nicht in einer Fussnote danach. */}
      <p className="mt-1 text-[12px] leading-relaxed text-muted-2">
        {t("imp.sharepoint.ohneInhalt")}
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
            <Button
              variant="outline"
              data-testid="sharepoint-neu-laden"
              disabled={liste.isFetching}
              onClick={() => void liste.refetch()}
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
                  der letzte, und das steht daneben. */}
              {liste.isFetching ? (
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
              <div className="mt-3">
                <Button
                  variant="primary"
                  data-testid="sharepoint-uebernehmen"
                  disabled={gewaehlt.length === 0 || uebernehmen.isPending}
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
              <ul className="mt-1.5 space-y-1">
                {ergebnis.dateien.map((datei) => {
                  const stand = formatKoTimestamp(datei.geaendertAm, i18n.language);
                  return (
                    <li key={datei.id} className="text-[12.5px] text-text">
                      <span className="font-semibold">{datei.name}</span>
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
