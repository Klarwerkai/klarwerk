// JOB 3065 H6 — DIE DETAILKARTEN DES REITERS „DATEN".
//
// Demodaten (laden/entfernen samt Einmalkennwörtern), Werkseinstellungen, Papierkorb und die
// Audit-Liste. Inhalt und Verhalten wie zuvor in `Admin.tsx`; neu ist nur der Ort: hinter einer
// Zeile mit Wert, erreichbar über das Chevron. Hilfetexte im „?"-Menü der Karte.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  PackagePlus,
  Power,
  RotateCcw,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useAudit, useUsers } from "../api/hooks";
import type {
  DemoPackageInfo,
  DemoPackageResult,
  DemoPackageTextDto,
  DemoSeedResult,
} from "../api/types";
import { useToast } from "../app/ToastContext";
// AUFTRAG-mega64 Block A: der Demodaten-Knopf steht hinter dem Betriebsschalter — dieselbe
// fail-closed Regel wie jede andere geschaltete Fläche (mega46 F2).
import { FeatureGate } from "../components/FeatureGate";
// JOB 3670: die Seitenhilfe dieser vier Karten — je Karte ein eigener Text, weil es vier
// Bildschirme sind. `HelpTip` rendert nichts; er meldet beim Sammler an, das Zahnrad listet.
import { HelpTip } from "../components/HelpTip";
import { Abfragehuelle } from "../components/einstellungen/Abfragehuelle";
import { Detailkarte } from "../components/einstellungen/Detailkarte";
import { Button, Field, TextInput } from "../components/ui";
import { isUserAuditAction } from "../lib/adminForms";
import type { BrandProfil, BrandingStand, BrandingWunsch } from "../lib/brandTheme";
import {
  BRAND_PROFIL_ADVISOR,
  abonniereBranding,
  aktuellesBranding,
  holeMarkeFuerFlaeche,
  setzeBranding,
  uebernimmBranding,
} from "../lib/brandTheme";
import { PILOT_NEXT_STEPS } from "../lib/pilotNextSteps";

/**
 * JOB 3511 — DER ABSCHNITT „DEMO-ERSCHEINUNGSBILD".
 *
 * Pedi wählt hier das Firmenprofil (heute genau eines: Advisor) und legt den Schalter um; danach
 * trägt KLARWERK das Advisor-Logo und die Advisor-Hausfarben, zurückgelegt sieht alles wieder aus
 * wie vorher — einschließlich seiner bisherigen klassisch/modern-Wahl.
 *
 * WARUM ER HIER WOHNT UND KEINE EIGENE DETAILKARTE IST: eine eigene Karte bräuchte eine Kennung in
 * `lib/adminSections.ts` und einen Zweig im Detail-Switch von `pages/Admin.tsx`; beide Dateien
 * liegen außerhalb der Zielpfade dieses Auftrags (s. RUECKGABE, ABWEICHUNGEN). Der Ort ist
 * trotzdem der richtige: Admin → Vorführdaten ist das Thema, unter dem die Vorführung wohnt.
 *
 * WARUM DIE WAHL NICHT IM BROWSER LIEGT: sie gilt für ALLE. Es gibt genau eine Quelle — den Server
 * (`GET /api/branding`, `PUT /api/admin/branding`) — und keine zweite Speicherschicht daneben.
 *
 * WAS ER AUSDRÜCKLICH NICHT TUT: laden, löschen, KI anstoßen. Das Umschalten löst genau den einen
 * `PUT` aus; die Demo-Datenpakete darüber bleiben davon unberührt, und der Satz auf der Fläche
 * sagt das auch.
 *
 * ================================================================================================
 * JOB 3563 — DIE KARTE FOLGT DER EINEN MARKENQUELLE, STATT EINE ZWEITE ZU HALTEN.
 * ================================================================================================
 * Bis hierher rief die Abfrage dieser Karte `ladeBranding` unmittelbar selbst und hielt damit einen
 * ZWEITEN Markenstand neben `lib/brandTheme.ts`. Geschrieben wurde er nur vom eigenen
 * `PUT`; die gedrosselte Nachführung des Moduls schrieb dort nie hin. Schaltete jemand anderswo um
 * — zweiter Administrator, zweiter Tab —, zog die Seite ringsum nach (Logo und Farben hängen am
 * Modul) und dieser Schalter blieb auf dem alten Stand stehen. Schlimmer als die falsche Anzeige
 * war die FOLGE: der nächste Klick rechnete seinen `PUT` aus dem veralteten Stand und schickte den
 * ALTEN `profil`-Wert mit — die fremde Profilwahl war weg, ohne dass es jemand gesehen hat.
 * BEN hat das zweimal benannt (JOB 3511 R1 `ben.md:30`, R2 `ben.md:31`).
 *
 * ------------------------------------------------------------------------------------------------
 * RUNDE 2 — BENs ZWEI KORREKTURPFLICHTEN AN RUNDE 1. Beide von ihm gemessen, nicht vermutet:
 * ------------------------------------------------------------------------------------------------
 *   1. „Den unabhängigen Kartenabruf ablösen." Runde 1 hängte die ANZEIGE ans Modul, ließ den
 *      `useQuery` aber IMMER laufen. Wer die Karte öffnete, während das Modul den Stand längst
 *      hatte, löste damit einen zusätzlichen `GET /api/branding` aus — genau der zweite Abrufweg
 *      neben der gedrosselten Nachführung, den Lieferung 3 ausschließt.
 *   2. „Den sichtbaren Zustand einschließlich Fehlererholung aus der gemeinsamen Quelle ableiten."
 *      Schwerer wog die Folge: Scheiterte dieser Abruf, verdeckte die Fehlerbox der Hülle die
 *      Bedienelemente auch dann noch, wenn das Modul längst einen bestätigten Stand trug. BENs
 *      Gegenprobe im Wortlaut: „externe Version 2 übernommen, Wurzelattribut `advisor`, Karte
 *      weiterhin ‚nicht abrufbar · Erneut versuchen'."
 *
 * DIE AUFTEILUNG JETZT, und sie ist die ganze Änderung. EINE Frage entscheidet alles:
 * KENNT DAS MODUL EINEN STAND?
 *
 *   · JA (`aktuellesBranding() !== null`): die Karte zeigt und schaltet IHN — über
 *     `abonniereBranding`/`aktuellesBranding`, dieselbe Anbindung wie `shell/Logo.tsx:36`. Kein
 *     Abruf, keine Hülle, keine Fehlerbox. Deshalb zieht der Schalter bei einer fremden Änderung
 *     mit (ohne Neuladen, ohne Fokuswechsel, ohne Klick), und deshalb bleibt ein bestätigter Stand
 *     sichtbar und bedienbar, auch wenn eine spätere Auffrischung scheitert (LEHREN §7, Auftrag §9
 *     „Cache mit gescheiterter Auffrischung": es wird nichts geleert und nichts gemeldet).
 *   · NEIN: erst dann arbeitet react-query, und zwar genau für die drei Lagen, die es OHNE
 *     bestätigten Stand geben muss — „wird geladen", „nicht abrufbar" mit „Erneut versuchen"
 *     (dessen `refetch`) und der geglückte Erstabruf. Der Abruf läuft über `holeMarkeFuerFlaeche`
 *     und mündet in dieselbe eine Quelle; seine Antwort landet im Modul, und damit fällt die Karte
 *     von selbst in den Ja-Zweig. Genauso wirkt eine erfolgreiche Hintergrundübernahme nach einem
 *     Fehler: die Bedienelemente stehen wieder da, ohne dass jemand „Erneut versuchen" drückt.
 *
 * KEIN ZWEITER TAKT — und seit Runde 3 auch nicht in der einen Sekunde, in der es bisher noch
 * einen gab. Drei Zeilen halten das zusammen, jede gegen einen anderen Weg:
 *
 *   · `enabled: gemeldet === null` nimmt den Abruf weg, sobald das Modul einen Stand HAT.
 *   · `refetchOnWindowFocus: false` nimmt den Fokus-Abruf des `QueryClient` (`main.tsx:44`) weg,
 *     der sonst neben dem Fokus-Hörer in `brandTheme.ts` liefe.
 *   · `holeMarkeFuerFlaeche` teilt sich einen BEREITS LAUFENDEN Abruf, statt einen zweiten zu
 *     starten. Das ist BENs Korrekturpflicht an Runde 2, und sein Fall ist der Anwendungsstart:
 *     `initBrandTheme()` holt, die Antwort ist noch unterwegs, das Modul weiß also noch nichts —
 *     und genau dann wird die Karte geöffnet. `enabled` sah dort einen leeren Stand und konnte
 *     „noch keiner" nicht von „läuft gerade" unterscheiden; die Karte holte ein zweites Mal. BEN
 *     wörtlich gemessen: „expected ‚spy' to be called 1 times, but got 2 times."
 *
 * Es bleibt also genau EIN Abruf — der erste, den überhaupt jemand macht —, und der zählt in der
 * Minutenfrist des Moduls mit.
 */
