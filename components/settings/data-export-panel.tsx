"use client";

import { useState } from "react";
import { IconAlertTriangle } from "@tabler/icons-react";

import { collectFullExport, downloadJson } from "@/lib/security/data-export";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function DataExportPanel() {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    setError(null);
    setDone(false);

    try {
      const data = await collectFullExport();
      const date = new Date().toISOString().slice(0, 10);
      downloadJson(data, `moat-export-${date}.json`);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Card className="border-border/30 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Export your data</CardTitle>
        <CardDescription>
          A portable copy of your accounts, transactions, goals, and categories — readable by
          spreadsheets and other tools.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* This file is deliberately unencrypted so it stays portable, which
            makes it the wrong thing to keep as a safety copy. Saying so at the
            point of download is the only place the warning can land — the file
            itself carries no indication. */}
        <div className="flex gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
          <IconAlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-destructive"
          />
          <p className="text-xs leading-5 text-muted-foreground">
            <span className="font-medium text-foreground">This file is not encrypted.</span> Anyone
            who opens it can read every transaction. For a safety copy you can store or sync, use{" "}
            <span className="font-medium text-foreground">Encrypted backup</span> above instead.
          </p>
        </div>

        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : null}
        {done ? (
          <p className="text-xs text-muted-foreground">
            Download started. Keep it somewhere private, or delete it once you are done.
          </p>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          disabled={isExporting}
          onClick={() => void handleExport()}
        >
          {isExporting ? "Preparing export..." : "Download unencrypted export"}
        </Button>
      </CardContent>
    </Card>
  );
}
