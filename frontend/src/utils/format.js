// src/utils/format.js
export const shortText = (s, n = 150) => (s && s.length > n ? s.slice(0, n) + "..." : s);
