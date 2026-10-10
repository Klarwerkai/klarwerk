import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useDirectory, useKos } from "../api/hooks";
import type { GapRuecknahmeGrund, GapVorgang, GapVorgangEintrag } from "../api/types";
import { useRole } from "../app/RoleContext";
import { useToast } from "../app/ToastContext";
import { captureGapHref } from "../lib/captureFromGap";
import { useAuthorName } from "../lib/useAuthorName";
import { auftrittAus, useAssistenzProfil } from "./klara-vorschau/profil";
import { useKlaraZustand } from "./klara-vorschau/zustand";

// ================================================================================================
// produkt:20261010:wissenskreislauf-schliessen — DER VORGANG EINER WISSENSLÜCKE, FÜR ALLE BETEILIGTEN.
// ================================================================================================
//
// Eine Fläche, drei Blickwinkel: die Fragenden sehen Zuständigkeit, Rückfrage, Bearbeitung und
// Ergebnis ihrer Frage; die zuständige Person stellt Rückfragen, verknüpft ihren eingereichten
// Antwortentwurf und schließt fachlich ab; Verwaltende ordnen zu und nehmen — getrennt — zurück.
// Was erscheint, entscheidet der SERVER (`GET /api/gaps/:id/vorgang`): Rollen, Phase, nächster
// Schritt, Ergebnis und Prüfstand kommen frisch gegen die heutigen Rechte. Diese Fläche rechnet
// nichts davon nach. Jeder Schritt antwortet mit der neuen Vorgangssicht und ersetzt die alte.
//
// Kein zweiter Prüfweg: „Antwort erfassen" führt in die vorhandene Erfassung, die Fachprüfung bleibt
// das vorhandene Prüfboard. Die Klara-Zeile erklärt nur den Stand, den der Server geliefert hat — sie
// ist keine Fachprüfung und behauptet keine.

const RUECKNAHME_GRUENDE: readonly GapRuecknahmeGrund[] = [
  "dublette",
  "nicht_beantwortbar",
  "ausser_zustaendigkeit",
  "zurueckgezogen",
];

function istEintrag(e: GapVorgang["ergebnis"]): e is GapVorgangEintrag {
  return e !== null && "koId" in e;
}

