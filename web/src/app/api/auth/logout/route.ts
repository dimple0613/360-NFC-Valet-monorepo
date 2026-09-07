import { NextResponse } from "next/server";

// Driver tokens are stateless Bearer JWTs (the app keeps them in its own
// storage), so "logout" is a no-op server-side — the app drops its token.
export async function POST() {
  return NextResponse.json({ signedOut: true });
}