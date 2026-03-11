const COMMON_OPTION_TOKENS = new Set([
  "inc",
  "llc",
  "co",
  "corp",
  "corporation",
  "company",
  "ltd",
  "limited",
  "technologies",
  "technology",
  "software"
]);

const MIN_FUZZY_MATCH_SCORE = 0.86;

const stripDiacritics = (value: string): string => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

const toBigrams = (value: string): string[] => {
  if (value.length === 0) return [];
  if (value.length === 1) return [value];

  const result: string[] = [];
  for (let index = 0; index < value.length - 1; index += 1) {
    result.push(value.slice(index, index + 2));
  }
  return result;
};

const diceCoefficient = (left: string, right: string): number => {
  const leftBigrams = toBigrams(left);
  const rightBigrams = toBigrams(right);
  if (leftBigrams.length === 0 || rightBigrams.length === 0) return 0;

  const counts = new Map<string, number>();
  for (const gram of leftBigrams) {
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }

  let overlap = 0;
  for (const gram of rightBigrams) {
    const count = counts.get(gram) ?? 0;
    if (count <= 0) continue;
    overlap += 1;
    counts.set(gram, count - 1);
  }

  return (2 * overlap) / (leftBigrams.length + rightBigrams.length);
};

const levenshteinDistance = (left: string, right: string): number => {
  if (left === right) return 0;
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;

  const previous = new Array(right.length + 1).fill(0).map((_, index) => index);
  const current = new Array(right.length + 1).fill(0);

  for (let row = 1; row <= left.length; row += 1) {
    current[0] = row;
    for (let col = 1; col <= right.length; col += 1) {
      const substitutionCost = left[row - 1] === right[col - 1] ? 0 : 1;
      current[col] = Math.min(previous[col] + 1, current[col - 1] + 1, previous[col - 1] + substitutionCost);
    }

    for (let col = 0; col <= right.length; col += 1) {
      previous[col] = current[col];
    }
  }

  return previous[right.length];
};

const similarityFromLevenshtein = (left: string, right: string): number => {
  const maxLength = Math.max(left.length, right.length);
  if (maxLength === 0) return 1;
  return 1 - levenshteinDistance(left, right) / maxLength;
};

const tokenize = (searchKey: string): string[] => {
  if (searchKey.length === 0) return [];
  return searchKey
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !COMMON_OPTION_TOKENS.has(token));
};

const jaccard = (left: string[], right: string[]): number => {
  if (left.length === 0 || right.length === 0) return 0;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let intersection = 0;

  for (const token of leftSet) {
    if (rightSet.has(token)) intersection += 1;
  }

  const unionSize = leftSet.size + rightSet.size - intersection;
  if (unionSize <= 0) return 0;
  return intersection / unionSize;
};

const isTokenSubset = (left: string[], right: string[]): boolean => {
  if (left.length === 0 || right.length === 0) return false;
  const leftSet = new Set(left);
  const rightSet = new Set(right);

  const smaller = leftSet.size <= rightSet.size ? leftSet : rightSet;
  const larger = leftSet.size <= rightSet.size ? rightSet : leftSet;
  for (const token of smaller) {
    if (!larger.has(token)) return false;
  }
  return true;
};

const computeOptionScore = (inputKey: string, inputTokens: string[], optionKey: string, optionTokens: string[]): number => {
  if (inputKey === optionKey) return 1;
  if (inputKey.length < 2 || optionKey.length < 2) return 0;

  let best = 0;

  if (inputKey.includes(optionKey) || optionKey.includes(inputKey)) {
    const shorter = Math.min(inputKey.length, optionKey.length);
    const longer = Math.max(inputKey.length, optionKey.length);
    const ratio = longer === 0 ? 0 : shorter / longer;
    best = Math.max(best, 0.86 + ratio * 0.14);
  }

  const tokenOverlap = jaccard(inputTokens, optionTokens);
  best = Math.max(best, tokenOverlap);

  if (isTokenSubset(inputTokens, optionTokens)) {
    const smaller = Math.min(inputTokens.length, optionTokens.length);
    const larger = Math.max(inputTokens.length, optionTokens.length);
    const ratio = larger === 0 ? 0 : smaller / larger;
    best = Math.max(best, 0.88 + ratio * 0.12);
  }

  best = Math.max(best, similarityFromLevenshtein(inputKey, optionKey));
  best = Math.max(best, diceCoefficient(inputKey, optionKey));

  return best;
};

export const normalizeOptionLabel = (value: string): string => value.trim().replace(/\s+/g, " ");

export const normalizeOptionSearchKey = (value: string): string => {
  const normalized = normalizeOptionLabel(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "");

  return stripDiacritics(normalized).replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
};

export type FuzzyOptionMatch = {
  option: string;
  score: number;
};

export const findBestOptionMatch = (input: string, options: string[], minScore = MIN_FUZZY_MATCH_SCORE): FuzzyOptionMatch | null => {
  const inputLabel = normalizeOptionLabel(input);
  const inputKey = normalizeOptionSearchKey(inputLabel);
  if (inputKey.length < 2) return null;

  const dedupedOptions = new Map<string, string>();
  for (const option of options) {
    const label = normalizeOptionLabel(option);
    const key = normalizeOptionSearchKey(label);
    if (key.length < 2) continue;
    if (!dedupedOptions.has(key)) dedupedOptions.set(key, label);
  }

  const exact = dedupedOptions.get(inputKey);
  if (exact) return { option: exact, score: 1 };

  const inputTokens = tokenize(inputKey);
  let best: FuzzyOptionMatch | null = null;

  for (const [optionKey, optionLabel] of dedupedOptions.entries()) {
    const score = computeOptionScore(inputKey, inputTokens, optionKey, tokenize(optionKey));
    if (!best || score > best.score) {
      best = { option: optionLabel, score };
    }
  }

  if (!best || best.score < minScore) return null;
  return best;
};

export type ResolveOptionSelectionsResult = {
  resolvedSelections: string[];
  newEntries: string[];
};

export const resolveOptionSelections = (inputs: string[], existingOptions: string[]): ResolveOptionSelectionsResult => {
  const existingByKey = new Map<string, string>();
  for (const option of existingOptions) {
    const label = normalizeOptionLabel(option);
    const key = normalizeOptionSearchKey(label);
    if (key.length < 2) continue;
    if (!existingByKey.has(key)) existingByKey.set(key, label);
  }

  const resolvedByKey = new Map<string, string>();
  const newEntriesByKey = new Map<string, string>();

  for (const input of inputs) {
    const inputLabel = normalizeOptionLabel(input);
    const inputKey = normalizeOptionSearchKey(inputLabel);
    if (inputKey.length < 2) continue;

    const match = findBestOptionMatch(inputLabel, Array.from(existingByKey.values()));
    const resolved = match?.option ?? inputLabel;
    const resolvedKey = normalizeOptionSearchKey(resolved);
    if (resolvedKey.length < 2) continue;
    if (!resolvedByKey.has(resolvedKey)) resolvedByKey.set(resolvedKey, resolved);

    if (!existingByKey.has(resolvedKey) && !newEntriesByKey.has(resolvedKey)) {
      newEntriesByKey.set(resolvedKey, resolved);
      existingByKey.set(resolvedKey, resolved);
    }
  }

  return {
    resolvedSelections: Array.from(resolvedByKey.values()),
    newEntries: Array.from(newEntriesByKey.values())
  };
};
