import { NextRequest, NextResponse } from "next/server";
import { MissingPayPalConfigError, PayPalInvalidWebhookSignatureError, encodePayPalWebhookHeaders, paypalAdapter } from "@saasclaude/db";

// FR-213: PayPal webhooks are authenticated by PayPal's own
// verify-webhook-signature check (see paypal-provider.ts), not an API key or
// session — the organization is resolved from the event's own custom_id/
// linked-subscription lookup once verified (paypal-provider.ts's
// handleWebhookEvent), not a tenant context set up front. Deliberately does
// NOT go through withApiTenantContext, mirroring the Stripe webhook route
// exactly for the same reason: there is no bearer credential here to verify
// against an org.
//
// PayPal signs each delivery with FIVE headers (not one, unlike Stripe's
// single stripe-signature) — bundled into a single JSON string via
// encodePayPalWebhookHeaders so they fit the shared PaymentProvider
// contract's single `signatureHeader` parameter (see payment-provider.ts).
export async function POST(req: NextRequest): Promise<Response> {
  const transmissionId = req.headers.get("paypal-transmission-id");
  const transmissionTime = req.headers.get("paypal-transmission-time");
  const certUrl = req.headers.get("paypal-cert-url");
  const authAlgo = req.headers.get("paypal-auth-algo");
  const transmissionSig = req.headers.get("paypal-transmission-sig");

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    return NextResponse.json({ error: "Missing one or more paypal-transmission-*/paypal-auth-algo headers" }, { status: 400 });
  }

  const rawBody = await req.text();
  const signatureHeader = encodePayPalWebhookHeaders({ transmissionId, transmissionTime, certUrl, authAlgo, transmissionSig });

  try {
    const event = await paypalAdapter.verifyWebhookEvent(rawBody, signatureHeader);
    await paypalAdapter.handleWebhookEvent(event);
  } catch (error) {
    if (error instanceof MissingPayPalConfigError) {
      console.error(error);
      return NextResponse.json({ error: "PayPal is not configured on this server." }, { status: 500 });
    }
    if (error instanceof PayPalInvalidWebhookSignatureError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  return NextResponse.json({ received: true });
}
