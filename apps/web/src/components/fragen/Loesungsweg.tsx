// ================================================================================================
// R-1662 · GEFÜHRTER WEG VOM PROBLEM ZUR LÖSUNG — zwei Bausteine an der Antwort.
// ================================================================================================
//
// `VermeidenWarnung` steht im Warnblock `ask-warnungen` direkt hinter der Antwort: „Was vermeiden?"
// ist eine Warnung und gehört nach R-0286 genau dorthin, sichtbar und genau einmal.
// `LoesungswegSchritte` ist der Inhalt des Blatts „Lösungsweg": Rahmung und nächste Schritte —
// belastbarste Quelle öffnen, bekannte Fehler beachten, Personen mit Wissensspuren, neuen Fall
// dokumentieren. Was sie zeigen, entscheidet allein `lib/problemloesungsweg.ts`; die Seite reicht
// nur Adressen und Namensauflösung herein. Eine Anfrage an eine Person bietet Klarwerk heute nicht
// an — das Blatt sagt das, statt einen Knopf ohne Weg zu zeigen.
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { formatKoTimestamp } from "../../lib/koDates";
import type {
  FruehereRevalidierung,
  GeloesterKonfliktHinweis,
  Problemloesungsweg,
  WegBefund,
  WegQuelle,
} from "../../lib/problemloesungsweg";
import { RoleLink } from "../RoleLink";

// Jede Klassenbindung dieser Datei ist ein Literal: der Klassensammler
// (`tests/app/mega47-modale-flaechen-sammler.test.tsx`, JOB 1181) liest sie vollständig.

