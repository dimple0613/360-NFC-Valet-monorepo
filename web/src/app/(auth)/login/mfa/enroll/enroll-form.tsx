"use client";

import { useEffect, useRef, useState, useActionState } from "react";
import {
  beginEnrollAction,
  confirmEnrollAction,
  finishEnrollmentAction,
  type BeginEnrollResult,
  type ConfirmEnrollState,
} from "./actions";

const initialConfirmState: ConfirmEnrollState = { error: null, recoveryCodes: null };

export function EnrollMfaForm() {
  const [enrollment, setEnrollment] = useState<BeginEnrollResult | null>(null);
  const [beginError, setBeginError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [confirmState, confirmAction, confirmPending] = useActionState(
    async (prevState: ConfirmEnrollState, formData: FormData) => confirmEnrollAction(prevState, formData),
    initialConfirmState,
  );

  const beganRef = useRef(false);
  useEffect(() => {
    if (beganRef.current) return;
    beganRef.current = true;
    beginEnrollAction()
      .then((result) => setEnrollment(result))
      .catch(() => setBeginError("Something went wrong starting enrollment. Please try again."));
  }, []);

  if (confirmState.recoveryCodes) {
    return (
      <div>
        <div className="login-title">Two-factor authentication enabled</div>
        <div className="login-desc">Save these recovery codes now — they will not be shown again.</div>
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-[#e7eaf0] bg-[#fafbfc] p-4 text-sm">
          {confirmState.recoveryCodes.map((code) => (
            <div key={code}>{code}</div>
          ))}
        </div>
        <button
          className="btn-login mt-4 w-full"
          type="button"
          disabled={finishing}
          onClick={async () => {
            setFinishing(true);
            try {
              await finishEnrollmentAction();
            } catch {
              // finishEnrollmentAction redirect()s on success — treat the throw as success.
              setFinishing(false);
            }
          }}
        >
          {finishing ? "Signing you in..." : "Continue to your dashboard"}
        </button>
      </div>
    );
  }

  if (beginError) {
    return (
      <div>
        <div className="login-title">Two-factor authentication required</div>
        <div className="login-desc">{beginError}</div>
        <a className="btn-login mt-4 inline-block text-center" href="/login">
          Sign in again
        </a>
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div>
        <div className="login-title">Two-factor authentication required</div>
        <div className="login-desc">Your organization requires a second factor. Preparing your enrollment…</div>
      </div>
    );
  }

  return (
    <div>
      <div className="login-title">Set up two-factor authentication</div>
      <div className="login-desc">
        Scan this QR code with your authenticator app, then enter a 6-digit code to confirm.
      </div>
      <div className="mt-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={enrollment.qrDataUri}
          alt="Scan this QR code with your authenticator app"
          width={200}
          height={200}
          className="rounded-md border border-[#e7eaf0]"
        />
        <p className="mt-2 text-sm text-muted-foreground">
          Or enter this code manually: <code>{enrollment.secret}</code>
        </p>
      </div>
      <form className="login-form" action={confirmAction}>
        {confirmState.error ? <div className="field-error">{confirmState.error}</div> : null}
        <div className="login-fields">
          <div className={`login-field${confirmState.error ? " login-field-error" : ""}`}>
            <div style={{ flex: 1 }}>
              <label className="login-field-label" htmlFor="code">
                Code
              </label>
              <input
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                className="login-field-input dots"
                placeholder="••••••"
              />
            </div>
          </div>
        </div>
        <button className="btn-login" type="submit" disabled={confirmPending}>
          {confirmPending ? "Verifying..." : "Verify and enable"}
        </button>
      </form>
    </div>
  );
}