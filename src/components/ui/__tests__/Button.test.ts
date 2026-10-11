import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from '../Button';

describe('Button asChild (Radix Slot)', () => {
  it('renders when asChild wraps a single element', () => {
    const html = renderToStaticMarkup(
      createElement(Button, { asChild: true }, createElement('a', { href: '/x' }, 'Go')),
    );
    expect(html).toContain('href="/x"');
    expect(html).toContain('Go');
  });

  it('merges slot classes onto the child element', () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        { asChild: true, className: 'custom' },
        createElement('a', { href: '/x', className: 'child' }, 'Go'),
      ),
    );
    expect(html).toContain('custom');
    expect(html).toContain('child');
  });

  it('does not throw when asChild is combined with loading', () => {
    expect(() =>
      renderToStaticMarkup(
        createElement(Button, { asChild: true, loading: true }, createElement('a', null, 'Go')),
      ),
    ).not.toThrow();
  });

  it('shows the spinner only for real buttons', () => {
    const loadingHtml = renderToStaticMarkup(createElement(Button, { loading: true }, 'Save'));
    expect(loadingHtml).toContain('animate-spin');
    expect(loadingHtml).toContain('disabled');

    const plainHtml = renderToStaticMarkup(createElement(Button, null, 'Save'));
    expect(plainHtml).not.toContain('animate-spin');
  });
});