export function VermeidenWarnung({
  vermeiden,
  wissenHref,
}: {
  vermeiden: readonly WegQuelle[];
  wissenHref: (id: string) => string;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      data-testid="ask-vermeiden"
      className="rounded-card border border-trust-warn-fill bg-trust-warn-bg px-3 py-2"
    >
      <p className="text-[12.5px] font-semibold text-trust-warn-text">
        {t("loesungsweg.vermeiden.titel")}
      </p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-trust-warn-text">
        {t("loesungsweg.vermeiden.text")}
      </p>
      <ul className="mt-1 space-y-0.5">
        {vermeiden.map((q) => (
          <li key={q.id}>
            <Link
              to={wissenHref(q.id)}
              data-testid="ask-vermeiden-quelle"
              className="text-[12px] font-semibold text-trust-warn-text underline"
            >
              {q.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Laden und Fehler einer Prüfung — eigener Satz statt „keine": ein Netzfehler ist keine Auskunft. */
function BefundStand({ befund }: { befund: WegBefund<unknown> }): JSX.Element | null {
  const { t } = useTranslation();
  if (befund.stand === "da") {
    return null;
  }
  return (
    <span data-stand={befund.stand} className="block text-[12px] text-muted-2">
      {t(befund.stand === "laedt" ? "loesungsweg.stand.laedt" : "loesungsweg.stand.fehler")}
    </span>
  );
}

export function LoesungswegSchritte({
  weg,
  konflikte,
  revalidierung,
  frueher,
  wissenHref,
  nameVon,
}: {
  weg: Problemloesungsweg;
  /** R-1662 Prüfpunkt 5: gelöste Konflikte zu den Quellen (`lib/problemloesungsweg.ts`). */
  konflikte: WegBefund<GeloesterKonfliktHinweis>;
  /** R-1662 Prüfpunkt 6: Quellen mit offenem Revalidierungsfall. */
  revalidierung: WegBefund<WegQuelle>;
  /** R-1662 Prüfpunkt 6 (Ben, Nacharbeit 5): frühere, schon bestätigte Revalidierungen. */
  frueher: WegBefund<FruehereRevalidierung>;
  wissenHref: (id: string) => string;
  nameVon: (ref: string) => string;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  return (
    <div data-testid="ask-loesungsweg-inhalt" className="text-[13px] text-text">
      <p data-testid="ask-loesungsweg-hinweis" className="text-[12.5px] leading-relaxed text-muted">
        {t(weg.hinweisKey)}
      </p>
      <p className="mt-4 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-2">
        {t("loesungsweg.schritte")}
      </p>
      <ol className="mt-2 list-decimal space-y-3 pl-5">
        {weg.oeffnen ? (
          <li data-testid="ask-loesungsweg-quelle">
            <span className="block font-semibold">{t("loesungsweg.schritt.quelle")}</span>
            <Link
              to={wissenHref(weg.oeffnen.id)}
              className="inline-flex items-center gap-1 font-medium text-brand-text hover:underline"
            >
              {weg.oeffnen.label}
              <ArrowRight size={12} aria-hidden="true" className="shrink-0" />
            </Link>
          </li>
        ) : null}
        {weg.vermeiden.length > 0 ? (
          <li data-testid="ask-loesungsweg-vermeiden">
            <span className="block font-semibold">{t("loesungsweg.schritt.vermeiden")}</span>
            {weg.vermeiden.map((q) => (
              <Link
                key={q.id}
                to={wissenHref(q.id)}
                className="mr-3 inline-flex items-center gap-1 font-medium text-brand-text hover:underline"
              >
                {q.label}
                <ArrowRight size={12} aria-hidden="true" className="shrink-0" />
              </Link>
            ))}
          </li>
        ) : null}
        <li data-testid="ask-loesungsweg-revalidierung">
          <span className="block font-semibold">{t("loesungsweg.schritt.revalidierung")}</span>
          {/* Ben, Nacharbeit 5: OFFENE Fälle (Merker gesetzt) und FRÜHERE Bestätigungen (Beleg im
              Prüfprotokoll) sind zwei Aussagen — sie stehen getrennt, jede mit eigenem Stand. */}
          <div data-testid="ask-loesungsweg-revalidierung-offen" className="mt-1">
            <span className="block text-[11px] font-semibold uppercase text-muted-2">
              {t("loesungsweg.revalidierung.offenTitel")}
            </span>
            <BefundStand befund={revalidierung} />
            {revalidierung.stand === "da" && revalidierung.eintraege.length === 0 ? (
              <span className="block text-[12px] text-muted-2">
                {t("loesungsweg.revalidierung.keine")}
              </span>
            ) : null}
            {revalidierung.stand === "da" && revalidierung.eintraege.length > 0 ? (
              <>
                <span className="block text-[12px] text-muted-2">
                  {t("loesungsweg.revalidierung.text")}
                </span>
                <ul className="mt-1 space-y-1">
                  {revalidierung.eintraege.map((q) => (
                    <li key={q.id} data-testid="ask-loesungsweg-revalidierung-fall">
                      <Link
                        to={wissenHref(q.id)}
                        className="mr-3 inline-flex items-center gap-1 font-medium text-brand-text hover:underline"
                      >
                        {q.label}
                      </Link>
                      {/* /lebenszyklus verlangt „controller": über `RoleLink` sieht, wer den Fall
                          nicht öffnen darf, die Lage statt eines toten Links. */}
                      <RoleLink
                        to={`/lebenszyklus?fall=${encodeURIComponent(q.id)}`}
                        testId="ask-loesungsweg-revalidierung-link"
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-text"
                        hoverClassName="hover:underline"
                      >
                        {(erreichbar) => (
                          <>
                            {t("loesungsweg.revalidierung.fall")}
                            {erreichbar ? <ArrowRight size={12} aria-hidden="true" /> : null}
                          </>
                        )}
                      </RoleLink>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
          <div data-testid="ask-loesungsweg-revalidierung-frueher" className="mt-2">
            <span className="block text-[11px] font-semibold uppercase text-muted-2">
              {t("loesungsweg.revalidierung.frueherTitel")}
            </span>
            <BefundStand befund={frueher} />
            {frueher.stand === "da" && frueher.eintraege.length === 0 ? (
              <span className="block text-[12px] text-muted-2">
                {t("loesungsweg.revalidierung.frueherKeine")}
              </span>
            ) : null}
            {frueher.stand === "da" && frueher.eintraege.length > 0 ? (
              <ul className="mt-1 space-y-1">
                {frueher.eintraege.map((f) => (
                  <li key={f.quelle.id} data-testid="ask-loesungsweg-revalidierung-bestaetigt">
                    <Link
                      to={wissenHref(f.quelle.id)}
                      className="font-medium text-brand-text hover:underline"
                    >
                      {f.quelle.label}
                    </Link>
                    <span className="block text-[12px] text-muted-2">
                      {t(
                        f.version === null
                          ? "loesungsweg.revalidierung.frueherOhneFassung"
                          : "loesungsweg.revalidierung.frueher",
                        {
                          datum: formatKoTimestamp(f.zuletztAm, i18n.language) ?? f.zuletztAm,
                          version: f.version,
                          anzahl: f.anzahl,
                        },
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </li>
        <li data-testid="ask-loesungsweg-konflikte">
          <span className="block font-semibold">{t("loesungsweg.schritt.konflikte")}</span>
          <BefundStand befund={konflikte} />
          {konflikte.stand === "da" && konflikte.eintraege.length === 0 ? (
            <span className="block text-[12px] text-muted-2">
              {t("loesungsweg.konflikt.keine")}
            </span>
          ) : null}
          {konflikte.stand === "da" && konflikte.eintraege.length > 0 ? (
            <ul className="mt-1 space-y-2">
              {konflikte.eintraege.map((k) => (
                <li key={k.id} data-testid="ask-loesungsweg-konflikt">
                  <Link
                    to={wissenHref(k.quelle.id)}
                    className="font-medium text-brand-text hover:underline"
                  >
                    {k.quelle.label}
                  </Link>
                  {" ↔ "}
                  <Link
                    to={wissenHref(k.gegen.id)}
                    className="font-medium text-brand-text hover:underline"
                  >
                    {k.gegen.label}
                  </Link>
                  <span data-ausgang={k.ausgang} className="block text-[12px] text-muted-2">
                    {t(`loesungsweg.konflikt.${k.ausgang}`)}
                  </span>
                  {k.entscheidung ? (
                    <span className="block text-[12px] text-text">
                      {t("loesungsweg.konflikt.entscheidung", { text: k.entscheidung })}
                    </span>
                  ) : null}
                  {k.zurueckgehalten ? (
                    <span className="block text-[12px] text-muted-2">
                      {t("loesungsweg.konflikt.zurueckgehalten")}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
        <li data-testid="ask-loesungsweg-personen">
          <span className="block font-semibold">{t("loesungsweg.schritt.personen")}</span>
          {weg.personen.length > 0 ? (
            <ul className="mt-1 space-y-1">
              {weg.personen.map((p) => (
                <li key={p.ref} data-testid="ask-loesungsweg-person">
                  <span className="font-medium">{nameVon(p.ref)}</span>{" "}
                  <span className="text-[12px] text-muted-2">
                    {t("loesungsweg.personQuellen", { quellen: p.quellen.join(", ") })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="block text-[12px] text-muted-2">{t("loesungsweg.keinePerson")}</span>
          )}
          <span className="mt-1 block text-[11.5px] text-muted-2">
            {t("loesungsweg.personenGrenze")}
          </span>
        </li>
        <li data-testid="ask-loesungsweg-fall">
          {/* /erfassen verlangt „experte": über `RoleLink` sieht, wer den Weg nicht gehen darf, die
              Lage statt eines toten Links (AUFTRAG-mega71 Block E). */}
          <RoleLink
            to="/erfassen"
            testId="ask-loesungsweg-erfassen"
            className="inline-flex items-center gap-1 font-medium text-brand-text"
            hoverClassName="hover:underline"
          >
            {(erreichbar) => (
              <>
                {t("loesungsweg.schritt.fall")}
                {erreichbar ? <ArrowRight size={12} aria-hidden="true" /> : null}
              </>
            )}
          </RoleLink>
        </li>
      </ol>
    </div>
  );
}
