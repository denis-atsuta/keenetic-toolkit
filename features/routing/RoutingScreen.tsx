import { useState } from 'react';
import { Toggle } from '@/components/ui/Toggle';
import { Icon } from '@/components/ui/Icon';
import type { RouterSettings } from '@/utils/settings';
import type { AddressList } from '@/utils/keenetic/routing';
import { mainDomain, scanActiveTab, type ScanResult } from '@/utils/scan';
import { useRouting } from './useRouting';
import { ListDetail } from './ListDetail';
import { ScanPicker } from './ScanPicker';
import './RoutingScreen.css';

/** Sentinel for a not-yet-created list (empty id triggers the create flow). */
const NEW_LIST: AddressList = { id: '', name: '', addresses: [], rule: undefined };

/** Scan handoff: the list to open in the editor and the addresses to prefill. */
interface ScanDraft {
  list: AddressList;
  preset: string[];
}

export function RoutingScreen({ settings }: { settings: RouterSettings }) {
  const { lists, interfaces, error, saving, setEnabled, saveDetail, removeList } =
    useRouting(settings);
  const [openListId, setOpenListId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ScanDraft | null>(null);

  if (error && !lists) return <p className="screen-msg error">{error}</p>;
  if (!lists) return <p className="screen-msg hint">Loading lists…</p>;

  async function runScan() {
    setScanBusy(true);
    setScanError(null);
    try {
      setScan(await scanActiveTab());
    } catch (e) {
      setScanError(e instanceof Error ? e.message : String(e));
    } finally {
      setScanBusy(false);
    }
  }

  async function rescan() {
    const next = await scanActiveTab();
    setScan((prev) => {
      // A different page (navigated away) replaces the result outright; the
      // same page merges — the buffer restarts on reload, but earlier finds
      // are still relevant.
      if (!prev || prev.pageHost !== next.pageHost) return next;
      return { ...next, hosts: [...new Set([...prev.hosts, ...next.hosts])] };
    });
  }

  function pickDestination(hosts: string[], destination: AddressList | null) {
    if (destination) {
      // Merge for review; Save diffs against the untouched original.
      setDraft({
        list: destination,
        preset: [...new Set([...destination.addresses, ...hosts])],
      });
    } else {
      setDraft({
        list: { ...NEW_LIST, name: scan ? mainDomain(scan.pageHost) : '', addresses: hosts },
        preset: hosts,
      });
    }
    setScan(null);
  }

  if (draft) {
    const isNew = draft.list.id === '';
    return (
      <ListDetail
        list={draft.list}
        interfaces={interfaces}
        busy={saving.has(isNew ? '__new__' : draft.list.id)}
        isNew={isNew}
        presetAddresses={draft.preset}
        onBack={() => setDraft(null)}
        onSave={saveDetail}
        onDelete={removeList}
      />
    );
  }

  if (scan) {
    return (
      <ScanPicker
        result={scan}
        lists={lists}
        onBack={() => setScan(null)}
        onRescan={rescan}
        onContinue={pickDestination}
      />
    );
  }

  if (creating) {
    return (
      <ListDetail
        list={NEW_LIST}
        interfaces={interfaces}
        busy={saving.has('__new__')}
        isNew
        onBack={() => setCreating(false)}
        onSave={saveDetail}
        onDelete={removeList}
      />
    );
  }

  const open = openListId ? lists.find((l) => l.id === openListId) : undefined;
  if (open) {
    return (
      <ListDetail
        list={open}
        interfaces={interfaces}
        busy={saving.has(open.id)}
        onBack={() => setOpenListId(null)}
        onSave={saveDetail}
        onDelete={removeList}
      />
    );
  }

  return (
    <div className="routes">
      {error && <p className="error routes__error">{error}</p>}
      {scanError && <p className="error routes__error">{scanError}</p>}
      <div className="routes__toolbar">
        <h2 className="routes__title">Routing</h2>
        <div className="routes__toolbar-actions">
          <button className="add-list" onClick={() => void runScan()} disabled={scanBusy}>
            <Icon name="scan" size={16} />
            {scanBusy ? 'Scanning…' : 'Scan page'}
          </button>
          <button className="add-list" onClick={() => setCreating(true)}>
            <Icon name="dns" size={16} />
            Add list
          </button>
        </div>
      </div>
      {lists.length === 0 ? (
        <p className="screen-msg hint">No address lists yet.</p>
      ) : (
        <ul className="rule-list">
          {lists.map((list) => (
            <li key={list.id} className="rule-row">
              <button className="rule-open" onClick={() => setOpenListId(list.id)}>
                <span className="rule-name">{list.name}</span>
                <span className="rule-iface">
                  {list.rule ? `via ${list.rule.interfaceName || '—'}` : 'Not routed'}
                  {' · '}
                  {list.addresses.length} addresses
                </span>
              </button>
              {list.rule && (
                <Toggle
                  checked={list.rule.enabled}
                  disabled={saving.has(list.id)}
                  ariaLabel={`Route ${list.name}`}
                  onChange={(v) => void setEnabled(list.id, list.rule!.index, v)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
