// ==================================================================================================
// JOB 3065 H6 — „EINSTELLUNGEN" NACH DEM PAGES-MASSSTAB (Zielbild `design/klarwerk/Admin.dc.html`).
// ==================================================================================================
//
// Pedi 04.09. 06:50: Apple Pages — Knopf und Feld erklären sich selbst, Erklärtext im Verhältnis
// 1:100. Bis hierher war diese Seite die texthaltigste der App: 1844 Zeilen, zwölf Hilfe-Zeichen, eine
// Kartenwand mit Fließtext über fünf Pillen-Bereiche.
//
// JETZT: links die Themenspalte, rechts Karten aus Zeilen — Label links, Wert rechts, dahinter ein
// Chevron in die Detailkarte oder ein Schloss (nur lesbar). Auf der Fläche steht sonst KEIN Satz;
// gemessen von `tests/design/zielbild-h6-kein-erklaertext.test.ts`.
//
// NICHTS GEHT VERLOREN (Pedi 04.09. 07:58): jede Karte von gestern lebt als Detailkarte weiter
// (`AdminKontenDetails` · `AdminKiDetails` · `AdminDatenDetails` · `AdminSicherheitDetails`), jeder
// Hilfetext im „?"-Menü seiner Karte. Das Inventar hält `tests/design/h6-funktionsinventar.test.ts`.
//
// EHRLICHKEIT VOR OPTIK: der Wert jeder Zeile entsteht aus `components/einstellungen/zeilenWert.ts`
// — „–" solange geladen oder offline, „nicht abrufbar" bei Fehler, „keine" nur nach einer
// erfolgreichen leeren Antwort, und ein Bestand aus dem Zwischenspeicher trägt „Stand von …" bzw.
// zusätzlich „nicht aktualisiert" (REGELN §7, Auftrag §9).
//
// ==================================================================================================
// JOB 3337 · ADMIN-NAVIGATION — SIEBEN THEMEN, UND EIN ZUSTAND, DEN MAN ADRESSIEREN KANN.
// ==================================================================================================
//
// Pedi 08.09.: „alle im Admin-Bereich befindlichen Seiten … schlecht und unlogisch." Zwei Befunde
// von Codex stehen dahinter, und beide sind hier behoben:
//
//   1  DIE GLIEDERUNG. Vier Behälter (Konten · KI · Daten · Sicherheit) sind jetzt die sieben
//      Themen der Vorlage. Welche Detailkarte in welchem Thema wohnt, steht NICHT mehr in dieser
//      Datei verstreut, sondern einmal in `lib/adminSections.ts` — dieselbe Quelle, aus der das
//      Menü und der Direktzugang ihre Namen und Wege ziehen.
//
//   2  DER ZUSTAND WAR NICHT ADRESSIERBAR. Reiter und offene Karte lagen in `useState`
//      (`Admin.tsx:93-95` im Befund): ein Neuladen, ein Browser-Zurück oder ein weitergegebener
//      Link landeten IMMER wieder auf „Konten". Jetzt trägt die Adresse den Zustand
//      (`/admin?bereich=…&detail=…`), und zwar über `useSearchParams` — also über den Router, der
//      seinen History-Index selbst stempelt (`tests/app/navguard-history-authority.test.ts`).
//
//      DER QUERYTEXT WIRD GEPRÜFT, BEVOR ER ZUSTAND WIRD. `isAdminSectionId`/`isAdminDetailId`
//      sind die Weiche; was nicht durchkommt, führt auf die Übersicht des Themas und ruft keine
//      Komponente auf. `/admin` ohne Query bleibt wortgleich gültig — alle alten Links, Hilfe-
//      kapitel und FAQ-Einträge zeigen weiterhin dorthin.
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { endpoints } from "../api/endpoints";
import { useAnalytics, useAudit, useUsers, useValidationBoard } from "../api/hooks";
import { GuardedLink, useGuardedNavigate } from "../app/NavGuardContext";
import { useRole } from "../app/RoleContext";
import { ALL_ITEMS, ROLES, type Role, anzeigeNameKey, canSee, roleAllows } from "../app/navigation";
import { isAdminDetailId, verwaltungsPfadTeile } from "../app/navigationGliederung";
import { Fehlerbox } from "../components/einstellungen/Abfragehuelle";
import { Detailkarte } from "../components/einstellungen/Detailkarte";
import { EinstellungenSeite } from "../components/einstellungen/Seite";
import {
  Flaechenknopf,
  Kicker,
  Zeile,
  Zeilenkarte,
  useWertText,
} from "../components/einstellungen/Zeilenkarte";
import { freiheitenSchluessel, kiWahlFrei } from "../components/einstellungen/rollenFreiheiten";
import {
  abfragelage,
  gruppenlage,
  useIstOnline,
  wertBefund,
} from "../components/einstellungen/zeilenWert";
import { isUserAuditAction } from "../lib/adminForms";
import {
  ADMIN_SECTIONS,
  type AdminSectionId,
  DEFAULT_ADMIN_SECTION,
  adminHref,
  adminSectionFuerDetail,
  isAdminSectionId,
} from "../lib/adminSections";
import { aiAccessRows, anbieterUndModell } from "../lib/aiOverview";
import { ANALYTICS_AUDIT_PATH } from "../lib/analyticsSections";
import { SECURITY_POINTS } from "../lib/securityStatements";
import { readinessRows } from "../lib/vipReadiness";
import {
  AuditDetail,
  DemodatenDetail,
  PapierkorbDetail,
  WerkseinstellungenDetail,
} from "./AdminDatenDetails";
import {
  KiDetail,
  KiDupDetail,
  KiExternDetail,
  KiFunktionenDetail,
  KiGrenzenDetail,
  KiZugaengeDetail,
} from "./AdminKiDetails";
import {
  AnsichtAlsRolleDetail,
  NutzerAnlegenDetail,
  NutzerDetail,
  RolleDetail,
} from "./AdminKontenDetails";
import {
  BereitschaftDetail,
  DatenschutzDetail,
  PruefprotokollDetail,
} from "./AdminSicherheitDetails";

