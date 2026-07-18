/**
 * Konfigurimi qendror i financave.
 * Ndryshoni vetem ketu nese rregullat e pagesave ndryshojne.
 */
module.exports = {
  // Sa keste gjenerohen per secilin plan dhe sa muaj ka mes tyre
  PLAN_CONFIG: {
    monthly:    { count: 10, stepMonths: 1 }, // viti shkollor: 10 keste mujore
    semiannual: { count: 2,  stepMonths: 6 },
    annual:     { count: 1,  stepMonths: 0 },
  },

  // Sa dite para afatit shfaqet paralajmerimi i verdhe
  WARNING_DAYS: 7,

  // Toleranca e rrumbullakimit ne krahasime monetare
  EPSILON: 0.005,
};
