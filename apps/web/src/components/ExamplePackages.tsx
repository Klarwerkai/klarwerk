// WP-B6 (Pedis Wunsch für die VIP-2-Tester): Kasten „Beispielpakete" im Admin-/Import-Bereich.
// Drei kuratierte Szenarien als Karten (Daten aus examplePackages.ts, kein UI-Hardcode): Titel,
// 1-Satz-Beschreibung, Laden-Knopf, ehrliche Bilanz (angelegt/übersprungen — idempotent, zweites
// Laden dupliziert nichts). Ehrlicher Hinweis zum Entfernen: das Import-Aufräumen (D-CLEAN)
// entfernt die Beispiele NICHT (eigene Provenienz) — sie verschwinden über den bestehenden
// Demo-Daten-entfernen-Weg.
//
// JOB 3277 — DARUNTER DER ZWEITE KASTEN: DEMOPAKETE.
// Der Unterschied zu WP-B6 ist nicht kosmetisch. Ein WP-B6-Paket kann man laden, sonst nichts; ein
// Demopaket sagt VOR dem Laden, was es enthält (Beschreibung, Sprache, Umfang, „erfundene
// Demodaten"), und lässt sich danach EINZELN zurücksetzen und entfernen — ohne die übrigen
// Demodaten anzufassen. Die Angaben kommen vollständig vom Server (GET /admin/demo-packages),
// einschließlich der GEZÄHLTEN Stände „geladen" und „bearbeitet": diese Fläche behauptet nichts,
// was der Server nicht gezählt hat.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PackagePlus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type {
  DemoPackageInfo,
  DemoPackagePreview,
  DemoPackageResult,
  DemoPackageTextDto,
  ExampleLoadResponse,
} from "../api/types";
import { EXAMPLE_PACKAGES_TEXT, EXAMPLE_PACKAGE_CARDS } from "../lib/examplePackages";
import { Button, Card, SectionLabel } from "./ui";

// JOB 3277: die Copy-Schlüssel des Demopaket-Kastens — flach, wie EXAMPLE_PACKAGES_TEXT.
const DEMO_PACKAGES_TEXT = {
  title: "dpk.title",
  hint: "dpk.hint",
  fictional: "dpk.fictional",
  scope: "dpk.scope",
  stateNone: "dpk.stateNone",
  stateLoaded: "dpk.stateLoaded",
  stateEdited: "dpk.stateEdited",
  load: "dpk.load",
  reset: "dpk.reset",
  remove: "dpk.remove",
  removeConfirm: "dpk.removeConfirm",
  cancel: "dpk.cancel",
  busy: "dpk.busy",
  resultLoad: "dpk.resultLoad",
  resultReset: "dpk.resultReset",
  resultRemove: "dpk.resultRemove",
  resultTrash: "dpk.resultTrash",
  resultFailures: "dpk.resultFailures",
  stale: "dpk.stale",
  // JOB 3277 R2: Dubletten und die Vorschau vor den beiden eingreifenden Handgriffen.
  stateDuplicates: "dpk.stateDuplicates",
  resultDuplicates: "dpk.resultDuplicates",
  resetConfirm: "dpk.resetConfirm",
  previewLoading: "dpk.previewLoading",
  previewError: "dpk.previewError",
  previewNone: "dpk.previewNone",
  previewCounts: "dpk.previewCounts",
  previewIds: "dpk.previewIds",
  artSeed: "dpk.artSeed",
  // JOB 3277 R3: die Vorschau trennt, was BLEIBT (und hergestellt wird) von dem, was GEHT — und
  // nennt für beides die Kennungen. Vorher stand nur eine Liste da und der Rest als Anzahl.
  previewRestore: "dpk.previewRestore",
  previewRemove: "dpk.previewRemove",
  previewMissing: "dpk.previewMissing",
  artUnregistered: "dpk.artUnregistered",
  resultAssigned: "dpk.resultAssigned",
} as const;

type Handgriff = "load" | "reset" | "remove";
/** Die beiden Handgriffe, die etwas wegnehmen — sie fragen zurück und zeigen vorher die Vorschau. */
type Eingriff = "reset" | "remove";

/** Die Beschreibung in der Sprache der Oberfläche — mit ehrlichem Rückfall auf Deutsch, falls die
 *  Oberfläche einmal eine Sprache führt, die der Datenvertrag nicht kennt. */
