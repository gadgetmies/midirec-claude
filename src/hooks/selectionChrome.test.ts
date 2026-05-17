import { describe, expect, test } from 'vitest';
import { isSelectionPreservingChrome } from './selectionChrome';

function makeTree(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.append(root);
  return root;
}

const CHROME_CLASSES = [
  'mr-titlebar',
  'mr-toolstrip',
  'mr-sidebar',
  'mr-inspector',
  'mr-statusbar',
] as const;

describe('isSelectionPreservingChrome', () => {
  test.each(CHROME_CLASSES)('returns true for descendants of .%s', (cls) => {
    const root = makeTree(
      `<div class="${cls}"><div class="leaf"><span class="target"></span></div></div>`,
    );
    const target = root.querySelector('.target') as Element;
    expect(isSelectionPreservingChrome(target)).toBe(true);
  });

  test.each(CHROME_CLASSES)('returns true when target itself is .%s', (cls) => {
    const root = makeTree(`<div class="${cls}"></div>`);
    const target = root.firstElementChild as Element;
    expect(isSelectionPreservingChrome(target)).toBe(true);
  });

  test('returns false for elements inside .mr-timeline', () => {
    const root = makeTree(
      '<div class="mr-timeline"><div class="mr-ruler"><span class="target"></span></div></div>',
    );
    const target = root.querySelector('.target') as Element;
    expect(isSelectionPreservingChrome(target)).toBe(false);
  });

  test('returns false for unrelated elements', () => {
    const root = makeTree('<div class="random"><span class="target"></span></div>');
    const target = root.querySelector('.target') as Element;
    expect(isSelectionPreservingChrome(target)).toBe(false);
  });

  test('returns false for null target', () => {
    expect(isSelectionPreservingChrome(null)).toBe(false);
  });
});
