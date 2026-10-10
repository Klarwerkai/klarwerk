// Freigaberegel und Prüfzuständigkeit eines Space (produkt:20261009:admin-freigaberegeln, ADMIN-09).
//
// Die Fläche zeigt, was der Server entscheidet (`freigaberegel-dienst.ts`): wer prüfen darf, welche
// Schritte bis zur Freigabe nötig sind, was fehlt, und wo jeder laufende Vorgang steht. Eine
// Regeländerung geht nur über die Wirkungsvorschau; bestätigt wird mit deren Grundlage. Ändert sich
// die Lage dazwischen, kommt die neue Vorschau zurück und wird statt der alten gezeigt.
//
// KEIN FREIGABEKNOPF: diese Fläche gibt nichts frei. Entschieden wird im Prüfbrett und am Beitrag,
// und dort prüft der Server die Regel.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import {
  type Entscheidung,
  type FreigabeRegelEingabe,
  type Fristlauf,
  type Pruefaufgabe,
  type RegelSicht,
  type RegelUebersicht,
  type RegelVorschau,
  type Voraussetzung,
  type Vorgang,
  type VorgangsLuecke,
  freigabeFehlerSchluessel,
  freigaberegelnApi,
} from "../api/freigaberegeln";
import { type SpaceSicht, spacesApi } from "../api/spaces";
import { formatKoTimestamp } from "../lib/koDates";
import { Button, Card, Field, SectionLabel, TextInput } from "./ui";

const FELD =
  "w-full rounded-input border border-hairline bg-surface px-3 py-2 text-sm text-text outline-none focus:border-ink/30";

const STUFEN = [1, 2, 3, 4, 5] as const;

type T = ReturnType<typeof useTranslation>["t"];

function eingabeAus(regel: RegelSicht | null, standard: number): FreigabeRegelEingabe {
  if (!regel) {
    return {
      zustimmungen: standard,
      pruefer: [],
      prueferTeams: [],
      fristTage: null,
      vertretungen: [],
    };
  }
  return {
    zustimmungen: regel.zustimmungen,
    pruefer: regel.pruefer.map((p) => p.id),
    prueferTeams: regel.prueferTeams.map((x) => x.id),
    fristTage: regel.fristTage,
    vertretungen: regel.vertretungen.map((v) => ({ fuer: v.fuer, durch: v.durch })),
  };
}

/** Teile eines Satzes mit „ · " verbinden; leere Teile fallen weg. */
function verbunden(teile: readonly (string | null)[]): string {
  return teile.filter((x): x is string => x !== null && x.length > 0).join(" · ");
}

function useZeit(): (iso: string | null) => string {
  const { i18n } = useTranslation();
  return (iso) => (iso ? (formatKoTimestamp(iso, i18n.language) ?? iso) : "—");
}

function vertretungsText(t: T, regel: RegelSicht): string {
  if (regel.vertretungen.length === 0) {
    return t("freigaberegeln.regel.keineVertretung");
  }
  const liste = regel.vertretungen.map((v) =>
    t("freigaberegeln.regel.vertretungEintrag", {
      durch: v.durchName ?? v.durch,
      fuer: v.fuerName ?? v.fuer,
    }),
  );
  return t("freigaberegeln.regel.vertretung", { liste: liste.join("; ") });
}

/** Die Regel in Sätzen — für Übersicht und Vorschau (alt/neu). */
function RegelText({ regel, standard }: { regel: RegelSicht | null; standard: number }) {
  const { t } = useTranslation();
  if (!regel) {
    return (
      <p className="text-[12.5px] text-text" data-testid="freigabe-regel-standard">
        {t("freigaberegeln.regel.standard", { anzahl: standard })}
      </p>
    );
  }
  const namen = [
    ...regel.pruefer.map((p) => p.name ?? p.id),
    ...regel.prueferTeams.map((x) => t("freigaberegeln.regel.team", { name: x.name ?? x.id })),
  ];
  return (
    <ul className="space-y-1 text-[12.5px] text-text" data-testid="freigabe-regel">
      <li data-testid="freigabe-regel-zustimmungen">
        {t("freigaberegeln.regel.zustimmungen", { anzahl: regel.zustimmungen })}
      </li>
      <li data-testid="freigabe-regel-gruppe">
        {namen.length > 0
          ? t("freigaberegeln.regel.gruppe", { namen: namen.join(", ") })
          : t("freigaberegeln.regel.alle")}
      </li>
      <li data-testid="freigabe-regel-frist">
        {regel.fristTage === null
          ? t("freigaberegeln.regel.keineFrist")
          : t("freigaberegeln.regel.frist", { tage: regel.fristTage })}
      </li>
      <li data-testid="freigabe-regel-vertretung">{vertretungsText(t, regel)}</li>
    </ul>
  );
}

