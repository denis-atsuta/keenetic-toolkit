import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import type { RouterSettings } from '@/utils/settings';
import type { AddressList } from '@/utils/keenetic/routing';
import { mainDomain, scanActiveTab } from '@/utils/scan';
import { useBackHandler } from '@/utils/nav';
import {
  loadScanUi,
  saveScanUi,
  type ListDraft,
  type ScanSelection,
  type ScanUiState,
} from '@/utils/ui-state';
import { useRouting } from '../routing/useRouting';
import { ListDetail } from '../routing/ListDetail';
import { ScanPicker } from './ScanPicker';
import './ScanScreen.css';

/** Sentinel for a not-yet-created list (empty id triggers the create flow). */
const NEW_LIST: AddressList = { id: '', name: '', addresses: [], rule: undefined };

export function ScanScreen({ settings }: { settings: RouterSettings }) {
  const { lists, interfaces, error, saving, saveDetail, removeList } = useRouting(settings);
  // Restored from storage.session so the popup reopens where it was left.
  const [ui, setUi] = useState<ScanUiState | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    void loadScanUi().then(setUi);
  }, []);
  useEffect(() => {
    if (ui) saveScanUi(ui);
  }, [ui]);

  const patchUi = useCallback(
    (patch: Partial<ScanUiState>) => setUi((prev) => prev && { ...prev, ...patch }),
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

  // Mouse-back walks the flow one step at a time: editor → picker → idle.
  useBackHandler(() => {
    if (!ui) return false;
    if (ui.handoff) {
      patchUi({ handoff: null, draft: null });
      return true;
    }
    if (ui.scan) {
      patchUi({ scan: null, scanSel: null });
      return true;
    }
    return false;
  });

  // A handoff whose destination list vanished (deleted elsewhere) is stale.
  useEffect(() => {
    if (
      ui?.handoff &&
      ui.handoff.listId !== '' &&
      lists &&
      !lists.some((l) => l.id === ui.handoff!.listId)
    ) {
      patchUi({ handoff: null, draft: null });
    }
  }, [ui, lists, patchUi]);

  if (error && !lists) return <p className="screen-msg error">{error}</p>;
  if (!lists || !ui) return <p className="screen-msg hint">Loading…</p>;

  async function runScan() {
    setBusy(true);
    setScanError(null);
    try {
      const result = await scanActiveTab();
      patchUi({ scan: result, scanSel: null });
    } catch (e) {
      setScanError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
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
    // The scan result stays, so canceling the editor returns to the picker.
    patchUi({
      draft: null,
      handoff: destination
        ? { listId: destination.id, name: '', preset: hosts }
        : { listId: '', name: ui?.scan ? mainDomain(ui.scan.pageHost) : '', preset: hosts },
    });
  }

  // Scan → editor handoff, re-resolved against the fresh lists on reopen.
  if (ui.handoff) {
    const h = ui.handoff;
    const target =
      h.listId === ''
        ? { list: { ...NEW_LIST, name: h.name, addresses: h.preset }, preset: h.preset }
        : (() => {
            const dest = lists.find((l) => l.id === h.listId);
            return dest
              ? { list: dest, preset: [...new Set([...dest.addresses, ...h.preset])] }
              : null; // vanished destination is cleared by the effect above
          })();
    if (target) {
      const isNew = target.list.id === '';
      return (
        <ListDetail
          list={target.list}
          interfaces={interfaces}
          busy={saving.has(isNew ? '__new__' : target.list.id)}
          isNew={isNew}
          presetAddresses={target.preset}
          draft={ui.draft}
          onDraftChange={onDraftChange}
          onBack={() => patchUi({ handoff: null, draft: null })}
          onSaved={() => patchUi({ handoff: null, draft: null, scan: null, scanSel: null })}
          onSave={saveDetail}
          onDelete={removeList}
        />
      );
    }
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
    <div className="scan-idle">
      {error && <p className="error">{error}</p>}
      {scanError && <p className="error">{scanError}</p>}
      <Icon name="scan" size={40} className="scan-idle__icon" />
      <p className="scan-idle__text">
        Collect every host the current tab loaded and route the ones you pick through a VPN
        interface.
      </p>
      <Button onClick={() => void runScan()} disabled={busy}>
        {busy ? 'Scanning…' : 'Scan page'}
      </Button>
    </div>
  );
}
