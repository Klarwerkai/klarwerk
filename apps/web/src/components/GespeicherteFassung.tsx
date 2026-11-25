// ================================================================================================
// AW03-K02 · DIE TATSÄCHLICH VERWENDETE FASSUNG LESEN — NICHT NUR IHRE NUMMER.
// ================================================================================================
//
// Ben (Nacharbeit 12): „Fassung N öffnen“ führte auf `/wissen/:id?fassung=N`, und die Seite zeigte
// den HEUTIGEN Inhalt mit einem Abweichungshinweis. Die Fassung, aus der ein Absatz stammt, war über
// diesen Weg nicht lesbar.
//
// JETZT: `ansicht=gespeichert` (`lib/objektbezug.ts`, `gespeicherteFassungHref`) bestellt diese Karte.
// Sie liest die gespeicherte Fassung aus `GET /api/kos/:id/versions` — dieselbe Tür wie Verlauf und
// Fassungsvergleich, serverseitig über `sichtbaresKoOder404` (Stufe, Autor, Quellrechte) geprüft.
// Eine Antwort 404 sagt hier dasselbe wie dort: nicht zugänglich ODER nicht vorhanden, ohne zu
// verraten, welches von beiden. Gezeigt werden Titel, Aussage, Inhalt und die Quellabschnitte GENAU
// dieser Fassung; der Abschnitt, aus dem der Absatz stammt (`anker`), ist hervorgehoben.
//
// DER DAMALIGE QUELLINHALT (Ben, Nacharbeit 13): Kennung, Revision und Quellfassung allein öffnen
// keinen Quellabschnitt. Je Anker steht deshalb, was von der damaligen Quelle erhalten ist:
//   · eine wörtliche Belegstelle (`excerpt`) — sie steht direkt da;
//   · eine festgeschriebene Revision — „Damaligen Quellinhalt öffnen“ liest ihn über
//     `GET /api/kos/:id/quellrevisionen/:sourceRecordId` (`DamaligerQuellinhalt` unten), mit dem
//     Abgleich gegen den Inhaltsabdruck der Revision; beim Abschnitt des Absatzes geöffnet;
//   · keines von beiden — ausdrücklich „nicht erhalten“.
// Das Original in der Quelle bleibt als Verweis daneben und ist als HEUTIGER Stand benannt.
import { Fragment, type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useKoVersions, useQuellrevision } from "../api/hooks";
import type { KoVersionSnapshot, QuellrevisionInhalt } from "../api/types";
import { eindeutigeZitatstelle, markiereFundstelle } from "../lib/belegstelle";
import { formatKoTimestamp } from "../lib/koDates";
import { quellabschnitteAus } from "../lib/quellabschnitt";
import { useAuthorName } from "../lib/useAuthorName";
import { workflowWissensquelle } from "../lib/workflowWissensquelle";
import { Belegtitel } from "./Belegtitel";
import { SanitizedHtml } from "./SanitizedHtml";
import { Card } from "./ui";

export const GESPEICHERT_MARKE = "gespeicherte-fassung";

const HINWEIS = "text-[12.5px] text-muted";
const WARNUNG = "mb-3 text-[12.5px] text-trust-warn-text";

export type GespeicherteFassungLage =
  | { readonly art: "laedt" }
  | { readonly art: "fehler" }
  | { readonly art: "da"; readonly fassungen: readonly KoVersionSnapshot[] };

/** Zeichnet den damaligen Quellinhalt einer Revision — `gewaehlt` öffnet ihn sofort. */
export type QuellinhaltPlatz = (sourceRecordId: string, gewaehlt: boolean) => ReactNode;

function sichererVerweis(url: string | null): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

function Fassungswortlaut({
  aussage,
  html,
  zitat,
  meldeTreffer,
}: {
  aussage: string;
  html: string | null;
  zitat: string;
  meldeTreffer: (gefunden: boolean) => void;
}): JSX.Element {
  const aussageRef = useRef<HTMLParagraphElement>(null);
  const koerperRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const koerper = koerperRef.current;
    const text = aussageRef.current;
    if (!koerper || !text || !zitat) return;
    const fund = eindeutigeZitatstelle(koerper, text, zitat);
    meldeTreffer(Boolean(fund));
    if (!fund) return;
    const marken = markiereFundstelle(koerper.contains(fund.start.knoten) ? koerper : text, fund);
    for (const marke of marken) {
      marke.className =
        "rounded-sm bg-amber-200 text-slate-950 underline decoration-amber-700 decoration-2 underline-offset-2";
    }
    return () => {
      for (const marke of marken) {
        marke.replaceWith(...marke.childNodes);
      }
    };
  }, [zitat, meldeTreffer]);
  return (
    <>
      <p
        ref={aussageRef}
        className="mt-1 text-[13px] text-muted"
        data-testid={`${GESPEICHERT_MARKE}-aussage`}
      >
        {aussage}
      </p>
      <div ref={koerperRef}>
        {html ? (
          <SanitizedHtml html={html} className="prose-kw mt-2 text-[13px] text-muted" />
        ) : null}
      </div>
    </>
  );
}