function voraussetzungsText(t: T, v: Voraussetzung): string {
  switch (v.art) {
    case "zu_wenige_pruefer":
      return t("freigaberegeln.fehlt.zuWenige", {
        berechtigt: v.berechtigt,
        erforderlich: v.erforderlich,
      });
    case "pruefer_ohne_wirkung":
      return t("freigaberegeln.fehlt.ohneWirkung", {
        namen: v.personen
          .map((p) => `${p.name} (${t(`freigaberegeln.hindernis.${p.hindernis}`)})`)
          .join(", "),
      });
    case "vertretung_ohne_wirkung":
      return t("freigaberegeln.fehlt.vertretung", {
        durch: v.durchName ?? v.durch,
        fuer: v.fuerName ?? v.fuer,
        grund: t(`freigaberegeln.hindernis.${v.hindernis}`),
      });
    case "team_archiviert":
      return t("freigaberegeln.fehlt.team", { name: v.name ?? v.team });
    default:
      return t(`freigaberegeln.fehlt.${v.art}`);
  }
}

function lueckenText(t: T, l: VorgangsLuecke): string {
  switch (l.art) {
    case "zustimmungen_fehlen":
      return t("freigaberegeln.luecke.zustimmungen", { anzahl: l.anzahl });
    case "ablehnung_offen":
      return t("freigaberegeln.luecke.ablehnung", { anzahl: l.anzahl });
    case "zu_wenige_unabhaengige_pruefer":
      return t("freigaberegeln.luecke.unabhaengig", {
        verfuegbar: l.verfuegbar,
        erforderlich: l.erforderlich,
      });
    default:
      return t("freigaberegeln.luecke.aufgabe", { name: l.name ?? l.person });
  }
}

function aufgabenText(t: T, zeit: (iso: string | null) => string, a: Pruefaufgabe): string {
  const fristSchluessel = a.ueberfaellig
    ? "freigaberegeln.aufgabe.ueberfaellig"
    : "freigaberegeln.aufgabe.faellig";
  const frist = a.faelligAm ? t(fristSchluessel, { zeit: zeit(a.faelligAm) }) : null;
  const vertretung = a.vertretungFuer
    ? t("freigaberegeln.aufgabe.vertretung", { fuer: a.vertretungFuerName ?? a.vertretungFuer })
    : null;
  return verbunden([
    t("freigaberegeln.aufgabe.zeile", { wer: a.name ?? a.person, seit: zeit(a.seit) }),
    frist,
    vertretung,
    a.aktiv ? null : t("freigaberegeln.aufgabe.inaktiv"),
  ]);
}

function entscheidungsText(t: T, zeit: (iso: string | null) => string, e: Entscheidung): string {
  return verbunden([
    t("freigaberegeln.entscheidung.zeile", {
      art: t(`freigaberegeln.entscheidung.${e.art}`),
      wer: e.name ?? e.person,
      zeit: zeit(e.am),
      fassung: e.fassung ?? "—",
    }),
    e.aktuell ? null : t("freigaberegeln.entscheidung.aeltereFassung"),
    e.ausnahme ? t("freigaberegeln.entscheidung.ausnahme") : null,
    e.selbst ? t("freigaberegeln.entscheidung.selbst") : null,
  ]);
}

