import { useCallback, useEffect, useState } from 'react';
import { Toggle } from '@/components/ui/Toggle';
import { Icon } from '@/components/ui/Icon';
import type { RouterSettings } from '@/utils/settings';
import type { AddressList } from '@/utils/keenetic/routing';
import { useBackHandler } from '@/utils/nav';
import {
  loadRoutingUi,
  saveRoutingUi,
  type ListDraft,
  type RoutingUiState,
} from '@/utils/ui-state';
import { useRouting } from './useRouting';
import { ListDetail } from './ListDetail';
import './RoutingScreen.css';

/** Sentinel for a not-yet-created list (empty id triggers the create flow). */
const NEW_LIST: AddressList = { id: '', name: '', addresses: [], rule: undefined };

export function RoutingScreen({ settings }: { settings: RouterSettings }) {
  const { lists, interfaces, error, saving, setEnabled, saveDetail, removeList } =
    useRouting(settings);
  // Restored from storage.session so the popup reopens where it was left;
  // every change is written back. Null until the restore completes.
  const [ui, setUi] = useState<RoutingUiState | null>(null);

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
  const closeEditor = useCallback(
    () => setUi((prev) => prev && { ...prev, openListId: null, creating: false, draft: null }),
    [],
  );

  // Mouse-back closes an open editor.
  useBackHandler(() => {
    if (ui && (ui.openListId || ui.creating)) {
      closeEditor();
      return true;
    }
    return false;
  });

  if (error && !lists) return <p className="screen-msg error">{error}</p>;
  if (!lists || !ui) return <p className="screen-msg hint">Loading lists…</p>;

  let editorTarget: { list: AddressList; isNew: boolean } | null = null;
  if (ui.creating) {
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
        draft={ui.draft}
        onDraftChange={onDraftChange}
        onBack={closeEditor}
        onSave={saveDetail}
        onDelete={removeList}
      />
    );
  }

  const routedCount = lists.filter((l) => l.rule?.enabled).length;
  const addressCount = lists.reduce((sum, l) => sum + l.addresses.length, 0);

  return (
    <div className="routes">
      {error && <p className="error routes__error">{error}</p>}
      <div className="routes__toolbar">
        <span className="routes__summary">
          {lists.length} lists · {routedCount} routed · {addressCount} addresses
        </span>
        <button className="add-list" onClick={() => patchUi({ creating: true })}>
          <Icon name="dns" size={16} />
          Add list
        </button>
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
