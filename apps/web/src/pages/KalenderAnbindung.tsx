// produkt:20261008:klara-kalender (Klara 11, AW-17, P07) · den vorhandenen Kalender bedienen
// (`/kalender-anbindung`, erreichbar über Profil › „Vorhandener Kalender“).
//
// Die Seite zeigt, was der SERVER weiß — Konto und Kalender kommen vom Anbieter, Rechte und
// Feldregeln von der gespeicherten Anbindung, jeder Stand vom Server nach Nachlesen. Sie behauptet
// selbst nichts:
//   · Der Zauberhut-Assistent ist FREIWILLIG und jederzeit erneut aufrufbar; er wählt Zeitzone,
//     Kalender, Umfang, Feldrichtungen und den Umfang privater Termine im geteilten Kalender.
//   · Eingeladen wird nur mit ausdrücklichem Haken für GENAU diesen Termin.
//   · Gelöscht wird in zwei Schritten: Ziel samt Fassung lesen, dann genau diese Fassung löschen.
//   · Eine offene Entscheidung (externe Löschung/Absage, Konflikt, veraltete Löschung) verlangt bei
//     Serien ausdrücklich „nur dieser Termin“ oder „ganze Serie“. Schließen des Dialogs wird als
//     `dialog_geschlossen` gemeldet und ist KEINE Zustimmung — der Lauf bleibt angehalten.
//   · S09: ein Eintrag des EIGENEN Kalenders wird ausgewählt und mit SEINER Auftrags- und
//     Ereigniskennung eingetragen (`eigenerEintragId`) — nichts wird doppelt erfasst.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import {
  type AnbieterKalender,
  type AnbindungUmfang,
  type EigenerKalenderEintrag,
  type Entscheidung,
  type FeldRegel,
  type FeldRichtung,
  KALENDER_FELDER,
  type KalenderAnbindung,
  type KalenderErgebnis,
  type KalenderFeld,
  type KalenderZuordnung,
  type Konfliktstrategie,
  type PrivatProjektion,
  type Serienart,
  type Umfang,
  klaraKalenderApi,
} from "../api/klaraKalender";
import { Modal } from "../components/Modal";
import { Button, Card, PageHeader } from "../components/ui";

const ZEITZONE_SPEICHER = "klarwerk.kalender.zeitzone";
const RICHTUNGEN: readonly FeldRichtung[] = ["klara", "kalender", "nur_klara"];
const STRATEGIEN: readonly Konfliktstrategie[] = ["nachfragen", "fuehrend_mit_hinweis"];
const PRIVAT: readonly PrivatProjektion[] = ["nur_belegt", "titel", "voll"];
const STANDARD_FELDER: Record<KalenderFeld, FeldRegel> = {
  titel: { richtung: "klara", konflikt: "nachfragen" },
  zeit: { richtung: "klara", konflikt: "nachfragen" },
  ort: { richtung: "klara", konflikt: "nachfragen" },
  beschreibung: { richtung: "klara", konflikt: "nachfragen" },
  teilnehmer: { richtung: "nur_klara", konflikt: "nachfragen" },
};

function eigeneZeitzone(): string {
  try {
    return (
      window.localStorage.getItem(ZEITZONE_SPEICHER) ??
      Intl.DateTimeFormat().resolvedOptions().timeZone ??
      "Europe/Berlin"
    );
  } catch {
    return "Europe/Berlin";
  }
}

const ZEITZONEN_RUECKFALL = ["Europe/Berlin", "Europe/London", "UTC", "America/New_York"];

function zeitzonen(aktuell: string): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (art: string) => string[] };
  const alle = intl.supportedValuesOf?.("timeZone") ?? ZEITZONEN_RUECKFALL;
  return alle.includes(aktuell) ? alle : [aktuell, ...alle];
}

/** „Titel: Klara führt · Bei Abweichung fragen“ — eine Feldregel in Worten. */
function RegelText({ feld, regel }: { feld: KalenderFeld; regel: FeldRegel }): JSX.Element {
  const { t } = useTranslation();
  return (
    <>
      {t(`klarakalender.feld.${feld}`)}: {t(`klarakalender.richtung.${regel.richtung}`)} ·{" "}
      {t(`klarakalender.konflikt.${regel.konflikt}`)}
    </>
  );
}

function fehlertext(fehler: unknown): string {
  if (fehler instanceof ApiError) {
    const meldung = fehler.details.meldung;
    return typeof meldung === "string" ? meldung : fehler.message;
  }
  return fehler instanceof Error ? fehler.message : String(fehler);
}

// ------------------------------------------------------------------------------------------------
// Der Zauberhut — freiwillig, erneut aufrufbar
// ------------------------------------------------------------------------------------------------

