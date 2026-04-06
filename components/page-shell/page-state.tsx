"use client";

import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";

export function ErrorStateCard({ message }: { message: string }) {
  return (
    <Card className="border-destructive/30 bg-destructive/5 shadow-none">
      <CardContent className="px-5 py-4 text-sm text-destructive">{message}</CardContent>
    </Card>
  );
}

export function LoadingStateCard({ message }: { message: string }) {
  return (
    <Card className="border-border/40 shadow-none">
      <CardContent className="px-5 py-8 text-sm text-muted-foreground">{message}</CardContent>
    </Card>
  );
}

export function SetupRequiredCard({
  message,
  href,
  cta,
}: {
  message: string;
  href: string;
  cta: string;
}) {
  return (
    <Card className="border-border/40 shadow-none">
      <CardContent className="px-5 py-8 text-sm text-muted-foreground">
        {message}{" "}
        <Link href={href} className="underline underline-offset-4 hover:text-foreground">
          {cta}
        </Link>
      </CardContent>
    </Card>
  );
}
