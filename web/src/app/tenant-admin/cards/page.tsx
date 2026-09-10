import { requireValetPage } from "../_lib/valet-permissions";
import { PageHeader } from "@/components/page-header";
import { getUserPlatformPermissions } from "../../../lib/db";
import { listCardsForTable } from "../_lib/valet-data";
import { CardsTable } from "./cards-table";
import { NfcIcon } from "lucide-react";

export default async function CardsPage() {
  const identity = await requireValetPage("valet.card.read");

  const orgScope = identity.session.organizationId ?? null;
  const data = await listCardsForTable({
    q: "",
    page: 1,
    pageSize: 15,
    sortBy: "uid",
    sortDir: "asc",
    status: "all",
    property: "all",
    organizationId: orgScope,
  });

  // #48: running the print/export workflow is a platform permission
  // (valet.card.print).
  const platformUserId = identity.session.impersonatorUserId ?? identity.user.id;
  const platformPermissions = await getUserPlatformPermissions(platformUserId);
  const canPrintCards = platformPermissions.includes("valet.card.print");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="NFC Cards"
        description={`${data.totalCount} cards${data.properties.length ? ` across ${data.properties.length} properties` : ""}`}
        icon={<NfcIcon />}
      />

      <CardsTable organizationId={orgScope} canFreeze={canPrintCards} hideCreate hidePrint />
    </div>
  );
}
