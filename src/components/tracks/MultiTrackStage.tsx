import type { Marquee } from '../piano-roll/notes';
import type { Track as TrackType } from '../../hooks/useTracks';
import { Track, type TrackViewProps } from './Track';

interface MultiTrackStageProps {
  tracks: TrackType[];
  viewProps: TrackViewProps;
  selectedTrackId: string | null;
  marquee: Marquee | null;
  selectedIdx: number[] | undefined;
  onToggleOpen: (id: string) => void;
  onToggleMuted: (id: string) => void;
  onToggleSoloed: (id: string) => void;
}

export function MultiTrackStage({
  tracks,
  viewProps,
  selectedTrackId,
  marquee,
  selectedIdx,
  onToggleOpen,
  onToggleMuted,
  onToggleSoloed,
}: MultiTrackStageProps) {
  const anySoloed = tracks.some((t) => t.soloed);
  return (
    <div
      className="mr-multi-track-stage"
      data-soloing={anySoloed ? 'true' : undefined}
    >
      {tracks.map((track) => (
        <Track
          key={track.id}
          track={track}
          viewProps={viewProps}
          isSelected={track.id === selectedTrackId}
          marquee={track.id === selectedTrackId ? marquee : null}
          selectedIdx={track.id === selectedTrackId ? selectedIdx : []}
          onToggleOpen={() => onToggleOpen(track.id)}
          onToggleMuted={() => onToggleMuted(track.id)}
          onToggleSoloed={() => onToggleSoloed(track.id)}
        />
      ))}
    </div>
  );
}
