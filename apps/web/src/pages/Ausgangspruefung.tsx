// Ausgangsprüfung (R-1646) — vor jedem ausgehenden KI-Aufruf zeigt KLARWERK exakt den Text, der
// das Werk verlassen würde; ersetzte Stellen sind hervorgehoben. Der Controller gibt frei oder
// lehnt ab.
//
// Erreichbar unter `/ausgangspruefung`. Die Route trägt kein Rollentor; die Rechte entscheidet der
// Server (`ko.validate`, `services/app/src/routes/ausgangspruefung-routes.ts`) — dieselbe Bauform
// wie `/begriffe`. Die Liste fragt alle paar Sekunden nach: ein wartender Aufruf läuft ab, wenn
// niemand entscheidet.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  type AnonymisierungsArt,
  type AusgangsAbschnitt,
  type OffeneAusgangspruefung,
  ausgangspruefungApi,
} from "../api/ausgangspruefung";
import { ApiError } from "../api/client";
import { Button, Card, PageHeader, SectionLabel } from "../components/ui";

const ABFRAGE_TAKT_MS = 3000;
const ARTEN: readonly AnonymisierungsArt[] = ["person", "email", "telefon", "iban"];

function fehlerSchluessel(fehler: unknown): string {
  if (fehler instanceof ApiError && fehler.status === 401) {
    return "ausgangspruefung.fehler.anmeldung";
  }
  if (fehler instanceof ApiError && fehler.status === 403) {
    return "ausgangspruefung.fehler.recht";
  }
  if (fehler instanceof ApiError && fehler.status === 404) {
    return "ausgangspruefung.fehler.nichtMehrOffen";
  }
  return "ausgangspruefung.fehler.allgemein";
}

/** Der ausgehende Text, Stück für Stück — Ersetzungen als `<mark>` mit ihrer Art. */
function Ausgangstext({
  abschnitte,
  testid,
}: {
  abschnitte: AusgangsAbschnitt[];
  testid: string;
}): JSX.Element {
  const { t } = useTranslation();
  // Schlüssel ist die Zeichenposition im ausgehenden Text — eindeutig und aus den Daten selbst.
  let pos = 0;
  const teile = abschnitte.map((a) => {
    const start = pos;
    pos += a.text.length;
    return { ...a, start };
  });
  return (
    <pre
      data-testid={testid}
      className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-btn border border-hairline bg-surface-2 p-3 font-mono text-[12.5px] leading-relaxed text-text"
    >
      {teile.map((a) =>
        a.ersetzt ? (
          <mark
            key={a.start}
            data-testid="ausgang-ersetzung"
            data-art={a.ersetzt}
            title={t(`ausgangspruefung.art.${a.ersetzt}`)}
            className="rounded-sm bg-trust-warn-bg px-0.5 font-semibold text-text"
          >
            {a.text}
          </mark>
        ) : (
          <span key={a.start}>{a.text}</span>
        ),
      )}
    </pre>
  );
}

