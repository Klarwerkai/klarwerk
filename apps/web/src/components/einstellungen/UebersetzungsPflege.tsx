// ================================================================================================
// R-1034 / FR-I18N-02 · DIE KARTE „ÜBERSETZUNGEN" UNTER VERWALTUNG › SYSTEM.
// ================================================================================================
//
// „Texte sollen im laufenden Betrieb übersetzt und angepasst werden können, ohne den Code zu
// ändern." Diese Karte ist der eine Bedienort dafür. Sie zeigt je Schlüssel den deutschen Text als
// Vorlage, den mitgelieferten Text der gewählten Sprache und — falls vorhanden — die Anpassung.
// Gespeichert wird auf dem Server (`PUT /api/admin/i18n/:locale/:key`); die eigene Sitzung sieht
// die Änderung sofort, jede andere beim nächsten Öffnen oder Sprachwechsel (`lib/textpflege.ts`).
//
// WEITERE SPRACHEN: Eine angelegte Sprache wird hier Text für Text übersetzt; was fehlt, fällt auf
// Deutsch zurück. Sie ist ohne Codeänderung in Kontomenü und Profil wählbar
// (`lib/instanzSprachen.ts`); diese Karte führt die Liste nach jedem Abruf dort nach, damit eine
// soeben angelegte Sprache sofort wählbar ist. Die Ownerentscheidung zu JOB 536 betrifft allein das
// `<html lang>`-Attribut (`lib/htmlLang.ts`) und gilt dort weiter; sie begrenzt die Sprachwahl nicht.
//
// PLATZHALTER: Ein Text mit `{{name}}` verliert ohne diesen Platzhalter seinen Inhalt, und ein
// fremder Platzhalter bliebe als Klammertext stehen. Gespeichert wird deshalb nur, wenn die
// Platzhalter dieselben sind wie im mitgelieferten Text.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { endpoints } from "../../api/endpoints";
import { setzeAngelegteSprachen } from "../../lib/instanzSprachen";
import { OBERFLAECHEN_SPRACHEN } from "../../lib/sprachregister";
import {
  legeTexteUeber,
  mitgelieferterText,
  platzhalterAbweichung,
  setzeTextZurueck,
} from "../../lib/textpflege";
import { Button, Field, TextInput } from "../ui";
import { Abfragehuelle } from "./Abfragehuelle";
import { Detailkarte } from "./Detailkarte";

/** Mehr Zeilen auf einmal hilft niemandem — die Suche grenzt ein. */
const MAX_TREFFER = 50;
const SPRACHEN_KEY = ["i18n", "sprachen"] as const;
const texteKey = (sprache: string) => ["i18n", "texte", sprache] as const;

function fehlertext(fehler: unknown): string {
  return fehler instanceof ApiError || fehler instanceof Error ? fehler.message : String(fehler);
}

interface Zeile {
  schluessel: string;
  vorlage: string;
  mitgeliefert: string | null;
  angepasst: string | undefined;
}