export function GespeicherteFassungAnsicht({
  fassung,
  ankerId,
  zitat = "",
  lage,
  quellinhalt,
  freigabeperson = null,
}: {
  fassung: number;
  ankerId: string | null;
  zitat?: string;
  freigabeperson?: string | null;
  lage: GespeicherteFassungLage;
  /** Fehlt er (reine Anzeige), steht bei einer Revision nur ihr Stand, kein Öffnungsweg. */
  quellinhalt?: QuellinhaltPlatz;
}): JSX.Element {
  const { t } = useTranslation();
  if (lage.art === "laedt") {
    return (
      <p className={`mb-3 ${HINWEIS}`} data-testid={`${GESPEICHERT_MARKE}-laedt`}>
        {t("quellen.gespeichert.laedt")}
      </p>
    );
  }
  if (lage.art === "fehler") {
    return (
      <p className={WARNUNG} data-testid={`${GESPEICHERT_MARKE}-fehler`}>
        {t("quellen.gespeichert.fehler")}
      </p>
    );
  }
  const satz = lage.fassungen.find((f) => f.version === fassung);
  if (!satz) {
    return (
      <p className={WARNUNG} data-testid={`${GESPEICHERT_MARKE}-fehlt`}>
        {t("quellen.gespeichert.fehlt", { version: fassung })}
      </p>
    );
  }
  return (
    <Fassungskarte
      key={JSON.stringify([satz.koId, satz.version, zitat])}
      satz={satz}
      ankerId={ankerId}
      zitat={zitat}
      freigabeperson={freigabeperson}
      quellinhalt={quellinhalt}
    />
  );
}

function BeschlussFreigabe({ konto }: { konto: string | undefined }) {
  const { t } = useTranslation();
  const name = useAuthorName();
  return (
    <p className={HINWEIS} data-testid="beschluss-freigabe">
      {konto
        ? t("begleiter.vergleich.freigegebenVon", { person: name(konto) })
        : t("begleiter.vergleich.freigabeUnbekannt")}
    </p>
  );
}

