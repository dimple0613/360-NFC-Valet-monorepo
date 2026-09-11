import { TagIcon } from "lucide-react";
import { requireValetPage } from "../_lib/valet-permissions";
import { getOffers } from "../_lib/valet-data";
import { PageHeader } from "@/components/page-header";
import { OffersManager } from "./offers-manager";

export default async function OffersPage() {
  const identity = await requireValetPage("valet.offer.read");
  const data = await getOffers({ organizationId: identity.session.organizationId ?? null });
  const fields = data.properties.map((p) => ({ id: p.id, name: p.name }));
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<TagIcon className="size-5" />}
        title="Offers & promotions"
        description="Create and manage guest-facing offers, deals, and outlet promotions."
      />
      <OffersManager initialOffers={data.offers} fields={fields} />
    </div>
  );
}