export function UebersetzungenDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [sprache, setSprache] = useState<string>(i18n.language);
  const [suche, setSuche] = useState("");
  const [nurAngepasst, setNurAngepasst] = useState(false);
  const [bearbeitet, setBearbeitet] = useState<{ schluessel: string; text: string } | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [neueKennung, setNeueKennung] = useState("");
  const [neuerName, setNeuerName] = useState("");
  // Das Paket der gewählten Sprache muss geladen sein, bevor ihr mitgelieferter Text gelesen wird
  // (im Produktionsbau kommen en und nl erst auf Anfrage). Der Zähler zeichnet danach neu.
  const [, setGeladen] = useState(0);

  useEffect(() => {
    let aktiv = true;
    void i18n.loadLanguages(sprache).then(() => {
      if (aktiv) {
        setGeladen((n) => n + 1);
      }
    });
    return () => {
      aktiv = false;
    };
  }, [i18n, sprache]);

  const sprachen = useQuery({ queryKey: SPRACHEN_KEY, queryFn: endpoints.i18n.sprachen });
  const texte = useQuery({
    queryKey: texteKey(sprache),
    queryFn: () => endpoints.i18n.texte(sprache),
  });

  // Angelegte Sprachen, die nicht schon über ihre Ressource mitgeliefert sind (R-0997).
  const zusatz = (sprachen.data?.sprachen ?? []).filter(
    (s) => !s.grundsprache && !OBERFLAECHEN_SPRACHEN.includes(s.kennung),
  );

  // FR-I18N-02: jede frische Serverauskunft macht die angelegten Sprachen in Kontomenü und Profil
  // wählbar — auch die eben hier angelegte, ohne Neuladen.
  useEffect(() => {
    if (sprachen.data) {
      setzeAngelegteSprachen(sprachen.data.sprachen.filter((s) => !s.grundsprache));
    }
  }, [sprachen.data]);
  const auswahl = [
    ...OBERFLAECHEN_SPRACHEN.map((k) => ({ kennung: k, name: t(`lib.facet.lang.${k}`) })),
    ...zusatz.map((s) => ({ kennung: s.kennung, name: `${s.name ?? s.kennung} (${s.kennung})` })),
  ];

  const speichern = useMutation({
    mutationFn: (v: { schluessel: string; text: string }) =>
      endpoints.i18n.setzeText(sprache, v.schluessel, v.text),
    onSuccess: (antwort) => {
      legeTexteUeber(i18n, antwort.sprache, { [antwort.schluessel]: antwort.text });
      setBearbeitet(null);
      setMeldung(t("uebersetzungen.gespeichert"));
      void queryClient.invalidateQueries({ queryKey: texteKey(antwort.sprache) });
    },
    onError: (fehler) => setMeldung(t("uebersetzungen.fehler", { grund: fehlertext(fehler) })),
  });

  const zuruecksetzen = useMutation({
    mutationFn: (schluessel: string) => endpoints.i18n.entferneText(sprache, schluessel),
    onSuccess: (antwort) => {
      setzeTextZurueck(i18n, antwort.sprache, antwort.schluessel);
      setMeldung(t("uebersetzungen.zurueckgesetzt"));
      void queryClient.invalidateQueries({ queryKey: texteKey(antwort.sprache) });
    },
    onError: (fehler) => setMeldung(t("uebersetzungen.fehler", { grund: fehlertext(fehler) })),
  });

  const anlegen = useMutation({
    mutationFn: () => endpoints.i18n.setzeSprache(neueKennung.trim(), neuerName.trim()),
    onSuccess: (antwort) => {
      setNeueKennung("");
      setNeuerName("");
      setSprache(antwort.kennung);
      setMeldung(t("uebersetzungen.angelegt", { name: antwort.name }));
      void queryClient.invalidateQueries({ queryKey: SPRACHEN_KEY });
    },
    onError: (fehler) => setMeldung(t("uebersetzungen.fehler", { grund: fehlertext(fehler) })),
  });

  /** Alle Zeilen der gewählten Sprache — die Schlüssel sind die des deutschen Grundbestands. */
  function zeilen(angepasst: Readonly<Record<string, string>>): Zeile[] {
    const deutsch: Record<string, unknown> = i18n.getResourceBundle("de", "translation") ?? {};
    return Object.keys(deutsch)
      .sort()
      .map((schluessel) => {
        const vorlage = mitgelieferterText(i18n, "de", schluessel) ?? schluessel;
        return {
          schluessel,
          vorlage,
          mitgeliefert: sprache === "de" ? vorlage : mitgelieferterText(i18n, sprache, schluessel),
          angepasst: angepasst[schluessel],
        };
      });
  }

  function passt(z: Zeile): boolean {
    if (nurAngepasst && z.angepasst === undefined) {
      return false;
    }
    const s = suche.trim().toLowerCase();
    if (s.length === 0) {
      return true;
    }
    return [z.schluessel, z.vorlage, z.mitgeliefert ?? "", z.angepasst ?? ""].some((w) =>
      w.toLowerCase().includes(s),
    );
  }

  return (
    <Detailkarte
      titel={t("uebersetzungen.titel")}
      onZurueck={onZurueck}
      testId="detail-uebersetzungen"
      hilfe={[{ titel: t("uebersetzungen.titel"), text: t("uebersetzungen.hilfe") }]}
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
        <Field label={t("uebersetzungen.sprache")}>
          <select
            data-testid="uebersetzungen-sprache"
            value={sprache}
            onChange={(e) => {
              setSprache(e.target.value);
              setBearbeitet(null);
              setMeldung(null);
            }}
            className="h-10 w-full rounded-input border border-hairline bg-surface px-3 text-sm text-text"
          >
            {auswahl.map((s) => (
              <option key={s.kennung} value={s.kennung}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("uebersetzungen.suche")}>
          <TextInput
            data-testid="uebersetzungen-suche"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-[12.5px] text-muted">
        <input
          type="checkbox"
          checked={nurAngepasst}
          onChange={(e) => setNurAngepasst(e.target.checked)}
          className="accent-brand"
        />
        {t("uebersetzungen.nurAngepasst")}
      </label>
      {meldung === null ? null : (
        <output
          data-testid="uebersetzungen-meldung"
          className="block text-[12.5px] leading-relaxed text-muted"
        >
          {meldung}
        </output>
      )}
      <Abfragehuelle abfrage={texte}>
        {(daten) => {
          const alle = zeilen(daten.texte);
          const treffer = alle.filter(passt);
          const gezeigt = treffer.slice(0, MAX_TREFFER);
          return (
            <div className="space-y-2">
              <p data-testid="uebersetzungen-treffer" className="text-[12px] text-muted-2">
                {t("uebersetzungen.treffer", { anzahl: treffer.length, gesamt: alle.length })}
                {treffer.length > MAX_TREFFER
                  ? ` ${t("uebersetzungen.gekuerzt", { anzahl: MAX_TREFFER })}`
                  : ""}
              </p>
              {gezeigt.length === 0 ? (
                <p className="text-[12.5px] text-muted-2">{t("uebersetzungen.leer")}</p>
              ) : (
                <ul className="divide-y divide-hairline">
                  {gezeigt.map((z) => (
                    <TextZeile
                      key={z.schluessel}
                      zeile={z}
                      sprache={sprache}
                      bearbeitet={bearbeitet?.schluessel === z.schluessel ? bearbeitet.text : null}
                      onBearbeiten={(text) => setBearbeitet({ schluessel: z.schluessel, text })}
                      onAbbrechen={() => setBearbeitet(null)}
                      onSpeichern={(text) => speichern.mutate({ schluessel: z.schluessel, text })}
                      onZuruecksetzen={() => zuruecksetzen.mutate(z.schluessel)}
                      beschaeftigt={speichern.isPending || zuruecksetzen.isPending}
                    />
                  ))}
                </ul>
              )}
            </div>
          );
        }}
      </Abfragehuelle>
      <div className="space-y-2 border-t border-hairline pt-3">
        <p className="text-[13px] font-semibold text-ink">{t("uebersetzungen.neueSprache")}</p>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] sm:items-end">
          <Field label={t("uebersetzungen.kennung")}>
            <TextInput
              data-testid="uebersetzungen-kennung"
              value={neueKennung}
              onChange={(e) => setNeueKennung(e.target.value)}
            />
          </Field>
          <Field label={t("uebersetzungen.name")}>
            <TextInput
              data-testid="uebersetzungen-name"
              value={neuerName}
              onChange={(e) => setNeuerName(e.target.value)}
            />
          </Field>
          <Button
            data-testid="uebersetzungen-anlegen"
            disabled={neueKennung.trim() === "" || neuerName.trim() === "" || anlegen.isPending}
            onClick={() => anlegen.mutate()}
          >
            {t("uebersetzungen.anlegen")}
          </Button>
        </div>
        <p className="text-[11.5px] leading-relaxed text-muted-2">
          {t("uebersetzungen.sprachwahlHinweis")}
        </p>
      </div>
    </Detailkarte>
  );
}

