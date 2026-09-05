// ==================================================================================================
// JOB 3065 H6 — „EINSTELLUNGEN" NACH DEM PAGES-MASSSTAB (Zielbild `design/klarwerk/Admin.dc.html`).
// ==================================================================================================
//
// Pedi 04.09. 06:50: Apple Pages — Knopf und Feld erklären sich selbst, Erklärtext im Verhältnis
// 1:100. Bis hierher war diese Seite die texthaltigste der App: 1844 Zeilen, zwölf Hilfe-Zeichen, eine
// Kartenwand mit Fließtext über fünf Pillen-Bereiche.
//
// JETZT: links vier Reiter (Konten · KI · Daten · Sicherheit), rechts Karten aus Zeilen — Label
// links, Wert rechts, dahinter ein Chevron in die Detailkarte oder ein Schloss (nur lesbar). Auf der
// Fläche steht sonst KEIN Satz; gemessen von `tests/design/zielbild-h6-kein-erklaertext.test.ts`.
//
// NICHTS GEHT VERLOREN (Pedi 04.09. 07:58): jede Karte von gestern lebt als Detailkarte weiter
// (`AdminKontenDetails` · `AdminKiDetails` · `AdminDatenDetails` · `AdminSicherheitDetails`), jeder
// Hilfetext im „?"-Menü seiner Karte. Der frühere fünfte Bereich „Bereitschaft" ist die Zeile
// „Bereitschaft" unter Sicherheit. Das Inventar hält `tests/design/h6-funktionsinventar.test.ts`.
//
// EHRLICHKEIT VOR OPTIK: der Wert jeder Zeile entsteht aus `components/einstellungen/zeilenWert.ts`
// — „–" solange geladen oder offline, „nicht abrufbar" bei Fehler, „keine" nur nach einer
// erfolgreichen leeren Antwort, und ein Bestand aus dem Zwischenspeicher trägt „Stand von …" bzw.
// zusätzlich „nicht aktualisiert" (REGELN §7, Auftrag §9).
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { endpoints } from "../api/endpoints";
import { useAnalytics, useAudit, useUsers, useValidationBoard } from "../api/hooks";
import { useRole } from "../app/RoleContext";
import { ROLES, type Role } from "../app/navigation";
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
import { ADMIN_SECTIONS, type AdminSectionId, DEFAULT_ADMIN_SECTION } from "../lib/adminSections";
import { aiAccessRows } from "../lib/aiOverview";
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