function Fassungskarte({
  satz,
  ankerId,
  zitat,
  freigabeperson,
  quellinhalt,
}: {
  satz: KoVersionSnapshot;
  ankerId: string | null;
  zitat: string;
  freigabeperson: string | null;
  quellinhalt: QuellinhaltPlatz | undefined;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const [gefunden, meldeTreffer] = useState(false);
  const ko = satz.snapshot;
  const beschluss = ko.proposals?.find(
    (v) => v.status === "uebernommen" && v.resultVersion === satz.version && v.notizbeleg,
  );
  const beschlussbeleg = beschluss?.notizbeleg;
  const abschnitte = quellabschnitteAus(ko.sources);
  const quellen = new Map((ko.sources ?? []).map((s) => [s.id, s] as const));
  const Volltext = zitat ? "details" : Fragment;
  const englisch = i18n.language.split("-")[0]?.toLowerCase() === "en";
  const zeit =
    formatKoTimestamp(
      satz.at,
      englisch ? "en-GB" : i18n.language,
      englisch ? "short" : "2-digit",
    ) ?? satz.at;
  const zeitzeile = (
    <p
      className={zitat ? "mt-1 text-sm text-muted" : HINWEIS}
      data-testid={`${GESPEICHERT_MARKE}-titelzeile`}
    >
      {t("quellen.gespeichert.titel", { version: satz.version, zeit })}
    </p>
  );
  return (
    <Card
      className={zitat ? "mx-auto w-full max-w-3xl p-5 sm:p-8" : "mb-3"}
      interactive={false}
      data-testid={GESPEICHERT_MARKE}
      data-fassung={String(satz.version)}
    >
      {zitat && (
        <div className="mb-5">
          <p className="mb-3 text-sm font-semibold text-brand-text">{t("quellen.fokus.stelle")}</p>
          {gefunden ? (
            <blockquote
              data-testid="quellenfokus-zitat"
              className="border-l-4 border-amber-500 pl-4 text-2xl font-semibold leading-snug text-text sm:text-3xl"
            >
              <mark
                dir="auto"
                className="box-decoration-clone rounded-sm bg-amber-100 px-0.5 text-slate-950"
              >
                {zitat}
              </mark>
            </blockquote>
          ) : (
            <p data-testid="quellenfokus-ohne-zitat" className="text-base text-muted">
              {t("quellen.fokus.keineStelle")}
            </p>
          )}
        </div>
      )}
      {!zitat && zeitzeile}
      <h2
        className={
          zitat
            ? "break-words text-xl font-semibold text-text"
            : "mt-1 text-[17px] font-semibold text-text"
        }
        data-testid={`${GESPEICHERT_MARKE}-titel`}
        dir="auto"
      >
        <Belegtitel titel={ko.title} demoSeed={ko.demoSeed} />
      </h2>
      {zitat && (
        <p data-testid="quellenfokus-freigabe" className="mt-1 text-sm font-medium text-text">
          {freigabeperson
            ? t("begleiter.vergleich.freigegebenVon", { person: freigabeperson })
            : t("begleiter.vergleich.freigabeUnbekannt")}
        </p>
      )}
      {zitat && zeitzeile}
      <Volltext>
        {zitat && (
          <summary
            data-testid="quellenfokus-volltext"
            className="mt-5 cursor-pointer border-t border-line pt-4 text-sm font-semibold text-brand-text"
          >
            {t("quellen.fokus.volltext")}
          </summary>
        )}
        <Fassungswortlaut
          key={`${satz.koId}:${satz.version}`}
          aussage={ko.statement}
          html={ko.bodyHtml ?? null}
          zitat={zitat}
          meldeTreffer={meldeTreffer}
        />
        {beschlussbeleg && (
          <figure className="mt-3 rounded-card border border-hairline p-3">
            <figcaption className={HINWEIS}>
              {t("quellen.gespeichert.beschlussbeleg", { version: beschlussbeleg.fassung })}
            </figcaption>
            <blockquote
              className="mt-1 whitespace-pre-wrap break-words text-sm text-text"
              dir="auto"
            >
              {beschlussbeleg.auszug}
            </blockquote>
            {!zitat && <BeschlussFreigabe konto={beschluss.decidedBy} />}
          </figure>
        )}
        {abschnitte === null ? (
          <p className={`mt-2 ${HINWEIS}`} data-testid={`${GESPEICHERT_MARKE}-quellen-unbekannt`}>
            {t("quellen.abschnitteUnbekannt")}
          </p>
        ) : abschnitte.length > 0 ? (
          <div className="mt-2">
            <p className={HINWEIS}>{t("quellen.abschnitteTitel")}</p>
            <ul className={`${HINWEIS} list-none space-y-1`}>
              {abschnitte.map((q, i) => {
                const gewaehlt = ankerId !== null && q.ankerId === ankerId;
                const original = sichererVerweis(q.url);
                const quelle = q.ankerId ? quellen.get(q.ankerId) : undefined;
                const intern = quelle && workflowWissensquelle(quelle);
                if (intern && quelle)
                  return (
                    <li key={quelle.id}>
                      <a
                        href={intern.href}
                        className="font-medium text-brand-text underline"
                        data-testid={`workflow-fassungsbeleg-${intern.typ}`}
                      >
                        {intern.typ === "ergebnis"
                          ? t("workflows.wissen.ursprung")
                          : t("workflows.wissen.quellbeitrag", { v: quelle.sourceVersion })}
                      </a>
                    </li>
                  );
                const auszug = quelle?.excerpt;
                const stand =
                  q.stand === "geprueft"
                    ? t("quellen.standGeprueft")
                    : t("quellen.standUngeprueft");
                let damals: ReactNode = null;
                if (auszug) {
                  damals = (
                    <q className="block" data-testid={`${GESPEICHERT_MARKE}-auszug`}>
                      {auszug}
                    </q>
                  );
                } else if (q.quellrevision) {
                  damals = quellinhalt ? quellinhalt(q.quellrevision, gewaehlt) : null;
                } else {
                  damals = (
                    <span
                      className="block"
                      data-testid={`${GESPEICHERT_MARKE}-quellinhalt-nicht-erhalten`}
                    >
                      {t("quellen.gespeichert.quellinhaltNichtErhalten")}
                    </span>
                  );
                }
                return (
                  <li
                    key={q.ankerId ?? `${q.bezeichnung}-${i}`}
                    data-testid={`${GESPEICHERT_MARKE}-quellabschnitt`}
                    data-stand={q.stand}
                    data-fundstelle={q.fundstelle ?? ""}
                    data-gewaehlt={gewaehlt ? "true" : "false"}
                    aria-current={gewaehlt ? "true" : undefined}
                    className={gewaehlt ? "font-semibold text-text" : undefined}
                  >
                    {gewaehlt ? `${t("quellen.gespeichert.gewaehlt")}: ` : null}
                    {q.bezeichnung || t("quellen.dateiOhneName")}
                    {q.quellfassung !== null
                      ? ` · ${t("quellen.quellfassung", { version: q.quellfassung })}`
                      : null}
                    {q.quellrevision
                      ? ` · ${t("quellen.revision", { revision: q.quellrevision })}`
                      : null}
                    {` · ${stand}`}
                    {original ? (
                      <>
                        {" · "}
                        <a href={original} target="_blank" rel="noopener noreferrer">
                          {t("quellen.originalOeffnen")}
                        </a>
                      </>
                    ) : null}
                    {damals}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </Volltext>
      {!zitat && (
        <p className={`mt-2 ${HINWEIS}`}>
          {t("quellen.gespeichert.hinweis", { version: satz.version })}
        </p>
      )}
    </Card>
  );
}

/**
 * Der damalige Quellinhalt EINER Revision, gelesen über den Objektweg (Rechte des Objekts). Erst auf
 * Wunsch geladen — ausser für den Abschnitt, aus dem der Absatz stammt.
 */
export function DamaligerQuellinhalt({
  koId,
  sourceRecordId,
  anfangsOffen,
}: {
  koId: string;
  sourceRecordId: string;
  anfangsOffen: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const [offen, setOffen] = useState(anfangsOffen);
  const abfrage = useQuellrevision(koId, sourceRecordId, offen);
  if (!offen) {
    return (
      <button
        type="button"
        className="block underline"
        data-testid={`${GESPEICHERT_MARKE}-quellinhalt-oeffnen`}
        onClick={() => setOffen(true)}
      >
        {t("quellen.gespeichert.quellinhaltOeffnen")}
      </button>
    );
  }
  if (abfrage.isError) {
    return (
      <span
        className="block text-trust-warn-text"
        data-testid={`${GESPEICHERT_MARKE}-quellinhalt-fehler`}
      >
        {t("quellen.gespeichert.quellinhaltFehler")}
      </span>
    );
  }
  const d: QuellrevisionInhalt | undefined = abfrage.data;
  if (!d) {
    return (
      <span className="block" data-testid={`${GESPEICHERT_MARKE}-quellinhalt-laedt`}>
        {t("quellen.gespeichert.quellinhaltLaedt")}
      </span>
    );
  }
  // Der Abgleich gegen den Inhaltsabdruck der Revision, ausgeschrieben — nie still „wörtlich“.
  const abgleich =
    d.abgleich === "bestaetigt"
      ? t("quellen.gespeichert.abgleichBestaetigt")
      : d.abgleich === "abweichend"
        ? t("quellen.gespeichert.abgleichAbweichend")
        : t("quellen.gespeichert.abgleichUnbekannt");
  return (
    <div
      className="mt-1 border-l-2 border-line pl-2 font-normal"
      data-testid={`${GESPEICHERT_MARKE}-quellinhalt`}
      data-abgleich={d.abgleich}
    >
      <p>
        {t("quellen.gespeichert.quellinhaltTitel", {
          revision: d.sourceRecordId,
          fassung: d.uebernommenInFassung,
        })}
      </p>
      <p data-testid={`${GESPEICHERT_MARKE}-quellinhalt-abgleich`}>{abgleich}</p>
      <p className="text-text" data-testid={`${GESPEICHERT_MARKE}-quellinhalt-titel`}>
        {d.inhalt.title}
      </p>
      <p data-testid={`${GESPEICHERT_MARKE}-quellinhalt-aussage`}>{d.inhalt.statement}</p>
      {d.inhalt.bodyHtml ? (
        <SanitizedHtml html={d.inhalt.bodyHtml} className="prose-kw mt-1 text-[13px] text-muted" />
      ) : null}
    </div>
  );
}

/** Die Karte mit ihren Abfragen — `useKoVersions` teilt den Cache mit Verlauf und Vergleich. */
export function GespeicherteFassung({
  koId,
  fassung,
  ankerId,
  zitat = "",
  freigabeperson = null,
}: {
  koId: string;
  fassung: number;
  ankerId: string | null;
  zitat?: string;
  freigabeperson?: string | null;
}): JSX.Element {
  const abfrage = useKoVersions(koId);
  const lage: GespeicherteFassungLage = abfrage.isError
    ? { art: "fehler" }
    : abfrage.data
      ? { art: "da", fassungen: abfrage.data }
      : { art: "laedt" };
  return (
    <GespeicherteFassungAnsicht
      fassung={fassung}
      ankerId={ankerId}
      zitat={zitat}
      freigabeperson={freigabeperson}
      lage={lage}
      quellinhalt={(sourceRecordId, gewaehlt) => (
        <DamaligerQuellinhalt koId={koId} sourceRecordId={sourceRecordId} anfangsOffen={gewaehlt} />
      )}
    />
  );
}