function TextZeile({
  zeile,
  sprache,
  bearbeitet,
  onBearbeiten,
  onAbbrechen,
  onSpeichern,
  onZuruecksetzen,
  beschaeftigt,
}: {
  zeile: Zeile;
  sprache: string;
  /** Der Entwurf, wenn GENAU diese Zeile bearbeitet wird — sonst `null`. */
  bearbeitet: string | null;
  onBearbeiten: (text: string) => void;
  onAbbrechen: () => void;
  onSpeichern: (text: string) => void;
  onZuruecksetzen: () => void;
  beschaeftigt: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  // Die Platzhalter richten sich nach dem mitgelieferten Text dieser Sprache, sonst nach Deutsch.
  const massstab = zeile.mitgeliefert ?? zeile.vorlage;
  const abweichung = bearbeitet === null ? null : platzhalterAbweichung(massstab, bearbeitet);
  const darfSpeichern =
    bearbeitet !== null &&
    bearbeitet.trim().length > 0 &&
    abweichung !== null &&
    abweichung.fehlend.length === 0 &&
    abweichung.fremd.length === 0;

  return (
    <li data-schluessel={zeile.schluessel} className="space-y-1.5 py-2.5">
      <div className="break-all font-mono text-[11.5px] text-muted-2">{zeile.schluessel}</div>
      {sprache === "de" ? null : (
        <p className="text-[12px] text-muted-2">
          <span className="font-medium">{t("uebersetzungen.vorlage")}:</span> {zeile.vorlage}
        </p>
      )}
      <p className="text-[12.5px] text-text">
        <span className="font-medium text-muted">{t("uebersetzungen.mitgeliefert")}:</span>{" "}
        {zeile.mitgeliefert ?? t("uebersetzungen.keinMitgeliefert")}
      </p>
      {zeile.angepasst === undefined ? null : (
        <p data-testid="uebersetzungen-angepasst" className="text-[12.5px] text-ink">
          <span className="font-semibold">{t("uebersetzungen.angepasst")}:</span> {zeile.angepasst}
        </p>
      )}
      {bearbeitet === null ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            onClick={() => onBearbeiten(zeile.angepasst ?? zeile.mitgeliefert ?? zeile.vorlage)}
          >
            {t("uebersetzungen.anpassen")}
          </Button>
          {zeile.angepasst === undefined ? null : (
            <Button variant="ghost" disabled={beschaeftigt} onClick={onZuruecksetzen}>
              {t("uebersetzungen.zuruecksetzen")}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          <Field label={t("uebersetzungen.neuerText")}>
            <textarea
              data-testid="uebersetzungen-text"
              value={bearbeitet}
              onChange={(e) => onBearbeiten(e.target.value)}
              rows={3}
              className="w-full rounded-input border border-hairline bg-surface px-3 py-2 text-sm text-text"
            />
          </Field>
          {abweichung !== null && abweichung.fehlend.length > 0 ? (
            <p className="text-[12px] text-trust-warn-text">
              {t("uebersetzungen.platzhalterFehlt", {
                liste: abweichung.fehlend.map((p) => `{{${p}}}`).join(", "),
              })}
            </p>
          ) : null}
          {abweichung !== null && abweichung.fremd.length > 0 ? (
            <p className="text-[12px] text-trust-warn-text">
              {t("uebersetzungen.platzhalterFremd", {
                liste: abweichung.fremd.map((p) => `{{${p}}}`).join(", "),
              })}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              data-testid="uebersetzungen-speichern"
              disabled={!darfSpeichern || beschaeftigt}
              onClick={() => onSpeichern(bearbeitet)}
            >
              {t("uebersetzungen.speichern")}
            </Button>
            <Button variant="ghost" onClick={onAbbrechen}>
              {t("uebersetzungen.abbrechen")}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
