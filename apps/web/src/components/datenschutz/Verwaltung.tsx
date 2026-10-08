// ================================================================================================
// BETROFFENENRECHTE IN DER VERWALTUNG — LÖSCHANTRÄGE, AUSKUNFT, VERARBEITUNGSVERZEICHNIS.
// ================================================================================================
//
// Steht in der Datenschutzkarte (Verwaltung → Sicherheit und Nachweise → Datenschutz), unter den
// festen Sicherheitsaussagen. Drei Teile:
//   · Löschanträge (R-0661): die Aufgabenliste mit Frist; Erledigen löscht das Konto über den
//     vorhandenen Löschweg, Ablehnen nur mit Grund.
//   · Auskunft (R-1645): dieselbe Datei wie „Meine Daten" — für ein Konto, das sich selbst nicht
//     (mehr) anmelden kann.
//   · Verarbeitungsverzeichnis und Dateninventar (R-0583, R-0667): aus dem System erzeugt, als JSON
//     oder Markdown herunterladbar.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type LoeschantragVerwaltung,
  alsDateiSpeichern,
  dateistempel,
  datenschutzApi,
} from "../../api/datenschutz";
import { useUsers } from "../../api/hooks";
import { Abfragehuelle } from "../einstellungen/Abfragehuelle";
import { Kicker } from "../einstellungen/Zeilenkarte";
import { Button, Field, TextInput } from "../ui";
import { useAntragsfehler } from "./MeineDaten";

export const ALLE_ANTRAEGE_KEY = ["datenschutz", "loeschantraege"] as const;
const VERZEICHNIS_KEY = ["datenschutz", "verarbeitungsverzeichnis"] as const;

const LISTE = "divide-y divide-hairline overflow-hidden rounded-card border border-hairline";

function datum(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}