function Zauberhut({
  kalender,
  offen,
  onSchliessen,
}: {
  kalender: AnbieterKalender[];
  offen: boolean;
  onSchliessen: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [schritt, setSchritt] = useState(1);
  const [zeitzone, setZeitzone] = useState(eigeneZeitzone);
  const [kalenderId, setKalenderId] = useState(kalender[0]?.id ?? "");
  const [umfang, setUmfang] = useState<AnbindungUmfang>("nur_lesen");
  const [felder, setFelder] = useState<Record<KalenderFeld, FeldRegel>>(STANDARD_FELDER);
  const [privat, setPrivat] = useState<PrivatProjektion>("nur_belegt");
  const gewaehlt = kalender.find((k) => k.id === kalenderId);
  const verbinden = useMutation({
    mutationFn: () =>
      klaraKalenderApi.verbinde({ kalenderId, umfang, felder, privatProjektion: privat }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["klara-kalender"] });
    },
  });

  const weiter = (): void => {
    if (schritt === 1) {
      try {
        window.localStorage.setItem(ZEITZONE_SPEICHER, zeitzone);
      } catch {
        // Ohne Speicher gilt die Wahl nur in dieser Sitzung.
      }
    }
    setSchritt((s) => Math.min(4, s + 1));
  };

  return (
    <Modal open={offen} onClose={onSchliessen} title={t("klarakalender.wizard.titel")}>
      <div data-testid="kalender-zauberhut" className="space-y-3 text-[13px]">
        <p className="text-muted">{t("klarakalender.wizard.freiwillig")}</p>
        <p className="text-[12px] text-muted-2">
          {t("klarakalender.wizard.schritt", { nr: schritt })}
        </p>
        {schritt === 1 ? (
          <label className="block space-y-1">
            <span className="font-semibold">{t("klarakalender.wizard.zeitzone")}</span>
            <select
              data-testid="kalender-zeitzone"
              className="block w-full rounded border border-hairline px-2 py-1"
              value={zeitzone}
              onChange={(e) => setZeitzone(e.target.value)}
            >
              {zeitzonen(zeitzone).map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
            <span className="block text-[12px] text-muted">
              {t("klarakalender.wizard.zeitzoneHinweis")}
            </span>
          </label>
        ) : null}
        {schritt === 2 ? (
          <fieldset className="space-y-2">
            <legend className="font-semibold">{t("klarakalender.wizard.kalender")}</legend>
            {kalender.map((k) => (
              <label key={k.id} className="flex items-start gap-2">
                <input
                  type="radio"
                  name="kalender"
                  checked={k.id === kalenderId}
                  onChange={() => setKalenderId(k.id)}
                />
                <span>
                  {k.name} ·{" "}
                  {k.art === "eigen"
                    ? t("klarakalender.art.eigen")
                    : t("klarakalender.art.geteilt", { besitzer: k.besitzer })}
                  <RechteZeile rechte={k.rechte} />
                </span>
              </label>
            ))}
            <span className="block font-semibold">{t("klarakalender.wizard.umfang")}</span>
            {(["nur_lesen", "lesen_schreiben"] as const).map((u) => (
              <label key={u} className="mr-4 inline-flex items-center gap-1">
                <input
                  type="radio"
                  name="umfang"
                  checked={umfang === u}
                  onChange={() => setUmfang(u)}
                />
                {t(`klarakalender.umfang.${u}`)}
              </label>
            ))}
          </fieldset>
        ) : null}
        {schritt === 3 ? (
          <FeldregelWahl
            felder={felder}
            onFelder={setFelder}
            privat={privat}
            onPrivat={setPrivat}
          />
        ) : null}
        {schritt === 4 ? (
          <div className="space-y-1" data-testid="kalender-zusammenfassung">
            <p className="font-semibold">{t("klarakalender.wizard.pruefen")}</p>
            <p>{zeitzone}</p>
            <p>
              {gewaehlt?.name ?? "—"} · {t(`klarakalender.umfang.${umfang}`)}
            </p>
            <ul className="list-disc pl-5">
              {KALENDER_FELDER.map((f) => (
                <li key={f}>
                  <RegelText feld={f} regel={felder[f]} />
                </li>
              ))}
            </ul>
            {verbinden.isSuccess ? (
              <output className="block" data-testid="kalender-verbunden">
                {t("klarakalender.wizard.verbunden", {
                  kalender: verbinden.data.anbindung.kalender.name,
                })}
              </output>
            ) : null}
            {verbinden.isError ? (
              <p role="alert" className="text-trust-crit-text">
                {t("klarakalender.fehler.allgemein", { meldung: fehlertext(verbinden.error) })}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="flex justify-between gap-2 pt-2">
          <Button
            variant="ghost"
            disabled={schritt === 1}
            onClick={() => setSchritt((s) => Math.max(1, s - 1))}
          >
            {t("klarakalender.wizard.zurueck")}
          </Button>
          {schritt < 4 ? (
            <Button variant="primary" disabled={!kalenderId} onClick={weiter}>
              {t("klarakalender.wizard.weiter")}
            </Button>
          ) : (
            <Button
              variant="primary"
              data-testid="kalender-verbinden"
              disabled={verbinden.isPending || verbinden.isSuccess || !kalenderId}
              onClick={() => verbinden.mutate()}
            >
              {t("klarakalender.wizard.verbinden")}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function RechteZeile({ rechte }: { rechte: KalenderAnbindung["rechte"] }): JSX.Element {
  const { t } = useTranslation();
  const ja = (w: boolean): string => t(w ? "klarakalender.recht.ja" : "klarakalender.recht.nein");
  return (
    <span className="block text-[12px] text-muted" data-testid="kalender-rechte">
      {t("klarakalender.recht.lesen")}: {ja(rechte.lesen)} ·{" "}
      {t("klarakalender.recht.eigeneSchreiben")}: {ja(rechte.eigeneSchreiben)} ·{" "}
      {t("klarakalender.recht.geteiltBearbeiten")}: {ja(rechte.geteiltBearbeiten)} ·{" "}
      {t("klarakalender.recht.einladen")}: {ja(rechte.einladen)}
    </span>
  );
}

function FeldregelWahl({
  felder,
  onFelder,
  privat,
  onPrivat,
}: {
  felder: Record<KalenderFeld, FeldRegel>;
  onFelder: (f: Record<KalenderFeld, FeldRegel>) => void;
  privat: PrivatProjektion;
  onPrivat: (p: PrivatProjektion) => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <fieldset className="space-y-2" data-testid="kalender-feldregeln">
      <legend className="font-semibold">{t("klarakalender.wizard.felder")}</legend>
      {KALENDER_FELDER.map((f) => (
        <div key={f} className="flex flex-wrap items-center gap-2">
          <span className="w-28">{t(`klarakalender.feld.${f}`)}</span>
          <select
            aria-label={t(`klarakalender.feld.${f}`)}
            value={felder[f].richtung}
            onChange={(e) =>
              onFelder({
                ...felder,
                [f]: { ...felder[f], richtung: e.target.value as FeldRichtung },
              })
            }
          >
            {/* Teilnehmer führt nie der Kalender — das wäre eine Einladung ohne Auftrag. */}
            {RICHTUNGEN.filter((r) => !(f === "teilnehmer" && r === "kalender")).map((r) => (
              <option key={r} value={r}>
                {t(`klarakalender.richtung.${r}`)}
              </option>
            ))}
          </select>
          <select
            aria-label={`${t(`klarakalender.feld.${f}`)} · ${t("klarakalender.konfliktregel")}`}
            value={felder[f].konflikt}
            onChange={(e) =>
              onFelder({
                ...felder,
                [f]: { ...felder[f], konflikt: e.target.value as Konfliktstrategie },
              })
            }
          >
            {STRATEGIEN.map((s) => (
              <option key={s} value={s}>
                {t(`klarakalender.konflikt.${s}`)}
              </option>
            ))}
          </select>
        </div>
      ))}
      <span className="block font-semibold">{t("klarakalender.privat.titel")}</span>
      {PRIVAT.map((p) => (
        <label key={p} className="mr-4 inline-flex items-center gap-1">
          <input type="radio" name="privat" checked={privat === p} onChange={() => onPrivat(p)} />
          {t(p === "titel" ? "klarakalender.privat.titel_" : `klarakalender.privat.${p}`)}
        </label>
      ))}
    </fieldset>
  );
}

// ------------------------------------------------------------------------------------------------
// Entscheidung und Löschung
// ------------------------------------------------------------------------------------------------

function EntscheidungsDialog({
  z,
  onFertig,
}: {
  z: KalenderZuordnung;
  onFertig: () => void;
}): JSX.Element | null {
  const { t } = useTranslation();
  const offen = z.entscheidung;
  const [umfang, setUmfang] = useState<Umfang | null>(
    offen && offen.umfaenge.length === 1 ? (offen.umfaenge[0] ?? null) : null,
  );
  const entscheiden = useMutation({
    mutationFn: (wahl: Entscheidung) =>
      klaraKalenderApi.entscheide(
        z.schluessel,
        wahl,
        wahl === "dialog_geschlossen" ? null : umfang,
      ),
    onSettled: onFertig,
  });
  if (!offen) {
    return null;
  }
  // Schließen ist KEINE Zustimmung: es wird als `dialog_geschlossen` gemeldet, der Lauf bleibt.
  const schliessen = (): void => entscheiden.mutate("dialog_geschlossen");
  const wahlen: Entscheidung[] = [
    "fortfuehren_neu_eintragen",
    "fortfuehren_ohne_kalender",
    "beenden",
  ];
  return (
    <Modal open onClose={schliessen} title={t("klarakalender.dialog.titel")}>
      <div data-testid="kalender-entscheidung" className="space-y-3 text-[13px]">
        <p>{t(`klarakalender.dialog.anlass.${offen.anlass}`)}</p>
        {offen.konflikte.length > 0 ? (
          <ul className="list-disc pl-5">
            {offen.konflikte.map((k) => (
              <li key={k.feld}>
                {t("klarakalender.dialog.konfliktFeld", {
                  feld: t(`klarakalender.feld.${k.feld}`),
                  klara: k.klara,
                  kalender: k.kalender,
                })}
              </li>
            ))}
          </ul>
        ) : null}
        <fieldset>
          <legend className="font-semibold">{t("klarakalender.dialog.gilt")}</legend>
          {offen.umfaenge.map((u) => (
            <label key={u} className="mr-4 inline-flex items-center gap-1">
              <input
                type="radio"
                name="entscheidung-umfang"
                data-testid={`kalender-umfang-${u}`}
                checked={umfang === u}
                onChange={() => setUmfang(u)}
              />
              {t(`klarakalender.dialog.umfang.${u}`)}
            </label>
          ))}
          {umfang === null ? (
            <p className="text-[12px] text-muted">{t("klarakalender.dialog.umfangPflicht")}</p>
          ) : null}
        </fieldset>
        <div className="flex flex-wrap gap-2">
          {wahlen.map((w) => (
            <Button
              key={w}
              variant={w === "beenden" ? "danger" : "outline"}
              data-testid={`kalender-wahl-${w}`}
              disabled={umfang === null || entscheiden.isPending}
              onClick={() => entscheiden.mutate(w)}
            >
              {t(`klarakalender.dialog.wahl.${w}`)}
            </Button>
          ))}
        </div>
        <p className="text-[12px] text-muted">{t("klarakalender.dialog.schliessenHinweis")}</p>
      </div>
    </Modal>
  );
}

function LoeschDialog({
  z,
  onFertig,
}: {
  z: KalenderZuordnung;
  onFertig: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  // P07-AC06: ein Vorkommen verlangt die ausdrückliche Wahl; Einzeltermin und Serie kennen nur sich.
  const umfaenge: Umfang[] =
    z.serienart === "vorkommen"
      ? ["einzeltermin", "serie"]
      : [z.serienart === "serie" ? "serie" : "einzeltermin"];
  const [umfang, setUmfang] = useState<Umfang | null>(
    umfaenge.length === 1 ? (umfaenge[0] ?? null) : null,
  );
  const vorschau = useMutation({
    mutationFn: (u: Umfang) => klaraKalenderApi.loeschVorschau(z.schluessel, u),
  });
  const loeschen = useMutation({
    mutationFn: (eingabe: { u: Umfang; fassung: string }) =>
      klaraKalenderApi.loesche(z.schluessel, eingabe.u, eingabe.fassung),
  });
  const gelesen = vorschau.data?.ok ? vorschau.data : null;
  // Nacharbeit 4 (Ben): Erfolg ist NUR das fachliche `ok: true` — ein 202 mit `ok: false`
  // (Anbieter-, Zugangs- oder Speicherausfall) ist kein Erfolg. Dann bleiben Stand und Meldung
  // sichtbar, und die Wiederholung trägt dieselbe gelesene Fassung (Versionsbindung bleibt).
  const ergebnis = loeschen.data;
  const geloescht = ergebnis?.ok === true;
  const nichtGeloescht = ergebnis && !ergebnis.ok ? ergebnis : null;
  return (
    <Modal open onClose={onFertig} title={t("klarakalender.loeschDialog.titel")}>
      <div data-testid="kalender-loeschen" className="space-y-3 text-[13px]">
        <fieldset>
          <legend className="font-semibold">{t("klarakalender.dialog.gilt")}</legend>
          {umfaenge.map((u) => (
            <label key={u} className="mr-4 inline-flex items-center gap-1">
              <input
                type="radio"
                name="loesch-umfang"
                checked={umfang === u}
                onChange={() => {
                  setUmfang(u);
                  vorschau.reset();
                }}
              />
              {t(`klarakalender.dialog.umfang.${u}`)}
            </label>
          ))}
        </fieldset>
        <Button
          disabled={umfang === null || vorschau.isPending}
          onClick={() => umfang && vorschau.mutate(umfang)}
        >
          {t("klarakalender.loeschDialog.lesen")}
        </Button>
        {gelesen ? (
          <p data-testid="kalender-loesch-fassung">
            {t("klarakalender.loeschDialog.fassung", {
              titel: gelesen.ziel.titel,
              art: t(`klarakalender.serienart.${gelesen.ziel.serienart}`),
              fassung: gelesen.fassung,
            })}
          </p>
        ) : null}
        {vorschau.data && !vorschau.data.ok ? <p role="alert">{vorschau.data.meldung}</p> : null}
        <Button
          variant="danger"
          data-testid="kalender-loesch-bestaetigen"
          disabled={!gelesen || loeschen.isPending || geloescht}
          onClick={() => {
            if (gelesen) {
              loeschen.mutate({ u: gelesen.umfang, fassung: gelesen.fassung });
            }
          }}
        >
          {t(
            nichtGeloescht
              ? "klarakalender.loeschDialog.wiederholen"
              : "klarakalender.loeschDialog.bestaetigen",
          )}
        </Button>
        {geloescht ? (
          <output className="block" data-testid="kalender-loesch-ok">
            {t("klarakalender.loeschDialog.ok")}
          </output>
        ) : null}
        {nichtGeloescht ? (
          <p role="alert" data-testid="kalender-loesch-nicht">
            {t("klarakalender.loeschDialog.nichtGeloescht", {
              stand: t(`klarakalender.stand.${nichtGeloescht.stand}`),
              meldung: nichtGeloescht.meldung,
            })}
          </p>
        ) : null}
        {loeschen.isError ? (
          <p role="alert" className="text-trust-crit-text">
            {t("klarakalender.fehler.allgemein", { meldung: fehlertext(loeschen.error) })}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------------------------------------
// Eintragen, Lesen, Zuordnungen je Anbindung
// ------------------------------------------------------------------------------------------------

function neueKennung(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID?.() ?? `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function Eintragen({
  a,
  onFertig,
}: {
  a: KalenderAnbindung;
  onFertig: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [titel, setTitel] = useState("");
  const [beginn, setBeginn] = useState("");
  const [ende, setEnde] = useState("");
  const [ort, setOrt] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [privat, setPrivat] = useState(false);
  const [serienart, setSerienart] = useState<Serienart>("einzel");
  const [teilnehmer, setTeilnehmer] = useState("");
  const [einladen, setEinladen] = useState(false);
  // Nacharbeit 4 (Ben): die Identität dieses Termins entsteht EINMAL und bleibt über jede
  // Wiederholung erhalten — nach verlorener Antwort oder gescheiterter Speicherung findet der Server
  // über denselben Mapping-Schlüssel dasselbe externe Ereignis (keine Dublette). Eine neue Kennung
  // gibt es nur über „Neuer Termin“. Nach einem bestätigten Eintrag steigt nur die Fassung.
  const [identitaet, setIdentitaet] = useState(() => ({ ereignisId: neueKennung(), fassung: 1 }));
  const eintragen = useMutation({
    mutationFn: (): Promise<KalenderErgebnis> => {
      const adressen = teilnehmer
        .split(",")
        .map((x) => x.trim())
        .filter((x) => x.length > 0);
      return klaraKalenderApi.eintragen(
        a.id,
        {
          auftragId: "kalender-eintrag",
          ereignisId: identitaet.ereignisId,
          fassung: identitaet.fassung,
          privat,
          serienart,
          abgesagt: false,
          inhalt: {
            titel,
            beginn,
            ende,
            zeitzone: eigeneZeitzone(),
            ort,
            beschreibung,
            teilnehmer: adressen.map((adresse) => ({ adresse, name: "", antwort: "offen" })),
          },
        },
        einladen && adressen.length > 0 ? { adressen } : null,
      );
    },
    onSuccess: (r) => {
      if (r.ok) {
        setIdentitaet((alt) => ({ ...alt, fassung: alt.fassung + 1 }));
      }
    },
    onSettled: onFertig,
  });
  const neuerTermin = (): void => {
    setIdentitaet({ ereignisId: neueKennung(), fassung: 1 });
    setTitel("");
    setBeginn("");
    setEnde("");
    setOrt("");
    setBeschreibung("");
    setPrivat(false);
    setSerienart("einzel");
    setTeilnehmer("");
    setEinladen(false);
    eintragen.reset();
  };
  const feld = "block w-full rounded border border-hairline px-2 py-1";
  return (
    <form
      className="space-y-2 text-[13px]"
      data-testid="kalender-eintragen"
      onSubmit={(e) => {
        e.preventDefault();
        eintragen.mutate();
      }}
    >
      <h3 className="font-semibold">{t("klarakalender.eintragen.titel")}</h3>
      <label className="block">
        {t("klarakalender.eintragen.terminTitel")}
        <input className={feld} value={titel} onChange={(e) => setTitel(e.target.value)} required />
      </label>
      <label className="block">
        {t("klarakalender.eintragen.beginn")} ({eigeneZeitzone()})
        <input
          className={feld}
          type="datetime-local"
          value={beginn}
          onChange={(e) => setBeginn(e.target.value)}
          required
        />
      </label>
      <label className="block">
        {t("klarakalender.eintragen.ende")}
        <input
          className={feld}
          type="datetime-local"
          value={ende}
          onChange={(e) => setEnde(e.target.value)}
          required
        />
      </label>
      <label className="block">
        {t("klarakalender.eintragen.ort")}
        <input className={feld} value={ort} onChange={(e) => setOrt(e.target.value)} />
      </label>
      <label className="block">
        {t("klarakalender.eintragen.beschreibung")}
        <textarea
          className={feld}
          value={beschreibung}
          onChange={(e) => setBeschreibung(e.target.value)}
        />
      </label>
      <label className="block">
        {t("klarakalender.eintragen.serie")}
        <select
          className={feld}
          value={serienart}
          onChange={(e) => setSerienart(e.target.value as Serienart)}
        >
          {(["einzel", "serie"] as const).map((s) => (
            <option key={s} value={s}>
              {t(`klarakalender.serienart.${s}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="inline-flex items-center gap-1">
        <input type="checkbox" checked={privat} onChange={(e) => setPrivat(e.target.checked)} />
        {t("klarakalender.eintragen.privat")}
      </label>
      <label className="block">
        {t("klarakalender.eintragen.teilnehmer")}
        <input
          className={feld}
          value={teilnehmer}
          onChange={(e) => setTeilnehmer(e.target.value)}
        />
      </label>
      <label className="inline-flex items-center gap-1">
        <input
          type="checkbox"
          data-testid="kalender-einladen"
          checked={einladen}
          onChange={(e) => setEinladen(e.target.checked)}
        />
        {t("klarakalender.eintragen.einladen")}
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          type="submit"
          data-testid="kalender-eintragen-senden"
          disabled={eintragen.isPending}
        >
          {t(
            eintragen.data && !eintragen.data.ok
              ? "klarakalender.eintragen.wiederholen"
              : "klarakalender.eintragen.knopf",
          )}
        </Button>
        <Button
          type="button"
          data-testid="kalender-neuer-termin"
          disabled={eintragen.isPending}
          onClick={neuerTermin}
        >
          {t("klarakalender.eintragen.neu")}
        </Button>
      </div>
      {eintragen.data?.ok ? (
        <output className="block">{t("klarakalender.eintragen.ok")}</output>
      ) : null}
      {eintragen.data && !eintragen.data.ok ? (
        <p role="alert">
          {t("klarakalender.eintragen.ausstehend", { meldung: eintragen.data.meldung })}
        </p>
      ) : null}
      {eintragen.isError ? (
        <p role="alert" className="text-trust-crit-text">
          {t("klarakalender.fehler.allgemein", { meldung: fehlertext(eintragen.error) })}
        </p>
      ) : null}
    </form>
  );
}

/** Beginn eines eigenen Eintrags in seiner Zeitzone — ganztägig nur das Datum. */
function eintragZeit(e: EigenerKalenderEintrag): string {
  if (e.ganztaegig) {
    return e.beginn;
  }
  try {
    const optionen = { timeZone: e.zeitzone, dateStyle: "short", timeStyle: "short" } as const;
    return new Intl.DateTimeFormat("sv-SE", optionen).format(new Date(e.beginn));
  } catch {
    return e.beginn;
  }
}

/**
 * S09 (Ben, Nacharbeit 46): ein Eintrag des EIGENEN Kalenders wird mit SEINER Auftrags- und
 * Ereigniskennung eingetragen. Nichts wird neu erfasst — hinaus geht nur die Kennung, der Server
 * liest den Eintrag mit heutigen Rechten. Erfolg nur bei `ok: true`; dann zeigt die Seite die
 * gemeinsame Kennung, die der Server meldet. Eine Wiederholung trifft dieselbe Zuordnung.
 */
function AusEigenemKalender({
  a,
  onFertig,
}: {
  a: KalenderAnbindung;
  onFertig: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const eigene = useQuery({
    queryKey: ["klara-kalender", "eigene-eintraege"],
    queryFn: () => klaraKalenderApi.eigeneEintraege(),
  });
  const liste = (eigene.data?.eintraege ?? []).filter((e) => !e.geschuetzt && e.titel !== null);
  const [gewaehlt, setGewaehlt] = useState("");
  const eintrag = liste.find((e) => e.id === gewaehlt) ?? liste[0] ?? null;
  const uebernehmen = useMutation({
    mutationFn: (id: string) => klaraKalenderApi.eintragenAusEigenemKalender(a.id, id),
    onSettled: onFertig,
  });
  return (
    <section className="space-y-2 text-[13px]" data-testid="kalender-aus-eigenem">
      <h3 className="font-semibold">{t("klarakalender.eigener.titel")}</h3>
      <p className="text-[12px] text-muted">{t("klarakalender.eigener.hinweis")}</p>
      {eigene.isSuccess && liste.length === 0 ? (
        <p className="text-[12px] text-muted">{t("klarakalender.eigener.leer")}</p>
      ) : null}
      {eintrag ? (
        <>
          <label className="block">
            {t("klarakalender.eigener.waehlen")}
            <select
              className="block w-full rounded border border-hairline px-2 py-1"
              data-testid="kalender-eigener-eintrag"
              value={eintrag.id}
              onChange={(e) => {
                setGewaehlt(e.target.value);
                uebernehmen.reset();
              }}
            >
              {liste.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.titel} · {eintragZeit(e)}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[12px] text-muted" data-testid="kalender-eigener-auftrag">
            {eintrag.auftrag
              ? t("klarakalender.eigener.auftrag", {
                  titel: eintrag.auftrag.titel ?? eintrag.auftrag.taskId,
                  lauf: eintrag.lauf?.runId ?? "—",
                })
              : t("klarakalender.eigener.ohneAuftrag")}
          </p>
          <Button
            data-testid="kalender-eigener-senden"
            disabled={uebernehmen.isPending}
            onClick={() => uebernehmen.mutate(eintrag.id)}
          >
            {t("klarakalender.eigener.knopf")}
          </Button>
        </>
      ) : null}
      {uebernehmen.data?.ok ? (
        <output className="block" data-testid="kalender-eigener-ok">
          {t("klarakalender.eigener.ok", {
            auftrag: uebernehmen.data.zuordnung.auftragId,
            ereignis: uebernehmen.data.zuordnung.ereignisId,
          })}
        </output>
      ) : null}
      {uebernehmen.data && !uebernehmen.data.ok ? (
        <p role="alert">
          {t("klarakalender.eintragen.ausstehend", { meldung: uebernehmen.data.meldung })}
        </p>
      ) : null}
      {uebernehmen.isError ? (
        <p role="alert" className="text-trust-crit-text">
          {t("klarakalender.fehler.allgemein", { meldung: fehlertext(uebernehmen.error) })}
        </p>
      ) : null}
    </section>
  );
}

function AnbindungKarte({ a }: { a: KalenderAnbindung }): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const zuordnungen = useQuery({
    queryKey: ["klara-kalender", "zuordnungen", a.id],
    queryFn: () => klaraKalenderApi.zuordnungen(a.id),
  });
  useEffect(() => {
    const oeffneVerweis = () => {
      let ziel: string;
      try {
        ziel = decodeURIComponent(window.location.hash.slice(1));
      } catch {
        return;
      }
      if (!zuordnungen.data?.zuordnungen.some((z) => ziel === `kalender-zuordnung-${z.schluessel}`))
        return;
      const original = document.getElementById(ziel);
      original?.focus();
      original?.scrollIntoView?.({ block: "center" });
    };
    oeffneVerweis();
    window.addEventListener("hashchange", oeffneVerweis);
    return () => window.removeEventListener("hashchange", oeffneVerweis);
  }, [zuordnungen.data]);
  const von = new Date();
  const bis = new Date(von.getTime() + 14 * 24 * 3_600_000);
  const termine = useQuery({
    queryKey: ["klara-kalender", "termine", a.id],
    queryFn: () => klaraKalenderApi.termine(a.id, von.toISOString(), bis.toISOString()),
  });
  const neuLaden = (): void => {
    void qc.invalidateQueries({ queryKey: ["klara-kalender"] });
  };
  const abgleich = useMutation({
    mutationFn: () => klaraKalenderApi.abgleich(a.id),
    onSettled: neuLaden,
  });
  const [entscheidung, setEntscheidung] = useState<KalenderZuordnung | null>(null);
  const [loeschen, setLoeschen] = useState<KalenderZuordnung | null>(null);
  const schreibt = a.umfang === "lesen_schreiben";

  return (
    <Card interactive={false} data-testid="kalender-anbindung" data-anbindung={a.id}>
      <div className="space-y-3">
        <header>
          <h2 className="text-[16px] font-semibold text-ink">
            {a.kalender.name} ·{" "}
            {a.kalender.art === "eigen"
              ? t("klarakalender.art.eigen")
              : t("klarakalender.art.geteilt", { besitzer: a.kalender.besitzer })}
          </h2>
          <p className="text-[12px] text-muted">
            {t("klarakalender.konto", {
              anzeige: a.konto.anzeige,
              adresse: a.konto.adresse,
            })}{" "}
            · {t(`klarakalender.umfang.${a.umfang}`)}
          </p>
          <RechteZeile rechte={a.rechte} />
          <ul className="mt-1 text-[12px] text-muted" data-testid="kalender-feldrichtungen">
            {KALENDER_FELDER.map((f) => (
              <li key={f}>
                <RegelText feld={f} regel={a.felder[f]} />
              </li>
            ))}
          </ul>
        </header>

        <div>
          <Button
            data-testid="kalender-abgleichen"
            disabled={abgleich.isPending}
            onClick={() => abgleich.mutate()}
          >
            {t("klarakalender.abgleichen")}
          </Button>
          {abgleich.data ? (
            <output className="block text-[12px] text-muted">
              {t("klarakalender.abgleichErgebnis", {
                anzahl: abgleich.data.ergebnisse.length,
                pausiert: abgleich.data.ergebnisse.filter((e) => e.laufWirkung === "pausiert")
                  .length,
              })}
            </output>
          ) : null}
        </div>

        <section>
          <h3 className="font-semibold">{t("klarakalender.zuordnungen")}</h3>
          {(zuordnungen.data?.zuordnungen ?? []).length === 0 ? (
            <p className="text-[12px] text-muted">{t("klarakalender.zuordnungenLeer")}</p>
          ) : null}
          <ul className="space-y-2" data-testid="kalender-zuordnungen">
            {(zuordnungen.data?.zuordnungen ?? []).map((z) => (
              <li
                key={z.schluessel}
                id={`kalender-zuordnung-${z.schluessel}`}
                tabIndex={-1}
                data-stand={z.stand}
                className="text-[13px]"
              >
                <span className="font-medium">{z.intern.inhalt.titel}</span> ·{" "}
                {z.intern.inhalt.beginn} ({z.intern.inhalt.zeitzone}) ·{" "}
                {t(`klarakalender.serienart.${z.serienart}`)} ·{" "}
                <strong>{t(`klarakalender.stand.${z.stand}`)}</strong>
                {z.intern.inhalt.teilnehmer.length > 0 ? (
                  <span className="block text-[12px] text-muted">
                    {t("klarakalender.teilnehmerWirkung", {
                      liste: z.intern.inhalt.teilnehmer.map((p) => p.adresse).join(", "),
                    })}
                  </span>
                ) : null}
                <span className="ml-2 inline-flex gap-2">
                  {z.entscheidung ? (
                    <Button
                      variant="primary"
                      data-testid="kalender-entscheiden"
                      onClick={() => setEntscheidung(z)}
                    >
                      {t("klarakalender.entscheiden")}
                    </Button>
                  ) : null}
                  {/* Löschen nur ohne offene Entscheidung — außer dem Löschkonflikt selbst, den
                      eine neue, an die neu gelesene Fassung gebundene Löschung auflöst. */}
                  {schreibt &&
                  z.externeId &&
                  !z.sperrmarke &&
                  (!z.entscheidung || z.entscheidung.anlass === "loeschen_veraltet") ? (
                    <Button variant="ghost" onClick={() => setLoeschen(z)}>
                      {t("klarakalender.loeschen")}
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="font-semibold">{t("klarakalender.termineLesen")}</h3>
          {termine.data?.ok && termine.data.termine.length === 0 ? (
            <p className="text-[12px] text-muted">{t("klarakalender.termineLeer")}</p>
          ) : null}
          {termine.data && !termine.data.ok ? <p role="alert">{termine.data.meldung}</p> : null}
          <ul className="text-[13px]" data-testid="kalender-termine">
            {(termine.data?.ok ? termine.data.termine : []).map((x) => (
              <li key={x.id}>
                {x.titel} · {x.beginn} · {t(`klarakalender.terminArt.${x.art}`)}
                {x.teilnehmer.length > 0 ? (
                  <span className="block text-[12px] text-muted">
                    {t("klarakalender.teilnehmerWirkung", {
                      liste: x.teilnehmer
                        .map((p) => `${p.adresse} (${t(`klarakalender.antwort.${p.antwort}`)})`)
                        .join(", "),
                    })}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        {schreibt ? <AusEigenemKalender a={a} onFertig={neuLaden} /> : null}
        {schreibt ? <Eintragen a={a} onFertig={neuLaden} /> : null}
      </div>
      {entscheidung ? (
        <EntscheidungsDialog
          z={entscheidung}
          onFertig={() => {
            setEntscheidung(null);
            neuLaden();
          }}
        />
      ) : null}
      {loeschen ? (
        <LoeschDialog
          z={loeschen}
          onFertig={() => {
            setLoeschen(null);
            neuLaden();
          }}
        />
      ) : null}
    </Card>
  );
}

export function KalenderAnbindungSeite(): JSX.Element {
  const { t } = useTranslation();
  const [hutOffen, setHutOffen] = useState(false);
  const uebersicht = useQuery({
    queryKey: ["klara-kalender"],
    queryFn: klaraKalenderApi.uebersicht,
  });
  const auswahl = uebersicht.data?.auswahl;
  const anbindungen = uebersicht.data?.anbindungen ?? [];
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        pageKey="kalender-anbindung"
        title={t("klarakalender.titel")}
        lead={t("klarakalender.lead")}
      />
      {uebersicht.isPending ? (
        <p className="text-sm text-muted">{t("klarakalender.laedt")}</p>
      ) : null}
      {uebersicht.isError ? (
        <p role="alert">
          {t("klarakalender.fehler.allgemein", { meldung: fehlertext(uebersicht.error) })}
        </p>
      ) : null}
      {auswahl && !auswahl.verbunden ? (
        <p data-testid="kalender-nicht-verbunden" className="text-sm text-muted">
          {auswahl.meldung ?? t("klarakalender.nichtVerbunden")}
        </p>
      ) : null}
      {auswahl?.verbunden ? (
        <>
          <p className="text-sm text-muted" data-testid="kalender-konto">
            {t("klarakalender.konto", {
              anzeige: auswahl.konto.anzeige,
              adresse: auswahl.konto.adresse,
            })}
          </p>
          <Button
            variant={anbindungen.length === 0 ? "primary" : "outline"}
            data-testid="kalender-zauberhut-start"
            onClick={() => setHutOffen(true)}
          >
            {t(
              anbindungen.length === 0
                ? "klarakalender.wizard.start"
                : "klarakalender.wizard.erneut",
            )}
          </Button>
          {hutOffen ? (
            <Zauberhut
              kalender={auswahl.kalender}
              offen={hutOffen}
              onSchliessen={() => setHutOffen(false)}
            />
          ) : null}
        </>
      ) : null}
      <h2 className="text-[15px] font-semibold">{t("klarakalender.anbindungen")}</h2>
      <ul className="space-y-3">
        {anbindungen.map((a) => (
          <li key={a.id}>
            <AnbindungKarte a={a} />
          </li>
        ))}
      </ul>
    </div>
  );
}
