import { useMutation, useQuery } from "@tanstack/react-query";
// JOB 3065 H6 — DIE DETAILKARTEN DES REITERS „SICHERHEIT".
//
// Prüfprotokoll (hash-verkettet, mit aktiver Integritätsprüfung), Datenschutz-Nachweis und die
// Bereitschafts-Checkliste. Letztere war bis hierher ein eigener fünfter Reiter; sie ist eine
// Auskunft über den Zustand des Hauses und lebt deshalb als Zeile „Bereitschaft" unter Sicherheit
// weiter — mit derselben Checkliste, denselben Quellen und demselben Druckknopf.
import { Printer, ShieldCheck } from "lucide-react";
import { Fragment, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useAnalytics, useAudit, useDirectory, useValidationBoard } from "../api/hooks";
import { useToast } from "../app/ToastContext";
// JOB 3670: die Seitenhilfe dieser drei Karten — je Karte ein eigener Text, weil es drei
// Bildschirme sind. `HelpTip` rendert nichts; er meldet beim Sammler an, das Zahnrad listet.
import { HelpTip } from "../components/HelpTip";
import { Abfragehuelle, Fehlerbox } from "../components/einstellungen/Abfragehuelle";
import { Detailkarte } from "../components/einstellungen/Detailkarte";
import { Bereitschaftstandhinweis } from "../components/einstellungen/bereitschaftstandhinweis";
import {
  abfragelage,
  gruppenlage,
  useIstOnline,
  wertBefund,
} from "../components/einstellungen/zeilenWert";
import { Button } from "../components/ui";
import { auditActionLabel } from "../lib/auditAction";
import {
  type DetailZeile,
  type VerzeichnisLage,
  auditEventDetail,
  verzeichnisNamen,
} from "../lib/auditEventDetail";
import { type AuditVerifyTone, auditVerifyView } from "../lib/auditVerifyState";
import { SECURITY_POINTS } from "../lib/securityStatements";
import { type ReadinessTone, readinessRows } from "../lib/vipReadiness";

// SCRUM-437: Ampel-Klassen für die Bereitschafts-Zeilen (info = ruhige, wertungsfreie Zahl).
const READY_TONE_CLASS: Record<ReadinessTone, string> = {
  ok: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  crit: "bg-trust-crit-bg text-trust-crit-text",
  info: "bg-page text-muted",
};

// AUFTRAG-mega14 Block A-2: Ampel der Integritätsprüfung. Gelb ist ein eigener Zustand, kein
// abgeschwächtes Rot — „Verkettung lückenlos, Nutzdaten nicht nachrechenbar" ist eine andere
// Aussage als „Kette nicht bestätigt".
const AUDIT_VERIFY_TONE_CLASS: Record<AuditVerifyTone, string> = {
  ok: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  crit: "bg-trust-crit-bg text-trust-crit-text",
};

// SCRUM-440: nur den markierten Auszug drucken — eine Body-Klasse isoliert den Druck (via CSS),
// damit normales Strg+P auf anderen Seiten unberührt bleibt. Klasse nach dem Druck wieder entfernen.
function printExtract(): void {
  document.body.classList.add("printing-extract");
  window.addEventListener("afterprint", () => document.body.classList.remove("printing-extract"), {
    once: true,
  });
  window.print();
}

function DruckKnopf(): JSX.Element {
  const { t } = useTranslation();
  return (
    <Button variant="outline" className="print-hide" onClick={printExtract}>
      <Printer size={14} /> {t("adm.print")}
    </Button>
  );
}

/**
 * JOB 3140 (UX-11): der Wert einer Detailzeile — reiner Text, kein Bedienelement.
 *
 * Drei Formen, drei Bedeutungen: ein Wert; eine Kennung mit dem GRUND, warum kein Name danebensteht;
 * oder die ehrliche Auskunft „nicht gespeichert". Welche davon gilt, entscheidet
 * `lib/auditEventDetail.ts` — hier wird nur gerendert. Die Kennung bleibt in jeder Form lesbar
 * (monospace, kleiner): sie beherrscht die Zeile nicht mehr, verschwindet aber auch nicht.
 */
function DetailWert({ zeile }: { zeile: DetailZeile }): JSX.Element {
  const { t } = useTranslation();
  if (zeile.kind === "missing") {
    return <span className="italic text-muted-2">{t("audit.detail.notStored")}</span>;
  }
  return (
    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
      {zeile.kind === "text" ? (
        <span className="text-text">{zeile.valueKey ? t(zeile.valueKey) : zeile.value}</span>
      ) : null}
      {/* JOB 3140 R2: der Hinweis steht NUR da, wenn es einen gibt. Ein Objektziel (`ko.created`
          & Co.) trägt seine Kennung ohne jede Aussage über ein Konto — kein leerer Kursivrest. */}
      {zeile.hinweisKey === undefined ? null : (
        <span className="italic text-muted-2">{t(zeile.hinweisKey)}</span>
      )}
      {zeile.id === undefined ? null : (
        <span className="truncate font-mono text-[10.5px] text-muted-2">{zeile.id}</span>
      )}
    </span>
  );
}

