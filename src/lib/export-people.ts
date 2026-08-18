import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

function getExportFileName(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `namekeep-people-${date}.csv`;
}

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: {
      description: string;
      accept: Record<string, string[]>;
    }[];
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

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

async function saveOnWeb(contents: string, fileName: string): Promise<void> {
  const saveFilePicker = (window as SaveFilePickerWindow).showSaveFilePicker;
  if (!saveFilePicker) {
    downloadOnWeb(contents, fileName);
    return;
  }

  try {
    const handle = await saveFilePicker.call(window, {
      suggestedName: fileName,
      types: [
        {
          description: 'CSV file',
          accept: { 'text/csv': ['.csv'] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(
      new Blob([contents], { type: 'text/csv;charset=utf-8' }),
    );
    await writable.close();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    throw error;
  }
}

export async function exportPeopleCsv(contents: string): Promise<void> {
  const fileName = getExportFileName();

  if (Platform.OS === 'web') {
    await saveOnWeb(contents, fileName);
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
