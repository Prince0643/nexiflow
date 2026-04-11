const toNormalizedPrompt = (prompt) => (typeof prompt === 'string' ? prompt.toLowerCase().trim() : '');

const matchesAny = (value, patterns) => patterns.some((pattern) => pattern.test(value));

const STOP_PATTERNS = [
  /\bstop\b[\s\w]*\btimer\b/,
  /\bstop\b[\s\w]*\btime\b/,
  /\bend\b[\s\w]*\btimer\b/,
  /\bend\b[\s\w]*\btime\b/,
  /\bfinish\b[\s\w]*\btimer\b/,
  /\bfinish\b[\s\w]*\btime\b/,
  /\bclock\s*out\b/
];

const START_PATTERNS = [
  /\bstart\b[\s\w]*\btimer\b/,
  /\bstart\b[\s\w]*\btime\b/,
  /\bbegin\b[\s\w]*\btimer\b/,
  /\bbegin\b[\s\w]*\btime\b/,
  /\bclock\s*me\s*in\b/,
  /\bclock\s*in\b/
];

const isStopTimerIntent = (prompt) => {
  const value = toNormalizedPrompt(prompt);
  return value ? matchesAny(value, STOP_PATTERNS) : false;
};

const isStartTimerIntent = (prompt) => {
  const value = toNormalizedPrompt(prompt);
  return value ? matchesAny(value, START_PATTERNS) : false;
};

module.exports = {
  isStartTimerIntent,
  isStopTimerIntent
};
