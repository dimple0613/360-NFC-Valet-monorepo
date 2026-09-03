import { verifyApiKey } from "../src/api-keys";
async function main() {
  try {
    await verifyApiKey("sk_bogus_test");
  } catch (error) {
    console.log("Caught (expected):", error instanceof Error ? error.constructor.name : error);
  }
}
main().catch((e) => {
  console.error("UNEXPECTED THROW:", e);
  process.exit(1);
});
