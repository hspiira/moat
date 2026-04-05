type FeatureCardProps = {
  title: string;
  summary: string;
  bullets: string[];
};

export function FeatureCard({ title, summary, bullets }: FeatureCardProps) {
  return (
    <article className="card">
      <h3>{title}</h3>
      <p>{summary}</p>
      <ul>
        {bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
    </article>
  );
}
