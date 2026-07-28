/**
 * Heqja e te dhenave financiare per rolet qe s'kane te drejte t'i shohin.
 *
 * KJO ESHTE MBROJTJE, JO ZBUKURIM. Fshehja e kolonave te nderfaqja nuk
 * mjafton: pergjigjja e API-t shihet lehte te "Network" i shfletuesit.
 * Prandaj shifrat hiqen KETU, para se te dalin nga serveri.
 *
 * Stafit i mbeten te dhenat qe i duhen per menaxhimin e nxenesve —
 * plani i pageses dhe kuota bruto jane pjese e kontrates, jo gjendje
 * financiare, prandaj nuk fshihen.
 */

/** Fushat e nje nxenesi qe tregojne GJENDJEN financiare. */
function stripStudentFinance(student) {
    if (!student) return student;
    const { finance, payments, settled_paid: _s, total_paid: _t, ...rest } = student;
    return rest;
}

/** E njejta gje per nje liste. */
function stripListFinance(students) {
    return (students || []).map(stripStudentFinance);
}

/**
 * Paneli pa shifra: mbeten numrat e nxenesve, bien shumat dhe alarmet
 * (alarmet ndertohen mbi borxhin, prandaj s'kane kuptim pa te).
 */
function stripDashboard(data) {
    const t = data.totals || {};
    return {
        totals: {
            students: t.students,
            graduates: t.graduates,
        },
        categories: (data.categories || []).map((c) => ({
            category_id: c.category_id,
            name: c.name,
            color: c.color,
            students: c.students,
        })),
        alerts: [],
        recent: stripListFinance(data.recent),
    };
}

module.exports = { stripStudentFinance, stripListFinance, stripDashboard };