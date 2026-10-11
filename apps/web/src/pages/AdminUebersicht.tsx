// ================================================================================================
// ADMIN-01 · DIE STARTSEITE DER VERWALTUNG — „was steht an" und „wo finde ich was".
// ================================================================================================
//
// produkt:20261009:admin-verwaltung-uebersicht. `/admin` ohne Thema öffnete bis hierher die
// Nutzerliste; wer etwas anderes suchte, musste die interne Gliederung kennen. Jetzt steht dort
// diese Fläche — zwei Teile, beide ohne eigenen Bedienort:
//
//   1  AUFGABEN. Je Zähler genau EINE vorhandene Quelle, und zwar mit DEMSELBEN Abfrageschlüssel,
//      den die Liste dahinter benutzt (`useValidationBoard()` ↔ `/validierung`, `["gaps"]` ↔
//      `/risiko`, `useUsers()` ↔ Kontenliste, `["reasonerConfig"]` ↔ Karte „KI-Zugänge"). Zähler und
//      Liste lesen damit denselben Zwischenspeicher: für denselben Datenstand und dieselben Rechte
//      können sie nicht auseinanderlaufen. Der Wert entsteht aus dem Zustandsmodell der
//      Einstellungen (`zeilenWert.ts`) — vor der ersten Antwort „wird ermittelt", bei Fehler
//      „nicht abrufbar", ohne Netz „unbekannt"; eine Null steht nur nach einer erfolgreichen
//      Antwort da. Jede Quelle scheitert für sich; die übrigen Zeilen und alle Wege bleiben.
//
//   2  BEREICHE. Die sieben fachlichen Gruppen aus `lib/adminUebersicht.ts`, je mit einem Satz zum
//      Zweck und den Wegen in die vorhandenen Themen, Karten und Seiten. Ein Bereich der App läuft
//      durch dieselbe Regel wie die Kurzlinks der Themen: fehlt die Rolle, steht er nicht da; ist
//      nur das Modul aus, steht er als „Modul aus" ohne Weg da.
//
// Persönliche Einstellungen gehören nicht in die Verwaltung; der Weg zum Profil steht deshalb
// getrennt unter einer eigenen Überschrift.
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { endpoints } from "../api/endpoints";
import { useUsers, useValidationBoard } from "../api/hooks";
import { GuardedLink, useGuardedNavigate } from "../app/NavGuardContext";
import { useRole } from "../app/RoleContext";
import { ALL_ITEMS, anzeigeNameKey, canSee, roleAllows } from "../app/navigation";
import {
  Flaechenknopf,
  Zeile,
  Zeilenkarte,
  useWertText,
} from "../components/einstellungen/Zeilenkarte";
import {
  type WertBefund,
  abfragelage,
  useIstOnline,
  wertBefund,
} from "../components/einstellungen/zeilenWert";
import {
  AUFGABEN,
  type AufgabeId,
  type UebersichtZiel,
  VERWALTUNG_GRUPPEN,
  aufgabeHref,
  kiZugangsLage,
  offeneLuecken,
  verwaltungsZielHref,
  verwaltungsZielLabelKey,
  wartendeKonten,
  zielKennung,
} from "../lib/adminUebersicht";
import { aiAccessRows } from "../lib/aiOverview";

interface Abfrage {
  data: unknown;
  isError: boolean;
  isFetching: boolean;
  fetchStatus: string;
  dataUpdatedAt: number;
  refetch: () => Promise<unknown>;
}

