/**
 * UI state persisted across popup close/reopen. Backed by storage.session:
 * the popup reopens where the user left it, and a browser restart starts
 * clean (matching how the session ha1 behaves).
 */
import type { ScanResult } from '@/utils/scan';

export type SectionId = 'devices' | 'routing' | 'settings' | 'account';

/** Unsaved list-editor fields, so an accidental popup close loses nothing. */
export interface ListDraft {
  /** List id being edited, or '' for a not-yet-created list. */
  target: string;
  name: string;
  addressesText: string;
  routed: boolean;
  interfaceId: string;
  auto: boolean;
  exclusive: boolean;
}

/** Scan → editor handoff, re-resolved against fresh lists after a reopen. */
export interface ScanHandoff {
  /** Destination list id, or '' for a new list. */
  listId: string;
  /** Prefilled name (new list only). */
  name: string;
  /** Hosts chosen in the scan picker. */
  preset: string[];
}

/** Scan-picker checkbox state. */
export interface ScanSelection {
  whole: string[];
  hosts: string[];
  dest: string;
}

export interface RoutingUiState {
  openListId: string | null;
  creating: boolean;
  scan: ScanResult | null;
  scanSel: ScanSelection | null;
  handoff: ScanHandoff | null;
  draft: ListDraft | null;
}

export const EMPTY_ROUTING_UI: RoutingUiState = {
  openListId: null,
  creating: false,
  scan: null,
  scanSel: null,
  handoff: null,
  draft: null,
};

const sectionStore = storage.defineItem<SectionId>('session:ui.section', {
  fallback: 'devices',
});
const routingStore = storage.defineItem<RoutingUiState>('session:ui.routing', {
  fallback: EMPTY_ROUTING_UI,
});

export const loadSection = () => sectionStore.getValue();
export const saveSection = (section: SectionId) => void sectionStore.setValue(section);

export const loadRoutingUi = () => routingStore.getValue();
export const saveRoutingUi = (state: RoutingUiState) => void routingStore.setValue(state);
