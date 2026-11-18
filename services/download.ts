/** Saves data to a file on the device. The object URL is released afterwards. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // A phone can start the save late. An early release cancels it.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