function DemoErscheinungsbild(): JSX.Element {
  const { t } = useTranslation();
  const { push } = useToast();
  const gemeldet = useSyncExternalStore(abonniereBranding, aktuellesBranding, aktuellesBranding);
  const marke = useQuery({
    queryKey: ["admin", "branding"],
    queryFn: holeMarkeFuerFlaeche,
    // DER GANZE UNTERSCHIED ZU RUNDE 1. Hat das Modul einen Stand, gibt es hier nichts zu holen:
    // die Karte zeigt ihn, und die Nachführung des Moduls hält ihn frisch. Ohne diese Zeile wäre
    // der `useQuery` ein zweiter Abrufweg (BEN, Korrekturpflicht 1).
    enabled: gemeldet === null,
    refetchOnWindowFocus: false,
  });
  const schalten = useMutation({
    mutationFn: (wunsch: BrandingWunsch) => setzeBranding(wunsch),
    onSuccess: (antwort) => {
      // Sofort sichtbar, ohne auf den nächsten Abruf zu warten — und `letzteVersion` in
      // `brandTheme.ts` bleibt dabei richtig, sodass die Nachführung nicht doppelt schreibt.
      // Das ist seit JOB 3563 zugleich die Anzeige: der Abonnent oben meldet den neuen Stand, ohne
      // dass hier noch eine zweite Ablage beschrieben (`qc.setQueryData`) oder neu abgerufen wird.
      uebernimmBranding(antwort);
      push("success", t("einst.marke.gespeichert"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });

  // Die Bedienelemente zu EINEM Stand. Sie stehen als Funktion und nicht als eigenes Bauteil da,
  // weil sie den `schalten`-Vorgang und `t` dieser Karte brauchen — und weil es sie genau einmal
  // geben darf: eine zweite Fassung für den Abrufzweig wäre wieder eine zweite Wahrheit.
  const bedienfeld = (stand: BrandingStand): JSX.Element => (
    <div className="mt-2 space-y-2">
      <Field label={t("einst.marke.profil")}>
        <select
          data-testid="marke-profil"
          className="w-full rounded-input border border-hairline bg-surface px-2.5 py-1.5 text-[13px] text-text"
          value={stand.profil ?? ""}
          disabled={schalten.isPending}
          onChange={(e) => {
            const profil: BrandProfil =
              e.target.value === BRAND_PROFIL_ADVISOR ? BRAND_PROFIL_ADVISOR : null;
            // Ohne Profil gibt es nichts zu verwenden — der Schalter fällt mit zurück, damit nie
            // ein Zustand „aktiv, aber ohne Profil" entsteht.
            schalten.mutate({ profil, aktiv: profil === null ? false : stand.aktiv });
          }}
        >
          <option value="">{t("einst.marke.profilKeines")}</option>
          <option value={BRAND_PROFIL_ADVISOR}>{t("einst.marke.profilAdvisor")}</option>
        </select>
      </Field>
      <label className="flex items-center gap-2 text-[12.5px] text-text">
        <input
          type="checkbox"
          data-testid="marke-schalter"
          checked={stand.aktiv}
          disabled={stand.profil === null || schalten.isPending}
          // `stand.profil` ist der NACHGEFÜHRTE Wert: hat jemand anders zwischenzeitlich ein
          // Profil gewählt, geht dieses fremde Profil mit — der Klick auf das Kästchen schaltet,
          // was zu sehen ist, und dreht keine fremde Wahl still zurück.
          onChange={(e) => schalten.mutate({ profil: stand.profil, aktiv: e.target.checked })}
        />
        {t("einst.marke.schalter")}
      </label>
      {stand.profil === null ? (
        <p className="text-[12px] text-muted-2">{t("einst.marke.ohneProfil")}</p>
      ) : null}
    </div>
  );

  return (
    <div data-einst="erscheinungsbild" className="border-t border-hairline pt-3">
      <div className="text-[13px] font-semibold text-text">{t("einst.marke.titel")}</div>
      <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
        {t("einst.marke.erklaerung")}
      </p>
      {gemeldet === null ? (
        // NOCH KEIN BESTÄTIGTER STAND. Nur hier gibt es Lade-, Fehler- und Wiederholweg, und nur
        // hier ist die Hülle richtig: „Firmen-CI ist aus" ist eine TATSACHENAUSSAGE über die
        // Installation und darf nur aus einer erfolgreichen Antwort stammen, nie aus einem
        // gescheiterten Abruf.
        //
        // Der Kindzweig rendert DASSELBE Bedienfeld wie unten und ist trotzdem nicht der Weg, auf
        // dem man es zu sehen bekommt: `holeMarkeFuerFlaeche` legt die Antwort ins Modul, BEVOR
        // die Abfrage auflöst — also meldet der Abonnent oben zuerst, und die Karte steht schon im
        // Zweig darunter. Er steht da, weil der Vertrag der Hülle ein Kind verlangt, und er
        // rendert bewusst nicht eine zweite Fassung.
        <Abfragehuelle abfrage={marke} testId="huelle-branding">
          {(beimAbruf) => bedienfeld(beimAbruf)}
        </Abfragehuelle>
      ) : (
        bedienfeld(gemeldet)
      )}
    </div>
  );
}

/**
 * ================================================================================================
 * JOB 3636 — DIE KENNUNG, UNTER DER DAS ADVISOR-PAKET IN DER SERVERLISTE STEHT.
 * ================================================================================================
 *
 * Sie ist hier ausschliesslich ein SUCHSCHLÜSSEL in die Antwort von `GET /api/admin/demo-packages`
 * — nie das Ziel eines Aufrufs aus eigener Kraft. Findet die Liste sie nicht, lädt die Karte
 * NICHTS und sagt genau das (Auftrag §4: „eine erfundene Kennung, die ins Leere lädt, wäre
 * schlimmer als eine ehrliche Lücke"). Geladen wird deshalb immer `paket.id` aus dem gefundenen
 * Listeneintrag und nie diese Konstante.
 *
 * Derselbe Wert steht in `components/ExamplePackages.tsx:101` (`LESEVARIANTEN_PAKET`). Er wird von
 * dort NICHT geholt: die Konstante ist nicht exportiert, und ein Export samt Import quer über eine
 * Bauteildatei wäre eine Abhängigkeit der Verwaltungsseite auf die Importfläche — für eine
 * Zeichenkette, deren Richtigkeit hier ohnehin die Serverliste entscheidet und nicht der Import.
 */
const ADVISOR_PAKET = "advisor-ict-en-v1";

/**
 * SCRUM-181 / Pedi 14.07.: Demodaten laden — auch neben vorhandenen Daten, idempotent.
 *
 * ================================================================================================
 * JOB 3636 — ZWEI KARTEN, ZWEI WEGE. VOR DEM KLICK STEHT, WAS GELADEN WIRD.
 * ================================================================================================
 *
 * Pedi über Codex, 13:17: die Seite „soll vor dem Laden eindeutig zeigen, WELCHE Daten geladen
 * werden"; er verlangt „getrennte Auswahl/Aktionen für allgemeine Demodaten und ‚Advisor-Demodaten
 * laden', analog zur eindeutigen Profilauswahl beim Erscheinungsbild".
 *
 * DIE REGEL, AUF DIE ES ANKOMMT (Auftrag §4): Zweimal derselbe Aufruf mit zwei Beschriftungen wäre
 * der Fehler, nicht die Lösung. Die beiden Knöpfe laden deshalb wirklich Verschiedenes, und wer es
 * nachsehen will, findet es an genau zwei Stellen dieser Datei:
 *
 *   Karte 1 „Demodaten"  → `demoSeed.mutate(false)` → `POST /api/admin/demo-seed`
 *   Karte 2 „Demopakete" → `paketLaden.mutate(paket)` → `POST /api/admin/demo-packages/<id>/load`
 *
 * WAS UNBERÜHRT BLEIBT (Auftrag §5): die Rückfrage vor dem frischen Laden (`force`), der
 * Entfernen-Weg samt seiner Bestätigung, das Erscheinungsbild als eigener, ungekoppelter Abschnitt
 * — und die Rücksetzlogik aus JOB 3277. Zurücksetzen und paketbezogenes Entfernen wohnen weiterhin
 * NUR im Demopaket-Kasten auf `/import` (`components/ExamplePackages.tsx`); hier steht der eine
 * Handgriff, den Pedi hier verlangt hat. Eine zweite Fassung der Eingriffe wäre eine zweite
 * Wahrheit über denselben Bestand.
 *
 * RECHTE WIE BISHER, und das ist gemessen statt angenommen: beide Wege liegen serverseitig hinter
 * derselben Prüfung `users.manage` (`services/app/src/routes/admin-routes.ts:169,227`). Der
 * Betriebsschalter `demodaten` umschliesst weiterhin GENAU das, was er bisher umschloss — das
 * Anlegen des Grundbestands (mega64 Block A); die Paketrouten stehen nicht hinter ihm, und ein
 * Gatter, das nur die Fläche sperrt, während `/import` denselben Aufruf offen anbietet, wäre eine
 * Scheinsperre. Stufe 2 ist kein Recht, sondern ein lokaler Sichtschalter des Admins
 * (`lib/effectiveRole.ts:11`, `lib/stufe2Storage.ts`).
 */
export function DemodatenDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { push } = useToast();
  const fail = (e: unknown): void =>
    push("error", e instanceof ApiError ? e.message : t("state.error"));

  /**
   * JOB 3065 R4 — die zweite Lücke derselben Klasse wie BENs Befund an `/api/users`.
   *
   * Der Wert der Zeile „Demodaten" kommt aus `/api/admin/demo-seed`. Scheiterte dieser Abruf, stand
   * dort „nicht abrufbar" — und diese Karte, in die das Chevron führt, kannte den Bestand gar nicht:
   * kein Zustand, kein Knopf „Erneut", kein Weg zurück. Auftrag §9 verlangt den Ausweg genau HIER.
   * Die Karte nennt den Bestand jetzt selbst, hinter derselben Hülle wie jede andere Detailkarte.
   */
  const demoStatus = useQuery({
    queryKey: ["admin", "demo-status"],
    queryFn: endpoints.admin.demoStatus,
  });

  const demoSeed = useMutation<DemoSeedResult, unknown, boolean | undefined>({
    // Pedi 05.07./14.07.: force lädt den Demo-Bestand frisch. SCRUM-487: Demo-Sprache = UI-Sprache.
    mutationFn: (force) => endpoints.admin.demoSeed(force ?? false, i18n.language),
    onSuccess: (r) => {
      for (const key of [
        ["users"],
        ["kos"],
        ["gaps"],
        ["conflicts"],
        ["validation"],
        ["notifications"],
        ["analytics"],
        ["evidence"],
        ["admin", "demo-status"],
        /**
         * JOB 3636 R2 — DIESELBE LÜCKE WIE BEIM GESAMT-ENTFERNEN, an ihrer dritten Stelle.
         *
         * BEN fand sie am Purge (Korrekturpflicht 2). Sie steht aber auch hier, und das ist
         * gemessen statt vermutet: „frisch laden" räumt VORHER das vorhandene Demo-Set auf —
         * `seedDemoForAdmin` ruft bei `force` dasselbe `purgeDemoSeed`
         * (`services/app/src/seed-demo.ts:213-215`), und das nimmt die Paketbausteine mit.
         * Ohne diesen Schlüssel stünde nach einem frischen Laden derselbe veraltete Advisor-
         * Bestand da wie nach dem Entfernen.
         *
         * Der Schlüssel steht UNBEDINGT hier, nicht nur im `force`-Fall: ein Abruf kann die
         * angezeigte Zahl nie falsch machen, ein fehlender Abruf schon — und eine Bedingung wäre
         * eine zweite Regel, die mit der Serverseite in Gleichschritt bleiben müsste.
         */
        ["demo-packages"],
      ]) {
        void qc.invalidateQueries({ queryKey: key });
      }
      if (r.skipped) {
        push("info", t("adm.seedSkipped"));
      } else {
        push("success", t("adm.seedDone", { kos: r.kos, users: r.users }));
      }
    },
    onError: fail,
  });

  /**
   * JOB 3636 — DIE LISTE IST DIE QUELLE, NICHT DAS GEDÄCHTNIS.
   *
   * Derselbe Schlüssel wie im Demopaket-Kasten auf `/import`
   * (`components/ExamplePackages.tsx`): ein Endpunkt, ein Eintrag im Vorrat. Ein eigener Schlüssel
   * hätte hier eine zweite Kopie derselben Übersicht gehalten, die nach einem Handgriff auf der
   * anderen Fläche veraltet gewesen wäre.
   *
   * `queryFn` steht als BLANKER Verweis da (nicht `() => …list()`): der Vollzähligkeitsfall der
   * Endpunkt-Matrix (`tests/design/h6-detail-zustandsweg.test.ts`, Fall V) liest genau diese
   * Schreibweise und verlangt für sie einen gemessenen Fehlerweg. Eine Pfeilfunktion ginge an ihm
   * vorbei — der neue Abruf wäre dann ungemessen live gegangen.
   */
  const demoPakete = useQuery({
    queryKey: ["demo-packages"],
    queryFn: endpoints.admin.demoPackages.list,
  });

  /** Die Pakettexte kommen VOM SERVER in drei Sprachen; die Fläche wählt nur aus. */
  const paketText = (text: DemoPackageTextDto): string =>
    i18n.language.startsWith("en") ? text.en : i18n.language.startsWith("nl") ? text.nl : text.de;

  // Die Bilanz des letzten Paket-Handgriffs — mit dem NAMEN des Pakets, weil „geladen" allein
  // nicht mehr genügt, seit es zwei Möglichkeiten gibt (Auftrag §6).
  const [paketBilanz, setPaketBilanz] = useState<{
    titel: string;
    wert: DemoPackageResult;
  } | null>(null);

  /**
   * ==============================================================================================
   * JOB 3636 R2 — DIE BILANZ NENNT AUCH, WAS NICHT GELANG (BENs Korrekturpflicht 1).
   * ==============================================================================================
   *
   * Runde 1 las aus der Antwort NUR `created` und `skipped`. Der Drahtvertrag führt aber zwei
   * weitere Felder, die beide von einem UNVOLLSTÄNDIGEN Lauf erzählen (`api/types.ts:1547,1550`):
   *
   *   `skippedInTrash` — Bausteine, deren Anker im Papierkorb liegt: nicht angelegt, kein Duplikat.
   *   `failures`       — Nacharbeiten, die mit Schlüssel und Grund gescheitert sind.
   *
   * Ein Lauf mit `created: 0, skipped: 0, failures: 6` stand damit als „0 angelegt, 0 unverändert"
   * da — der Form nach eine Erfolgsmeldung, dem Inhalt nach ein Fehlschlag. Genau die Sorte Satz,
   * die dieser Auftrag abschafft (§4: ein Knopf, der etwas anderes tut, als er sagt).
   *
   * DIE TEXTE SIND DIE VORHANDENEN. `dpk.resultTrash` und `dpk.resultFailures` stehen seit JOB 3277
   * in allen drei Sprachen (`i18n.ts:4207,4208 / 9379,9380 / 14273,14274`) und tragen im
   * Demopaket-Kasten auf `/import` dieselbe Aussage (`components/ExamplePackages.tsx:570-577`) —
   * mit demselben Trennzeichen. Eine zweite Formulierung für denselben Sachverhalt wäre eine zweite
   * Wahrheit; deshalb steht hier kein neuer Schlüssel.
   *
   * EIN ORT FÜR BEIDE AUSGABEN: Meldung und Kartenzeile lesen diese eine Funktion. Ginge die
   * Zählung nur in eine der beiden, widersprächen sich Toast und Fläche beim nächsten Umbau.
   */
  const paketBilanzText = (titel: string, wert: DemoPackageResult): string => {
    const teile = [titel, t("dpk.resultLoad", { created: wert.created, skipped: wert.skipped })];
    if (wert.skippedInTrash > 0) {
      teile.push(t("dpk.resultTrash", { n: wert.skippedInTrash }));
    }
    if (wert.failures.length > 0) {
      teile.push(t("dpk.resultFailures", { n: wert.failures.length }));
    }
    return teile.join(" · ");
  };
  const paketLaden = useMutation<DemoPackageResult, unknown, DemoPackageInfo>({
    // Der Aufruf nimmt das gefundene LISTENOBJEKT entgegen und liest seine Kennung daraus. Damit
    // kann dieser Weg baulich keine Kennung laden, die der Server nicht selbst genannt hat.
    mutationFn: (paket) => endpoints.admin.demoPackages.load(paket.id),
    onSuccess: (r, paket) => {
      for (const key of [
        ["kos"],
        ["library"],
        ["gaps"],
        ["conflicts"],
        ["validation"],
        ["analytics"],
        ["evidence"],
        ["admin", "demo-status"],
        ["demo-packages"],
      ]) {
        void qc.invalidateQueries({ queryKey: key });
      }
      const titel = paketText(paket.title);
      setPaketBilanz({ titel, wert: r });
      // JOB 3636 R2: Ein Lauf mit gescheiterten Nacharbeiten ist KEIN Erfolg. Er ist auch kein
      // Fehlschlag — angelegt wurde ja etwas —, deshalb die neutrale Stufe statt der grünen. Die
      // Zahl daneben sagt, worauf sie sich bezieht; „teilweise" allein wäre wieder nur ein Wort.
      push(r.failures.length > 0 ? "info" : "success", paketBilanzText(titel, r));
    },
    onError: fail,
  });

  // Pedi 02.07.: Demodaten komplett entfernen (Merker überlebt Tester-Bearbeitungen).
  const [confirmPurge, setConfirmPurge] = useState(false);
  const demoPurge = useMutation({
    mutationFn: () => endpoints.admin.demoPurge(),
    onSuccess: (r) => {
      for (const key of [
        ["kos"],
        ["validation"],
        ["notifications"],
        ["analytics"],
        ["evidence"],
        ["conflicts"],
        // Bug (Pedi 04.07.): auch Wissenslücken/Aufgaben-Sichten auffrischen.
        ["gaps"],
        ["tasks"],
        ["admin", "demo-status"],
        /**
         * JOB 3636 R2 — BENs Korrekturpflicht 2: DIESE ZEILE FEHLTE, UND DIE KARTE LOG DESHALB.
         *
         * Der Gesamt-Purge nimmt die Paketbausteine MIT: sie tragen denselben `demoSeed`-Merker
         * wie der Grundbestand — der Server sagt es an der Paketroute selbst
         * (`services/app/src/routes/admin-routes.ts:154`: „Gesamt-Purge (DELETE
         * /api/admin/demo-seed) bleibt zeichengleich und nimmt das Paket weiter mit").
         *
         * Ohne diesen Schlüssel blieb `paket.loaded` auf dem Stand VOR dem Entfernen stehen; die
         * Advisor-Karte sagte „6 von 6 geladen" über einen Bestand, den derselbe Klick gerade
         * geleert hatte. Gemessen von BEN an Runde 1 und jetzt als Fall V12 festgehalten.
         */
        ["demo-packages"],
      ]) {
        void qc.invalidateQueries({ queryKey: key });
      }
      setConfirmPurge(false);
      /**
       * Und die Bilanz des letzten Ladens geht mit. Sie ist eine Aussage über den JETZIGEN Bestand
       * („Advisor ICT (EN) · 6 angelegt"); nach dem Entfernen ist von diesen sechs nichts mehr da.
       * Stehen zu lassen, was gerade gelöscht wurde, wäre dieselbe Unehrlichkeit wie die veraltete
       * Bestandszeile darüber — nur an einer zweiten Stelle.
       */
      setPaketBilanz(null);
      push(
        "success",
        t("adm.purgeDone", {
          kos: r.kos,
          conflicts: r.conflicts,
          duplicates: r.duplicates,
          gaps: r.gaps,
          users: r.users,
        }),
      );
    },
    onError: fail,
  });

  return (
    <Detailkarte
      titel={t("adm.seedTitle")}
      onZurueck={onZurueck}
      testId="detail-demodaten"
      hilfe={[{ titel: t("adm.seedTitle"), text: t("adm.seedHint") }]}
    >
      {/* JOB 3670: die Seitenhilfe dieses Bildschirms. Sie sagt, was das „?"-Menü der Karte nicht
          sagt: dass hier ZWEI verschiedene Bestände wohnen (Kommentar unten, Z. 252-253), dass die
          Einmalkennwörter nur dieses eine Mal dastehen, und dass das Entfernen beide zugleich
          mitnimmt (`services/app/src/routes/admin-routes.ts:154`). */}
      <HelpTip title={t("seitenhilfe.admin.demo.titel")} body={t("seitenhilfe.admin.demo.text")} />
      {/* ==========================================================================================
          JOB 3636 · KARTE 1 — DIE ALLGEMEINEN DEMODATEN.
          ==========================================================================================
          Der Titel steht als eigener Schlüssel (`adm.seedTitle`) über der Karte, die Knopfschrift
          kommt aus `adm.seedButton`. Beide tragen heute denselben Wortlaut; es sind trotzdem zwei
          Schlüssel, damit die Karte später „Allgemeine Demodaten" heissen kann, ohne dass sich die
          Beschriftung des Knopfes mit ändert (s. RUECKGABE, ABWEICHUNGEN: die Textlieferung gehört
          nach `i18n.ts` und damit in einen eigenen Auftrag).

          WARUM HIER KEIN ERKLÄRSATZ STEHT, obwohl der Auftrag einen verlangt: `adm.seedHint` ist
          der Hilfekörper DIESER Karte (`hilfe` oben, verlangt von
          `tests/design/h6-funktionsinventar.test.ts:282`). Derselbe Satz zusätzlich im Sichtfeld
          verstösst gegen Pedis Regel vom 04.09. „ein Ziel, ein Ort" — gemessen, nicht vermutet:
          `tests/design/zielbild-h6-kein-erklaertext.test.ts` wurde damit rot („Lädt einen kleinen,
          echten Demo-Bestand …“ steht im Sichtfeld der Karte). Was diese Karte enthält, sagen
          deshalb ihr Titel, die Bestandszeile und das „?"-Menü; ein eigener, kurzer Flächensatz
          bräuchte einen neuen Schlüssel in `i18n.ts` (s. RUECKGABE, ABWEICHUNGEN).

          Die Advisor-Karte darunter zeigt ihren Satz dagegen, und das ist kein Widerspruch: ihre
          Beschreibung kommt vom SERVER und steht in keinem „?"-Menü — genau wie der Erklärsatz des
          Erscheinungsbilds weiter unten. */}
      <div data-einst="karte-allgemein" className="rounded-card border border-hairline bg-page p-3">
        <p className="text-[13.5px] font-semibold text-text">{t("adm.seedTitle")}</p>
        <Abfragehuelle abfrage={demoStatus} testId="huelle-demostatus">
          {(stand) => (
            <div data-testid="demo-bestand" className="mt-1.5 text-[12.5px] text-muted-2">
              {t("einst.daten.demoBestand")}
              {" · "}
              {stand.present
                ? t("einst.daten.demoDa", { count: stand.count })
                : t("einst.wert.keine")}
            </div>
          )}
        </Abfragehuelle>
        {/* AUFTRAG-mega64 Block A: Nur das ANLEGEN steht hinter dem Schalter — der Entfernen-Knopf
            ausdrücklich NICHT. Wer die Vorführhilfe abschaltet, muss vorhandene Demodaten weiterhin
            loswerden können. Dieselbe Aufteilung wie serverseitig in admin-routes.ts. */}
        <div className="mt-2">
          <FeatureGate feature="demodaten">
            <Button
              variant="ghost"
              disabled={demoSeed.isPending}
              onClick={() => demoSeed.mutate(false)}
            >
              <UserPlus size={15} />
              {t("adm.seedButton")}
            </Button>
          </FeatureGate>
        </div>
        {/* JOB 3636: Rückfrage, Einmalkennwörter und Next-Steps gehören ZU DIESEM Knopf und stehen
            deshalb in seiner Karte. Bis hierher standen sie unterhalb des Entfernen-Blocks — mit
            zwei Ladewegen auf der Fläche wäre dort nicht mehr zu sehen, welcher von beiden sie
            erzeugt hat. An den Blöcken selbst ändert sich nichts. */}
        {/* SCRUM-306: nach erfolgreichem Seed sichtbare Next-Steps — keine automatische Weiterleitung. */}
        {demoSeed.isSuccess && demoSeed.data?.skipped ? (
          <div className="mt-2 rounded-btn bg-trust-warn-bg px-3 py-2 text-[12.5px] text-trust-warn-text">
            <p>{t("adm.seedSkippedInline")}</p>
            {/* Pedi 05.07.: Demo-Set trotzdem laden — vorhandenes Demo-Set wird zuerst aufgeräumt. */}
            <button
              type="button"
              disabled={demoSeed.isPending}
              onClick={() => demoSeed.mutate(true)}
              className="mt-1.5 inline-flex items-center gap-1 rounded-btn border border-trust-warn-text/30 px-2.5 py-1 font-semibold text-trust-warn-text hover:bg-trust-warn-text/10 disabled:opacity-50"
            >
              <UserPlus size={13} />
              {t("adm.seedForce")}
            </button>
          </div>
        ) : null}
        {/* ================================================================================
            AUFTRAG-mega64 BLOCK A — DIE EINMALKENNWÖRTER, GENAU EINMAL.
            ================================================================================
            Der Server erzeugt sie bei jeder Neuanlage frisch und nennt sie NUR in der Antwort auf
            diesen einen Aufruf; danach speichert er nur einen Prüfwert. Deshalb stehen sie hier,
            sofort, mit dem Hinweis, dass ein Neuladen sie verliert. Sie werden bewusst NICHT in
            einen Zwischenspeicher, in eine Datei oder in eine Meldung gelegt. */}
        {(demoSeed.data?.einmalkennwoerter ?? []).length > 0 ? (
          <div
            data-testid="demo-einmalkennwoerter"
            className="mt-2 rounded-card border border-trust-warn-fill/40 bg-trust-warn-bg p-3 text-trust-warn-text"
          >
            <div className="font-mono text-[10px] uppercase tracking-wider">
              {t("adm.seedCredsTitle")}
            </div>
            <p className="mt-0.5 text-[12.5px] leading-relaxed">{t("adm.seedCredsHint")}</p>
            <ul className="mt-2 space-y-1">
              {(demoSeed.data?.einmalkennwoerter ?? []).map((zugang) => (
                <li key={zugang.email} className="font-mono text-[12px]">
                  {zugang.email} · <span className="font-semibold">{zugang.kennwort}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {demoSeed.isSuccess && !demoSeed.data?.skipped ? (
          <div className="mt-2 rounded-card border border-hairline bg-surface p-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
              {t("pilot.next.title")}
            </div>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
              {t("pilot.next.hint")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PILOT_NEXT_STEPS.map((step) => (
                <Link
                  key={step.id}
                  to={step.to}
                  className="inline-flex items-center gap-1 rounded-btn border border-hairline bg-surface px-2.5 py-1 text-[12px] font-semibold text-text hover:border-ink/30"
                >
                  {t(step.labelKey)}
                  <ArrowRight size={13} />
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      {/* ==========================================================================================
          JOB 3636 · KARTE 2 — DAS ADVISOR-PAKET, MIT SEINEM EIGENEN AUFRUF.
          ==========================================================================================
          Der Titel der Karte steht AUSSERHALB der Hülle, weil er in jedem Zustand gebraucht wird:
          auch „wird geladen" und „nicht abrufbar" müssen sagen, WORÜBER sie sprechen. Alles, was
          eine Tatsachenaussage über den Bestand ist — Name, Beschreibung, Umfang, „noch nicht
          geladen" —, steht INNERHALB der Hülle und damit nur, wenn es der Server geliefert hat. */}
      <div data-einst="karte-advisor" className="rounded-card border border-hairline bg-page p-3">
        <p className="text-[13.5px] font-semibold text-text">{t("dpk.title")}</p>
        <Abfragehuelle abfrage={demoPakete} testId="huelle-demopakete">
          {(liste) => {
            const paket = liste.packages.find((p) => p.id === ADVISOR_PAKET);
            if (paket === undefined) {
              // EHRLICHE LÜCKE STATT ERFUNDENER KENNUNG (Auftrag §4): kein Knopf, keine Zusage.
              // Der Wortlaut ist der, den diese Fläche für „gibt es hier nicht" schon führt.
              return (
                <p data-testid="advisor-fehlt" className="mt-1 text-[12.5px] text-muted-2">
                  {t("adm.factory.unavailable")}
                </p>
              );
            }
            return (
              <div data-demopaket={paket.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13px] font-semibold text-text">{paketText(paket.title)}</p>
                  {paket.fictional ? (
                    <span className="rounded-btn bg-surface px-2 py-0.5 text-[11.5px] text-muted">
                      {t("dpk.fictional")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
                  {paketText(paket.description)}
                </p>
                <p className="mt-1 text-[12.5px] text-muted-2">
                  {t("dpk.scope", {
                    items: paket.items,
                    areas: paket.areas.join(", "),
                    language: paket.language.toUpperCase(),
                  })}
                  {" · "}
                  {paket.loaded === 0
                    ? t("dpk.stateNone")
                    : t("dpk.stateLoaded", { loaded: paket.loaded, items: paket.items })}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {/* DIE BESCHRIFTUNG NENNT DAS PAKET. Sie wird aus dem vorhandenen Schlüssel und
                      dem Servertitel zusammengesetzt — damit steht in jeder Sprache am Knopf, was
                      er wirklich lädt, und keine zweite Textquelle behauptet es daneben. */}
                  <Button
                    variant="ghost"
                    data-testid="advisor-laden"
                    disabled={paketLaden.isPending}
                    onClick={() => paketLaden.mutate(paket)}
                  >
                    {paketLaden.isPending ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <PackagePlus size={15} />
                    )}
                    {`${paketLaden.isPending ? t("dpk.busy") : t("dpk.load")} · ${paketText(paket.title)}`}
                  </Button>
                  {paketBilanz ? (
                    <span data-testid="advisor-bilanz" className="text-[12.5px] text-muted">
                      {paketBilanzText(paketBilanz.titel, paketBilanz.wert)}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          }}
        </Abfragehuelle>
      </div>
      {/* ==========================================================================================
          JOB 3337 — LADEN UND ENTFERNEN STEHEN NICHT MEHR NEBENEINANDER.
          ==========================================================================================
          Codex' Livebefund an 1.0.0-beta.1.198: „Laden und Entfernen als kleine, ähnlich
          gewichtete Textaktionen." Zwei Handlungen mit sehr verschiedenen Folgen sahen gleich aus
          und lagen einen Zentimeter auseinander. Die Vorlage verlangt darum: „Laden und
          Entfernen/Rücksetzen optisch klar unterscheiden."

          JETZT: zwei Blöcke, durch eine Trennlinie geschieden. Oben die aufbauenden Handlungen,
          unten — nach der Linie und eingerückt in einen eigenen, ruhigen Bereich — die abräumende.
          An den Handlungen selbst ändert sich NICHTS: dieselben Knöpfe, dieselbe Rückfrage,
          dieselbe serverseitige Aufteilung (mega64 A: nur das ANLEGEN steht hinter dem Schalter).
          JOB 3636: „oben" sind jetzt ZWEI Karten statt einer — die Linie darunter bleibt. */}
      <div data-einst="entfernen" className="border-t border-hairline pt-3">
        {/* SCRUM-412 (CI): Bestätigung = neutrale Fläche; Rot nur am destruktiven Knopf. */}
        {confirmPurge ? (
          <span className="inline-flex items-center gap-2 rounded-card border border-hairline bg-page px-2.5 py-1.5">
            <span className="text-[12px] font-semibold text-text">{t("adm.purgeQ")}</span>
            <button
              type="button"
              className="text-[12px] font-semibold text-muted hover:text-text"
              onClick={() => setConfirmPurge(false)}
            >
              {t("adm.purgeKeep")}
            </button>
            <button
              type="button"
              disabled={demoPurge.isPending}
              className="text-[12px] font-semibold text-trust-crit-text"
              onClick={() => demoPurge.mutate()}
            >
              {t("adm.purgeYes")}
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmPurge(true)}
            className="-ml-3 rounded-btn px-3 py-2 text-[12.5px] font-semibold text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
          >
            <Trash2 size={14} className="mr-1 inline" />
            {t("adm.purgeButton")}
          </button>
        )}
      </div>
      {/* JOB 3511: das Erscheinungsbild der Vorführung — eigener Abschnitt, eigene Trennlinie. Es
          steht bewusst UNTER den Datenhandlungen: es ist kein Datenweg, es lädt und löscht nichts. */}
      <DemoErscheinungsbild />
    </Detailkarte>
  );
}

/**
 * Pedi 05.07. (Beta): Werksreset — nur im Desktop/Dev-Modus. Löscht ALLE Daten und beendet das
 * Programm. Doppelte Rückfrage plus Re-Authentifizierung (SCRUM-450).
 *
 * JOB 3065: Die Karte gibt es jetzt IMMER (die Zeile davor nennt die Verfügbarkeit als Wert) —
 * ist der Weg in dieser Installation nicht vorhanden, sagt die Karte genau das, statt zu fehlen.
 */
export function WerkseinstellungenDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  const { push } = useToast();
  const factoryResetStatus = useQuery({
    queryKey: ["factory-reset-status"],
    queryFn: endpoints.admin.factoryResetStatus,
  });
  // Zwei-Stufen-Bestätigung: "" (aus) → "armed" (Passwort + erste Rückfrage) → "confirm" (Warnung).
  const [factoryStep, setFactoryStep] = useState<"" | "armed" | "confirm">("");
  const [factoryPw, setFactoryPw] = useState("");
  const [factoryDone, setFactoryDone] = useState(false);
  const cancelFactory = (): void => {
    setFactoryStep("");
    setFactoryPw("");
  };
  const factoryReset = useMutation({
    mutationFn: (password: string) => endpoints.admin.factoryReset(password),
    onSuccess: () => {
      // Der Server beendet sich unmittelbar danach — die Oberfläche zeigt einen Neustart-Hinweis.
      setFactoryStep("");
      setFactoryPw("");
      setFactoryDone(true);
      push("success", t("adm.factoryDone"));
    },
    // SCRUM-450: Falsches Passwort → zurück zur Eingabe (Passwort leeren) mit klarer Meldung.
    onError: () => {
      setFactoryStep("armed");
      setFactoryPw("");
      push("error", t("adm.factory.wrongPassword"));
    },
  });

  return (
    <Detailkarte
      titel={t("adm.factory.title")}
      onZurueck={onZurueck}
      testId="detail-werkseinstellungen"
      hilfe={[
        { titel: t("adm.factory.title"), text: t("adm.factory.help") },
        { titel: t("adm.factory.title"), text: t("adm.factory.hint") },
      ]}
    >
      {/* JOB 3670: AUSSERHALB der Hülle, und das ist der Punkt. „Nicht verfügbar" ist genau der
          Zustand, in dem jemand wissen will, warum — und die Hilfe muss ihn erklären können, ohne
          dass der Statusabruf geglückt sein muss. */}
      <HelpTip title={t("seitenhilfe.admin.werk.titel")} body={t("seitenhilfe.admin.werk.text")} />
      {/* Die Hülle steht davor: „In dieser Installation nicht verfügbar" ist eine TATSACHENAUSSAGE
          und darf nur aus einer erfolgreichen Antwort stammen — nicht aus einem gescheiterten
          Abruf, der nichts über die Installation weiß. */}
      <Abfragehuelle abfrage={factoryResetStatus}>
        {(stand) => (
          <>
            {stand.available !== true ? (
              <p className="text-[12.5px] text-muted-2">{t("adm.factory.unavailable")}</p>
            ) : factoryDone ? (
              <p className="rounded-btn bg-trust-warn-bg px-3 py-2 text-[12.5px] text-trust-warn-text">
                {t("adm.factory.restartHint")}
              </p>
            ) : factoryStep === "" ? (
              <button
                type="button"
                onClick={() => setFactoryStep("armed")}
                className="inline-flex items-center gap-1.5 rounded-btn px-3 py-2 text-[12.5px] font-semibold text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
              >
                <RotateCcw size={14} />
                {t("adm.factory.button")}
              </button>
            ) : factoryStep === "armed" ? (
              // SCRUM-450: Stufe 1 — Passwort-Bestätigung (Re-Authentifizierung).
              <div className="space-y-2 rounded-card border border-hairline bg-page px-3 py-2.5">
                <span className="block text-[12.5px] font-semibold text-text">
                  {t("adm.factory.confirm1")}
                </span>
                <Field label={t("adm.factory.passwordLabel")}>
                  <TextInput
                    type="password"
                    value={factoryPw}
                    autoComplete="current-password"
                    onChange={(e) => setFactoryPw(e.target.value)}
                  />
                </Field>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="text-[12px] font-semibold text-muted hover:text-text"
                    onClick={cancelFactory}
                  >
                    {t("adm.factory.cancel")}
                  </button>
                  <button
                    type="button"
                    disabled={factoryPw.trim().length === 0}
                    className="text-[12px] font-semibold text-trust-crit-text disabled:opacity-40"
                    onClick={() => setFactoryStep("confirm")}
                  >
                    {t("adm.factory.continue")}
                  </button>
                </div>
              </div>
            ) : (
              // SCRUM-450: Stufe 2 — große, unübersehbare Warnung vor dem unwiderruflichen Schritt.
              <div className="space-y-2.5 rounded-card border border-trust-crit-text/40 bg-trust-crit-bg px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={18} className="shrink-0 text-trust-crit-text" />
                  <span className="text-[14px] font-bold text-trust-crit-text">
                    {t("adm.factory.confirm2")}
                  </span>
                </div>
                <p className="text-[12.5px] leading-snug text-trust-crit-text/90">
                  {t("adm.factory.warnBody")}
                </p>
                <div className="flex items-center gap-3 pt-0.5">
                  <button
                    type="button"
                    className="text-[12px] font-semibold text-muted hover:text-text"
                    onClick={cancelFactory}
                  >
                    {t("adm.factory.cancel")}
                  </button>
                  <button
                    type="button"
                    disabled={factoryReset.isPending}
                    className="inline-flex items-center gap-1 rounded-btn bg-trust-crit-text px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                    onClick={() => factoryReset.mutate(factoryPw)}
                  >
                    <Power size={13} />
                    {t("adm.factory.execute")}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Abfragehuelle>
    </Detailkarte>
  );
}

/** SCRUM-422: Papierkorb — 28 Tage wiederherstellbar, Endlöschung mit ruhiger Inline-Rückfrage. */
export function PapierkorbDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { push } = useToast();
  const users = useUsers();
  const trash = useQuery({ queryKey: ["kos", "trash"], queryFn: endpoints.ko.trash });
  const [confirmTrashPurgeId, setConfirmTrashPurgeId] = useState<string | null>(null);
  const invalidateTrash = (): void => {
    void qc.invalidateQueries({ queryKey: ["kos"] });
    void qc.invalidateQueries({ queryKey: ["validation"] });
  };
  const trashRestore = useMutation({
    mutationFn: (id: string) => endpoints.ko.restore(id),
    onSuccess: () => {
      invalidateTrash();
      push("success", t("adm.trash.restored"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });
  const trashPurge = useMutation({
    mutationFn: (id: string) => endpoints.ko.purge(id),
    onSuccess: () => {
      setConfirmTrashPurgeId(null);
      invalidateTrash();
      push("success", t("adm.trash.purged"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });
  const userName = (id: string): string => users.data?.find((u) => u.id === id)?.name ?? id;
  const daysLeft = (expiresAt: string): number =>
    Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 86_400_000));

  return (
    <Detailkarte
      titel={t("adm.trash.title")}
      onZurueck={onZurueck}
      testId="detail-papierkorb"
      hilfe={[{ titel: t("adm.trash.title"), text: t("adm.trash.help") }]}
    >
      {/* JOB 3670: Die Frist ist hier die Folge, die man kennen muss. Sie läuft auch ohne Zutun ab;
          entfernt wird der Eintrag dann vom Aufräumlauf des Servers
          (`services/knowledge-object/src/service.ts:3453-3468`, angestoßen beim Start und
          periodisch, `services/app/src/server.ts:180,195-205`) — deshalb „beim nächsten
          Aufräumlauf" und nicht „auf die Minute". */}
      <HelpTip
        title={t("seitenhilfe.admin.papierkorb.titel")}
        body={t("seitenhilfe.admin.papierkorb.text")}
      />
      {/* JOB 3065 R2: `QueryState` zeigt bei einem Fehler zwar einen Satz, aber KEINEN Weg zurück.
          Die Hülle bringt „nicht abrufbar" mit „Erneut versuchen" und hält vorhandene Einträge bei
          gestörter Auffrischung sichtbar. */}
      <Abfragehuelle abfrage={trash}>
        {(eintraege) => (
          <>
            {eintraege.length === 0 ? (
              <p className="text-[12.5px] text-muted-2">{t("adm.trash.empty")}</p>
            ) : (
              <ul className="space-y-2">
                {eintraege.map((entry) => (
                  <li key={entry.id} className="rounded-card border border-hairline p-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-text">
                          {entry.title}
                        </div>
                        <div className="text-[11.5px] text-muted-2">
                          {t("adm.trash.deletedMeta", {
                            name: userName(entry.deletedBy),
                            date: new Date(entry.deletedAt).toLocaleDateString(),
                          })}
                          {" · "}
                          {t("adm.trash.expires", { days: daysLeft(entry.expiresAt) })}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        disabled={trashRestore.isPending}
                        onClick={() => trashRestore.mutate(entry.id)}
                      >
                        {t("adm.trash.restore")}
                      </Button>
                      {confirmTrashPurgeId === entry.id ? (
                        <span className="flex w-full basis-full flex-wrap items-center justify-end gap-2 border-t border-hairline pt-2">
                          <span className="text-[12px] font-semibold text-text">
                            {t("adm.trash.purgeQ")}
                          </span>
                          <button
                            type="button"
                            className="text-[12px] font-semibold text-muted hover:text-text"
                            onClick={() => setConfirmTrashPurgeId(null)}
                          >
                            {t("adm.trash.keep")}
                          </button>
                          <button
                            type="button"
                            disabled={trashPurge.isPending}
                            className="text-[12px] font-semibold text-trust-crit-text"
                            onClick={() => trashPurge.mutate(entry.id)}
                          >
                            {t("adm.trash.purge")}
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmTrashPurgeId(entry.id)}
                          className="rounded-btn px-2.5 py-1.5 text-[12px] font-semibold text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
                        >
                          <Trash2 size={13} className="mr-1 inline" />
                          {t("adm.trash.purge")}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Abfragehuelle>
    </Detailkarte>
  );
}

/** SCRUM-149: die kleine echte Audit-Sicht für Nutzer-/Auth-Aktionen. */
export function AuditDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  const audit = useAudit();
  return (
    <Detailkarte titel={t("adm.auditTitle")} onZurueck={onZurueck} testId="detail-audit">
      {/* JOB 3670: Diese Karte hatte bisher überhaupt keine Hilfequelle — weder ein „?"-Menü noch
          einen Eintrag im Zahnrad. Der Text sagt das Wichtigste zuerst: hier wird nur gelesen, und
          die vollständige Kette samt Prüfknopf wohnt woanders. */}
      <HelpTip
        title={t("seitenhilfe.admin.audit.titel")}
        body={t("seitenhilfe.admin.audit.text")}
      />
      <Abfragehuelle abfrage={audit}>
        {(entries) => {
          const userEntries = entries
            .filter((e) => isUserAuditAction(e.action))
            .slice(-15)
            .reverse();
          if (userEntries.length === 0) {
            return <p className="text-[13px] text-muted">{t("adm.auditEmpty")}</p>;
          }
          return (
            <div className="divide-y divide-hairline">
              {userEntries.map((e) => (
                <div key={e.seq} className="flex items-center gap-3 py-2 text-[12.5px]">
                  <span className="font-mono text-[11px] text-muted-2">
                    {new Date(e.at).toLocaleString()}
                  </span>
                  <span className="font-semibold text-text">{e.action}</span>
                  <span className="ml-auto truncate font-mono text-[11px] text-muted-2">
                    {e.actor}
                  </span>
                </div>
              ))}
            </div>
          );
        }}
      </Abfragehuelle>
    </Detailkarte>
  );
}
