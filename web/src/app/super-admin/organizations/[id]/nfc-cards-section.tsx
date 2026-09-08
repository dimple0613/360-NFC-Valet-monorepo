import { getUserPlatformPermissions } from "@saasclaude/db";
import { CardsTable } from "@/app/tenant-admin/cards/cards-table";

// #48: Super Admin's per-organization NFC card surface, rendered as the
// "NFC Cards" tab on /super-admin/organizations/[id]. Cards are scoped to the
// org's own properties plus the platform deck's unassigned inventory, with the
// batch print designer (multi-select -> profile -> export PDF) available for
// the org's cards. Print/freeze stays a platform permission
// (valet.card.print); the table itself fetches list data client-side through
// the same API the tenant cards page uses, passing the explicit
// organizationId so the platform scope is preserved.
export default async function NfcCardsSection({
  organizationId,
  platformUserId,
}: {
  organizationId: string;
  platformUserId: string;
}) {
  const platformPermissions = await getUserPlatformPermissions(platformUserId);
  const canPrintCards = platformPermissions.includes("valet.card.print");

  return (
    <CardsTable
      organizationId={organizationId}
      canFreeze={canPrintCards}
      showDeck
    />
  );
}
