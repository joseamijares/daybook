'use client';

import { useRef, useState } from 'react';
import { CLIENTS, type Client, type Snippet } from '@/lib/clients';
import type { AgentToken } from '@/lib/tokens';
import { fill } from '@/lib/i18n';
import { minutesLabel } from '@/lib/time';
import { AppearanceSettings } from './AppearanceSettings';
import { api, ApiError, DEVICE, downloadCopy, forgetCopies, setMode, timeIn, useResource, useSession } from './client';
import { FrameDesign } from './FrameDesign';
import { askMac, useDaybookMac } from './mac';
import { Masthead } from './Masthead';

interface LinearStatus {
  connected: boolean;
  source: 'env' | 'settings' | null;
  viewer: { name: string; organization: string } | null;
  error: string | null;
  syncedAt: string | null;
}

interface FrameStatus {
  connected: boolean;
  source: 'env' | 'settings' | null;
  url: string | null;
}

export function SettingsView() {
  const { t, session } = useSession();
  return (
    <section className="placard wide settings" aria-label={t.settings}>
      <Masthead title={t.settings} sub={session.local ? t.settingsSubLocal : t.settingsSub} />

      <AppearanceSettings />
      <MacApp />

      {session.local ? (
        <DataSettings />
      ) : !session.owner ? (
        <p className="meta">{t.signInToManage}</p>
      ) : (
        <>
          <div className="settings-block">
            <div className="section-head">
              <span className="label">{t.integrations}</span>
              <span className="meta">{t.settingsLead}</span>
            </div>
            <div className="integration-grid">
              <LinearCard />
              <FrameCard />
            </div>
          </div>
          <Agents />
          <DataSettings />
          <ServerInfo />
        </>
      )}
    </section>
  );
}

// ---- Daybook for Mac ----------------------------------------------------------
// Only inside the Mac app's window (components/mac.ts): the version it runs, and
// its updates. Update and Check now open the app's own update window.

function MacApp() {
  const { t } = useSession();
  const mac = useDaybookMac();
  if (!mac) return null;
  const available = mac.available;
  return (
    <div className="settings-block">
      <div className="section-head">
        <span className="label">{t.macApp}</span>
        <span className="meta">{fill(t.macVersion, { version: mac.version })}</span>
      </div>
      <div className="switch-row">
        <span>
          <strong>{available ? fill(t.macAvailable, { version: available }) : t.macUpdates}</strong>
          <span className="meta">{available ? t.macAvailableLead : t.macUpdatesLead}</span>
        </span>
        <button
          type="button"
          className={available ? 'pill solid' : 'pill'}
          disabled={!mac.canCheck}
          onClick={() => askMac(available ? 'install' : 'check')}
        >
          {available ? t.macUpdate : t.macCheck}
        </button>
      </div>
    </div>
  );
}

// ---- Your data ---------------------------------------------------------------
// On this device: the only copy lives in this browser, so export, import,
// erase, the day's length, and the way to a cloud Daybook. In the cloud: a
// backup file both ways, and leaving this browser.

