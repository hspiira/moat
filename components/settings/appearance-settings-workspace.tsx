"use client";

import { useTheme } from "next-themes";
import { IconDeviceLaptop, IconMoon, IconSun } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";

import { SettingsDetailShell } from "./settings-detail-shell";

const OPTIONS = [
  { value: "light", label: "Light", icon: IconSun },
  { value: "dark", label: "Dark", icon: IconMoon },
  { value: "system", label: "Match device", icon: IconDeviceLaptop },
] as const;

export function AppearanceSettingsWorkspace() {
  // Reads the stored choice the same way the rest of the app does. Until
  // next-themes has it, nothing is marked selected rather than the wrong one.
  const { theme, setTheme } = useTheme();

  return (
    <SettingsDetailShell
      title="Appearance"
      description="How Moat looks on this device. The choice is remembered here, not synced."
    >
      <div role="radiogroup" aria-label="Theme" className="grid gap-2">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = theme === option.value;

          return (
            <Button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              variant={isSelected ? "secondary" : "outline"}
              className="h-auto justify-start gap-3 px-4 py-3 text-sm"
              onClick={() => setTheme(option.value)}
            >
              <Icon aria-hidden className="size-4 shrink-0" />
              {option.label}
            </Button>
          );
        })}
      </div>
    </SettingsDetailShell>
  );
}
