import { requireValetPage } from "../_lib/valet-permissions";
import { getOffers } from "../_lib/valet-data";
import { OffersManager } from "./offers-manager";

export default async function OffersPage() {
  const identity = await requireValetPage("valet.offer.read");
  const data = await getOffers({ organizationId: identity.session.organizationId ?? null });
  const fields = data.properties.map((p) => ({ id: p.id, name: p.name }));
  return (
    <OffersManager initialOffers={data.offers} fields={fields} />
  );
}
