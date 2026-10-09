// ================================================================================================
// R-0554 / R-2128 — WISSEN BEIM AUSSCHEIDEN ÜBERGEBEN (Verwaltung → Konto).
// ================================================================================================
//
// ZWEI SCHRITTE, und der zweite ist erst nach dem ersten erreichbar: die VORSCHAU zeigt, was
// wandert (je Art die Menge, Wissensobjekte mit Titel), dann erst steht „Jetzt übergeben" da. Ein
// Wechsel des Nachfolgers verwirft die Vorschau — sonst bestätigte man eine Menge für jemand anderen.
//
// Das Ergebnis nennt Erfolge UND einzeln gescheiterte Schritte (der Server bricht nicht ab, sondern
// meldet sie). Was der Server ins Prüfprotokoll schreibt, entscheidet allein er (`lifecycle.handover`).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { UebergabeArt, UebergabeErgebnis, UebergabeVorschau } from "../api/types";
import { useToast } from "../app/ToastContext";
import { Button, Field } from "./ui";

const ARTEN: readonly UebergabeArt[] = [
  "wissensobjekt",
  "eigentum",
  "papierkorb",
  "entwurf",
  "luecke",
  "pruefaufgabe",
];

function mengeJeArt(v: UebergabeVorschau): Record<UebergabeArt, number> {
  return {
    wissensobjekt: v.wissensobjekte.length,
    eigentum: v.eigentum.length,
    papierkorb: v.papierkorb.length,
    entwurf: v.entwuerfe.length,
    luecke: v.luecken.length,
    pruefaufgabe: v.pruefaufgaben.length,
  };
}

/** Ist in dieser Vorschau überhaupt etwas zu übergeben? */
export function vorschauLeer(v: UebergabeVorschau): boolean {
  const menge = mengeJeArt(v);
  return ARTEN.every((art) => menge[art] === 0);
}

/**
 * DIE EINE DARSTELLUNG DER VORSCHAU — hier in der Übergabekarte und im Weg „Konto entfernen mit
 * Nachfolger" (`AdminKontenDetails.tsx`). Zwei Darstellungen derselben Menge wären zwei Aussagen.
 */
export function UebergabeVorschauInhalt({
  vorschau,
}: {
  vorschau: UebergabeVorschau;
}): JSX.Element {
  const { t } = useTranslation();
  const menge = mengeJeArt(vorschau);
  // Alle Beiträge mit Titel — lebend und (BEN, Nacharbeit 7) im Papierkorb.
  const titel = [...vorschau.wissensobjekte, ...vorschau.eigentum, ...vorschau.papierkorb];
  if (vorschauLeer(vorschau)) {
    return <p className="text-[12.5px] text-muted">{t("verantwortung.uebergabe.leer")}</p>;
  }
  return (
    <>
      <ul className="space-y-0.5 text-[12.5px] text-text">
        {ARTEN.map((art) => (
          <li key={art} data-wissensuebergabe-art={art}>
            {t(`verantwortung.uebergabe.art.${art}`)}: {menge[art]}
          </li>
        ))}
      </ul>
      {titel.length > 0 ? (
        <ul className="max-h-40 list-disc overflow-auto pl-5 text-[12px] text-muted">
          {titel
            .filter((k, i, alle) => alle.findIndex((x) => x.id === k.id) === i)
            .map((k) => (
              <li key={k.id}>{k.title}</li>
            ))}
        </ul>
      ) : null}
    </>
  );
}

export function Wissensuebergabe({
  von,
  kandidaten,
}: {
  /** Kennung der ausscheidenden Person. */
  von: string;
  /** Freigeschaltete Konten, die Nachfolger werden können (ohne die ausscheidende Person). */
  kandidaten: readonly { id: string; name: string }[];
}): JSX.Element {
  const { t } = useTranslation();
  const { push } = useToast();
  const qc = useQueryClient();
  const [an, setAn] = useState("");
  const [vorschau, setVorschau] = useState<UebergabeVorschau | null>(null);
  const [ergebnis, setErgebnis] = useState<UebergabeErgebnis | null>(null);
  const fail = (e: unknown): void =>
    push("error", e instanceof ApiError ? e.message : t("state.error"));

  const vorschauHolen = useMutation({
    mutationFn: () => endpoints.lifecycle.uebergabeVorschau(von, an),
    onSuccess: (v) => {
      setVorschau(v);
      setErgebnis(null);
    },
    onError: fail,
  });
  const ausfuehren = useMutation({
    mutationFn: () => endpoints.lifecycle.uebergeben(von, an),
    onSuccess: (e) => {
      setErgebnis(e);
      setVorschau(null);
      for (const schluessel of [["kos"], ["library"], ["validation"], ["drafts"], ["gaps"]]) {
        void qc.invalidateQueries({ queryKey: schluessel });
      }
      push("success", t("verantwortung.uebergabe.erledigt"));
    },
    onError: fail,
  });

  return (
    <div data-wissensuebergabe className="space-y-2 border-t border-hairline pt-4">
      <div className="text-[12.5px] font-medium text-muted">
        {t("verantwortung.uebergabe.titel")}
      </div>
      <p className="text-[12px] text-muted-2">{t("verantwortung.uebergabe.erklaerung")}</p>
      <Field label={t("verantwortung.uebergabe.an")}>
        <select
          data-wissensuebergabe-an
          value={an}
          onChange={(e) => {
            setAn(e.target.value);
            setVorschau(null);
            setErgebnis(null);
          }}
          className="h-9 rounded-input border border-hairline bg-surface px-2 text-[13px]"
        >
          <option value="">{t("verantwortung.uebergabe.waehlen")}</option>
          {kandidaten
            .filter((k) => k.id !== von)
            .map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
        </select>
      </Field>
      <Button
        variant="ghost"
        disabled={!an || vorschauHolen.isPending}
        onClick={() => vorschauHolen.mutate()}
      >
        {t("verantwortung.uebergabe.vorschau")}
      </Button>

      {vorschau ? (
        <div data-wissensuebergabe-vorschau className="space-y-2 rounded-input bg-page p-2">
          <UebergabeVorschauInhalt vorschau={vorschau} />
          {vorschauLeer(vorschau) ? null : (
            <Button
              variant="primary"
              disabled={ausfuehren.isPending}
              onClick={() => ausfuehren.mutate()}
            >
              {t("verantwortung.uebergabe.ausfuehren")}
            </Button>
          )}
        </div>
      ) : null}

      {ergebnis ? (
        <div data-wissensuebergabe-ergebnis className="space-y-1 text-[12.5px] text-text">
          <ul className="space-y-0.5">
            {ARTEN.map((art) => (
              <li key={art}>
                {t(`verantwortung.uebergabe.art.${art}`)}: {ergebnis.uebergeben[art]}
              </li>
            ))}
          </ul>
          {ergebnis.fehlgeschlagen.length > 0 ? (
            <p role="alert" className="text-[12px] text-trust-crit-text">
              {t("verantwortung.uebergabe.teilweise", { anzahl: ergebnis.fehlgeschlagen.length })}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
