import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { endpoints } from "../../api/endpoints";
import {
  NORM_ARTEN,
  type NormEreignis,
  type NormFassung,
  type NormStand,
  type NormVorschau,
  type Normgeschichte,
  klaraNormApi,
} from "../../api/klaraNormereignisse";
import { useAssistenzT } from "../../lib/assistenzProfil";
import { anfrageEpoche } from "../../lib/rechtekontext";
import { Button, Field, TextInput } from "../ui";

/** Der Elternknoten wird bei Konto-/Rechtewechsel neu aufgebaut, ohne alte private Vorschau. */
export function Normereignisse({
  kontoId,
  epoche,
}: { kontoId: string; epoche: number }): JSX.Element {
  const { t } = useAssistenzT();
  const [offen, setOffen] = useState(window.location.hash === "#normereignisse");
  const [suche, setSuche] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [erlaubt, setErlaubt] = useState(false);
  const [vorschau, setVorschau] = useState<NormVorschau | null>(null);
  const [fehler, setFehler] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const aktiv = useRef(true);
  useEffect(() => {
    aktiv.current = true;
    return () => {
      aktiv.current = false;
    };
  }, []);
  const daten = useQuery({
    queryKey: ["normereignisse", kontoId, epoche],
    queryFn: klaraNormApi.lesen,
    enabled: offen,
  });
  const quellen = useQuery({
    queryKey: ["normquellen", kontoId, epoche, suche],
    queryFn: () => endpoints.library.search({ q: suche }),
    enabled: offen && suche.trim().length >= 2,
  });
  const aktuell = () => aktiv.current && anfrageEpoche() === epoche;
  const aendere = (neu: string[]) => {
    setIds(neu);
    setVorschau(null);
    setFehler(false);
  };
  const pruefen = async () => {
    if (!erlaubt || laeuft) return;
    setLaeuft(true);
    setVorschau(null);
    setFehler(false);
    try {
      const r = await klaraNormApi.vorschau(ids);
      if (aktuell()) setVorschau(r);
    } catch {
      if (aktuell()) setFehler(true);
    } finally {
      if (aktuell()) setLaeuft(false);
    }
  };
  const erfassen = async () => {
    if (!erlaubt || !vorschau || !aktuell() || laeuft) return;
    setLaeuft(true);
    setFehler(false);
    try {
      await klaraNormApi.erfassen(ids);
      if (aktuell()) {
        setVorschau(null);
        await daten.refetch();
      }
    } catch {
      if (aktuell()) setFehler(true);
    } finally {
      if (aktuell()) setLaeuft(false);
    }
  };
  return (
    <section
      id="normereignisse"
      data-testid="normereignisse"
      className="my-4 min-w-0 rounded-card border border-hairline bg-surface p-4"
    >
      <Button aria-expanded={offen} onClick={() => setOffen(!offen)}>
        {t("normereignisse.titel")}
      </Button>
      {offen ? (
        <div className="mt-3 space-y-3 text-sm">
          <p>{t("normereignisse.hilfe")}</p>
          <p className="text-muted">{t("normereignisse.grenze")}</p>
          <fieldset disabled={laeuft} className="space-y-2">
            <Field label={t("normereignisse.suche")}>
              <TextInput value={suche} onChange={(e) => setSuche(e.target.value)} />
            </Field>
            {quellen.data?.map((q) => (
              <label key={q.id} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={ids.includes(q.id)}
                  onChange={(ev) =>
                    aendere(ev.target.checked ? [...ids, q.id] : ids.filter((id) => id !== q.id))
                  }
                />
                <span className="min-w-0 break-words">{q.title}</span>
              </label>
            ))}
            {quellen.data?.length === 0 ? <p>{t("normereignisse.keinSuchtreffer")}</p> : null}
            <p>{t("normereignisse.auswahl", { anzahl: ids.length })}</p>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={erlaubt}
                onChange={(ev) => {
                  setErlaubt(ev.target.checked);
                  setVorschau(null);
                }}
              />
              <span>{t("normereignisse.erlaubt")}</span>
            </label>
            <Button
              onClick={() => void pruefen()}
              disabled={!erlaubt || ids.length < 1 || ids.length > 20}
            >
              {t(laeuft ? "normereignisse.laeuft" : "normereignisse.vorschau")}
            </Button>
          </fieldset>
          {vorschau ? (
            <div
              data-testid="norm-vorschau"
              className="space-y-2 rounded-btn border border-hairline p-3"
            >
              <p>{t("normereignisse.vorschauHilfe")}</p>
              {vorschau.ereignisse.map((n) => (
                <div key={n.ereignis.id} className="min-w-0 space-y-1 break-words">
                  <strong>
                    {t("normereignisse.norm", { kennung: n.kennung, ausgabe: n.ausgabe })}
                  </strong>
                  <Ereignis e={n.ereignis} />
                  {n.betroffen.map((b) => (
                    <p key={b.koId}>
                      <Link to={`/wissen/${encodeURIComponent(b.koId)}`} className="underline">
                        {b.titel}
                      </Link>
                      {" · "}
                      {t("normereignisse.betroffen", { fassung: b.fassung })}
                    </p>
                  ))}
                </div>
              ))}
              {vorschau.ungeprueft.length ? (
                <p role="status">{t("normereignisse.quellenUngeprueft")}</p>
              ) : null}
              <p className="text-muted">{t("normereignisse.umfang")}</p>
              <Button disabled={laeuft || !erlaubt} onClick={() => void erfassen()}>
                {t("normereignisse.erfassen")}
              </Button>
            </div>
          ) : null}
          {fehler || daten.isError || quellen.isError ? (
            <p role="alert">{t("normereignisse.fehler")}</p>
          ) : null}
          <Button disabled={laeuft || daten.isFetching} onClick={() => void daten.refetch()}>
            {t("normereignisse.aktualisieren")}
          </Button>
          {daten.data && !daten.isError ? (
            <>
              {daten.data.normen.length === 0 ? <p>{t("normereignisse.leer")}</p> : null}
              {daten.data.normen.map((n) => (
                <Normkarte
                  key={`${n.id}:${daten.data.fassung}`}
                  n={n}
                  stand={daten.data}
                  kontoId={kontoId}
                  epoche={epoche}
                  neuLesen={() => daten.refetch()}
                />
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Ereignis({ e }: { e: NormEreignis }): JSX.Element {
  const { t } = useAssistenzT();
  return (
    <div data-norm-ereignis={e.id} className="space-y-1">
      <p>
        <strong>{t(`normereignisse.${e.art}`)}</strong>
        {" · "}
        {e.datum ?? t("normereignisse.datumOffen")}
        {" · "}
        {e.geltung ?? t("normereignisse.geltungOffen")}
      </p>
      <details>
        <summary>{t("normereignisse.belege")}</summary>
        {e.belege.map((b) => (
          <div key={b.id} className="my-2 space-y-1 rounded-btn border border-hairline p-2">
            <p>
              {t("normereignisse.begrenzt")}
              {!b.aktuell ? ` · ${t("normereignisse.historisch")}` : ""}
            </p>
            {b.quelle.art === "wissensobjekt" ? (
              <Link to={`/wissen/${encodeURIComponent(b.quelle.id)}`} className="underline">
                {t("normereignisse.quelleOeffnen")}
              </Link>
            ) : null}
            <blockquote className="whitespace-pre-wrap break-words">
              {b.norm.wortlaut}
              {"\n"}
              {b.ereignis.wortlaut}
              {b.geltung ? `\n${b.geltung.wortlaut}` : ""}
            </blockquote>
            {b.klaerung.length ? (
              <p className="text-trust-warn-text">{t("normereignisse.klaerung")}</p>
            ) : null}
          </div>
        ))}
      </details>
    </div>
  );
}

function Normkarte({
  n,
  stand,
  kontoId,
  epoche,
  neuLesen,
}: {
  n: Normgeschichte;
  stand: NormStand;
  kontoId: string;
  epoche: number;
  neuLesen: () => Promise<unknown>;
}): JSX.Element {
  const { t, i18n } = useAssistenzT();
  const [fachoffen, setFachoffen] = useState(false);
  const [bisher, setBisher] = useState("");
  const [nachfolger, setNachfolger] = useState("");
  const [geltung, setGeltung] = useState(n.ereignisse.find((e) => e.geltung)?.geltung ?? "");
  const [begruendung, setBegruendung] = useState("");
  const [bestaetigt, setBestaetigt] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState(false);
  const [fassung, setFassung] = useState<NormFassung | null>(null);
  const aktiv = useRef(true);
  useEffect(() => {
    aktiv.current = true;
    return () => {
      aktiv.current = false;
    };
  }, []);
  const aktuell = () => aktiv.current && epoche === anfrageEpoche();
  const optionen = useQuery({
    queryKey: ["norm-fachoptionen", kontoId, epoche, n.id, stand.fassung],
    queryFn: () => klaraNormApi.fachoptionen(n.id),
    enabled: fachoffen && stand.fachannahmeErlaubt,
  });
  const key = (o: { koId: string; fassung: number }) => `${o.koId}/${o.fassung}`;
  const b = optionen.data?.fassungen.find((o) => key(o) === bisher);
  const neu = optionen.data?.fassungen.find((o) => key(o) === nachfolger && o.aktuell);
  const annehmen = async () => {
    if (!b || !neu || !bestaetigt || !aktuell() || laeuft || n.widerspruch) return;
    setLaeuft(true);
    setFehler(false);
    try {
      await klaraNormApi.annehmen(n.id, {
        fassung: stand.fassung,
        bisher: { koId: b.koId, fassung: b.fassung },
        nachfolger: { koId: neu.koId, fassung: neu.fassung },
        geltung,
        begruendung,
        bestaetigt: true,
      });
      if (aktuell()) await neuLesen();
    } catch {
      if (aktuell()) setFehler(true);
    } finally {
      if (aktuell()) setLaeuft(false);
    }
  };
  const zeige = async (ziel: { koId: string; fassung: number }) => {
    setFehler(false);
    setFassung(null);
    try {
      const r = await klaraNormApi.fachfassung(n.id, ziel);
      if (aktuell()) setFassung(r);
    } catch {
      if (aktuell()) setFehler(true);
    }
  };
  const zeit = (s: string) =>
    `${new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(s))} UTC`;
  return (
    <article
      data-testid="normgeschichte"
      data-norm-id={n.id}
      data-norm-fassung={stand.fassung}
      className="min-w-0 space-y-3 rounded-card border border-hairline p-3"
    >
      <h3 className="font-semibold">
        {t("normereignisse.norm", { kennung: n.kennung, ausgabe: n.ausgabe })}
      </h3>
      {NORM_ARTEN.map((art) => (
        <div key={art} className="space-y-1">
          {n.ereignisse.some((e) => e.art === art) ? (
            n.ereignisse
              .filter((e) => e.art === art)
              .map((e) => (
                <div key={e.id}>
                  <Ereignis e={e} />
                  <Pruefauftrag
                    normId={n.id}
                    e={e}
                    stand={stand.fassung}
                    kontoId={kontoId}
                    epoche={epoche}
                    neuLesen={neuLesen}
                  />
                </div>
              ))
          ) : (
            <p>
              <strong>{t(`normereignisse.${art}`)}</strong>
              {" · "}
              {t("normereignisse.keinBeleg")}
            </p>
          )}
        </div>
      ))}
      {n.widerspruch ? (
        <p role="status" className="text-trust-warn-text">
          {t("normereignisse.widerspruch")}
        </p>
      ) : null}
      {n.annahmeUngeprueft ? (
        <p>{t("normereignisse.annahmeUngeprueft")}</p>
      ) : n.annahmen.length === 0 ? (
        <p>{t("normereignisse.pruefungOffen")}</p>
      ) : null}
      {n.annahmen.map((a) => (
        <div
          key={a.id}
          data-testid="norm-fachannahme"
          className="space-y-2 border-t border-hairline pt-2"
        >
          <p>
            {t("normereignisse.angenommen", {
              person: a.entschiedenName ?? a.entschiedenVon,
              zeit: zeit(a.entschiedenAm),
              geltung: a.geltung,
            })}
          </p>
          <p className="break-words">{a.begruendung}</p>
          <Button onClick={() => void zeige(a.bisher)}>
            {t("normereignisse.bisher")} · {a.bisher.fassung}
          </Button>{" "}
          <Button onClick={() => void zeige(a.nachfolger)}>
            {t("normereignisse.nachfolger")} · {a.nachfolger.fassung}
          </Button>
        </div>
      ))}
      {fassung ? (
        <div
          data-testid="norm-fachfassung"
          className="space-y-1 rounded-btn border border-hairline bg-surface p-3"
        >
          <strong>
            {t("normereignisse.fassung", { titel: fassung.titel, fassung: fassung.fassung })}
          </strong>
          <p className="whitespace-pre-wrap break-words">{fassung.aussage}</p>
        </div>
      ) : null}
      {stand.fachannahmeErlaubt ? (
        <details data-testid="norm-fachform" onToggle={(ev) => setFachoffen(ev.currentTarget.open)}>
          <summary>{t("normereignisse.annahme")}</summary>
          <p className="my-2">{t("normereignisse.annahmeHilfe")}</p>
          {optionen.data?.fassungen.length === 0 ? (
            <p>{t("normereignisse.keineFachfassungen")}</p>
          ) : null}
          <fieldset disabled={laeuft || n.widerspruch} className="space-y-2">
            <Field label={t("normereignisse.bisher")}>
              <select
                aria-label={t("normereignisse.bisher")}
                value={bisher}
                onChange={(e) => {
                  setBisher(e.target.value);
                  setBestaetigt(false);
                }}
                className="w-full rounded-input border border-hairline bg-surface p-2"
              >
                <option value="">{t("normereignisse.waehlen")}</option>
                {optionen.data?.fassungen.map((o) => (
                  <option key={key(o)} value={key(o)}>
                    {t("normereignisse.fassung", { titel: o.titel, fassung: o.fassung })}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("normereignisse.nachfolger")}>
              <select
                aria-label={t("normereignisse.nachfolger")}
                value={nachfolger}
                onChange={(e) => {
                  setNachfolger(e.target.value);
                  setBestaetigt(false);
                }}
                className="w-full rounded-input border border-hairline bg-surface p-2"
              >
                <option value="">{t("normereignisse.waehlen")}</option>
                {optionen.data?.fassungen
                  .filter((o) => o.aktuell)
                  .map((o) => (
                    <option key={key(o)} value={key(o)}>
                      {t("normereignisse.fassung", { titel: o.titel, fassung: o.fassung })}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label={t("normereignisse.geltung")}>
              <TextInput
                value={geltung}
                maxLength={200}
                onChange={(e) => {
                  setGeltung(e.target.value);
                  setBestaetigt(false);
                }}
              />
            </Field>
            <Field label={t("normereignisse.begruendung")}>
              <TextInput
                value={begruendung}
                maxLength={2000}
                onChange={(e) => setBegruendung(e.target.value)}
              />
            </Field>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={bestaetigt}
                onChange={(e) => setBestaetigt(e.target.checked)}
              />
              <span>{t("normereignisse.bestaetigt")}</span>
            </label>
            <Button
              onClick={() => void annehmen()}
              disabled={
                !b ||
                !neu ||
                key(b) === key(neu) ||
                !geltung.trim() ||
                !begruendung.trim() ||
                !bestaetigt
              }
            >
              {t("normereignisse.annahme")}
            </Button>
          </fieldset>
        </details>
      ) : null}
      {fehler || optionen.isError ? <p role="alert">{t("normereignisse.fehler")}</p> : null}
    </article>
  );
}

function Pruefauftrag({
  normId,
  e,
  stand,
  kontoId,
  epoche,
  neuLesen,
}: {
  normId: string;
  e: NormEreignis;
  stand: number;
  kontoId: string;
  epoche: number;
  neuLesen: () => Promise<unknown>;
}): JSX.Element {
  const { t } = useAssistenzT();
  const [offen, setOffen] = useState(false);
  const [auswahl, setAuswahl] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState(false);
  const aktiv = useRef(true);
  useEffect(() => {
    aktiv.current = true;
    return () => {
      aktiv.current = false;
    };
  }, []);
  const aktuell = () => aktiv.current && anfrageEpoche() === epoche;
  const daten = useQuery({
    queryKey: ["norm-pruefauftrag", kontoId, epoche, normId, e.id, stand],
    queryFn: () => klaraNormApi.pruefauftraege(normId, e.id),
    enabled: offen,
  });
  const gebunden = daten.data?.gebunden;
  const auftrag = daten.data?.auftraege.find(
    (a) => a.auftragId === (gebunden?.auftragId ?? auswahl),
  );
  const wirke = async () => {
    if (!auftrag || laeuft || !aktuell() || daten.data?.automatisch) return;
    setLaeuft(true);
    setFehler(false);
    try {
      if (gebunden) await klaraNormApi.pruefschritt(auftrag);
      else await klaraNormApi.verknuepfen(normId, e.id, stand, auftrag);
      if (aktuell()) {
        await daten.refetch();
        await neuLesen();
      }
    } catch {
      if (aktuell()) {
        setFehler(true);
        await daten.refetch();
      }
    } finally {
      if (aktuell()) setLaeuft(false);
    }
  };
  return (
    <details data-testid="norm-pruefauftrag" onToggle={(ev) => setOffen(ev.currentTarget.open)}>
      <summary>{t("normereignisse.pruefauftrag")}</summary>
      <div className="my-2 space-y-2">
        <p>{t("normereignisse.pruefauftragHilfe")}</p>
        {daten.data && !gebunden && !daten.data.automatisch ? (
          <Field label={t("normereignisse.pruefauftragAuswahl")}>
            <select
              aria-label={t("normereignisse.pruefauftragAuswahl")}
              value={auswahl}
              onChange={(ev) => setAuswahl(ev.target.value)}
              disabled={laeuft}
              className="w-full rounded-input border border-hairline bg-surface p-2"
            >
              <option value="">{t("normereignisse.auftragWaehlen")}</option>
              {daten.data.auftraege.map((a) => (
                <option key={a.auftragId} value={a.auftragId}>
                  {a.titel}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {daten.data && !auftrag ? (
          <p>
            {t(
              daten.data.automatisch && !gebunden
                ? "normereignisse.automatischerAuftragUnklar"
                : gebunden
                  ? "normereignisse.auftragFehlt"
                  : "normereignisse.keinAuftrag",
            )}
          </p>
        ) : null}
        {auftrag ? (
          <>
            <p>{auftrag.titel}</p>
            {!auftrag.quelleAktuell ? <p>{t("normereignisse.auftragsquelleGeaendert")}</p> : null}
            {auftrag.schritt?.ausgangUnklar ? <p>{t("normereignisse.auftragUnklar")}</p> : null}
            {auftrag.ergebnisVorhanden === false ? (
              <p>{t("normereignisse.aufgabeEntfernt")}</p>
            ) : null}
            {auftrag.ergebnisVorhanden && auftrag.schritt?.ergebnis ? (
              <Link className="underline" to={auftrag.schritt.ergebnis.pfad}>
                {t("normereignisse.aufgabeOeffnen")}
              </Link>
            ) : null}
            {auftrag.ergebnisVorhanden !== false && !daten.data?.automatisch ? (
              <Button disabled={laeuft} onClick={() => void wirke()}>
                {t(gebunden ? "normereignisse.pruefschritt" : "normereignisse.auftragVerknuepfen")}
              </Button>
            ) : null}
          </>
        ) : null}
        <Button disabled={laeuft || daten.isFetching} onClick={() => void daten.refetch()}>
          {t("normereignisse.aktualisieren")}
        </Button>
        {fehler || daten.isError ? <p role="alert">{t("normereignisse.fehler")}</p> : null}
      </div>
    </details>
  );
}