function DataSettings() {
  const { t, session, run, toast, refreshSession } = useSession();
  const local = Boolean(session.local);
  const file = useRef<HTMLInputElement>(null);

  const exportCopy = () => run(() => downloadCopy(session.today));
  const importCopy = (chosen: File) =>
    run(async () => {
      if (!confirm(t.importConfirm)) return;
      let backup: unknown;
      try {
        backup = JSON.parse(await chosen.text());
      } catch {
        backup = null; // the server or this device explains what's wrong with it
      }
      const r = await api<{ tasks: number; days: number }>('/api/import', { method: 'POST', body: { backup } }).catch((err) => {
        throw err instanceof ApiError && err.status === 400 ? new Error(t.badFile) : err;
      });
      toast(fill(t.imported, r));
      await refreshSession();
    });
  const erase = () =>
    confirm(t.eraseConfirm) &&
    run(async () => {
      await api('/api/data', { method: 'DELETE' });
      forgetCopies();
      await refreshSession();
    });
  const leave = async () => {
    if (!local) await api('/api/session', { method: 'DELETE' }).catch(() => undefined);
    setMode(null);
    // A fresh start on the welcome screen; on the way to a cloud Daybook, with its key form open.
    window.location.replace(local ? `${window.location.origin}/?own` : window.location.origin);
  };
  const setLength = (hours: number) =>
    run(async () => {
      await api('/api/capacity', { method: 'PUT', body: { minutes: hours * 60 } });
      await refreshSession();
    });

  return (
    <div className="settings-block" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="section-head">
        <span className="label">{t.dataHead}</span>
        <span className="meta">{local ? (DEVICE ? t.dataOnMac : t.dataOnDevice) : session.storage === 'upstash' ? 'Upstash Redis' : t.storageFile}</span>
      </div>
      <p className="meta" style={{ margin: 0, fontSize: 15, lineHeight: '22px' }}>
        {DEVICE ? t.dataLeadMac : local ? t.dataLead : t.dataLeadCloud}
      </p>
      <div className="data-actions">
        <button type="button" className="pill solid" onClick={exportCopy}>
          {t.exportBtn}
        </button>
        <button type="button" className="pill" onClick={() => file.current?.click()}>
          {t.importBtn}
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const chosen = e.target.files?.[0];
            e.target.value = '';
            if (chosen) importCopy(chosen);
          }}
        />
        {local && (
          <button type="button" className="link-btn danger" onClick={erase}>
            {t.eraseBtn}
          </button>
        )}
      </div>
      {local && (
        <div className="switch-row">
          <span>
            <strong>{t.dayLength}</strong>
            <span className="meta">{t.dayLengthLead}</span>
          </span>
          <span className="day-length" role="group" aria-label={t.dayLength}>
            {[4, 5, 6, 7, 8, 10].map((h) => (
              <button key={h} type="button" className="pill round" aria-pressed={session.capacity === h * 60} onClick={() => setLength(h)}>
                {h}h
              </button>
            ))}
          </span>
        </div>
      )}
      {DEVICE ? (
        // In the Mac app: its own form connects a cloud Daybook and brings these days along.
        <div className="switch-row">
          <span>
            <strong>{t.connectCloud}</strong>
            <span className="meta">{t.switchCloudLeadMac}</span>
          </span>
          <button type="button" className="pill" onClick={() => askMac('connect')}>
            {t.connectBtn}
          </button>
        </div>
      ) : (
        <div className="switch-row">
          <span>
            <strong>{local ? t.switchCloud : t.switchDevice}</strong>
            <span className="meta">{local ? t.switchCloudLead : t.switchDeviceLead}</span>
          </span>
          <button type="button" className="link-btn" onClick={leave}>
            {t.switchBtn}
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Linear ------------------------------------------------------------------

function LinearCard() {
  const { t, run, toast, refreshSession, session } = useSession();
  const { data, reload } = useResource<LinearStatus>('/api/integrations/linear');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);

  const connect = () =>
    run(async () => {
      setBusy(true);
      try {
        const r = await api<LinearStatus>('/api/integrations/linear', { method: 'PUT', body: { apiKey: key } });
        setKey('');
        toast(`Linear: ${r.viewer?.name} · ${r.viewer?.organization}`);
        await refreshSession();
      } finally {
        setBusy(false);
      }
    }, reload);

  return (
    <div className={`integration${data?.connected ? ' is-on' : ''}`}>
      <div className="integration-head">
        <span className="integration-name">Linear</span>
        <Status on={!!data?.connected} />
      </div>
      <p className="meta">{t.linearLead}</p>
      {!data ? (
        <p className="meta">{t.checking}</p>
      ) : data.connected ? (
        <>
          <p className="who">
            {data.viewer ? `${data.viewer.name} · ${data.viewer.organization}` : data.error}
            {data.syncedAt && <span className="meta"> · {t.linearSynced} {timeIn(data.syncedAt, session.tz, session.locale)}</span>}
          </p>
          <div className="row-actions">
            <button
              type="button"
              className="pill solid"
              onClick={() =>
                run(async () => {
                  const r = await api<{ added: number; closed: number; open: number }>('/api/linear', { method: 'POST' });
                  toast(fill(t.linearCounts, r));
                }, reload)
              }
            >
              {t.syncNow}
            </button>
            {data.source === 'settings' ? (
              <button
                type="button"
                className="pill"
                onClick={() => confirm(t.disconnectConfirm) && run(() => api('/api/integrations/linear', { method: 'DELETE' }), async () => (await reload(), await refreshSession()))}
              >
                {t.disconnect}
              </button>
            ) : (
              <span className="meta">{t.setOnServer} (LINEAR_API_KEY)</span>
            )}
          </div>
        </>
      ) : (
        <form
          className="connect-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (key.trim()) connect();
          }}
        >
          <label className="field">
            <span className="label">{t.linearKey}</span>
            <input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="lin_api_…" />
          </label>
          <p className="hint">
            <a href="https://linear.app/settings/account/security" target="_blank" rel="noreferrer">
              {t.linearHelp}
            </a>
          </p>
          <button type="submit" className="pill solid" disabled={busy || !key.trim()}>
            {busy ? t.checking : t.connect}
          </button>
        </form>
      )}
    </div>
  );
}

