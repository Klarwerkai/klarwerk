// ================================================================================================
// produkt:20261011:peter-p06:beschaffungsroutine (BES-07) — „MEINE FUNKTIONEN" IN DEN PERSÖNLICHEN
// EINSTELLUNGEN.
// ================================================================================================
//
// Minimal und situationsbezogen (R13): kein Einkaufsdashboard, sondern eine Detailkarte neben
// „Meine Assistenz" (`/profil?bereich=funktionen`). Oben ein Satz → Entwurf → Speichern; darunter je
// Funktion ein kompakter Block mit Stand, Quellen, offener Fähigkeit, Bearbeiten, Aufruf für einen
// neuen Fall und Serie.
//
// NACHARBEIT 3 (Ben): „So wie eben speichern" übernimmt den Vorgang aus dem zuletzt geführten
// Assistenzgespräch samt seinen berechtigten Quellen; die Quellen stehen danach sichtbar an der
// Funktion und lassen sich unter „Bearbeiten" entfernen oder ergänzen — zusammen mit Name und Zweck,
// jede Änderung als neue Fassung. Ein Fall ohne lesbare Quelle zeigt gezielt, was zu klären ist.
//
// EHRLICH: Ein gespeicherter Favorit, dem eine Fähigkeit fehlt, zeigt das als „Noch nicht
// ausführbar" mit den Gründen des Servers. „Neuen Fall vorbereiten" liest Quellen und Rechte von
// jetzt und sagt, dass nach außen nichts geschah — es simuliert keine Anfrage und kein Angebot.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { endpoints } from "../../api/endpoints";
import {
  type Eingabeweg,
  FUNKTIONEN_KEY,
  type FunktionsLauf,
  LETZTES_GESPRAECH_KEY,
  type Laufwerte,
  type PersoenlicheFunktion,
  type SerienEingabe,
  type VorgangsAbschnitt,
  funktionenApi,
} from "../../api/funktionen";
import { Abfragehuelle } from "../einstellungen/Abfragehuelle";
import { Detailkarte } from "../einstellungen/Detailkarte";
import { useDiktat } from "../start/useDiktat";
import { Button, Field, TextInput } from "../ui";
import { VormachenFlaeche } from "../vormachen/VormachenFlaeche";

const FELD =
  "w-full rounded-input border border-hairline bg-surface px-3 py-2 text-sm text-text outline-none placeholder:text-muted-2 focus:border-ink/30";

function meldung(fehler: unknown): string {
  return fehler instanceof Error ? fehler.message : String(fehler);
}

function pflichtSchluessel(pflicht: boolean): string {
  return pflicht ? "funktionen.entwurf.pflicht" : "funktionen.entwurf.freiwillig";
}

function Fehler({ fehler }: { fehler: unknown }): JSX.Element | null {
  const { t } = useTranslation();
  if (!fehler) {
    return null;
  }
  return (
    <p role="alert" className="text-[12.5px] text-trust-crit-text">
      {t("funktionen.fehler", { meldung: meldung(fehler) })}
    </p>
  );
}

// ------------------------------------------------------------------------------------------------
// Eine Quelle — ihr Titel über den regulären Leseweg (`GET /api/kos/:id`) mit den Rechten von
// jetzt. Ist sie nicht (mehr) lesbar, steht dort genau das, nicht ein alter Titel.
// ------------------------------------------------------------------------------------------------
function QuelleTitel({ koId }: { koId: string }): JSX.Element {
  const { t } = useTranslation();
  const ko = useQuery({ queryKey: ["ko", koId], queryFn: () => endpoints.ko.get(koId) });
  if (ko.isError) {
    return <span>{t("funktionen.quelle.unzugaenglich", { id: koId })}</span>;
  }
  return <span>{ko.data?.title ?? koId}</span>;
}