function AntragZeile({ antrag }: { antrag: LoeschantragVerwaltung }): JSX.Element {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fehlertext = useAntragsfehler();
  const [modus, setModus] = useState<"ruhe" | "loeschen" | "ablehnen">("ruhe");
  const [grund, setGrund] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const fertig = (): void => {
    setModus("ruhe");
    setFehler(null);
    void queryClient.invalidateQueries({ queryKey: ALLE_ANTRAEGE_KEY });
    void queryClient.invalidateQueries({ queryKey: ["users"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };
  const erledigen = useMutation({
    mutationFn: () => datenschutzApi.erledigen(antrag.id),
    onSuccess: fertig,
    onError: (e) => setFehler(fehlertext(e)),
  });
  const ablehnen = useMutation({
    mutationFn: () => datenschutzApi.ablehnen(antrag.id, grund.trim()),
    onSuccess: fertig,
    onError: (e) => setFehler(fehlertext(e)),
  });
  const auskunft = useMutation({
    mutationFn: () => datenschutzApi.auskunftFuer(antrag.nutzerId),
    onSuccess: (a) =>
      alsDateiSpeichern(
        JSON.stringify(a, null, 2),
        `klarwerk-auskunft-${a.nutzerId}-${dateistempel(a.erzeugtAm)}.json`,
        "application/json;charset=utf-8",
      ),
    onError: (e) => setFehler(fehlertext(e)),
  });
  const name = antrag.nutzer?.name ?? t("datenschutz.verwaltung.kontoWeg");
  return (
    <li className="space-y-2 px-3 py-2.5 text-[13px]" data-testid="loeschantrag-zeile">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold text-text">{name}</span>
        {antrag.nutzer ? <span className="text-muted-2">{antrag.nutzer.email}</span> : null}
        <span className="ml-auto text-muted-2">
          {antrag.status === "offen"
            ? t("datenschutz.verwaltung.frist", { datum: datum(antrag.fristBis) })
            : antrag.status === "in_bearbeitung"
              ? `${t("datenschutz.status.in_bearbeitung")} · ${t("datenschutz.verwaltung.frist", {
                  datum: datum(antrag.fristBis),
                })}`
              : t("datenschutz.verwaltung.entscheidung", {
                  status: t(`datenschutz.status.${antrag.status}`),
                  datum: datum(antrag.entschiedenAm),
                })}
        </span>
        {antrag.ueberfaellig ? (
          <span className="rounded-btn bg-trust-crit-bg px-1.5 py-0.5 text-[11px] font-semibold text-trust-crit-text">
            {t("datenschutz.verwaltung.ueberfaellig")}
          </span>
        ) : null}
      </div>
      {antrag.begruendung ? (
        <p className="text-[12.5px] text-muted">
          {t("datenschutz.verwaltung.begruendung", { text: antrag.begruendung })}
        </p>
      ) : null}
      {antrag.status !== "offen" && antrag.entscheidungsgrund ? (
        <p className="text-[12.5px] text-muted">{antrag.entscheidungsgrund}</p>
      ) : null}
      {antrag.status === "offen" && modus === "ruhe" ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="danger"
            onClick={() => setModus("loeschen")}
            data-testid="loeschantrag-erledigen"
          >
            {t("datenschutz.verwaltung.erledigen")}
          </Button>
          <Button onClick={() => setModus("ablehnen")} data-testid="loeschantrag-ablehnen">
            {t("datenschutz.verwaltung.ablehnen")}
          </Button>
          <Button
            variant="ghost"
            disabled={auskunft.isPending}
            onClick={() => auskunft.mutate()}
            data-testid="loeschantrag-auskunft"
          >
            <Download size={14} /> {t("datenschutz.verwaltung.auskunft")}
          </Button>
        </div>
      ) : null}
      {antrag.status === "offen" && modus === "loeschen" ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-text">{t("datenschutz.verwaltung.bestaetigen", { name })}</span>
          <Button
            variant="danger"
            disabled={erledigen.isPending}
            onClick={() => erledigen.mutate()}
            data-testid="loeschantrag-erledigen-ja"
          >
            {t("datenschutz.verwaltung.ja")}
          </Button>
          <Button variant="ghost" onClick={() => setModus("ruhe")}>
            {t("datenschutz.verwaltung.abbrechen")}
          </Button>
        </div>
      ) : null}
      {antrag.status === "offen" && modus === "ablehnen" ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            setFehler(null);
            ablehnen.mutate();
          }}
        >
          <Field label={t("datenschutz.verwaltung.grund")}>
            <TextInput
              value={grund}
              onChange={(e) => setGrund(e.target.value)}
              maxLength={2000}
              required
              data-testid="loeschantrag-grund"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="primary"
              disabled={ablehnen.isPending}
              data-testid="loeschantrag-ablehnen-senden"
            >
              {t("datenschutz.verwaltung.ablehnenSenden")}
            </Button>
            <Button variant="ghost" onClick={() => setModus("ruhe")}>
              {t("datenschutz.verwaltung.abbrechen")}
            </Button>
          </div>
        </form>
      ) : null}
      {fehler ? (
        <div
          role="alert"
          className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text"
        >
          {fehler}
        </div>
      ) : null}
    </li>
  );
}

function AuskunftFuerKonto(): JSX.Element {
  const { t } = useTranslation();
  const fehlertext = useAntragsfehler();
  const konten = useUsers();
  const [auswahl, setAuswahl] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const laden = useMutation({
    mutationFn: () => datenschutzApi.auskunftFuer(auswahl),
    onSuccess: (a) => {
      setFehler(null);
      alsDateiSpeichern(
        JSON.stringify(a, null, 2),
        `klarwerk-auskunft-${a.nutzerId}-${dateistempel(a.erzeugtAm)}.json`,
        "application/json;charset=utf-8",
      );
    },
    onError: (e) => setFehler(fehlertext(e)),
  });
  return (
    <Abfragehuelle abfrage={konten}>
      {(liste) => (
        <div className="space-y-2">
          <Field label={t("datenschutz.verwaltung.kontoWaehlen")}>
            <select
              value={auswahl}
              onChange={(e) => setAuswahl(e.target.value)}
              data-testid="auskunft-konto"
              className="h-10 w-full rounded-input border border-hairline bg-surface px-3 text-sm text-text"
            >
              <option value="">—</option>
              {liste.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name} ({k.email})
                </option>
              ))}
            </select>
          </Field>
          <Button
            disabled={auswahl === "" || laden.isPending}
            onClick={() => laden.mutate()}
            data-testid="auskunft-laden"
          >
            <Download size={14} /> {t("datenschutz.verwaltung.auskunftLaden")}
          </Button>
          {fehler ? (
            <div role="alert" className="text-[12.5px] text-trust-crit-text">
              {fehler}
            </div>
          ) : null}
        </div>
      )}
    </Abfragehuelle>
  );
}

