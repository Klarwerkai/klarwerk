// ================================================================================================
// AUFNAHME 20260922 · ANTWORT-ERKLÄRUNG — DIE BELASTBARKEIT DIREKT AN DER ANTWORT.
// ================================================================================================
//
// Diese Datei ZEICHNET, was der Server über die Antwort entschieden hat
// (`services/ask/src/answer-belastbarkeit.ts`): Lage, Begründung, Vertrauenswert samt Herleitung,
// je tragender Quelle Aktualität, Verantwortung und Quellenqualität, und bei einem Widerspruch
// beide Seiten mit ihren Belegen. Sie rechnet nichts nach und wählt nichts aus (R-0318: „die Werte
// kommen mit Begründung vom Server, nicht aus einer hübschen Zahl im Browser").
//
// Bewusst KEINE Prozentangabe und kein Balken: der Vertrauenswert ist eine Belastbarkeitsangabe
// der Quelle, kein Wahrheitsgrad (R-0260). Der Hinweis dazu steht immer mit da.
import { useTranslation } from "react-i18next";
import type {
  AntwortBelastbarkeit,
  AntwortZuschnitt,
  ArgumentStufe,
  AskPruefrahmen,
  KonfliktSeite,
  QuellenBelastbarkeit,
} from "../../api/types";
import { formatKoTimestamp } from "../../lib/koDates";

const LAGE_TON: Record<AntwortBelastbarkeit["lage"], string> = {
  belegt: "bg-trust-pos-bg text-trust-pos-text",
  belegt_zustaendig_fehlt: "bg-trust-warn-bg text-trust-warn-text",
  belegt_mit_konflikt: "bg-trust-crit-bg text-trust-crit-text",
  wissensluecke: "bg-trust-warn-bg text-trust-warn-text",
  technischer_fehler: "bg-trust-crit-bg text-trust-crit-text",
  geschwaerzt: "bg-page text-muted",
};

function Verantwortung({ q, fach }: { q: QuellenBelastbarkeit; fach: boolean }): JSX.Element {
  const { t } = useTranslation();
  const v = q.verantwortung;
  // R-0346: die rohe Kontokennung ist eine Fachangabe; allgemein steht nur ein Name, wenn es einen gibt.
  const wer = v.person ? (v.person.name ?? (fach ? v.person.id : null)) : null;
  const erreichbar =
    v.erreichbar === true
      ? t("ask.belastbarkeit.erreichbar.ja")
      : v.erreichbar === false
        ? t("ask.belastbarkeit.erreichbar.nein")
        : t("ask.belastbarkeit.erreichbar.unbekannt");
  return (
    <span
      data-testid="ask-belastbarkeit-verantwortung"
      className={v.erreichbar === false ? "text-trust-warn-text" : undefined}
    >
      {t(
        v.art === "owner"
          ? "ask.belastbarkeit.verantwortung.eigentuemer"
          : "ask.belastbarkeit.verantwortung.autor",
      )}
      {wer ? `: ${wer}` : ""} · {erreichbar}
    </span>
  );
}

function Seite({ seite, nummer }: { seite: KonfliktSeite; nummer: 1 | 2 }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      data-testid="ask-belastbarkeit-konfliktseite"
      className="min-w-0 flex-1 rounded-btn border border-hairline bg-surface p-2"
    >
      <div className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
        {t("ask.belastbarkeit.konflikt.seite", { nummer })}
        {seite.traegtAntwort ? ` · ${t("ask.belastbarkeit.konflikt.traegt")}` : ""}
      </div>
      {seite.einsehbar ? (
        <>
          <p className="mt-0.5 text-[12.5px] font-semibold text-text">{seite.titel}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{seite.aussage}</p>
          <p className="mt-0.5 text-[11px] text-muted-2">
            {t("ask.belastbarkeit.vertrauenswertKurz", { wert: seite.vertrauenswert })} ·{" "}
            {t(
              seite.validiert
                ? "ask.belastbarkeit.quelle.validiert"
                : "ask.belastbarkeit.quelle.nichtValidiert",
            )}{" "}
            · v{seite.version}
          </p>
        </>
      ) : (
        <p className="mt-0.5 text-[12px] text-muted">
          {t("ask.belastbarkeit.konflikt.nichtEinsehbar")}
        </p>
      )}
    </div>
  );
}

