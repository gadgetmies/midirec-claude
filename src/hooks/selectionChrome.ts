/* Shared predicate used by the outside-click handlers in useStage that
   clear timeline-domain selections. Clicks whose target is inside any of
   these chrome region roots must never clear selection state. */
const CHROME_SELECTOR =
  '.mr-titlebar, .mr-toolstrip, .mr-sidebar, .mr-inspector, .mr-statusbar';

export function isSelectionPreservingChrome(target: Element | null): boolean {
  if (!target) return false;
  return target.closest(CHROME_SELECTOR) !== null;
}