function inSprache(text: DemoPackageTextDto, sprache: string): string {
  const kurz = sprache.slice(0, 2);
  if (kurz === "en") {
    return text.en;
  }
  if (kurz === "nl") {
    return text.nl;
  }
  return text.de;
}

/** „6 × Grundbestand" — die Anzahl je Art, wie die Nachführung sie verlangt. Unbekannte Arten
 *  stehen mit ihrem Rohnamen da, statt still zu verschwinden. */
function artZeile(counts: Record<string, number>, name: (art: string) => string): string {
  return Object.entries(counts)
    .map(([art, n]) => `${n} × ${name(art)}`)
    .join(", ");
}

export function ExamplePackages(): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ExampleLoadResponse>>({});
  const [error, setError] = useState<string | null>(null);

  const load = async (pkg: string): Promise<void> => {
    setBusy(pkg);
    setError(null);
    try {
      const result = await endpoints.admin.import.loadExamples(pkg);
      setResults((prev) => ({ ...prev, [pkg]: result }));
      // Neuer Bestand — Bibliothek/KO-Ansichten frisch laden.
      void qc.invalidateQueries({ queryKey: ["kos"] });
      void qc.invalidateQueries({ queryKey: ["library"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("state.error"));
    } finally {
      setBusy(null);
    }
  };

  // WP-UX-WOW-1 U6: der Konflikte-Leerzustand verlinkt hierher (/import#beispielpakete) — der
  // Anker existiert am Kasten, und beim Deep-Link scrollt die Ansicht einmal sanft zu ihm
  // (React-Router scrollt Hashes nicht von selbst).
  useEffect(() => {
    if (window.location.hash === "#beispielpakete") {
      document.getElementById("beispielpakete")?.scrollIntoView?.({
        behavior: "smooth",
        block: "start",
      });
    }
  }, []);

  return (
    <>
      <Card id="beispielpakete" className="mt-5 scroll-mt-4">
        <SectionLabel>{t(EXAMPLE_PACKAGES_TEXT.title)}</SectionLabel>
        <p className="mb-3 text-[13px] text-muted">{t(EXAMPLE_PACKAGES_TEXT.hint)}</p>

        {error ? (
          <p className="mb-2 rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
            {error}
          </p>
        ) : null}

        <div className="space-y-2">
          {EXAMPLE_PACKAGE_CARDS.map((card) => {
            const result = results[card.id];
            return (
              <div key={card.id} className="rounded-card border border-hairline bg-page p-3">
                <p className="text-[13.5px] font-semibold text-text">{t(card.titleKey)}</p>
                <p className="mt-0.5 text-[12.5px] text-muted">{t(card.descKey)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    disabled={busy !== null}
                    onClick={() => void load(card.id)}
                  >
                    {busy === card.id ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <PackagePlus size={15} />
                    )}
                    {busy === card.id
                      ? t(EXAMPLE_PACKAGES_TEXT.loading)
                      : t(EXAMPLE_PACKAGES_TEXT.load)}
                  </Button>
                  {result ? (
                    <span className="text-[12.5px] text-muted">
                      {t(EXAMPLE_PACKAGES_TEXT.result, {
                        created: result.created,
                        skipped: result.skipped,
                      })}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <DemoPackages />
    </>
  );
}

// ================================================================================================
// JOB 3277 — DER DEMOPAKET-KASTEN.
// ================================================================================================
function DemoPackages(): JSX.Element | null {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [bilanz, setBilanz] = useState<
    Record<string, { griff: Handgriff; wert: DemoPackageResult }>
  >({});
  const [fehler, setFehler] = useState<string | null>(null);
  // ============================================================================================
  // ZWEISTUFIG — UND ZWISCHEN DEN STUFEN STEHT DIE VORSCHAU.
  // ============================================================================================
  // Zurücksetzen und Entfernen greifen beide in den Bestand ein, und beide taten es in Runde 1
  // blind: man sah erst hinterher, was sie getroffen hatten. Jetzt fragt der erste Klick zurück und
  // holt dabei GENAU die Liste der zugeordneten Objekte vom Server (`/preview`). Der zweite Klick
  // vollzieht. Scheitert die Vorschau, bleibt der Vollzug GESPERRT: lieber gar nicht zurücksetzen
  // als auf gut Glück.
  const [fragt, setFragt] = useState<{ id: string; griff: Eingriff } | null>(null);
  const [vorschau, setVorschau] = useState<DemoPackagePreview | null>(null);
  const [vorschauFehler, setVorschauFehler] = useState<boolean>(false);
  const [vorschauLaeuft, setVorschauLaeuft] = useState<boolean>(false);
  /** Laufende Nummer der Vorschaufrage — nur die neueste Antwort wird angezeigt. */
  const vorschauNr = useRef(0);

  const uebersicht = useQuery({
    queryKey: ["demo-packages"],
    queryFn: () => endpoints.admin.demoPackages.list(),
  });

  // Bis die erste Antwort da ist, gibt es hier nichts zu zeigen — und nichts zu behaupten.
  const pakete: DemoPackageInfo[] | undefined = uebersicht.data?.packages;
  if (!pakete || pakete.length === 0) {
    return null;
  }

  const frage = async (id: string, griff: Eingriff): Promise<void> => {
    setFragt({ id, griff });
    setVorschau(null);
    setVorschauFehler(false);
    setVorschauLaeuft(true);
    // Nur die NEUESTE Frage darf antworten. Wer erst „Zurücksetzen" und dann „Entfernen" drückt,
    // bekäme sonst womöglich den Herstellungsplan zur Löschung angezeigt — dieselbe falsche Zusage
    // wie in Runde 3, nur über den Umweg einer verspäteten Antwort.
    vorschauNr.current += 1;
    const meine = vorschauNr.current;
    const erwartet = griff === "reset" ? "zuruecksetzen" : "entfernen";
    try {
      // Die Vorschau GEHÖRT ZUM HANDGRIFF: „Zurücksetzen" fragt nach dem Herstellungsplan,
      // „Entfernen" nach dem Löschplan. Die Fläche rechnet dabei selbst NICHTS um — täte sie es,
      // stünde die Behandlung wieder an zwei Stellen.
      const antwort = await endpoints.admin.demoPackages.preview(id, erwartet);
      if (meine !== vorschauNr.current) {
        return;
      }
      // Und was ankommt, muss zu dem gehören, was gefragt war. Passt es nicht, ist keine Vorschau
      // da — der Vollzug bleibt gesperrt, statt auf gut Glück zu laufen.
      if (antwort.aktion !== erwartet) {
        setVorschauFehler(true);
        return;
      }
      setVorschau(antwort);
    } catch {
      if (meine === vorschauNr.current) {
        setVorschauFehler(true);
      }
    } finally {
      if (meine === vorschauNr.current) {
        setVorschauLaeuft(false);
      }
    }
  };

  const zurueck = (): void => {
    setFragt(null);
    setVorschau(null);
    setVorschauFehler(false);
  };

  const handgriff = async (id: string, griff: Handgriff): Promise<void> => {
    setBusy(`${id}:${griff}`);
    setFehler(null);
    zurueck();
    try {
      const wege = endpoints.admin.demoPackages;
      const wert =
        griff === "load"
          ? await wege.load(id)
          : griff === "reset"
            ? await wege.reset(id)
            : await wege.remove(id);
      setBilanz((prev) => ({ ...prev, [id]: { griff, wert } }));
      // Der Bestand hat sich geändert — Übersicht, Bibliothek und KO-Ansichten neu holen.
      void uebersicht.refetch();
      void qc.invalidateQueries({ queryKey: ["kos"] });
      void qc.invalidateQueries({ queryKey: ["library"] });
    } catch (err) {
      setFehler(err instanceof ApiError ? err.message : t("state.error"));
    } finally {
      setBusy(null);
    }
  };

  /** Der Name einer Registerart auf der Fläche. Unbekannte Arten stehen mit ihrem Rohnamen da,
   *  statt still zu verschwinden — und `nicht_registriert` ist eine Art wie jede andere. */
  const artName = (art: string): string =>
    art === "seed"
      ? t(DEMO_PACKAGES_TEXT.artSeed)
      : art === "nicht_registriert"
        ? t(DEMO_PACKAGES_TEXT.artUnregistered)
        : art;

  return (
    <Card id="demopakete" className="mt-5 scroll-mt-4">
      <SectionLabel>{t(DEMO_PACKAGES_TEXT.title)}</SectionLabel>
      <p className="mb-3 text-[13px] text-muted">{t(DEMO_PACKAGES_TEXT.hint)}</p>

      {fehler ? (
        <p className="mb-2 rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
          {fehler}
        </p>
      ) : null}
      {/* Zustandsmodell: eine gescheiterte Auffrischung LEERT nichts — die zuletzt geholten Zahlen
          bleiben stehen und sagen dazu, dass sie nicht mehr frisch sind. */}
      {uebersicht.isError ? (
        <p className="mb-2 text-[12.5px] text-muted">{t(DEMO_PACKAGES_TEXT.stale)}</p>
      ) : null}

      <div className="space-y-2">
        {pakete.map((paket) => {
          const eintrag = bilanz[paket.id];
          const laeuft = (griff: Handgriff): boolean => busy === `${paket.id}:${griff}`;
          const gesperrt = busy !== null;
          return (
            <div
              key={paket.id}
              data-demopaket={paket.id}
              className="rounded-card border border-hairline bg-page p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[13.5px] font-semibold text-text">
                  {inSprache(paket.title, i18n.language)}
                </p>
                {paket.fictional ? (
                  <span className="rounded-btn bg-surface px-2 py-0.5 text-[11.5px] text-muted">
                    {t(DEMO_PACKAGES_TEXT.fictional)}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-[12.5px] text-muted">
                {inSprache(paket.description, i18n.language)}
              </p>
              <p className="mt-1 text-[12.5px] text-muted">
                {t(DEMO_PACKAGES_TEXT.scope, {
                  items: paket.items,
                  areas: paket.areas.join(", "),
                  language: paket.language.toUpperCase(),
                })}
              </p>
              <p className="mt-0.5 text-[12.5px] text-muted">
                {paket.loaded === 0
                  ? t(DEMO_PACKAGES_TEXT.stateNone)
                  : t(DEMO_PACKAGES_TEXT.stateLoaded, {
                      loaded: paket.loaded,
                      items: paket.items,
                    })}
                {paket.edited > 0
                  ? ` · ${t(DEMO_PACKAGES_TEXT.stateEdited, { n: paket.edited })}`
                  : ""}
                {/* Dubletten werden GENANNT, nicht weggezählt: in Runde 1 meldete die Übersicht
                    sechs, obwohl zwölf Objekte dalagen. */}
                {paket.duplicates > 0
                  ? ` · ${t(DEMO_PACKAGES_TEXT.stateDuplicates, { n: paket.duplicates })}`
                  : ""}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  disabled={gesperrt}
                  onClick={() => void handgriff(paket.id, "load")}
                >
                  {laeuft("load") ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <PackagePlus size={15} />
                  )}
                  {laeuft("load") ? t(DEMO_PACKAGES_TEXT.busy) : t(DEMO_PACKAGES_TEXT.load)}
                </Button>
                {/* Zurücksetzen und Entfernen gibt es erst, wenn etwas da ist, das sie beträfen —
                    und beide erst nach Rückfrage samt Vorschau. */}
                {fragt?.id === paket.id ? (
                  <>
                    <Button
                      variant="ghost"
                      disabled={gesperrt || vorschauLaeuft || vorschauFehler}
                      onClick={() => void handgriff(paket.id, fragt.griff)}
                    >
                      {fragt.griff === "reset" ? <RotateCcw size={15} /> : <Trash2 size={15} />}
                      {fragt.griff === "reset"
                        ? t(DEMO_PACKAGES_TEXT.resetConfirm)
                        : t(DEMO_PACKAGES_TEXT.removeConfirm)}
                    </Button>
                    <Button variant="ghost" disabled={gesperrt} onClick={zurueck}>
                      {t(DEMO_PACKAGES_TEXT.cancel)}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      disabled={gesperrt || paket.loaded === 0}
                      onClick={() => void frage(paket.id, "reset")}
                    >
                      {laeuft("reset") ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <RotateCcw size={15} />
                      )}
                      {laeuft("reset") ? t(DEMO_PACKAGES_TEXT.busy) : t(DEMO_PACKAGES_TEXT.reset)}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={gesperrt || paket.loaded === 0}
                      onClick={() => void frage(paket.id, "remove")}
                    >
                      {laeuft("remove") ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Trash2 size={15} />
                      )}
                      {laeuft("remove") ? t(DEMO_PACKAGES_TEXT.busy) : t(DEMO_PACKAGES_TEXT.remove)}
                    </Button>
                  </>
                )}
              </div>

              {fragt?.id === paket.id ? (
                <p data-demopaket-vorschau={paket.id} className="mt-2 text-[12.5px] text-muted">
                  {vorschauLaeuft
                    ? t(DEMO_PACKAGES_TEXT.previewLoading)
                    : vorschauFehler || !vorschau
                      ? t(DEMO_PACKAGES_TEXT.previewError)
                      : vorschau.entries.length === 0
                        ? t(DEMO_PACKAGES_TEXT.previewNone)
                        : `${t(DEMO_PACKAGES_TEXT.previewCounts, {
                            list: artZeile(vorschau.counts, artName),
                          })} · ${t(DEMO_PACKAGES_TEXT.previewIds, {
                            ids: vorschau.entries.map((e) => e.id).join(", "),
                          })}`}
                  {/* JOB 3277 R3: die beiden Gruppen des Eingriffs, JE MIT KENNUNGEN. „n entfernt"
                      ohne die Kennungen war genau die Auskunft, die Ben als unvollständig gemessen
                      hat — unregistrierter Altbestand verschwand, ohne vorher dazustehen. */}
                  {vorschau && !vorschauLaeuft && !vorschauFehler
                    ? [
                        ["wiederherstellen", DEMO_PACKAGES_TEXT.previewRestore] as const,
                        ["entfernen", DEMO_PACKAGES_TEXT.previewRemove] as const,
                      ].map(([behandlung, schluessel]) => {
                        const treffer = vorschau.entries.filter((e) => e.behandlung === behandlung);
                        return treffer.length === 0
                          ? ""
                          : ` · ${t(schluessel, {
                              n: treffer.length,
                              ids: treffer.map((e) => e.id).join(", "),
                            })}`;
                      })
                    : ""}
                  {vorschau && vorschau.missing > 0
                    ? ` · ${t(DEMO_PACKAGES_TEXT.previewMissing, { n: vorschau.missing })}`
                    : ""}
                </p>
              ) : null}

              {eintrag ? (
                <p data-demopaket-bilanz={paket.id} className="mt-2 text-[12.5px] text-muted">
                  {eintrag.griff === "load"
                    ? t(DEMO_PACKAGES_TEXT.resultLoad, {
                        created: eintrag.wert.created,
                        skipped: eintrag.wert.skipped,
                      })
                    : eintrag.griff === "reset"
                      ? t(DEMO_PACKAGES_TEXT.resultReset, {
                          updated: eintrag.wert.updated,
                          skipped: eintrag.wert.skipped,
                          created: eintrag.wert.created,
                        })
                      : t(DEMO_PACKAGES_TEXT.resultRemove, {
                          removed: eintrag.wert.removed,
                          conflicts: eintrag.wert.closedConflicts,
                          duplicates: eintrag.wert.closedDuplicates,
                        })}
                  {/* Die beiden Wegnahmen des Zurücksetzens getrennt: „6 überzählige Kopien" und
                      „6 zugeordnete Objekte" sind zwei verschiedene Nachrichten. */}
                  {eintrag.griff === "reset" &&
                  eintrag.wert.removed - eintrag.wert.removedAssigned > 0
                    ? ` · ${t(DEMO_PACKAGES_TEXT.resultDuplicates, {
                        n: eintrag.wert.removed - eintrag.wert.removedAssigned,
                      })}`
                    : ""}
                  {eintrag.griff === "reset" && eintrag.wert.removedAssigned > 0
                    ? ` · ${t(DEMO_PACKAGES_TEXT.resultAssigned, {
                        n: eintrag.wert.removedAssigned,
                      })}`
                    : ""}
                  {eintrag.wert.skippedInTrash > 0
                    ? ` · ${t(DEMO_PACKAGES_TEXT.resultTrash, { n: eintrag.wert.skippedInTrash })}`
                    : ""}
                  {eintrag.wert.failures.length > 0
                    ? ` · ${t(DEMO_PACKAGES_TEXT.resultFailures, {
                        n: eintrag.wert.failures.length,
                      })}`
                    : ""}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