// ================================================================================================
// R-1627 — DIE ARGUMENTATIONSKETTE, JEDE STUFE AUFKLAPPBAR.
// ================================================================================================
//
// Die Stufen kommen fertig vom Server (Aussagen → belegte Beziehungen → Einwand → Vorbehalt →
// Schluss), jede an eine Quelle, eine kuratierte Kante, einen Widerspruch oder einen benannten Grund
// gebunden. Die Fläche ordnet nichts um und leitet keine Beziehung aus der Reihenfolge ab (Ben
// nacharbeit-9): ohne belegte Beziehung steht am Schluss ausdrücklich, dass die Aussagen unabhängig
// sind.
// R-0346: bei `tiefe: "kurz"` stehen nur Aussage und Schluss offen; die übrigen Stufen sind
// zugeklappt, aber vorhanden. Ohne Zuschnitt (älterer Server) steht alles offen.
function offenNachTiefe(
  art: ArgumentStufe["art"],
  zuschnitt: AntwortZuschnitt | undefined,
): boolean {
  return zuschnitt?.tiefe !== "kurz" || art === "aussage" || art === "schluss";
}

function StufenInhalt({
  stufe,
  fach,
  titel,
}: {
  stufe: ArgumentStufe;
  fach: boolean;
  titel: ReadonlyMap<string, string>;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  // Jeder Fall wird über EINE Literalprüfung verengt; der Rest ist eine Aussage.
  if (stufe.art === "schluss") {
    return (
      <div className="mt-1 text-[12px] leading-relaxed text-muted">
        {stufe.aussage ? (
          <p data-testid="ask-argument-schluss-aussage" className="whitespace-pre-line text-text">
            {stufe.aussage}
          </p>
        ) : null}
        {stufe.gestuetztAuf.length > 0 ? (
          <p className="mt-0.5 text-[11px] text-muted-2">
            {t("ask.belastbarkeit.argumentation.gestuetztAuf", {
              quellen: stufe.gestuetztAuf.map((id) => titel.get(id) ?? id).join(", "),
            })}
          </p>
        ) : null}
        {stufe.unabhaengig ? (
          <p data-testid="ask-argument-unabhaengig" className="mt-0.5 text-[11px] text-muted-2">
            {t("ask.belastbarkeit.argumentation.unabhaengig")}
          </p>
        ) : null}
        <p className="mt-0.5 text-[11px] text-muted-2">
          {t(`ask.belastbarkeit.lage.${stufe.lage}`)} ·{" "}
          {t(`ask.belastbarkeit.argumentation.einstufung.${stufe.einstufung}`)}
        </p>
      </div>
    );
  }
  if (stufe.art === "beziehung") {
    return (
      <div className="mt-1 text-[12px] leading-relaxed text-muted">
        <p className="text-text">
          {stufe.vonTitel} {stufe.gerichtet ? "→" : "↔"}{" "}
          {t(`ask.belastbarkeit.argumentation.beziehung.${stufe.beziehung}`)}{" "}
          {stufe.gerichtet ? "→" : "↔"} {stufe.zuTitel}
        </p>
        {stufe.gesetztVon ? (
          <p className="mt-0.5 text-[11px] text-muted-2">
            {t("ask.belastbarkeit.argumentation.gesetztVon", { wer: stufe.gesetztVon })}
          </p>
        ) : null}
      </div>
    );
  }
  if (stufe.art === "einwand") {
    return (
      <div className="mt-1 text-[12px] leading-relaxed text-muted">
        {stufe.seite.einsehbar ? (
          <p className="text-text">
            {stufe.seite.titel}: {stufe.seite.aussage}
          </p>
        ) : (
          <p>{t("ask.belastbarkeit.konflikt.nichtEinsehbar")}</p>
        )}
      </div>
    );
  }
  if (stufe.art === "vorbehalt") {
    return (
      <p className="mt-1 text-[12px] leading-relaxed text-muted">
        {t(`ask.belastbarkeit.grund.${stufe.grund}`)}
      </p>
    );
  }
  return (
    <div className="mt-1 text-[12px] leading-relaxed text-muted">
      <p className="text-text">{stufe.aussage}</p>
      {stufe.belegstelle ? (
        <p className="mt-0.5 font-mono text-[11px] text-muted-2">
          {t("ask.belastbarkeit.argumentation.belegstelle", { stelle: stufe.belegstelle })}
        </p>
      ) : null}
      <p className="mt-0.5 text-[11px] text-muted-2">
        {t(`ask.belastbarkeit.wissensart.${stufe.wissensart}`)} ·{" "}
        {t("ask.belastbarkeit.vertrauenswertKurz", { wert: stufe.vertrauenswert })} ·{" "}
        {t(
          stufe.validiert
            ? "ask.belastbarkeit.quelle.validiert"
            : "ask.belastbarkeit.quelle.nichtValidiert",
        )}{" "}
        ·{" "}
        {t("ask.belastbarkeit.stand", {
          datum: formatKoTimestamp(stufe.stand, i18n.language) ?? stufe.stand,
        })}
        {fach ? ` · ${stufe.koId}` : ""}
      </p>
    </div>
  );
}

function Argumentation({
  stufen,
  zuschnitt,
}: {
  stufen: readonly ArgumentStufe[];
  zuschnitt: AntwortZuschnitt | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const fach = zuschnitt?.fachsprache !== "allgemein";
  const titel = new Map(
    stufen.flatMap((s): [string, string][] => (s.art === "aussage" ? [[s.koId, s.titel]] : [])),
  );
  return (
    <div data-testid="ask-argumentation" className="mt-2">
      <p className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
        {t("ask.belastbarkeit.argumentation.titel")}
      </p>
      <ol className="mt-1 space-y-1">
        {stufen.map((stufe, i) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: die Stufenfolge ist die Reihenfolge des Servers.
            key={i}
            data-testid="ask-argument-stufe"
            data-art={stufe.art}
            className="rounded-btn border border-hairline bg-surface px-2 py-1"
          >
            <details open={offenNachTiefe(stufe.art, zuschnitt)}>
              <summary className="cursor-pointer text-[12px] font-semibold text-text">
                {i + 1}. {t(`ask.belastbarkeit.argumentation.art.${stufe.art}`)}
                {stufe.art === "aussage" ? `: ${stufe.titel}` : ""}
              </summary>
              <StufenInhalt stufe={stufe} fach={fach} titel={titel} />
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Belastbarkeit({ b }: { b: AntwortBelastbarkeit }): JSX.Element {
  const { t, i18n } = useTranslation();
  const schwaechste = b.quellen.find((q) => q.koId === b.vertrauenswert.schwaechsteQuelle);
  // R-0346: `allgemein` lässt technische Angaben (Fassung, Prüfstand-Kennung) in der Darstellung weg.
  const fach = b.zuschnitt?.fachsprache !== "allgemein";
  return (
    <section
      data-testid="ask-belastbarkeit"
      data-lage={b.lage}
      className="rounded-card border border-hairline bg-page px-3 py-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
          {t("ask.belastbarkeit.titel")}
        </span>
        <span
          data-testid="ask-belastbarkeit-lage"
          className={`rounded-pill px-2 py-0.5 text-[11.5px] font-semibold ${LAGE_TON[b.lage]}`}
        >
          {t(`ask.belastbarkeit.lage.${b.lage}`)}
        </span>
        <span className="text-[11.5px] text-muted">
          {t("ask.belastbarkeit.anzahl", {
            tragend: b.quellenAnzahl.tragend,
            herangezogen: b.quellenAnzahl.herangezogen,
          })}
        </span>
      </div>
      <p data-testid="ask-belastbarkeit-vertrauenswert" className="mt-1 text-[12px] text-text">
        {b.vertrauenswert.wert !== null && schwaechste
          ? t("ask.belastbarkeit.vertrauenswert", {
              wert: b.vertrauenswert.wert,
              quelle: schwaechste.titel,
            })
          : t("ask.belastbarkeit.vertrauenswertKeiner")}
      </p>
      {b.gruende.length > 0 ? (
        <ul data-testid="ask-belastbarkeit-gruende" className="mt-1 list-disc pl-4">
          {b.gruende.map((g) => (
            <li key={g} className="text-[12px] leading-relaxed text-muted">
              {t(`ask.belastbarkeit.grund.${g}`)}
            </li>
          ))}
        </ul>
      ) : null}
      {b.quellen.length > 0 ? (
        <ul className="mt-1.5 space-y-1">
          {b.quellen.map((q) => (
            <li
              key={q.koId}
              data-testid="ask-belastbarkeit-quelle"
              className="flex flex-wrap gap-x-2 text-[11.5px] text-muted"
            >
              <span className="font-semibold text-text">{q.titel}</span>
              {fach ? <span>v{q.version}</span> : null}
              <span>{t("ask.belastbarkeit.vertrauenswertKurz", { wert: q.vertrauenswert })}</span>
              <span>
                {t("ask.belastbarkeit.stand", {
                  datum: formatKoTimestamp(q.stand, i18n.language) ?? q.stand,
                })}
              </span>
              <span>
                {t(
                  q.validiert
                    ? "ask.belastbarkeit.quelle.validiert"
                    : "ask.belastbarkeit.quelle.nichtValidiert",
                )}
                {fach && q.pruefstand !== "proven" ? ` · ${t("ask.checkCaveat.badge")}` : ""}
              </span>
              <Verantwortung q={q} fach={fach} />
            </li>
          ))}
        </ul>
      ) : null}
      {b.woerterbuch && b.woerterbuch.length > 0 ? (
        // Ben nacharbeit-11: Begriffserklärungen aus dem Firmenwörterbuch stehen GETRENNT von der
        // Quellenbilanz — ohne Vertrauenswert, mit Eintrag, Fassung und Verantwortung.
        <div data-testid="ask-belastbarkeit-woerterbuch" className="mt-1.5">
          <p className="text-[11.5px] text-muted">{t("ask.belastbarkeit.woerterbuch.titel")}</p>
          <ul className="mt-0.5 space-y-0.5">
            {b.woerterbuch.map((w) => (
              <li
                key={`${w.herkunft.eintragId}:${w.benennung}`}
                data-testid="ask-belastbarkeit-woerterbuch-eintrag"
                className="flex flex-wrap gap-x-2 text-[11.5px] text-muted"
              >
                <span className="font-semibold text-text">{w.benennung}</span>
                <span data-testid="ask-belastbarkeit-woerterbuch-definition" className="text-text">
                  {w.definition}
                </span>
                <span>
                  {t("ask.belastbarkeit.woerterbuch.eintrag", {
                    id: w.herkunft.eintragId,
                    fassung: w.herkunft.fassung,
                  })}
                </span>
                {w.herkunft.geltungsbereich ? <span>{w.herkunft.geltungsbereich}</span> : null}
                <span>
                  {w.herkunft.verantwortlich
                    ? t("ask.belastbarkeit.woerterbuch.verantwortlich", {
                        wer: w.herkunft.verantwortlich,
                      })
                    : t("ask.belastbarkeit.woerterbuch.ohneVerantwortung")}
                </span>
                {w.herkunft.geaendertAm ? (
                  <span>
                    {t("ask.belastbarkeit.stand", {
                      datum:
                        formatKoTimestamp(w.herkunft.geaendertAm, i18n.language) ??
                        w.herkunft.geaendertAm,
                    })}
                  </span>
                ) : null}
                <span>{t("ask.belastbarkeit.woerterbuch.nichtBewertet")}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {b.konflikte.map((k) => (
        <div
          key={k.konfliktId}
          data-testid="ask-belastbarkeit-konflikt"
          className="mt-2 rounded-btn border border-trust-crit-fill bg-trust-crit-bg p-2"
        >
          <p className="text-[12.5px] font-semibold text-trust-crit-text">
            {t("ask.belastbarkeit.konflikt.titel")}
          </p>
          {k.beschreibung ? (
            <p className="mt-0.5 text-[12px] text-trust-crit-text">{k.beschreibung}</p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap gap-2">
            <Seite seite={k.seiten[0]} nummer={1} />
            <Seite seite={k.seiten[1]} nummer={2} />
          </div>
          <p className="mt-1 text-[11.5px] text-trust-crit-text">
            {t("ask.belastbarkeit.konflikt.keinGewinner")}
          </p>
        </div>
      ))}
      {b.argumentation && b.argumentation.length > 0 ? (
        <Argumentation stufen={b.argumentation} zuschnitt={b.zuschnitt} />
      ) : null}
      {b.zuschnitt ? (
        <p data-testid="ask-zuschnitt" className="mt-1.5 text-[11px] text-muted-2">
          {t("ask.belastbarkeit.zuschnitt", {
            rolle: t(`ask.belastbarkeit.rolle.${b.zuschnitt.rolle}`),
            anlass: t(`ask.belastbarkeit.anlass.${b.zuschnitt.anlass}`),
          })}
        </p>
      ) : null}
      <p className="mt-1.5 text-[11px] text-muted-2">{t("ask.belastbarkeit.hinweis")}</p>
    </section>
  );
}

/** R-0284: der Rahmen einer Wissenslücke — wogegen geprüft wurde, statt einer nackten Null. */
export function PruefrahmenSatz({ rahmen }: { rahmen: AskPruefrahmen }): JSX.Element {
  const { t } = useTranslation();
  return (
    <p data-testid="ask-pruefrahmen" className="mt-1 text-[12.5px] text-muted">
      {t("ask.pruefrahmen.satz", {
        umfang: t(`ask.pruefrahmen.umfang.${rahmen.umfang}`),
        verglichen: rahmen.verglichen,
        hoechstens: rahmen.hoechstens,
      })}
      {rahmen.nurWoertlich ? ` ${t("ask.pruefrahmen.woertlich")}` : ""}
    </p>
  );
}
