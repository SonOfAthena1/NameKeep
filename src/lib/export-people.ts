import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

function getExportFileName(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `namekeep-people-${date}.csv`;
}

function downloadOnWeb(contents: string, fileName: string): void {
  const url = URL.createObjectURL(
    new Blob([contents], { type: 'text/csv;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function exportPeopleCsv(contents: string): Promise<void> {
  const fileName = getExportFileName();

  if (Platform.OS === 'web') {
    downloadOnWeb(contents, fileName);
    return;
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }

  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(contents);

  await Sharing.shareAsync(file.uri, {
    dialogTitle: 'Export people',
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
  });
}