/**
 * Eine Zeile, die AUS der Verwaltung hinausführt (Kurzlink).
 *
 * Sie sieht aus wie eine Zeile und verhält sich wie ein Link — deshalb trägt sie bewusst KEIN
 * `data-einst="chevron"`: das Chevron verspricht in dieser Fläche eine Detailkarte, und wer es hier
 * sähe, erwartete eine Karte statt eines Seitenwechsels. Der Pfeil nach schräg oben ist die
 * eingeführte Form für „führt woandershin".
 *
 * NAVIGATION LÄUFT ÜBER `GuardedLink` — also durch den Ungespeichert-Wächter, wie jeder andere Weg
 * der Hülle (mega39 B). Runde 1 hatte hier ein rohes `Link` stehen, weil vier ältere gemountete
 * Messungen dieser Seite ohne `NavGuardProvider` montieren; Codex hat das in Runde 2 verworfen —
 * eine Schutzregel wird nicht nach der Bequemlichkeit eines Prüfstands geschnitten. Die vier
 * Prüfstände montieren den Anbieter jetzt mit.
 */
function Kurzlink({
  label,
  wert,
  to,
  testId,
}: {
  label: string;
  wert?: string;
  to: string;
  testId?: string;
}): JSX.Element {
  return (
    <GuardedLink
      to={to}
      data-einst="zeile"
      data-testid={testId}
      className="flex w-full items-center justify-between border-b border-hairline px-4 py-[13px] text-left no-underline last:border-b-0 hover:bg-hairline-soft"
    >
      <span data-einst="label" className="min-w-0 text-[14px] text-text">
        {label}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-[14px] text-muted-2">
        {wert === undefined ? null : <span data-einst="wert">{wert}</span>}
        <ArrowUpRight data-einst="kurzlink" size={13} strokeWidth={2} aria-hidden="true" />
      </span>
    </GuardedLink>
  );
}

