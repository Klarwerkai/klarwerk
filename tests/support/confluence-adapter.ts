import {
  type ConfluenceSourceAdapter,
  adapterFromClient,
} from "../../services/confluence/src/adapter";
import {
  ConfluenceRestClient,
  type ConfluenceRestConfig,
} from "../../services/confluence/src/rest-client";

// R-1349: Bis hierher stand dieser Einstieg als `adapterFromConfig` im Produktmodul
// `services/confluence/src/adapter.ts`. Kein Produktweg hat ihn gerufen — nur Tests, die den
// echten Adapter mit injiziertem `fetchFn` fahren. Er liegt deshalb hier; der Adapter selbst ist
// unverändert der echte, gebaut über denselben `adapterFromClient` wie im Betrieb.
export function adapterFromConfig(config: ConfluenceRestConfig): ConfluenceSourceAdapter {
  return adapterFromClient(new ConfluenceRestClient(config));
}
