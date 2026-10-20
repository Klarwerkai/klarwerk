import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { endpoints } from "../../api/endpoints";
import {
  type ErkannteFrist,
  FRIST_ARTEN,
  type FristQuelle,
  type FristenRegel,
  type FristenStand,
  klaraFristenApi,
} from "../../api/klaraFristen";
import { klaraGespraechApi } from "../../api/klaraGespraech";
import { klaraNotizApi } from "../../api/klaraNotiz";
import { ortsZone } from "../../lib/kalenderZeit";
import { anfrageEpoche, aufRechtekontextwechsel } from "../../lib/rechtekontext";
import { Button, Field, TextInput } from "../ui";
import { Normereignisse } from "./Normereignisse";
import { oeffneNotiz } from "./notizen";

export function KlaraFristen({ kontoId }: { kontoId: string }): JSX.Element {
  const epoche = useSyncExternalStore(aufRechtekontextwechsel, anfrageEpoche, anfrageEpoche);
  return (
    <>
      <FristenOeffner key={`${kontoId}:${epoche}`} kontoId={kontoId} epoche={epoche} />
      <Normereignisse key={`norm:${kontoId}:${epoche}`} kontoId={kontoId} epoche={epoche} />
    </>
  );
}

function FristenOeffner({ kontoId, epoche }: { kontoId: string; epoche: number }): JSX.Element {
  const { t } = useTranslation();
  const [ziel, setZiel] = useState(window.location.hash);
  const [offen, setOffen] = useState(/^#frist-[a-f0-9]{64}$/.test(ziel));
  useEffect(() => {
    const wechsel = () => {
      const hash = window.location.hash;
      setZiel(hash);
      if (/^#frist-[a-f0-9]{64}$/.test(hash)) setOffen(true);
    };
    window.addEventListener("hashchange", wechsel);
    return () => window.removeEventListener("hashchange", wechsel);
  }, []);
  const daten = useQuery({
    queryKey: ["klara-fristen", kontoId, epoche],
    queryFn: klaraFristenApi.lesen,
    enabled: offen,
  });
  return (
    <section
      id="fristen-aus-informationen"
      className="my-4 rounded-card border border-hairline bg-surface p-4"
      data-testid="klara-fristen"
    >
      <Button aria-expanded={offen} onClick={() => setOffen(!offen)}>
        {t("klarafristen.titel")}
      </Button>
      {offen ? (
        <>
          <p className="my-2 text-sm text-muted">{t("klarafristen.hilfe")}</p>
          <p className="my-2 text-sm text-muted">{t("klarafristen.profil")}</p>
          {daten.isPending ? <output>{t("klarafristen.laden")}</output> : null}
          {daten.isError ? (
            <p role="alert">
              {t("klarafristen.fehler")}{" "}
              <Button onClick={() => void daten.refetch()}>{t("klarafristen.neuLaden")}</Button>
            </p>
          ) : null}
          {daten.data && !daten.isError ? (
            <FristenForm
              key={daten.data.fassung}
              stand={daten.data}
              kontoId={kontoId}
              epoche={epoche}
              ziel={ziel}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function FristenForm({
  stand,
  kontoId,
  epoche,
  ziel,
}: { stand: FristenStand; kontoId: string; epoche: number; ziel: string }): JSX.Element {
  const { t } = useTranslation();
  const client = useQueryClient();
  useEffect(() => {
    if (!/^#frist-[a-f0-9]{64}$/.test(ziel)) return;
    const e = document.getElementById(ziel.slice(1));
    e?.focus();
    e?.scrollIntoView?.({ block: "center" });
  }, [ziel]);
  const [suche, setSuche] = useState("");
  const [regel, setRegel] = useState<FristenRegel>(
    stand.regel ?? {
      aktiv: false,
      quellen: [],
      arten: ["ablauf"],
      bereich: "persoenlich",
      zeitzone: ortsZone(),
      aenderung: "klaeren",
      widerruf: "unzuverlaessig_ohne_vorlauf",
      wiederpruefung: "relevante_aenderung_klaeren",
      pruefstand: "aw19-sollbestand-1",
    },
  );
  const [vorschau, setVorschau] = useState<FristenStand | null>(null);
  const notizen = useQuery({
    queryKey: ["fristen-quellen", kontoId, epoche, "notizen"],
    queryFn: () => klaraNotizApi.liste(""),
  });
  const gespraech = useQuery({
    queryKey: ["fristen-quellen", kontoId, epoche, "gespraech"],
    queryFn: klaraGespraechApi.aktuelles,
  });
  const wissen = useQuery({
    queryKey: ["library", "search", { q: suche }],
    queryFn: () => endpoints.library.search({ q: suche }),
    enabled: suche.trim().length >= 2,
  });
  const frisch = () => {
    void client.invalidateQueries({ queryKey: ["klara-fristen", kontoId] });
    void client.invalidateQueries({ queryKey: ["kalender"] });
  };
  const speichern = useMutation({
    mutationFn: () => klaraFristenApi.speichern(regel, stand.fassung),
    onSuccess: frisch,
  });
  const pruefen = useMutation({
    mutationFn: () => klaraFristenApi.vorschau(regel),
    onSuccess: setVorschau,
  });
  const aktualisieren = useMutation({
    mutationFn: klaraFristenApi.aktualisieren,
    onSuccess: frisch,
  });
  const belegt = (q: FristQuelle) => regel.quellen.some((x) => x.art === q.art && x.id === q.id);
  function waehle(q: FristQuelle) {
    setVorschau(null);
    setRegel({
      ...regel,
      quellen: belegt(q)
        ? regel.quellen.filter((x) => x.art !== q.art || x.id !== q.id)
        : [...regel.quellen, q],
    });
  }
  const auswahl = (q: FristQuelle, titel: string) => (
    <label key={`${q.art}:${q.id}`} className="flex items-start gap-2 py-1">
      <input type="checkbox" checked={belegt(q)} onChange={() => waehle(q)} />
      {titel}
    </label>
  );
  const mutiert = speichern.isPending || pruefen.isPending || aktualisieren.isPending;
  return (
    <div className="space-y-4 text-sm">
      <fieldset disabled={mutiert} className="space-y-3">
        <legend className="font-semibold">{t("klarafristen.quellen")}</legend>
        <Field label={t("klarafristen.suche")}>
          <TextInput value={suche} onChange={(e) => setSuche(e.target.value)} />
        </Field>
        {wissen.isError || notizen.isError || gespraech.isError ? (
          <p role="alert">{t("klarafristen.quellFehler")}</p>
        ) : null}
        {wissen.data?.map((ko) => auswahl({ art: "wissensobjekt", id: ko.id }, ko.title))}
        <details>
          <summary>{t("klarafristen.notizen")}</summary>
          {notizen.data?.notizen.map((n) => auswahl({ art: "notiz", id: n.id }, n.titel))}
        </details>
        <details>
          <summary>{t("klarafristen.gespraech")}</summary>
          {gespraech.data?.gespraech?.nachrichten
            .filter((n) => n.von === "du")
            .map((n) =>
              auswahl(
                { art: "gespraech", id: `${gespraech.data?.gespraech?.id}/${n.id}` },
                n.text.slice(0, 180),
              ),
            )}
        </details>
        <p>{t("klarafristen.ausgewaehlt", { anzahl: regel.quellen.length })}</p>
        <ul>
          {regel.quellen.map((q, i) => (
            <li key={`${q.art}:${q.id}`} className="flex items-center gap-2">
              {t(`klarafristen.quellart.${q.art}`)} {i + 1}
              {q.art === "wissensobjekt" ? (
                <Link to={`/wissen/${encodeURIComponent(q.id)}`} className="underline">
                  {t("klarafristen.original")}
                </Link>
              ) : null}
              {q.art === "notiz" ? (
                <Button onClick={() => oeffneNotiz(q.id, t)}>{t("klarafristen.original")}</Button>
              ) : null}
              <Button onClick={() => waehle(q)}>{t("klarafristen.entfernen")}</Button>
            </li>
          ))}
        </ul>
        <fieldset>
          <legend className="font-semibold">{t("klarafristen.arten")}</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {FRIST_ARTEN.map((art) => (
              <label key={art} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={regel.arten.includes(art)}
                  onChange={() => {
                    setVorschau(null);
                    setRegel({
                      ...regel,
                      arten: regel.arten.includes(art)
                        ? regel.arten.filter((a) => a !== art)
                        : [...regel.arten, art],
                    });
                  }}
                />
                {t(`klarafristen.art.${art}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label={t("klarafristen.tagesgrenze")}>
          <TextInput
            value={regel.zeitzone}
            onChange={(e) => {
              setVorschau(null);
              setRegel({ ...regel, zeitzone: e.target.value });
            }}
          />
        </Field>
        <Field label={t("klarafristen.aenderung")}>
          <select
            className="h-10 rounded-input border border-hairline bg-surface px-2"
            value={regel.aenderung}
            onChange={(e) => {
              setVorschau(null);
              setRegel({ ...regel, aenderung: e.target.value as FristenRegel["aenderung"] });
            }}
          >
            <option value="klaeren">{t("klarafristen.klaeren")}</option>
            <option value="aktualisieren">{t("klarafristen.aktualisierenRegel")}</option>
          </select>
        </Field>
        <p className="text-muted">{t("klarafristen.schutzregel")}</p>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={regel.aktiv}
            onChange={(e) => {
              setVorschau(null);
              setRegel({ ...regel, aktiv: e.target.checked });
            }}
          />
          {t("klarafristen.aktiv")}
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!regel.quellen.length || !regel.arten.length}
            onClick={() => pruefen.mutate()}
          >
            {t("klarafristen.vorschau")}
          </Button>
          <Button
            disabled={!regel.quellen.length || !regel.arten.length}
            variant="primary"
            onClick={() => speichern.mutate()}
          >
            {t("klarafristen.speichern")}
          </Button>
          {stand.regel?.aktiv ? (
            <Button onClick={() => aktualisieren.mutate()}>{t("klarafristen.neuLesen")}</Button>
          ) : null}
        </div>
      </fieldset>
      {mutiert ? <output>{t("klarafristen.laden")}</output> : null}
      {speichern.isError || pruefen.isError || aktualisieren.isError ? (
        <p role="alert">{t("klarafristen.fehler")}</p>
      ) : null}
      {vorschau ? (
        <div data-testid="fristen-vorschau">
          <h3 className="font-semibold">{t("klarafristen.vorschauHinweis")}</h3>
          <ul>
            {vorschau.fristen.map((f) => (
              <li key={f.id}>
                {f.objekt.art} {f.objekt.kennung} · {t(`klarafristen.art.${f.art}`)} ·{" "}
                {f.datum?.datum ?? t("klarafristen.datumOffen")} ·{" "}
                {t(
                  f.manuell && f.stand === "erkannt"
                    ? "klarafristen.manuell"
                    : `klarafristen.stand.${f.stand}`,
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div data-testid="fristen-bestand">
        <h3 className="font-semibold">{t("klarafristen.bestand")}</h3>
        {stand.fristen.length === 0 ? <p>{t("klarafristen.leer")}</p> : null}
        {stand.fristen.map((f) => (
          <FristZeile key={`${f.id}:${f.fassung}`} f={f} frisch={frisch} />
        ))}
      </div>
    </div>
  );
}

function FristZeile({ f, frisch }: { f: ErkannteFrist; frisch: () => void }): JSX.Element {
  const { t } = useTranslation();
  const [bearbeiten, setBearbeiten] = useState(false);
  const [datum, setDatum] = useState(f.datum?.datum ?? "");
  const [ganztaegig, setGanztaegig] = useState(f.datum?.art !== "zeitpunkt");
  const [zeit, setZeit] = useState(f.datum?.art === "zeitpunkt" ? f.datum.uhrzeit : "09:00");
  const [zone, setZone] = useState(f.datum?.art === "zeitpunkt" ? f.datum.zeitzone : ortsZone());
  const aendern = useMutation({
    mutationFn: (aktion: "verwerfen" | "korrigieren" | "erledigen") =>
      klaraFristenApi.aendere(
        f,
        aktion,
        aktion === "korrigieren"
          ? ganztaegig
            ? { art: "datum", datum }
            : { art: "zeitpunkt", datum, uhrzeit: zeit, zeitzone: zone, utc: "" }
          : undefined,
      ),
    onSuccess: frisch,
  });
  return (
    <article
      id={`frist-${f.id}`}
      tabIndex={-1}
      className="my-3 rounded-card border border-hairline p-3"
      data-frist-id={f.id}
    >
      <h4 className="font-semibold">
        {f.objekt.art} {f.objekt.kennung} · {t(`klarafristen.art.${f.art}`)}
      </h4>
      <p>
        {f.datum?.datum ?? t("klarafristen.datumOffen")}{" "}
        {f.datum?.art === "zeitpunkt" ? `${f.datum.uhrzeit} ${f.datum.zeitzone}` : ""} ·{" "}
        {t(
          f.manuell && f.stand === "erkannt"
            ? "klarafristen.manuell"
            : `klarafristen.stand.${f.stand}`,
        )}
      </p>
      <p className="text-muted">
        {f.verantwortlich ? t("klarafristen.zustaendigkeitBelegt") : t("klarafristen.unzugeordnet")}
      </p>
      {f.klaerung.length ? (
        <ul>
          {f.klaerung.map((grund) => (
            <li key={grund}>{t(`klarafristen.grund.${grund}`)}</li>
          ))}
        </ul>
      ) : null}
      <details>
        <summary>{t("klarafristen.belege")}</summary>
        {f.herkunft.map((h, i) => (
          <div key={`${h.beleg.quelle.id}:${h.beleg.quelle.fassung}:${i}`}>
            <p>
              {t(`klarafristen.quellart.${h.beleg.quelle.art}`)} ·{" "}
              {t("klarafristen.fassung", { fassung: h.beleg.quelle.fassung })} ·{" "}
              {t(h.aktuell ? "klarafristen.belegAktuell" : "klarafristen.belegHistorisch")}
            </p>
            <blockquote className="border-l-2 border-hairline pl-2">
              {h.beleg.abschnitt.wortlaut}
            </blockquote>
            {h.beleg.quelle.art === "wissensobjekt" ? (
              <Link to={`/wissen/${encodeURIComponent(h.beleg.quelle.id)}`} className="underline">
                {t("klarafristen.original")}
              </Link>
            ) : null}
            {h.beleg.quelle.art === "notiz" ? (
              <Button onClick={() => oeffneNotiz(h.beleg.quelle.id, t)}>
                {t("klarafristen.original")}
              </Button>
            ) : null}
          </div>
        ))}
      </details>
      <details>
        <summary>{t("klarafristen.verlauf")}</summary>
        <ul>
          {f.verlauf.map((v, i) => (
            <li key={`${v.am}:${i}`}>
              {v.am} · {t(`klarafristen.verlauf.${v.grund}`)} ·{" "}
              {v.datum?.datum ?? t("klarafristen.datumOffen")}
            </li>
          ))}
        </ul>
      </details>
      <div className="my-2 flex flex-wrap gap-2">
        <Button disabled={aendern.isPending} onClick={() => setBearbeiten(!bearbeiten)}>
          {t("klarafristen.korrigieren")}
        </Button>
        {f.datum && f.stand !== "erledigt" ? (
          <Button disabled={aendern.isPending} onClick={() => aendern.mutate("erledigen")}>
            {t("klarafristen.erledigen")}
          </Button>
        ) : null}
        {f.stand !== "verworfen" ? (
          <Button disabled={aendern.isPending} onClick={() => aendern.mutate("verwerfen")}>
            {t("klarafristen.verwerfen")}
          </Button>
        ) : null}
      </div>
      {bearbeiten ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            aendern.mutate("korrigieren");
          }}
        >
          <Field label={t("klarafristen.datum")}>
            <TextInput
              type="date"
              value={datum}
              required
              onChange={(e) => setDatum(e.target.value)}
            />
          </Field>
          <label>
            <input
              type="checkbox"
              checked={ganztaegig}
              onChange={(e) => setGanztaegig(e.target.checked)}
            />{" "}
            {t("klarafristen.ganztaegig")}
          </label>
          {!ganztaegig ? (
            <>
              <Field label={t("klarafristen.zeit")}>
                <TextInput
                  type="time"
                  value={zeit}
                  required
                  onChange={(e) => setZeit(e.target.value)}
                />
              </Field>
              <Field label={t("klarafristen.zone")}>
                <TextInput value={zone} required onChange={(e) => setZone(e.target.value)} />
              </Field>
            </>
          ) : null}
          <Button type="submit" disabled={aendern.isPending}>
            {t("klarafristen.korrekturSpeichern")}
          </Button>
        </form>
      ) : null}
      {aendern.isError ? <p role="alert">{t("klarafristen.fehler")}</p> : null}
    </article>
  );
}
