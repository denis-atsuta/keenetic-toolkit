import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Icon } from '@/components/ui/Icon';
import type { AddressList } from '@/utils/keenetic/routing';
import { groupHosts, type ScanResult } from '@/utils/scan';

const NEW_LIST_VALUE = '__new__';

interface ScanPickerProps {
  result: ScanResult;
  lists: AddressList[];
  onBack: () => void;
  /** Re-reads the page's resource buffer and merges new hosts into `result`. */
  onRescan: () => Promise<void>;
  /** `destination === null` means "create a new list". */
  onContinue: (hosts: string[], destination: AddressList | null) => void;
}

/**
 * Post-scan step: hosts grouped by registrable domain. A checked group adds
 * just the eTLD+1 (Keenetic covers subdomains); unchecking it lets the user
 * pick specific subdomains.
 */
export function ScanPicker({ result, lists, onBack, onRescan, onContinue }: ScanPickerProps) {
  const groups = useMemo(() => groupHosts(result.hosts), [result.hosts]);
  const [whole, setWhole] = useState<ReadonlySet<string>>(
    new Set(groups.map((g) => g.domain)),
  );
  const [checkedHosts, setCheckedHosts] = useState<ReadonlySet<string>>(new Set());
  const [dest, setDest] = useState(NEW_LIST_VALUE);
  const [rescanning, setRescanning] = useState(false);
  const [rescanError, setRescanError] = useState<string | null>(null);

  // Domains that appear after a rescan get checked by default, without
  // touching what the user has already (un)checked.
  const knownDomains = useRef(new Set(groups.map((g) => g.domain)));
  useEffect(() => {
    const fresh = groups.filter((g) => !knownDomains.current.has(g.domain));
    if (fresh.length === 0) return;
    fresh.forEach((g) => knownDomains.current.add(g.domain));
    setWhole((prev) => new Set([...prev, ...fresh.map((g) => g.domain)]));
  }, [groups]);

  async function rescan() {
    setRescanning(true);
    setRescanError(null);
    try {
      await onRescan();
    } catch (e) {
      setRescanError(e instanceof Error ? e.message : String(e));
    } finally {
      setRescanning(false);
    }
  }

  const options: SelectOption[] = [
    { value: NEW_LIST_VALUE, label: 'New list' },
    ...lists.map((l) => ({ value: l.id, label: l.name })),
  ];

  const selected = groups.flatMap((g) =>
    whole.has(g.domain) ? [g.domain] : g.hosts.filter((h) => checkedHosts.has(h)),
  );

  function toggleWhole(domain: string, value: boolean) {
    setWhole((prev) => {
      const next = new Set(prev);
      if (value) next.add(domain);
      else next.delete(domain);
      return next;
    });
  }

  function toggleHost(host: string, value: boolean) {
    setCheckedHosts((prev) => {
      const next = new Set(prev);
      if (value) next.add(host);
      else next.delete(host);
      return next;
    });
  }

  return (
    <div className="scan">
      <header className="list-detail__head">
        <button className="icon-button" title="Back" onClick={onBack}>
          <Icon name="routes" size={16} />
          <span>Back</span>
        </button>
        <div className="list-section__actions">
          <button
            type="button"
            className="link-btn"
            title="Re-read the page and add newly loaded hosts"
            onClick={() => void rescan()}
            disabled={rescanning}
          >
            {rescanning ? 'Rescanning…' : 'Rescan'}
          </button>
          <span className="list-section__count">{selected.length} selected</span>
        </div>
      </header>

      <p className="scan__origin">
        Hosts loaded by <strong>{result.pageHost}</strong>
      </p>
      {rescanError && <p className="error">{rescanError}</p>}
      {!result.pageLoaded && (
        <p className="scan__note">
          The page did not load — likely the site itself is blocked, so only its domain is
          listed. Add it to a routed list, reload the page and scan again to see what else it
          needs.
        </p>
      )}

      <ul className="scan__hosts">
        {groups.map((g) => {
          const isWhole = whole.has(g.domain);
          return (
            <li key={g.domain} className="scan-group">
              <Checkbox checked={isWhole} onChange={(v) => toggleWhole(g.domain, v)}>
                {g.domain}
              </Checkbox>
              {g.subs.length > 0 && (
                <ul className="scan-group__subs">
                  {g.subs.map((h) => (
                    <li key={h}>
                      <Checkbox
                        checked={isWhole || checkedHosts.has(h)}
                        disabled={isWhole}
                        onChange={(v) => toggleHost(h, v)}
                      >
                        {h}
                      </Checkbox>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <label className="field-row">
        <span className="field-row__label">Add to</span>
        <Select value={dest} options={options} ariaLabel="Destination list" onChange={setDest} />
      </label>

      <div className="list-detail__actions">
        <Button
          disabled={selected.length === 0}
          onClick={() =>
            onContinue(
              selected,
              dest === NEW_LIST_VALUE ? null : (lists.find((l) => l.id === dest) ?? null),
            )
          }
        >
          Continue
        </Button>
        <Button variant="outline" onClick={onBack}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
