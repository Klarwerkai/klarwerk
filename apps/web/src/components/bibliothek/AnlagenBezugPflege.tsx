import { useMutation } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { endpoints } from "../../api/endpoints";
import type { AnlagenKontext, KnowledgeObject } from "../../api/types";
import { useToast } from "../../app/ToastContext";
import { kennungenAusEingabe } from "../../lib/anlagenzugang";
import { Button } from "../ui";

// ================================================================================================
// R-1631 (aufnahme:20260922:gesamt-anlagenzugang) — BAUTEILE, MATERIALIEN UND GELTUNGSKONTEXT PFLEGEN.
// ================================================================================================
//
// Neben der Anlage (Feld „Anlage / Gerät") koppelt diese Zeile das Wissen an Bauteil-Nummern und
// Material-Codes und sagt, für welche Anlagenversionen, Standorte und Schichten es gilt. Mehrere
// Kennungen werden mit Komma oder Zeilenumbruch getrennt; ein leeres Feld heisst „keine Angabe" —
// bei Version, Standort und Schicht also „gilt allgemein". Gespeichert wird über die Aktion
// `anlagenkontext` (Recht `ko.create`, wie Fachgebiet und Kategorie); sie ersetzt den bisherigen
// Stand vollständig und hinterlässt einen Protokolleintrag.
const FELDER = ["bauteile", "materialien", "versionen", "standorte", "schichten"] as const;
type Feld = (typeof FELDER)[number];
type Eingaben = Record<Feld, string>;

function eingabenAus(kontext: AnlagenKontext | undefined): Eingaben {
  return {
    bauteile: (kontext?.bauteile ?? []).join(", "),
    materialien: (kontext?.materialien ?? []).join(", "),
    versionen: (kontext?.versionen ?? []).join(", "),
    standorte: (kontext?.standorte ?? []).join(", "),
    schichten: (kontext?.schichten ?? []).join(", "),
  };
}

export function AnlagenBezugPflege({
  ko,
  onGespeichert,
}: {
  ko: Pick<KnowledgeObject, "id" | "anlagenkontext">;
  onGespeichert: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const { push } = useToast();
  const basisId = useId();
  const gespeichert = JSON.stringify(eingabenAus(ko.anlagenkontext));
  const [eingaben, setEingaben] = useState<Eingaben>(() => eingabenAus(ko.anlagenkontext));
  // Ein neuer gespeicherter Stand (nach dem Speichern oder von aussen) ersetzt die Eingaben.
  useEffect(() => {
    setEingaben(JSON.parse(gespeichert) as Eingaben);
  }, [gespeichert]);

  const speichern = useMutation({
    mutationFn: () => {
      const anlagenkontext: AnlagenKontext = {};
      for (const feld of FELDER) {
        anlagenkontext[feld] = kennungenAusEingabe(eingaben[feld]);
      }
      return endpoints.ko.act(ko.id, { action: "anlagenkontext", anlagenkontext });
    },
    onSuccess: () => {
      onGespeichert();
      push("success", t("anlagenzugang.pflege.gespeichert"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });
  const geaendert = JSON.stringify(eingaben) !== gespeichert;

  return (
    <div
      data-testid="anlagenkontext-pflege"
      className="mt-2.5 flex flex-col gap-2 border-t border-hairline pt-2.5"
    >
      <span className="text-[12.5px] font-semibold text-text">
        {t("anlagenzugang.pflege.titel")}
      </span>
      <p className="text-[12px] text-muted">{t("anlagenzugang.pflege.hinweis")}</p>
      {FELDER.map((feld) => (
        <label key={feld} htmlFor={`${basisId}-${feld}`} className="flex flex-col gap-0.5">
          <span className="text-[12px] text-muted">{t(`anlagenzugang.pflege.${feld}`)}</span>
          <input
            id={`${basisId}-${feld}`}
            data-testid={`anlagenkontext-${feld}`}
            value={eingaben[feld]}
            onChange={(e) => setEingaben((alt) => ({ ...alt, [feld]: e.target.value }))}
            className="h-9 rounded-input border border-hairline bg-surface px-3 text-[12.5px] text-text"
          />
        </label>
      ))}
      <span>
        <Button
          variant="ghost"
          data-testid="anlagenkontext-speichern"
          disabled={!geaendert || speichern.isPending}
          onClick={() => speichern.mutate()}
        >
          {t("anlagenzugang.pflege.speichern")}
        </Button>
      </span>
    </div>
  );
}