function zustimmungsText(t: T, v: Vorgang): string {
  const z = v.zustimmungen;
  // Eine Zustimmung ist keine Freigabe: „freigegeben" steht nur, wenn der Server es meldet.
  const kern =
    v.status === "validiert"
      ? t("freigaberegeln.vorgang.freigegeben", { gruen: z.gruen, erforderlich: z.erforderlich })
      : t("freigaberegeln.vorgang.offen", {
          gruen: z.gruen,
          erforderlich: z.erforderlich,
          gelb: z.gelb,
          rot: z.rot,
        });
  return verbunden([
    kern,
    z.veraltet > 0 ? t("freigaberegeln.vorgang.veraltet", { anzahl: z.veraltet }) : null,
  ]);
}

function VorgangZeile({ v }: { v: Vorgang }) {
  const { t } = useTranslation();
  const zeit = useZeit();
  return (
    <li
      data-testid="freigabe-vorgang"
      data-ko={v.id}
      data-zustand={v.zustand}
      className="rounded-btn border border-hairline px-3 py-2"
    >
      <p className="text-[13px] font-semibold text-ink">
        <Link to={`/wissen/${encodeURIComponent(v.id)}`} className="hover:underline">
          {v.title}
        </Link>{" "}
        <span className="font-normal text-muted-2">
          ·{" "}
          {verbunden([
            t("freigaberegeln.vorgang.fassung", { version: v.version }),
            t(`freigaberegeln.zustand.${v.zustand}`),
          ])}
        </span>
      </p>
      <p className="mt-1 text-[12.5px] text-text" data-testid="freigabe-vorgang-zustimmungen">
        {zustimmungsText(t, v)}
      </p>
      {v.luecken.length > 0 ? (
        <ul className="ml-4 mt-1 list-disc text-[12px] text-trust-crit-text">
          {v.luecken.map((l) => (
            <li
              key={`${l.art}-${"person" in l ? l.person : ""}`}
              data-testid="freigabe-luecke"
              data-art={l.art}
            >
              {lueckenText(t, l)}
            </li>
          ))}
        </ul>
      ) : null}
      {v.aufgaben.length > 0 ? (
        <ul className="mt-1 space-y-0.5 text-[12px] text-text">
          {v.aufgaben.map((a) => (
            <li
              key={a.person}
              data-testid="freigabe-aufgabe"
              data-person={a.person}
              data-ueberfaellig={a.ueberfaellig ? "ja" : "nein"}
            >
              {aufgabenText(t, zeit, a)}
            </li>
          ))}
        </ul>
      ) : null}
      {v.entscheidungen.length > 0 ? (
        <ol className="mt-1 space-y-0.5 border-t border-hairline pt-1">
          {v.entscheidungen.map((e) => (
            <li
              key={`${e.art}-${e.person}-${e.am}`}
              data-testid="freigabe-entscheidung"
              data-art={e.art}
              data-aktuell={e.aktuell ? "ja" : "nein"}
              className="text-[12px] text-muted"
            >
              {entscheidungsText(t, zeit, e)}
            </li>
          ))}
        </ol>
      ) : null}
    </li>
  );
}