export function AdminUebersicht(): JSX.Element {
  const { t, i18n } = useTranslation();
  const online = useIstOnline();
  const wertText = useWertText();
  const navigate = useGuardedNavigate();
  const { role, stufe2 } = useRole();

  // Die vier Quellen. Gaps und KI-Konfiguration mit verzögertem Zugriff auf `endpoints`, damit eine
  // fehlende Quelle als Abfragefehler endet und nicht die ganze Fläche mitnimmt.
  const board = useValidationBoard();
  const gaps = useQuery({ queryKey: ["gaps"], queryFn: () => endpoints.gaps.list() });
  const users = useUsers();
  const aiConfig = useQuery({
    queryKey: ["reasonerConfig"],
    queryFn: () => endpoints.reasoner.config(),
  });

  const zugaenge = aiConfig.data ? aiAccessRows(aiConfig.data) : null;
  const quellen: Record<AufgabeId, { q: Abfrage; befund: WertBefund }> = {
    pruefungen: {
      q: board,
      befund: wertBefund(
        abfragelage(board, online),
        board.data ? String(board.data.length) : null,
        board.data !== undefined && board.data.length === 0,
      ),
    },
    luecken: {
      q: gaps,
      befund: wertBefund(
        abfragelage(gaps, online),
        gaps.data ? String(offeneLuecken(gaps.data).length) : null,
        gaps.data !== undefined && offeneLuecken(gaps.data).length === 0,
      ),
    },
    freigaben: {
      q: users,
      befund: wertBefund(
        abfragelage(users, online),
        users.data ? String(wartendeKonten(users.data).length) : null,
        users.data !== undefined && wartendeKonten(users.data).length === 0,
      ),
    },
    kiZugaenge: {
      q: aiConfig,
      befund: wertBefund(
        abfragelage(aiConfig, online),
        // Nacharbeit 3: nur echte Zugänge zählen; der Ersatzmodus steht getrennt daneben
        // (`kiZugangsLage`), statt als „aktiver Zugang" mitzulaufen.
        zugaenge
          ? [
              t("verwaltung.aufgabe.kiZugaengeWert", {
                aktiv: kiZugangsLage(zugaenge).aktiv,
                gesamt: kiZugangsLage(zugaenge).gesamt,
              }),
              ...(kiZugangsLage(zugaenge).ersatzAktiv ? [t("verwaltung.aufgabe.kiErsatz")] : []),
            ].join(" · ")
          : null,
      ),
    },
  };

  /** Der sichtbare Wert eines Zählers — nie eine Null ohne erfolgreiche Antwort. */
  const zaehlerText = (befund: WertBefund, standMs: number): string => {
    if (befund.art === "laedt") {
      return t("verwaltung.wert.laedt");
    }
    if (befund.art === "offline") {
      return t("verwaltung.wert.offline");
    }
    const kern = wertText(befund, "0");
    // `wertText` nennt den Stand selbst, sobald er älter oder gestört ist; sonst sagt die Zeile,
    // wann die Zahl erhoben wurde.
    if (befund.art === "fehler" || befund.standMs > 0 || standMs <= 0) {
      return kern;
    }
    const zeit = new Date(standMs).toLocaleTimeString(i18n.language, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    return `${kern} · ${t("verwaltung.aufgaben.erhoben", { zeit })}`;
  };

  const aktualisiertGerade = AUFGABEN.some((id) => quellen[id].q.isFetching);
  const aktualisieren = (): void => {
    for (const id of AUFGABEN) {
      void quellen[id].q.refetch();
    }
  };

  /** Eine Zeile, die WOANDERS hinführt (Link durch den Ungespeichert-Wächter). */
  const verweis = (label: string, to: string, testId: string, wert?: string, art?: string) => (
    <GuardedLink
      key={testId}
      to={to}
      data-einst="zeile"
      data-testid={testId}
      data-art={art}
      className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-hairline px-4 py-[13px] text-left no-underline last:border-b-0 hover:bg-hairline-soft"
    >
      <span data-einst="label" className="min-w-0 break-words text-[14px] text-text">
        {label}
      </span>
      <span className="ml-auto flex min-w-0 items-center gap-1.5 break-words text-[14px] text-muted-2">
        {wert === undefined ? null : (
          <span data-einst="wert" className="min-w-0 break-words">
            {wert}
          </span>
        )}
        {to.startsWith("/admin") ? (
          <ChevronRight className="shrink-0" size={13} strokeWidth={2} aria-hidden="true" />
        ) : (
          <ArrowUpRight
            data-einst="kurzlink"
            className="shrink-0"
            size={13}
            strokeWidth={2}
            aria-hidden="true"
          />
        )}
      </span>
    </GuardedLink>
  );

  const zielZeile = (ziel: UebersichtZiel) => {
    const testId = `ziel-${zielKennung(ziel)}`;
    if (ziel.art === "verwaltung") {
      return (
        <Zeile
          key={testId}
          label={t(verwaltungsZielLabelKey(ziel))}
          onOeffnen={() => navigate(verwaltungsZielHref(ziel))}
          testId={testId}
        />
      );
    }
    if (ziel.art === "pfad") {
      return verweis(t(ziel.labelKey), ziel.pfad, testId);
    }
    // Ein Bereich der App: dieselbe Regel wie `BereichsZeile` in `Admin.tsx` — Rolle fehlt heisst
    // „nicht da", Modul aus heisst „da, aber ohne Weg".
    const item = ALL_ITEMS.find((i) => i.id === ziel.navId);
    if (!item || !roleAllows(item, role)) {
      return null;
    }
    if (!canSee(item, role, stufe2)) {
      return (
        <Zeile
          key={testId}
          label={t(anzeigeNameKey(item))}
          wert={t("einst.modul.aus")}
          testId={testId}
        />
      );
    }
    return verweis(t(anzeigeNameKey(item)), item.path, testId);
  };

  const profil = ALL_ITEMS.find((i) => i.id === "profil");

  return (
    <div data-testid="verwaltung-uebersicht" className="flex flex-col gap-5">
      <section aria-labelledby="verwaltung-aufgaben-titel" className="flex flex-col gap-2">
        <h2
          id="verwaltung-aufgaben-titel"
          data-einst="label"
          className="text-[15px] font-semibold text-text"
        >
          {t("verwaltung.aufgaben.titel")}
        </h2>
        <Zeilenkarte testId="verwaltung-aufgaben">
          {AUFGABEN.map((id) =>
            verweis(
              t(`verwaltung.aufgabe.${id}`),
              aufgabeHref(id),
              `aufgabe-${id}`,
              zaehlerText(quellen[id].befund, quellen[id].q.dataUpdatedAt),
              quellen[id].befund.art,
            ),
          )}
        </Zeilenkarte>
        <Flaechenknopf testId="knopf-aufgaben-aktualisieren" onClick={aktualisieren}>
          {aktualisiertGerade
            ? t("verwaltung.aufgaben.laeuft")
            : t("verwaltung.aufgaben.aktualisieren")}
        </Flaechenknopf>
      </section>

      <section aria-labelledby="verwaltung-bereiche-titel" className="flex flex-col gap-4">
        <h2
          id="verwaltung-bereiche-titel"
          data-einst="label"
          className="text-[15px] font-semibold text-text"
        >
          {t("verwaltung.bereiche.titel")}
        </h2>
        {VERWALTUNG_GRUPPEN.map((gruppe) => (
          <section
            key={gruppe.id}
            aria-labelledby={`gruppe-${gruppe.id}-titel`}
            data-testid={`gruppe-${gruppe.id}`}
            className="flex flex-col gap-1.5"
          >
            <h3
              id={`gruppe-${gruppe.id}-titel`}
              data-einst="label"
              className="text-[14px] font-semibold text-text"
            >
              {t(gruppe.labelKey)}
            </h3>
            <p data-einst="zweck" className="text-[12.5px] text-muted-2">
              {t(gruppe.zweckKey)}
            </p>
            <Zeilenkarte>
              {gruppe.ziele.length === 0 ? (
                <Zeile
                  label={t("verwaltung.nichtVerfuegbar")}
                  testId={`gruppe-${gruppe.id}-leer`}
                />
              ) : (
                gruppe.ziele.map(zielZeile)
              )}
            </Zeilenkarte>
          </section>
        ))}
      </section>

      {profil ? (
        <section aria-labelledby="verwaltung-persoenlich-titel" className="flex flex-col gap-2">
          <h2
            id="verwaltung-persoenlich-titel"
            data-einst="label"
            className="text-[15px] font-semibold text-text"
          >
            {t("verwaltung.persoenlich.titel")}
          </h2>
          <Zeilenkarte>
            {verweis(t(anzeigeNameKey(profil)), profil.path, "ziel-profil")}
          </Zeilenkarte>
        </section>
      ) : null}
    </div>
  );
}
