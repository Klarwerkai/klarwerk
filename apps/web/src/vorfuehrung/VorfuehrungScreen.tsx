// ================================================================================================
// R-0570 · DIE ANONYME VORFÜHRUNG — LESEN UND FRAGEN OHNE ANMELDUNG, NUR AN ERFUNDENEM INHALT.
// ================================================================================================
//
// Entscheidung zu Frage 14 (11.10.2026): „Firmenwissen authentifiziert; anonyme Demo nur
// öffentlich/fiktiv." Diese Fläche liegt VOR dem Anmeldetor (`App.tsx`, wie /reset und die
// Rechtsseiten) und spricht ausschliesslich mit den zwei Vorführungswegen des Servers
// (`services/app/src/routes/vorfuehrung-routes.ts`). Keine andere Schnittstelle wird von hier aus
// gerufen — Unternehmenswissen bleibt hinter der Anmeldung.
//
// Die Kennzeichnung kommt vom Server und steht über allem: sie ist Teil jeder Antwort, nicht ein
// Satz, den die Oberfläche auch weglassen könnte.
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useFeatures } from "../api/hooks";
import { BrandCompact, BrandPanel, PublicLangSwitch } from "../auth/BrandPanel";
import { Button, Field, TextInput } from "../components/ui";

/** Die Adresse der Vorführung — vor dem Anmeldetor, wie /reset. */
export const VORFUEHRUNG_PFAD = "/vorfuehrung";

/**
 * Der Schalter dieser Fläche, mit der Auskunft „schon entschieden?" — dieselbe Bauform wie
 * `useRechtsseitenTor` (`legal/LegalPages.tsx`). Vorgabe AUS; solange die Auskunft fehlt oder
 * scheitert, gilt fail-closed „aus".
 */
export function useVorfuehrungTor(): { an: boolean; geklaert: boolean } {
  const features = useFeatures();
  return {
    an: features.data?.features?.vorfuehrung ?? false,
    geklaert: features.isSuccess || features.isError,
  };
}

interface Eintrag {
  id: string;
  titel: string;
  aussage: string;
}

interface Bestand {
  fiktiv: true;
  kennzeichnung: string;
  eintraege: Eintrag[];
}

interface Antwort {
  fiktiv: true;
  kennzeichnung: string;
  treffer: Eintrag[];
}

function EintragKarte({ eintrag, testId }: { eintrag: Eintrag; testId: string }): JSX.Element {
  return (
    <li data-testid={testId} className="rounded-card border border-hairline p-3">
      <p className="text-[13.5px] font-semibold text-ink">{eintrag.titel}</p>
      <p className="mt-1 text-[13px] text-muted">{eintrag.aussage}</p>
    </li>
  );
}

export function VorfuehrungScreen(): JSX.Element {
  const { t, i18n } = useTranslation();
  const sprache = i18n.language;
  const [eingabe, setEingabe] = useState("");
  const [frage, setFrage] = useState("");

  // Die Sprache gehört in den Schlüssel: der Server formuliert nach `Accept-Language`, und ein
  // Wechsel des Umschalters muss die Inhalte in der neuen Sprache holen.
  const bestand = useQuery({
    queryKey: ["vorfuehrung", sprache],
    queryFn: () => api.get<Bestand>("/vorfuehrung"),
    retry: false,
  });
  const antwort = useQuery({
    queryKey: ["vorfuehrung-frage", sprache, frage],
    queryFn: () => api.get<Antwort>(`/vorfuehrung/frage?q=${encodeURIComponent(frage)}`),
    enabled: frage.length > 0,
    retry: false,
  });

  return (
    <div className="flex h-full">
      <BrandPanel />
      <div className="flex flex-1 items-start justify-center overflow-y-auto p-6">
        <div className="w-full max-w-[560px]">
          <BrandCompact />
          <div className="mb-4 flex justify-end">
            <PublicLangSwitch />
          </div>
          <h1 className="text-2xl font-semibold text-ink">{t("vorfuehrung.titel")}</h1>
          <p className="mt-1.5 text-sm text-muted">{t("vorfuehrung.einleitung")}</p>

          {bestand.data ? (
            <p
              data-testid="vorfuehrung-kennzeichnung"
              className="mt-4 rounded-card border border-trust-warn-fill/30 bg-trust-warn-bg p-3 text-[12.5px] font-semibold text-trust-warn-text"
            >
              {bestand.data.kennzeichnung}
            </p>
          ) : null}
          {bestand.isError ? (
            <p className="mt-4 text-[13px] text-trust-crit-text">{t("vorfuehrung.ladefehler")}</p>
          ) : null}

          <form
            className="mt-6 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setFrage(eingabe.trim());
            }}
          >
            <Field label={t("vorfuehrung.frageLabel")}>
              <TextInput
                id="vorfuehrung-frage"
                name="frage"
                value={eingabe}
                onChange={(e) => setEingabe(e.target.value)}
                maxLength={300}
              />
            </Field>
            <p className="text-[12px] text-muted-2">{t("vorfuehrung.ohneKi")}</p>
            <Button type="submit" variant="primary" disabled={eingabe.trim().length === 0}>
              {t("vorfuehrung.fragen")}
            </Button>
          </form>

          {antwort.data ? (
            <section className="mt-6">
              <h2 className="text-[14px] font-semibold text-ink">{t("vorfuehrung.treffer")}</h2>
              {antwort.data.treffer.length === 0 ? (
                <p data-testid="vorfuehrung-keine-treffer" className="mt-2 text-[13px] text-muted">
                  {t("vorfuehrung.keineTreffer")}
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {antwort.data.treffer.map((e) => (
                    <EintragKarte key={e.id} eintrag={e} testId="vorfuehrung-treffer" />
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {bestand.data ? (
            <section className="mt-8">
              <h2 className="text-[14px] font-semibold text-ink">{t("vorfuehrung.alle")}</h2>
              <ul className="mt-2 space-y-2">
                {bestand.data.eintraege.map((e) => (
                  <EintragKarte key={e.id} eintrag={e} testId="vorfuehrung-eintrag" />
                ))}
              </ul>
            </section>
          ) : null}

          <div className="mt-8 border-t border-hairline pt-4 text-center text-[13px]">
            <a href="/" className="font-semibold text-ink underline underline-offset-2">
              {t("vorfuehrung.zurAnmeldung")}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
