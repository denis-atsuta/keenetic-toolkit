import { useCallback, useEffect, useState } from 'react';
import { Toggle } from '@/components/ui/Toggle';
import { Icon } from '@/components/ui/Icon';
import type { RouterSettings } from '@/utils/settings';
import type { AddressList } from '@/utils/keenetic/routing';
import { mainDomain, scanActiveTab } from '@/utils/scan';
import {
  loadRoutingUi,
  saveRoutingUi,
  type ListDraft,
  type RoutingUiState,
  type ScanSelection,
} from '@/utils/ui-state';
import { useRouting } from './useRouting';
import { ListDetail } from './ListDetail';
import { ScanPicker } from './ScanPicker';
import './RoutingScreen.css';

/** Sentinel for a not-yet-created list (empty id triggers the create flow). */
const NEW_LIST: AddressList = { id: '', name: '', addresses: [], rule: undefined };

export function RoutingScreen({ settings }: { settings: RouterSettings }) {
  const { lists, interfaces, error, saving, setEnabled, saveDetail, removeList } =
    useRouting(settings);
  // Restored from storage.session so the popup reopens where it was left;
  // every change is written back. Null until the restore completes.
  const [ui, setUi] = useState<RoutingUiState | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    void loadRoutingUi().then(setUi);
  }, []);
  useEffect(() => {
    if (ui) saveRoutingUi(ui);
  }, [ui]);

  const patchUi = useCallback(
    (patch: Partial<RoutingUiState>) => setUi((prev) => prev && { ...prev, ...patch }),
    [],
  );
  const onDraftChange = useCallback(
    (draft: ListDraft) => setUi((prev) => prev && { ...prev, draft }),
    [],
  );
  const onScanSelection = useCallback(
    (scanSel: ScanSelection) => setUi((prev) => prev && { ...prev, scanSel }),
    [],
  );
  const closeEditor = useCallback(
    () => setUi((prev) => prev && { ...prev, openListId: null, creating: false, handoff: null, draft: null }),
    [],
  );

  // A handoff whose destination list vanished (deleted elsewhere) is stale.
  useEffect(() => {
    if (ui?.handoff && ui.handoff.listId !== '' && lists && !lists.some((l) => l.id === ui.handoff!.listId)) {
      patchUi({ handoff: null, draft: null });
    }
  }, [ui, lists, patchUi]);

  if (error && !lists) return <p className="screen-msg error">{error}</p>;
  if (!lists || !ui) return <p className="screen-msg hint">Loading lists…</p>;

  async function runScan() {
    setScanBusy(true);
    setScanError(null);
    try {
      const result = await scanActiveTab();
      patchUi({ scan: result, scanSel: null });
    } catch (e) {
      setScanError(e instanceof Error ? e.message : String(e));
    } finally {
      setScanBusy(false);
    }
  }

  async function rescan() {
    const next = await scanActiveTab();
    setUi((prev) => {
      if (!prev) return prev;
      // A different page (navigated away) replaces the result outright; the
      // same page merges — the buffer restarts on reload, but earlier finds
      // are still relevant.
      const scan =
        !prev.scan || prev.scan.pageHost !== next.pageHost
          ? next
          : { ...next, hosts: [...new Set([...prev.scan.hosts, ...next.hosts])] };
      return { ...prev, scan };
    });
  }

  function pickDestination(hosts: string[], destination: AddressList | null) {
    patchUi({
      scan: null,
      scanSel: null,
      draft: null,
      handoff: destination
        ? { listId: destination.id, name: '', preset: hosts }
        : { listId: '', name: ui?.scan ? mainDomain(ui.scan.pageHost) : '', preset: hosts },
    });
  }

  // Scan → editor handoff, re-resolved against the fresh lists on reopen.
  let editorTarget: { list: AddressList; preset?: string[]; isNew: boolean } | null = null;
  if (ui.handoff) {
    const h = ui.handoff;
    if (h.listId === '') {
      editorTarget = {
        list: { ...NEW_LIST, name: h.name, addresses: h.preset },
        preset: h.preset,
        isNew: true,
      };
    } else {
      const dest = lists.find((l) => l.id === h.listId);
      // A vanished destination is cleared by the effect above.
      if (dest) {
        editorTarget = {
          list: dest,
          preset: [...new Set([...dest.addresses, ...h.preset])],
          isNew: false,
        };
      }
    }
  } else if (ui.creating) {
    editorTarget = { list: NEW_LIST, isNew: true };
  } else if (ui.openListId) {
    const open = lists.find((l) => l.id === ui.openListId);
    if (open) editorTarget = { list: open, isNew: false };
  }

  if (editorTarget) {
    return (
      <ListDetail
        list={editorTarget.list}
        interfaces={interfaces}
        busy={saving.has(editorTarget.isNew ? '__new__' : editorTarget.list.id)}
        isNew={editorTarget.isNew}
        presetAddresses={editorTarget.preset}
        draft={ui.draft}
        onDraftChange={onDraftChange}
        onBack={closeEditor}
        onSave={saveDetail}
        onDelete={removeList}
      />
    );
  }

  if (ui.scan) {
    return (
      <ScanPicker
        result={ui.scan}
        lists={lists}
        initialSelection={ui.scanSel}
        onSelectionChange={onScanSelection}
        onBack={() => patchUi({ scan: null, scanSel: null })}
        onRescan={rescan}
        onContinue={pickDestination}
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
          <button className="add-list" onClick={() => patchUi({ creating: true })}>
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
              <button className="rule-open" onClick={() => patchUi({ openListId: list.id })}>
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
