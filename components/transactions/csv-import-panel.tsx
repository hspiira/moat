"use client";

import { AccentCardHeader } from "@/components/accent-card-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Account, Category, Transaction, UserProfile } from "@/lib/types";

import {
  CsvDefaultsCard,
  CsvMappingCard,
  CsvPreviewCard,
  CsvReviewCard,
} from "./csv-import-sections";
import { useCsvImportPanel } from "./use-csv-import-panel";

type Props = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  profile: UserProfile;
  onImportSuccess: () => void;
  onError: (message: string) => void;
};

export function CsvImportPanel(props: Props) {
  const {
    csvHeaders,
    csvMappings,
    importName,
    defaultImportType,
    defaultImportAccountId,
    defaultImportCategoryId,
    defaultImportCurrency,
    defaultImportFxRate,
    isImporting,
    validImportCount,
    duplicateCount,
    foreignCurrencyCount,
    previewRows,
    setCsvMappings,
    setDefaultImportType,
    setDefaultImportAccountId,
    setDefaultImportCategoryId,
    setDefaultImportCurrency,
    setDefaultImportFxRate,
    handleCsvFileChange,
    handleImportConfirm,
    clearCsv,
  } = useCsvImportPanel(props);

  return (
    <Card className="gap-0 pt-0 border-border/20 shadow-none">
      <AccentCardHeader
        tone="lilac"
        title="CSV import"
        description="Upload, map, review, then confirm."
      />
      <CardContent className="grid gap-4 p-5 pt-6">
        <Input
          accept=".csv,text/csv"
          type="file"
          onChange={(event) => void handleCsvFileChange(event)}
          className="cursor-pointer"
        />

        {csvHeaders.length > 0 ? (
          <>
            <div className="grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
              <CsvMappingCard
                csvHeaders={csvHeaders}
                csvMappings={csvMappings}
                onMappingChange={(field, value) =>
                  setCsvMappings((current) => ({ ...current, [field]: value }))
                }
              />

              <CsvDefaultsCard
                accounts={props.accounts}
                categories={props.categories}
                defaultImportType={defaultImportType}
                defaultImportAccountId={defaultImportAccountId}
                defaultImportCategoryId={defaultImportCategoryId}
                defaultImportCurrency={defaultImportCurrency}
                defaultImportFxRate={defaultImportFxRate}
                onTypeChange={setDefaultImportType}
                onAccountChange={setDefaultImportAccountId}
                onCategoryChange={setDefaultImportCategoryId}
                onCurrencyChange={setDefaultImportCurrency}
                onFxRateChange={setDefaultImportFxRate}
              />
            </div>

            <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
              <CsvReviewCard
                importName={importName}
                validImportCount={validImportCount}
                duplicateCount={duplicateCount}
                foreignCurrencyCount={foreignCurrencyCount}
                isImporting={isImporting}
                onImport={() => void handleImportConfirm()}
                onClear={clearCsv}
              />

              <CsvPreviewCard
                previewRows={previewRows}
                accounts={props.accounts}
                categories={props.categories}
              />
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
