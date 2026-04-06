"use client";

import { Button } from "@/components/ui/button";

export type TransactionsViewSection = "ledger" | "capture" | "review" | "tools";

const sectionLabels: Record<TransactionsViewSection, string> = {
  ledger: "Ledger",
  capture: "Capture",
  review: "Review",
  tools: "Tools",
};

type Props = {
  activeSection: TransactionsViewSection;
  onSectionChange: (section: TransactionsViewSection) => void;
};

export function TransactionsSectionSwitcher({
  activeSection,
  onSectionChange,
}: Props) {
  const sections = Object.keys(sectionLabels) as TransactionsViewSection[];

  return (
    <div className="flex flex-wrap gap-2">
      {sections.map((section) => (
        <Button
          key={section}
          type="button"
          size="sm"
          variant={activeSection === section ? "default" : "outline"}
          onClick={() => onSectionChange(section)}
        >
          {sectionLabels[section]}
        </Button>
      ))}
    </div>
  );
}
