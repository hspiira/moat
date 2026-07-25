"use client";

import { PinInputField } from "@/components/forms/pin-input-field";
import { MIN_PIN_LENGTH } from "@/lib/security/pin-policy";

import type { SecuritySetupState } from "./use-onboarding-workspace";

type Props = {
  security: SecuritySetupState;
  onSecurityChange: (updater: (prev: SecuritySetupState) => SecuritySetupState) => void;
};

export function SecurityStep({ security, onSecurityChange }: Props) {
  return (
    <>
      <div className="flex items-start gap-3 rounded-md border border-border/40 bg-muted/20 px-4 py-3">
        <input
          id="security-enabled"
          type="checkbox"
          checked={security.enabled}
          onChange={(e) =>
            onSecurityChange((c) => ({ ...c, enabled: e.target.checked }))
          }
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
        />
        <label
          htmlFor="security-enabled"
          className="cursor-pointer text-sm leading-relaxed text-muted-foreground"
        >
          Protect Moat with a PIN and encrypt my data on this device
        </label>
      </div>

      {security.enabled ? (
        <>
          <PinInputField
            id="security-pin"
            label={`Choose a PIN (minimum ${MIN_PIN_LENGTH} digits)`}
            value={security.pin}
            onChange={(value) => onSecurityChange((c) => ({ ...c, pin: value }))}
            placeholder="e.g. 6 or more digits"
            autoComplete="new-password"
          />

          <PinInputField
            id="security-pin-confirm"
            label="Confirm PIN"
            value={security.confirmPin}
            onChange={(value) => onSecurityChange((c) => ({ ...c, confirmPin: value }))}
            autoComplete="new-password"
          />

          <p className="text-xs text-muted-foreground">
            Moat locks after 5 minutes of inactivity. There is no PIN recovery —
            if you forget it, restore from an encrypted backup instead.
          </p>
        </>
      ) : (
        <div className="rounded-md border border-border/40 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Without a PIN, anyone who picks up this device can open Moat and see your
          finances. You can turn a PIN on anytime from Settings.
        </div>
      )}
    </>
  );
}
