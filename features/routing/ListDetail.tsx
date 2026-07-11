import { useEffect, useState } from 'react';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Toggle } from '@/components/ui/Toggle';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Icon } from '@/components/ui/Icon';
import { HelpTip } from '@/components/ui/HelpTip';
import {
  parseAddresses,
  type AddressList,
  type ListDetailEdit,
  type NetInterface,
} from '@/utils/keenetic/routing';
import { normalizeAddresses } from '@/utils/addresses';
import type { ListDraft } from '@/utils/ui-state';

interface ListDetailProps {
  list: AddressList;
  interfaces: NetInterface[];
  busy: boolean;
  /** True when creating a new list rather than editing an existing one. */
  isNew?: boolean;
  /** Overrides the initial addresses (page-scan handoff); Save still diffs against `list`. */
  presetAddresses?: string[];
  /** Unsaved edits restored after a popup reopen (applied when the target matches). */
  draft?: ListDraft | null;
  /** Reports every edit so it survives an accidental popup close. */
  onDraftChange?: (draft: ListDraft) => void;
  onBack: () => void;
  /** Called after a successful save instead of onBack (e.g. to reset a flow). */
  onSaved?: () => void;
  onSave: (original: AddressList, edit: ListDetailEdit) => Promise<void>;
  onDelete: (listId: string) => Promise<void>;
}

export function ListDetail({
  list,
  interfaces,
  busy,
  isNew,
  presetAddresses,
  draft,
  onDraftChange,
  onBack,
  onSaved,
  onSave,
  onDelete,
}: ListDetailProps) {
  const rule = list.rule;
  const target = isNew ? '' : list.id;
  // A restored draft for this same target wins over the list's saved state.
  const restored = draft && draft.target === target ? draft : null;
  const [name, setName] = useState(restored?.name ?? list.name);
  const [addressesText, setAddressesText] = useState(
    restored?.addressesText ?? (presetAddresses ?? list.addresses).join('\n'),
  );
  const [routed, setRouted] = useState(restored?.routed ?? rule?.enabled ?? false);
  const [interfaceId, setInterfaceId] = useState(
    restored?.interfaceId ?? rule?.interfaceId ?? interfaces[0]?.id ?? '',
  );
  const [auto, setAuto] = useState(restored?.auto ?? rule?.auto ?? true);
  const [exclusive, setExclusive] = useState(restored?.exclusive ?? rule?.exclusive ?? false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    onDraftChange?.({ target, name, addressesText, routed, interfaceId, auto, exclusive });
  }, [onDraftChange, target, name, addressesText, routed, interfaceId, auto, exclusive]);

  const options: SelectOption[] = interfaces.map((i) => ({ value: i.id, label: i.name }));
  const addresses = parseAddresses(addressesText);

  async function save() {
    await onSave(list, { name, addresses, routed, interfaceId, auto, exclusive });
    (onSaved ?? onBack)();
  }

  async function del() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    await onDelete(list.id);
    onBack();
  }

  return (
    <div className="list-detail">
      <header className="list-detail__head">
        <button className="icon-button" title="Back" onClick={onBack}>
          <Icon name="routes" size={16} />
          <span>Back</span>
        </button>
        {!isNew && (
          <button
            className={`detail-delete ${confirmingDelete ? 'detail-delete--confirm' : ''}`}
            title="Delete list"
            onClick={() => void del()}
            disabled={busy}
          >
            <Icon name="trash" size={16} />
            {confirmingDelete && <span>Delete?</span>}
          </button>
        )}
      </header>

      <TextField label="List name" value={name} onChange={setName} autoFocus={isNew} />

      <div className="list-detail__addresses">
        <div className="list-section__head">
          <h3 className="list-section__title">Addresses</h3>
          <div className="list-section__actions">
            <button
              type="button"
              className="link-btn"
              title="Fold subdomains and IPs already covered by a broader entry"
              onClick={() => setAddressesText(normalizeAddresses(addressesText.split('\n')).join('\n'))}
            >
              Normalize
            </button>
            <span className="list-section__count">{addresses.length}</span>
          </div>
        </div>
        <textarea
          className="address-input"
          value={addressesText}
          spellCheck={false}
          placeholder="One domain or IP/CIDR per line"
          onChange={(e) => setAddressesText(e.target.value)}
        />
      </div>

      <section className="list-section list-detail__routing">
        <div className="list-section__head">
          <h3 className="list-section__title">Routing</h3>
          <Toggle checked={routed} onChange={setRouted} ariaLabel="Route this list" />
        </div>
        {routed && (
          <>
            <label className="field-row">
              <span className="field-row__label">Interface</span>
              <Select
                value={interfaceId}
                options={options}
                ariaLabel="Interface"
                onChange={setInterfaceId}
              />
            </label>
            <div className="field-row field-row--inline">
              <span className="field-row__label">
                Auto-add
                <HelpTip>Apply the route only while the selected interface is up.</HelpTip>
              </span>
              <Toggle checked={auto} onChange={setAuto} ariaLabel="Auto-add" />
            </div>
            <div className="field-row field-row--inline">
              <span className="field-row__label">
                Exclusive
                <HelpTip>
                  Route this traffic only through the selected interface; if it is down, the traffic
                  is not routed at all.
                </HelpTip>
              </span>
              <Toggle checked={exclusive} onChange={setExclusive} ariaLabel="Exclusive route" />
            </div>
          </>
        )}
      </section>

      <div className="list-detail__actions">
        <Button onClick={() => void save()} disabled={busy || (isNew && !name.trim())}>
          {busy ? 'Saving…' : isNew ? 'Create' : 'Save'}
        </Button>
        <Button variant="outline" onClick={onBack} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
