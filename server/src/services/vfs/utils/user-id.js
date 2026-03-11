const safeUserIdValue = (userId) => {
  const asNum = Number(userId);
  if (Number.isFinite(asNum) && asNum > 0) return asNum;
  return 0;
};

const safeUserIdString = (value) => (Number.isFinite(Number(value)) ? String(Number(value)) : '0');

module.exports = { safeUserIdValue, safeUserIdString };
