"use client";

import {
  IconBrandGoogleDrive,
  IconFileShredder,
  IconSparkles,
} from "@tabler/icons-react";

import { MoatMark } from "@/components/navigation/navigation-shared";
import { OnboardingRecoveryPanel } from "@/components/onboarding-recovery-panel";
import { AccountStep } from "@/components/onboarding/account-step";
import { GoalStep } from "@/components/onboarding/goal-step";
import { ProfileStep } from "@/components/onboarding/profile-step";
import { SecurityStep } from "@/components/onboarding/security-step";
import {
  stepLabels,
  steps,
  useOnboardingWorkspace,
} from "@/components/onboarding/use-onboarding-workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function OnboardingWorkspace() {
  const {
    form,
    setForm,
    account,
    setAccount,
    goal,
    setGoal,
    security,
    setSecurity,
    consentGiven,
    setConsentGiven,
    step,
    stepIndex,
    mode,
    setMode,
    isSubmitting,
    isChecking,
    error,
    handleNext,
    handleBack,
    handleSubmit,
    handleRestored,
  } = useOnboardingWorkspace();

  if (isChecking) {
    return null;
  }

  if (mode === "choose") {
    const modeOptions = [
      {
        mode: "fresh" as const,
        icon: IconSparkles,
        title: "Start fresh",
        description:
          "Create a new local profile, first account, and optional first goal on this device.",
      },
      {
        mode: "restore_file" as const,
        icon: IconFileShredder,
        title: "Restore encrypted file",
        description:
          "Use a backup file you previously downloaded and restore it with your backup PIN.",
      },
      {
        mode: "restore_drive" as const,
        icon: IconBrandGoogleDrive,
        title: "Restore from Google Drive",
        description:
          "Connect Google Drive, choose a Moat backup, and restore it with your backup PIN.",
      },
    ];

    return (
      <div className="mx-auto grid w-full max-w-2xl gap-6">
        <div className="space-y-2">
          <MoatMark className="h-12 w-12" />
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Get back into Moat
          </h1>
          <p className="text-sm text-muted-foreground">
            Start fresh on this device or restore an encrypted backup you already control.
          </p>
        </div>

        <div className="grid gap-3">
          {modeOptions.map((option) => {
            const OptionIcon = option.icon;
            return (
              <button
                key={option.mode}
                type="button"
                onClick={() => setMode(option.mode)}
                className="flex items-start gap-3 rounded-md border border-border/60 bg-card px-4 py-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/40"
              >
                <span
                  aria-hidden
                  className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"
                >
                  <OptionIcon className="size-4.5" />
                </span>
                <span className="grid gap-1">
                  <span className="text-sm font-medium text-foreground">{option.title}</span>
                  <span className="text-sm leading-6 text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (mode === "restore_file" || mode === "restore_drive") {
    return (
      <div className="mx-auto grid w-full max-w-2xl gap-6">
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {mode === "restore_file" ? "Restore your backup file" : "Restore from Google Drive"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Restore first, then continue in the app with the same local-first storage model.
          </p>
        </div>

        <OnboardingRecoveryPanel
          mode={mode === "restore_file" ? "file" : "drive"}
          onBack={() => setMode("choose")}
          onRestored={handleRestored}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <div className="space-y-2">
        <ol
          aria-label="Onboarding steps"
          className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
        >
          {steps.map((currentStep, index) => (
            <li
              key={currentStep}
              aria-current={index === stepIndex ? "step" : undefined}
              className={`rounded-full border px-3 py-1 transition-colors ${
                index === stepIndex
                  ? "border-primary bg-primary text-primary-foreground"
                  : index < stepIndex
                    ? "border-primary/40 text-foreground"
                    : "border-border/40"
              }`}
            >
              {index + 1}. {stepLabels[currentStep]}
            </li>
          ))}
        </ol>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {step === "profile"
            ? "Set up your profile"
            : step === "account"
              ? "Add your first account"
              : step === "goal"
                ? "Add your first goal"
                : "Protect your data"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {step === "profile"
            ? "Start with the basics. This stays local to your device."
            : step === "account"
              ? "A first account makes the ledger immediately usable."
              : step === "goal"
                ? "Goals are optional, but adding one makes the dashboard more useful on day one."
                : "A PIN encrypts your financial records on this device. This is the recommended default."}
        </p>
      </div>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5 shadow-none">
          <CardContent className="px-5 py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      <Card className="border-border/40 shadow-none">
        <CardContent className="pt-6">
          <form className="grid gap-5" onSubmit={handleSubmit}>
            {step === "profile" ? (
              <ProfileStep
                form={form}
                onFormChange={setForm}
                consentGiven={consentGiven}
                onConsentChange={setConsentGiven}
              />
            ) : null}

            {step === "account" ? (
              <AccountStep account={account} onAccountChange={setAccount} />
            ) : null}

            {step === "goal" ? <GoalStep goal={goal} onGoalChange={setGoal} /> : null}

            {step === "security" ? (
              <SecurityStep security={security} onSecurityChange={setSecurity} />
            ) : null}

            <div className="flex flex-wrap gap-2 pt-2">
              {stepIndex > 0 ? (
                <Button type="button" variant="outline" onClick={handleBack}>
                  Back
                </Button>
              ) : null}

              {step !== "security" ? (
                <Button type="button" onClick={() => void handleNext()}>
                  Continue
                </Button>
              ) : (
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Setting up..." : "Start tracking"}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        No account required. Progress is saved locally while you set up.
      </p>
    </div>
  );
}
