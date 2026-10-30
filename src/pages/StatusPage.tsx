import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Box, Database, GitBranch, Radio, Smartphone, type LucideIcon } from 'lucide-react';
import { Button, Card, Eyebrow, PageHeader, StatusPill, type Tone } from '../components/ui';
import { t } from '../i18n';
import { env } from '../lib/env';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

const REPO = 'julfikerhaider2001/Light-House-Management';

interface HealthProbe {
  status: number;
  statusText: string;
  ms: number;
  body: unknown;
}

/** Raw REST call so the panel can show the real HTTP status and latency. */
async function probeHealth(): Promise<HealthProbe> {
  const started = performance.now();
  const res = await fetch(`${env.supabaseUrl}/rest/v1/rpc/health`, {
    headers: { apikey: env.supabasePublishableKey ?? '' },
    cache: 'no-store',
  });
  const body: unknown = await res.json().catch(() => null);
  return {
    status: res.status,
    statusText: res.statusText || (res.ok ? 'OK' : ''),
    ms: performance.now() - started,
    body,
  };
}

async function github<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/${path}`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  return (await res.json()) as T;
}

/** Opens a throwaway broadcast channel to prove the realtime socket is reachable. */
function useRealtimeProbe(): 'connecting' | 'connected' | 'error' {
  const [state, setState] = useState<'connecting' | 'connected' | 'error'>(
    isSupabaseConfigured ? 'connecting' : 'error',
  );
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cleanup: (() => void) | undefined;
    let live = true;
    void getSupabase().then((sb) => {
      if (!live) return;
      const channel = sb.channel(`status-probe-${Math.random().toString(36).slice(2)}`);
      channel.subscribe((event) => {
        const s = String(event);
        if (s === 'SUBSCRIBED') setState('connected');
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') setState('error');
      });
      cleanup = () => void sb.removeChannel(channel);
    });
    return () => {
      live = false;
      cleanup?.();
    };
  }, []);
  return state;
}

function StatusCard({
  icon: Icon,
  title,
  tone,
  pill,
  children,
}: {
  icon: LucideIcon;
  title: string;
  tone: Tone;
  pill: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="status-card">
      <div className="row-between">
        <span className="row">
          <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
          <Eyebrow>{title}</Eyebrow>
        </span>
        <StatusPill tone={tone}>{pill}</StatusPill>
      </div>
      <div className="mono small status-card__body">{children}</div>
    </Card>
  );
}

export default function StatusPage() {
  const health = useQuery({
    queryKey: ['status', 'health'],
    queryFn: probeHealth,
    enabled: isSupabaseConfigured,
    refetchInterval: 15_000,
  });
  const live = useQuery({
    queryKey: ['status', 'version'],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, {
        cache: 'no-store',
      });
      return (await res.json()) as { version: string; builtAt: string };
    },
  });
  const deploy = useQuery({
    queryKey: ['status', 'deploy'],
    queryFn: () =>
      github<{
        workflow_runs: {
          status: string;
          conclusion: string | null;
          head_sha: string;
          updated_at: string;
          html_url: string;
        }[];
      }>('actions/workflows/deploy.yml/runs?branch=main&per_page=1'),
    staleTime: 60_000,
  });
  const release = useQuery({
    queryKey: ['status', 'release'],
    queryFn: () =>
      github<{ tag_name: string; published_at: string; html_url: string }>('releases/latest'),
    staleTime: 60_000,
  });
  const realtime = useRealtimeProbe();

  const run = deploy.data?.workflow_runs[0];
  const runTone: Tone = !run
    ? 'idle'
    : run.status !== 'completed'
      ? 'warn'
      : run.conclusion === 'success'
        ? 'ok'
        : 'due';
  const h = health.data;
  const healthy = h !== undefined && h.status === 200;

  return (
    <div className="content status-page">
      <PageHeader
        eyebrow={t('app.name').toUpperCase()}
        title={t('status.title')}
        aside={<Button onClick={() => void health.refetch()}>{t('status.refresh')}</Button>}
      />

      <div className="status-grid">
        <StatusCard
          icon={Box}
          title={t('status.build')}
          tone={live.data && live.data.version !== env.appVersion ? 'warn' : 'ok'}
          pill={env.appVersion}
        >
          <span>{env.builtAt.replace('T', ' ').slice(0, 19)} UTC</span>
          {live.data ? (
            <span className="muted">{t('status.liveVersion', { version: live.data.version })}</span>
          ) : null}
        </StatusCard>

        <StatusCard
          icon={Database}
          title={t('status.database')}
          tone={health.isPending ? 'warn' : healthy ? 'ok' : 'due'}
          pill={healthy ? t('status.healthy') : health.isPending ? '…' : t('status.down')}
        >
          {h ? <span data-testid="db-latency">{h.ms.toFixed(1)} ms</span> : null}
        </StatusCard>

        <StatusCard
          icon={Radio}
          title={t('status.realtime')}
          tone={realtime === 'connected' ? 'ok' : realtime === 'connecting' ? 'warn' : 'due'}
          pill={
            realtime === 'connected'
              ? t('status.connected')
              : realtime === 'connecting'
                ? t('status.connecting')
                : t('status.unavailable')
          }
        />

        <StatusCard
          icon={GitBranch}
          title={t('status.lastDeploy')}
          tone={runTone}
          pill={
            !run
              ? '—'
              : run.status !== 'completed'
                ? t('status.running')
                : run.conclusion === 'success'
                  ? t('status.success')
                  : t('status.failure')
          }
        >
          {run ? (
            <a href={run.html_url} target="_blank" rel="noreferrer">
              {run.head_sha.slice(0, 7)} · {run.updated_at.replace('T', ' ').slice(0, 16)}
            </a>
          ) : null}
        </StatusCard>

        <StatusCard
          icon={Smartphone}
          title={t('status.android')}
          tone={release.data ? 'ok' : 'idle'}
          pill={release.data?.tag_name ?? '—'}
        >
          {release.data ? (
            <a href={release.data.html_url} target="_blank" rel="noreferrer">
              {release.data.published_at.slice(0, 10)}
            </a>
          ) : null}
        </StatusCard>
      </div>

      <Card aria-labelledby="response-title">
        <h2 id="response-title" className="h3">
          {t('status.response')}
        </h2>
        <pre className="json mono" data-testid="health-response">
          <span className={healthy ? 'json__ok' : 'json__err'}>
            {h
              ? `GET health → ${h.status} ${h.statusText} · ${h.ms.toFixed(1)} ms`
              : health.isError
                ? `GET health → ${health.error.message}`
                : 'GET health → …'}
          </span>
          {'\n'}
          {h ? JSON.stringify(h.body, null, 2) : ''}
        </pre>
      </Card>
      <Link to="/" className="small">
        ← {t('app.name')}
      </Link>
    </div>
  );
}
