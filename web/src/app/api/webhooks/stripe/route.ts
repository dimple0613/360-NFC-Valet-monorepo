import { NextRequest, NextResponse } from "next/server";
import { createStripeProvider, InvalidWebhookSignatureError, MissingStripeConfigError } from "@saasclaude/db";

// FR-213: Stripe webhooks are authenticated by signature (verified against
// STRIPE_WEBHOOK_SECRET), not an API key or session — the organization is
// resolved from the event's own metadata once verified (see
// stripe-provider.ts's handleWebhookEvent), not a tenant context set up
// front. Deliberately does NOT go through withApiTenantContext for that
// reason — there is no bearer credential here to verify against an org.
export async function POST(req: NextRequest): Promise<Response> {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  // The raw, unparsed body is required for signature verification — Stripe
  // signs the exact bytes it sent, so re-serializing JSON would invalidate it.
  const rawBody = await req.text();
  const provider = createStripeProvider();

  try {
    const event = await provider.verifyWebhookEvent(rawBody, signature);
    await provider.handleWebhookEvent(event);
  } catch (error) {
    if (error instanceof MissingStripeConfigError) {
      console.error(error);
      return NextResponse.json({ error: "Stripe is not configured on this server." }, { status: 500 });
    }
    if (error instanceof InvalidWebhookSignatureError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  return NextResponse.json({ received: true });
}
