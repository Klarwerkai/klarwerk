import { useMutation, useQuery } from "@tanstack/react-query";
// JOB 3065 H6 — DIE DETAILKARTEN DES REITERS „SICHERHEIT".
//
// Prüfprotokoll (hash-verkettet, mit aktiver Integritätsprüfung), Datenschutz-Nachweis und die
// Bereitschafts-Checkliste. Letztere war bis hierher ein eigener fünfter Reiter; sie ist eine
// Auskunft über den Zustand des Hauses und lebt deshalb als Zeile „Bereitschaft" unter Sicherheit
// weiter — mit derselben Checkliste, denselben Quellen und demselben Druckknopf.
import { Printer, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useAnalytics, useAudit, useValidationBoard } from "../api/hooks";
import { useToast } from "../app/ToastContext";
import { StaleMarker } from "../components/LoadState";
import { Abfragehuelle, Fehlerbox } from "../components/einstellungen/Abfragehuelle";
import { Detailkarte } from "../components/einstellungen/Detailkarte";
import {
  abfragelage,
  gruppenlage,
  useIstOnline,
  wertBefund,
} from "../components/einstellungen/zeilenWert";
import { Button } from "../components/ui";
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
 * SCRUM-432 (Pedi 03.07., VIP-Investor): das hash-verkettete Prüfprotokoll.
 * AUFTRAG-mega15 Block A: die Texte behaupten keine Unveränderbarkeit — belegbar ist die
 * Prüfbarkeit (s. tests/app/chain-claims.test.ts).
 */
export function PruefprotokollDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  const { push } = useToast();
  const audit = useAudit();
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
                      <div key={e.seq} className="flex items-center gap-3 py-2 text-[12.5px]">
                        <span className="font-mono text-[11px] text-muted-2">
                          {new Date(e.at).toLocaleString()}
                        </span>
                        <span className="font-semibold text-text">{e.action}</span>
                        <span className="truncate text-[11.5px] text-muted">{e.target}</span>
                        <span className="ml-auto truncate font-mono text-[11px] text-muted-2">
                          {e.actor}
                        </span>
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
  const befund = wertBefund(gruppenlage(readySources.map((q) => abfragelage(q, online))), null);
  const ohneBestand = befund.art === "fehler" || befund.art === "offline";

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
        {/* AUFTRAG-mega3 Block B (bens D9): dauerhaft gescheiterte tragende Quelle ⇒ ehrlicher
            Fehlerzustand mit Wiederholen; Stale-Daten bleiben sichtbar, aber markiert. */}
        {ohneBestand ? (
          // JOB 3065 R3: dieselbe Fehlerbox wie in jeder anderen Detailkarte — ein Wortlaut, ein
          // Ausweg. Der Ladezustand der Gruppe bleibt dagegen ihr eigener (mega2/mega3: je Zeile
          // „wird geladen", keine vorschnelle 0), und der Stale-Marker ebenfalls.
          <Fehlerbox offline={befund.art === "offline"} onErneut={retryReady} />
        ) : (
          <>
            {befund.nichtAktualisiert ? <StaleMarker onRetry={retryReady} /> : null}
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
