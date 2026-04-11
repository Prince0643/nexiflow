const sanitizeAIReply = (value) => {
  if (typeof value !== 'string') return '';

  return value
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .trim();
};

module.exports = {
  sanitizeAIReply
};
