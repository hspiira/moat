import type { Milestone } from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type MilestoneListProps = {
  milestones: Milestone[];
};

export function MilestoneList({ milestones }: MilestoneListProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {milestones.map((milestone) => (
        <Card
          className="h-full border-border/70 bg-background/80 shadow-sm"
          key={milestone.id}
        >
          <CardHeader className="space-y-3">
            <Badge variant="outline" className="w-fit">
              {milestone.kicker}
            </Badge>
            <CardTitle className="text-lg">{milestone.title}</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              {milestone.summary}
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
              {milestone.outputs.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
