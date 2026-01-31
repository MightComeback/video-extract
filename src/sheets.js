export function formatSheetRow(data) {
  // Matches the fields in formatCsv but returns an array for the API
  return [
    data.date || '',
    data.title || '',
    data.source || '',
    data.mediaUrl || '',
    data.description || '',
    data.screenshot || '',
    data.text || ''
  ];
}

export function indexToColumn(index) {
  let temp, letter = '';
  let i = index;
  while (i >= 0) {
    temp = i % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    i = Math.floor(i / 26) - 1;
  }
  return letter;
}
