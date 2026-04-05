import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type FeatureCardProps = {
  title: string;
  summary: string;
  bullets: string[];
};

export function FeatureCard({ title, summary, bullets }: FeatureCardProps) {
  return (
    <Card className="h-full border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="space-y-3">
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription className="text-sm leading-6">
          {summary}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
