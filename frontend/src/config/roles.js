/**
 * Rolet dhe zonat e punës — pasqyrë e backend/src/config/roles.js.
 *
 * Ndërfaqja e fsheh atë që përdoruesi nuk e hap, por MBROJTJA e vërtetë
 * është në server. Kjo skedë shërben që menuja, rrugët dhe faqja e parë
 * të flasin të njëjtën gjuhë me të.
 *
 * Nëse ndryshohet një rresht këtu, i njëjti rresht duhet ndryshuar edhe
 * në server — përndryshe përdoruesit do t'u shfaqet një link që i kthen 403.
 */

export const ROLE_LABELS = {
  admin: 'Administrator',
  menaxher: 'Menaxher',
  finance: 'Financa',
  kujdestar: 'Kujdestar/e',
  staff: 'Staf',
};

/** Përshkrimet e shkurtra që dalin te zgjedhja e rolit në Cilësimet. */
export const ROLE_HINTS = {
  admin: 'Gjithçka, përfshirë cilësimet e sistemit',
  menaxher: 'Gjithçka, përveç cilësimeve të sistemit',
  finance: 'Financat dhe nxënësit',
  kujdestar: 'Vetëm ditari i notave',
  staff: 'Nxënësit, regjistrimi, administrata dhe ditari',
};

export const AREA_ROLES = {
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
export function canAccess(user, area) {
  if (!user || !user.role) return false;
  return (AREA_ROLES[area] || []).includes(user.role);
}

/**
 * Faqja e parë e secilit rol.
 *
 * E domosdoshme: Paneli nuk është më i hapur për të gjithë, ndaj «/» nuk
 * mund të jetë shtëpia e përbashkët. Pa këtë, një kujdestar i dërguar te
 * «/» do të kthehej pafundësisht mes dy faqeve që s'i hap dot.
 */
export function homePath(user) {
  if (!user) return '/hyrje';
  switch (user.role) {
    case 'finance': return '/financat';
    case 'kujdestar': return '/ditari';
    case 'staff': return '/studentet';
    default: return '/';        // admin, menaxher
  }
}