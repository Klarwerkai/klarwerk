// ================================================================================================
// HAUPTVERANTWORTUNG ÜBERGEBEN — der Bereich in der Kontokarte (`pages/AdminKontenDetails.tsx`).
// ================================================================================================
//
// Auftrag `produkt:20261007:ownership-uebergabe`. Der Weg, wie ihn die Kontoverwaltung geht:
//   1. Bestand der Person sehen — je Beitrag Autorschaft, Verantwortungsart und Mitwirkung getrennt.
//   2. Beiträge anhaken, Nachfolger wählen, zuteilen; für weitere Nachfolger wiederholen (Pakete).
//   3. Vorschau: je Nachfolger Anzahl und Beiträge, jede nicht übertragbare Zeile mit Grund.
//   4. Übergabe ausführen — genau die Zuteilung, deren Vorschau zuletzt angezeigt wurde. Bleibt etwas
//      offen, steht es mit Grund da, und „Offene erneut übertragen" holt genau diesen Rest nach.
//   5. Optional: übergeben und Zugang beenden — nur, wenn danach nichts mehr bei der Person liegt.
//
// GESCHLOSSEN, BIS JEMAND ÖFFNET: der Bereich lädt nichts, solange er eingeklappt ist. Die Kontokarte
// bleibt damit genau so schnell und so still wie vorher.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import {
  type Uebergabeergebnis,
  type Vorschau,
  type Zuteilung,
  verantwortungApi,
} from "../api/verantwortung";
import { Button } from "./ui";

export function VerantwortungUebergabe({
  personId,
  personName,
}: {
  personId: string;
  personName: string;
}): JSX.Element {
  const { t } = useTranslation();
  const [offen, setOffen] = useState(false);
  return (
    <div data-testid="verantwortung-bereich" className="space-y-2 border-t border-hairline pt-4">
      <div className="text-[12.5px] font-medium text-muted">{t("uebergabe.titel")}</div>
      {offen ? (
        <Arbeitsflaeche
          personId={personId}
          personName={personName}
          onEinklappen={() => setOffen(false)}
        />
      ) : (
        <Button variant="ghost" data-testid="verantwortung-oeffnen" onClick={() => setOffen(true)}>
          {t("uebergabe.oeffnen")}
        </Button>
      )}
    </div>
  );
}

