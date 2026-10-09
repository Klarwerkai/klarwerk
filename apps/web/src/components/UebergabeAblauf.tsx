// ================================================================================================
// ADMIN-05 · EIN EINSTIEG FÜR BEIDE ÜBERGABEWEGE — der Bereich in der Kontokarte.
// ================================================================================================
//
// Auftrag `produkt:20261007:ownership-uebergabe:admin-20261009`. Bis hierher standen in der
// Kontokarte zwei Übergabeflächen untereinander, jede mit eigenem Nachfolgerfeld und anderem
// Umfang („Beiträge übergeben" und „Wissen beim Ausscheiden übergeben"). Jetzt:
//
//   · EIN Einstieg erklärt beide Umfänge. Geöffnet ist immer nur einer — es gibt nie zwei
//     Nachfolgerformulare gleichzeitig.
//   · „Beiträge gezielt übergeben" ist die vorhandene Fläche (`VerantwortungUebergabe`), unverändert.
//   · „Ausscheiden vollständig übergeben" verteilt Beiträge UND offene Vorgänge (Entwürfe, Lücken,
//     Prüfaufgaben) in EINER Liste auf mehrere Nachfolger, zeigt die Vorschau je Paket mit
//     Rechtewirkung, fragt die Zugangsentscheidung ab und endet mit der Abschlussbilanz. Geschrieben
//     wird über `POST /api/verantwortung/ablauf` — Beiträge über die Verantwortungsübergabe, Vorgänge
//     über die Wissensübergabe. Ob bestätigt werden darf, urteilt der Server noch einmal.
//   · Die letzte Abschlussbilanz kommt aus dem Prüfprotokoll — sie steht nach einem Neuladen da.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import {
  type AblaufEingabe,
  type AblaufErgebnis,
  type AblaufVorschau,
  type Bilanz,
  type EintragArt,
  type Zugangsentscheidung,
  verantwortungApi,
} from "../api/verantwortung";
import { VerantwortungUebergabe } from "./VerantwortungUebergabe";
import { Button } from "./ui";