function Pruefkarte({ eintrag }: { eintrag: OffeneAusgangspruefung }): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const entscheiden = useMutation({
    // Ein gemeinsamer Rückgabetyp für beide Wege — die Antwort selbst wird nicht gelesen, die Liste
    // wird danach neu geladen.
    mutationFn: async (freigeben: boolean): Promise<void> => {
      if (freigeben) {
        await ausgangspruefungApi.freigeben(eintrag.id);
      } else {
        await ausgangspruefungApi.ablehnen(eintrag.id);
      }
    },
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: ["ausgangspruefung"] });
    },
  });
  const ersetzt = ARTEN.filter((art) => eintrag.ersetzungen[art] > 0);
  return (
    <Card interactive={false} data-testid="ausgang-eintrag" data-ausgang={eintrag.id}>
      <p className="text-[13px] text-text">
        {t("ausgangspruefung.eintrag.empfaenger", { anbieter: eintrag.anbieter })}
      </p>
      <p className="mb-2 text-[12px] text-muted">
        {t("ausgangspruefung.eintrag.zeit", {
          erstellt: new Date(eintrag.erstelltAm).toLocaleTimeString(),
          ablauf: new Date(eintrag.laeuftAbAm).toLocaleTimeString(),
        })}
      </p>
      <p className="mb-3 text-[12.5px] text-text" data-testid="ausgang-ersetzungen">
        {ersetzt.length === 0
          ? t("ausgangspruefung.eintrag.keineErsetzung")
          : t("ausgangspruefung.eintrag.ersetzungen", {
              liste: ersetzt
                .map((art) => `${t(`ausgangspruefung.art.${art}`)}: ${eintrag.ersetzungen[art]}`)
                .join(" · "),
            })}
      </p>
      {eintrag.bildUnveraendert ? (
        <p
          role="note"
          data-testid="ausgang-bild"
          className="mb-3 rounded-btn bg-trust-warn-bg p-2 text-[12.5px] text-text"
        >
          {t("ausgangspruefung.eintrag.bild")}
        </p>
      ) : null}
      <SectionLabel>{t("ausgangspruefung.eintrag.nutzer")}</SectionLabel>
      <Ausgangstext abschnitte={eintrag.nutzer} testid="ausgang-nutzertext" />
      <details className="mt-2">
        <summary className="cursor-pointer text-[12.5px] text-muted">
          {t("ausgangspruefung.eintrag.system")}
        </summary>
        <Ausgangstext abschnitte={eintrag.system} testid="ausgang-systemtext" />
      </details>
      <div className="mt-3 flex gap-2">
        <Button
          variant="primary"
          data-testid="ausgang-freigeben"
          disabled={entscheiden.isPending}
          onClick={() => entscheiden.mutate(true)}
        >
          {t("ausgangspruefung.eintrag.freigeben")}
        </Button>
        <Button
          data-testid="ausgang-ablehnen"
          disabled={entscheiden.isPending}
          onClick={() => entscheiden.mutate(false)}
        >
          {t("ausgangspruefung.eintrag.ablehnen")}
        </Button>
      </div>
      {entscheiden.isError ? (
        <p role="alert" className="mt-2 text-[12.5px] text-muted">
          {t(fehlerSchluessel(entscheiden.error))}
        </p>
      ) : null}
    </Card>
  );
}

export function Ausgangspruefung(): JSX.Element {
  const { t } = useTranslation();
  const lage = useQuery({
    queryKey: ["ausgangspruefung"],
    queryFn: ausgangspruefungApi.lage,
    refetchInterval: ABFRAGE_TAKT_MS,
  });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        pageKey="ausgangspruefung"
        title={t("ausgangspruefung.seite.titel")}
        lead={t("ausgangspruefung.seite.lead")}
      />
      <p className="mb-4 text-[12px] text-muted-2">{t("ausgangspruefung.seite.grenze")}</p>
      {lage.isPending ? (
        <p className="text-sm text-muted" data-testid="ausgang-laedt">
          {t("ausgangspruefung.seite.laedt")}
        </p>
      ) : null}
      {lage.isError ? (
        <p role="alert" className="text-sm text-muted">
          {t(fehlerSchluessel(lage.error))}
        </p>
      ) : null}
      {lage.isSuccess && !lage.data.aktiv ? (
        <p data-testid="ausgang-aus" className="text-sm text-muted">
          {t("ausgangspruefung.seite.aus")}
        </p>
      ) : null}
      {lage.isSuccess && lage.data.aktiv && lage.data.offen.length === 0 ? (
        <p data-testid="ausgang-leer" className="text-sm text-muted">
          {t("ausgangspruefung.seite.leer")}
        </p>
      ) : null}
      <ul className="space-y-3">
        {(lage.data?.offen ?? []).map((eintrag) => (
          <li key={eintrag.id}>
            <Pruefkarte eintrag={eintrag} />
          </li>
        ))}
      </ul>
    </div>
  );
}
