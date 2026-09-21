import React, { useState, useEffect } from 'react';
import { Download, AlertCircle, X } from 'lucide-react';
import { problemsRepo } from '../../db';
import { triggerExportDownload } from '../../utils/export';
import { useToast } from '../../hooks/useToast';

export const DataDurabilityBanner: React.FC = () => {
  const toast = useToast();
  const [bannerType, setBannerType] = useState<'first_run' | 'export_reminder' | null>(null);

  useEffect(() => {
    checkDurabilityStatus();
  }, []);

  const checkDurabilityStatus = async () => {
    const dismissedUntil = localStorage.getItem('dsa_durability_dismissed_until');
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
      return;
    }

    const firstRunSeen = localStorage.getItem('dsa_first_run_seen');
    if (!firstRunSeen) {
      setBannerType('first_run');
      return;
    }

    // Check problems count and days since last export
    const count = await problemsRepo
      .getAll()
      .then((p) => p.length)
      .catch(() => 0);
    if (count === 0) return;

    const lastExportStr = localStorage.getItem('dsa_last_export_timestamp');
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

    if (!lastExportStr || Date.now() - parseInt(lastExportStr, 10) > fourteenDaysMs) {
      setBannerType('export_reminder');
    }
  };

  const handleDismiss = () => {
    if (bannerType === 'first_run') {
      localStorage.setItem('dsa_first_run_seen', 'true');
    }
    // Dismiss for 7 days (max once/week per NFR-4)
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem('dsa_durability_dismissed_until', (Date.now() + sevenDaysMs).toString());
    setBannerType(null);
  };

  const handleExportNow = async () => {
    try {
      await triggerExportDownload();
      localStorage.setItem('dsa_last_export_timestamp', Date.now().toString());
      localStorage.setItem('dsa_first_run_seen', 'true');
      setBannerType(null);
      toast.success('Backup downloaded successfully!');
    } catch (err) {
      console.error('Failed to export:', err);
      toast.error('Failed to export backup.');
    }
  };

  if (!bannerType) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 px-4 py-2.5 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
          {bannerType === 'first_run' ? (
            <span>
              <strong>Local-First Notice:</strong> Your data is stored directly in this browser's
              IndexedDB. Clearing browser cache or site data will erase your problems. Export
              backups periodically to prevent data loss.
            </span>
          ) : (
            <span>
              <strong>Backup Reminder:</strong> You haven't taken a data backup in over 14 days.
              Protect your solutions, attempts, and notes by exporting a JSON backup.
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={handleExportNow}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium shadow-xs flex items-center gap-1 transition-colors"
          >
            <Download className="w-3 h-3" />
            <span>Export backup now</span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            title="Dismiss for 1 week"
            className="p-1 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
