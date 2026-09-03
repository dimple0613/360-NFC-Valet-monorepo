"use client";

import { useActionState, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  beginMfaEnrollmentAction,
  confirmMfaEnrollmentAction,
  disableMfaAction,
  type BeginEnrollmentResult,
  type ConfirmEnrollmentState,
  type DisableMfaState,
} from "./actions";

const initialConfirmState: ConfirmEnrollmentState = { error: null, recoveryCodes: null };
const initialDisableState: DisableMfaState = { error: null };

type Step = "status" | "enrolling" | "recovery-codes";

export function MfaSection({ mfaEnabled: initialMfaEnabled }: { mfaEnabled: boolean }) {
  const [mfaEnabled, setMfaEnabled] = useState(initialMfaEnabled);
  const [step, setStep] = useState<Step>("status");
  const [enrollment, setEnrollment] = useState<BeginEnrollmentResult | null>(null);
  const [beginError, setBeginError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [confirmState, confirmAction, confirmPending] = useActionState(
    async (prevState: ConfirmEnrollmentState, formData: FormData) => {
      const result = await confirmMfaEnrollmentAction(prevState, formData);
      if (result.recoveryCodes) {
        setMfaEnabled(true);
        setStep("recovery-codes");
      }
      return result;
    },
    initialConfirmState,
  );

  const [disableState, disableAction, disablePending] = useActionState(
    async (prevState: DisableMfaState, formData: FormData) => {
      const result = await disableMfaAction(prevState, formData);
      if (!result.error) {
        setMfaEnabled(false);
        setStep("status");
      }
      return result;
    },
    initialDisableState,
  );

  function handleBeginEnrollment() {
    setBeginError(null);
    startTransition(async () => {
      try {
        const result = await beginMfaEnrollmentAction();
        setEnrollment(result);
        setStep("enrolling");
      } catch {
        setBeginError("Something went wrong starting enrollment. Please try again.");
      }
    });
  }

  if (step === "recovery-codes" && confirmState.recoveryCodes) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-[#0c9d61]/25 bg-[#ecfdf3] p-4 text-sm text-[#0c9d61]">
          Save these recovery codes now — each one can be used once if you lose access to your authenticator app.
          They will not be shown again.
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#e7eaf0] bg-[#fafbfc] p-4 text-sm">
          {confirmState.recoveryCodes.map((code) => (
            <div key={code}>{code}</div>
          ))}
        </div>
        <div>
          <button type="button" className="btn-primary" onClick={() => setStep("status")}>
            Done
          </button>
        </div>
      </div>
    );
  }

  if (step === "enrolling" && enrollment) {
    return (
      <form action={confirmAction} className="flex flex-col gap-4">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enrollment.qrDataUri}
            alt="Scan this QR code with your authenticator app"
            width={200}
            height={200}
            className="rounded-md border border-[#e7eaf0]"
          />
          <p className="mt-2 text-sm text-muted-foreground">
            Scan with your authenticator app, or enter this code manually:{" "}
            <code>{enrollment.secret}</code>
          </p>
        </div>
        {confirmState.error ? <div className="field-error">{confirmState.error}</div> : null}
        <div className="field">
          <label className="field-label" htmlFor="code">
            6-digit code
          </label>
          <input id="code" name="code" className="field-value input" autoComplete="one-time-code" autoFocus required />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={confirmPending}>
            {confirmPending ? "Verifying..." : "Verify and enable"}
          </button>
          <Button type="button" variant="outline" onClick={() => setStep("status")}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Status</span>
        <Badge variant={mfaEnabled ? "default" : "secondary"}>{mfaEnabled ? "Enabled" : "Disabled"}</Badge>
      </div>

      {!mfaEnabled ? (
        <div>
          {beginError ? <div className="field-error">{beginError}</div> : null}
          <button type="button" className="btn-primary" onClick={handleBeginEnrollment} disabled={isPending}>
            {isPending ? "Starting..." : "Enable two-factor authentication"}
          </button>
        </div>
      ) : (
        <form action={disableAction} className="flex flex-col gap-4">
          {disableState.error ? <div className="field-error">{disableState.error}</div> : null}
          <div className="field">
            <label className="field-label" htmlFor="disable-code">
              Enter your current 6-digit code to disable
            </label>
            <input id="disable-code" name="code" className="field-value input" autoComplete="one-time-code" required />
          </div>
          <div>
            <Button type="submit" variant="destructive" disabled={disablePending}>
              {disablePending ? "Disabling..." : "Disable two-factor authentication"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}