/**
 * Ein Bereich der App, den die Verwaltung als Kurzlink anbietet — mit der ehrlichen Unterscheidung,
 * die die Vorlage ausdrücklich verlangt: „Modul ausgeschaltet ist nicht fehlende Rolle."
 *
 *   Rolle reicht nicht  → die Zeile steht gar nicht da (Rechte bleiben, was sie sind).
 *   Rolle reicht, Stufe 2 aus → die Zeile steht da, sagt „Modul aus" und trägt ein Schloss.
 *                               Der Weg zum Einschalten steht als Kicker unter der Karte; hier
 *                               wird NICHTS still aktiviert.
 *   Beides an           → Kurzlink auf den bisherigen Bedienort.
 *
 * `anker` und `label` gibt es für den EINEN Fall, den Codex in Runde 2 gefunden hat: die
 * Beispiel-/Demopakete wohnen als Kasten AUF `/import` (`components/ExamplePackages.tsx`, Anker
 * `#demopakete`). Sie standen bis dahin als unbedingt aktiver Kurzlink im Thema „Vorführdaten" —
 * also wurde bei ausgeschalteter Stufe 2 ein gesperrtes Ziel angeboten, während dieselbe Datei
 * einen Zeilenabstand weiter oben denselben Bereich korrekt als „Modul aus" erklärte. Jetzt gehen
 * beide durch DIESE eine Regel; der Anker hängt nur hinten an derselben Route.
 */
function BereichsZeile({
  id,
  testId,
  anker,
  label,
}: {
  id: string;
  testId: string;
  anker?: string;
  label?: string;
}): JSX.Element | null {
  const { t } = useTranslation();
  const { role, stufe2 } = useRole();
  const item = ALL_ITEMS.find((i) => i.id === id);
  if (!item || !roleAllows(item, role)) {
    return null;
  }
  const name = label ?? t(anzeigeNameKey(item));
  if (!canSee(item, role, stufe2)) {
    return <Zeile label={name} wert={t("einst.modul.aus")} testId={testId} />;
  }
  return <Kurzlink label={name} to={`${item.path}${anker ?? ""}`} testId={testId} />;
}

/** Sieht diese Rolle den Bereich, hat er aber Stufe 2 aus? Dann gehört der Aktivierungsweg darunter. */
function useModulAusHinweis(ids: readonly string[]): boolean {
  const { role, stufe2 } = useRole();
  return ids.some((id) => {
    const item = ALL_ITEMS.find((i) => i.id === id);
    return item !== undefined && roleAllows(item, role) && !canSee(item, role, stufe2);
  });
}

