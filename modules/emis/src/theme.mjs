// Reuse the LMS palette and contrast rules so both workspaces stay in sync.
import { themeValues, TEJASVI_PRIMARY } from '../../../lib/brand-theme.ts';

export function workspaceTheme(profile = {}, branding = null) {
  const values = themeValues(branding || {
    id: '', name: profile.name || 'College ERP',
    primaryColor: profile.theme?.toLowerCase() === '#173a32' ? TEJASVI_PRIMARY : profile.theme
  });
  return {
    ...values,
    '--accent': values['--brand-primary'],
    '--soft': values['--brand-soft'],
    '--text': values['--brand-ink'],
    '--muted': values['--brand-muted'],
    '--line': values['--brand-line']
  };
}
