// ================================================================================================
// R-0082 / R-0477 (aufnahme:20260922:gesamt-wissen-metadaten) — ANLAGEN AM OBJEKT UND ALS MATRIX.
// ================================================================================================
//
// Zwei Bauteile, eine Quelle (`anlagenVon`, lib/anlagen.ts — die kanonische Liste am Objekt):
//   · `AnlagenFeld`  — die Anlagen EINES Wissensobjekts sehen und ändern (Leseansicht,
//                      Abschnitt „Kopplung und Anlagen"). Geändert wird über den vorhandenen
//                      Korrekturweg `revise` (`changes.assets`), also mit denselben Rechten und
//                      derselben Freigaberegel wie jede andere Inhaltsänderung.
//   · `AnlagenMatrix` — die Zuordnung Anlage × Wissensobjekt als Tabelle (Bibliothek, Menü „…").
//                      Gespeist wird sie ausschliesslich aus den Objekten, die der Aufrufer
//                      übergibt — in der Bibliothek die aktuelle Trefferliste, die der Server
//                      diesem Menschen bereits sichtbarkeitsgeprüft herausgegeben hat. Die Matrix
//                      fragt nichts nach und kann deshalb nichts zeigen, was die Liste nicht zeigt.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { KnowledgeObject } from "../api/types";
import { anlagenAlsEingabe, anlagenAusEingabe, anlagenMatrix, anlagenVon } from "../lib/anlagen";
import { Button, TextInput } from "./ui";

export function AnlagenFeld({
  ko,
  darfAendern,
  wartet,
  onSpeichern,
}: {
  ko: Pick<KnowledgeObject, "asset" | "assets">;
  darfAendern: boolean;
  wartet: boolean;
  onSpeichern: (anlagen: string[]) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const gespeichert = anlagenVon(ko);
  const [eingabe, setEingabe] = useState(anlagenAlsEingabe(gespeichert));
  const entwurf = anlagenAusEingabe(eingabe);
  const unveraendert = JSON.stringify(entwurf) === JSON.stringify(gespeichert);
  return (
    <div data-testid="ko-anlagen" className="mb-2.5 text-[12.5px]">
      <p className="font-semibold text-text">{t("wissensmetadaten.anlage.liste")}</p>
      {gespeichert.length > 0 ? (
        <ul data-testid="ko-anlagen-liste" className="mt-1 flex flex-wrap gap-1.5">
          {gespeichert.map((anlage) => (
            <li
              key={anlage}
              className="rounded-pill bg-page px-2.5 py-1 text-[12px] font-medium text-text"
            >
              {anlage}
            </li>
          ))}
        </ul>
      ) : (
        <p data-testid="ko-anlagen-leer" className="mt-0.5 text-muted">
          {t("wissensmetadaten.anlage.keine")}
        </p>
      )}
      {darfAendern ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <TextInput
            data-testid="ko-anlagen-eingabe"
            aria-label={t("wissensmetadaten.anlage.liste")}
            placeholder={t("wissensmetadaten.anlage.mehrere")}
            value={eingabe}
            disabled={wartet}
            onChange={(e) => setEingabe(e.target.value)}
            className="h-9 min-w-[10rem] flex-1"
          />
          <Button
            data-testid="ko-anlagen-speichern"
            variant="primary"
            disabled={wartet || unveraendert}
            onClick={() => onSpeichern(entwurf)}
          >
            {t("wissensmetadaten.anlage.speichern")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function AnlagenMatrix({
  kos,
  onOeffnen,
}: {
  kos: readonly KnowledgeObject[];
  onOeffnen: (id: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const matrix = anlagenMatrix(kos, (ko) => ko);
  if (matrix.zeilen.length === 0) {
    return (
      <p data-testid="anlagen-matrix-leer" className="text-[13px] text-muted">
        {t("wissensmetadaten.matrix.leer")}
      </p>
    );
  }
  return (
    <div data-testid="anlagen-matrix" className="space-y-2">
      <p className="text-[12.5px] text-muted">{t("wissensmetadaten.matrix.hinweis")}</p>
      <div className="max-h-[60vh] overflow-auto">
        <table className="min-w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 bg-surface p-1.5 text-left font-semibold">
                {t("wissensmetadaten.matrix.objekt")}
              </th>
              {matrix.anlagen.map((anlage) => (
                <th
                  key={anlage}
                  scope="col"
                  data-testid="anlagen-matrix-spalte"
                  className="p-1.5 text-left font-semibold"
                >
                  {anlage}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.zeilen.map(({ eintrag, anlagen }) => (
              <tr key={eintrag.id} data-testid="anlagen-matrix-zeile" data-ko-id={eintrag.id}>
                <th scope="row" className="sticky left-0 bg-surface p-1.5 text-left font-normal">
                  <button
                    type="button"
                    onClick={() => onOeffnen(eintrag.id)}
                    className="text-left text-text underline-offset-2 hover:underline"
                  >
                    {eintrag.title}
                  </button>
                </th>
                {matrix.anlagen.map((anlage) => (
                  <td key={anlage} className="p-1.5 text-center">
                    {anlagen.has(anlage) ? (
                      <span data-testid="anlagen-matrix-treffer">
                        <span aria-hidden="true">●</span>
                        <span className="sr-only">
                          {t("wissensmetadaten.matrix.zelle", { titel: eintrag.title, anlage })}
                        </span>
                      </span>
                    ) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="sticky left-0 bg-surface p-1.5 text-left font-semibold">
                {t("wissensmetadaten.matrix.anzahl")}
              </th>
              {matrix.anlagen.map((anlage) => (
                <td key={anlage} data-testid="anlagen-matrix-anzahl" className="p-1.5 text-center">
                  {matrix.anzahlJeAnlage.get(anlage) ?? 0}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
