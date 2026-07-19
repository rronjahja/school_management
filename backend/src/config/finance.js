/**
 * Konfigurimi qendror i financave — sipas Nenit 6 të Kontratës për Shkollim.
 * Ndryshoni vetëm këtu nëse rregullat e pagesave ndryshojnë.
 *
 * Datat fikse janë 'MM-DD' dhe i takojnë vitit shkollor të regjistrimit:
 * muajt gusht–dhjetor bien në vitin e parë të gjeneratës,
 * muajt janar–korrik në vitin e dytë.
 */
module.exports = {
  PLAN_CONFIG: {
    // 1. Pagesë e menjëhershme — brenda 5 ditësh nga nënshkrimi
    immediate: { label: 'E menjëhershme' },

    // 2. Dy këste — i pari brenda 5 ditësh, i dyti 5 ditë pas fillimit
    //    të gjysmëvjetorit të dytë (data konfigurohet këtu)
    two: { label: '2 Këste', secondDate: '01-25' },

    // 3. Katër këste — i pari brenda 5 ditësh, pastaj datat fikse
    four: { label: '4 Këste', fixedDates: ['11-15', '02-10', '04-15'] },

    // 4. Gjashtë këste — i pari 30% me rastin e regjistrimit, pastaj datat fikse
    six: {
      label: '6 Këste',
      firstPercent: 30,
      fixedDates: ['11-15', '12-30', '02-10', '04-10', '05-15'],
    },

    // 5. Pagesë mujore — 12 muaj kalendarikë, i pari me rastin e regjistrimit
    monthly: { label: 'Mujore (12 muaj)', count: 12 },
  },

  // "më së largu 5 (pesë) ditë nga data e nënshkrimit të kontratës"
  SIGNING_GRACE_DAYS: 5,

  // Sa ditë para afatit shfaqet paralajmërimi i verdhë
  WARNING_DAYS: 7,

  // Toleranca e rrumbullakimit në krahasime monetare
  EPSILON: 0.005,
};