import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ variant?: 'compact' | 'sidebar' }> = ({
  variant = 'compact',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className={
          variant === 'sidebar'
            ? 'flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white transition-colors hover:border-[#EF1717] hover:bg-[#EF1717]/10 whitespace-nowrap'
            : 'inline-flex items-center gap-2 rounded-md border border-white/15 bg-[#151515] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:border-[#EF1717] whitespace-nowrap shrink-0'
        }
      >
        <Download className="h-3.5 w-3.5 text-[#EF1717]" />
        Install App
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={
            variant === 'sidebar'
              ? 'flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white transition-colors hover:border-[#EF1717] whitespace-nowrap'
              : 'inline-flex items-center gap-2 rounded-md border border-white/15 bg-[#151515] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:border-[#EF1717] whitespace-nowrap shrink-0'
          }
        >
          <Smartphone className="h-3.5 w-3.5 text-[#EF1717]" />
          Install on iOS
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-sm rounded-lg border border-white/15 bg-[#151515] p-6 text-white">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold uppercase tracking-wide">
                  Install TITAN X App
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="rounded p-1 text-[#A0A0A0] hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#A0A0A0]">
                1. Tap the <strong className="text-white">Share</strong> icon in Safari.
                <br />
                2. Scroll down and tap <strong className="text-white">Add to Home Screen</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-md bg-[#EF1717] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#d11313]"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-md border border-amber-500/40 bg-[#151515] px-3.5 py-2 text-xs font-medium text-amber-300 shadow-lg">
      <WifiOff className="h-3.5 w-3.5" />
      <span>Offline Mode — Cached interface active</span>
    </div>
  );
};
