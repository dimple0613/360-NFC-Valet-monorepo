import { TagIcon } from "lucide-react";
import { requireIdentity } from "@/lib/auth/current-user";
import { getOffers } from "../_lib/valet-data";
import { OffersManager } from "./offers-manager";

export default async function OffersPage() {
  const identity = await requireIdentity();
  const data = await getOffers({ organizationId: identity.session.organizationId ?? null });
  const fields = data.properties.map((p) => ({ id: p.id, name: p.name }));
  return (
    <div className="flex flex-col gap-6">
      <OffersManager initialOffers={data.offers} fields={fields} />
    </div>
  );
}