// ---- Frame Dashboard ---------------------------------------------------------

function FrameCard() {
  const { t, run, toast, refreshSession, session } = useSession();
  const { data, reload } = useResource<FrameStatus>('/api/integrations/frame');
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className={`integration${data?.connected ? ' is-on' : ''}`}>
      <div className="integration-head">
        <span className="integration-name">Frame Dashboard</span>
        <Status on={!!data?.connected} />
      </div>
      <p className="meta">{t.frameLead}</p>
      {!data ? (
        <p className="meta">{t.checking}</p>
      ) : data.connected ? (
        <>
          <p className="who">{data.url}</p>
          <div className="row-actions">
            <button
              type="button"
              className="pill solid"
              onClick={() =>
                run(async () => {
                  await api('/api/frame', { method: 'POST', body: {} });
                  toast(t.sentToFrame);
                  await refreshSession();
                })
              }
            >
              {t.sendToFrame}
            </button>
            {data.source === 'settings' ? (
              <button
                type="button"
                className="pill"
                onClick={() => confirm(t.disconnectConfirm) && run(() => api('/api/integrations/frame', { method: 'DELETE' }), async () => (await reload(), await refreshSession()))}
              >
                {t.disconnect}
              </button>
            ) : (
              <span className="meta">{t.setOnServer} (FRAME_DASHBOARD_*)</span>
            )}
          </div>
          {session.frame && <FrameDesign />}
        </>
      ) : (
        <form
          className="connect-form"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              setBusy(true);
              try {
                await api('/api/integrations/frame', { method: 'PUT', body: { url, writeKey: key } });
                setKey('');
                toast(`Frame Dashboard: ${t.connected}`);
                await refreshSession();
              } finally {
                setBusy(false);
              }
            }, reload);
          }}
        >
          <label className="field">
            <span className="label">{t.frameUrl}</span>
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-frame.vercel.app" />
          </label>
          <label className="field">
            <span className="label">{t.frameKey}</span>
            <input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} />
          </label>
          <button type="submit" className="pill solid" disabled={busy || !url.trim() || !key.trim()}>
            {busy ? t.checking : t.connect}
          </button>
        </form>
      )}
    </div>
  );
}

function Status({ on }: { on: boolean }) {
  const { t } = useSession();
  return <span className={`status${on ? ' on' : ''}`}>{on ? t.connected : t.notConnected}</span>;
}

// ---- Agents ------------------------------------------------------------------