export function LueckenVorgang({
  gapId,
  anfangsOffen,
}: {
  gapId: string;
  /** Aus einer Meldung, `?fall=` oder der eigenen Vorgangsseite: gleich aufgeklappt. */
  anfangsOffen: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const [offen, setOffen] = useState(anfangsOffen);
  // Erst beim Aufklappen angefragt. Kein Retry: ein 404 heisst „nicht beteiligt", keine Störung.
  const vorgang = useQuery({
    queryKey: ["gaps", gapId, "vorgang"],
    queryFn: () => endpoints.gaps.vorgang(gapId),
    enabled: offen,
    retry: false,
  });
  return (
    <div className="mt-1" data-testid="luecke-vorgang">
      <button
        type="button"
        data-testid="luecke-vorgang-schalter"
        aria-expanded={offen}
        onClick={() => setOffen((v) => !v)}
        className="text-[11.5px] font-semibold text-brand-text hover:underline"
      >
        {offen ? t("lueckenvorgang.einklappen") : t("lueckenvorgang.oeffnen")}
      </button>
      {offen ? (
        <div className="mt-1.5 space-y-2 rounded-btn border border-hairline bg-page px-3 py-2">
          <div className="text-[12px] font-semibold text-text">{t("lueckenvorgang.titel")}</div>
          {vorgang.isPending ? (
            <p className="text-[11.5px] text-muted">{t("lueckenvorgang.laden")}</p>
          ) : vorgang.isError || !vorgang.data ? (
            // 404 heisst „nicht beteiligt" (der Server verrät nicht mehr); alles andere ist eine Störung.
            <p className="text-[11.5px] text-muted" data-testid="luecke-vorgang-fremd">
              {vorgang.error instanceof ApiError && vorgang.error.status !== 404
                ? t("lueckenvorgang.fehler")
                : t("lueckenvorgang.nichtBeteiligt")}
            </p>
          ) : (
            <VorgangInhalt vorgang={vorgang.data} />
          )}
        </div>
      ) : null}
    </div>
  );
}

function VorgangInhalt({ vorgang }: { vorgang: GapVorgang }): JSX.Element {
  const { t, i18n } = useTranslation();
  const nameOf = useAuthorName();
  const { role } = useRole();
  // Das Verzeichnis (Übergabe) und die sichtbaren Einträge (Verknüpfung) über DIESELBEN Abfragen
  // wie der Rest der Oberfläche — die Einträge nur, wenn die Rolle sie hier überhaupt braucht.
  const verzeichnis = useDirectory();
  const brauchtEintraege =
    vorgang.status === "offen" &&
    (vorgang.rollen.includes("zustaendig") || vorgang.rollen.includes("verwaltend"));
  const bestand = useKos(undefined, brauchtEintraege);
  const personen = verzeichnis.data ?? [];
  const eintraege = (bestand.data ?? []).map((k) => ({ id: k.id, title: k.title }));
  const klara = useKlaraZustand();
  // produkt:20261010:wissenskreislauf-schliessen (Ben, Nacharbeit 3): die persönliche Assistenzwahl.
  const assistenzName = auftrittAus(useAssistenzProfil()).name ?? t("klaraprodukt.name.neutral");
  const qc = useQueryClient();
  const { push } = useToast();
  const [rueckfrage, setRueckfrage] = useState("");
  const [antwort, setAntwort] = useState("");
  const datum = (iso: string) => new Date(iso).toLocaleDateString(i18n.language);

  // Jeder Schritt bekommt die neue Vorgangssicht zurück; Liste und Glocke werden nachgeladen.
  const schritt = useMutation({
    mutationFn: (aufruf: () => Promise<unknown>) => aufruf(),
    onSuccess: (daten) => {
      if (daten && typeof daten === "object" && "phase" in daten) {
        qc.setQueryData(["gaps", vorgang.id, "vorgang"], daten);
      } else {
        void qc.invalidateQueries({ queryKey: ["gaps", vorgang.id, "vorgang"] });
      }
      void qc.invalidateQueries({ queryKey: ["gaps"] });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    // Ein abgewiesener Abschluss nennt die Gründe des Servers (`gruende`) — übersetzt, nicht erraten.
    onError: (fehler) => {
      const gruende =
        fehler instanceof ApiError && Array.isArray(fehler.details.gruende)
          ? fehler.details.gruende.filter((g): g is string => typeof g === "string")
          : [];
      push(
        "error",
        gruende.length > 0
          ? `${t("lueckenvorgang.aktionFehler")} ${t("lueckenvorgang.nichtNutzbar")}: ${gruende
              .map((g) => t(`lueckenvorgang.grund.${g}`))
              .join(" · ")}`
          : t("lueckenvorgang.aktionFehler"),
      );
    },
  });

  const offen = vorgang.status === "offen";
  const fragend = vorgang.rollen.includes("fragend");
  const zustaendig = vorgang.rollen.includes("zustaendig");
  const verwaltend = vorgang.rollen.includes("verwaltend");
  const offeneRueckfrage = vorgang.rueckfragen.find((r) => r.antwort === undefined);
  const darfZuruecknehmen = verwaltend && (role === "controller" || role === "admin");
  const phaseText = t(`lueckenvorgang.phase.${vorgang.phase}`);
  const schrittText = t(`lueckenvorgang.schritt.${vorgang.naechsterSchritt}`);

  return (
    <div className="space-y-2 text-[12px] text-text" data-phase={vorgang.phase}>
      {vorgang.question ? <p className="font-medium">{vorgang.question}</p> : null}
      <div className="flex flex-wrap gap-1.5">
        {vorgang.rollen.map((r) => (
          <span
            key={r}
            className="rounded-pill bg-surface px-1.5 py-0.5 font-mono text-[9.5px] uppercase text-muted-2"
          >
            {t(`lueckenvorgang.rolle.${r}`)}
          </span>
        ))}
        <span className="text-[11px] text-muted">
          {t("lueckenvorgang.fragende", { count: vorgang.fragende })}
        </span>
      </div>
      <p data-testid="luecke-vorgang-stand">
        <span className="font-mono text-[10px] uppercase text-muted-2">
          {t("lueckenvorgang.stand")}:
        </span>{" "}
        {phaseText}
      </p>
      <p data-testid="luecke-vorgang-naechster">
        <span className="font-mono text-[10px] uppercase text-muted-2">
          {t("lueckenvorgang.naechster")}:
        </span>{" "}
        {schrittText}
      </p>
      <p className="text-[11.5px] text-muted">
        {t("lueckenvorgang.zustaendig")}:{" "}
        {vorgang.zustaendig ? nameOf(vorgang.zustaendig.id) : t("lueckenvorgang.zustaendigNiemand")}
        {vorgang.zustaendig?.verfuegbar === false
          ? ` · ${t("lueckenvorgang.zustaendigNichtVerfuegbar")}`
          : null}
      </p>
      {vorgang.zuordnungen.length > 0 ? (
        <ul className="text-[11px] text-muted-2" aria-label={t("lueckenvorgang.verlauf")}>
          {vorgang.zuordnungen.map((z) => (
            <li key={`${z.at}-${z.an}`}>
              {datum(z.at)} · {t(`lueckenvorgang.verlauf.${z.art}`, { name: nameOf(z.an) })}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Die persönliche Assistenz erklärt den TATSÄCHLICHEN Stand — wörtlich aus Phase und
          nächstem Schritt. Ihr Name ist die persönliche Wahl (`useAssistenzProfil`, dieselbe
          Anbindung wie die Figur in `KlaraVorschau.tsx`), ohne Profil der neutrale Rückfall. */}
      <div
        className="rounded-btn border border-hairline bg-surface px-2.5 py-1.5"
        data-testid="luecke-klara"
      >
        <div className="text-[11px] font-semibold text-ai">
          {t("lueckenvorgang.klara.titel", { name: assistenzName })}
        </div>
        <p className="text-[11.5px]">
          {t("lueckenvorgang.klara.satz", {
            phase: phaseText,
            schritt: schrittText,
            name: assistenzName,
          })}
        </p>
        {klara.betrieb === "demo" ? (
          <p className="text-[11px] text-muted-2">
            {t("lueckenvorgang.klara.demo", { name: assistenzName })}
          </p>
        ) : null}
      </div>

      {vorgang.rueckfragen.map((r) => (
        <div
          key={r.id}
          className="rounded-btn border border-hairline px-2.5 py-1.5"
          data-testid="luecke-rueckfrage"
        >
          <div className="text-[11px] font-semibold">
            {t("lueckenvorgang.rueckfrage")} · {datum(r.at)} ·{" "}
            {r.antwort === undefined
              ? t("lueckenvorgang.rueckfrageOffen")
              : t("lueckenvorgang.rueckfrageBeantwortet")}
          </div>
          {r.frage ? <p>{r.frage}</p> : null}
          {r.antwort ? <p className="mt-1 text-muted">{r.antwort}</p> : null}
          {r.vonMirBeantwortet ? (
            <p className="text-[11px] text-muted-2">{t("lueckenvorgang.rueckfrageVonMir")}</p>
          ) : null}
        </div>
      ))}

      {offen && fragend && offeneRueckfrage ? (
        <form
          className="space-y-1"
          onSubmit={(e) => {
            e.preventDefault();
            schritt.mutate(() =>
              endpoints.gaps.rueckfrageBeantworten(vorgang.id, offeneRueckfrage.id, antwort),
            );
          }}
        >
          <label className="block text-[11px] text-muted" htmlFor={`antwort-${vorgang.id}`}>
            {t("lueckenvorgang.rueckfrageAntwort")}
          </label>
          <textarea
            id={`antwort-${vorgang.id}`}
            data-testid="luecke-rueckfrage-antwort"
            value={antwort}
            onChange={(e) => setAntwort(e.target.value)}
            className="w-full rounded-input border border-hairline bg-surface px-2 py-1 text-[12px]"
          />
          <button
            type="submit"
            disabled={schritt.isPending || antwort.trim() === ""}
            className="rounded-btn bg-ink px-2.5 py-1 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            {t("lueckenvorgang.rueckfrageAntwortSenden")}
          </button>
        </form>
      ) : null}

      {offen && zustaendig && !offeneRueckfrage ? (
        <form
          className="space-y-1"
          onSubmit={(e) => {
            e.preventDefault();
            schritt.mutate(() => endpoints.gaps.rueckfrage(vorgang.id, rueckfrage));
          }}
        >
          <label className="block text-[11px] text-muted" htmlFor={`rueckfrage-${vorgang.id}`}>
            {t("lueckenvorgang.rueckfrageStellen")}
          </label>
          <textarea
            id={`rueckfrage-${vorgang.id}`}
            data-testid="luecke-rueckfrage-text"
            value={rueckfrage}
            onChange={(e) => setRueckfrage(e.target.value)}
            className="w-full rounded-input border border-hairline bg-surface px-2 py-1 text-[12px]"
          />
          <button
            type="submit"
            disabled={schritt.isPending || rueckfrage.trim() === ""}
            className="rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold disabled:opacity-50"
          >
            {t("lueckenvorgang.rueckfrageSenden")}
          </button>
        </form>
      ) : null}

      {offen && fragend && vorgang.naechsterSchritt === "zustaendigkeit_uebergeben" ? (
        <div className="space-y-1">
          <select
            value=""
            data-testid="luecke-uebergeben"
            aria-label={t("lueckenvorgang.uebergeben")}
            disabled={schritt.isPending}
            onChange={(e) => {
              const ziel = e.target.value;
              if (ziel) {
                schritt.mutate(() => endpoints.gaps.uebergeben(vorgang.id, ziel));
              }
            }}
            className="h-8 w-56 rounded-input border border-hairline bg-surface px-2 text-[12px] text-muted"
          >
            <option value="">{t("lueckenvorgang.uebergebenWaehlen")}</option>
            {personen.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || p.id}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-2">{t("lueckenvorgang.uebergebenHinweis")}</p>
        </div>
      ) : null}

      {vorgang.entwurf ? (
        <EintragBlock
          titelKey="lueckenvorgang.entwurf"
          eintrag={vorgang.entwurf}
          nichtZugaenglichKey="lueckenvorgang.entwurfNichtZugaenglich"
        />
      ) : null}

      {offen && (zustaendig || verwaltend) ? (
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={captureGapHref(vorgang.id)}
            className="inline-flex items-center rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold"
          >
            {t("lueckenvorgang.entwurfErfassen")}
          </Link>
          <select
            value=""
            data-testid="luecke-entwurf-verknuepfen"
            aria-label={t("lueckenvorgang.entwurfVerknuepfen")}
            disabled={schritt.isPending || eintraege.length === 0}
            onChange={(e) => {
              const koId = e.target.value;
              if (koId) {
                schritt.mutate(() => endpoints.gaps.entwurf(vorgang.id, koId));
              }
            }}
            className="h-8 w-56 rounded-input border border-hairline bg-surface px-2 text-[12px] text-muted"
          >
            <option value="">{t("lueckenvorgang.entwurfVerknuepfen")}</option>
            {eintraege.map((k) => (
              <option key={k.id} value={k.id}>
                {k.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            data-testid="luecke-abschliessen"
            disabled={schritt.isPending || vorgang.phase !== "bereit_zum_abschluss"}
            title={t("lueckenvorgang.abschliessenHinweis")}
            onClick={() => schritt.mutate(() => endpoints.gaps.abschliessen(vorgang.id))}
            className="rounded-btn bg-ink px-2.5 py-1 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            {t("lueckenvorgang.abschliessen")}
          </button>
        </div>
      ) : null}

      {vorgang.abschluss?.art === "fachlich" ? (
        <p className="text-[11.5px] text-trust-pos-text" data-testid="luecke-abschluss">
          {t("lueckenvorgang.abschluss.fachlich", {
            datum: datum(vorgang.abschluss.at),
            v: vorgang.abschluss.koVersion,
          })}
        </p>
      ) : null}
      {vorgang.abschluss?.art === "administrativ" ? (
        <p className="text-[11.5px] text-trust-warn-text" data-testid="luecke-abschluss">
          {t("lueckenvorgang.abschluss.administrativ", {
            datum: datum(vorgang.abschluss.at),
            grund: t(`lueckenvorgang.ruecknahme.${vorgang.abschluss.grund}`),
          })}
        </p>
      ) : null}
      {vorgang.ergebnis ? (
        <EintragBlock
          titelKey="lueckenvorgang.ergebnis"
          eintrag={vorgang.ergebnis}
          nichtZugaenglichKey="lueckenvorgang.ergebnisNichtZugaenglich"
          mitLink
        />
      ) : null}

      {offen && darfZuruecknehmen ? (
        <select
          value=""
          data-testid="luecke-zuruecknehmen"
          aria-label={t("lueckenvorgang.ruecknahme")}
          disabled={schritt.isPending}
          onChange={(e) => {
            const grund = e.target.value as GapRuecknahmeGrund | "";
            if (grund) {
              schritt.mutate(() => endpoints.gaps.zuruecknehmen(vorgang.id, grund));
            }
          }}
          className="h-8 w-56 rounded-input border border-hairline bg-surface px-2 text-[12px] text-muted"
        >
          <option value="">{t("lueckenvorgang.ruecknahmeWaehlen")}</option>
          {RUECKNAHME_GRUENDE.map((g) => (
            <option key={g} value={g}>
              {t(`lueckenvorgang.ruecknahme.${g}`)}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

function EintragBlock({
  titelKey,
  eintrag,
  nichtZugaenglichKey,
  mitLink = false,
}: {
  titelKey: string;
  eintrag: GapVorgangEintrag | { zugaenglich: false };
  nichtZugaenglichKey: string;
  mitLink?: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const nameOf = useAuthorName();
  if (!istEintrag(eintrag)) {
    return (
      <p className="text-[11.5px] text-muted" data-testid="luecke-eintrag-gesperrt">
        {t(nichtZugaenglichKey)}
      </p>
    );
  }
  const n = eintrag.nutzbarkeit;
  return (
    <div
      className="rounded-btn border border-hairline px-2.5 py-1.5"
      data-testid="luecke-eintrag"
      data-nutzbar={n.nutzbar ? "ja" : "nein"}
    >
      <div className="text-[11px] font-semibold text-muted-2">{t(titelKey)}</div>
      <div className="font-medium">
        {mitLink && n.nutzbar ? (
          <Link to={`/wissen/${eintrag.koId}`} className="text-brand-text hover:underline">
            {eintrag.titel}
          </Link>
        ) : (
          eintrag.titel
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 text-[11px] text-muted">
        <span>{t("lueckenvorgang.eintrag.fassung", { v: eintrag.koVersion })}</span>
        <span>
          {n.gruen === null || n.benoetigt === null || n.rot === null
            ? t("lueckenvorgang.eintrag.pruefungUnbekannt")
            : t("lueckenvorgang.eintrag.pruefung", {
                gruen: n.gruen,
                benoetigt: n.benoetigt,
                rot: n.rot,
              })}
        </span>
        <span>
          {t("lueckenvorgang.eintrag.eigentuemer", { name: nameOf(eintrag.eigentuemer) })}
        </span>
        <span>{t("lueckenvorgang.eintrag.sichtbarkeit", { stufe: eintrag.sichtbarkeit })}</span>
        {eintrag.spaceGebunden ? <span>{t("lueckenvorgang.eintrag.space")}</span> : null}
        <span>{t("lueckenvorgang.eintrag.quellen", { count: eintrag.quellen })}</span>
      </div>
      <p className={`text-[11.5px] ${n.nutzbar ? "text-trust-pos-text" : "text-trust-warn-text"}`}>
        {n.nutzbar
          ? t("lueckenvorgang.nutzbar")
          : `${t("lueckenvorgang.nichtNutzbar")}: ${n.gruende
              .map((g) => t(`lueckenvorgang.grund.${g}`))
              .join(" · ")}`}
      </p>
      {mitLink && n.nutzbar ? (
        <Link
          to={`/wissen/${eintrag.koId}`}
          data-testid="luecke-ergebnis-oeffnen"
          className="text-[11.5px] font-semibold text-brand-text hover:underline"
        >
          {t("lueckenvorgang.ergebnisOeffnen")}
        </Link>
      ) : null}
    </div>
  );
}