function Arbeitsflaeche({
  personId,
  personName,
  onEinklappen,
}: {
  personId: string;
  personName: string;
  onEinklappen: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  // Der Bestand, um den es geht: die Person dieser Karte — oder ein anderer Bestand ohne aktive
  // Hauptverantwortung (etwa eines gelöschten Kontos), der von hier aus übergeben werden kann.
  const [von, setVon] = useState(personId);
  const bestand = useQuery({
    queryKey: ["verantwortung", "person", von],
    queryFn: () => verantwortungApi.bestand(von),
  });
  const ungeklaert = useQuery({
    queryKey: ["verantwortung", "ungeklaert"],
    queryFn: () => verantwortungApi.ungeklaert(),
  });
  const [plan, setPlan] = useState<ReadonlyMap<string, string>>(new Map());
  const [auswahl, setAuswahl] = useState<ReadonlySet<string>>(new Set());
  const [ziel, setZiel] = useState("");
  // Die Vorschau trägt die Zuteilung, für die sie gilt. Ausgeführt wird GENAU diese — ändert sich
  // der Plan danach, verfällt die Vorschau und muss neu geholt werden.
  const [vorschau, setVorschau] = useState<{ plan: Zuteilung[]; daten: Vorschau } | null>(null);
  const [ergebnis, setErgebnis] = useState<Uebergabeergebnis | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);

  const neuLaden = (): void => {
    void qc.invalidateQueries({ queryKey: ["verantwortung"] });
    void qc.invalidateQueries({ queryKey: ["users"] });
  };
  const fehlertext = (e: unknown): string =>
    t("uebergabe.fehler", { meldung: e instanceof ApiError ? e.message : t("state.error") });
  const planSetzen = (naechster: ReadonlyMap<string, string>): void => {
    setPlan(naechster);
    setVorschau(null);
  };
  /** Übergebene und bereits erledigte Zeilen verlassen den Plan; offene bleiben stehen. */
  const erledigteEntfernen = (e: Uebergabeergebnis): void => {
    const fertig = new Set([...e.uebertragen, ...e.bereitsErledigt].map((z) => z.koId));
    setPlan((alt) => new Map([...alt].filter(([koId]) => !fertig.has(koId))));
    setAuswahl(new Set());
    setVorschau(null);
  };
  const wechsleZu = (id: string): void => {
    setVon(id);
    setPlan(new Map());
    setAuswahl(new Set());
    setZiel("");
    setVorschau(null);
    setErgebnis(null);
    setMeldung(null);
  };

  const vorschauHolen = useMutation({
    mutationFn: (z: Zuteilung[]) => verantwortungApi.vorschau(von, z),
    onSuccess: (daten, z) => {
      setVorschau({ plan: z, daten });
      setErgebnis(null);
      setMeldung(null);
    },
    onError: (e) => setMeldung(fehlertext(e)),
  });
  const uebergeben = useMutation({
    mutationFn: (z: Zuteilung[]) => verantwortungApi.uebergabe(von, z),
    onSuccess: (e) => {
      setErgebnis(e);
      setMeldung(null);
      erledigteEntfernen(e);
      neuLaden();
    },
    // Ein Fehler ohne Antwort sagt nichts darüber, was geschrieben wurde — der Stand kommt neu.
    onError: (e) => {
      setMeldung(fehlertext(e));
      neuLaden();
    },
  });
  const deaktivieren = useMutation({
    mutationFn: (z: Zuteilung[]) => verantwortungApi.deaktivieren(von, z),
    onSuccess: (d) => {
      if (d.uebergabe) {
        setErgebnis(d.uebergabe);
        erledigteEntfernen(d.uebergabe);
      }
      setMeldung(d.bereitsInaktiv ? t("uebergabe.bereitsInaktiv") : t("uebergabe.deaktiviert"));
      neuLaden();
    },
    onError: (e) => {
      const teil = e instanceof ApiError ? e.details.uebergabe : undefined;
      if (teil && typeof teil === "object") {
        setErgebnis(teil as Uebergabeergebnis);
        erledigteEntfernen(teil as Uebergabeergebnis);
      }
      setMeldung(fehlertext(e));
      neuLaden();
    },
  });
  const beschaeftigt = vorschauHolen.isPending || uebergeben.isPending || deaktivieren.isPending;

  if (bestand.isPending) {
    return <p className="text-[12.5px] text-muted-2">{t("uebergabe.laedt")}</p>;
  }
  if (bestand.isError) {
    return (
      <div className="space-y-2">
        <p className="text-[12.5px] text-trust-crit-text">{t("uebergabe.ladefehler")}</p>
        <Button variant="ghost" onClick={onEinklappen}>
          {t("uebergabe.einklappen")}
        </Button>
      </div>
    );
  }
  const b = bestand.data;
  const name = b.person.name ?? t("uebergabe.geloeschtesKonto");
  const nameVon = (id: string): string =>
    b.ziele.find((z) => z.id === id)?.name ?? t("uebergabe.unbekannt");
  const unzugeteilt = b.beitraege.filter((z) => !plan.has(z.koId)).map((z) => z.koId);
  // Nacharbeit 2 (Ben K2): wählbar ist nur, wer für JEDEN Beitrag des Pakets zulässig ist — das
  // Paket sind die angehakten Beiträge, ohne Auswahl alle noch nicht zugeteilten. Die Zulässigkeit
  // je Beitrag urteilt der Server (`zulaessig`); er prüft bei Vorschau und Ausführung erneut.
  const zulaessigFuer = (ids: readonly string[]) =>
    b.ziele.filter((k) =>
      ids.every((id) => b.beitraege.find((z) => z.koId === id)?.zulaessig.includes(k.id) ?? false),
    );
  const paket = auswahl.size > 0 ? [...auswahl] : unzugeteilt;
  const angeboten = zulaessigFuer(paket);
  // Eine Wahl, die für das jetzige Paket nicht (mehr) zulässig ist, gilt nicht.
  const gewaehlt = angeboten.some((k) => k.id === ziel) ? ziel : "";
  const restZulaessig =
    gewaehlt !== "" && zulaessigFuer(unzugeteilt).some((k) => k.id === gewaehlt);
  const zuteilen = (ids: readonly string[]): void => {
    if (!gewaehlt || ids.length === 0) {
      return;
    }
    const naechster = new Map(plan);
    for (const id of ids) {
      naechster.set(id, gewaehlt);
    }
    planSetzen(naechster);
    setAuswahl(new Set());
  };
  const zuteilung = (): Zuteilung[] => [...plan].map(([koId, an]) => ({ koId, an }));
  const andere = (ungeklaert.data?.personen ?? []).filter((p) => p.id !== von && p.anzahl > 0);
  const offeneFehler = ergebnis?.fehlgeschlagen ?? [];
  // Nur die gescheiterten Zeilen — abgelehnte brauchen erst eine andere Zuteilung.
  const erneut: Zuteilung[] = offeneFehler.map((x) => ({ koId: x.koId, an: x.an }));
  const offeneZeilen = ergebnis ? [...ergebnis.fehlgeschlagen, ...ergebnis.abgelehnt] : [];

  return (
    <div className="space-y-3" data-testid="verantwortung-flaeche" data-von={von}>
      <div className="text-[13px] text-text" data-testid="verantwortung-stand">
        {b.anzahl === 0
          ? t("uebergabe.leer", { name })
          : t("uebergabe.anzahl", { name, anzahl: b.anzahl })}{" "}
        <span className="text-muted-2">· {t(`uebergabe.zugang.${b.person.zugang}`)}</span>
      </div>
      {b.nichtEinsehbar > 0 ? (
        <p className="text-[12px] text-muted-2">
          {t("uebergabe.nichtEinsehbar", { anzahl: b.nichtEinsehbar })}
        </p>
      ) : null}
      <p className="text-[12px] text-muted-2" data-testid="verantwortung-vertretung">
        {b.vertretung.length > 0
          ? t("uebergabe.vertretung", { namen: b.vertretung.map((v) => v.name).join(", ") })
          : t("uebergabe.vertretungNiemand")}
      </p>
      {von !== personId ? (
        <Button variant="ghost" onClick={() => wechsleZu(personId)}>
          {t("uebergabe.zurueckZurPerson", { name: personName })}
        </Button>
      ) : null}

      {b.beitraege.length > 0 ? (
        <ul className="space-y-1.5">
          {b.beitraege.map((z) => {
            const an = plan.get(z.koId);
            const titel = z.titel ?? t("uebergabe.verborgen");
            const unbekannt = t("uebergabe.unbekannt");
            const angaben = [
              z.status,
              z.imPapierkorb ? t("uebergabe.papierkorb") : null,
              z.spaceName,
              t("uebergabe.autor", { name: z.autor.name ?? unbekannt }),
              t("uebergabe.ursprung", { name: z.ursprungsautor.name ?? unbekannt }),
              z.verantwortungsart === "author-fallback" ? t("uebergabe.ersatz") : null,
              z.mitwirkende > 0 ? t("uebergabe.mitwirkende", { anzahl: z.mitwirkende }) : null,
            ];
            return (
              <li
                key={z.koId}
                data-testid="verantwortung-zeile"
                data-ko={z.koId}
                className="flex flex-wrap items-start gap-2 rounded-input bg-page px-2 py-1.5"
              >
                <input
                  type="checkbox"
                  data-testid="verantwortung-auswahl"
                  aria-label={titel}
                  checked={auswahl.has(z.koId)}
                  onChange={(e) => {
                    const naechste = new Set(auswahl);
                    if (e.target.checked) {
                      naechste.add(z.koId);
                    } else {
                      naechste.delete(z.koId);
                    }
                    setAuswahl(naechste);
                  }}
                />
                <div className="min-w-0 flex-1 text-[12.5px]">
                  <div className="font-medium text-text">{titel}</div>
                  <div className="text-muted-2">{angaben.filter((teil) => teil).join(" · ")}</div>
                  {an ? (
                    <div className="text-trust-pos-text" data-testid="verantwortung-zugeteilt">
                      {t("uebergabe.zugeteilt", { name: nameVon(an) })}{" "}
                      <button
                        type="button"
                        className="underline"
                        onClick={() => {
                          const naechster = new Map(plan);
                          naechster.delete(z.koId);
                          planSetzen(naechster);
                        }}
                      >
                        {t("uebergabe.loesen")}
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {b.beitraege.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {b.ziele.length === 0 ? (
            <p className="text-[12px] text-muted-2">{t("uebergabe.keinZiel")}</p>
          ) : angeboten.length === 0 ? (
            <p className="text-[12px] text-muted-2" data-testid="verantwortung-kein-gemeinsames">
              {t("uebergabe.keinGemeinsamesZiel")}
            </p>
          ) : (
            <select
              data-testid="verantwortung-ziel"
              aria-label={t("uebergabe.ziel")}
              value={gewaehlt}
              onChange={(e) => setZiel(e.target.value)}
              className="h-9 rounded-input border border-hairline bg-surface px-2 text-[13px]"
            >
              <option value="">{t("uebergabe.zielWaehlen")}</option>
              {angeboten.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          )}
          <Button
            variant="ghost"
            data-testid="verantwortung-zuteilen"
            disabled={!gewaehlt || auswahl.size === 0}
            onClick={() => zuteilen([...auswahl])}
          >
            {t("uebergabe.auswahlZuteilen", { anzahl: auswahl.size })}
          </Button>
          <Button
            variant="ghost"
            data-testid="verantwortung-rest"
            disabled={!restZulaessig || unzugeteilt.length === 0}
            onClick={() => zuteilen(unzugeteilt)}
          >
            {t("uebergabe.restZuteilen")}
          </Button>
        </div>
      ) : null}

      {b.beitraege.length > 0 && plan.size === 0 ? (
        <p className="text-[12px] text-muted-2">{t("uebergabe.planLeer")}</p>
      ) : null}
      {plan.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            data-testid="verantwortung-vorschau-holen"
            disabled={beschaeftigt}
            onClick={() => vorschauHolen.mutate(zuteilung())}
          >
            {t("uebergabe.vorschau")}
          </Button>
          <Button
            variant="ghost"
            data-testid="verantwortung-verwerfen"
            disabled={beschaeftigt}
            onClick={() => {
              planSetzen(new Map());
              setAuswahl(new Set());
            }}
          >
            {t("uebergabe.verwerfen")}
          </Button>
        </div>
      ) : null}

      {vorschau ? (
        <div data-testid="verantwortung-vorschau" className="space-y-1.5 rounded-input bg-page p-2">
          <div className="text-[12.5px] font-semibold text-text">
            {t("uebergabe.vorschauTitel")}
          </div>
          <ul className="space-y-1 text-[12.5px]">
            {vorschau.daten.gruppen.map((g) => (
              <li key={g.an.id} data-testid="verantwortung-vorschau-gruppe" data-an={g.an.id}>
                <span className="font-medium">
                  {t("uebergabe.gruppe", {
                    name: g.an.name ?? t("uebergabe.unbekannt"),
                    anzahl: g.anzahl,
                  })}
                </span>
                <span className="text-muted-2">
                  {" — "}
                  {g.beitraege.map((x) => x.titel ?? t("uebergabe.verborgen")).join(", ")}
                </span>
              </li>
            ))}
          </ul>
          {vorschau.daten.abgelehnt.length > 0 ? (
            <div data-testid="verantwortung-vorschau-abgelehnt" className="text-[12px]">
              <div className="text-trust-crit-text">
                {t("uebergabe.abgelehnt", { anzahl: vorschau.daten.abgelehnt.length })}
              </div>
              <ul>
                {vorschau.daten.abgelehnt.map((x) => (
                  <li key={x.koId}>
                    {x.titel ?? t("uebergabe.verborgen")}: {x.text}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-[12px] text-muted-2">{t("uebergabe.bleibt")}</p>
          <p className="text-[12px] text-muted-2" data-testid="verantwortung-verbleibt">
            {t("uebergabe.verbleibt", { name, anzahl: vorschau.daten.verbleibt })}
          </p>
          <Button
            variant="primary"
            data-testid="verantwortung-ausfuehren"
            disabled={beschaeftigt || vorschau.daten.bereit === 0}
            onClick={() => uebergeben.mutate(vorschau.plan)}
          >
            {t("uebergabe.ausfuehren")}
          </Button>
        </div>
      ) : null}

      {ergebnis ? (
        <div
          data-testid="verantwortung-ergebnis"
          data-vollstaendig={ergebnis.vollstaendig ? "ja" : "nein"}
          className="space-y-1 rounded-input bg-page p-2 text-[12.5px]"
        >
          <div className={ergebnis.vollstaendig ? "text-trust-pos-text" : "text-trust-crit-text"}>
            {ergebnis.vollstaendig
              ? t("uebergabe.ergebnisVoll", { anzahl: ergebnis.uebertragen.length })
              : t("uebergabe.ergebnisTeil", {
                  uebertragen: ergebnis.uebertragen.length,
                  offen: ergebnis.fehlgeschlagen.length + ergebnis.abgelehnt.length,
                })}
          </div>
          {ergebnis.bereitsErledigt.length > 0 ? (
            <div className="text-muted-2">
              {t("uebergabe.bereitsErledigt", { anzahl: ergebnis.bereitsErledigt.length })}
            </div>
          ) : null}
          {offeneZeilen.length > 0 ? (
            <ul data-testid="verantwortung-offen">
              {offeneZeilen.map((x) => (
                <li key={x.koId} data-ko={x.koId} data-grund={x.grund}>
                  {x.titel ?? t("uebergabe.verborgen")}: {x.text}
                </li>
              ))}
            </ul>
          ) : null}
          {offeneFehler.length > 0 ? (
            <Button
              variant="outline"
              data-testid="verantwortung-erneut"
              disabled={beschaeftigt}
              onClick={() => uebergeben.mutate(erneut)}
            >
              {t("uebergabe.erneut")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {von === personId ? (
        <div className="space-y-1.5">
          <p className="text-[12px] text-muted-2">{t("uebergabe.deaktivierenHinweis")}</p>
          <Button
            variant="danger"
            data-testid="verantwortung-deaktivieren"
            disabled={beschaeftigt || (b.anzahl > 0 && vorschau === null)}
            onClick={() => deaktivieren.mutate(vorschau?.plan ?? [])}
          >
            {t("uebergabe.deaktivieren")}
          </Button>
        </div>
      ) : null}

      {meldung ? (
        <output data-testid="verantwortung-meldung" className="block text-[12.5px] text-text">
          {meldung}
        </output>
      ) : null}

      {andere.length > 0 ? (
        <div className="space-y-1 border-t border-hairline pt-2" data-testid="verantwortung-andere">
          <div className="text-[12px] font-medium text-muted">{t("uebergabe.andere")}</div>
          <ul className="space-y-1 text-[12.5px]">
            {andere.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2">
                <span>
                  {t("uebergabe.andereZeile", {
                    name: p.name ?? t("uebergabe.geloeschtesKonto"),
                    zugang: t(`uebergabe.zugang.${p.zugang}`),
                    anzahl: p.anzahl,
                  })}
                </span>
                <Button variant="ghost" onClick={() => wechsleZu(p.id)}>
                  {t("uebergabe.andereWaehlen")}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Button variant="ghost" onClick={onEinklappen}>
        {t("uebergabe.einklappen")}
      </Button>
    </div>
  );
}
