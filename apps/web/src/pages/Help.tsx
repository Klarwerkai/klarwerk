import { ArrowRight, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { UploadLimitsHint } from "../components/UploadLimitsHint";
import { Card, PageHeader } from "../components/ui";
import { HELP_TOPICS, type HelpSearchItem, filterHelpTopics } from "../lib/helpTopics";
import {
  ISO_HELP_LABELS,
  ISO_HELP_TOPICS,
  helpAbsaetze,
  isoHelpSprache,
  isoQuellenAnzeige,
} from "../lib/helpTopics.iso";
import { PILOT_CHECKLIST } from "../lib/pilotChecklist";
import { PILOT_OBSERVATIONS } from "../lib/pilotObservationGuide";

// SCRUM-219: produktnahe Hilfe mit clientseitiger Suche über Titel/Text/Tags. Links nur auf
// echte App-Routen, ehrlicher Leerzustand. Kein Backend, keine KI-Suche, kein CMS.
//
// JOB 3338 (ISO-HILFE): dieselbe Suche trägt jetzt zusätzlich vier ISO-Kapitel. Sie kommen NICHT
// aus `HELP_TOPICS`, sondern aus `helpTopics.iso.ts` — aus zwei Gründen, die beide gemessen sind:
//   · Ihr Text liegt fertig in DE/EN im Modul statt als i18n-Schlüssel (siehe Kopf dort).
//   · Die Seitenhilfe des Zahnrads rechnet „genau EIN Kapitel je Route" (JOB 3028). Drei ISO-
//     Kapitel zeigen auf schon belegte Routen; in `HELP_TOPICS` hätten sie /bibliothek,
//     /validierung und /aufgaben still ihren Erklärsatz gekostet.
// Der SUCHRAUM ist derselbe: beide Listen werden zu aufgelösten Items und laufen durch denselben
// DOM-freien Filter. Ein ISO-Kapitel trägt zusätzlich `sources` — EXTERNE Adressen, die als eigener
// Block unter dem Text stehen und den Tabwechsel am Link ankündigen. Der interne Handlungslink
// bleibt davon getrennt: er ist eine App-Route und öffnet keinen Tab.
//
// JOB 3468 (REVIEW26-HILFE-IMPORT): genau EIN Kapitel verlangt zusätzlich die geltenden
// Upload-Grenzen auf seiner Karte — der Dateiimport. Die Zahlen stehen NICHT in seinem Text: sie
// kommen vom Server und werden von der einen vorhandenen Anzeige dafür gezeigt
// (`components/UploadLimitsHint.tsx`). Liegen sie nicht vor, zeigt die Karte den Zusatz GAR NICHT —
// ohne frische Grundlage wird keine Grenze behauptet. Das Kapitel selbst hängt an keinem Abruf und
// bleibt in jedem Zustand auffindbar und lesbar, auch offline.
//
// WAS ENTSCHEIDET: das Merkmal `uploadLimits` des Kapitels, NICHT seine Kennung. Eine Seite, die
// „wenn id === 'fileimport'" fragt, ist ein Sonderfall und läuft beim nächsten Kapitel auseinander
// — dieselbe Erwägung wie beim ISO-Zweig eine Zeile weiter unten (`istIso` hängt an `sources`).
type HilfeEintrag = HelpSearchItem & {
  to: string;
  sources?: readonly string[];
  uploadLimits?: boolean;
};

export function Help(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [q, setQ] = useState("");
  // Die Lieferung kennt DE und EN; alles andere (nl) fällt auf DE — wie `fallbackLng` in i18n.ts.
  const isoLng = isoHelpSprache(i18n.language);

  // i18n-Texte auflösen → durchsuchbare Items (DOM-freie Filterung im Helper).
  const items: HilfeEintrag[] = [
    ...HELP_TOPICS.map((topic) => ({
      id: topic.id,
      title: t(topic.titleKey),
      body: t(topic.bodyKey),
      tags: topic.tags,
      to: topic.to,
      // Nur setzen, wenn das Kapitel es WIRKLICH verlangt: ein Feld mit `undefined` ist unter
      // `exactOptionalPropertyTypes` etwas anderes als ein fehlendes.
      ...(topic.uploadLimits === true ? { uploadLimits: true } : {}),
    })),
    ...ISO_HELP_TOPICS.map((topic) => ({
      id: topic.id,
      title: topic.title[isoLng],
      body: topic.body[isoLng],
      tags: topic.tags,
      to: topic.to,
      sources: topic.sources,
    })),
  ];
  const visible = filterHelpTopics(items, q);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader kicker={t("help.kicker")} title={t("nav.help")} pageKey="hilfe" />
      <p className="-mt-3 mb-4 text-sm text-muted">{t("help.intro")}</p>
      {/* SCRUM-305: kompakte Pilot-Checkliste für den ersten Nutzerlauf — ehrlich, Stage-1, nicht
          durchsuchbar (fixer Orientierungspunkt), stört die normale Hilfe-Suche nicht. */}
      <Card className="mb-5 border-dashed">
        <h2 className="text-[14px] font-semibold text-ink">{t("pilot.title")}</h2>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{t("pilot.subtitle")}</p>
        <ol className="mt-3 space-y-2">
          {PILOT_CHECKLIST.map((item) => (
            <li key={item.id} className="flex items-start gap-2.5">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink font-mono text-[10px] font-semibold text-white">
                {item.n}
              </span>
              <span className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-text">
                {t(item.labelKey)}
              </span>
              <Link
                to={item.to}
                className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-ai hover:opacity-80"
              >
                {t("help.openRoute")}
                <ArrowRight size={12} />
              </Link>
            </li>
          ))}
        </ol>
      </Card>
      {/* SCRUM-307: beobachtete Pilot-Reibung in einen bestehenden Flow einordnen — kein Backend,
          keine Speicherung; UX-Notiz bewusst ohne Produktlink. Nicht durchsuchbar, nicht überladen. */}
      <Card className="mb-5 border-dashed">
        <h2 className="text-[14px] font-semibold text-ink">{t("pilot.obs.title")}</h2>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{t("pilot.obs.subtitle")}</p>
        <ul className="mt-3 space-y-2.5">
          {PILOT_OBSERVATIONS.map((obs) => (
            <li key={obs.id} className="flex flex-col gap-1 border-l-2 border-hairline pl-3">
              <span className="text-[12.5px] leading-relaxed text-text">{t(obs.labelKey)}</span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted">
                <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                  {t("pilot.obs.mapLabel")}:
                </span>
                <span>{t(obs.mapKey)}</span>
                {obs.to ? (
                  <Link
                    to={obs.to}
                    className="inline-flex items-center gap-1 font-semibold text-ai hover:opacity-80"
                  >
                    {t("pilot.obs.openFlow")}
                    <ArrowRight size={12} />
                  </Link>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("help.search")}
        data-testid="hilfe-suche"
        className="mb-5 h-10 w-full rounded-input border border-hairline bg-surface px-3 text-sm outline-none focus:border-ink/30"
      />
      {visible.length === 0 ? (
        <Card className="border-dashed text-center text-sm text-muted">{t("help.noResults")}</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((topic) => {
            // Ein ISO-Kapitel erkennt man an seinen externen Quellen — nicht an seiner ID.
            const istIso = topic.sources !== undefined;
            const merkmale = topic.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-pill bg-hairline-soft px-1.5 py-0.5 font-mono text-[10px] text-muted-2"
              >
                {tag}
              </span>
            ));
            // Der Inhalt ist für beide Kartenformen DERSELBE und wird einmal gebaut.
            const inhalt = (
              <>
                <h3 className="text-[14px] font-semibold text-ink">{topic.title}</h3>
                {/* Absätze der Quelle bleiben Absätze. Ein Text ohne Leerzeile ergibt genau einen —
                    die bestehenden Kapitel sehen aus wie vorher. Nichts wird gekürzt. */}
                <div className="mt-1.5 flex-1 space-y-2">
                  {helpAbsaetze(topic.body).map((absatz) => (
                    <p
                      key={absatz.slice(0, 40)}
                      data-hilfe-absatz=""
                      className="text-[13px] leading-relaxed text-muted"
                    >
                      {absatz}
                    </p>
                  ))}
                </div>
                {/* JOB 3468: die geltenden Upload-Grenzen — AUS DER SERVERQUELLE, über die eine
                    vorhandene Anzeige. Sie entscheidet selbst, ob sie etwas sagt: ohne Werte
                    (laden, leer, Fehler, offline, kein Abfragekontext) rendert sie `null`
                    (`UploadLimitsHint.tsx:28-37`). Damit behauptet die Hilfe weder eine Zahl noch
                    eine Frische, und sie meldet auch keinen fremden Dienstfehler.
                    Die Klassenkette steht LITERAL da — der Klassenbindungs-Sammler
                    (`tests/app/mega47-modale-flaechen-sammler.test.tsx`) könnte eine erst zur
                    Laufzeit gebaute nicht auflösen (siehe den Block weiter unten). */}
                {topic.uploadLimits ? (
                  <UploadLimitsHint className="mt-2 text-[11px] text-muted-2" />
                ) : null}
                {istIso ? (
                  // `2701` ist ein SUCHALIAS, keine Normbezeichnung. Bei den ISO-Kapiteln bekommt
                  // die Merkmalsleiste deshalb eine Überschrift, die genau das sagt.
                  <div className="mt-2.5" data-testid={`hilfe-suchbegriffe-${topic.id}`}>
                    <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                      {ISO_HELP_LABELS.searchTerms[isoLng]}
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1">{merkmale}</div>
                  </div>
                ) : (
                  <div className="mt-2.5 flex flex-wrap gap-1">{merkmale}</div>
                )}
                {topic.sources ? (
                  <div
                    data-testid={`hilfe-quellen-${topic.id}`}
                    className="mt-3 rounded-input border border-hairline bg-page px-2.5 py-2"
                  >
                    <div className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                      {ISO_HELP_LABELS.sources[isoLng]}
                    </div>
                    <ul className="mt-1.5 space-y-1">
                      {topic.sources.map((quelle) => (
                        <li key={quelle}>
                          {/* Die Ankündigung steht IM Link und ist damit Teil seines zugänglichen
                              Namens — wer ihn per Tastatur erreicht, hört sie vor dem Klick. */}
                          <a
                            href={quelle}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex flex-wrap items-baseline gap-1 text-[12.5px] font-medium text-ai hover:underline"
                          >
                            <ExternalLink size={11} aria-hidden="true" className="self-center" />
                            <span className="break-all">{isoQuellenAnzeige(quelle)}</span>
                            <span className="font-mono text-[10px] font-normal text-muted-2">
                              ({ISO_HELP_LABELS.newTab[isoLng]})
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <Link
                  to={topic.to}
                  data-testid={`hilfe-route-${topic.id}`}
                  className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-ai hover:opacity-80"
                >
                  {t("help.openRoute")}
                  <ArrowRight size={13} />
                </Link>
              </>
            );
            // ==================================================================================
            // ZWEI KARTEN STATT EINER BEDINGTEN KLASSE — und warum das kein Umweg ist.
            // ==================================================================================
            // Runde 1 schrieb hier `className={cx("flex flex-col", istIso && "sm:col-span-2")}`.
            // Das ist für den Klassenbindungs-Sammler (`tests/app/mega47-…`) eine UNAUFLÖSBARE
            // Bindung: `istIso` entsteht erst zur Laufzeit, der Sammler kann den Klassennamen
            // nicht mehr ausrechnen — 218 gemeldete Bindungen statt 217, Tor rot.
            //
            // Der Vertrag dieses Sammlers verlangt dann NICHT, den Pin hochzusetzen, sondern die
            // Klasse auflösbar zu schreiben (dort ausgeschrieben unter JOB 3267 Q1). Genau das
            // steht hier: der Zustand entscheidet über den ZWEIG, nicht über den Klassennamen.
            // Beide Ketten stehen wörtlich im Baum — wie schon vor diesem Job, wo die Karte
            // `className="flex flex-col"` trug.
            //
            // WARUM ÜBERHAUPT ZWEI BREITEN: die ISO-Kapitel sind Fliesstext über mehrere Absätze.
            // In einer halben Spalte stünde er als schmaler Turm; über die ganze Breite bleibt er
            // lesbar. Auf dem Telefon ist das Raster ohnehin einspaltig, dort ändert sich nichts.
            return istIso ? (
              <Card
                key={topic.id}
                data-hilfe-thema={topic.id}
                className="flex flex-col sm:col-span-2"
              >
                {inhalt}
              </Card>
            ) : (
              <Card key={topic.id} data-hilfe-thema={topic.id} className="flex flex-col">
                {inhalt}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
