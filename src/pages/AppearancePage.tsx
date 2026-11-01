import { Check, Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { Card, PageHeader } from '../components/ui';
import { t, type MessageKey } from '../i18n';
import { ACCENTS, setTheme, useTheme, type ThemeMode } from '../lib/theme';

const MODES: { id: ThemeMode; label: MessageKey; icon: LucideIcon }[] = [
  { id: 'dark', label: 'theme.dark', icon: Moon },
  { id: 'light', label: 'theme.light', icon: Sun },
  { id: 'system', label: 'theme.system', icon: Monitor },
];

/** Light / dark mode and a premade colour setup, saved on this device. */
export default function AppearancePage() {
  const theme = useTheme();
  return (
    <>
      <PageHeader eyebrow={t('app.name').toUpperCase()} title={t('theme.title')} />

      <Card aria-labelledby="mode-title">
        <h2 id="mode-title" className="h3">
          {t('theme.mode')}
        </h2>
        <div className="segmented" role="radiogroup" aria-labelledby="mode-title">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={theme.mode === id}
              className="segmented__opt"
              onClick={() => setTheme({ mode: id })}
            >
              <span className="row">
                <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                {t(label)}
              </span>
            </button>
          ))}
        </div>
      </Card>

      <Card aria-labelledby="accent-title">
        <div className="stack-tight">
          <h2 id="accent-title" className="h3">
            {t('theme.colours')}
          </h2>
          <p className="muted small">{t('theme.coloursHint')}</p>
        </div>
        <div className="swatches" role="radiogroup" aria-labelledby="accent-title">
          {ACCENTS.map((a) => {
            const colour = theme.resolved === 'dark' ? a.dark : a.light;
            const selected = theme.accent === a.id;
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className="swatch"
                onClick={() => setTheme({ accent: a.id })}
              >
                <span className="swatch__chip" style={{ background: colour }} aria-hidden="true">
                  {selected ? <Check size={18} strokeWidth={2.5} /> : null}
                </span>
                <span className="small">{a.name}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card aria-label={t('theme.preview')}>
        <div className="row-between">
          <span className="eyebrow mono">{t('theme.preview')}</span>
          <span className="pill pill--ok">
            <span className="pill__dot" aria-hidden="true" />
            {t('common.open')}
          </span>
        </div>
        <div className="highlight-grid">
          <div className="highlight highlight--accent">
            <span className="eyebrow mono">{t('today.mealRate')}</span>
            <span className="highlight__value mono">৳65.24</span>
          </div>
          <div className="highlight highlight--due">
            <span className="eyebrow mono">{t('today.due')}</span>
            <span className="highlight__value mono">৳1,250</span>
          </div>
        </div>
      </Card>
    </>
  );
}
