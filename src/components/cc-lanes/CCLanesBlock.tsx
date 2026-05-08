import type { CCLane as CCLaneType } from '../../hooks/useCCLanes';
import { CCLane } from './CCLane';
import './CCLane.css';

interface CCLanesBlockProps {
  lanes: CCLaneType[];
  viewT0?: number;
  totalT: number;
  onToggleMuted: (id: string) => void;
  onToggleSoloed: (id: string) => void;
}

export function CCLanesBlock({
  lanes,
  viewT0 = 0,
  totalT,
  onToggleMuted,
  onToggleSoloed,
}: CCLanesBlockProps) {
  const anySoloed = lanes.some((l) => l.soloed);
  return (
    <div className="mr-cc-lanes" data-soloing={anySoloed ? 'true' : undefined}>
      {lanes.map((lane) => (
        <CCLane
          key={lane.id}
          lane={lane}
          viewT0={viewT0}
          totalT={totalT}
          onToggleMuted={() => onToggleMuted(lane.id)}
          onToggleSoloed={() => onToggleSoloed(lane.id)}
        />
      ))}
    </div>
  );
}
