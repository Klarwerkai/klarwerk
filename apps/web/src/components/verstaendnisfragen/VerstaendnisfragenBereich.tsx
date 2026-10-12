import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { belegstelleHref } from "../../lib/belegstelle";
import { formatKoTimestamp } from "../../lib/koDates";
import { Button, Card, SectionLabel } from "../ui";
import {
  type Bearbeitung,
  type ErgebnisKurz,
  type FragensatzInhalt,
  type FragensatzSicht,
  type LernSicht,
  type Regel,
  type Rolle,
  type Rueckmeldung,
  fehlerGrund,
  neueVersuchId,
  verstaendnisApi,
} from "./api";

// ================================================================================================
// VERSTÄNDNISFRAGEN · die Fläche am gelesenen Eintrag (aufnahme:20260922:gesamt-lernwege).
// ================================================================================================
//
// DREI TEILE, DREI RECHTE — entschieden wird jedes Mal am Server, die Fläche zeigt nur an:
//   · LERNENDE sehen den angenommenen Fragensatz zur genannten Fassung mit seiner Regel, geben ab
//     und bekommen die Rückmeldung mit Sprung an die Belegstelle. Eigene Ergebnisse bleiben nach
//     Neuladen abrufbar; dieselbe Abgabe zweimal ist derselbe Versuch (eine Kennung je Formular).
//   · die VERANTWORTLICHE Person (oder wer freigeben darf) legt an, ändert, sieht Befunde und legt
//     zur Zweitprüfung vor; wer freigeben darf, nimmt an oder weist zurück.
//   · ZUSTÄNDIGE sehen die Ergebnisse anderer — nach Namen, ohne Rangliste.
//
// Ohne Fragensatz und ohne Bearbeitungsrecht erscheint nichts; die Lesefläche bleibt unverändert.

const ROLLEN: readonly Rolle[] = ["viewer", "experte", "controller", "admin"];

const BEKANNTE_FEHLER = [
  "stand_veraltet",
  "quelle_geaendert",
  "quelle_nicht_gueltig",
  "quelle_fehlt",
  "versuche_erschoepft",
  "nicht_angenommen",
  "befunde",
  "status",
  "nicht_verantwortlich",
  "kein_freigaberecht",
  "begruendung_fehlt",
  "eingabe",
  "gleichzeitig",
  "nicht_haltbar",
  "versuch_fremd",
  "selbstpruefung",
  "nicht_berechtigt",
  "vertretung_ruht",
  "bereits_zugestimmt",
];

const amEintragSchluessel = (koId: string) => ["verstaendnisfragen", "eintrag", koId] as const;

function fehlerText(t: TFunction, fehler: unknown): string {
  const grund = fehlerGrund(fehler);
  return grund && BEKANNTE_FEHLER.includes(grund)
    ? t(`verstaendnis.fehler.${grund}`)
    : t("verstaendnis.fehler.allgemein");
}

function useDatum(): (iso: string) => string {
  const { i18n } = useTranslation();
  return (iso) => formatKoTimestamp(iso, i18n.language) ?? "—";
}

/** Die Regel als Satz — genau so, wie die verantwortliche Person sie festgelegt hat. */
export function RegelText({ regel, anzahl }: { regel: Regel; anzahl: number }): JSX.Element {
  const { t } = useTranslation();
  if (regel.mindestRichtig === null || regel.hoechstVersuche === null) {
    return (
      <p data-testid="verstaendnis-regel" className="text-[12.5px] text-trust-warn-text">
        {t("verstaendnis.regel.offen")}
      </p>
    );
  }
  const versuche =
    regel.hoechstVersuche === "unbegrenzt"
      ? t("verstaendnis.regel.unbegrenzt")
      : regel.hoechstVersuche === 1
        ? t("verstaendnis.regel.einVersuch")
        : t("verstaendnis.regel.versuche", { anzahl: regel.hoechstVersuche });
  return (
    <p data-testid="verstaendnis-regel" className="text-[12.5px] text-text">
      {t("verstaendnis.regel.bestehen", { mindest: regel.mindestRichtig, anzahl })} {versuche}
    </p>
  );
}

// ------------------------------------------------------------------------------------------------
// Die Rückmeldung — nach der Abgabe und nach Neuladen dieselbe.
// ------------------------------------------------------------------------------------------------

