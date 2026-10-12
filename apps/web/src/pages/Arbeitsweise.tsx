import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useGraph, useKos } from "../api/hooks";
import { RoleLink } from "../components/RoleLink";
import { Card, PageHeader, QueryState } from "../components/ui";
import { SoArbeitetKlarwerk } from "./Stufe2";

// ================================================================================================
// Aufnahme `gesamt-hilfen` · R-0443 — DIE EIGENE SEITE „SO ARBEITET KLARWERK“.
// ================================================================================================
//
// Originalwortlaut: „Eine eigene Seite zeigt dem Anwender, wie das Wissensnetz aufgebaut ist und
// wie mit Klarwerk gearbeitet wird.“ Bis Nacharbeit 5 gab es nur die aufklappbare Vorführsicht auf
// der Graphseite (`/graph`, Stufe 2, nur Verwaltung). Diese Seite steht unter
// `/so-arbeitet-klarwerk` für ALLE angemeldeten Rollen und ist von der Hilfeseite verlinkt.
//
// ZWEI TEILE, BEIDE AUS VORHANDENEM:
//   · „Wie das Wissensnetz aufgebaut ist“ — Knoten, Themen, gesetzte Fachbeziehungen, Stand; darunter
//     die WIEDERVERWENDETE kuratierte Sicht `SoArbeitetKlarwerk` (R-1983) mit den Daten derselben
//     Abfrage `/api/graph`, die der Server je Person nach Sichtrechten trimmt (`ko.read`).
//   · „Wie mit Klarwerk gearbeitet wird“ — der Kreislauf mit dem Weg in jeden Bereich. Der Weg ist
//     ein `RoleLink`: wo die Rolle nicht reicht, steht der Bereich ohne Link da (dasselbe Tor wie
//     der Router), statt in eine Sperrkarte zu führen.
//
// KEIN NAV-PUNKT: die Seite ist eine Erklärung, kein Arbeitsbereich — wie `/einstieg/:thema`. Der
// Einstieg steht auf der Hilfeseite oben (`pages/Help.tsx`, `hilfe-arbeitsweise`).

const SCHRITTE = [
  { id: "erfassen", textKey: "arbeitsweise.arbeit.erfassen", to: "/erfassen", nav: "nav.capture" },
  {
    id: "pruefen",
    textKey: "arbeitsweise.arbeit.pruefen",
    to: "/validierung",
    nav: "nav.validation",
  },
  { id: "nutzen", textKey: "arbeitsweise.arbeit.nutzen", to: "/bibliothek", nav: "nav.library" },
  { id: "pflegen", textKey: "arbeitsweise.arbeit.pflegen", to: "/konflikte", nav: "nav.conflicts" },
  { id: "luecken", textKey: "arbeitsweise.arbeit.luecken", to: "/risiko", nav: "nav.risk" },
] as const;

const NETZ = [
  "arbeitsweise.netz.objekt",
  "arbeitsweise.netz.themen",
  "arbeitsweise.netz.beziehungen",
  "arbeitsweise.netz.stand",
] as const;

export function Arbeitsweise(): JSX.Element {
  const { t } = useTranslation();
  const graphQ = useGraph();
  const kosQ = useKos();
  // Ohne geladenen Bestand ist kein Eintrag ein Link — ein Klick ins Leere wäre schlechter als
  // ein Titel ohne Ziel (dieselbe Regel wie auf der Graphseite, `isNavigableNode`).
  const bekannt = new Set((kosQ.data ?? []).map((ko) => ko.id));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        kicker={t("arbeitsweise.kicker")}
        title={t("arbeitsweise.titel")}
        lead={t("arbeitsweise.lead")}
        pageKey="arbeitsweise"
      />
      <Card data-testid="arbeitsweise-netz" className="mb-5">
        <h2 className="text-[15px] font-semibold text-ink">{t("arbeitsweise.netz.titel")}</h2>
        <ul className="mt-2 space-y-1.5">
          {NETZ.map((key) => (
            <li key={key} className="text-[13px] leading-relaxed text-text">
              {t(key)}
            </li>
          ))}
        </ul>
        <RoleLink
          to="/wissensnetz"
          testId="arbeitsweise-themenkarte"
          className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-ai"
          hoverClassName="hover:opacity-80"
        >
          {() => (
            <>
              {t("arbeitsweise.netz.karte")}
              <ArrowRight size={13} />
            </>
          )}
        </RoleLink>
        <div data-testid="arbeitsweise-sicht" className="mt-4">
          <h3 className="text-[13px] font-semibold text-ink">{t("arbeitsweise.sicht.titel")}</h3>
          <QueryState query={graphQ}>
            {(raw) => (
              <SoArbeitetKlarwerk
                kanten={raw.kuratierteKanten}
                gesamt={raw.kuratierteKantenGesamt}
                gekuerzt={raw.kuratierteKantenGekuerzt}
                titelVon={new Map(raw.nodes.map((n) => [n.id, n.title]))}
                bekannt={bekannt}
                mitBildschritten={false}
              />
            )}
          </QueryState>
        </div>
      </Card>
      <Card data-testid="arbeitsweise-arbeit" className="mb-5">
        <h2 className="text-[15px] font-semibold text-ink">{t("arbeitsweise.arbeit.titel")}</h2>
        <ol className="mt-2 space-y-2">
          {SCHRITTE.map((schritt) => (
            <li key={schritt.id} data-arbeitsweise-schritt={schritt.id}>
              <p className="text-[13px] leading-relaxed text-text">{t(schritt.textKey)}</p>
              <RoleLink
                to={schritt.to}
                testId={`arbeitsweise-weg-${schritt.id}`}
                className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-semibold text-ai"
                hoverClassName="hover:opacity-80"
              >
                {() => (
                  <>
                    {t(schritt.nav)}
                    <ArrowRight size={12} />
                  </>
                )}
              </RoleLink>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[12px] leading-relaxed text-muted-2">
          {t("arbeitsweise.arbeit.hinweis")}
        </p>
      </Card>
      <Link
        to="/hilfe"
        data-testid="arbeitsweise-hilfe"
        className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-ai hover:opacity-80"
      >
        {t("arbeitsweise.hilfe")}
        <ArrowRight size={13} />
      </Link>
    </div>
  );
}
