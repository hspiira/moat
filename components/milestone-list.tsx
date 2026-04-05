import type { Milestone } from "@/lib/types";

type MilestoneListProps = {
  milestones: Milestone[];
};

export function MilestoneList({ milestones }: MilestoneListProps) {
  return (
    <div className="milestone-wrap">
      {milestones.map((milestone) => (
        <article className="milestone-item" key={milestone.id}>
          <span className="milestone-kicker">{milestone.kicker}</span>
          <h3>{milestone.title}</h3>
          <p>{milestone.summary}</p>
          <ul className="milestone-list">
            {milestone.outputs.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
