import "dotenv/config";
import { createPayPalProvider } from "../../src/lib/db/billing/paypal-provider";
import { createPayPalClient, type PayPalRuntimeConfig } from "../../src/lib/db/billing/paypal-client";
import {
  setPaymentProviderEnabled,
  setPaymentProviderConfigValue,
  isPaymentProviderEnabled,
  hasRequiredPaymentProviderConfig,
} from "../../src/lib/db/billing/payment-provider-config";
import { paypalAdapter } from "../../src/lib/db/billing/paypal-provider";
import { getPaymentProviderAdapter } from "../../src/lib/db/billing/payment-provider-registry";

const CLIENT_ID = process.env.PAYPAL_CLIENT_ID ?? "BAAn5-Pf4v0simhc6d9XtQ8AkkbyG_ZTxfK8Csq7gUercOZM85LP9Qr5-31SIXotUxG1R3-pwMhFPRh2bA";
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET ?? "ECbQUuDRes0wsMhv-A5UTiOCf5rRfN55kpWBwzVJ2gt-iwjEQ8sVcyiAKdm-X0GQ9Hcg1DbaPMyorgNo";

async function main() {
  console.log("== step 1: write Settings-backed PayPal config ==");
  await setPaymentProviderEnabled("paypal", true);
  await setPaymentProviderConfigValue({ adapterId: "paypal", field: "client_id", value: CLIENT_ID, sensitive: false });
  await setPaymentProviderConfigValue({ adapterId: "paypal", field: "client_secret", value: CLIENT_SECRET, sensitive: true });
  await setPaymentProviderConfigValue({ adapterId: "paypal", field: "webhook_id", value: "placeholder-webhook-id-roundtrip", sensitive: false });
  await setPaymentProviderConfigValue({ adapterId: "paypal", field: "environment", value: "sandbox", sensitive: false });

  const enabled = await isPaymentProviderEnabled("paypal");
  const hasRequired = await hasRequiredPaymentProviderConfig({ id: "paypal", configFields: paypalAdapter.configFields });
  console.log(`enabled=${enabled} hasRequired=${hasRequired} adapterRegistered=${getPaymentProviderAdapter("paypal") === paypalAdapter}`);
  if (!enabled || !hasRequired) throw new Error("PayPal config did not persist/enable");

  console.log("== step 2: raw OAuth token round-trip ==");
  const config: PayPalRuntimeConfig = {
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    webhookId: "placeholder-webhook-id-roundtrip",
    environment: "sandbox",
  };
  const client = createPayPalClient(config);
  const token = await client.getAccessToken();
  console.log(`token acquired: ${token.slice(0, 12)}... (len=${token.length})`);

  console.log("== step 3: createCheckoutSession ==");
  const provider = createPayPalProvider();
  const configured = await provider.isConfigured();
  console.log(`isConfigured()=${configured}`);
  const result = await provider.createCheckoutSession({
    organizationId: "cmtuggisz003sv214aubmx6re",
    planKey: "pro-monthly",
    customerEmail: "paypalflowtest@test.com",
    successUrl: "http://localhost:3000/select-plan/success",
    cancelUrl: "http://localhost:3000/select-plan",
  });
  console.log(`providerSessionId=${result.providerSessionId}`);
  console.log(`approveLink=${result.checkoutUrl}`);
  console.log("ROUND-TRIP OK");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("ROUND-TRIP FAILED:");
    console.error(err instanceof Error ? err.stack ?? err.message : err);
    process.exit(1);
  });