/**
 * SCRUM-432 (Pedi 03.07., VIP-Investor): das hash-verkettete Prüfprotokoll.
 * AUFTRAG-mega15 Block A: die Texte behaupten keine Unveränderbarkeit — belegbar ist die
 * Prüfbarkeit (s. tests/app/chain-claims.test.ts).
 *
 * JOB 3140 (UX-11): DREI ROHE KENNUNGEN WERDEN EIN SATZ. Bis hierher standen je Eintrag der rohe
 * Aktionscode und zwei UUIDs nebeneinander, ohne Beschriftung — welche Kennung die ausführende und
 * welche die betroffene ist, stand nirgends, und `payload` wurde gar nicht gelesen. Jetzt trägt
 * jeder Eintrag beschriftete Zeilen: Ereignis (über den bestehenden `auditActionLabel`), ausgeführt
 * von, betroffen, und beim Rollenwechsel Rolle vorher/nachher.
 *
 * Das Verzeichnis (`useDirectory`, für JEDEN Angemeldeten — nicht `/api/users`, das Adminrecht
 * verlangt und einem Controller die Fläche nähme) ist eine NACHRANGIGE Quelle: es hängt außerhalb
 * der `Abfragehuelle` und kann die Karte deshalb weder blockieren noch in einen Fehlerzustand
 * zwingen. Sein Zustand wird über dasselbe Modell gelesen wie jede Einstellungszeile
 * (`zeilenWert.ts`) und als Lage an `auditEventDetail` gereicht — damit die Tatsachenaussage
 * „Konto nicht mehr vorhanden" nur aus einer erfolgreichen, frischen Antwort entstehen kann.
 */
