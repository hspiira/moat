"use client";

import { formatMoney } from "@/lib/currency";
import type { Account, Category, SupportedCurrency, TransactionType } from "@/lib/types";
import { InputField } from "@/components/forms/input-field";
import { SelectField } from "@/components/forms/select-field";
import {
  optionsFromRecord,
  supportedCurrencyOptionLabels,
} from "@/lib/select-options";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { CsvFieldKey, CsvMappings, ImportPreviewRow } from "./csv-import-utils";
import { categoryMatchesType } from "./transaction-form";

export const csvFieldLabels: [CsvFieldKey, string][] = [
  ["date", "Date column"],
  ["amount", "Amount column"],
  ["currency", "Currency column"],
  ["fxRate", "FX rate column"],
  ["payee", "Payee column"],
  ["note", "Note column"],
  ["type", "Type column"],
  ["category", "Category column"],
  ["account", "Account column"],
];

export const defaultTypeOptions = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "savings_contribution", label: "Savings" },
  { value: "debt_payment", label: "Debt payment" },
];

export function CsvMappingCard({
  csvHeaders,
  csvMappings,
  onMappingChange,
}: {
  csvHeaders: string[];
  csvMappings: CsvMappings;
  onMappingChange: (field: CsvFieldKey, value: string) => void;
}) {
  return (
    <Card className="border-border/20 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">1. Map columns</CardTitle>
        <CardDescription>Match your CSV headings to Moat fields.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {csvFieldLabels.map(([field, label]) => (
          <SelectField
            key={field}
            label={label}
            value={csvMappings[field] || "__none__"}
            options={[
              { value: "__none__", label: "Not mapped" },
              ...csvHeaders.map((header) => ({ value: header, label: header })),
            ]}
            onValueChange={(value) => onMappingChange(field, value === "__none__" ? "" : value)}
            placeholder="Not mapped"
          />
        ))}
      </CardContent>
    </Card>
  );
}

export function CsvDefaultsCard({
  accounts,
  categories,
  defaultImportType,
  defaultImportAccountId,
  defaultImportCategoryId,
  defaultImportCurrency,
  defaultImportFxRate,
  onTypeChange,
  onAccountChange,
  onCategoryChange,
  onCurrencyChange,
  onFxRateChange,
}: {
  accounts: Account[];
  categories: Category[];
  defaultImportType: Exclude<TransactionType, "transfer">;
  defaultImportAccountId: string;
  defaultImportCategoryId: string;
  defaultImportCurrency: SupportedCurrency;
  defaultImportFxRate: string;
  onTypeChange: (value: Exclude<TransactionType, "transfer">) => void;
  onAccountChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onCurrencyChange: (value: SupportedCurrency) => void;
  onFxRateChange: (value: string) => void;
}) {
  const importCategories = categories.filter((category) =>
    categoryMatchesType(category, defaultImportType),
  );

  return (
    <Card className="moat-panel-yellow border-border/20 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-foreground">2. Fill gaps</CardTitle>
        <CardDescription className="text-foreground/72">
          Set defaults for rows that do not carry enough information.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <SelectField
          label="Default type"
          value={defaultImportType}
          options={defaultTypeOptions}
          onValueChange={(value) => onTypeChange(value as Exclude<TransactionType, "transfer">)}
        />

        <SelectField
          label="Default account"
          value={defaultImportAccountId || "__none__"}
          options={[
            { value: "__none__", label: "None" },
            ...accounts.map((account) => ({ value: account.id, label: account.name })),
          ]}
          onValueChange={(value) => onAccountChange(value === "__none__" ? "" : value)}
          placeholder="None"
        />

        <SelectField
          label="Default category"
          value={defaultImportCategoryId || "__none__"}
          options={[
            { value: "__none__", label: "None" },
            ...importCategories.map((category) => ({
              value: category.id,
              label: category.name,
            })),
          ]}
          onValueChange={(value) => onCategoryChange(value === "__none__" ? "" : value)}
          placeholder="None"
        />

        <SelectField
          label="Default currency"
          value={defaultImportCurrency}
          options={optionsFromRecord(supportedCurrencyOptionLabels)}
          onValueChange={(value) => onCurrencyChange(value as SupportedCurrency)}
        />

        <InputField
          id="csv-default-fx-rate"
          label="Default FX rate to UGX"
          inputMode="decimal"
          value={defaultImportFxRate}
          onChange={(event) => onFxRateChange(event.target.value)}
          placeholder="Only for foreign-currency rows"
          disabled={defaultImportCurrency === "UGX"}
        />
      </CardContent>
    </Card>
  );
}

export function CsvReviewCard({
  importName,
  validImportCount,
  duplicateCount,
  foreignCurrencyCount,
  isImporting,
  onImport,
  onClear,
}: {
  importName: string;
  validImportCount: number;
  duplicateCount: number;
  foreignCurrencyCount: number;
  isImporting: boolean;
  onImport: () => void;
  onClear: () => void;
}) {
  return (
    <Card className="moat-panel-mint border-border/20 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-foreground">3. Review import</CardTitle>
        <CardDescription className="text-foreground/72">
          {importName} · {validImportCount} valid row
          {validImportCount !== 1 ? "s" : ""} · {duplicateCount} likely duplicates
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid grid-cols-3 gap-3">
          {[
            ["Valid rows", String(validImportCount)],
            ["Duplicates", String(duplicateCount)],
            ["FX rows", String(foreignCurrencyCount)],
          ].map(([label, value]) => (
            <div key={label} className="border border-border/20 bg-background/60 px-3 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {label}
              </div>
              <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={isImporting || validImportCount === 0} onClick={onImport}>
            {isImporting ? "Importing..." : `Import ${validImportCount} rows`}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onClear}>
            Clear
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function CsvPreviewCard({
  previewRows,
  accounts,
  categories,
}: {
  previewRows: ImportPreviewRow[];
  accounts: Account[];
  categories: Category[];
}) {
  return (
    <Card className="border-border/20 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Preview</CardTitle>
        <CardDescription>First six rows after mapping and fallback rules.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {previewRows.map((row, index) => {
          const account = accounts.find((entry) => entry.id === row.accountId);
          const category = categories.find((entry) => entry.id === row.categoryId);

          return (
            <div
              key={row.id}
              className={`border px-3 py-3 text-sm ${
                row.issues.length > 0
                  ? "border-destructive/30 bg-destructive/5"
                  : index === 0
                    ? "moat-panel-sage border-border/20"
                    : index % 2 === 0
                      ? "moat-panel-mint border-border/20"
                      : "bg-muted/20 border-border/20"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Row {row.rowIndex}
                </span>
                <span className="text-sm tabular-nums text-foreground">
                  {formatMoney(row.originalAmount, row.currency)}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {row.occurredOn || "no date"} · {account?.name ?? "—"} · {category?.name ?? "—"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {row.currency !== "UGX" && row.fxRateToUgx ? (
                  <>
                    FX {row.fxRateToUgx.toLocaleString("en-UG")} →{" "}
                    <span className="text-foreground">
                      {formatMoney(row.normalizedAmount, "UGX")}
                    </span>
                  </>
                ) : (
                  <>Posts as {formatMoney(row.normalizedAmount, "UGX")}</>
                )}
              </div>
              {row.issues.length > 0 ? (
                <div className="mt-1.5 text-xs text-destructive">{row.issues.join(" · ")}</div>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
