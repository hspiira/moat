import { Badge } from "@/components/ui/badge";

type SectionTitleProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function SectionTitle({ eyebrow, title, description }: SectionTitleProps) {
  return (
    <div className="space-y-3">
      <Badge variant="outline" className="w-fit">
        {eyebrow}
      </Badge>
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h2>
        <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
          {description}
        </p>
      </div>
    </div>
  );
}
