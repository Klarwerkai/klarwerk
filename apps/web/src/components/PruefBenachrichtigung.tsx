import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { endpoints } from "../api/endpoints";
import {
  type BrowserPushManager,
  type PushLage,
  type PushUmgebung,
  pushAusschalten,
  pushEinschalten,
  pushLage,
} from "../lib/geraetePush";
import { Zeile } from "./einstellungen/Zeilenkarte";
import { Button } from "./ui";

// R-0679 / FR-VAL-07 und R-1655 auf der Profilseite: zwei persönliche Einstellungen zur
// Prüfzuweisung — Push auf DIESEM Gerät und die Abmeldung von der automatischen Zuweisung.

/** Die echte Browser-Umgebung. Ohne Service Worker oder Push-Schnittstelle: `null`. */
export function browserPushUmgebung(): PushUmgebung {
  return {
    config: () => endpoints.push.config(),
    anmelden: (abo) => endpoints.push.anmelden(abo),
    abmelden: (endpoint) => endpoints.push.abmelden(endpoint),
    pushManager: async () => {
      if (!("serviceWorker" in navigator) || typeof window.PushManager === "undefined") {
        return null;
      }
      const reg = await navigator.serviceWorker.getRegistration();
      return reg ? (reg.pushManager as unknown as BrowserPushManager) : null;
    },
    erlaubnis: () => (typeof Notification === "undefined" ? null : Notification.permission),
    erlaubnisAnfragen: () => Notification.requestPermission(),
  };
}

export function GeraetePushZeile({
  umgebung = browserPushUmgebung(),
}: {
  umgebung?: PushUmgebung;
}): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const lage = useQuery({ queryKey: ["push", "lage"], queryFn: () => pushLage(umgebung) });
  const schalten = useMutation({
    mutationFn: (an: boolean) => (an ? pushEinschalten(umgebung) : pushAusschalten(umgebung)),
    onSuccess: (neu: PushLage) => qc.setQueryData(["push", "lage"], neu),
  });
  const aktuell = schalten.data ?? lage.data;
  const schaltbar = aktuell === "an" || aktuell === "aus";
  return (
    <Zeile
      label={t("prueferzuweisung.push.titel")}
      wert={aktuell ? t(`prueferzuweisung.push.lage.${aktuell}`) : "—"}
      testId="zeile-geraete-push"
      steuerung={
        schaltbar ? (
          <Button disabled={schalten.isPending} onClick={() => schalten.mutate(aktuell === "aus")}>
            {aktuell === "an"
              ? t("prueferzuweisung.push.ausschalten")
              : t("prueferzuweisung.push.einschalten")}
          </Button>
        ) : undefined
      }
    />
  );
}

export function AutoZuweisungZeile(): JSX.Element | null {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const stand = useQuery({
    queryKey: ["validation", "routing-optout"],
    queryFn: () => endpoints.validation.routingOptOut(),
  });
  const setzen = useMutation({
    mutationFn: (optOut: boolean) => endpoints.validation.setRoutingOptOut(optOut),
    onSuccess: (neu) => qc.setQueryData(["validation", "routing-optout"], neu),
  });
  const optOut = stand.data?.optOut;
  if (optOut === null) {
    return null;
  }
  return (
    <Zeile
      label={t("prueferzuweisung.routing.titel")}
      wert={
        optOut === undefined
          ? "—"
          : optOut
            ? t("prueferzuweisung.routing.abgemeldet")
            : t("prueferzuweisung.routing.angemeldet")
      }
      testId="zeile-auto-zuweisung"
      steuerung={
        optOut === undefined ? undefined : (
          <Button disabled={setzen.isPending} onClick={() => setzen.mutate(!optOut)}>
            {optOut
              ? t("prueferzuweisung.routing.anmelden")
              : t("prueferzuweisung.routing.abmelden")}
          </Button>
        )
      }
    />
  );
}