export function Admin(): JSX.Element {
  const { t } = useTranslation();
  const online = useIstOnline();
  const wertText = useWertText();
  const { role, stufe2, setStufe2, canPreview, previewActive } = useRole();

  // SCRUM-394 / JOB 3065: aktiver Reiter (Konten · KI · Daten · Sicherheit) und die offene
  // Detailkarte. `detail === null` heißt: die Zeilen sind zu sehen — das Sichtfeld des Zielbilds.
  const [section, setSection] = useState<AdminSectionId>(DEFAULT_ADMIN_SECTION);
  const [detail, setDetail] = useState<string | null>(null);
  const zurueck = (): void => setDetail(null);

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

  // ---- Sicherheit: Bereitschaft ------------------------------------------------------------------
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
            onDemodaten={() => {
              setSection("daten");
              setDetail("demo");
            }}
          />
        );
      default:
        // Eine unbekannte Kennung ist kein stiller Leerlauf — die Karte sagt es und führt zurück.
        return (
          <Detailkarte titel={t("state.error")} onZurueck={zurueck}>
            <p className="text-[12.5px] text-muted-2">{t("einst.detail.unbekannt")}</p>
          </Detailkarte>
        );
    }
  }

  return (
    <EinstellungenSeite
      titel={t("einst.titel")}
      seitenSchluessel="admin"
      reiter={ADMIN_SECTIONS.map((s) => ({ id: s.id, label: t(s.labelKey) }))}
      aktiv={section}
      onWechsel={(id) => {
        setSection(id as AdminSectionId);
        setDetail(null);
      }}
    >
      {detail !== null ? (
        detailKarte()
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
                    onOeffnen={() => setDetail(`nutzer:${u.id}`)}
                  />
                ))}
              </Zeilenkarte>
              <Flaechenknopf
                testId="knopf-nutzer-hinzufuegen"
                onClick={() => setDetail("nutzerNeu")}
              >
                {t("einst.konten.hinzufuegen")}
              </Flaechenknopf>
              {/* Bis JOB 3060 saßen Rollen-Vorschau und Stufe-2-Häkchen in der Seitenleiste. Hier
                  ist ihr Ort: zwei Zeilen mit Wert, keine zweite Erklärung. */}
              <Zeilenkarte>
                {canPreview ? (
                  <Zeile
                    label={t("role.viewAs")}
                    wert={previewActive ? t(`role.name.${role}`) : t("einst.konten.ansichtAus")}
                    onOeffnen={() => setDetail("ansichtRolle")}
                    testId="zeile-ansicht-rolle"
                  />
                ) : null}
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
              <Kicker>{t("einst.rollen.kicker")}</Kicker>
              <Zeilenkarte>
                {ROLES.map((r) => (
                  <Zeile
                    key={r}
                    label={t(`role.name.${r}`)}
                    wert={freiheiten(r)}
                    onOeffnen={() => setDetail(`rolle:${r}`)}
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
                  aiConfig.data
                    ? `${aiConfig.data.provider} · ${
                        aiConfig.data.mode === "model"
                          ? t("adm.ai.modeModel")
                          : t("adm.ai.modeDemo")
                      }`
                    : null,
                )}
                onOeffnen={() => setDetail("ki")}
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
                onOeffnen={() => setDetail("kiZugaenge")}
                testId="zeile-ki-zugaenge"
              />
              <Zeile
                label={t("adm.presets.title")}
                wert={wert(
                  presets,
                  presets.data ? String(presets.data.length) : null,
                  (presets.data?.length ?? 0) === 0,
                )}
                onOeffnen={() => setDetail("kiFunktionen")}
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
                onOeffnen={() => setDetail("kiGrenzen")}
                testId="zeile-ki-grenzen"
              />
              <Zeile
                label={t("adm.ext.title")}
                wert={wert(
                  extPolicy,
                  extPolicy.data ? t(`adm.ext.stage.${extPolicy.data.stage}`) : null,
                )}
                onOeffnen={() => setDetail("kiExtern")}
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
                onOeffnen={() => setDetail("kiDup")}
                testId="zeile-ki-dup"
              />
            </Zeilenkarte>
          ) : null}

          {section === "daten" ? (
            <Zeilenkarte>
              <Zeile
                label={t("adm.seedTitle")}
                wert={wert(
                  demoStatus,
                  demoStatus.data?.present
                    ? t("einst.daten.demoDa", { count: demoStatus.data.count })
                    : null,
                  demoStatus.data !== undefined && !demoStatus.data.present,
                )}
                onOeffnen={() => setDetail("demo")}
                testId="zeile-demodaten"
              />
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
                onOeffnen={() => setDetail("werk")}
                testId="zeile-werkseinstellungen"
              />
              <Zeile
                label={t("adm.trash.title")}
                wert={wert(
                  trash,
                  trash.data ? String(trash.data.length) : null,
                  (trash.data?.length ?? 0) === 0,
                )}
                onOeffnen={() => setDetail("papierkorb")}
                testId="zeile-papierkorb"
              />
              <Zeile
                label={t("adm.auditTitle")}
                wert={wert(
                  audit,
                  audit.data ? String(auditNutzer.length) : null,
                  audit.data !== undefined && auditNutzer.length === 0,
                )}
                onOeffnen={() => setDetail("audit")}
                testId="zeile-audit"
              />
            </Zeilenkarte>
          ) : null}

          {section === "sicherheit" ? (
            <Zeilenkarte>
              <Zeile
                label={t("adm.sich.auditTitle")}
                wert={wert(
                  audit,
                  letzterEintrag ? new Date(letzterEintrag.at).toLocaleDateString() : null,
                  audit.data !== undefined && letzterEintrag === undefined,
                )}
                onOeffnen={() => setDetail("protokoll")}
                testId="zeile-pruefprotokoll"
              />
              <Zeile
                label={t("adm.sich.dataTitle")}
                wert={t("einst.sich.punkte", { count: SECURITY_POINTS.length })}
                onOeffnen={() => setDetail("datenschutz")}
                testId="zeile-datenschutz"
              />
              <Zeile
                label={t("adm.ready.title")}
                wert={bereitschaftWert}
                onOeffnen={() => setDetail("bereitschaft")}
                testId="zeile-bereitschaft"
              />
            </Zeilenkarte>
          ) : null}
        </>
      )}
    </EinstellungenSeite>
  );
}