export function BetroffenenrechteVerwaltung(): JSX.Element {
  const { t } = useTranslation();
  const fehlertext = useAntragsfehler();
  const [fehler, setFehler] = useState<string | null>(null);
  const antraege = useQuery({
    queryKey: ALLE_ANTRAEGE_KEY,
    queryFn: datenschutzApi.alleAntraege,
    retry: false,
  });
  const verzeichnis = useQuery({
    queryKey: VERZEICHNIS_KEY,
    queryFn: datenschutzApi.verzeichnis,
    retry: false,
  });
  const markdown = useMutation({
    mutationFn: () => datenschutzApi.verzeichnisMarkdown(),
    onSuccess: (text) =>
      alsDateiSpeichern(
        text,
        `klarwerk-verarbeitungsverzeichnis-${dateistempel(new Date().toISOString())}.md`,
        "text/markdown;charset=utf-8",
      ),
    onError: (e) => setFehler(fehlertext(e)),
  });
  return (
    <div className="space-y-4" data-testid="betroffenenrechte-verwaltung">
      <Kicker>{t("datenschutz.verwaltung.antraege")}</Kicker>
      <p className="text-[12px] leading-relaxed text-muted-2">
        {t("datenschutz.verwaltung.wirkung")}
      </p>
      <Abfragehuelle abfrage={antraege}>
        {({ antraege: liste }) =>
          liste.length === 0 ? (
            <p className="text-[12.5px] text-muted-2" data-testid="loeschantraege-leer">
              {t("datenschutz.verwaltung.keine")}
            </p>
          ) : (
            <ul className={LISTE} data-testid="loeschantraege-liste">
              {liste.map((a) => (
                <AntragZeile key={a.id} antrag={a} />
              ))}
            </ul>
          )
        }
      </Abfragehuelle>

      <Kicker>{t("datenschutz.verwaltung.auskunftKonto")}</Kicker>
      <AuskunftFuerKonto />

      <Kicker>{t("datenschutz.verwaltung.verzeichnis")}</Kicker>
      <Abfragehuelle abfrage={verzeichnis}>
        {(v) => (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  alsDateiSpeichern(
                    JSON.stringify(v, null, 2),
                    `klarwerk-verarbeitungsverzeichnis-${dateistempel(v.erzeugtAm)}.json`,
                    "application/json;charset=utf-8",
                  )
                }
                data-testid="verzeichnis-json"
              >
                <Download size={14} /> {t("datenschutz.verwaltung.verzeichnisJson")}
              </Button>
              <Button
                disabled={markdown.isPending}
                onClick={() => markdown.mutate()}
                data-testid="verzeichnis-markdown"
              >
                <Download size={14} /> {t("datenschutz.verwaltung.verzeichnisMd")}
              </Button>
            </div>
            {fehler ? (
              <div role="alert" className="text-[12.5px] text-trust-crit-text">
                {fehler}
              </div>
            ) : null}
            <Kicker>{t("datenschutz.verwaltung.inventar")}</Kicker>
            <ul className={LISTE} data-testid="dateninventar">
              {v.datenarten.map((d) => (
                <li key={d.id} className="px-3 py-2 text-[12.5px]">
                  <span className="font-semibold text-text">{d.name}</span>
                  <span className="text-muted-2">
                    {" "}
                    · {t(`datenschutz.verwaltung.bezug.${d.personenbezug}`)} ·{" "}
                    {d.ablage.tabellen.length > 0 ? d.ablage.tabellen.join(", ") : d.ablage.ort}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Abfragehuelle>
    </div>
  );
}