function Vorschau({
  vorschau,
  standard,
}: {
  vorschau: RegelVorschau;
  standard: number;
}): JSX.Element {
  const { t } = useTranslation();
  const l = vorschau.laufend;
  const weg = vorschau.pruefer.entfaellt.map((p) =>
    t("freigaberegeln.vorschau.prueferWegEintrag", {
      name: p.name ?? p.id,
      anzahl: p.offeneAufgaben,
    }),
  );
  return (
    <div className="space-y-2 text-[12.5px]">
      <div className="grid gap-3 md:grid-cols-2">
        <div data-testid="freigabe-vorschau-alt">
          <p className="mb-1 font-semibold text-ink">{t("freigaberegeln.vorschau.alt")}</p>
          <RegelText regel={vorschau.alt} standard={standard} />
        </div>
        <div data-testid="freigabe-vorschau-neu">
          <p className="mb-1 font-semibold text-ink">{t("freigaberegeln.vorschau.neu")}</p>
          <RegelText regel={vorschau.neu} standard={standard} />
        </div>
      </div>
      <p data-testid="freigabe-vorschau-aenderungen" className="text-text">
        {t("freigaberegeln.vorschau.aenderungen", {
          liste: vorschau.aenderungen.map((a) => t(`freigaberegeln.aenderung.${a}`)).join(", "),
        })}
      </p>
      <p data-testid="freigabe-vorschau-laufend" className="text-text">
        {t("freigaberegeln.vorschau.laufend", {
          gesamt: l.gesamt,
          angehoben: l.angehoben,
          gesenkt: l.gesenkt,
          unveraendert: l.unveraendert,
        })}
      </p>
      {l.eintraege.length > 0 ? (
        <ul className="ml-4 list-disc text-[12px] text-text">
          {l.eintraege.map((e) => (
            <li key={e.id} data-testid="freigabe-vorschau-vorgang" data-ko={e.id}>
              {verbunden([
                t("freigaberegeln.vorschau.vorgang", {
                  titel: e.title,
                  bisher: e.bisher,
                  danach: e.danach,
                  gruen: e.gruen,
                }),
                e.schwelleErreicht ? t("freigaberegeln.vorschau.schwelle") : null,
              ])}
            </li>
          ))}
        </ul>
      ) : null}
      {l.verborgen > 0 ? (
        <p className="text-[12px] text-muted-2">
          {t("freigaberegeln.vorschau.verborgen", { anzahl: l.verborgen })}
        </p>
      ) : null}
      <p data-testid="freigabe-vorschau-freigegeben" className="text-text">
        {t("freigaberegeln.vorschau.freigegeben", { anzahl: vorschau.freigegeben.gesamt })}
      </p>
      {vorschau.pruefer.neu.length > 0 ? (
        <p data-testid="freigabe-vorschau-pruefer-neu" className="text-text">
          {t("freigaberegeln.vorschau.prueferNeu", {
            namen: vorschau.pruefer.neu.map((p) => p.name ?? p.id).join(", "),
          })}
        </p>
      ) : null}
      {weg.length > 0 ? (
        <p data-testid="freigabe-vorschau-pruefer-weg" className="text-trust-crit-text">
          {t("freigaberegeln.vorschau.prueferWeg", { namen: weg.join(", ") })}
        </p>
      ) : null}
      {vorschau.voraussetzungenDanach.length > 0 ? (
        <div role="alert" className="text-trust-crit-text">
          <p className="font-semibold">{t("freigaberegeln.vorschau.danachFehlt")}</p>
          <ul className="ml-4 list-disc">
            {vorschau.voraussetzungenDanach.map((v) => (
              <li key={v.art} data-testid="freigabe-voraussetzung" data-art={v.art}>
                {voraussetzungsText(t, v)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-[12px] text-muted-2">{t("freigaberegeln.vorschau.bleibt")}</p>
    </div>
  );
}

function RegelPflege({
  space,
  uebersicht,
  onFertig,
}: {
  space: SpaceSicht;
  uebersicht: RegelUebersicht;
  onFertig: () => Promise<void>;
}): JSX.Element {
  const { t } = useTranslation();
  const konten = useQuery({ queryKey: ["spaces", "konten"], queryFn: spacesApi.konten });
  const teams = useQuery({ queryKey: ["spaces", "teams"], queryFn: spacesApi.teams });
  const [form, setForm] = useState<FreigabeRegelEingabe>(() =>
    eingabeAus(uebersicht.regel, uebersicht.standardZustimmungen),
  );
  const [begruendung, setBegruendung] = useState("");
  const [vorschau, setVorschau] = useState<RegelVorschau | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const titelRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (vorschau) {
      titelRef.current?.focus();
    }
  }, [vorschau]);
  const aendere = (neu: Partial<FreigabeRegelEingabe>) => {
    setForm({ ...form, ...neu });
    setVorschau(null);
  };
  const pruefen = useMutation({
    mutationFn: () => freigaberegelnApi.vorschau(space.id, form),
    onSuccess: (v) => {
      setVorschau(v);
      setMeldung(null);
    },
    onError: (e) => setMeldung(freigabeFehlerSchluessel(e)),
  });
  const uebernehmen = useMutation({
    mutationFn: (v: RegelVorschau) => freigaberegelnApi.uebernehmen(space.id, form, v, begruendung),
    onSuccess: () => onFertig(),
    onError: (e) => {
      if (e instanceof ApiError && e.code === "VORSCHAU_VERALTET") {
        setVorschau((e.details.vorschau as RegelVorschau | undefined) ?? null);
      }
      setMeldung(freigabeFehlerSchluessel(e));
    },
  });
  const alleKonten = konten.data?.konten ?? [];
  // Wählbar als Prüfer und Vertretung: Konten mit Prüfrecht. Der Server prüft es ohnehin erneut.
  const pruefer = alleKonten.filter((k) => k.role === "controller" || k.role === "admin");
  const umschalten = (liste: string[], id: string): string[] =>
    liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id];
  const setzeVertretung = (i: number, teil: { fuer?: string; durch?: string }) =>
    aendere({
      vertretungen: form.vertretungen.map((x, j) => (j === i ? { ...x, ...teil } : x)),
    });
  // Stabile Zeilenkennungen der Vertretungen — neue Zeilen haben noch keine fachliche Kennung,
  // und der Index wäre nach dem Entfernen einer Zeile die Kennung einer anderen.
  const naechsteZeile = useRef(form.vertretungen.length);
  const [zeilen, setZeilen] = useState<number[]>(() => form.vertretungen.map((_, i) => i));
  const vertretungHinzu = () => {
    setZeilen([...zeilen, naechsteZeile.current]);
    naechsteZeile.current += 1;
    aendere({ vertretungen: [...form.vertretungen, { fuer: "", durch: "" }] });
  };
  const vertretungEntfernen = (i: number) => {
    setZeilen(zeilen.filter((_, j) => j !== i));
    aendere({ vertretungen: form.vertretungen.filter((_, j) => j !== i) });
  };

  return (
    <div className="mt-3 space-y-3 border-t border-hairline pt-3" data-testid="freigabe-pflege">
      <SectionLabel>{t("freigaberegeln.pflege.titel")}</SectionLabel>
      <Field label={t("freigaberegeln.pflege.zustimmungen")}>
        <select
          data-testid="freigabe-pflege-zustimmungen"
          className={FELD}
          value={form.zustimmungen}
          onChange={(e) => aendere({ zustimmungen: Number(e.target.value) })}
        >
          {STUFEN.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("freigaberegeln.pflege.pruefer")} gruppe>
        <p className="text-[12px] text-muted-2">{t("freigaberegeln.pflege.prueferHinweis")}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {pruefer.map((k) => (
            <label key={k.id} className="flex items-center gap-1.5 text-[12.5px] text-text">
              <input
                type="checkbox"
                data-testid="freigabe-pflege-pruefer"
                data-konto={k.id}
                checked={form.pruefer.includes(k.id)}
                onChange={() => aendere({ pruefer: umschalten(form.pruefer, k.id) })}
                className="accent-brand"
              />
              {k.name}
            </label>
          ))}
        </div>
      </Field>
      {(teams.data?.teams ?? []).length > 0 ? (
        <Field label={t("freigaberegeln.pflege.teams")} gruppe>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {(teams.data?.teams ?? []).map((x) => (
              <label key={x.id} className="flex items-center gap-1.5 text-[12.5px] text-text">
                <input
                  type="checkbox"
                  data-testid="freigabe-pflege-team"
                  data-team={x.id}
                  checked={form.prueferTeams.includes(x.id)}
                  onChange={() => aendere({ prueferTeams: umschalten(form.prueferTeams, x.id) })}
                  className="accent-brand"
                />
                {x.name}
              </label>
            ))}
          </div>
        </Field>
      ) : null}
      <Field label={t("freigaberegeln.pflege.frist")}>
        <TextInput
          type="number"
          min={1}
          max={90}
          inputMode="numeric"
          data-testid="freigabe-pflege-frist"
          value={form.fristTage ?? ""}
          onChange={(e) =>
            aendere({ fristTage: e.target.value === "" ? null : Number(e.target.value) })
          }
        />
      </Field>
      <Field label={t("freigaberegeln.pflege.vertretungen")} gruppe>
        {form.vertretungen.map((v, i) => (
          <div
            key={zeilen[i] ?? `neu-${v.fuer}-${v.durch}`}
            className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"
            data-testid="freigabe-pflege-vertretung"
          >
            <select
              aria-label={t("freigaberegeln.pflege.fuer")}
              data-testid="freigabe-pflege-vertretung-fuer"
              className={FELD}
              value={v.fuer}
              onChange={(e) => setzeVertretung(i, { fuer: e.target.value })}
            >
              <option value="">{t("freigaberegeln.pflege.fuer")}</option>
              {alleKonten.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
            <select
              aria-label={t("freigaberegeln.pflege.durch")}
              data-testid="freigabe-pflege-vertretung-durch"
              className={FELD}
              value={v.durch}
              onChange={(e) => setzeVertretung(i, { durch: e.target.value })}
            >
              <option value="">{t("freigaberegeln.pflege.durch")}</option>
              {pruefer.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
            <Button onClick={() => vertretungEntfernen(i)}>
              {t("freigaberegeln.pflege.entfernen")}
            </Button>
          </div>
        ))}
        <div>
          <Button data-testid="freigabe-pflege-vertretung-hinzu" onClick={vertretungHinzu}>
            {t("freigaberegeln.pflege.vertretungHinzu")}
          </Button>
        </div>
      </Field>
      <Field label={t("freigaberegeln.pflege.begruendung")}>
        <textarea
          data-testid="freigabe-pflege-begruendung"
          rows={2}
          className={FELD}
          value={begruendung}
          onChange={(e) => setBegruendung(e.target.value)}
        />
      </Field>
      {vorschau ? (
        <div
          className="space-y-2 rounded-btn border border-hairline p-3"
          data-testid="freigabe-vorschau"
        >
          <h3
            ref={titelRef}
            tabIndex={-1}
            className="text-[13.5px] font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
          >
            {t("freigaberegeln.vorschau.titel")}
          </h3>
          <Vorschau vorschau={vorschau} standard={uebersicht.standardZustimmungen} />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              data-testid="freigabe-uebernehmen"
              disabled={uebernehmen.isPending}
              onClick={() => uebernehmen.mutate(vorschau)}
            >
              {t("freigaberegeln.vorschau.uebernehmen")}
            </Button>
            <Button data-testid="freigabe-vorschau-abbrechen" onClick={() => setVorschau(null)}>
              {t("freigaberegeln.vorschau.abbrechen")}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          data-testid="freigabe-pruefen"
          disabled={pruefen.isPending}
          onClick={() => pruefen.mutate()}
        >
          {t("freigaberegeln.pflege.pruefen")}
        </Button>
      )}
      {meldung ? (
        <output
          role="alert"
          data-testid="freigabe-pflege-meldung"
          className="block text-[12.5px] text-trust-crit-text"
        >
          {t(meldung)}
        </output>
      ) : null}
    </div>
  );
}

function FristlaufErgebnis({ f }: { f: Fristlauf }): JSX.Element {
  const { t } = useTranslation();
  const titel = (x: { title: string | null }) =>
    x.title ?? t("freigaberegeln.frist.nichtEinsehbar");
  return (
    <div data-testid="freigabe-fristlauf-ergebnis" className="space-y-1 text-[12.5px] text-text">
      <p>
        {t("freigaberegeln.frist.ergebnis", {
          neu: f.neu.length,
          bestehend: f.bestehend,
          faellig: f.faellig.length,
          ohne: f.ohneVertretung.length,
        })}
      </p>
      {f.neu.length > 0 ? (
        <ul className="ml-4 list-disc text-[12px]">
          {f.neu.map((n) => (
            <li key={`${n.koId}-${n.durch}`} data-testid="freigabe-fristlauf-neu">
              {t("freigaberegeln.frist.neu", {
                titel: titel(n),
                durch: n.durchName ?? n.durch,
                fuer: n.fuerName ?? n.fuer,
              })}
            </li>
          ))}
        </ul>
      ) : null}
      {f.ohneVertretung.length > 0 ? (
        <ul className="ml-4 list-disc text-[12px] text-trust-crit-text">
          {f.ohneVertretung.map((o) => (
            <li key={`${o.koId}-${o.fuer}`} data-testid="freigabe-fristlauf-ohne">
              {t("freigaberegeln.frist.ohne", { titel: titel(o), fuer: o.fuerName ?? o.fuer })}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function PrueferListe({ u }: { u: RegelUebersicht }): JSX.Element {
  const { t } = useTranslation();
  if (u.pruefer.length === 0) {
    return (
      <p className="text-[12.5px] text-trust-crit-text">{t("freigaberegeln.pruefer.niemand")}</p>
    );
  }
  return (
    <ul className="flex flex-wrap gap-1.5" data-testid="freigabe-pruefer">
      {u.pruefer.map((p) => (
        <li
          key={p.id}
          data-testid="freigabe-pruefer-person"
          data-konto={p.id}
          data-berechtigt={p.berechtigt ? "ja" : "nein"}
          className="rounded-btn border border-hairline px-2 py-0.5 text-[12px] text-text"
        >
          {verbunden([
            p.name,
            t(`role.name.${p.role}`),
            p.wege.map((w) => t(`freigaberegeln.weg.${w}`)).join(", "),
            p.berechtigt ? null : t(`freigaberegeln.hindernis.${p.hindernis ?? "inaktiv"}`),
          ])}
        </li>
      ))}
    </ul>
  );
}

export function SpaceFreigaberegel({ space }: { space: SpaceSicht }): JSX.Element {
  const { t } = useTranslation();
  const zeit = useZeit();
  const qc = useQueryClient();
  const [pflege, setPflege] = useState(false);
  const [lauf, setLauf] = useState<Fristlauf | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const daten = useQuery({
    queryKey: ["space", space.id, "freigaberegel", space.version],
    queryFn: () => freigaberegelnApi.uebersicht(space.id),
  });
  const nachUebernahme = async (): Promise<void> => {
    setPflege(false);
    setMeldung("freigaberegeln.pflege.erfolg");
    await qc.invalidateQueries({ queryKey: ["space", space.id] });
    await qc.invalidateQueries({ queryKey: ["spaces"] });
    await qc.invalidateQueries({ queryKey: ["validation"] });
  };
  const fristlauf = useMutation({
    mutationFn: () => freigaberegelnApi.fristlauf(space.id),
    onSuccess: async (f) => {
      setLauf(f);
      setMeldung(null);
      await qc.invalidateQueries({ queryKey: ["space", space.id, "freigaberegel"] });
    },
    onError: (e) => setMeldung(freigabeFehlerSchluessel(e)),
  });

  return (
    <Card className="mb-4" data-testid="space-freigaberegel">
      <SectionLabel>{t("freigaberegeln.titel")}</SectionLabel>
      <p className="mb-2 text-[12px] text-muted-2">{t("freigaberegeln.erklaerung")}</p>
      {daten.isPending ? (
        <p className="text-[12.5px] text-muted">{t("freigaberegeln.laedt")}</p>
      ) : null}
      {daten.isError ? (
        <div role="alert" className="space-y-1 text-[12.5px] text-trust-crit-text">
          <p>{t(freigabeFehlerSchluessel(daten.error))}</p>
          <Button onClick={() => void daten.refetch()}>{t("freigaberegeln.erneut")}</Button>
        </div>
      ) : null}
      {daten.isSuccess ? (
        <div className="space-y-3">
          <RegelText regel={daten.data.regel} standard={daten.data.standardZustimmungen} />
          <div>
            <p className="mb-1 text-[12.5px] font-semibold text-ink">
              {t("freigaberegeln.schritte.titel")}
            </p>
            <ol
              className="ml-4 list-decimal space-y-0.5 text-[12.5px] text-text"
              data-testid="freigabe-schritte"
            >
              {daten.data.schritte.map((s) => (
                <li key={s.art} data-art={s.art}>
                  {t(`freigaberegeln.schritte.${s.art}`, { anzahl: s.anzahl ?? 0 })}
                </li>
              ))}
            </ol>
            <p className="mt-1 text-[12px] text-muted-2" data-testid="freigabe-selbst">
              {t("freigaberegeln.selbstpruefung")}
            </p>
            <p className="text-[12px] text-muted-2" data-testid="freigabe-ausnahmen">
              {t("freigaberegeln.ausnahmen")}
            </p>
          </div>
          <div>
            <p className="mb-1 text-[12.5px] font-semibold text-ink">
              {t("freigaberegeln.pruefer.titel")}
            </p>
            <PrueferListe u={daten.data} />
          </div>
          {daten.data.voraussetzungen.length > 0 ? (
            <div role="alert" className="text-[12.5px] text-trust-crit-text">
              <p className="font-semibold">{t("freigaberegeln.fehlt.titel")}</p>
              <ul className="ml-4 list-disc" data-testid="freigabe-voraussetzungen">
                {daten.data.voraussetzungen.map((v) => (
                  <li key={v.art} data-testid="freigabe-voraussetzung" data-art={v.art}>
                    {voraussetzungsText(t, v)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div>
            <p className="mb-1 text-[12.5px] font-semibold text-ink">
              {t("freigaberegeln.vorgaenge.titel")}
            </p>
            {daten.data.vorgaenge.length === 0 ? (
              <p className="text-[12.5px] text-muted">{t("freigaberegeln.vorgaenge.keine")}</p>
            ) : (
              <ul className="space-y-2" data-testid="freigabe-vorgaenge">
                {daten.data.vorgaenge.map((v) => (
                  <VorgangZeile key={v.id} v={v} />
                ))}
              </ul>
            )}
            {daten.data.vorgaengeVerborgen > 0 ? (
              <p className="mt-1 text-[12px] text-muted-2" data-testid="freigabe-verborgen">
                {t("freigaberegeln.vorgaenge.verborgen", {
                  anzahl: daten.data.vorgaengeVerborgen,
                })}
              </p>
            ) : null}
          </div>
          {daten.data.verlauf.length > 0 ? (
            <div>
              <p className="mb-1 text-[12.5px] font-semibold text-ink">
                {t("freigaberegeln.verlauf.titel")}
              </p>
              <ol className="space-y-1 text-[12px] text-muted-2" data-testid="freigabe-verlauf">
                {[...daten.data.verlauf].reverse().map((f) => (
                  <li key={f.version} data-testid="freigabe-verlauf-eintrag">
                    {verbunden([
                      t("freigaberegeln.verlauf.eintrag", {
                        version: f.version,
                        zeit: zeit(f.am),
                        wer: f.vonName ?? f.von,
                      }),
                      f.regel
                        ? t("freigaberegeln.regel.zustimmungen", { anzahl: f.regel.zustimmungen })
                        : t("freigaberegeln.verlauf.ohneRegel"),
                      f.begruendung,
                    ])}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {daten.data.darfAendern && !space.archiviert && !pflege ? (
              <Button data-testid="freigabe-aendern" onClick={() => setPflege(true)}>
                {t("freigaberegeln.pflege.oeffnen")}
              </Button>
            ) : null}
            {space.darfBearbeiten && daten.data.regel ? (
              <Button
                data-testid="freigabe-fristlauf"
                disabled={fristlauf.isPending}
                onClick={() => fristlauf.mutate()}
              >
                {t("freigaberegeln.frist.starten")}
              </Button>
            ) : null}
          </div>
          {pflege ? (
            <>
              <RegelPflege space={space} uebersicht={daten.data} onFertig={nachUebernahme} />
              <Button data-testid="freigabe-pflege-schliessen" onClick={() => setPflege(false)}>
                {t("freigaberegeln.pflege.schliessen")}
              </Button>
            </>
          ) : null}
          {lauf ? <FristlaufErgebnis f={lauf} /> : null}
          {meldung ? (
            <output data-testid="freigabe-meldung" className="block text-[12.5px] text-text">
              {t(meldung)}
            </output>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
