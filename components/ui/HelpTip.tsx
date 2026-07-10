import * as RTooltip from '@radix-ui/react-tooltip';
import './HelpTip.css';

/** Keenetic-style "?" help marker with a tooltip, matching the web UI. */
export function HelpTip({ children }: { children: React.ReactNode }) {
  return (
    <RTooltip.Provider delayDuration={150}>
      <RTooltip.Root>
        <RTooltip.Trigger asChild>
          <button type="button" className="helptip" aria-label="More information">
            ?
          </button>
        </RTooltip.Trigger>
        <RTooltip.Portal>
          <RTooltip.Content className="helptip__bubble" side="top" align="center" sideOffset={6}>
            {children}
            <RTooltip.Arrow className="helptip__arrow" />
          </RTooltip.Content>
        </RTooltip.Portal>
      </RTooltip.Root>
    </RTooltip.Provider>
  );
}
