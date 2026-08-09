/**
 * Rolet e sistemit dhe çfarë sheh secili.
 *
 * E VETMJA listë e të drejtave. Kudo tjetër — te middleware-i, te
 * shërbimet, te rrugët — pyetet kjo skedë, që të mos ketë dy vende ku
 * shkruhet «kush e sheh çfarë» dhe të mbeten pa u pajtuar me njëri-tjetrin.
 *
 * Ndarja bëhet sipas ZONËS së punës, jo sipas rolit: kështu shtimi i një
 * roli të ri është një rresht, jo një gjueti nëpër skedarë.
 */

const ROLES = ['admin', 'menaxher', 'finance', 'kujdestar', 'staff'];

const ROLE_LABELS = {
    admin: 'Administrator',
    menaxher: 'Menaxher',
    finance: 'Financa',
    kujdestar: 'Kujdestar/e',
    staff: 'Staf',
};

/**
 * Zonat e punës dhe rolet që i hapin.
 *
 *   dashboard    → Paneli
 *   administrata → Paralelet dhe kujdestaret
 *   mesimi       → Ditari i oreve te mesimit (e plotesojne stafi e lart)
 *   oret_raport  → Oret e mbajtura: pasqyra dhe permbledhja per cdo mesimdhenes.
 *                  Kujdestari e ka ditarin, jo raportin: sa ore ka mbajtur
 *                  secili mesimdhenes eshte ceshtje e administrates.
 *   students  → Nxënësit (lista, kartela, ndryshimi)
 *   register  → Regjistrimi i nxënësit të ri
 *   finance   → Financat, pagesat, fletëpagesat, eksporti
 *   graduates → Të diplomuarit
 *   ditari    → Ditari i notave (shkrimi vetem te paralelja jote)
 *   review    → Kontrolli i notave: pranim ose shenim gabimi me koment
 *   settings  → Cilësimet (konfigurimi i sistemit)
 *   manage    → veprime të forta JASHTË cilësimeve: fshirja e një nxënësi
 *               ose e një pagese, vendimi mbi kërkesat për nota
 *
 * Menaxheri bën gjithçka që bën administratori, PËRVEÇ konfigurimit:
 * përdoruesit, drejtimet, bankat, kalimi i vitit dhe ditari i veprimeve
 * mbeten te 'settings', pra vetëm te administratori.
 *
 * Paralelet dhe kujdestarët NUK janë konfigurim sistemi por punë e
 * përditshme e shkollës, ndaj rrinë te zona 'administrata', ku hyn
 * edhe stafi.
 */
const AREA_ROLES = {
    dashboard: ['admin', 'menaxher'],
    students: ['admin', 'menaxher', 'finance', 'staff'],
    register: ['admin', 'menaxher', 'staff'],
    finance: ['admin', 'menaxher', 'finance'],
    graduates: ['admin', 'menaxher', 'finance'],
    administrata: ['admin', 'menaxher', 'staff'],
    mesimi: ['admin', 'menaxher', 'staff', 'kujdestar'],
    oret_raport: ['admin', 'menaxher', 'staff'],
    ditari: ['admin', 'menaxher', 'kujdestar', 'staff'],
    review: ['admin', 'menaxher', 'staff'],
    logs: ['admin', 'menaxher'],
    settings: ['admin'],
    manage: ['admin', 'menaxher'],
};

/** A e hap ky përdorues këtë zonë? */
function can(user, area) {
    if (!user || !user.role) return false;
    const allowed = AREA_ROLES[area];
    if (!allowed) throw new Error(`Zona e panjohur e të drejtave: ${area}`);
    return allowed.includes(user.role);
}

/** Administrator ose menaxher — kush i bën veprimet e forta. */
const isManager = (user) => can(user, 'manage');

/** Kush i kontrollon notat (i pranon ose i shenon si gabim). */
const isReviewer = (user) => can(user, 'review');

/** A i sheh ky përdorues shifrat financiare? */
const canSeeFinance = (user) => can(user, 'finance');

module.exports = {
    ROLES, ROLE_LABELS, AREA_ROLES, can, isManager, isReviewer, canSeeFinance,
};