function QuellenListe({ quellen, testId }: { quellen: string[]; testId: string }): JSX.Element {
  const { t } = useTranslation();
  if (quellen.length === 0) {
    return (
      <p data-testid={testId} className="text-muted">
        {t("funktionen.entwurf.keineQuellen")}
      </p>
    );
  }
  return (
    <ul data-testid={testId} className="list-disc pl-5 text-muted">
      {quellen.map((koId) => (
        <li key={koId}>
          <QuelleTitel koId={koId} />
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------------------------------------
// Aus einem Satz zur Funktion — Text oder Sprache, ohne Editor (BES-07-K01). „So wie eben" nimmt
// den Vorgang des zuletzt geführten Assistenzgesprächs.
// ------------------------------------------------------------------------------------------------
function NeueFunktion(): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [weg, setWeg] = useState<Eingabeweg>("text");
  const [gespeichert, setGespeichert] = useState(false);
  // `null`: noch nicht gewählt — dann gilt „übernehmen", sobald es ein Gespräch gibt.
  const [mitVorgangWahl, setMitVorgangWahl] = useState<boolean | null>(null);
  const letztes = useQuery({
    queryKey: LETZTES_GESPRAECH_KEY,
    queryFn: funktionenApi.letztesGespraech,
  });
  const gespraech = letztes.data?.gespraech ?? null;
  const mitVorgang = gespraech !== null && (mitVorgangWahl ?? true);
  const vorgang = mitVorgang ? "letztes" : null;
  // Nacharbeit 4: die Vorschau bestimmt EINEN Fall des Gesprächs; bei mehreren wählt die Person.
  // Nacharbeit 5: sie hält den Eingabestand fest, aus dem sie entstand (`zeigen.variables`).
  const zeigen = useMutation({
    mutationFn: (stand: { text: string; weg: Eingabeweg; abschnitt: string | null }) =>
      funktionenApi.entwurf(stand.text, stand.weg, vorgang, stand.abschnitt),
    onSuccess: () => setGespeichert(false),
  });
  // Nacharbeit 5 (Ben): ein Diktat ändert den Eingabestand wie Tippen — die angezeigte Vorschau
  // gilt dann nicht mehr und wird verworfen.
  const verwerfen = zeigen.reset;
  const diktat = useDiktat((erkannt) => {
    setWeg("sprache");
    setText((alt) => (alt ? `${alt} ${erkannt}` : erkannt));
    verwerfen();
  });
  const vorschau = zeigen.data;
  const vorschauStand = zeigen.variables;
  // Gespeichert wird genau die Vorschau: der Eingabestand, aus dem sie entstand, ihre Bindung
  // (Gespräch, Fassung, Fall), ihre Quellen und die angezeigte Definition — nie ein späterer Text.
  const aktuell = vorschauStand !== undefined && vorschauStand.text === text;
  const speichern = useMutation({
    mutationFn: (art: "favorit" | "vorschlag") =>
      funktionenApi.speichern(vorschauStand?.text ?? text, vorschauStand?.weg ?? weg, art, {
        bindung: vorschau?.bindung ?? null,
        quellen: vorschau?.quellen ?? [],
        name: vorschau?.entwurf.name ?? null,
        ausgangstext: vorschau?.entwurf.ausgangstext ?? null,
      }),
    onSuccess: () => {
      zeigen.reset();
      setText("");
      setWeg("text");
      setGespeichert(true);
      void qc.invalidateQueries({ queryKey: FUNKTIONEN_KEY });
    },
  });
  const auswahl: VorgangsAbschnitt[] =
    zeigen.error instanceof ApiError && Array.isArray(zeigen.error.details.abschnitte)
      ? (zeigen.error.details.abschnitte as VorgangsAbschnitt[])
      : [];

  return (
    <section data-testid="funktion-neu" className="space-y-3">
      <h3 className="text-[13px] font-semibold text-text">{t("funktionen.neu.titel")}</h3>
      <Field label={t("funktionen.neu.feld")}>
        <textarea
          data-testid="funktion-satz"
          value={text}
          rows={2}
          placeholder={t("funktionen.neu.beispiel")}
          onChange={(e) => {
            setText(e.target.value);
            zeigen.reset();
          }}
          className={FELD}
        />
      </Field>
      {gespraech ? (
        <label className="flex items-start gap-2 text-[12.5px] text-muted">
          <input
            type="checkbox"
            data-testid="funktion-aus-gespraech"
            checked={mitVorgang}
            onChange={(e) => {
              setMitVorgangWahl(e.target.checked);
              zeigen.reset();
            }}
          />
          <span>{t("funktionen.neu.vorgang", { seite: gespraech.objektbezug.seitenName })}</span>
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {diktat.moeglich ? (
          <Button variant="outline" onClick={diktat.umschalten} data-testid="funktion-sprechen">
            {t(diktat.laeuft ? "funktionen.neu.sprechenStopp" : "funktionen.neu.sprechen")}
          </Button>
        ) : null}
        <Button
          variant="primary"
          data-testid="funktion-entwurf"
          disabled={(text.trim().length === 0 && !mitVorgang) || zeigen.isPending}
          onClick={() => zeigen.mutate({ text, weg, abschnitt: null })}
        >
          {t("funktionen.neu.entwurf")}
        </Button>
      </div>
      <Fehler fehler={zeigen.error ?? speichern.error} />
      {auswahl.length > 0 ? (
        <fieldset data-testid="funktion-fallwahl" className="space-y-1 text-[12.5px] text-muted">
          <legend className="font-medium">{t("funktionen.neu.fallwahl")}</legend>
          {auswahl.map((a) => (
            <Button
              key={a.abschnitt}
              variant="outline"
              data-testid={`funktion-fallwahl-${a.abschnitt}`}
              className="block w-full text-left"
              onClick={() => zeigen.mutate({ text, weg, abschnitt: a.abschnitt })}
            >
              {a.text}
            </Button>
          ))}
        </fieldset>
      ) : null}
      {gespeichert ? (
        <output data-testid="funktion-gespeichert" className="block text-[12.5px] text-muted">
          {t("funktionen.gespeichert")}
        </output>
      ) : null}
      {vorschau && aktuell ? (
        <div
          data-testid="funktion-entwurf-ansicht"
          className="space-y-2 rounded-card border border-hairline p-3 text-[12.5px]"
        >
          <p className="font-semibold text-text">{t("funktionen.entwurf.titel")}</p>
          <p className="text-text">{vorschau.entwurf.name}</p>
          <p className="text-muted">{vorschau.entwurf.zweck}</p>
          <p className="font-medium text-muted">{t("funktionen.entwurf.quellen")}</p>
          <QuellenListe quellen={vorschau.quellen} testId="funktion-entwurf-quellen" />
          {vorschau.nichtUebernommen > 0 ? (
            <p data-testid="funktion-nicht-uebernommen" className="text-muted">
              {t("funktionen.entwurf.nichtUebernommen", { anzahl: vorschau.nichtUebernommen })}
            </p>
          ) : null}
          <p className="font-medium text-muted">{t("funktionen.entwurf.parameter")}</p>
          <ul className="list-disc pl-5 text-muted">
            {vorschau.entwurf.parameter.map((p) => (
              <li key={p.name}>{`${p.bezeichnung} · ${t(pflichtSchluessel(p.pflicht))}`}</li>
            ))}
          </ul>
          <p className="text-muted">
            <span className="font-medium">{t("funktionen.entwurf.darf")}:</span>{" "}
            {t("funktionen.entwurf.schritte")}
          </p>
          <p className="text-muted">{t("funktionen.entwurf.aussen")}</p>
          <p className="text-muted">{vorschau.entwurf.empfaengerregel}</p>
          <p className="text-muted">{vorschau.entwurf.stopregel}</p>
          {vorschau.entwurf.beispielwerte.length > 0 ? (
            <p data-testid="funktion-beispielwerte" className="text-muted">
              {t("funktionen.entwurf.beispielwerte")}{" "}
              {vorschau.entwurf.beispielwerte.map((b) => b.wert).join(" · ")}
            </p>
          ) : null}
          {vorschau.entwurf.wiederholungErwaehnt ? (
            <p className="text-muted">{t("funktionen.entwurf.wiederholung")}</p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="primary"
              data-testid="funktion-speichern"
              disabled={speichern.isPending}
              onClick={() => speichern.mutate("favorit")}
            >
              {t("funktionen.entwurf.speichern")}
            </Button>
            <Button
              variant="outline"
              disabled={speichern.isPending}
              onClick={() => speichern.mutate("vorschlag")}
            >
              {t("funktionen.entwurf.vorschlag")}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ------------------------------------------------------------------------------------------------
// Bearbeiten — Name, Zweck und Quellen; jede Änderung wird serverseitig eine neue Fassung, die
// bisherigen Fälle behalten ihre (BES-07-K07).
// ------------------------------------------------------------------------------------------------
function Bearbeiten({
  funktion,
  onFertig,
}: {
  funktion: PersoenlicheFunktion;
  onFertig: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [name, setName] = useState(funktion.aktuell.name);
  const [zweck, setZweck] = useState(funktion.aktuell.zweck);
  const [quellen, setQuellen] = useState<string[]>(funktion.aktuell.quellen);
  const [ausGespraech, setAusGespraech] = useState(false);
  const speichern = useMutation({
    mutationFn: (abschnitt: string | null) =>
      funktionenApi.aendern(funktion.id, funktion.rev, {
        name,
        zweck,
        quellen,
        ...(ausGespraech ? { gespraech: "letztes" as const } : {}),
        ...(ausGespraech && abschnitt ? { abschnitt } : {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: FUNKTIONEN_KEY });
      onFertig();
    },
  });
  // Nacharbeit 4: enthält das Gespräch mehrere Fälle, wählt die Person, aus welchem ergänzt wird.
  const auswahl: VorgangsAbschnitt[] =
    speichern.error instanceof ApiError && Array.isArray(speichern.error.details.abschnitte)
      ? (speichern.error.details.abschnitte as VorgangsAbschnitt[])
      : [];
  return (
    <div data-testid="funktion-bearbeiten-form" className="space-y-2 text-[12.5px]">
      <Field label={t("funktionen.bearbeiten.name")}>
        <TextInput
          data-testid="funktion-bearbeiten-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label={t("funktionen.bearbeiten.zweck")}>
        <textarea
          data-testid="funktion-bearbeiten-zweck"
          value={zweck}
          rows={2}
          onChange={(e) => setZweck(e.target.value)}
          className={FELD}
        />
      </Field>
      <p className="font-medium text-muted">{t("funktionen.quellen.titel")}</p>
      <ul className="space-y-1 text-muted">
        {quellen.map((koId) => (
          <li key={koId} className="flex flex-wrap items-center gap-2">
            <QuelleTitel koId={koId} />
            <Button
              variant="ghost"
              data-testid={`funktion-quelle-entfernen-${koId}`}
              onClick={() => setQuellen((alt) => alt.filter((q) => q !== koId))}
            >
              {t("funktionen.bearbeiten.quelleEntfernen")}
            </Button>
          </li>
        ))}
      </ul>
      <label className="flex items-start gap-2 text-muted">
        <input
          type="checkbox"
          data-testid="funktion-bearbeiten-gespraech"
          checked={ausGespraech}
          onChange={(e) => setAusGespraech(e.target.checked)}
        />
        <span>{t("funktionen.bearbeiten.gespraech")}</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          data-testid="funktion-bearbeiten-speichern"
          disabled={speichern.isPending}
          onClick={() => speichern.mutate(null)}
        >
          {t("funktionen.bearbeiten.speichern")}
        </Button>
        <Button variant="outline" onClick={onFertig}>
          {t("funktionen.bearbeiten.abbrechen")}
        </Button>
      </div>
      <Fehler fehler={speichern.error} />
      {auswahl.length > 0 ? (
        <fieldset data-testid="funktion-bearbeiten-fallwahl" className="space-y-1 text-muted">
          <legend className="font-medium">{t("funktionen.neu.fallwahl")}</legend>
          {auswahl.map((a) => (
            <Button
              key={a.abschnitt}
              variant="outline"
              className="block w-full text-left"
              onClick={() => speichern.mutate(a.abschnitt)}
            >
              {a.text}
            </Button>
          ))}
        </fieldset>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Ein neuer Fall — Parameter dieses Laufs, Quellen und Rechte von jetzt (BES-07-K05). Fehlt eine
// lesbare Quelle, steht der Klärungsbedarf vor allem anderen.
// ------------------------------------------------------------------------------------------------
function Klaerungsbedarf({ lauf }: { lauf: FunktionsLauf }): JSX.Element | null {
  const { t } = useTranslation();
  const klaerung = lauf.klaerung ?? [];
  if (klaerung.length === 0) {
    return null;
  }
  return (
    <div data-testid="funktion-klaerung" role="alert" className="text-[12.5px] text-text">
      <p className="font-medium">{t("funktionen.lauf.klaerung")}</p>
      <ul className="list-disc pl-5">
        {klaerung.map((k) => (
          <li key={`${k.art}-${k.koId ?? "ohne"}`}>
            {k.koId ? <QuelleTitel koId={k.koId} /> : null}
            {k.koId ? ": " : null}
            {k.hinweis}
          </li>
        ))}
      </ul>
    </div>
  );
}

function NeuerFall({ funktion }: { funktion: PersoenlicheFunktion }): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [werte, setWerte] = useState<Laufwerte>({});
  const lauf = useMutation({
    mutationFn: () => funktionenApi.lauf(funktion.id, werte),
    onSuccess: () => {
      setWerte({});
      void qc.invalidateQueries({ queryKey: FUNKTIONEN_KEY });
    },
  });
  const ergebnis = lauf.data?.lauf;
  const zahlen = ergebnis
    ? {
        fassung: ergebnis.fassung,
        gelesen: ergebnis.quellen.filter((q) => q.zustand === "gelesen").length,
        verborgen: ergebnis.quellen.filter((q) => q.zustand !== "gelesen").length,
      }
    : null;
  return (
    <div data-testid="funktion-fall" className="space-y-2">
      {funktion.aktuell.parameter.map((p) => (
        <Field key={p.name} label={p.pflicht ? `${p.bezeichnung} *` : p.bezeichnung}>
          <TextInput
            data-testid={`funktion-parameter-${p.name}`}
            value={werte[p.name] ?? ""}
            title={p.hinweis}
            onChange={(e) => setWerte((alt) => ({ ...alt, [p.name]: e.target.value }))}
          />
        </Field>
      ))}
      <Button
        variant="primary"
        data-testid="funktion-fall-starten"
        disabled={lauf.isPending}
        onClick={() => lauf.mutate()}
      >
        {t("funktionen.lauf.starten")}
      </Button>
      <Fehler fehler={lauf.error} />
      {ergebnis && zahlen ? (
        <>
          <Klaerungsbedarf lauf={ergebnis} />
          <output data-testid="funktion-fall-ergebnis" className="block text-[12.5px] text-muted">
            {ergebnis.stand === "klaerung_noetig"
              ? t("funktionen.lauf.angehalten", zahlen)
              : t("funktionen.lauf.ergebnis", zahlen)}{" "}
            {t("funktionen.lauf.wartet", { liste: ergebnis.offen.join(", ") })}
          </output>
        </>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Die Serie — nur ausdrücklich, mit Vorschau; ausgelöst wird sie nicht (BES-07-K06).
// ------------------------------------------------------------------------------------------------
function Serie({ funktion }: { funktion: PersoenlicheFunktion }): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [serie, setSerie] = useState<SerienEingabe>({
    rhythmus: "monatlich",
    beginn: "",
    ende: null,
    uhrzeit: "08:00",
    nachholen: "einmal",
  });
  const fertig = (): void => {
    void qc.invalidateQueries({ queryKey: FUNKTIONEN_KEY });
  };
  const setzen = useMutation({
    mutationFn: () => funktionenApi.serie(funktion.id, funktion.rev, serie),
    onSuccess: fertig,
  });
  const entfernen = useMutation({
    mutationFn: () => funktionenApi.serieEntfernen(funktion.id, funktion.rev),
    onSuccess: fertig,
  });
  const z = funktion.zeitauftrag;
  return (
    <div data-testid="funktion-serie" className="space-y-2 text-[12.5px]">
      <p className="font-medium text-muted">{t("funktionen.serie.titel")}</p>
      {z ? (
        <>
          <p className="text-muted">{t("funktionen.serie.vorschau", { zeitzone: z.zeitzone })}</p>
          <ul className="list-disc pl-5 text-muted" data-testid="funktion-serie-vorschau">
            {funktion.vorschau.map((v) => (
              <li key={v.zeitpunkt}>
                {new Date(v.zeitpunkt).toLocaleString(undefined, { timeZone: z.zeitzone })}
                {v.hinweis ? ` · ${t(`funktionen.serie.hinweis.${v.hinweis}`)}` : ""}
              </li>
            ))}
          </ul>
          <p data-testid="funktion-serie-offen" className="text-muted">
            {t("funktionen.serie.offen", { grund: funktion.zeitauftragFaehigkeit.grund })}
          </p>
          <Button
            variant="outline"
            disabled={entfernen.isPending}
            onClick={() => entfernen.mutate()}
          >
            {t("funktionen.serie.entfernen")}
          </Button>
        </>
      ) : (
        <>
          <p className="text-muted">{t("funktionen.serie.keine")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label={t("funktionen.serie.rhythmus")}>
              <select
                value={serie.rhythmus}
                onChange={(e) =>
                  setSerie((alt) => ({
                    ...alt,
                    rhythmus: e.target.value === "woechentlich" ? "woechentlich" : "monatlich",
                  }))
                }
                className="h-10 w-full rounded-input border border-hairline bg-surface px-3 text-sm"
              >
                <option value="monatlich">{t("funktionen.serie.monatlich")}</option>
                <option value="woechentlich">{t("funktionen.serie.woechentlich")}</option>
              </select>
            </Field>
            <Field label={t("funktionen.serie.beginn")}>
              <TextInput
                type="date"
                value={serie.beginn}
                onChange={(e) => setSerie((alt) => ({ ...alt, beginn: e.target.value }))}
              />
            </Field>
            <Field label={t("funktionen.serie.ende")}>
              <TextInput
                type="date"
                value={serie.ende ?? ""}
                onChange={(e) => setSerie((alt) => ({ ...alt, ende: e.target.value || null }))}
              />
            </Field>
            <Field label={t("funktionen.serie.uhrzeit")}>
              <TextInput
                type="time"
                value={serie.uhrzeit}
                onChange={(e) => setSerie((alt) => ({ ...alt, uhrzeit: e.target.value }))}
              />
            </Field>
            <Field label={t("funktionen.serie.nachholen")}>
              <select
                value={serie.nachholen}
                onChange={(e) =>
                  setSerie((alt) => ({
                    ...alt,
                    nachholen: e.target.value === "nie" ? "nie" : "einmal",
                  }))
                }
                className="h-10 w-full rounded-input border border-hairline bg-surface px-3 text-sm"
              >
                <option value="einmal">{t("funktionen.serie.nachholen.einmal")}</option>
                <option value="nie">{t("funktionen.serie.nachholen.nie")}</option>
              </select>
            </Field>
          </div>
          <Button
            variant="outline"
            disabled={serie.beginn === "" || setzen.isPending}
            onClick={() => setzen.mutate()}
          >
            {t("funktionen.serie.einrichten")}
          </Button>
        </>
      )}
      <Fehler fehler={setzen.error ?? entfernen.error} />
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Eine Funktion — kompakt; Details (Bearbeiten, Fall, Serie, frühere Fälle) auf Wunsch.
// ------------------------------------------------------------------------------------------------
function FunktionsBlock({ funktion }: { funktion: PersoenlicheFunktion }): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [offen, setOffen] = useState(false);
  const [bearbeiten, setBearbeiten] = useState(false);
  const stand = useMutation({
    mutationFn: (ziel: PersoenlicheFunktion["stand"]) =>
      funktionenApi.aendern(funktion.id, funktion.rev, { stand: ziel }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: FUNKTIONEN_KEY });
    },
  });
  const knopf = (ziel: PersoenlicheFunktion["stand"], schluessel: string): JSX.Element => (
    <Button
      variant="outline"
      data-testid={`funktion-stand-${ziel}`}
      disabled={stand.isPending}
      onClick={() => stand.mutate(ziel)}
    >
      {t(schluessel)}
    </Button>
  );
  return (
    <li
      data-testid="funktion"
      data-funktion-id={funktion.id}
      className="space-y-2 rounded-card border border-hairline p-3"
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <span data-testid="funktion-name" className="text-[13.5px] font-semibold text-text">
          {funktion.aktuell.name}
        </span>
        <span data-testid="funktion-stand" className="text-[12px] text-muted-2">
          {t(`funktionen.stand.${funktion.stand}`)} ·{" "}
          {t("funktionen.fassung", { version: funktion.aktuell.version })}
        </span>
      </div>
      <p className="text-[12.5px] text-muted">{funktion.aktuell.zweck}</p>
      <div className="text-[12.5px]">
        <p className="font-medium text-muted">{t("funktionen.quellen.titel")}</p>
        <QuellenListe quellen={funktion.aktuell.quellen} testId="funktion-quellen" />
      </div>
      {funktion.ausfuehrbar ? null : (
        <div data-testid="funktion-offen" className="text-[12.5px] text-muted">
          <p className="font-medium">{t("funktionen.offen.titel")}</p>
          <ul className="list-disc pl-5">
            {funktion.offeneFaehigkeiten.map((f) => (
              <li key={f.id}>{`${f.titel} – ${f.grund}`}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {funktion.stand === "vorschlag" ? knopf("aktiv", "funktionen.aktion.uebernehmen") : null}
        {funktion.stand === "aktiv" ? knopf("pausiert", "funktionen.aktion.pausieren") : null}
        {funktion.stand === "pausiert" ? knopf("aktiv", "funktionen.aktion.fortsetzen") : null}
        {funktion.stand === "deaktiviert"
          ? knopf("aktiv", "funktionen.aktion.aktivieren")
          : knopf("deaktiviert", "funktionen.aktion.deaktivieren")}
        <Button
          variant="outline"
          data-testid="funktion-bearbeiten"
          aria-expanded={bearbeiten}
          onClick={() => setBearbeiten((v) => !v)}
        >
          {t("funktionen.aktion.bearbeiten")}
        </Button>
        {funktion.stand === "aktiv" ? (
          <Button
            variant="primary"
            data-testid="funktion-aufrufen"
            aria-expanded={offen}
            onClick={() => setOffen((v) => !v)}
          >
            {t("funktionen.aktion.aufrufen")}
          </Button>
        ) : null}
      </div>
      <Fehler fehler={stand.error} />
      {bearbeiten ? (
        <Bearbeiten key={funktion.rev} funktion={funktion} onFertig={() => setBearbeiten(false)} />
      ) : null}
      {offen && funktion.stand === "aktiv" ? <NeuerFall funktion={funktion} /> : null}
      {funktion.stand === "aktiv" || funktion.stand === "pausiert" ? (
        <Serie funktion={funktion} />
      ) : null}
      <div className="text-[12.5px] text-muted">
        <p className="font-medium">{t("funktionen.fassungen.titel")}</p>
        <ul data-testid="funktion-fassungen" className="list-disc pl-5">
          {funktion.fassungen.map((v) => (
            <li key={v.version}>
              {t("funktionen.fassungen.zeile", {
                version: v.version,
                name: v.name,
                zeit: new Date(v.angelegtAm).toLocaleString(),
              })}
            </li>
          ))}
        </ul>
      </div>
      {funktion.laeufe.length > 0 ? (
        <div className="text-[12.5px] text-muted">
          <p className="font-medium">{t("funktionen.laeufe.titel")}</p>
          <ul data-testid="funktion-laeufe" className="list-disc pl-5">
            {funktion.laeufe.map((l) => (
              <li key={l.id}>
                {t("funktionen.laeufe.zeile", {
                  zeit: new Date(l.ausgeloestAm).toLocaleString(),
                  fassung: l.fassung,
                  produkt: l.parameterwerte.produkt ?? "—",
                  menge: l.parameterwerte.menge ?? "—",
                })}
                {l.stand === "klaerung_noetig" ? ` · ${t("funktionen.laeufe.klaerung")}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

export function MeineFunktionen(): JSX.Element {
  const { t } = useTranslation();
  const liste = useQuery({ queryKey: FUNKTIONEN_KEY, queryFn: funktionenApi.liste });
  return (
    <section
      aria-label={t("funktionen.titel")}
      data-testid="detail-funktionen"
      className="space-y-3"
    >
      <h4>{t("funktionen.titel")}</h4>
      <p className="text-[13px] text-muted">{t("funktionen.intro")}</p>
      <NeueFunktion />
      <Abfragehuelle abfrage={liste}>
        {(daten) =>
          daten.funktionen.length === 0 ? (
            <p className="text-[12.5px] text-muted">{t("funktionen.leer")}</p>
          ) : (
            <ul data-testid="funktionen-liste" className="space-y-3">
              {daten.funktionen.map((f) => (
                <FunktionsBlock key={f.id} funktion={f} />
              ))}
            </ul>
          )
        }
      </Abfragehuelle>
    </section>
  );
}

export function MeineFunktionenDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  return (
    <Detailkarte
      titel={t("funktionen.titel")}
      onZurueck={onZurueck}
      testId="detail-funktionen-einstellungen"
    >
      <VormachenFlaeche />
      <MeineFunktionen />
    </Detailkarte>
  );
}
