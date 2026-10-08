// ================================================================================================
// R-1107 / R-0201 / R-0565 (Aufnahme gesamt-dublettenvergleich) — DER ZUSAMMENFÜHREN-ASSISTENT.
// ================================================================================================
//
// Vier Schritte, in dieser Reihenfolge und ohne Abkürzung: Führungsartikel wählen → Eigenanteile
// übernehmen (Feld für Feld) → Quellen mitnehmen → Vorschau prüfen und ausdrücklich freigeben. Bis
// zur Freigabe wird NICHTS geschrieben: Auswahl und Vorschau leben nur in dieser Seite, „Abbrechen"
// ist ein Link zurück. Erst die Freigabe ruft `POST /api/duplicates/:id/merge`.
//
// Was geschrieben wird, sagt die Vorschau vorher wörtlich: eine neue, UNGEPRÜFTE Fassung des
// Führungsartikels (sie geht normal in die Prüfung), der andere Artikel bleibt lesbar und verweist
// darauf. Die Logik dahinter (Vorschlag, Lage je Feld, Auswahl, Vorschau, Auftrag, Sperre) steht
// DOM-frei in `lib/dublettenZusammenfuehrung.ts`; diese Datei zeichnet nur.
//
// Erreichbar über das „···"-Menü der Dublettenkarte (`Duplicates.tsx`). Wer Autor einer Seite ist,
// sieht hier, warum er nicht zusammenführt (R-0565); entschieden wird das am Server (403).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useDuplicates, useKos } from "../api/hooks";
import type {
  KnowledgeObject,
  OverlapEntry,
  ZusammenfuehrungsErgebnis,
  ZusammenfuehrungsSeite,
} from "../api/types";
import { useSession } from "../app/AuthContext";
import { useRole } from "../app/RoleContext";
import { leerzustandsZeile } from "../components/EmptyStateCtas";
import { HelpTip } from "../components/HelpTip";
import { SanitizedHtml } from "../components/SanitizedHtml";
import { SourceLink } from "../components/ko/SourceEvidence";
import { PruefenKopf } from "../components/pruefen/PruefenKopf";
import { PruefenSatz } from "../components/pruefen/PruefenZustand";
import { cx } from "../components/ui";
import {
  ASSISTENT_SCHRITTE,
  type AssistentSchritt,
  type ZusammenfuehrungsAuswahl,
  auftragAus,
  fassungGeaendert,
  feldLage,
  fliesstextLage,
  fuehrungsVorschlag,
  listenPositionen,
  mitnehmbareQuellen,
  rollenVon,
  startAuswahl,
  umschalten,
  vorschau,
  zusammenfuehrenGesperrt,
} from "../lib/dublettenZusammenfuehrung";

const KNOPF =
  "rounded-[10px] px-[16px] py-[8px] text-[13.5px] leading-tight disabled:cursor-not-allowed disabled:opacity-50";

interface Erledigt {
  daten: ZusammenfuehrungsErgebnis;
  fuehrendTitel: string;
  aufgehendTitel: string;
}