export function PruefprotokollDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  const { push } = useToast();
  const audit = useAudit();
  const verzeichnisAbfrage = useDirectory();
  const online = useIstOnline();
  const verzeichnisLage = abfragelage(verzeichnisAbfrage, online);
  const verzeichnisBefund = wertBefund(verzeichnisLage, null);
  const verzeichnisDaten = verzeichnisAbfrage.data;
  const verzeichnisLaeuft = verzeichnisLage.laeuft;
  const verzeichnisVeraltet = verzeichnisBefund.nichtAktualisiert;
  const verzeichnis: VerzeichnisLage = useMemo(() => {
    if (verzeichnisBefund.art === "laedt") {
      return { art: "laedt" };
    }
    if (verzeichnisBefund.art === "fehler" || verzeichnisBefund.art === "offline") {
      return { art: "nichtAbrufbar" };
    }
    return {
      art: "geladen",
      namen: verzeichnisNamen(verzeichnisDaten),
      // JOB 3140 R2 (BENs Korrekturpflicht 2) — DREI LAGEN, NICHT ZWEI.
      //
      // Bis hierher stand hier `frisch: !nichtAktualisiert`. `nichtAktualisiert` meint aber
      // ausschließlich „Auffrischung GESCHEITERT oder ruht" (`zeilenWert.ts:93`). Eine LAUFENDE
      // Auffrischung ist beides nicht — und trotzdem ist der sichtbare Bestand dann der ALTE aus
      // dem Zwischenspeicher. BENs Messung: 60 s alter, leerer Bestand mit ausstehender Antwort
      // zeigte „Konto nicht mehr vorhanden", während das Konto in der laufenden Antwort steht.
      // Deshalb entscheidet jetzt auch `laeuft` mit; belegt ist das Fehlen erst danach.
      stand: verzeichnisVeraltet ? "veraltet" : verzeichnisLaeuft ? "laeuftNach" : "frisch",
    };
  }, [verzeichnisBefund.art, verzeichnisVeraltet, verzeichnisLaeuft, verzeichnisDaten]);
  // SCRUM-439: aktive Integritätsprüfung der Audit-Kette — echte Verifikation statt Aussage.
  const verifyAudit = useMutation({
    mutationFn: () => endpoints.audit.verify(),
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });

  return (
    <div className="print-area">
      <Detailkarte
        titel={t("adm.sich.auditTitle")}
        onZurueck={onZurueck}
        testId="detail-pruefprotokoll"
        kopfAktion={<DruckKnopf />}
        hilfe={[
          { titel: t("adm.sich.auditTitle"), text: t("adm.sich.auditHelp") },
          { titel: t("adm.sich.auditTitle"), text: t("adm.sich.auditIntro") },
        ]}
      >
        {/* JOB 3670: AUSSERHALB der Hülle — der Erklärtext gilt auch, während die Kette noch lädt
            oder ihr Abruf gescheitert ist.

            RUNDE 2 · KORREKTURPFLICHT 1 DES PRÜFERS. Hier stand: „steht neben einem Beteiligten nur
            eine Kennung, konnte das Verzeichnis nicht gelesen werden, und die Karte behauptet dann
            nichts über das Konto." Beides war falsch, und BEN hat es gemessen. Eine Kennung ohne
            Namen hat VIER verschiedene Ursachen, und `lib/auditEventDetail.ts` hält sie streng
            auseinander — jede mit ihrem eigenen Hinweis neben der Kennung:

              `audit.detail.nameLoading`     Verzeichnis lädt, oder es läuft eine Auffrischung nach
                                             (`auditEventDetail.ts:168,180`) — Aussage über den
                                             ABRUF, nicht über das Konto.
              `audit.detail.nameUnavailable` Abruf gescheitert, oder der Bestand ist veraltet
                                             (`:171,184`) — ebenfalls nur über den Abruf.
              `audit.detail.accountGone`     Verzeichnis ERFOLGREICH und abgeschlossen geladen, die
                                             Kennung fehlt darin (`:187`). Das ist sehr wohl eine
                                             Tatsachenaussage ÜBER das Konto: „Konto nicht mehr
                                             vorhanden". Genau dieser Fall fehlte im alten Text.
              (kein Hinweis)                 Ein Ziel, das gar kein Konto ist (`objektZeile`,
                                             `:196-203`) — dort wird nichts nachgeschlagen, und nur
                                             DORT behauptet die Karte wirklich nichts.

            Der Hilfetext nennt jetzt alle vier und sagt, welche eine Aussage ist und welche nicht.
            Gepinnt wird das nicht durch Abschreiben, sondern ABGELEITET: der Wächter
            `tests/seitenhilfe-admin/protokollhilfe-geladene-zustaende.test.tsx` stellt die drei
            Verzeichnislagen mit echten Daten her, liest den Hinweis, den die Karte TATSÄCHLICH
            zeichnet, und verlangt genau dieses Wort im Hilfetext. */}
        <HelpTip
          title={t("seitenhilfe.admin.protokoll.titel")}
          body={t("seitenhilfe.admin.protokoll.text")}
        />
        <Abfragehuelle abfrage={audit}>
          {(entries) => {
            const recent = entries.slice(-12).reverse();
            return (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-pill bg-trust-pos-bg px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-trust-pos-text">
                    {t("adm.sich.auditCount", { count: entries.length })}
                  </span>
                  {/* SCRUM-439: Knopf print-versteckt, Ergebnis bleibt sichtbar. */}
                  <Button
                    variant="outline"
                    className="print-hide"
                    disabled={verifyAudit.isPending}
                    onClick={() => verifyAudit.mutate()}
                  >
                    <ShieldCheck size={14} /> {t("adm.sich.verify.button")}
                  </Button>
                  {/* AUFTRAG-mega14 Block A-2 (bens SB-1): DREI Zustände. Die Einordnung liegt in
                      lib/auditVerifyState.ts — die Oberfläche rendert nur, sie urteilt nicht. */}
                  {verifyAudit.data
                    ? (() => {
                        const view = auditVerifyView(verifyAudit.data);
                        return (
                          <span
                            data-testid="audit-verify-result"
                            data-tone={view.tone}
                            className={`rounded-pill px-2 py-0.5 text-[11px] font-semibold ${AUDIT_VERIFY_TONE_CLASS[view.tone]}`}
                          >
                            {t(view.key, {
                              ...view.params,
                              ...(view.kindKey ? { kind: t(view.kindKey) } : {}),
                            })}
                          </span>
                        );
                      })()
                    : null}
                </div>
                {recent.length === 0 ? (
                  <p className="text-[13px] text-muted">{t("adm.auditEmpty")}</p>
                ) : (
                  <div className="divide-y divide-hairline">
                    {recent.map((e) => (
                      <div key={e.seq} data-audit-eintrag={e.seq} className="py-2 text-[12.5px]">
                        <span className="font-mono text-[11px] text-muted-2">
                          {new Date(e.at).toLocaleString()}
                        </span>
                        {/* Beschriftungsliste statt Spaltenreihe: erst die Beschriftung sagt, wer
                            wer ist. Reiner Text — kein Tabstopp, kein Bedienelement. */}
                        <dl className="mt-1 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-0.5">
                          <dt className="text-[11.5px] text-muted-2">{t("audit.detail.event")}</dt>
                          <dd
                            data-audit-zeile="audit.detail.event"
                            className="min-w-0 font-semibold text-text"
                          >
                            {auditActionLabel(e.action, t)}
                          </dd>
                          {auditEventDetail(e, verzeichnis).map((zeile) => (
                            <Fragment key={zeile.labelKey}>
                              <dt className="text-[11.5px] text-muted-2">{t(zeile.labelKey)}</dt>
                              <dd data-audit-zeile={zeile.labelKey} className="min-w-0 text-muted">
                                <DetailWert zeile={zeile} />
                              </dd>
                            </Fragment>
                          ))}
                        </dl>
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          }}
        </Abfragehuelle>
      </Detailkarte>
    </div>
  );
}

/** SCRUM-432/444: Datenschutz & Sicherheit — nur echte Systemeigenschaften, keine Versprechen. */
export function DatenschutzDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="print-area">
      <Detailkarte
        titel={t("adm.sich.dataTitle")}
        onZurueck={onZurueck}
        testId="detail-datenschutz"
        kopfAktion={<DruckKnopf />}
        hilfe={[{ titel: t("adm.sich.dataTitle"), text: t("adm.sich.dataHelp") }]}
      >
        {/* JOB 3670: „einstellen lässt sich hier nichts" ist der ehrliche Kern dieser Karte — sie
            rendert eine feste Liste (`lib/securityStatements.ts`) und den Abgrenzungskasten,
            kein einziges Bedienelement ausser dem Drucken. */}
        <HelpTip
          title={t("seitenhilfe.admin.datenschutz.titel")}
          body={t("seitenhilfe.admin.datenschutz.text")}
        />
        <ul className="space-y-2.5">
          {SECURITY_POINTS.map((p) => (
            <li key={p.id} className="flex items-start gap-2.5">
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-trust-pos-text" />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-text">{t(p.titleKey)}</span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">
                  {t(p.bodyKey)}
                </span>
              </span>
            </li>
          ))}
        </ul>
        {/* SCRUM-444 (Berater-Frage 7): „Vertrauen ist Evidenz, nie behauptet." Grenzt gemessene
            Live-Werte klar von Zielwerten/Beispielrechnungen ab. */}
        <p className="rounded-card border border-hairline bg-page px-3 py-2 text-[11px] leading-relaxed text-muted-2">
          {t("adm.sich.evidenceNote")}
        </p>
      </Detailkarte>
    </div>
  );
}

/** SCRUM-437 (Pedi 03.07., VIP): Bereitschafts-Checkliste — je Zeile eine Ampel aus echten Zahlen. */
export function BereitschaftDetail({
  onZurueck,
  onDemodaten,
}: {
  onZurueck: () => void;
  onDemodaten: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const aiConfig = useQuery({ queryKey: ["reasonerConfig"], queryFn: endpoints.reasoner.config });
  const analytics = useAnalytics();
  const board = useValidationBoard();
  const uploadLimitsQ = useQuery({
    queryKey: ["upload-limits"],
    queryFn: endpoints.uploadLimits.get,
  });
  const extPolicy = useQuery({
    queryKey: ["external", "policy"],
    queryFn: endpoints.external.policy,
  });
  // AUFTRAG-mega14 Block H: LESENDER Demodaten-Stand — kein zweiter Lade-/Entfernen-Weg.
  const demoStatus = useQuery({
    queryKey: ["admin", "demo-status"],
    queryFn: endpoints.admin.demoStatus,
  });

  // JOB 3065 R3 (BENs Korrekturpflicht 1) — DIE SECHSTE QUELLE WURDE NIE WIEDERHOLT.
  //
  // Bis hierher zählte die Gruppe SECHS Quellen, „Erneut versuchen" rief aber nur FÜNF davon neu ab:
  // `demoStatus` fehlte in der Liste. Ein 503 auf `/api/admin/demo-seed` ließ die Karte damit im
  // Fehlerzustand stehen, während der Knopf Arbeit vortäuschte — BENs Messung: der Abrufzähler blieb
  // vor und nach dem Klick bei 3. Genau die Sorte Scheinfunktion, die dieser Auftrag ausschließt.
  //
  // Die Wiederholung wird deshalb nicht mehr AUFGEZÄHLT, sondern AUS DER GRUPPE ABGELEITET: was die
  // Gruppe bildet, wird auch wiederholt. Eine siebte Quelle kann nicht mehr still danebenstehen.
  const readySources = [aiConfig, analytics, board, uploadLimitsQ, extPolicy, demoStatus];
  const retryReady = (): void => {
    for (const quelle of readySources) {
      void quelle.refetch();
    }
  };

  // JOB 3065 R5 (BENs Korrekturpflicht 1) — DER VERBINDUNGSABBRUCH ERREICHTE DIESE KARTE NICHT.
  //
  // BENs Messung an Runde 4: vollständiger Bestand, danach `onlineManager.setOnline(false)` — und
  // sichtbar blieben „Teilweise verbunden", „2" und „10 Anhänge · 20 MB" ohne jeden Hinweis. Der
  // Grund lag in `lib/loadingState.ts`: es kennt nur `isError`, also ausschließlich einen
  // GESCHEITERTEN Abruf. Ein Netzabbruch ohne laufende Abfrage ist aber gar kein Fehler — er
  // verhindert nur, dass je wieder einer stattfindet.
  //
  // Die Karte liest den Onlinezustand jetzt reaktiv und faltet ihre sechs Quellen über
  // `gruppenlage()` auf dieselbe Lage, aus der auch die Zeile ihren Wert zieht: ein Zustandsmodell
  // für Fläche und Karte, keine zweite Auslegung.
  const online = useIstOnline();
  const lagen = readySources.map((q) => abfragelage(q, online));
  const gruppe = gruppenlage(lagen);

  // JOB 4363 H6-D1b — DIE STÖRUNG IST ERST VORBEI, WENN EINE NEUE ANTWORT DA IST.
  //
  // Bis hierher stand hier `wertBefund(gruppe, null)` ohne viertes Argument, und der Hinweis
  // verschwand in dem Augenblick, in dem `onlineManager` wieder „online" meldete. Das ist genau
  // die voreilige Frischmeldung: mit der produktiven Frischefrist (`ZAEHLER_FRISCHE_MS` = 30 s,
  // zugleich die `staleTime` in `main.tsx:44`) holt react-query nach einer KURZEN Unterbrechung
  // gar nichts nach — `refetchOnReconnect` findet keine abgelaufene Abfrage. Sichtbar blieben
  // dieselben sechs Zahlen von vorhin, und über ihnen stand nichts mehr.
  //
  // Das Gedächtnis lebt bewusst NUR in dieser Karte und nicht in einem Speicher: eine
  // Störungshistorie über beliebige Ansichtswechsel ist ausdrücklich Nichtziel dieses Auftrags.
  //
  // ================================================================================================
  // RUNDE 2 · BENs KORREKTURPFLICHT 1 — EINE ZAHL FÜR SECHS QUELLEN WAR ZU WENIG.
  // ================================================================================================
  //
  // Runde 1 merkte sich EINEN Wert: den Gruppenstand bei Störungsbeginn, und die Hülle vergleicht
  // ihn mit dem Gruppenstand von jetzt (`zeilenWert.ts:94`, `lage.standMs <= standBeiStoerung`).
  // Der Gruppenstand ist aber das MINIMUM der sechs Quellen (`gruppenlage`, „so frisch wie ihre
  // ÄLTESTE Zahl"). Antwortet ausgerechnet die ÄLTESTE Quelle, STEIGT dieses Minimum auf den Stand
  // der zweitältesten — ohne dass irgendeine der anderen fünf etwas Neues geliefert hätte.
  //
  // BEN hat genau das gemessen (Runde 1, zwei Gegenproben): Ausgangsstand 09:58, nur die älteste
  // Quelle antwortet, fünf bleiben `fetching` — sichtbar war „Stand von 09:59 · wird gerade
  // aufgefrischt". Der alte Stand UND der Netzlückensatz waren fort, obwohl fünf Antworten fehlten.
  // Ebenso mit einem Teilfehler: „Stand von 09:59 · Veraltet – Aktualisierung fehlgeschlagen",
  // wo 09:58 hätte stehen müssen. Das ist die voreilige Frischmeldung in ihrer feineren Form.
  //
  // DESHALB MERKT SICH DIE KARTE JETZT JE QUELLE IHREN STAND, und die Störung ist erst vorbei,
  // wenn AUSNAHMSLOS JEDE Quelle seither eine NEUE erfolgreiche Antwort geliefert hat
  // (`l.standMs > gemerkt[i]`, echt grösser). Bis dahin zeigt die Karte den bestätigten Stand von
  // damals — das Minimum der GEMERKTEN Zahlen, nicht das der heutigen. Genau das sagt K3 zu:
  // „Erst erfolgreiche neue Antwort aller tragenden Quellen erneuert den Stand."
  //
  // ================================================================================================
  // RUNDE 3 · BENs KORREKTURPFLICHT — DAS GEDÄCHTNIS BEGINNT MIT DER AUFFRISCHUNG, NICHT MIT DEM
  // FEHLER.
  // ================================================================================================
  //
  // Runde 2 legte das Gedächtnis erst an, wenn ein Fehler oder eine Pause da WAR. Treffen vorher
  // schon erfolgreiche Teilantworten ein, stehen deren NEUE Zahlen bereits im Gedächtnis — der
  // bestätigte Stand ist dann schon vorgezogen, bevor er überhaupt gemerkt wird.
  //
  // BEN hat es gemessen (Runde 2): Stände 10:00 (älteste) und 10:01 (fünf), Auffrischung OHNE
  // vorherige Offlinephase; die älteste antwortet erfolgreich, DANACH scheitert die Kennzahlquelle.
  // Sichtbar war „Stand von 10:01 · Veraltet – Aktualisierung fehlgeschlagen", richtig wäre 10:00.
  //
  // Die Episode beginnt deshalb, sobald ÜBERHAUPT eine Auffrischung läuft (`gruppe.laeuft`) oder
  // eine Störung ansteht — also zu dem Zeitpunkt, an dem der bestätigte Stand noch unversehrt ist.
  // Ob daraus eine STÖRUNG wird, ist eine zweite, eigene Frage: `stoerung` im Gedächtnis wird wahr,
  // sobald zwischendurch ein Fehler oder eine Pause auftritt, und bleibt es bis zum Ende der
  // Episode. Eine störungsfreie Auffrischung trägt damit weiterhin nur die ruhige Zeile
  // „Stand von … · wird gerade aufgefrischt" und keinen Warnton.
  //
  // `wertBefund` bleibt unverändert und wird weiter für die LADE-/FEHLER-/OFFLINE-Weiche benutzt;
  // sein viertes Argument (das Ein-Zahl-Gedächtnis) braucht die Karte nicht mehr. `zeilenWert.ts`
  // ist Nichtziel dieses Auftrags und wird nicht angefasst — die Hülle und die Zeilen behalten
  // ihren Vertrag, weil sie je EINE Quelle führen und dort eine Zahl auch wirklich genügt.
  //
  // WARUM EIN `useRef` UND KEIN `useState` — gemessen, nicht gewählt.
  //
  // Der erste Entwurf dieser Runde führte das Gedächtnis wie die Hülle als Zustand mit einer
  // Nachführung WÄHREND des Renderns (`if (neu !== alt) setStandBeiStoerung(neu)`). Damit blieb
  // die Karte nach der Wiederverbindung auf „ohne Netzverbindung nicht aktualisiert" stehen,
  // obwohl das Netz zurück war. Eine Sonde neben der Karte, die dasselbe `useIstOnline()` liest,
  // meldete zur selben Zeit `true` — die Karte selbst zeichnete also gar nicht neu
  // (`tests/h6-bereitschaft-stand-nutzerweg/bereitschaftstand-nutzerweg.test.tsx`, Abschnitt K3).
  //
  // Die Ursache liegt im Zusammenspiel von `useSyncExternalStore` (das `useIstOnline()` trägt,
  // `lib/netzzustand.ts`) mit einer Aktualisierung während des Renderns: React verwirft den
  // begonnenen Renderdurchlauf und führt die Komponente erneut aus. Im zweiten Durchlauf ist der
  // Abzug des Speichers gegenüber dem ERSTEN Durchlauf unverändert, React legt deshalb keinen
  // Nachtrag-Effekt mehr an — und der zuletzt FESTGEHALTENE Wert des Speichers bleibt der von
  // VOR der Störung. Die nächste Meldung („wieder online") vergleicht gegen diesen alten Wert,
  // findet „unverändert" und zeichnet nicht neu.
  //
  // Ein Ref hat dieses Problem baulich nicht: er löst keine Aktualisierung aus, der Renderdurchlauf
  // bleibt einer, und die Zeichnung hängt weiter allein an den echten Auslösern (Onlinewechsel und
  // Abfragezustand). Die Nachführung bleibt synchron VOR der Ausgabe — kein Effekt, der die
  // Störung erst nach einem unmarkierten Bild bemerkt. Sie ist dabei wiederholbar: derselbe
  // Eingang ergibt denselben Wert, auch beim Doppeldurchlauf unter StrictMode.
  const laufendeEpisode = useRef<{ staende: readonly number[]; stoerung: boolean } | null>(null);
  const befund = wertBefund(gruppe, null);
  const ohneBestand = befund.art === "fehler" || befund.art === "offline";

  // Die Störung, wie sie die Abfragen JETZT melden — ohne Gedächtnis.
  const roheStoerung = gruppe.fehler || gruppe.pausiert;
  // Ohne sichtbaren Bestand gibt es nichts zu merken: dann trägt der Lade-, Leer- oder Fehlerweg
  // die Auskunft, und ein „Stand von" ohne Stand wäre ein Verweis auf etwas, das der Mensch
  // nirgends sieht.
  const merkenNoetig = (roheStoerung || gruppe.laeuft) && gruppe.hatDaten;
  const staendeJetzt = lagen.map((l) => l.standMs);

  // ================================================================================================
  // RUNDE 4 · BENs KORREKTURPFLICHT — DER RUHESTAND WIRD LAUFEND GEFÜHRT, NICHT ERST BEI BEDARF.
  // ================================================================================================
  //
  // Runde 3 nahm beim BEGINN einer Episode die Stände von JETZT. Das setzt voraus, dass React
  // zwischen „der Abruf läuft los" und „die erste Antwort ist da" überhaupt ein Bild zeichnet.
  // Tut es das nicht — und bei einer schnell antwortenden Quelle tut es das oft nicht —, dann
  // steht deren NEUE Zahl schon im allerersten Bild der Episode, und der bestätigte Stand ist
  // wieder vorgezogen. BEN hat genau das gemessen (Runde 3): ohne erzwungenen Zwischenrender
  // erschien „Stand von 10:01" statt „Stand von 10:00".
  //
  // Eine Komponente sieht nur Momentaufnahmen; einen Zustand, der zwischen zwei Bildern entstand
  // und verging, kann sie nachträglich nicht erfahren. Sie muss ihn also VORHER festgehalten
  // haben. Deshalb führt die Karte den zuletzt gesehenen RUHESTAND fortlaufend mit: in jedem
  // Bild, in dem alle sechs Quellen Daten haben, nichts läuft und nichts gestört ist, sind die
  // aktuellen Stände der letzte vollständig bestätigte Stand. Beginnt später eine Episode, greift
  // sie auf diesen Wert zurück — unabhängig davon, was React dazwischen gezeichnet hat.
  //
  // Der Rückfall auf `staendeJetzt` bleibt für den einen Fall, in dem es noch keinen ruhigen
  // Augenblick gab (die Karte geht unmittelbar vom Erstladen in eine Auffrischung über). Dann ist
  // der aktuelle Stand der beste bekannte — mehr weiss niemand.
  const letzterRuhestand = useRef<readonly number[] | null>(null);
  const ruhestandVorher = letzterRuhestand.current;
  if (gruppe.hatDaten && (!(roheStoerung || gruppe.laeuft) || ruhestandVorher === null)) {
    letzterRuhestand.current = staendeJetzt;
  }

  const gemerkt = laufendeEpisode.current;
  // Erneuert ist die Gruppe erst, wenn JEDE Quelle seit dem Beginn der Episode neu geantwortet hat.
  const allesErneuert =
    gemerkt !== null &&
    lagen.every((l, i) => l.standMs > (gemerkt.staende[i] ?? Number.POSITIVE_INFINITY));

  let episode = gemerkt;
  if (gemerkt === null) {
    // Beginn: der zuletzt gesehene RUHESTAND ist der letzte vollständig bestätigte Stand — nicht
    // der von jetzt, in dem eine schnelle Teilantwort schon stecken könnte.
    episode = merkenNoetig
      ? { staende: ruhestandVorher ?? staendeJetzt, stoerung: roheStoerung }
      : null;
  } else if (allesErneuert && !roheStoerung) {
    // Die Runde ist durch: der bestätigte Stand ist jetzt der neue. Läuft schon die nächste
    // Auffrischung, beginnt mit ihr sofort die nächste Episode — sonst ist nichts mehr zu sagen.
    episode = gruppe.laeuft ? { staende: staendeJetzt, stoerung: false } : null;
  } else if (!roheStoerung && !gruppe.laeuft && !gemerkt.stoerung) {
    // Eine störungsfreie Auffrischung ist beendet, ohne dass alle Quellen geantwortet hätten
    // (etwa weil nur die abgelaufenen geholt wurden). Es gab keine Störung, also gibt es auch
    // nichts zu melden — das Gedächtnis wird verworfen.
    episode = null;
  } else if (roheStoerung && !gemerkt.stoerung) {
    // AUS DER AUFFRISCHUNG WIRD EINE STÖRUNG: die Stände von damals bleiben, die Einordnung
    // wechselt. Genau hier lag BENs Befund aus Runde 2.
    episode = { staende: gemerkt.staende, stoerung: true };
  }
  laufendeEpisode.current = episode;

  const gestoert = episode?.stoerung ?? false;
  // Der ANGEZEIGTE Stand ist IMMER der zuletzt vollständig bestätigte: das Minimum der GEMERKTEN
  // Zahlen vom Beginn der Episode. Ohne Episode gibt es nichts zu zeigen (die Karte ist frisch,
  // oder sie steht im Lade-/Fehlerweg).
  const bestaetigterStand = episode !== null ? Math.min(...episode.staende) : 0;

  return (
    <div className="print-area">
      <Detailkarte
        titel={t("adm.ready.title")}
        onZurueck={onZurueck}
        testId="detail-bereitschaft"
        kopfAktion={<DruckKnopf />}
        hilfe={[
          { titel: t("adm.ready.title"), text: t("adm.ready.help") },
          { titel: t("adm.ready.title"), text: t("adm.ready.intro") },
          { titel: t("adm.ready.title"), text: t("adm.ready.note") },
        ]}
      >
        {/* JOB 3670: VOR der Weiche, nicht in einem ihrer Zweige. Gerade der Fehlerzustand ein paar
            Zeilen tiefer ist der Moment, in dem der Satz über den Wiederholknopf gebraucht wird —
            hinge die Hilfe im Erfolgszweig, wäre sie genau dann weg. */}
        <HelpTip
          title={t("seitenhilfe.admin.bereitschaft.titel")}
          body={t("seitenhilfe.admin.bereitschaft.text")}
        />
        {/* AUFTRAG-mega3 Block B (bens D9): dauerhaft gescheiterte tragende Quelle ⇒ ehrlicher
            Fehlerzustand mit Wiederholen; Stale-Daten bleiben sichtbar, aber markiert. */}
        {ohneBestand ? (
          // JOB 3065 R3: dieselbe Fehlerbox wie in jeder anderen Detailkarte — ein Wortlaut, ein
          // Ausweg. Der Ladezustand der Gruppe bleibt dagegen ihr eigener (mega2/mega3: je Zeile
          // „wird geladen", keine vorschnelle 0), und der Stale-Marker ebenfalls.
          <Fehlerbox offline={befund.art === "offline"} onErneut={retryReady} />
        ) : (
          <>
            {/* JOB 4363 H6-D1b: statt des einen `StaleMarker`-Satzes für ALLE Störungen jetzt der
                Stand mit seiner Zeit und der Satz, der zur tatsächlichen Lage gehört — ruhender
                Abruf, gescheiterter Abruf oder Netzlücke. Die Karte legt hier nichts aus; was sie
                übergibt, ist der Befund aus `zeilenWert.ts`. */}
            <Bereitschaftstandhinweis
              standMs={bestaetigterStand}
              gestoert={gestoert}
              pausiert={gruppe.pausiert}
              fehler={gruppe.fehler}
              laeuft={gruppe.laeuft}
              onErneut={retryReady}
            />
            <ul className="divide-y divide-hairline">
              {readinessRows({
                kiBoth:
                  (aiConfig.data?.cloudConfigured ?? false) &&
                  (aiConfig.data?.localConfigured ?? false),
                kiAny:
                  (aiConfig.data?.cloudConfigured ?? false) ||
                  (aiConfig.data?.localConfigured ?? false),
                validated: analytics.data?.byStatus.validiert ?? 0,
                openReviews: board.data?.length ?? 0,
                uploadLimits: uploadLimitsQ.data ?? null,
                externalStage: extPolicy.data?.stage ?? null,
                demo: demoStatus.data ?? null,
                // Block C: atomar erst „geladen", wenn ALLE tragenden Quellen Daten haben — sonst
                // behauptet die Karte vor der Datenladung „keine KI"/„0 validiert".
                loading: befund.art === "laedt",
              }).map((row) => (
                <li key={row.id} className="flex items-center gap-3 py-2.5 text-[13px]">
                  <span className="font-semibold text-text">{t(row.labelKey)}</span>
                  {/* AUFTRAG-mega14 Block H: die Demodaten-Zeile FÜHRT zum bestehenden Bereich,
                      statt einen zweiten Lade-/Entfernen-Weg aufzumachen. */}
                  {row.id === "demo" ? (
                    <button
                      type="button"
                      onClick={onDemodaten}
                      className="text-[12px] font-semibold text-ai hover:underline"
                    >
                      {t("adm.ready.demo.goto")}
                    </button>
                  ) : null}
                  <span
                    className={`ml-auto rounded-pill px-2.5 py-0.5 text-[11.5px] font-semibold ${
                      READY_TONE_CLASS[row.tone]
                    }`}
                  >
                    {row.params ? t(row.valueKey, row.params) : t(row.valueKey)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Detailkarte>
    </div>
  );
}