function Agents() {
  const { t, session, run } = useSession();
  const { data, reload } = useResource<{ tokens: AgentToken[] }>('/api/tokens');
  const [open, setOpen] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ client: string; token: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const client = CLIENTS.find((c) => c.id === open) || null;
  const mcpUrl = typeof window === 'undefined' ? '/api/mcp' : `${window.location.origin}/api/mcp`;
  const local = typeof window !== 'undefined' && /^(localhost|127\.|\[::1\])/.test(window.location.hostname);
  const tokens = data?.tokens || [];

  return (
    <div className="settings-block">
      <div className="section-head">
        <span className="label">{t.agents}</span>
        <span className="meta">{t.agentsLead}</span>
      </div>
      <div className="client-grid">
        {CLIENTS.map((c) => {
          const count = tokens.filter((k) => k.client === c.id).length;
          return (
            <button
              key={c.id}
              type="button"
              className={`client${open === c.id ? ' on' : ''}`}
              aria-expanded={open === c.id}
              onClick={() => setOpen(open === c.id ? null : c.id)}
            >
              <span className="client-mark" aria-hidden>
                {c.name.replace(/[^A-Za-z]/g, '').slice(0, 2)}
              </span>
              <span className="client-text">
                <span className="client-name">{c.name}</span>
                <span className="client-tag">{c.tagline[session.locale]}</span>
              </span>
              {count > 0 && <span className="client-count">{count}</span>}
            </button>
          );
        })}
      </div>

      {client && (
        <ConnectPanel
          key={client.id}
          client={client}
          mcpUrl={mcpUrl}
          local={local}
          token={issued?.client === client.id ? issued.token : null}
          busy={busy}
          onCreate={() =>
            run(async () => {
              setBusy(true);
              try {
                const r = await api<{ token: string }>('/api/tokens', { method: 'POST', body: { name: client.name, client: client.id } });
                setIssued({ client: client.id, token: r.token });
              } finally {
                setBusy(false);
              }
            }, reload)
          }
        />
      )}

      <div className="tokens">
        <div className="section-head" style={{ borderBottomColor: 'var(--rule)' }}>
          <span className="label">{t.tokens}</span>
          <span className="meta">{tokens.length}</span>
        </div>
        {!tokens.length && <p className="empty">{t.noTokens}</p>}
        {tokens.map((k) => (
          <div key={k.id} className="row" style={{ fontSize: 15 }}>
            <span className="title">
              {k.name} <span className="meta">· {k.prefix}…</span>
            </span>
            <span className="meta" style={{ flexShrink: 0 }}>
              {k.lastUsedAt ? `${t.lastUsed} ${new Date(k.lastUsedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : t.never}
            </span>
            <button
              type="button"
              className="link-btn"
              style={{ flexShrink: 0, color: 'var(--color-amber)' }}
              onClick={() => confirm(t.revokeConfirm) && run(() => api(`/api/tokens/${k.id}`, { method: 'DELETE' }), reload)}
            >
              {t.revoke}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConnectPanel({ client, mcpUrl, local, token, busy, onCreate }: { client: Client; mcpUrl: string; local: boolean; token: string | null; busy: boolean; onCreate: () => void }) {
  const { t, session } = useSession();
  return (
    <div className="connect-panel">
      <div className="connect-head">
        <span className="integration-name">{client.name}</span>
        <span className={`where ${client.where}`}>{client.where === 'cloud' ? t.cloudApp : t.localApp}</span>
      </div>
      {client.where === 'cloud' && local && <p className="warn-note">{t.cloudNeedsPublic}</p>}
      <ol className="steps">
        {client.steps[session.locale].map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {!token ? (
        <button type="button" className="pill solid" onClick={onCreate} disabled={busy}>
          {busy ? t.creating : t.createToken}
        </button>
      ) : (
        <>
          <p className="warn-note">{t.tokenOnce}</p>
          <div className="snippets">
            {client.snippets(mcpUrl, token).map((s) => (
              <SnippetBlock key={s.label} s={s} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SnippetBlock({ s }: { s: Snippet }) {
  const { t } = useSession();
  const [copied, setCopied] = useState(false);
  if (s.kind === 'link') {
    return (
      <a className="pill solid install" href={s.href}>
        {s.value}
      </a>
    );
  }
  return (
    <div className="snippet">
      <div className="snippet-head">
        <span className="label">{s.label}</span>
        <button
          type="button"
          className="link-btn"
          onClick={async () => {
            await navigator.clipboard.writeText(s.value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
        >
          {copied ? t.copied : t.copy}
        </button>
      </div>
      <pre>{s.value}</pre>
    </div>
  );
}

// ---- Server ------------------------------------------------------------------

function ServerInfo() {
  const { t, session } = useSession();
  const mcpUrl = typeof window === 'undefined' ? '/api/mcp' : `${window.location.origin}/api/mcp`;
  return (
    <div className="settings-block">
      <div className="section-head">
        <span className="label">{t.server}</span>
      </div>
      <dl className="facts">
        <div>
          <dt>{t.mcpUrl}</dt>
          <dd>{mcpUrl}</dd>
        </div>
        <div>
          <dt>{t.timeZone}</dt>
          <dd>{session.tz}</dd>
        </div>
        <div>
          <dt>{t.capacityLabel}</dt>
          <dd>{minutesLabel(session.capacity)}</dd>
        </div>
        <div>
          <dt>{t.storageLabel}</dt>
          <dd>{session.storage === 'upstash' ? 'Upstash Redis' : session.storage === 'browser' ? t.storageBrowser : t.storageFile}</dd>
        </div>
      </dl>
    </div>
  );
}