export function DuplicateMerge(): JSX.Element {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const duplicates = useDuplicates();
  const kos = useKos();
  const { user } = useSession();
  const { role } = useRole();
  const [erledigt, setErledigt] = useState<Erledigt | null>(null);

  // Die Seitenhilfe sitzt im Kopf, den ALLE Rückgaben teilen (Begründung: DuplicateCompare.tsx).
  const kopf = (
    <>
      <HelpTip
        title={t("dublettenvergleich.seitenhilfe.titel")}
        body={t("dublettenvergleich.seitenhilfe.text")}
      />
      <PruefenKopf aktiv="duplikate" />
    </>
  );
  const zurueck = (
    <Link
      to="/duplikate"
      className="mt-2 inline-block text-[12.5px] font-semibold text-ai hover:opacity-80"
    >
      {t("dublettenvergleich.zurueckZurListe")}
    </Link>
  );

  // Nach der Freigabe ist der Befund geschlossen und verschwindet aus der Liste — das Ergebnis
  // steht deshalb VOR dem „nicht gefunden"-Zweig, sonst läse sich der Erfolg als Fehler.
  if (erledigt) {
    return (
      <div className="mx-auto max-w-[1040px]">
        {kopf}
        <div data-testid="zusammenfuehren-erledigt" className="space-y-2">
          <PruefenSatz kennung="zusammengefuehrt">
            {t("dublettenvergleich.erledigt", {
              fuehrend: erledigt.fuehrendTitel,
              version: erledigt.daten.fuehrend.version,
              aufgehend: erledigt.aufgehendTitel,
            })}
          </PruefenSatz>
          <div className="flex flex-wrap gap-4 text-[12.5px] font-semibold text-ai">
            <Link to={`/wissen/${erledigt.daten.fuehrend.id}`}>
              {t("dublettenvergleich.zumFuehrungsartikel")}
            </Link>
            <Link to={`/wissen/${erledigt.daten.aufgehend.id}`}>
              {t("dublettenvergleich.zumAufgegangenen")}
            </Link>
          </div>
          {zurueck}
        </div>
      </div>
    );
  }
  if (duplicates.isLoading || kos.isLoading) {
    return (
      <div className="mx-auto max-w-[1040px]">
        {kopf}
        <PruefenSatz kennung="laedt">{t("dublettenvergleich.laedt")}</PruefenSatz>
      </div>
    );
  }
  if (duplicates.isError || kos.isError) {
    return (
      <div className="mx-auto max-w-[1040px]">
        {kopf}
        <PruefenSatz kennung="fehler">{t("dublettenvergleich.ladefehler")}</PruefenSatz>
        {zurueck}
      </div>
    );
  }
  const entry = duplicates.data?.find((e) => e.id === id);
  const a = entry ? (kos.data?.find((k) => k.id === entry.koA) ?? null) : null;
  const b = entry ? (kos.data?.find((k) => k.id === entry.koB) ?? null) : null;
  if (!entry || !a || !b) {
    return (
      <div className="mx-auto max-w-[1040px]">
        {kopf}
        <PruefenSatz kennung="fehlt">{t("dublettenvergleich.nichtGefunden")}</PruefenSatz>
        {zurueck}
      </div>
    );
  }
  const sperre = zusammenfuehrenGesperrt({ userId: user?.id, role, entry, a, b });
  if (sperre) {
    return (
      <div className="mx-auto max-w-[1040px]">
        {kopf}
        <PruefenSatz kennung="gesperrt">{t(`dublettenvergleich.sperre.${sperre}`)}</PruefenSatz>
        {zurueck}
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-[1040px]">
      {kopf}
      <Assistent
        entry={entry}
        a={a}
        b={b}
        onErledigt={(daten, fuehrendTitel, aufgehendTitel) =>
          setErledigt({ daten, fuehrendTitel, aufgehendTitel })
        }
      />
    </div>
  );
}

function Assistent({
  entry,
  a: aktuellA,
  b: aktuellB,
  onErledigt,
}: {
  entry: OverlapEntry;
  a: KnowledgeObject;
  b: KnowledgeObject;
  onErledigt: (daten: ZusammenfuehrungsErgebnis, fuehrend: string, aufgehend: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  // ==============================================================================================
  // Nacharbeit 2 (Ben, R-0201) — DIE FREIGABE GILT DEN GESEHENEN FASSUNGEN.
  // ==============================================================================================
  //
  // Der Assistent hält die beiden Objekte fest, mit denen er begonnen hat. Vergleich, Vorschau und
  // Auftrag lesen AUSSCHLIESSLICH diesen Stand — der Auftrag trägt damit die gesehenen Fassungen,
  // und eine inzwischen geänderte Seite beantwortet der Server mit 409 statt sie mitzunehmen.
  // Kommt über `useKos` eine neue Fassung an, wird die Bestätigung zurückgenommen und die Freigabe
  // gesperrt, bis der Mensch den neuen Stand übernimmt und von Schritt 1 an erneut prüft.
  const [gesehen, setGesehen] = useState({ a: aktuellA, b: aktuellB });
  const { a, b } = gesehen;
  const veraltet = fassungGeaendert(gesehen, { a: aktuellA, b: aktuellB });
  const vorschlag = fuehrungsVorschlag(entry, a, b);
  const [schritt, setSchritt] = useState<AssistentSchritt>("fuehrung");
  const [auswahl, setAuswahl] = useState<ZusammenfuehrungsAuswahl>(() =>
    startAuswahl(vorschlag.seite, a, b),
  );
  const [bestaetigt, setBestaetigt] = useState(false);
  useEffect(() => {
    if (veraltet) {
      setBestaetigt(false);
    }
  }, [veraltet]);
  const [vermerk, setVermerk] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const { fuehrend, aufgehend } = rollenVon(auswahl.fuehrung, a, b);
  const index = ASSISTENT_SCHRITTE.indexOf(schritt);

  const freigabe = useMutation({
    mutationFn: () => endpoints.duplicates.merge(entry.id, auftragAus(a, b, auswahl, vermerk)),
    onSuccess: (daten) => {
      void qc.invalidateQueries({ queryKey: ["duplicates"] });
      void qc.invalidateQueries({ queryKey: ["kos"] });
      void qc.invalidateQueries({ queryKey: ["ko"] });
      onErledigt(daten, fuehrend.title, aufgehend.title);
    },
    onError: (e: unknown) => setFehler(e instanceof ApiError ? e.message : t("state.error")),
  });

  // Ein Schrittwechsel nimmt die Freigabe zurück: sie gilt genau der Vorschau, die gerade dasteht.
  const gehe = (ziel: AssistentSchritt): void => {
    setBestaetigt(false);
    setFehler(null);
    setSchritt(ziel);
  };
  // Den neuen Stand übernehmen: Auswahl neu aufbauen (dieselbe Führungsseite) und von vorn prüfen.
  const neuerStand = (): void => {
    setGesehen({ a: aktuellA, b: aktuellB });
    setAuswahl(startAuswahl(auswahl.fuehrung, aktuellA, aktuellB));
    gehe("fuehrung");
  };

  return (
    <div data-testid="zusammenfuehren" className="space-y-[22px]">
      <div>
        <h2 className="text-[17px] font-semibold text-text">{t("dublettenvergleich.titel")}</h2>
        <ol data-testid="zusammenfuehren-schritte" className="mt-2 flex flex-wrap gap-2">
          {ASSISTENT_SCHRITTE.map((s, i) => (
            <li
              key={s}
              aria-current={s === schritt ? "step" : undefined}
              className={cx(
                "rounded-pill px-2.5 py-1 text-[12px]",
                s === schritt ? "bg-ink font-semibold text-white" : "bg-hairline-soft text-muted",
              )}
            >
              {i + 1} · {t(`dublettenvergleich.schritt.${s}`)}
            </li>
          ))}
        </ol>
        <p className="mt-1 text-[12px] text-muted-2">
          {t("dublettenvergleich.schritt.nummer", { nummer: index + 1 })}
        </p>
      </div>

      {veraltet ? (
        <div
          role="alert"
          data-testid="zusammenfuehren-veraltet"
          className="flex flex-wrap items-center gap-3 rounded-btn bg-trust-warn-bg px-3 py-2 text-[12.5px] text-trust-warn-text"
        >
          <span>{t("dublettenvergleich.veraltet")}</span>
          <button
            type="button"
            data-testid="zusammenfuehren-neuer-stand"
            onClick={neuerStand}
            className="font-semibold underline"
          >
            {t("dublettenvergleich.veraltetUebernehmen")}
          </button>
        </div>
      ) : null}

      {schritt === "fuehrung" ? (
        <fieldset data-testid="schritt-fuehrung" className="space-y-2">
          <legend className="mb-2 text-[13.5px] font-semibold text-text">
            {t("dublettenvergleich.fuehrung.frage")}
          </legend>
          {(["a", "b"] as const).map((seite) => {
            const ko = seite === "a" ? a : b;
            return (
              <label
                key={seite}
                className={cx(
                  "flex cursor-pointer items-start gap-3 rounded-[12px] border px-4 py-3",
                  auswahl.fuehrung === seite ? "border-ink" : "border-hairline",
                )}
              >
                <input
                  type="radio"
                  name="fuehrung"
                  value={seite}
                  checked={auswahl.fuehrung === seite}
                  onChange={() => setAuswahl(startAuswahl(seite, a, b))}
                  className="mt-1"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-text">{ko.title}</span>
                  <span className="block text-[12px] text-muted">
                    {t(`status.${ko.status}`)} · v{ko.version}
                  </span>
                </span>
                {vorschlag.seite === seite ? (
                  <span className="rounded-pill bg-trust-warn-bg px-2 py-0.5 text-[11px] font-bold">
                    {t("dublettenvergleich.fuehrung.vorgeschlagen")}
                  </span>
                ) : null}
              </label>
            );
          })}
          <p data-testid="fuehrung-grund" className="text-[12.5px] text-muted">
            {t(vorschlag.grundKey)}
          </p>
        </fieldset>
      ) : null}

      {schritt === "inhalte" ? (
        <div data-testid="schritt-inhalte" className="space-y-5">
          <FeldWahl
            feld="titel"
            fuehrendWert={fuehrend.title}
            aufgehendWert={aufgehend.title}
            wert={auswahl.titel}
            onWahl={(titel) => setAuswahl({ ...auswahl, titel })}
          />
          <FeldWahl
            feld="kernaussage"
            fuehrendWert={fuehrend.statement}
            aufgehendWert={aufgehend.statement}
            rumpf={{
              fuehrend: fuehrend.bodyHtml ?? null,
              aufgehend: aufgehend.bodyHtml ?? null,
            }}
            wert={auswahl.kernaussage}
            onWahl={(kernaussage) => setAuswahl({ ...auswahl, kernaussage })}
          />
          <ListenWahl
            feld="bedingungen"
            fuehrend={fuehrend.conditions}
            aufgehend={aufgehend.conditions}
            gewaehlt={auswahl.bedingungen}
            onWahl={(bedingungen) => setAuswahl({ ...auswahl, bedingungen })}
          />
          <ListenWahl
            feld="massnahmen"
            fuehrend={fuehrend.measures}
            aufgehend={aufgehend.measures}
            gewaehlt={auswahl.massnahmen}
            onWahl={(massnahmen) => setAuswahl({ ...auswahl, massnahmen })}
          />
          {eigenanteilVon(entry, aufgehend) ? (
            <p data-testid="eigenanteil" className="text-[12.5px] text-muted">
              {t("dublettenvergleich.eigenanteil", { text: eigenanteilVon(entry, aufgehend) })}
            </p>
          ) : null}
        </div>
      ) : null}

      {schritt === "quellen" ? (
        <div data-testid="schritt-quellen" className="space-y-4">
          <div>
            <div className="mb-1 text-[13px] font-semibold text-text">
              {t("dublettenvergleich.quellen.bleiben")}
            </div>
            {(fuehrend.sources ?? []).length > 0 ? (
              <ul className="space-y-1">
                {(fuehrend.sources ?? []).map((q) => (
                  <li key={q.id}>
                    <SourceLink source={q} />
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <p className="text-[12.5px] text-muted-2">
                  {t("dublettenvergleich.quellen.keine")}
                </p>
                {leerzustandsZeile(t, "duplicates")}
              </>
            )}
          </div>
          <fieldset>
            <legend className="mb-1 text-[13px] font-semibold text-text">
              {t("dublettenvergleich.quellen.mitnehmen")}
            </legend>
            {mitnehmbareQuellen(fuehrend, aufgehend).length > 0 ? (
              <ul className="space-y-1">
                {mitnehmbareQuellen(fuehrend, aufgehend).map((q) => (
                  <li key={q.id}>
                    <label className="flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        checked={auswahl.quellen.includes(q.id)}
                        onChange={() =>
                          setAuswahl({
                            ...auswahl,
                            quellen: umschalten(
                              auswahl.quellen,
                              q.id,
                              mitnehmbareQuellen(fuehrend, aufgehend).map((m) => m.id),
                            ),
                          })
                        }
                        className="mt-1"
                      />
                      <SourceLink source={q} />
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <p className="text-[12.5px] text-muted-2">
                  {t("dublettenvergleich.quellen.keine")}
                </p>
                {leerzustandsZeile(t, "duplicates")}
              </>
            )}
          </fieldset>
        </div>
      ) : null}

      {schritt === "vorschau" ? (
        <Vorschau
          a={a}
          b={b}
          auswahl={auswahl}
          aufgehendTitel={aufgehend.title}
          fuehrendTitel={fuehrend.title}
          vermerk={vermerk}
          onVermerk={setVermerk}
          bestaetigt={bestaetigt}
          onBestaetigt={setBestaetigt}
          gesperrt={veraltet}
        />
      ) : null}

      {fehler ? (
        <div
          role="alert"
          className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text"
        >
          {fehler}
        </div>
      ) : null}

      <div data-testid="zusammenfuehren-band" className="flex flex-wrap items-center gap-[10px]">
        {index > 0 ? (
          <button
            type="button"
            data-testid="zusammenfuehren-zurueck"
            disabled={freigabe.isPending}
            onClick={() => gehe(ASSISTENT_SCHRITTE[index - 1] ?? "fuehrung")}
            className={cx(KNOPF, "border border-hairline bg-surface text-text")}
          >
            {t("dublettenvergleich.zurueck")}
          </button>
        ) : null}
        {schritt !== "vorschau" ? (
          <button
            type="button"
            data-testid="zusammenfuehren-weiter"
            onClick={() => gehe(ASSISTENT_SCHRITTE[index + 1] ?? "vorschau")}
            className={cx(KNOPF, "bg-ink font-semibold text-white")}
          >
            {t("dublettenvergleich.weiter")}
          </button>
        ) : (
          <button
            type="button"
            data-testid="zusammenfuehren-freigeben"
            disabled={!bestaetigt || veraltet || freigabe.isPending}
            onClick={() => {
              setFehler(null);
              freigabe.mutate();
            }}
            className={cx(KNOPF, "bg-[#C2500A] font-semibold text-white")}
          >
            {freigabe.isPending
              ? t("dublettenvergleich.laeuft")
              : t("dublettenvergleich.freigeben")}
          </button>
        )}
        <Link to="/duplikate" className="ml-auto text-[13px] text-muted hover:text-text">
          {t("dublettenvergleich.abbrechen")}
        </Link>
      </div>
    </div>
  );
}

/** Der Eigenanteil des AUFGEHENDEN Artikels laut Erkennung (koA ↔ eigenanteilA). */
function eigenanteilVon(entry: OverlapEntry, aufgehend: KnowledgeObject): string {
  return (aufgehend.id === entry.koA ? entry.eigenanteilA : entry.eigenanteilB).trim();
}

/** R-0201: ein Feld, beide Werte nebeneinander, seine Lage — und die Wahl, welcher gilt. */
function FeldWahl({
  feld,
  fuehrendWert,
  aufgehendWert,
  rumpf,
  wert,
  onWahl,
}: {
  feld: "titel" | "kernaussage";
  fuehrendWert: string;
  aufgehendWert: string;
  /**
   * Nacharbeit 2 (Ben, R-0201): der Fliesstext beider Seiten, wenn das Feld ihn mitführt. Die Wahl
   * der Kernaussage übernimmt am Server auch den Fliesstext dieser Seite — deshalb steht er hier
   * sichtbar an der Option, mit eigener Lage und dem ausdrücklichen Satz über die Kopplung.
   */
  rumpf?: { fuehrend: string | null; aufgehend: string | null };
  wert: ZusammenfuehrungsSeite;
  onWahl: (seite: ZusammenfuehrungsSeite) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const lage = feldLage(fuehrendWert, aufgehendWert);
  const rumpfLage = rumpf ? fliesstextLage(rumpf.fuehrend, rumpf.aufgehend) : null;
  return (
    <fieldset data-testid={`feld-${feld}`}>
      <legend className="mb-1 flex items-center gap-2 text-[13px] font-semibold text-text">
        {t(`dublettenvergleich.feld.${feld}`)}
        <span
          data-testid={`lage-${feld}`}
          className={cx(
            "rounded-pill px-2 py-0.5 text-[11px] font-bold",
            lage === "gleich" && "bg-trust-pos-bg text-trust-pos-text",
            lage === "abweichend" && "bg-trust-crit-bg text-trust-crit-text",
            (lage === "nur_eine_seite" || lage === "beide_leer") &&
              "bg-trust-warn-bg text-trust-warn-text",
          )}
        >
          {t(`dublettenvergleich.lage.${lage}`)}
        </span>
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {(["fuehrend", "aufgehend"] as const).map((seite) => {
          const text = seite === "fuehrend" ? fuehrendWert : aufgehendWert;
          return (
            <label
              key={seite}
              className={cx(
                "flex cursor-pointer items-start gap-2 rounded-[10px] border px-3 py-2",
                wert === seite ? "border-ink" : "border-hairline",
              )}
            >
              <input
                type="radio"
                name={`feld-${feld}`}
                value={seite}
                checked={wert === seite}
                onChange={() => onWahl(seite)}
                className="mt-1"
              />
              <span className="min-w-0">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-2">
                  {t(`dublettenvergleich.seite.${seite}`)}
                </span>
                <span className="block whitespace-pre-wrap text-[13px] text-text">
                  {text.trim() ? text : t("dublettenvergleich.leer")}
                </span>
                {rumpf ? (
                  <span
                    data-testid={`fliesstext-${seite}`}
                    className="mt-2 block border-t border-hairline pt-2"
                  >
                    <span className="block font-mono text-[10px] uppercase text-muted-2">
                      {t("dublettenvergleich.feld.fliesstext")}
                    </span>
                    {rumpf[seite]?.trim() ? (
                      <SanitizedHtml
                        html={rumpf[seite] ?? ""}
                        className="prose-kw text-[12.5px] text-text"
                      />
                    ) : (
                      <span className="block text-[12.5px] text-muted-2">
                        {t("dublettenvergleich.leer")}
                      </span>
                    )}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
      {rumpf && rumpfLage ? (
        <p data-testid="fliesstext-kopplung" className="mt-1 text-[12px] text-muted">
          {t("dublettenvergleich.fliesstext.kopplung", {
            lage: t(`dublettenvergleich.lage.${rumpfLage}`),
          })}
        </p>
      ) : null}
    </fieldset>
  );
}

/** R-0201: Bedingungen bzw. Massnahmen Position für Position, mit ihrer Herkunft. */
function ListenWahl({
  feld,
  fuehrend,
  aufgehend,
  gewaehlt,
  onWahl,
}: {
  feld: "bedingungen" | "massnahmen";
  fuehrend: string[];
  aufgehend: string[];
  gewaehlt: string[];
  onWahl: (liste: string[]) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const positionen = listenPositionen(fuehrend, aufgehend);
  const alle = positionen.map((p) => p.text);
  return (
    <fieldset data-testid={`feld-${feld}`}>
      <legend className="mb-1 text-[13px] font-semibold text-text">
        {t(`dublettenvergleich.feld.${feld}`)}
      </legend>
      {positionen.length === 0 ? (
        <>
          <p className="text-[12.5px] text-muted-2">{t("dublettenvergleich.keinePositionen")}</p>
          {leerzustandsZeile(t, "duplicates")}
        </>
      ) : (
        <ul className="space-y-1">
          {positionen.map((p) => (
            <li key={p.text}>
              <label className="flex cursor-pointer items-start gap-2 text-[13px] text-text">
                <input
                  type="checkbox"
                  checked={gewaehlt.includes(p.text)}
                  onChange={() => onWahl(umschalten(gewaehlt, p.text, alle))}
                  className="mt-1"
                />
                <span className="min-w-0 flex-1">{p.text}</span>
                <span className="shrink-0 rounded-pill bg-hairline-soft px-2 py-0.5 text-[11px] text-muted">
                  {t(`dublettenvergleich.herkunft.${p.herkunft}`)}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

/** Schritt 4: was entsteht, was bleibt, was nicht übernommen wird — und die ausdrückliche Freigabe. */
function Vorschau({
  a,
  b,
  auswahl,
  fuehrendTitel,
  aufgehendTitel,
  vermerk,
  onVermerk,
  bestaetigt,
  onBestaetigt,
  gesperrt,
}: {
  a: KnowledgeObject;
  b: KnowledgeObject;
  auswahl: ZusammenfuehrungsAuswahl;
  fuehrendTitel: string;
  aufgehendTitel: string;
  vermerk: string;
  onVermerk: (text: string) => void;
  bestaetigt: boolean;
  onBestaetigt: (ja: boolean) => void;
  /** Eine Seite liegt inzwischen in neuerer Fassung vor — bestätigen geht erst nach Übernahme. */
  gesperrt: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const v = vorschau(a, b, auswahl);
  const weggelassen =
    v.nichtUebernommen.bedingungen.length +
    v.nichtUebernommen.massnahmen.length +
    v.nichtUebernommen.quellen.length +
    (v.nichtUebernommen.fliesstextFuehrend ? 1 : 0);
  return (
    <div data-testid="schritt-vorschau" className="space-y-4">
      <div className="rounded-[14px] border border-hairline bg-surface px-[22px] py-[18px]">
        <div data-testid="vorschau-titel" className="text-[16px] font-[650] text-text">
          {v.titel}
        </div>
        <p data-testid="vorschau-kernaussage" className="mt-2 text-[14px] leading-[1.6] text-text">
          {v.kernaussage}
        </p>
        {/* Nacharbeit 2 (Ben, R-0201): der Fliesstext, der TATSÄCHLICH in der neuen Fassung steht —
            auch wenn er leer ist; dann sagt die Vorschau es, statt nichts zu zeigen. */}
        <div data-testid="vorschau-fliesstext" className="mt-3">
          <div className="text-[12px] font-semibold text-muted">
            {t("dublettenvergleich.feld.fliesstext")}
          </div>
          {v.fliesstext ? (
            <SanitizedHtml html={v.fliesstext} className="prose-kw text-[13px] text-text" />
          ) : (
            <p className="text-[13px] text-muted-2">{t("dublettenvergleich.leer")}</p>
          )}
        </div>
        {v.bedingungen.length > 0 ? (
          <div className="mt-3">
            <div className="text-[12px] font-semibold text-muted">
              {t("dublettenvergleich.feld.bedingungen")}
            </div>
            <ul data-testid="vorschau-bedingungen" className="list-disc pl-5 text-[13px] text-text">
              {v.bedingungen.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {v.massnahmen.length > 0 ? (
          <div className="mt-3">
            <div className="text-[12px] font-semibold text-muted">
              {t("dublettenvergleich.feld.massnahmen")}
            </div>
            <ul data-testid="vorschau-massnahmen" className="list-disc pl-5 text-[13px] text-text">
              {v.massnahmen.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <ul data-testid="vorschau-quellen" className="mt-3 space-y-1">
          {v.quellen.map((q) => (
            <li key={q.id}>
              <SourceLink source={q} />
            </li>
          ))}
        </ul>
      </div>
      <p data-testid="vorschau-fassung" className="text-[13px] text-text">
        {t("dublettenvergleich.vorschau.fassung", { version: v.neueFassung, titel: fuehrendTitel })}
      </p>
      <p data-testid="vorschau-verbleib" className="text-[13px] text-text">
        {t("dublettenvergleich.vorschau.verbleib", { titel: aufgehendTitel })}
      </p>
      {weggelassen > 0 ? (
        <div data-testid="vorschau-nicht-uebernommen" className="text-[12.5px] text-muted">
          <div className="font-semibold">{t("dublettenvergleich.vorschau.nichtUebernommen")}</div>
          <ul className="list-disc pl-5">
            {v.nichtUebernommen.bedingungen.map((x) => (
              <li key={`b-${x}`}>{x}</li>
            ))}
            {v.nichtUebernommen.massnahmen.map((x) => (
              <li key={`m-${x}`}>{x}</li>
            ))}
            {v.nichtUebernommen.quellen.map((q) => (
              <li key={`q-${q.id}`}>{q.label}</li>
            ))}
            {v.nichtUebernommen.fliesstextFuehrend ? (
              <li data-testid="vorschau-fliesstext-ersetzt">
                {t("dublettenvergleich.fliesstext.ersetzt", { titel: fuehrendTitel })}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
      <input
        type="text"
        value={vermerk}
        aria-label={t("dublettenvergleich.vermerk")}
        placeholder={t("dublettenvergleich.vermerk")}
        onChange={(ev) => onVermerk(ev.target.value)}
        className="w-full rounded-[8px] border border-hairline bg-surface px-3 py-2 text-[13px] text-text"
      />
      <label className="flex cursor-pointer items-start gap-2 text-[13px] text-text">
        <input
          type="checkbox"
          data-testid="zusammenfuehren-bestaetigung"
          checked={bestaetigt}
          disabled={gesperrt}
          onChange={(ev) => onBestaetigt(ev.target.checked)}
          className="mt-1"
        />
        <span>{t("dublettenvergleich.bestaetigung")}</span>
      </label>
    </div>
  );
}
