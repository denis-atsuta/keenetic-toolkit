import { useState } from 'react';
import { Toggle } from '@/components/ui/Toggle';
import { Icon } from '@/components/ui/Icon';
import type { RouterSettings } from '@/utils/settings';
import type { AddressList } from '@/utils/keenetic/routing';
import { useRouting } from './useRouting';
import { ListDetail } from './ListDetail';
import './RoutingScreen.css';

/** Sentinel for a not-yet-created list (empty id triggers the create flow). */
const NEW_LIST: AddressList = { id: '', name: '', addresses: [], rule: undefined };

export function RoutingScreen({ settings }: { settings: RouterSettings }) {
  const { lists, interfaces, error, saving, setEnabled, saveDetail, removeList } =
    useRouting(settings);
  const [openListId, setOpenListId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (error && !lists) return <p className="screen-msg error">{error}</p>;
  if (!lists) return <p className="screen-msg hint">Loading lists…</p>;

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
      <div className="routes__toolbar">
        <h2 className="routes__title">Routing</h2>
        <button className="add-list" onClick={() => setCreating(true)}>
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
