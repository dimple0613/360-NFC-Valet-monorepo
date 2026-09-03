/**
 * print-invoice — generate a print-ready, invoice-style document directly from
 * the database for a subscription's billing activity.
 *
 * Usage (from packages/db):
 *   npx tsx scripts/print-invoice.ts [subscriptionId]
 *
 * If no subscriptionId is given it prints the first subscription of the first
 * org (a smoke-test default). Output is plain text (ASCII/Unicode) so it can be
 * copied straight into a printer or a PDF.
 *
 * NOTE: standalone Node script — must use relative "../src/..." imports, not the
 * "@saasclaude/db" alias (that only resolves through the Next bundler).
 */
import { prismaWithoutTenantScoping } from "../src/client";
import { resolveTaxRatePercent } from "../src/billing/tax";

const div = "=".repeat(72);

function money(cents: number, currency: string): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: currency.toUpperCase() as string,
  });
}

function titleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function pad(text: string, width: number): string {
  return text.padEnd(width);
}
function padLeft(text: string, width: number): string {
  return text.padStart(width);
}

async function main() {
  const arg = process.argv[2];

  const target = arg
    ? { id: arg }
    : await prismaWithoutTenantScoping.subscription.findFirst({
        select: { id: true },
      }).then((s) => (s ? { id: s.id } : null));

  if (!target) {
    console.log("No subscription found. Pass a subscription id: npx tsx scripts/print-invoice.ts <subscriptionId>");
    return;
  }

  const subscription = await prismaWithoutTenantScoping.subscription.findUnique({
    where: target,
    include: { plan: true, organization: true },
  });
  if (!subscription) {
    console.log(`No subscription found for id "${arg}".`);
    process.exitCode = 1;
    return;
  }

  const org = subscription.organization;
  const taxRatePercent = await resolveTaxRatePercent(org.country ?? null);

  const invoices = await prismaWithoutTenantScoping.invoice.findMany({
    where: { subscriptionId: subscription.id },
    include: { lineItems: true },
    orderBy: { createdAt: "asc" },
  });

  const events = await prismaWithoutTenantScoping.subscriptionEvent.findMany({
    where: { subscriptionId: subscription.id },
    orderBy: { createdAt: "asc" },
  });

  // ---- Header / bill-to ----------------------------------------------------
  console.log(div);
  console.log("INVOICE STATEMENT");
  console.log(div);
  console.log(`Billed to : ${org.name}${org.slug ? ` (${org.slug})` : ""}`);
  if (org.addressLine1) console.log(`Address   : ${org.addressLine1}`);
  if (org.city || org.region || org.postalCode)
    console.log(`            ${[org.city, org.region, org.postalCode].filter(Boolean).join(", ")}`);
  if (org.country) console.log(`            ${org.country}`);
  if (org.contactEmail) console.log(`Email     : ${org.contactEmail}`);
  console.log("");
  console.log(`Subscription status : ${titleCase(subscription.status)}`);
  console.log(`Plan                : ${subscription.plan.name}`);
  console.log(`Tax rate            : ${taxRatePercent > 0 ? `${taxRatePercent}%` : "0%"}`);
  console.log(`Period     (start)  : ${subscription.currentPeriodStart?.toISOString().slice(0, 10) ?? "—"}`);
  console.log(`Period       (end)  : ${subscription.currentPeriodEnd?.toISOString().slice(0, 10) ?? "—"}`);
  console.log(div);

  if (invoices.length === 0) {
    console.log("No invoices issued for this subscription.");
  }

  for (const invoice of invoices) {
    console.log("");
    console.log(`Invoice    : ${invoice.number ?? "(draft)"}`);
    console.log(`Status     : ${titleCase(invoice.status)}`);
    console.log(`Issued     : ${invoice.issuedAt ? invoice.issuedAt.toISOString().slice(0, 10) : "—"}`);
    console.log(`Due        : ${invoice.dueAt ? invoice.dueAt.toISOString().slice(0, 10) : "—"}`);
    console.log(`Paid       : ${invoice.paidAt ? invoice.paidAt.toISOString().slice(0, 10) : "—"}`);
    console.log("");

    const descriptionCol = 52;
    const qtyCol = 8;
    const amountCol = 12;

    console.log(
      `${pad("Description", descriptionCol)}${padLeft("Qty", qtyCol - 1)}  ${padLeft("Amount", amountCol)}`,
    );
    console.log("-".repeat(72));

    for (const item of invoice.lineItems) {
      const qty = (item.quantity ?? 1).toString();
      console.log(
        `${pad(item.description, descriptionCol)}${padLeft(qty, qtyCol)}  ${padLeft(money(item.amountCents, invoice.currency), amountCol)}`,
      );
    }
    console.log("-".repeat(72));
    console.log(`${pad("", descriptionCol)}${padLeft("Subtotal", qtyCol)}  ${padLeft(money(invoice.subtotalCents, invoice.currency), amountCol)}`);
    console.log(`${pad("", descriptionCol)}${padLeft("Tax", qtyCol)}  ${padLeft(money(invoice.taxCents, invoice.currency), amountCol)}`);
    console.log(`${pad("", descriptionCol)}${padLeft("TOTAL", qtyCol)}  ${padLeft(money(invoice.totalCents, invoice.currency), amountCol)}`);
  }

  // ---- Logs ---------------------------------------------------------------
  if (events.length > 0) {
    console.log("");
    console.log(div);
    console.log("ACTIVITY LOG");
    console.log(div);
    console.log(`${pad("Date", 24)}  ${pad("Event", 24)}  Actor`);
    console.log("-".repeat(72));
    for (const event of events) {
      const actor = event.actorUserId ?? "system";
      console.log(`${pad(event.createdAt.toISOString().slice(0, 16).replace("T", " "), 24)}  ${pad(titleCase(event.type), 24)}  ${actor}`);
    }
  }

  console.log("");
  console.log(div);
  console.log("Generated from platform database. Statement prepared for print.");
  console.log(div);
}

function padLength(text: string, width: number): string {
  return text.padStart(width);
}
function padFromLeft(text: string, width: number): string {
  return text.padStart(width);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prismaWithoutTenantScoping.$disconnect();
  });