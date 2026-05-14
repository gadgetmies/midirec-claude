interface FormatCardProps {
  title: string;
  subtitle: string;
  active: boolean;
  onSelect(): void;
}

export function ExportFormatCard({ title, subtitle, active, onSelect }: FormatCardProps) {
  return (
    <button
      type="button"
      className="mr-fmt-card"
      data-on={active ? 'true' : 'false'}
      aria-pressed={active}
      onClick={onSelect}
    >
      <span className="mr-fmt-card__title">{title}</span>
      <span className="mr-fmt-card__sub">{subtitle}</span>
    </button>
  );
}
