import { useHealth } from '../lib/api/health';
import { isSupabaseConfigured } from '../lib/supabase';
import { env } from '../lib/env';

type Tone = 'ok' | 'warn' | 'due' | 'idle';

function StatusPill({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className={`pill pill--${tone}`}>
      <span className="pill__dot" aria-hidden="true" />
      {label}
    </span>
  );
}

function DatabaseStatus() {
  const health = useHealth();
  if (!isSupabaseConfigured) return <StatusPill tone="idle" label="NOT CONFIGURED" />;
  if (health.isPending) return <StatusPill tone="warn" label="CHECKING" />;
  if (health.isError) return <StatusPill tone="due" label="DOWN" />;
  return (
    <span className="row">
      <StatusPill tone="ok" label="HEALTHY" />
      <span className="mono muted" data-testid="db-latency">
        {health.data.latencyMs.toFixed(1)} ms
      </span>
    </span>
  );
}

export function HelloPage() {
  return (
    <main className="shell">
      <section className="glass hello" aria-labelledby="app-title">
        <p className="eyebrow">Mess Meal Manager</p>
        <h1 id="app-title">Light House</h1>
        <dl className="kv">
          <div>
            <dt>Build</dt>
            <dd className="mono" data-testid="app-version">
              {env.appVersion}
            </dd>
          </div>
          <div>
            <dt>Built at</dt>
            <dd className="mono">{env.builtAt.replace('T', ' ').slice(0, 19)} UTC</dd>
          </div>
          <div>
            <dt>Database</dt>
            <dd>
              <DatabaseStatus />
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
