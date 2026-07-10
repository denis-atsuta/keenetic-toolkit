import type { SelectOption } from '@/components/ui/Select';
import type { Policy, PolicyState } from '@/utils/keenetic/api';

/** Select values: the three fixed states plus "p:<PolicyN>". */
const DEFAULT = 'default';
const SEGMENT = 'segment';
const DENY = 'deny';
const POLICY_PREFIX = 'p:';

export function toSelectValue(state: PolicyState | undefined): string {
  if (!state) return DEFAULT;
  return state.kind === 'policy' ? POLICY_PREFIX + state.id : state.kind;
}

export function fromSelectValue(value: string): PolicyState {
  if (value.startsWith(POLICY_PREFIX)) {
    return { kind: 'policy', id: value.slice(POLICY_PREFIX.length) };
  }
  return { kind: value as 'default' | 'segment' | 'deny' };
}

export function buildPolicyOptions(policies: Policy[]): SelectOption[] {
  return [
    { value: DEFAULT, label: 'Default' },
    { value: SEGMENT, label: 'Segment default' },
    ...policies.map((p) => ({ value: POLICY_PREFIX + p.id, label: p.description })),
    { value: DENY, label: 'No internet' },
  ];
}
