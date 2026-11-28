// ================================================================================================
// R-0554 / R-2128 — WISSEN BEIM AUSSCHEIDEN ÜBERGEBEN (Verwaltung → Konto).
// ================================================================================================
//
// Die VORSCHAU zeigt, was wandert: je Art die Menge, Wissensobjekte mit Titel.
//
// ADMIN-05: In der Kontokarte laufen beide Übergabewege über EINEN Einstieg (`UebergabeAblauf.tsx`),
// der Beiträge und offene Vorgänge auf mehrere Nachfolger verteilt — samt Vorschau, die bei jedem
// Wechsel verfällt, und Teilfehlern. `UebergabeVorschauInhalt` bleibt die Vorschau beim
// Konto-Entfernen (`pages/AdminKontenDetails.tsx`).
//
// Gesamtcheck R-1329 (Aufrufer-Wächter, R-1349): hier stand zusätzlich die Fläche `Wissensuebergabe`
// mit eigenem Nachfolgerfeld — seit ADMIN-05 nirgends montiert. Sie ist entfernt; ihre Zusagen Ü1–Ü4
// sind am lebenden Einstieg gemessen (`tests/uebergabe-ablauf/einstieg-mounted.test.tsx`), die
// Darstellung der Vorschau in `tests/wissen-verantwortung/uebergabe-flaeche-mounted.test.tsx`.
import { useTranslation } from "react-i18next";
import type { UebergabeArt, UebergabeVorschau } from "../api/types";

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
function vorschauLeer(v: UebergabeVorschau): boolean {
  const menge = mengeJeArt(v);
  return ARTEN.every((art) => menge[art] === 0);
}

/**
 * DIE EINE DARSTELLUNG DER VORSCHAU — im Weg „Konto entfernen mit Nachfolger"
 * (`AdminKontenDetails.tsx`). Zwei Darstellungen derselben Menge wären zwei Aussagen.
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