export function Admin(): JSX.Element {
  const { t } = useTranslation();
  const online = useIstOnline();
  const wertText = useWertText();
  const { role, stufe2, setStufe2, canPreview, previewActive } = useRole();
  // Jeder Wechsel von Thema und Karte ist ab jetzt eine Navigation — und läuft deshalb durch
  // denselben Ungespeichert-Wächter wie jeder andere Weg der Anwendung (mega39 B).
  const navigate = useGuardedNavigate();
  const [params] = useSearchParams();

  // ------------------------------------------------------------------------------------------------
  // DER ZUSTAND KOMMT AUS DER ADRESSE — und zwar nur, was durch die Weiche passt.
  // ------------------------------------------------------------------------------------------------
  const detailRoh = params.get("detail") ?? "";
  const detail = isAdminDetailId(detailRoh) ? detailRoh : null;
  const bereichRoh = params.get("bereich") ?? "";
  // Das Thema folgt dem Detail: ein Link auf `?detail=papierkorb` landet auch ohne `bereich` unter
  // „Quellen und Daten" und nicht in einer Übersicht, in der die Karte gar nicht wohnt.
  const section: AdminSectionId =
    (detail === null ? null : adminSectionFuerDetail(detail)) ??
    (isAdminSectionId(bereichRoh) ? bereichRoh : DEFAULT_ADMIN_SECTION);

  const geheZu = (ziel: AdminSectionId, karte?: string): void => navigate(adminHref(ziel, karte));
  const zurueck = (): void => geheZu(section);

  // Die Quellen der Zeilenwerte. Es sind dieselben Queries (dieselben Schlüssel), die die
  // Detailkarten verwenden — ein Zwischenspeicher, ein Abruf.
  const users = useUsers();
  const audit = useAudit();
  const analytics = useAnalytics();
  const board = useValidationBoard();
  const aiConfig = useQuery({ queryKey: ["reasonerConfig"], queryFn: endpoints.reasoner.config });
  const presets = useQuery({
    queryKey: ["reasoner", "assistPresets"],
    queryFn: endpoints.reasoner.assistPresets,
  });
  const uploadLimitsQ = useQuery({
    queryKey: ["upload-limits"],
    queryFn: endpoints.uploadLimits.get,
  });
  const extPolicy = useQuery({
    queryKey: ["external", "policy"],
    queryFn: endpoints.external.policy,
  });
  const dupSettingsQ = useQuery({
    queryKey: ["duplicates", "settings"],
    queryFn: endpoints.duplicates.settings,
  });
  const demoStatus = useQuery({
    queryKey: ["admin", "demo-status"],
    queryFn: endpoints.admin.demoStatus,
  });
  const factoryResetStatus = useQuery({
    queryKey: ["factory-reset-status"],
    queryFn: endpoints.admin.factoryResetStatus,
  });
  const trash = useQuery({ queryKey: ["kos", "trash"], queryFn: endpoints.ko.trash });

  /** Der sichtbare Wert einer Zeile aus einer Abfrage — das Zustandsmodell in einer Zeile Code. */
  function wert(
    q: {
      data: unknown;
      isError: boolean;
      isFetching: boolean;
      fetchStatus: string;
      dataUpdatedAt: number;
    },
    fachwert: string | null,
    leer = false,
    leerText?: string,
  ): string {
    return wertText(wertBefund(abfragelage(q, online), fachwert, leer), leerText);
  }

  // ---- Konten -----------------------------------------------------------------------------------
  const nutzerBefund = wertBefund(
    abfragelage(users, online),
    users.data ? String(users.data.length) : null,
    (users.data?.length ?? 0) === 0,
  );
  // Die Standzeile erscheint nur, wenn sie etwas zu sagen hat: keine Daten, leerer Bestand oder ein
  // Bestand, der aus dem Zwischenspeicher stammt.
  const zeigeNutzerStand =
    nutzerBefund.art !== "wert" || nutzerBefund.standMs > 0 || nutzerBefund.nichtAktualisiert;
  /**
   * JOB 3065 R4 — BENs Korrekturpflicht 1.
   *
   * `/api/users` ist die EINZIGE Quelle der Einstellungen, deren Bedienort auf der Fläche selbst
   * liegt: hinter der Nutzerliste steht keine Detailkarte, die den Ausweg tragen könnte, und ohne
   * Nutzerzeilen gibt es auch kein Chevron in eine. Scheiterte der Abruf, sagte die Zeile deshalb
   * zwar ehrlich „nicht abrufbar", ließ den Admin aber ohne jeden Weg zurück — und nach dem Ende
   * einer vorübergehenden Störung kamen die Konten von selbst nicht wieder.
   *
   * Jetzt trägt die Fläche denselben Fehlerzustand wie jede Detailkarte: dieselbe `Fehlerbox`,
   * derselbe Wortlaut, derselbe Knopf, der `/api/users` WIRKLICH neu abruft (Auftrag §9: „Fehler =
   * Wert ‚nicht abrufbar' mit Knopf ‚Erneut'"). Liegen bereits Nutzer vor, bleiben sie sichtbar und
   * die Zeile nennt Stand und „nicht aktualisiert" — die Box tritt nur an, wenn NICHTS da ist.
   */
  const nutzerOhneAusweg = nutzerBefund.art === "fehler" || nutzerBefund.art === "offline";

  const freiheiten = (r: Role): string => {
    const worte = freiheitenSchluessel(r).map((k) => t(k));
    const kern = r === "viewer" ? worte.join(", ") : `+ ${worte.join(", ")}`;
    return kiWahlFrei(r) ? `${kern} · ${t("einst.rollen.kiWahl")}` : kern;
  };

  // ---- System: Bereitschaft ----------------------------------------------------------------------
  //
  // JOB 3065 R5 (BENs Korrekturpflicht 1): Die sechs Quellen laufen durch `gruppenlage()` und damit
  // durch DENSELBEN `wertBefund` wie jede einzelne Zeile. Vorher fasste `lib/loadingState.ts` sie
  // zusammen — das kennt nur `isError`, weshalb ein Verbindungsabbruch nach erfolgreichem Laden hier
  // unsichtbar blieb und die Zeile weiter „4 von 6 ohne Warnung" als frische Wahrheit trug.
  const readySources = [aiConfig, analytics, board, uploadLimitsQ, extPolicy, demoStatus];
  const readyLage = gruppenlage(readySources.map((q) => abfragelage(q, online)));
  const readyRows = readinessRows({
    kiBoth: (aiConfig.data?.cloudConfigured ?? false) && (aiConfig.data?.localConfigured ?? false),
    kiAny: (aiConfig.data?.cloudConfigured ?? false) || (aiConfig.data?.localConfigured ?? false),
    validated: analytics.data?.byStatus.validiert ?? 0,
    openReviews: board.data?.length ?? 0,
    uploadLimits: uploadLimitsQ.data ?? null,
    externalStage: extPolicy.data?.stage ?? null,
    demo: demoStatus.data ?? null,
    loading: !readyLage.hatDaten,
  });
  const bereitschaftWert = wertText(
    wertBefund(
      readyLage,
      // Die Zusammenfassung entsteht AUSSCHLIESSLICH aus vollständigen Daten; ohne sie gibt
      // `wertBefund` ohnehin keinen Wert aus (siehe `zeilenWert.ts`).
      readyLage.hatDaten
        ? t("einst.sich.bereitWert", {
            ok: readyRows.filter((r) => r.tone === "ok").length,
            gesamt: readyRows.length,
          })
        : null,
    ),
  );

  const auditNutzer = audit.data?.filter((e) => isUserAuditAction(e.action)) ?? [];
  const letzterEintrag = audit.data?.[audit.data.length - 1];

  const berichteAus = useModulAusHinweis(["output", "graph", "kapital"]);
  const quellenAus = useModulAusHinweis(["import"]);
  // SCRUM-229: der Audit-Deep-Link ist kein eigener Bereich — er hängt an der Sichtbarkeit von
  // Analytics, genau wie im Direktzugang (`app/navigationGliederung.ts`). Eine zweite Rechteregel
  // gibt es hier nicht.
  const analyticsItem = ALL_ITEMS.find((i) => i.id === "analytics");
  const analyticsSichtbar = analyticsItem !== undefined && canSee(analyticsItem, role, stufe2);

  // ---- Die Detailkarten --------------------------------------------------------------------------
  function detailKarte(): JSX.Element | null {
    if (detail === null) {
      return null;
    }
    if (detail.startsWith("nutzer:")) {
      return <NutzerDetail nutzerId={detail.slice("nutzer:".length)} onZurueck={zurueck} />;
    }
    if (detail.startsWith("rolle:")) {
      return <RolleDetail rolle={detail.slice("rolle:".length) as Role} onZurueck={zurueck} />;
    }
    switch (detail) {
      case "nutzerNeu":
        return <NutzerAnlegenDetail onZurueck={zurueck} />;
      case "ansichtRolle":
        return <AnsichtAlsRolleDetail onZurueck={zurueck} />;
      case "ki":
        return <KiDetail onZurueck={zurueck} />;
      case "kiZugaenge":
        return <KiZugaengeDetail onZurueck={zurueck} />;
      case "kiFunktionen":
        return <KiFunktionenDetail onZurueck={zurueck} />;
      case "kiGrenzen":
        return <KiGrenzenDetail onZurueck={zurueck} />;
      case "kiExtern":
        return <KiExternDetail onZurueck={zurueck} />;
      case "kiDup":
        return <KiDupDetail onZurueck={zurueck} />;
      case "demo":
        return <DemodatenDetail onZurueck={zurueck} />;
      case "werk":
        return <WerkseinstellungenDetail onZurueck={zurueck} />;
      case "papierkorb":
        return <PapierkorbDetail onZurueck={zurueck} />;
      case "audit":
        return <AuditDetail onZurueck={zurueck} />;
      case "protokoll":
        return <PruefprotokollDetail onZurueck={zurueck} />;
      case "datenschutz":
        return <DatenschutzDetail onZurueck={zurueck} />;
      case "bereitschaft":
        return (
          <BereitschaftDetail
            onZurueck={zurueck}
            onDemodaten={() => geheZu("vorfuehrdaten", "demo")}
          />
        );
      default:
        // Hierher kommt seit JOB 3337 kein Querytext mehr — `isAdminDetailId` hält ihn vorher auf.
        // Die Karte bleibt als letzte Auffanglinie stehen: ein künftiger interner Aufruf mit einer
        // Kennung, die in `ADMIN_DETAILS` fehlt, soll es SAGEN und zurückführen, nicht leer stehen.
        return (
          <Detailkarte titel={t("state.error")} onZurueck={zurueck}>
            <p className="text-[12.5px] text-muted-2">{t("einst.detail.unbekannt")}</p>
          </Detailkarte>
        );
    }
  }

  /**
   * Der lesbare Pfad über der Detailansicht: „Verwaltung › Vorführdaten › Demodaten".
   *
   * Vorlage, Punkt 5. Er ist eine AUSKUNFT, kein Bedienelement: der Rückweg ist der Knopf „Zurück"
   * in der Karte darunter, und zwei Rückwege nebeneinander wären zwei Wahrheiten über denselben
   * Schritt.
   */
  function pfadzeile(): ReactNode {
    return (
      <nav
        data-einst="pfad"
        aria-label={t("einst.pfad")}
        className="-mb-2 text-[12px] text-muted-2"
      >
        {verwaltungsPfadTeile(t, section, detail).join(" › ")}
      </nav>
    );
  }

  return (
    <EinstellungenSeite
      titel={t("einst.titel")}
      seitenSchluessel="admin"
      reiter={ADMIN_SECTIONS.map((s) => ({ id: s.id, label: t(s.labelKey) }))}
      aktiv={section}
      onWechsel={(id) => {
        if (isAdminSectionId(id)) {
          geheZu(id);
        }
      }}
    >
      {detail !== null ? (
        <>
          {pfadzeile()}
          {detailKarte()}
        </>
      ) : (
        <>
          {section === "konten" ? (
            <>
              <Zeilenkarte testId="flaeche-nutzer">
                {nutzerOhneAusweg ? (
                  <div className="px-4 py-[13px]">
                    <Fehlerbox
                      label={t("einst.konten.nutzer")}
                      offline={nutzerBefund.art === "offline"}
                      onErneut={() => void users.refetch()}
                    />
                  </div>
                ) : zeigeNutzerStand ? (
                  <Zeile
                    label={t("einst.konten.nutzer")}
                    wert={wertText(nutzerBefund, t("einst.konten.leer"))}
                    testId="zeile-nutzer-stand"
                  />
                ) : null}
                {(users.data ?? []).map((u) => (
                  <Zeile
                    key={u.id}
                    label={u.name}
                    wert={
                      u.approved
                        ? t(`role.name.${u.role}`)
                        : `${t(`role.name.${u.role}`)} · ${t("einst.konten.wartet")}`
                    }
                    onOeffnen={() => geheZu("konten", `nutzer:${u.id}`)}
                  />
                ))}
              </Zeilenkarte>
              <Flaechenknopf
                testId="knopf-nutzer-hinzufuegen"
                onClick={() => geheZu("konten", "nutzerNeu")}
              >
                {t("einst.konten.hinzufuegen")}
              </Flaechenknopf>
              {canPreview ? (
                <Zeilenkarte>
                  <Zeile
                    label={t("role.viewAs")}
                    wert={previewActive ? t(`role.name.${role}`) : t("einst.konten.ansichtAus")}
                    onOeffnen={() => geheZu("konten", "ansichtRolle")}
                    testId="zeile-ansicht-rolle"
                  />
                </Zeilenkarte>
              ) : null}
              <Kicker>{t("einst.rollen.kicker")}</Kicker>
              <Zeilenkarte>
                {ROLES.map((r) => (
                  <Zeile
                    key={r}
                    label={t(`role.name.${r}`)}
                    wert={freiheiten(r)}
                    onOeffnen={() => geheZu("konten", `rolle:${r}`)}
                    testId={`zeile-rolle-${r}`}
                  />
                ))}
              </Zeilenkarte>
            </>
          ) : null}

          {section === "ki" ? (
            <Zeilenkarte>
              <Zeile
                label={t("adm.ai.title")}
                wert={wert(
                  aiConfig,
                  // JOB 3134: derselbe Name wie auf der Karte (JOB 3120: ein Dienst, ein Name) —
                  // hier stand die rohe Kennung, während die Karte „ChatGPT (OpenAI) · …" sagte.
                  // `provider`/`model` ist der Anbieter, den die gespeicherte Wahl bestimmt.
                  aiConfig.data
                    ? `${anbieterUndModell(aiConfig.data.model ?? aiConfig.data.provider)} · ${
                        aiConfig.data.mode === "model"
                          ? t("adm.ai.modeModel")
                          : t("adm.ai.modeDemo")
                      }`
                    : null,
                )}
                onOeffnen={() => geheZu("ki", "ki")}
                testId="zeile-ki"
              />
              <Zeile
                label={t("adm.ai.accessTitle")}
                wert={wert(
                  aiConfig,
                  aiConfig.data
                    ? t("einst.ki.aktivZahl", {
                        count: aiAccessRows(aiConfig.data).filter((r) => r.state === "active")
                          .length,
                      })
                    : null,
                )}
                onOeffnen={() => geheZu("ki", "kiZugaenge")}
                testId="zeile-ki-zugaenge"
              />
              <Zeile
                label={t("adm.presets.title")}
                wert={wert(
                  presets,
                  presets.data ? String(presets.data.length) : null,
                  (presets.data?.length ?? 0) === 0,
                )}
                onOeffnen={() => geheZu("ki", "kiFunktionen")}
                testId="zeile-ki-funktionen"
              />
              <Zeile
                label={t("einst.ki.grenzen")}
                wert={wert(
                  uploadLimitsQ,
                  uploadLimitsQ.data
                    ? t("einst.ki.grenzeWert", {
                        mb: uploadLimitsQ.data.maxAttachmentBytes / 1_000_000,
                      })
                    : null,
                )}
                onOeffnen={() => geheZu("ki", "kiGrenzen")}
                testId="zeile-ki-grenzen"
              />
              <Zeile
                label={t("adm.ext.title")}
                wert={wert(
                  extPolicy,
                  extPolicy.data ? t(`adm.ext.stage.${extPolicy.data.stage}`) : null,
                )}
                onOeffnen={() => geheZu("ki", "kiExtern")}
                testId="zeile-ki-extern"
              />
              <Zeile
                label={t("adm.dup.title")}
                wert={wert(
                  dupSettingsQ,
                  dupSettingsQ.data
                    ? t("einst.ki.dupWert", {
                        prozent: Math.round(dupSettingsQ.data.minConfidence * 100),
                      })
                    : null,
                )}
                onOeffnen={() => geheZu("ki", "kiDup")}
                testId="zeile-ki-dup"
              />
            </Zeilenkarte>
          ) : null}

          {/* Quellen und Daten: der Papierkorb wohnt hier, Import und die Uploadgrenzen behalten
              ihren bisherigen Bedienort und werden von hier VERWIESEN (Vorlage: „vorhandene
              Daten-/Uploadgrenzen über eindeutigen Verweis auf ihren bisherigen Bedienort"). */}
          {section === "quellen" ? (
            <>
              <Zeilenkarte>
                <BereichsZeile id="import" testId="zeile-import" />
                <Zeile
                  label={t("adm.trash.title")}
                  wert={wert(
                    trash,
                    trash.data ? String(trash.data.length) : null,
                    (trash.data?.length ?? 0) === 0,
                  )}
                  onOeffnen={() => geheZu("quellen", "papierkorb")}
                  testId="zeile-papierkorb"
                />
                <Kurzlink
                  label={t("einst.ki.grenzen")}
                  to={adminHref("ki", "kiGrenzen")}
                  testId="zeile-grenzen-verweis"
                />
              </Zeilenkarte>
              {quellenAus ? <Kicker>{t("einst.modul.weg")}</Kicker> : null}
            </>
          ) : null}

          {/* Vorführdaten: EIN Auffindeort für die allgemeinen Demodaten und die Pakete aus
              JOB 3277/3326. Die Pakete werden hier NICHT zweitgebaut — ihr maßgeblicher Bedienort
              bleibt der Kasten auf /import (`#demopakete`), und der Verweis dorthin geht durch
              dieselbe Modulregel wie jeder andere Bereichsverweis (Codex, Runde 2, Befund 7). */}
          {section === "vorfuehrdaten" ? (
            <>
              <Zeilenkarte>
                <Zeile
                  label={t("adm.ziel.demo")}
                  wert={wert(
                    demoStatus,
                    demoStatus.data?.present
                      ? t("einst.daten.demoDa", { count: demoStatus.data.count })
                      : null,
                    demoStatus.data !== undefined && !demoStatus.data.present,
                  )}
                  onOeffnen={() => geheZu("vorfuehrdaten", "demo")}
                  testId="zeile-demodaten"
                />
                <BereichsZeile
                  id="import"
                  anker="#demopakete"
                  label={t("dpk.title")}
                  testId="zeile-demopakete"
                />
              </Zeilenkarte>
              {quellenAus ? <Kicker>{t("einst.modul.weg")}</Kicker> : null}
            </>
          ) : null}

          {section === "sicherheit" ? (
            <Zeilenkarte>
              <Zeile
                label={t("adm.ziel.protokoll")}
                wert={wert(
                  audit,
                  letzterEintrag ? new Date(letzterEintrag.at).toLocaleDateString() : null,
                  audit.data !== undefined && letzterEintrag === undefined,
                )}
                onOeffnen={() => geheZu("sicherheit", "protokoll")}
                testId="zeile-pruefprotokoll"
              />
              <Zeile
                label={t("adm.sich.dataTitle")}
                wert={t("einst.sich.punkte", { count: SECURITY_POINTS.length })}
                onOeffnen={() => geheZu("sicherheit", "datenschutz")}
                testId="zeile-datenschutz"
              />
              {/* Die Vorlage verlangt ausdrücklich, die zwei Protokollumfänge NICHT
                  zusammenzuwerfen: oben das hash-verkettete Prüfprotokoll, hier die
                  Benutzeränderungen aus dem Audit-Log. Zwei Zeilen, zwei Karten, zwei Namen. */}
              <Zeile
                label={t("adm.auditTitle")}
                wert={wert(
                  audit,
                  audit.data ? String(auditNutzer.length) : null,
                  audit.data !== undefined && auditNutzer.length === 0,
                )}
                onOeffnen={() => geheZu("sicherheit", "audit")}
                testId="zeile-audit"
              />
            </Zeilenkarte>
          ) : null}

          {/* Berichte und Analyse: ausschließlich Kurzlinks auf vorhandene Bereiche — kein Ziel
              bekommt hier einen zweiten Bedienort, und keine Rechte-/Modulgrenze verschiebt sich. */}
          {section === "berichte" ? (
            <>
              <Zeilenkarte>
                <BereichsZeile id="analytics" testId="zeile-analytics" />
                {analyticsSichtbar ? (
                  <Kurzlink
                    label={t("cmd.audit")}
                    to={ANALYTICS_AUDIT_PATH}
                    testId="zeile-analytics-audit"
                  />
                ) : null}
                <BereichsZeile id="output" testId="zeile-output" />
                <BereichsZeile id="graph" testId="zeile-graph" />
                <BereichsZeile id="kapital" testId="zeile-kapital" />
              </Zeilenkarte>
              {berichteAus ? <Kicker>{t("einst.modul.weg")}</Kicker> : null}
            </>
          ) : null}

          {section === "system" ? (
            <>
              <Zeilenkarte>
                <Zeile
                  label={t("adm.ready.title")}
                  wert={bereitschaftWert}
                  onOeffnen={() => geheZu("system", "bereitschaft")}
                  testId="zeile-bereitschaft"
                />
                {/* Bis JOB 3060 saß das Stufe-2-Häkchen in der Seitenleiste, bis JOB 3337 unter
                    „Konten". Hier ist sein Ort: die Vorlage führt „Erweiterte Module" unter System,
                    neben der Bereitschaft — und genau hierauf zeigt der Hinweis unter einem
                    ausgeschalteten Bereich. */}
                <Zeile
                  label={t("role.stage2")}
                  wert={stufe2 ? t("einst.an") : t("einst.aus")}
                  testId="zeile-stufe2"
                  steuerung={
                    <input
                      type="checkbox"
                      aria-label={t("role.stage2")}
                      checked={stufe2}
                      onChange={(e) => setStufe2(e.target.checked)}
                      className="accent-brand"
                    />
                  }
                />
              </Zeilenkarte>
              {/* „Werkseinstellungen in eindeutigem eigenen Abschnitt" (Vorlage): eine eigene Karte,
                  damit der Reset nicht neben einem Häkchen steht, das man versehentlich trifft. */}
              <Zeilenkarte>
                <Zeile
                  label={t("adm.factory.title")}
                  wert={wert(
                    factoryResetStatus,
                    factoryResetStatus.data
                      ? factoryResetStatus.data.available
                        ? t("einst.daten.werkVerfuegbar")
                        : t("einst.daten.werkNicht")
                      : null,
                  )}
                  onOeffnen={() => geheZu("system", "werk")}
                  testId="zeile-werkseinstellungen"
                />
              </Zeilenkarte>
            </>
          ) : null}
        </>
      )}
    </EinstellungenSeite>
  );
}
