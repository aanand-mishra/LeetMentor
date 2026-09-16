export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
}

/**
 * Generates a clean, simple line-by-line diff between two code snippets.
 */
export function computeSimpleLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  const diff: DiffLine[] = [];
  let i = 0;
  let j = 0;

  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length) {
      if (oldLines[i] === newLines[j]) {
        diff.push({ type: 'unchanged', text: oldLines[i] });
        i++;
        j++;
      } else {
        // Check if old line exists further down in newLines
        const nextInNew = newLines.indexOf(oldLines[i], j);
        const nextInOld = oldLines.indexOf(newLines[j], i);

        if (nextInNew !== -1 && (nextInOld === -1 || nextInNew - j <= nextInOld - i)) {
          // Lines were added in newLines
          while (j < nextInNew) {
            diff.push({ type: 'added', text: newLines[j] });
            j++;
          }
        } else if (nextInOld !== -1) {
          // Lines were removed from oldLines
          while (i < nextInOld) {
            diff.push({ type: 'removed', text: oldLines[i] });
            i++;
          }
        } else {
          // Changed line
          diff.push({ type: 'removed', text: oldLines[i] });
          diff.push({ type: 'added', text: newLines[j] });
          i++;
          j++;
        }
      }
    } else if (i < oldLines.length) {
      diff.push({ type: 'removed', text: oldLines[i] });
      i++;
    } else if (j < newLines.length) {
      diff.push({ type: 'added', text: newLines[j] });
      j++;
    }
  }

  return diff;
}