export function UebergabeEinstieg({
  personId,
  personName,
  gezieltOffen,
  onGezieltOffen,
}: {
  personId: string;
  personName: string;
  /** Von aussen gesteuert (Zähler „Beiträge" der Kontokarte öffnet die gezielte Übergabe). */
  gezieltOffen: boolean;
  onGezieltOffen: (offen: boolean) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const titelId = useId();
  const [ausscheidenOffen, setAusscheidenOffen] = useState(false);
  // Die gezielte Übergabe hat Vorrang, wenn sie von aussen geöffnet wird — nie beide zugleich.
  const ausscheiden = ausscheidenOffen && !gezieltOffen;
  // Der Knopf, der die Fläche öffnet, verschwindet dabei — der Tastaturfokus wandert deshalb in die
  // Fläche hinein und beim Schliessen zurück auf den Knopf, statt auf der Seite verloren zu gehen.
  const bereich = useRef<HTMLElement>(null);
  const flaeche = useRef<HTMLElement>(null);
  const warOffen = useRef(false);
  useEffect(() => {
    if (ausscheiden) {
      flaeche.current?.focus();
    } else if (warOffen.current && !gezieltOffen) {
      bereich.current?.querySelector<HTMLElement>('[data-testid="ablauf-oeffnen"]')?.focus();
    }
    warOffen.current = ausscheiden;
  }, [ausscheiden, gezieltOffen]);
  return (
    <section
      ref={bereich}
      data-testid="uebergabe-einstieg"
      aria-labelledby={titelId}
      className="space-y-2 border-t border-hairline pt-4"
    >
      <h3 id={titelId} className="text-[13px] font-semibold text-text">
        {t("uebergabeablauf.titel")}
      </h3>
      <p className="text-[12px] text-muted-2">{t("uebergabeablauf.erklaerung")}</p>
      <ul className="list-disc space-y-1 pl-5 text-[12px] text-muted-2">
        <li data-umfang="gezielt">{t("uebergabeablauf.gezielt")}</li>
        <li data-umfang="ausscheiden">{t("uebergabeablauf.ausscheiden")}</li>
      </ul>
      {ausscheiden ? null : (
        <VerantwortungUebergabe
          personId={personId}
          personName={personName}
          offen={gezieltOffen}
          onOffen={(offen) => {
            onGezieltOffen(offen);
            if (offen) {
              setAusscheidenOffen(false);
            }
          }}
        />
      )}
      {gezieltOffen ? null : ausscheiden ? (
        <section
          ref={flaeche}
          tabIndex={-1}
          aria-label={t("uebergabeablauf.oeffnen")}
          className="outline-none"
        >
          <Ausscheiden
            personId={personId}
            personName={personName}
            onSchliessen={() => setAusscheidenOffen(false)}
          />
        </section>
      ) : (
        <Button
          variant="ghost"
          data-testid="ablauf-oeffnen"
          onClick={() => setAusscheidenOffen(true)}
        >
          {t("uebergabeablauf.oeffnen")}
        </Button>
      )}
      <LetzteBilanz personId={personId} personName={personName} />
    </section>
  );
}

/** Ein Eintrag der Liste: Beitrag oder offener Vorgang. */
interface Zeile {
  schluessel: string;
  art: EintragArt;
  id: string;
  titel: string | null;
  /** Die Konten, die diesen Eintrag übernehmen dürfen (soweit die Oberfläche es wissen kann). */
  zulaessig: readonly string[];
}

/** Eine Antwort zusammen mit der Eingabe, für die sie gilt. */
interface Mit<T> {
  eingabe: AblaufEingabe;
  daten: T;
}

const schluesselVon = (art: EintragArt, id: string): string => `${art}:${id}`;

function BilanzZeile({ bilanz, testId }: { bilanz: Bilanz; testId: string }): JSX.Element {
  const { t } = useTranslation();
  return (
    <span
      data-testid={testId}
      data-beitraege={bilanz.beitraege}
      data-entwuerfe={bilanz.entwuerfe}
      data-luecken={bilanz.luecken}
      data-pruefaufgaben={bilanz.pruefaufgaben}
    >
      {t("uebergabeablauf.bilanz", { ...bilanz })}
    </span>
  );
}

function Ausscheiden({
  personId,
  personName,
  onSchliessen,
}: {
  personId: string;
  personName: string;
  onSchliessen: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const zugangName = useId();
  const bestand = useQuery({
    queryKey: ["verantwortung", "person", personId],
    queryFn: () => verantwortungApi.bestand(personId),
  });
  const vorgaenge = useQuery({
    queryKey: ["verantwortung", "vorgaenge", personId],
    queryFn: () => verantwortungApi.vorgaenge(personId),
  });
  const [plan, setPlan] = useState<ReadonlyMap<string, string>>(new Map());
  const [auswahl, setAuswahl] = useState<ReadonlySet<string>>(new Set());
  const [ziel, setZiel] = useState("");
  const [zugang, setZugang] = useState<Zugangsentscheidung>("behalten");
  // Die Vorschau trägt die Eingabe, für die sie gilt. Bestätigt wird GENAU diese — ändert sich der
  // Plan oder die Zugangsentscheidung danach, verfällt sie.
  const [vorschau, setVorschau] = useState<Mit<AblaufVorschau> | null>(null);
  const [ergebnis, setErgebnis] = useState<Mit<AblaufErgebnis> | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);

  const neuLaden = (): void => {
    for (const schluessel of [["verantwortung"], ["users"], ["audit"]]) {
      void qc.invalidateQueries({ queryKey: schluessel });
    }
  };
  const fehlertext = (e: unknown): string =>
    t("uebergabeablauf.fehler", {
      meldung: e instanceof ApiError ? e.message : t("state.error"),
    });

  const vorschauHolen = useMutation({
    mutationFn: (eingabe: AblaufEingabe) => verantwortungApi.ablaufVorschau(eingabe),
    onSuccess: (daten, eingabe) => {
      setVorschau({ eingabe, daten });
      setErgebnis(null);
      setMeldung(null);
    },
    onError: (e) => setMeldung(fehlertext(e)),
  });
  const ausfuehren = useMutation({
    mutationFn: (eingabe: AblaufEingabe) => verantwortungApi.ablauf(eingabe),
    onSuccess: (daten, eingabe) => {
      setErgebnis({ eingabe, daten });
      setVorschau(null);
      setMeldung(null);
      // Übertragene und schon erledigte Einträge verlassen den Plan; offene bleiben stehen.
      const fertig = new Set(
        [...daten.uebertragen, ...daten.bereitsErledigt].map((z) => schluesselVon(z.art, z.id)),
      );
      setPlan((alt) => new Map([...alt].filter(([k]) => !fertig.has(k))));
      setAuswahl(new Set());
      neuLaden();
    },
    onError: (e) => {
      // 409: der Server hat die Vorschau neu geurteilt und NICHTS geschrieben — er nennt warum.
      const neu = e instanceof ApiError ? e.details.vorschau : undefined;
      if (neu && typeof neu === "object" && vorschau) {
        setVorschau({ eingabe: vorschau.eingabe, daten: neu as AblaufVorschau });
      }
      setMeldung(fehlertext(e));
      // Ohne Antwort ist offen, was geschrieben wurde — der Stand kommt neu vom Server.
      neuLaden();
    },
  });
  const beschaeftigt = vorschauHolen.isPending || ausfuehren.isPending;

  if (bestand.isPending || vorgaenge.isPending) {
    return <p className="text-[12.5px] text-muted-2">{t("uebergabeablauf.laedt")}</p>;
  }
  if (bestand.isError || vorgaenge.isError) {
    return (
      <div className="space-y-2" data-testid="ablauf-ladefehler">
        <p role="alert" className="text-[12.5px] text-trust-crit-text">
          {t("uebergabeablauf.ladefehler")}
        </p>
        <Button variant="ghost" onClick={onSchliessen}>
          {t("uebergabeablauf.abbrechen")}
        </Button>
      </div>
    );
  }
  const b = bestand.data;
  const v = vorgaenge.data;
  const alleZiele = b.ziele.map((k) => k.id);
  // Prüfaufgaben: nur, wer prüfen darf — das ist genau die Vertretung (aktiv, `ko.validate`). Das
  // Leserecht am Objekt urteilt der Server in der Vorschau.
  const pruefer = new Set(b.vertretung.map((k) => k.id));
  const zeilen: Zeile[] = [
    ...b.beitraege.map((z) => ({
      schluessel: schluesselVon("beitrag", z.koId),
      art: "beitrag" as const,
      id: z.koId,
      titel: z.titel,
      zulaessig: z.zulaessig,
    })),
    ...v.entwuerfe.map((d) => ({
      schluessel: schluesselVon("entwurf", d.id),
      art: "entwurf" as const,
      id: d.id,
      titel: null,
      zulaessig: alleZiele,
    })),
    ...v.luecken.map((l) => ({
      schluessel: schluesselVon("luecke", l.id),
      art: "luecke" as const,
      id: l.id,
      titel: null,
      zulaessig: alleZiele,
    })),
    ...v.pruefaufgaben.map((p) => ({
      schluessel: schluesselVon("pruefaufgabe", p.koId),
      art: "pruefaufgabe" as const,
      id: p.koId,
      titel: p.titel,
      zulaessig: alleZiele.filter((id) => pruefer.has(id)),
    })),
  ];
  const name = b.person.name ?? personName;
  const nameVon = (id: string): string =>
    b.ziele.find((k) => k.id === id)?.name ?? t("uebergabeablauf.unbekannt");
  const beschriftung = (art: EintragArt, id: string, titel: string | null): string =>
    titel ??
    (art === "entwurf" || art === "luecke"
      ? t("uebergabeablauf.nurKennung", { id })
      : t("uebergabeablauf.verborgen", { id }));

  const planSetzen = (naechster: ReadonlyMap<string, string>): void => {
    setPlan(naechster);
    setVorschau(null);
  };
  const unzugeteilt = zeilen.filter((z) => !plan.has(z.schluessel)).map((z) => z.schluessel);
  const paket = auswahl.size > 0 ? [...auswahl] : unzugeteilt;
  const zulaessigFuer = (schluessel: readonly string[]) =>
    b.ziele.filter((k) =>
      schluessel.every(
        (s) => zeilen.find((z) => z.schluessel === s)?.zulaessig.includes(k.id) ?? false,
      ),
    );
  const angeboten = zulaessigFuer(paket);
  const gewaehlt = angeboten.some((k) => k.id === ziel) ? ziel : "";
  const restZulaessig =
    gewaehlt !== "" && zulaessigFuer(unzugeteilt).some((k) => k.id === gewaehlt);
  const zuteilen = (schluessel: readonly string[]): void => {
    if (!gewaehlt || schluessel.length === 0) {
      return;
    }
    const naechster = new Map(plan);
    for (const s of schluessel) {
      naechster.set(s, gewaehlt);
    }
    planSetzen(naechster);
    setAuswahl(new Set());
  };
  const eingabe = (): AblaufEingabe => {
    const raus: AblaufEingabe = {
      person: personId,
      umfang: "ausscheiden",
      beitraege: [],
      vorgaenge: [],
      zugang,
    };
    for (const z of zeilen) {
      const an = plan.get(z.schluessel);
      if (!an) {
        continue;
      }
      if (z.art === "beitrag") {
        raus.beitraege.push({ koId: z.id, an });
      } else {
        raus.vorgaenge.push({ art: z.art, id: z.id, an });
      }
    }
    return raus;
  };
  const abbrechen = (): void => {
    // Vor dem Bestätigen wurde nichts geschrieben — Abbrechen verwirft nur den Plan.
    setPlan(new Map());
    setAuswahl(new Set());
    setVorschau(null);
    onSchliessen();
  };
  const vd = vorschau?.daten;
  const er = ergebnis?.daten;
  const zugangText = (stand: string): string => t(`uebergabe.zugang.${stand}`);

  return (
    <div className="space-y-3" data-testid="ablauf-flaeche">
      <p className="text-[13px] text-text" data-testid="ablauf-bestand" data-anzahl={zeilen.length}>
        {zeilen.length === 0
          ? t("uebergabeablauf.leer", { name })
          : t("uebergabeablauf.bestand", { name, anzahl: zeilen.length })}{" "}
        <span className="text-muted-2">· {zugangText(b.person.zugang)}</span>
      </p>

      {zeilen.length > 0 ? (
        <>
          <p className="text-[12px] text-muted-2">{t("uebergabeablauf.planHinweis")}</p>
          <ul className="space-y-1.5" aria-label={t("uebergabeablauf.titel")}>
            {zeilen.map((z) => {
              const an = plan.get(z.schluessel);
              const text = beschriftung(z.art, z.id, z.titel);
              return (
                <li
                  key={z.schluessel}
                  data-testid="ablauf-zeile"
                  data-art={z.art}
                  data-id={z.id}
                  className="flex items-start gap-2 rounded-input bg-page px-2 py-1.5"
                >
                  <input
                    type="checkbox"
                    data-testid="ablauf-auswahl"
                    aria-label={`${t(`uebergabeablauf.art.${z.art}`)}: ${text}`}
                    checked={auswahl.has(z.schluessel)}
                    onChange={(e) => {
                      const naechste = new Set(auswahl);
                      if (e.target.checked) {
                        naechste.add(z.schluessel);
                      } else {
                        naechste.delete(z.schluessel);
                      }
                      setAuswahl(naechste);
                    }}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1 break-words text-[12.5px]">
                    <span className="text-muted-2">{t(`uebergabeablauf.art.${z.art}`)} · </span>
                    <span className="text-text">{text}</span>
                    {an ? (
                      <div className="text-trust-pos-text" data-testid="ablauf-zugeteilt">
                        {t("uebergabeablauf.zugeteilt", { name: nameVon(an) })}{" "}
                        <button
                          type="button"
                          className="underline"
                          onClick={() => {
                            const naechster = new Map(plan);
                            naechster.delete(z.schluessel);
                            planSetzen(naechster);
                          }}
                        >
                          {t("uebergabeablauf.loesen")}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-[12px] text-muted-2" data-testid="ablauf-stand">
            {t("uebergabeablauf.stand", { zugeteilt: plan.size, gesamt: zeilen.length })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {angeboten.length === 0 ? (
              <p className="text-[12px] text-muted-2" data-testid="ablauf-kein-ziel">
                {t("uebergabeablauf.keinZiel")}
              </p>
            ) : (
              <select
                data-testid="ablauf-ziel"
                aria-label={t("uebergabeablauf.ziel")}
                value={gewaehlt}
                onChange={(e) => setZiel(e.target.value)}
                className="h-9 max-w-full rounded-input border border-hairline bg-surface px-2 text-[13px]"
              >
                <option value="">{t("uebergabeablauf.zielWaehlen")}</option>
                {angeboten.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            )}
            <Button
              variant="ghost"
              data-testid="ablauf-zuteilen"
              disabled={!gewaehlt || auswahl.size === 0}
              onClick={() => zuteilen([...auswahl])}
            >
              {t("uebergabeablauf.auswahlZuteilen", { anzahl: auswahl.size })}
            </Button>
            <Button
              variant="ghost"
              data-testid="ablauf-rest"
              disabled={!restZulaessig || unzugeteilt.length === 0}
              onClick={() => zuteilen(unzugeteilt)}
            >
              {t("uebergabeablauf.restZuteilen")}
            </Button>
          </div>
        </>
      ) : null}

      <fieldset
        className="space-y-1.5 rounded-input border border-hairline p-2"
        data-testid="ablauf-zugang"
      >
        <legend className="px-1 text-[12.5px] font-medium text-text">
          {t("uebergabeablauf.zugang.titel")}
        </legend>
        <p className="text-[12px] text-muted-2" data-testid="ablauf-zugang-beenden-erklaerung">
          {t("uebergabeablauf.zugang.beendenErklaerung")}
        </p>
        <p className="text-[12px] text-muted-2" data-testid="ablauf-zugang-sperren-erklaerung">
          {t("uebergabeablauf.zugang.sperrenErklaerung")}
        </p>
        <p className="text-[12px] text-text" data-testid="ablauf-vertretung">
          {b.vertretung.length > 0
            ? t("uebergabeablauf.zugang.vertretung", {
                namen: b.vertretung.map((k) => k.name).join(", "),
              })
            : t("uebergabeablauf.zugang.vertretungNiemand")}
        </p>
        {(["behalten", "beenden"] as const).map((wahl) => (
          <label key={wahl} className="flex items-center gap-2 text-[12.5px] text-text">
            <input
              type="radio"
              name={zugangName}
              value={wahl}
              data-testid={`ablauf-zugang-${wahl}`}
              checked={zugang === wahl}
              onChange={() => {
                setZugang(wahl);
                setVorschau(null);
              }}
            />
            {t(`uebergabeablauf.zugang.${wahl}`)}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          data-testid="ablauf-vorschau-holen"
          disabled={beschaeftigt}
          onClick={() => vorschauHolen.mutate(eingabe())}
        >
          {t("uebergabeablauf.vorschau")}
        </Button>
        {plan.size > 0 ? (
          <Button
            variant="ghost"
            data-testid="ablauf-verwerfen"
            disabled={beschaeftigt}
            onClick={() => {
              planSetzen(new Map());
              setAuswahl(new Set());
            }}
          >
            {t("uebergabeablauf.verwerfen")}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          data-testid="ablauf-abbrechen"
          disabled={beschaeftigt}
          onClick={abbrechen}
        >
          {t("uebergabeablauf.abbrechen")}
        </Button>
      </div>
      <p className="text-[12px] text-muted-2">{t("uebergabeablauf.abbrechenHinweis")}</p>

      {vorschau && vd ? (
        <div
          data-testid="ablauf-vorschau"
          data-bestaetigbar={vd.bestaetigbar ? "ja" : "nein"}
          className="space-y-2 rounded-input bg-page p-2 text-[12.5px]"
        >
          <div className="font-semibold text-text">{t("uebergabeablauf.vorschauTitel")}</div>
          <ul className="space-y-2">
            {vd.pakete.map((p) => (
              <li key={p.an.id} data-testid="ablauf-paket" data-an={p.an.id} data-anzahl={p.anzahl}>
                <div className="font-medium text-text">
                  {t("uebergabeablauf.paket", {
                    name: p.an.name ?? t("uebergabeablauf.unbekannt"),
                    anzahl: p.anzahl,
                  })}
                  {p.bereitsErledigt > 0 ? (
                    <span className="text-muted-2">
                      {" · "}
                      {t("uebergabeablauf.paketErledigt", { anzahl: p.bereitsErledigt })}
                    </span>
                  ) : null}
                </div>
                <ul className="list-disc pl-5 text-muted-2">
                  {p.eintraege.map((x) => (
                    <li key={schluesselVon(x.art, x.id)} data-art={x.art} className="break-words">
                      {t(`uebergabeablauf.art.${x.art}`)}: {beschriftung(x.art, x.id, x.titel)}
                    </li>
                  ))}
                </ul>
                <ul className="text-text" data-testid="ablauf-rechtewirkung">
                  {(["beitrag", "entwurf", "luecke", "pruefaufgabe"] as const)
                    .filter((art) => p.wirkung[art] > 0)
                    .map((art) => (
                      <li key={art} data-wirkung={art}>
                        {t(`uebergabeablauf.wirkung.${art}`, { anzahl: p.wirkung[art] })}
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="text-muted-2" data-testid="ablauf-unveraendert">
            {t("uebergabeablauf.unveraendert")}
          </p>
          {vd.abgelehnt.length > 0 ? (
            <div data-testid="ablauf-abgelehnt" className="text-trust-crit-text">
              <div>{t("uebergabeablauf.abgelehnt", { anzahl: vd.abgelehnt.length })}</div>
              <ul className="list-disc pl-5">
                {vd.abgelehnt.map((x) => (
                  <li key={schluesselVon(x.art, x.id)} data-grund={x.grund} className="break-words">
                    {t(`uebergabeablauf.art.${x.art}`)} {beschriftung(x.art, x.id, x.titel)} →{" "}
                    {x.anName ?? t("uebergabeablauf.unbekannt")}: {x.text}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {vd.nichtZugeteilt.length > 0 ? (
            <div data-testid="ablauf-nicht-zugeteilt" className="text-text">
              <div>{t("uebergabeablauf.nichtZugeteilt", { anzahl: vd.nichtZugeteilt.length })}</div>
              <ul className="list-disc pl-5 text-muted-2">
                {vd.nichtZugeteilt.map((x) => (
                  <li key={schluesselVon(x.art, x.id)} className="break-words">
                    {t(`uebergabeablauf.art.${x.art}`)}: {beschriftung(x.art, x.id, x.titel)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-muted-2" data-testid="ablauf-ausgeschlossen">
            {t("uebergabeablauf.ausgeschlossen", {
              entwuerfe: vd.ausgeschlossen.entwuerfe.length,
              luecken: vd.ausgeschlossen.luecken.length,
              pruefaufgaben: vd.ausgeschlossen.pruefaufgaben.length,
            })}
          </p>
          <div className="text-text">
            {t("uebergabeablauf.bilanzVorher", { name })}{" "}
            <BilanzZeile bilanz={vd.vorher} testId="ablauf-vorher" />
          </div>
          <div className="text-text">
            {t("uebergabeablauf.bilanzPlan", { name })}{" "}
            <BilanzZeile bilanz={vd.prognose} testId="ablauf-prognose" />
          </div>
          <div className="text-text" data-testid="ablauf-zugang-plan">
            {t("uebergabeablauf.zugangPlan", {
              jetzt: zugangText(vd.zugang.jetzt),
              danach: zugangText(vd.zugang.danach),
            })}
          </div>
          {vd.hindernisse.length > 0 ? (
            <ul data-testid="ablauf-hindernisse" className="text-trust-crit-text">
              {vd.hindernisse.map((h) => (
                <li key={h} data-hindernis={h}>
                  {t(`uebergabeablauf.hindernis.${h}`)}
                </li>
              ))}
            </ul>
          ) : null}
          <Button
            variant="primary"
            data-testid="ablauf-bestaetigen"
            disabled={beschaeftigt || !vd.bestaetigbar}
            onClick={() => ausfuehren.mutate(vorschau.eingabe)}
          >
            {t("uebergabeablauf.bestaetigen")}
          </Button>
        </div>
      ) : null}

      {ergebnis && er ? (
        <div
          data-testid="ablauf-ergebnis"
          data-vollstaendig={er.vollstaendig ? "ja" : "nein"}
          className="space-y-1 rounded-input bg-page p-2 text-[12.5px]"
        >
          <div
            role={er.vollstaendig ? undefined : "alert"}
            className={er.vollstaendig ? "text-trust-pos-text" : "text-trust-crit-text"}
          >
            {er.vollstaendig
              ? t("uebergabeablauf.ergebnisVoll", { anzahl: er.uebertragen.length })
              : t("uebergabeablauf.ergebnisTeil", {
                  uebertragen: er.uebertragen.length,
                  offen: er.offen.length,
                })}
          </div>
          {er.bereitsErledigt.length > 0 ? (
            <div className="text-muted-2">
              {t("uebergabeablauf.ergebnisErledigt", { anzahl: er.bereitsErledigt.length })}
            </div>
          ) : null}
          {er.uebertragen.length > 0 ? (
            <ul data-testid="ablauf-uebertragen" className="list-disc pl-5 text-muted-2">
              {er.uebertragen.map((x) => (
                <li
                  key={schluesselVon(x.art, x.id)}
                  data-art={x.art}
                  data-id={x.id}
                  className="break-words"
                >
                  {t(`uebergabeablauf.art.${x.art}`)}: {beschriftung(x.art, x.id, x.titel)} →{" "}
                  {x.anName ?? t("uebergabeablauf.unbekannt")}
                </li>
              ))}
            </ul>
          ) : null}
          {er.offen.length > 0 ? (
            <ul data-testid="ablauf-offen" className="list-disc pl-5 text-trust-crit-text">
              {er.offen.map((x) => (
                <li
                  key={schluesselVon(x.art, x.id)}
                  data-art={x.art}
                  data-id={x.id}
                  data-grund={x.grund}
                  className="break-words"
                >
                  {t(`uebergabeablauf.art.${x.art}`)}: {beschriftung(x.art, x.id, x.titel)} —{" "}
                  {x.text}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="text-text">
            {t("uebergabeablauf.bilanzVorher", { name })}{" "}
            <BilanzZeile bilanz={er.vorher} testId="ablauf-ergebnis-vorher" />
          </div>
          <div className="text-text">
            {t("uebergabeablauf.bilanzNachher", { name })}{" "}
            <BilanzZeile bilanz={er.nachher} testId="ablauf-ergebnis-nachher" />
          </div>
          <div
            className="text-text"
            data-testid="ablauf-ergebnis-zugang"
            data-zugang={er.zugang.nachher}
          >
            {er.zugang.beendet
              ? t("uebergabeablauf.zugangBeendet", { stand: zugangText(er.zugang.nachher) })
              : t("uebergabeablauf.zugangUnveraendert", { stand: zugangText(er.zugang.nachher) })}
            {er.zugang.grund ? ` ${er.zugang.grund}` : null}
          </div>
          <div className="text-muted-2">
            {er.protokolliert
              ? t("uebergabeablauf.protokolliert")
              : t("uebergabeablauf.nichtProtokolliert")}
          </div>
          {er.vollstaendig ? null : (
            <Button
              variant="outline"
              data-testid="ablauf-wiederaufnehmen"
              disabled={beschaeftigt}
              onClick={() => ausfuehren.mutate(ergebnis.eingabe)}
            >
              {t("uebergabeablauf.wiederaufnehmen")}
            </Button>
          )}
        </div>
      ) : null}

      {meldung ? (
        <p role="alert" data-testid="ablauf-meldung" className="text-[12.5px] text-trust-crit-text">
          {meldung}
        </p>
      ) : null}
    </div>
  );
}

/** Die jüngste Abschlussbilanz dieses Kontos — aus dem Prüfprotokoll, also auch nach Reload. */
function LetzteBilanz({
  personId,
  personName,
}: {
  personId: string;
  personName: string;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const ablaeufe = useQuery({
    queryKey: ["verantwortung", "ablaeufe", personId],
    queryFn: () => verantwortungApi.ablaeufe(personId),
  });
  const letzte = ablaeufe.data?.ablaeufe[0];
  return (
    <div data-testid="ablauf-letzte-bilanz" className="space-y-0.5 text-[12px]">
      <div className="font-medium text-muted">{t("uebergabeablauf.letzte.titel")}</div>
      {ablaeufe.data === undefined ? (
        <p className="text-muted-2">
          {ablaeufe.isError ? t("uebergabeablauf.letzte.nichtAbrufbar") : t("state.loading")}
        </p>
      ) : !letzte ? (
        <p className="text-muted-2">{t("uebergabeablauf.letzte.keine")}</p>
      ) : (
        <div data-seq={letzte.seq} data-vollstaendig={letzte.vollstaendig ? "ja" : "nein"}>
          <div className="text-text">
            {t("uebergabeablauf.letzte.kopf", {
              datum: new Date(letzte.at).toLocaleString(i18n.language),
              umfang: t(`uebergabeablauf.letzte.umfang.${letzte.umfang}`),
              name: letzte.actor.name ?? t("uebergabeablauf.unbekannt"),
            })}
          </div>
          <div className="text-muted-2">
            {t("uebergabeablauf.bilanzVorher", { name: personName })}{" "}
            <BilanzZeile bilanz={letzte.vorher} testId="ablauf-letzte-vorher" />
          </div>
          <div className="text-muted-2">
            {t("uebergabeablauf.bilanzNachher", { name: personName })}{" "}
            <BilanzZeile bilanz={letzte.nachher} testId="ablauf-letzte-nachher" />
          </div>
          <ul className="text-muted-2">
            {letzte.nachfolger.map((n) => (
              <li key={n.an}>
                {t("uebergabeablauf.letzte.nachfolger", {
                  name: n.name ?? t("uebergabeablauf.unbekannt"),
                  beitraege: n.beitraege,
                  vorgaenge: n.vorgaenge,
                })}
              </li>
            ))}
          </ul>
          {letzte.offen.length > 0 ? (
            <div className="text-trust-crit-text">
              {t("uebergabeablauf.letzte.offen", { anzahl: letzte.offen.length })}
            </div>
          ) : null}
          <div className="text-muted-2" data-zugang={letzte.zugang.nachher}>
            {t("uebergabeablauf.zugangPlan", {
              jetzt: t(`uebergabe.zugang.${letzte.zugang.vorher}`),
              danach: t(`uebergabe.zugang.${letzte.zugang.nachher}`),
            })}
          </div>
        </div>
      )}
    </div>
  );
}
