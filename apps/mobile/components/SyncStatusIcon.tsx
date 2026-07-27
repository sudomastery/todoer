import { Ionicons } from '@expo/vector-icons';
import { useSyncStatus } from '../lib/sync';
import { useTheme } from '../lib/theme';

/**
 * Small icon next to the header title: visible while actively pushing queued
 * changes, or (sticky) once something has sat unsynced for over 5 minutes.
 * Hidden otherwise, matching a plain field's icon-free header.
 */
export function SyncStatusIcon() {
  const t = useTheme();
  const { visible, isActivelySyncing } = useSyncStatus();
  if (!visible) return null;

  return (
    <Ionicons
      name={isActivelySyncing ? 'sync-outline' : 'cloud-offline-outline'}
      size={16}
      color={isActivelySyncing ? t.fgFaint : '#d1453b'}
      style={{ marginLeft: 6 }}
    />
  );
}
