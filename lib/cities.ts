export function normalizeCityKey(value: string | null | undefined) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function getCanonicalCityLabel(value: string | null | undefined) {
  const key = normalizeCityKey(value);

  if (key === 'yaounde') {
    return 'Yaoundé';
  }

  if (key === 'douala') {
    return 'Douala';
  }

  return value?.trim() || '';
}

export function isMatchingCity(left: string | null | undefined, right: string | null | undefined) {
  const leftKey = normalizeCityKey(left);
  const rightKey = normalizeCityKey(right);

  return Boolean(leftKey) && leftKey === rightKey;
}

export function formatCityLabel(value: string | null | undefined) {
  return getCanonicalCityLabel(value);
}
