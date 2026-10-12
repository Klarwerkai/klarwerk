// ADMIN-15 · Interne Richtlinien für jedes angemeldete Konto (`/richtlinien`).
//
// Die Route trägt kein Rollentor; welche Richtlinien jemand sieht, entscheidet der Server über die
// Geltung der Fassung (`GET /api/richtlinien`). ANZEIGEN IST KEINE HANDLUNG: das Öffnen dieser Seite
// schreibt nichts. Kenntnisnahme oder Zustimmung entstehen nur über den ausdrücklichen Knopf — und
// gelten genau der Fassung, die darauf genannt ist.
//
// Rechtliche Dokumente (Impressum, Datenschutz) bleiben eigene, feste Seiten; hier wird nur auf sie
// verwiesen.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { type MeineRichtlinie, unternehmenApi } from "../api/unternehmen";
import { Button, Card, PageHeader } from "../components/ui";
import { UnternehmensKopf } from "../components/unternehmen/UnternehmensKopf";
import { LEGAL_PATHS } from "../legal/LegalPages";
import { formatKoTimestamp } from "../lib/koDates";

function fehlerSchluessel(fehler: unknown): string {
  if (fehler instanceof ApiError) {
    const nachCode: Record<string, string> = {
      FASSUNG_VERALTET: "unternehmen.richtlinien.fehler.veraltet",
      NOT_FOUND: "unternehmen.richtlinien.fehler.weg",
      NICHT_HALTBAR: "unternehmen.fehler.nichtHaltbar",
    };
    if (nachCode[fehler.code]) {
      return nachCode[fehler.code] as string;
    }
    if (fehler.status === 401) {
      return "unternehmen.fehler.anmeldung";
    }
  }
  return "unternehmen.fehler.allgemein";
}

function Handlungsbereich({ r }: { r: MeineRichtlinie }): JSX.Element {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const handeln = useMutation({
    mutationFn: () => {
      if (r.anforderung === "anzeige") {
        throw new Error("keine Handlung");
      }
      return unternehmenApi.handeln(r.id, r.fassung, r.anforderung);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["richtlinien", "meine"] }),
  });

  if (r.anforderung === "anzeige") {
    return (
      <p data-testid="richtlinie-status" className="text-[12.5px] text-muted">
        {t("unternehmen.richtlinien.nurAnzeige")}
      </p>
    );
  }
  if (r.meineHandlung) {
    return (
      <p data-testid="richtlinie-status" className="text-[12.5px] font-medium text-text">
        {t(
          r.meineHandlung.handlung === "zustimmung"
            ? "unternehmen.richtlinien.zugestimmtAm"
            : "unternehmen.richtlinien.kenntnisAm",
          {
            zeit: formatKoTimestamp(r.meineHandlung.am, i18n.language) ?? "—",
            fassung: r.meineHandlung.fassung,
          },
        )}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-[12.5px] text-muted">
        {t(
          r.anforderung === "zustimmung"
            ? "unternehmen.richtlinien.zustimmungErklaerung"
            : "unternehmen.richtlinien.kenntnisErklaerung",
          { fassung: r.fassung },
        )}
      </p>
      <Button
        variant="primary"
        data-testid="richtlinie-handeln"
        data-handlung={r.anforderung}
        disabled={handeln.isPending}
        onClick={() => handeln.mutate()}
      >
        {t(
          r.anforderung === "zustimmung"
            ? "unternehmen.richtlinien.zustimmen"
            : "unternehmen.richtlinien.kenntnisnehmen",
          { fassung: r.fassung },
        )}
      </Button>
      {handeln.isError ? (
        <p
          role="alert"
          data-testid="richtlinie-fehler"
          className="text-[12.5px] text-trust-crit-text"
        >
          {t(fehlerSchluessel(handeln.error))}
        </p>
      ) : null}
    </div>
  );
}

export function Richtlinien(): JSX.Element {
  const { t, i18n } = useTranslation();
  const profil = useQuery({ queryKey: ["unternehmensprofil"], queryFn: unternehmenApi.profil });
  const liste = useQuery({
    queryKey: ["richtlinien", "meine"],
    queryFn: unternehmenApi.meineRichtlinien,
  });

  return (
    <div className="mx-auto max-w-3xl">
      {profil.data?.profil ? (
        <div className="mb-5">
          <UnternehmensKopf profil={profil.data.profil} />
        </div>
      ) : null}
      <PageHeader
        pageKey="richtlinien"
        title={t("unternehmen.richtlinien.titel")}
        lead={t("unternehmen.richtlinien.lead")}
      />
      {liste.isPending ? (
        <p className="text-sm text-muted">{t("unternehmen.richtlinien.laedt")}</p>
      ) : null}
      {liste.isError ? (
        <p role="alert" className="text-sm text-muted">
          {t(fehlerSchluessel(liste.error))}
        </p>
      ) : null}
      {liste.isSuccess && liste.data.richtlinien.length === 0 ? (
        <p data-testid="richtlinien-leer" className="text-sm text-muted">
          {t("unternehmen.richtlinien.leer")}
        </p>
      ) : null}
      <ul className="space-y-3">
        {(liste.data?.richtlinien ?? []).map((r) => (
          <li key={r.id}>
            <Card interactive={false} data-testid="richtlinie" data-richtlinie={r.id}>
              <article aria-labelledby={`richtlinie-${r.id}`} className="space-y-3">
                <header className="space-y-1">
                  <h2 id={`richtlinie-${r.id}`} className="text-[16px] font-semibold text-ink">
                    {r.titel}
                  </h2>
                  <p data-testid="richtlinie-meta" className="text-[12px] text-muted-2">
                    {t("unternehmen.richtlinie.meta", {
                      fassung: r.fassung,
                      datum: new Date(`${r.gueltigAb}T00:00:00`).toLocaleDateString(i18n.language),
                      verantwortlich: r.verantwortlich,
                    })}
                  </p>
                </header>
                <div className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-text">
                  {r.text}
                </div>
                <Handlungsbereich r={r} />
              </article>
            </Card>
          </li>
        ))}
      </ul>
      <p data-testid="richtlinien-rechtliches" className="mt-6 text-[12px] text-muted-2">
        {t("unternehmen.richtlinien.rechtlich")}{" "}
        <a className="underline" href={LEGAL_PATHS.imprint}>
          {t("unternehmen.richtlinien.impressum")}
        </a>
        {" · "}
        <a className="underline" href={LEGAL_PATHS.privacy}>
          {t("unternehmen.richtlinien.datenschutz")}
        </a>
      </p>
    </div>
  );
}
