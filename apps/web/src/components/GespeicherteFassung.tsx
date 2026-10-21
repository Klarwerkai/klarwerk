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
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { useKoVersions, useQuellrevision } from "../api/hooks";
import type { KoVersionSnapshot, QuellrevisionInhalt } from "../api/types";
import { formatKoTimestamp } from "../lib/koDates";
import { quellabschnitteAus } from "../lib/quellabschnitt";
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

export function GespeicherteFassungAnsicht({
  fassung,
  ankerId,
  lage,
  quellinhalt,
}: {
  fassung: number;
  ankerId: string | null;
  lage: GespeicherteFassungLage;
  /** Fehlt er (reine Anzeige), steht bei einer Revision nur ihr Stand, kein Öffnungsweg. */
  quellinhalt?: QuellinhaltPlatz;
}): JSX.Element {
  const { t, i18n } = useTranslation();
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
  const ko = satz.snapshot;
  const abschnitte = quellabschnitteAus(ko.sources);
  const auszuege = new Map(
    (ko.sources ?? []).map((s): [string, string | null] => [s.id, s.excerpt]),
  );
  return (
    <Card
      className="mb-3"
      interactive={false}
      data-testid={GESPEICHERT_MARKE}
      data-fassung={String(satz.version)}
    >
      <p className={HINWEIS} data-testid={`${GESPEICHERT_MARKE}-titelzeile`}>
        {t("quellen.gespeichert.titel", {
          version: satz.version,
          zeit: formatKoTimestamp(satz.at, i18n.language) ?? satz.at,
        })}
      </p>
      <h2
        className="mt-1 text-[17px] font-semibold text-text"
        data-testid={`${GESPEICHERT_MARKE}-titel`}
      >
        {ko.title}
      </h2>
      <p className="mt-1 text-[13px] text-muted" data-testid={`${GESPEICHERT_MARKE}-aussage`}>
        {ko.statement}
      </p>
      {ko.bodyHtml ? (
        <SanitizedHtml html={ko.bodyHtml} className="prose-kw mt-2 text-[13px] text-muted" />
      ) : null}
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
              const auszug = q.ankerId ? auszuege.get(q.ankerId) : null;
              const stand =
                q.stand === "geprueft" ? t("quellen.standGeprueft") : t("quellen.standUngeprueft");
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
      <p className={`mt-2 ${HINWEIS}`}>
        {t("quellen.gespeichert.hinweis", { version: satz.version })}
      </p>
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
}: {
  koId: string;
  fassung: number;
  ankerId: string | null;
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
      lage={lage}
      quellinhalt={(sourceRecordId, gewaehlt) => (
        <DamaligerQuellinhalt koId={koId} sourceRecordId={sourceRecordId} anfangsOffen={gewaehlt} />
      )}
    />
  );
}
