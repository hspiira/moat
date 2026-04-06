"use client";

import { useState } from "react";

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
          Download all your accounts, transactions, goals, and categories as a JSON file. This
          satisfies your right to data portability under the Uganda Data Protection and Privacy
          Act 2019.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : null}
        {done ? (
          <p className="text-xs text-muted-foreground">
            Download started. Check your downloads folder.
          </p>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          disabled={isExporting}
          onClick={() => void handleExport()}
        >
          {isExporting ? "Preparing export..." : "Download JSON export"}
        </Button>
      </CardContent>
    </Card>
  );
}