export function RueckmeldungAnsicht({ r }: { r: Rueckmeldung }): JSX.Element {
  const { t } = useTranslation();
  const datum = useDatum();
  const texte = (optionen: Rueckmeldung["fragen"][number]["optionen"], ids: string[]) =>
    ids.map((id) => optionen.find((o) => o.id === id)?.text ?? id).join(", ");
  return (
    <div
      data-testid="verstaendnis-rueckmeldung"
      data-versuch={r.versuchId}
      className="space-y-2 rounded-btn border border-hairline bg-page px-3 py-2 text-[12.5px]"
    >
      <p className="text-muted-2">
        {t("verstaendnis.ergebnis.kopf", {
          nummer: r.nummer,
          datum: datum(r.abgegebenAm),
          version: r.fragensatzVersion,
          fassung: r.koVersion,
        })}
      </p>
      <p
        data-testid="verstaendnis-ergebnis"
        data-bestanden={r.bewertung.bestanden ? "ja" : "nein"}
        className={r.bewertung.bestanden ? "text-trust-pos-text" : "text-trust-warn-text"}
      >
        <span className="font-semibold">
          {r.bewertung.bestanden
            ? t("verstaendnis.ergebnis.bestanden")
            : t("verstaendnis.ergebnis.nichtBestanden")}
        </span>
        {" · "}
        {t("verstaendnis.ergebnis.zahl", {
          richtig: r.bewertung.richtig,
          anzahl: r.bewertung.fragen,
          mindest: r.bewertung.mindestRichtig,
        })}
      </p>
      {r.bewertung.unvollstaendig ? (
        <p data-testid="verstaendnis-unvollstaendig" className="text-trust-warn-text">
          {t("verstaendnis.ergebnis.unvollstaendig", { anzahl: r.bewertung.unbeantwortet })}
        </p>
      ) : null}
      {r.bereits ? <p className="text-muted">{t("verstaendnis.ergebnis.bereits")}</p> : null}
      <ol className="space-y-2">
        {r.fragen.map((f, i) => (
          <li
            key={f.frageId}
            data-testid="verstaendnis-urteil"
            data-urteil={f.urteil}
            className="space-y-0.5 border-t border-hairline pt-1.5"
          >
            <p className="text-text">
              <span className="font-semibold">{`${i + 1}. `}</span>
              {f.text}
              {" · "}
              <span
                className={f.urteil === "richtig" ? "text-trust-pos-text" : "text-trust-warn-text"}
              >
                {t(`verstaendnis.urteil.${f.urteil}`)}
              </span>
            </p>
            <p className="text-muted">
              {f.gewaehlt.length > 0
                ? t("verstaendnis.rueck.deineWahl", { wahl: texte(f.optionen, f.gewaehlt) })
                : t("verstaendnis.rueck.keineWahl")}
            </p>
            <p className="text-text">
              {t("verstaendnis.rueck.richtig", { richtig: texte(f.optionen, f.richtig) })}
            </p>
            {f.erlaeuterung ? <p className="text-text">{f.erlaeuterung}</p> : null}
            {f.beleg ? (
              <p className="text-muted">
                <span className="italic">{f.beleg}</span>{" "}
                <Link
                  data-testid="verstaendnis-zur-stelle"
                  to={belegstelleHref(r.koId, { passage: f.beleg, fassung: r.koVersion })}
                  className="font-semibold text-text underline-offset-4 hover:underline"
                >
                  {t("verstaendnis.rueck.zurStelle", { fassung: r.koVersion })}
                </Link>
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function EigenesErgebnis({ e }: { e: ErgebnisKurz }): JSX.Element {
  const { t } = useTranslation();
  const datum = useDatum();
  const [offen, setOffen] = useState(false);
  const detail = useQuery({
    queryKey: ["verstaendnisfragen", "versuch", e.versuchId],
    queryFn: () => verstaendnisApi.versuch(e.versuchId),
    enabled: offen,
    retry: false,
  });
  return (
    <li data-testid="verstaendnis-eigenes" data-bestanden={e.bestanden ? "ja" : "nein"}>
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <span className={e.bestanden ? "text-trust-pos-text" : "text-trust-warn-text"}>
          {e.bestanden
            ? t("verstaendnis.ergebnis.bestanden")
            : t("verstaendnis.ergebnis.nichtBestanden")}
        </span>
        <span className="text-muted">
          {t("verstaendnis.ergebnis.zahl", {
            richtig: e.richtig,
            anzahl: e.fragen,
            mindest: e.mindestRichtig,
          })}
          {" · "}
          {datum(e.abgegebenAm)}
        </span>
        <button
          type="button"
          data-testid="verstaendnis-rueck-anzeigen"
          aria-expanded={offen}
          onClick={() => setOffen((v) => !v)}
          className="font-semibold text-text underline-offset-4 hover:underline"
        >
          {offen ? t("verstaendnis.rueck.verbergen") : t("verstaendnis.rueck.anzeigen")}
        </button>
      </div>
      {offen && detail.data ? <RueckmeldungAnsicht r={detail.data} /> : null}
      {offen && detail.isError ? (
        <p role="alert" className="text-trust-warn-text">
          {fehlerText(t, detail.error)}
        </p>
      ) : null}
    </li>
  );
}

// ------------------------------------------------------------------------------------------------
// Beantworten — eine Versuchskennung je geöffnetem Formular.
// ------------------------------------------------------------------------------------------------

function BeantwortenFormular({
  koId,
  fragensatzId,
  satz,
  onFertig,
}: {
  koId: string;
  fragensatzId: string;
  satz: LernSicht;
  onFertig: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const versuchId = useRef(neueVersuchId());
  const laeuft = useRef(false);
  const [gewaehlt, setGewaehlt] = useState<Record<string, string[]>>({});
  const [rueck, setRueck] = useState<Rueckmeldung | null>(null);
  const abgeben = useMutation({
    mutationFn: () =>
      verstaendnisApi.abgeben(fragensatzId, {
        versuchId: versuchId.current,
        version: satz.version,
        antworten: satz.fragen
          .map((f) => ({ frageId: f.id, gewaehlt: gewaehlt[f.id] ?? [] }))
          .filter((a) => a.gewaehlt.length > 0),
      }),
    onSuccess: (antwort) => setRueck(antwort),
    onError: () => {
      laeuft.current = false;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: amEintragSchluessel(koId) }),
  });
  const absenden = (): void => {
    if (laeuft.current) {
      return;
    }
    laeuft.current = true;
    abgeben.mutate();
  };
  if (rueck) {
    return (
      <div className="space-y-2">
        <RueckmeldungAnsicht r={rueck} />
        <Button variant="outline" onClick={onFertig}>
          {t("verstaendnis.abbrechen")}
        </Button>
      </div>
    );
  }
  const unbeantwortet = satz.fragen.filter((f) => (gewaehlt[f.id] ?? []).length === 0).length;
  const umschalten = (frageId: string, optionId: string): void =>
    setGewaehlt((alt) => {
      const bisher = alt[frageId] ?? [];
      return {
        ...alt,
        [frageId]: bisher.includes(optionId)
          ? bisher.filter((x) => x !== optionId)
          : [...bisher, optionId],
      };
    });
  return (
    <div data-testid="verstaendnis-formular" className="space-y-3 text-[13px]">
      <p className="text-[12px] text-muted">{t("verstaendnis.mehrfach")}</p>
      <ol className="space-y-3">
        {satz.fragen.map((f, i) => (
          <li key={f.id} data-testid="verstaendnis-frage" data-frage={f.id}>
            <fieldset className="m-0 min-w-0 space-y-1 border-0 p-0">
              <legend className="p-0 font-semibold text-text">{`${i + 1}. ${f.text}`}</legend>
              {f.optionen.map((o) => (
                <label key={o.id} className="flex items-start gap-2 text-text">
                  <input
                    type="checkbox"
                    data-testid="verstaendnis-option"
                    data-option={o.id}
                    checked={(gewaehlt[f.id] ?? []).includes(o.id)}
                    onChange={() => umschalten(f.id, o.id)}
                    disabled={abgeben.isPending}
                  />
                  <span>{o.text}</span>
                </label>
              ))}
            </fieldset>
          </li>
        ))}
      </ol>
      {unbeantwortet > 0 ? (
        <p data-testid="verstaendnis-unbeantwortet-hinweis" className="text-trust-warn-text">
          {t("verstaendnis.unbeantwortet", { anzahl: unbeantwortet })}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          data-testid="verstaendnis-abgeben"
          disabled={abgeben.isPending}
          onClick={absenden}
        >
          {abgeben.isPending ? t("verstaendnis.laeuft") : t("verstaendnis.abgeben")}
        </Button>
        <Button variant="ghost" onClick={onFertig} disabled={abgeben.isPending}>
          {t("verstaendnis.abbrechen")}
        </Button>
      </div>
      {abgeben.isError ? (
        <p role="alert" className="text-trust-warn-text">
          {fehlerText(t, abgeben.error)}
        </p>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Anlegen und Ändern — jede Speicherung ist eine neue Version im Entwurf.
// ------------------------------------------------------------------------------------------------

interface FrageEntwurf {
  text: string;
  optionen: string[];
  richtig: number[];
  erlaeuterung: string;
  beleg: string;
}

const leereFrage = (): FrageEntwurf => ({
  text: "",
  optionen: ["", ""],
  richtig: [],
  erlaeuterung: "",
  beleg: "",
});

function entwurfAus(b: Bearbeitung): FrageEntwurf[] {
  return b.fragen.map((q) => ({
    text: q.text,
    optionen: q.optionen.map((o) => o.text),
    richtig: q.richtig.map((id) => q.optionen.findIndex((o) => o.id === id)).filter((i) => i >= 0),
    erlaeuterung: q.erlaeuterung,
    beleg: q.beleg,
  }));
}

const FELD = [
  "w-full rounded-input border border-hairline bg-surface px-2.5 py-1.5",
  "text-[12.5px] outline-none focus:border-ink/30",
].join(" ");

function FragensatzFormular({
  koId,
  koVersion,
  bestehend,
  onFertig,
}: {
  koId: string;
  koVersion: number;
  bestehend: Bearbeitung | null;
  onFertig: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [titel, setTitel] = useState(bestehend?.titel ?? "");
  const [rollen, setRollen] = useState<Rolle[]>(bestehend?.rollen ?? []);
  const [mindest, setMindest] = useState(
    typeof bestehend?.regel.mindestRichtig === "number"
      ? String(bestehend.regel.mindestRichtig)
      : "",
  );
  const [unbegrenzt, setUnbegrenzt] = useState(bestehend?.regel.hoechstVersuche === "unbegrenzt");
  const [versuche, setVersuche] = useState(
    typeof bestehend?.regel.hoechstVersuche === "number"
      ? String(bestehend.regel.hoechstVersuche)
      : "",
  );
  const [fragen, setFragen] = useState<FrageEntwurf[]>(
    bestehend ? entwurfAus(bestehend) : [leereFrage()],
  );
  const zahl = (s: string): number | null => (s.trim() === "" ? null : Number(s.trim()));
  const inhalt = (): FragensatzInhalt => ({
    koVersion,
    titel,
    rollen,
    regel: {
      mindestRichtig: zahl(mindest),
      hoechstVersuche: unbegrenzt ? "unbegrenzt" : zahl(versuche),
    },
    fragen,
  });
  const speichern = useMutation({
    mutationFn: () =>
      bestehend
        ? verstaendnisApi.aendern(bestehend.id, bestehend.version, inhalt())
        : verstaendnisApi.anlegen(koId, inhalt()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: amEintragSchluessel(koId) });
      onFertig();
    },
  });
  const setzeFrage = (i: number, aenderung: Partial<FrageEntwurf>): void =>
    setFragen((alt) => alt.map((f, j) => (j === i ? { ...f, ...aenderung } : f)));
  return (
    <div data-testid="verstaendnis-editor" className="space-y-3 text-[12.5px]">
      <p className="text-muted">{t("verstaendnis.zuFassung", { fassung: koVersion })}</p>
      <label className="block space-y-1">
        <span className="text-muted">{t("verstaendnis.feld.titel")}</span>
        <input
          data-testid="verstaendnis-feld-titel"
          value={titel}
          maxLength={200}
          onChange={(e) => setTitel(e.target.value)}
          className={FELD}
        />
      </label>
      <fieldset className="m-0 space-y-1 border-0 p-0">
        <legend className="p-0 text-muted">{t("verstaendnis.feld.rollen")}</legend>
        <div className="flex flex-wrap gap-3">
          {ROLLEN.map((r) => (
            <label key={r} className="flex items-center gap-1.5 text-text">
              <input
                type="checkbox"
                data-testid="verstaendnis-feld-rolle"
                data-rolle={r}
                checked={rollen.includes(r)}
                onChange={() =>
                  setRollen((alt) => (alt.includes(r) ? alt.filter((x) => x !== r) : [...alt, r]))
                }
              />
              <span>{t(`role.name.${r}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-4">
        <label className="block space-y-1">
          <span className="text-muted">{t("verstaendnis.feld.mindest")}</span>
          <input
            type="number"
            min={1}
            data-testid="verstaendnis-feld-mindest"
            value={mindest}
            onChange={(e) => setMindest(e.target.value)}
            className={`${FELD} w-24`}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-muted">{t("verstaendnis.feld.versuche")}</span>
          <input
            type="number"
            min={1}
            max={20}
            data-testid="verstaendnis-feld-versuche"
            value={versuche}
            disabled={unbegrenzt}
            onChange={(e) => setVersuche(e.target.value)}
            className={`${FELD} w-24`}
          />
        </label>
        <label className="flex items-center gap-1.5 self-end text-text">
          <input
            type="checkbox"
            data-testid="verstaendnis-feld-unbegrenzt"
            checked={unbegrenzt}
            onChange={() => setUnbegrenzt((v) => !v)}
          />
          <span>{t("verstaendnis.feld.unbegrenzt")}</span>
        </label>
      </div>
      <ol className="space-y-3">
        {fragen.map((f, i) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: die Position ist die Kennung (`f1…`).
            key={i}
            data-testid="verstaendnis-editor-frage"
            className="space-y-1.5 border-t border-hairline pt-2"
          >
            <p className="font-semibold text-text">
              {t("verstaendnis.feld.frage", { nummer: i + 1 })}
            </p>
            <textarea
              aria-label={t("verstaendnis.feld.fragetext")}
              data-testid="verstaendnis-feld-frage"
              value={f.text}
              rows={2}
              onChange={(e) => setzeFrage(i, { text: e.target.value })}
              className={FELD}
            />
            <p className="text-muted">{t("verstaendnis.feld.optionen")}</p>
            {f.optionen.map((o, j) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: die Position ist die Kennung (`o1…`).
                key={j}
                className="flex items-center gap-2"
              >
                <label className="flex items-center gap-1 text-text">
                  <input
                    type="checkbox"
                    data-testid="verstaendnis-feld-richtig"
                    checked={f.richtig.includes(j)}
                    onChange={() =>
                      setzeFrage(i, {
                        richtig: f.richtig.includes(j)
                          ? f.richtig.filter((x) => x !== j)
                          : [...f.richtig, j].sort((a, b) => a - b),
                      })
                    }
                  />
                  <span>{t("verstaendnis.feld.richtig")}</span>
                </label>
                <input
                  aria-label={t("verstaendnis.feld.option", { nummer: j + 1 })}
                  data-testid="verstaendnis-feld-option"
                  value={o}
                  onChange={(e) =>
                    setzeFrage(i, {
                      optionen: f.optionen.map((x, k) => (k === j ? e.target.value : x)),
                    })
                  }
                  className={FELD}
                />
              </div>
            ))}
            {f.optionen.length < 8 ? (
              <Button
                variant="ghost"
                onClick={() => setzeFrage(i, { optionen: [...f.optionen, ""] })}
              >
                {t("verstaendnis.optionHinzu")}
              </Button>
            ) : null}
            <textarea
              aria-label={t("verstaendnis.feld.erlaeuterung")}
              placeholder={t("verstaendnis.feld.erlaeuterung")}
              data-testid="verstaendnis-feld-erlaeuterung"
              value={f.erlaeuterung}
              rows={2}
              onChange={(e) => setzeFrage(i, { erlaeuterung: e.target.value })}
              className={FELD}
            />
            <textarea
              aria-label={t("verstaendnis.feld.beleg", { fassung: koVersion })}
              placeholder={t("verstaendnis.feld.beleg", { fassung: koVersion })}
              data-testid="verstaendnis-feld-beleg"
              value={f.beleg}
              rows={2}
              maxLength={600}
              onChange={(e) => setzeFrage(i, { beleg: e.target.value })}
              className={FELD}
            />
            {fragen.length > 1 ? (
              <Button
                variant="ghost"
                onClick={() => setFragen((alt) => alt.filter((_, k) => k !== i))}
              >
                {t("verstaendnis.frageEntfernen")}
              </Button>
            ) : null}
          </li>
        ))}
      </ol>
      {fragen.length < 30 ? (
        <Button variant="outline" onClick={() => setFragen((alt) => [...alt, leereFrage()])}>
          {t("verstaendnis.frageHinzu")}
        </Button>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          data-testid="verstaendnis-speichern"
          disabled={speichern.isPending || titel.trim().length === 0}
          onClick={() => speichern.mutate()}
        >
          {t("verstaendnis.speichern")}
        </Button>
        <Button variant="ghost" onClick={onFertig} disabled={speichern.isPending}>
          {t("verstaendnis.abbrechen")}
        </Button>
      </div>
      {speichern.isError ? (
        <p role="alert" className="text-trust-warn-text">
          {fehlerText(t, speichern.error)}
        </p>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Bearbeitung: Stand, Befunde, Vorlegen und Entscheiden; die Übersicht für Zuständige.
// ------------------------------------------------------------------------------------------------

function Uebersicht({ fragensatzId }: { fragensatzId: string }): JSX.Element {
  const { t } = useTranslation();
  const datum = useDatum();
  const [offen, setOffen] = useState(false);
  const daten = useQuery({
    queryKey: ["verstaendnisfragen", "ergebnisse", fragensatzId],
    queryFn: () => verstaendnisApi.ergebnisse(fragensatzId),
    enabled: offen,
    retry: false,
  });
  return (
    <div data-testid="verstaendnis-uebersicht" className="space-y-1">
      <button
        type="button"
        aria-expanded={offen}
        onClick={() => setOffen((v) => !v)}
        className="font-semibold text-text underline-offset-4 hover:underline"
      >
        {offen ? t("verstaendnis.uebersicht.titel") : t("verstaendnis.uebersicht.zeigen")}
      </button>
      {offen ? <p className="text-muted">{t("verstaendnis.uebersicht.hinweis")}</p> : null}
      {offen && daten.data && daten.data.versuche.length === 0 ? (
        <p className="text-muted-2">{t("verstaendnis.uebersicht.leer")}</p>
      ) : null}
      {offen && daten.data && daten.data.versuche.length > 0 ? (
        <ul className="space-y-0.5">
          {daten.data.versuche.map((v) => (
            <li key={v.versuchId} data-testid="verstaendnis-uebersicht-zeile" className="text-text">
              {t("verstaendnis.uebersicht.zeile", {
                name: v.person.name ?? t("verstaendnis.unbekanntePerson"),
                datum: datum(v.abgegebenAm),
                version: v.fragensatzVersion,
                fassung: v.koVersion,
                richtig: v.richtig,
                anzahl: v.fragen,
                urteil: v.bestanden
                  ? t("verstaendnis.ergebnis.bestanden")
                  : t("verstaendnis.ergebnis.nichtBestanden"),
              })}
            </li>
          ))}
        </ul>
      ) : null}
      {offen && daten.isError ? (
        <p role="alert" className="text-trust-warn-text">
          {fehlerText(t, daten.error)}
        </p>
      ) : null}
    </div>
  );
}

function BearbeitungsBlock({
  koId,
  b,
  gueltigeVersion,
  darfEntscheiden,
  aktuelleFassung,
}: {
  koId: string;
  b: Bearbeitung;
  gueltigeVersion: number | null;
  darfEntscheiden: boolean;
  aktuelleFassung: number;
}): JSX.Element {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<number | null>(null);
  const [begruendung, setBegruendung] = useState("");
  const neuLaden = (): void => {
    void queryClient.invalidateQueries({ queryKey: amEintragSchluessel(koId) });
  };
  const vorlegen = useMutation({
    mutationFn: () => verstaendnisApi.vorlegen(b.id, b.version),
    onSettled: neuLaden,
  });
  const entscheiden = useMutation({
    mutationFn: (art: "annehmen" | "zurueckweisen") =>
      verstaendnisApi.entscheiden(
        b.id,
        b.version,
        art,
        art === "zurueckweisen" ? begruendung.trim() || null : null,
      ),
    onSettled: neuLaden,
  });
  if (editor !== null) {
    return (
      <FragensatzFormular
        koId={koId}
        koVersion={editor}
        bestehend={b}
        onFertig={() => setEditor(null)}
      />
    );
  }
  const offeneBefunde = [
    ...b.befunde.satz.map((s) => t(`verstaendnis.befund.${s}`)),
    ...b.befunde.fragen.flatMap((f) =>
      f.befunde.map((x) =>
        t("verstaendnis.befundFrage", {
          nummer: Number(f.frageId.replace(/^f/, "")),
          befund: t(`verstaendnis.befund.${x}`),
        }),
      ),
    ),
  ];
  const fehler = vorlegen.error ?? entscheiden.error;
  // Nacharbeit 3: wer über DIESE Version entscheidet, sagt der Server nach der geltenden Kontoregel
  // (Freigaberegel des Space: Prüferkreis, Mehr-Augen-Prinzip, Mindestzahl; ohne Regel direkt).
  const a = b.annahme;
  const entscheidet = darfEntscheiden && a.darfEntscheiden;
  const darfZurueckweisen =
    darfEntscheiden && (a.darfEntscheiden || a.hindernis === "bereits_zugestimmt");
  return (
    <div
      data-testid="verstaendnis-bearbeitung"
      data-status={b.status}
      className="space-y-2 border-t border-hairline pt-2 text-[12.5px]"
    >
      <p className="font-semibold text-text">{t("verstaendnis.bearbeitung")}</p>
      <p className="text-muted">{t("verstaendnis.bearbeitungHinweis")}</p>
      <p data-testid="verstaendnis-status" className="text-text">
        {t("verstaendnis.statusZeile", {
          version: b.version,
          status: t(`verstaendnis.status.${b.status}`),
          fassung: b.koVersion,
        })}
      </p>
      <p className="text-muted">
        {gueltigeVersion !== null
          ? t("verstaendnis.gueltigeVersion", { version: gueltigeVersion })
          : t("verstaendnis.keineGueltige")}
      </p>
      {b.status === "zurueckgewiesen" && b.begruendung ? (
        <p className="text-trust-warn-text">
          {t("verstaendnis.zurueckgewiesenGrund", { grund: b.begruendung })}
        </p>
      ) : null}
      {offeneBefunde.length > 0 ? (
        <div className="space-y-0.5">
          <p className="font-semibold text-trust-warn-text">{t("verstaendnis.befundeTitel")}</p>
          <ul className="list-disc pl-4">
            {offeneBefunde.map((text) => (
              <li key={text} data-testid="verstaendnis-befund" className="text-trust-warn-text">
                {text}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-trust-pos-text">
          {t("verstaendnis.keineBefunde", { fassung: b.koVersion })}
        </p>
      )}
      <p className="text-muted">{t("verstaendnis.kontoregel")}</p>
      <p
        data-testid="verstaendnis-annahme"
        data-zustimmungen={a.zustimmungen}
        data-erforderlich={a.erforderlich}
        className="text-text"
      >
        {a.regel
          ? t("verstaendnis.annahme.regel", {
              space: a.regel.spaceName,
              zustimmungen: a.zustimmungen,
              erforderlich: a.erforderlich,
            })
          : t("verstaendnis.annahme.direkt")}
      </p>
      {a.regel && a.unabhaengig !== null && a.unabhaengig < a.erforderlich - a.zustimmungen ? (
        <p className="text-trust-warn-text">
          {t("verstaendnis.annahme.zuWenige", { anzahl: a.unabhaengig })}
        </p>
      ) : null}
      {darfEntscheiden && a.hindernis ? (
        <p data-testid="verstaendnis-hindernis" className="text-trust-warn-text">
          {t(`verstaendnis.hindernis.${a.hindernis}`)}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          data-testid="verstaendnis-bearbeiten"
          onClick={() => setEditor(b.quellenlage === "aktuell" ? b.koVersion : aktuelleFassung)}
        >
          {b.quellenlage === "aktuell"
            ? t("verstaendnis.bearbeiten")
            : t("verstaendnis.neuFassen", { fassung: aktuelleFassung })}
        </Button>
        {b.status === "entwurf" ? (
          <Button
            variant="outline"
            data-testid="verstaendnis-vorlegen"
            disabled={vorlegen.isPending || offeneBefunde.length > 0}
            onClick={() => vorlegen.mutate()}
          >
            {t("verstaendnis.vorlegen")}
          </Button>
        ) : null}
        {entscheidet && (b.status === "entwurf" || b.status === "vorgelegt") ? (
          <Button
            variant="primary"
            data-testid="verstaendnis-annehmen"
            disabled={entscheiden.isPending || offeneBefunde.length > 0}
            onClick={() => entscheiden.mutate("annehmen")}
          >
            {t("verstaendnis.annehmen")}
          </Button>
        ) : null}
      </div>
      {darfZurueckweisen && b.status === "vorgelegt" ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="block flex-1 space-y-1">
            <span className="text-muted">{t("verstaendnis.begruendung")}</span>
            <input
              data-testid="verstaendnis-begruendung"
              value={begruendung}
              maxLength={1000}
              onChange={(e) => setBegruendung(e.target.value)}
              className={FELD}
            />
          </label>
          <Button
            variant="outline"
            data-testid="verstaendnis-zurueckweisen"
            disabled={entscheiden.isPending || begruendung.trim().length === 0}
            onClick={() => entscheiden.mutate("zurueckweisen")}
          >
            {t("verstaendnis.zurueckweisen")}
          </Button>
        </div>
      ) : null}
      {fehler ? (
        <p role="alert" className="text-trust-warn-text">
          {fehlerText(t, fehler)}
        </p>
      ) : null}
      <Uebersicht fragensatzId={b.id} />
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Ein Fragensatz und die ganze Fläche.
// ------------------------------------------------------------------------------------------------

function FragensatzKarte({
  koId,
  satz,
  darfEntscheiden,
  aktuelleFassung,
}: {
  koId: string;
  satz: FragensatzSicht;
  darfEntscheiden: boolean;
  aktuelleFassung: number;
}): JSX.Element {
  const { t } = useTranslation();
  const [beantworten, setBeantworten] = useState(false);
  const g = satz.gueltig;
  const bearbeitbar = g !== null && satz.quellenlage === "aktuell";
  const versucheFrei = satz.verbleibend === null || satz.verbleibend > 0;
  return (
    <div
      data-testid="verstaendnis-satz"
      data-fragensatz={satz.id}
      data-quellenlage={satz.quellenlage ?? "ohne"}
      className="space-y-2 border-t border-hairline pt-2"
    >
      <p className="text-[13.5px] font-semibold text-text">{satz.titel}</p>
      {g ? (
        <>
          <p className="text-[12px] text-muted">
            {t("verstaendnis.zuFassung", { fassung: g.koVersion })}
          </p>
          <RegelText regel={g.regel} anzahl={g.fragen.length} />
          {satz.quellenlage && satz.quellenlage !== "aktuell" ? (
            <p
              data-testid="verstaendnis-quelle-warnung"
              className="text-[12.5px] text-trust-warn-text"
            >
              {t(`verstaendnis.quelle.${satz.quellenlage}`, { fassung: g.koVersion })}
            </p>
          ) : null}
          {bearbeitbar && satz.verbleibend !== null ? (
            <p className="text-[12px] text-muted">
              {satz.verbleibend > 0
                ? t("verstaendnis.verbleibend", { anzahl: satz.verbleibend })
                : t("verstaendnis.keineVersuche")}
            </p>
          ) : null}
        </>
      ) : null}
      <div className="space-y-1">
        <p className="text-[12px] font-semibold text-muted">{t("verstaendnis.eigene")}</p>
        {satz.eigeneErgebnisse.length === 0 ? (
          <p className="text-[12px] text-muted-2">{t("verstaendnis.keineEigenen")}</p>
        ) : (
          <ul className="space-y-1">
            {satz.eigeneErgebnisse.map((e) => (
              <EigenesErgebnis key={e.versuchId} e={e} />
            ))}
          </ul>
        )}
      </div>
      {g && bearbeitbar && versucheFrei ? (
        beantworten ? (
          <BeantwortenFormular
            koId={koId}
            fragensatzId={satz.id}
            satz={g}
            onFertig={() => setBeantworten(false)}
          />
        ) : (
          <Button
            variant="primary"
            data-testid="verstaendnis-beantworten"
            onClick={() => setBeantworten(true)}
          >
            {t("verstaendnis.beantworten")}
          </Button>
        )
      ) : null}
      {satz.bearbeitung ? (
        <BearbeitungsBlock
          koId={koId}
          b={satz.bearbeitung}
          gueltigeVersion={g?.version ?? null}
          darfEntscheiden={darfEntscheiden}
          aktuelleFassung={aktuelleFassung}
        />
      ) : null}
    </div>
  );
}

/**
 * Die Verständnisfragen am gelesenen Eintrag. Ohne Fragensatz und ohne Bearbeitungsrecht — und
 * solange die Auskunft lädt oder fehlschlägt — erscheint nichts.
 */
export function VerstaendnisfragenBereich({ koId }: { koId: string }): JSX.Element | null {
  const { t } = useTranslation();
  const [anlegen, setAnlegen] = useState(false);
  const daten = useQuery({
    queryKey: amEintragSchluessel(koId),
    queryFn: () => verstaendnisApi.amEintrag(koId),
    retry: false,
  });
  const d = daten.data;
  if (!d || (d.fragensaetze.length === 0 && !d.darfBearbeiten)) {
    return null;
  }
  return (
    <Card
      interactive={false}
      className="space-y-3"
      data-testid="verstaendnis-bereich"
      id={`verstaendnisfragen-${koId}`}
    >
      <SectionLabel>{t("verstaendnis.titel")}</SectionLabel>
      <p data-testid="verstaendnis-abgrenzung" className="text-[12px] text-muted">
        {t("verstaendnis.abgrenzung")}
      </p>
      {d.fragensaetze.map((s) => (
        <FragensatzKarte
          key={s.id}
          koId={koId}
          satz={s}
          darfEntscheiden={d.darfEntscheiden}
          aktuelleFassung={d.aktuelleFassung}
        />
      ))}
      {d.darfBearbeiten && d.gueltig ? (
        anlegen ? (
          <FragensatzFormular
            koId={koId}
            koVersion={d.aktuelleFassung}
            bestehend={null}
            onFertig={() => setAnlegen(false)}
          />
        ) : (
          <Button
            variant="outline"
            data-testid="verstaendnis-anlegen"
            onClick={() => setAnlegen(true)}
          >
            {t("verstaendnis.anlegen")}
          </Button>
        )
      ) : null}
    </Card>
  );
}
