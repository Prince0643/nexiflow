const toNormalizedPrompt = (prompt) => (typeof prompt === 'string' ? prompt.toLowerCase().trim() : '');

const isCurrentTimeIntent = (prompt) => {
  const value = toNormalizedPrompt(prompt);
  if (!value) return false;

  return (
    /\bwhat\s+time\s+is\s+it\b/.test(value) ||
    /\bcurrent\s+time\b/.test(value) ||
    /\btime\s+now\b/.test(value)
  );
};

const getSummaryPeriodFromPrompt = (prompt) => {
  const value = toNormalizedPrompt(prompt);
  if (!value) return null;

  if (/\b(today|this day)\b/.test(value)) return 'today';
  if (/\b(this week|weekly)\b/.test(value)) return 'week';
  if (/\b(this month|monthly)\b/.test(value)) return 'month';
  return null;
};

const isEarningsIntent = (prompt) => {
  const value = toNormalizedPrompt(prompt);
  if (!value) return false;

  const earningsWords = [
    /\bhow much\b/,
    /\bearn(?:ed|ings)?\b/,
    /\bmade\b/,
    /\brender(?:ed)?\b/,
    /\bbillable\b/
  ];

  const periodWords = [
    /\btoday\b/,
    /\bthis week\b/,
    /\bthis month\b/
  ];

  return earningsWords.some((pattern) => pattern.test(value)) && periodWords.some((pattern) => pattern.test(value));
};

module.exports = {
  getSummaryPeriodFromPrompt,
  isCurrentTimeIntent,
  isEarningsIntent
};
