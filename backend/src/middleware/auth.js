const jwt = require('jsonwebtoken');
const authService = require('../services/authService');
const {
  COOKIE_NAME, cookieOptions, JWT_SECRET, TOKEN_TTL,
} = require('../config/auth');
const { httpError } = require('./errorHandler');
const { can, canSeeFinance, isManager } = require('../config/roles');

/**
 * Rifreskon sesionin: leshon nje token te ri me 15 minuta te plota.
 *
 * Keshtu afati numerohet nga VEPRIMI I FUNDIT, jo nga hyrja. Pa kete, nje
 * token 15-minutesh do ta nxirrte jashte edhe dike qe punon pa nderprerje.
 *
 * Token-i i ri ndertohet nga i vjetri duke hequr vetem `iat` dhe `exp`:
 * keshtu ruhet cdo e dhene qe vendos authService, pa i ditur ato ketu —
 * nese nje dite shtohet nje fushe e re ne token, kjo vazhdon te punoje.
 */
function slideSession(res, payload) {
  try {
    const { iat, exp, ...claims } = payload;
    const token = jwt.sign(claims, JWT_SECRET, { expiresIn: TOKEN_TTL });
    res.cookie(COOKIE_NAME, token, cookieOptions);
  } catch {
    // Nje deshtim ketu s'duhet ta rrezoje kerkesen: perdoruesi thjesht
    // e mban afatin e vjeter dhe do te dale kur ai te skadoje.
  }
}

/**
 * Kerkon nje sesion te vlefshem.
 * Token-i lexohet nga cookie httpOnly — JavaScript-i i faqes nuk e prek dot.
 */
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies ? req.cookies[COOKIE_NAME] : null;
    if (!token) throw httpError(401, 'Nuk jeni i identifikuar.');

    const payload = authService.verifyToken(token);
    if (!payload) throw httpError(401, 'Sesioni ka skaduar. Hyni sërish.');

    // Verifikohet ne baze — llogaria mund te jete c'aktivizuar pas leshimit te token-it
    const user = await authService.getUserById(payload.sub);
    if (!user) throw httpError(401, 'Llogaria nuk është më aktive.');

    req.user = user;

    // Sesion rreshqites: cdo kerkese e vlefshme e shtyn afatin edhe 15 minuta
    slideSession(res, payload);

    // Fjalekalimi i perkohshem: derisa perdoruesi te vendose te tijin, sesioni
    // hap VETEM ndryshimin e fjalekalimit (dhe daljen). Kontrolli behet KETU,
    // jo me nje ekran te nderfaqes: perndryshe mjaftonte nje thirrje e
    // drejtperdrejte e API-t per ta anashkaluar.
    //
    // Flamuri lexohet nga baza ne cdo kerkese, jo nga token-i: keshtu
    // ndryshimi i fjalekalimit e heq kufizimin menjehere, pa dalje e hyrje.
    if (user.must_change_password && !isPasswordChangeFlow(req)) {
      return next(httpError(
        403,
        'Duhet të vendosni një fjalëkalim tuajin para se të vazhdoni.',
        'PASSWORD_CHANGE_REQUIRED'
      ));
    }

    next();
  } catch (err) {
    next(err);
  }
}

/** Rruget e lejuara kur llogaria ka ende fjalekalimin e perkohshem. */
const PASSWORD_FLOW = ['/auth/change-password', '/auth/me', '/auth/logout'];

function isPasswordChangeFlow(req) {
  const path = String(req.originalUrl || '').split('?')[0].replace(/^\/api/, '');
  return PASSWORD_FLOW.includes(path);
}

/**
 * Mbrojtja sipas ZONES se punes. Kush i hap zonat percaktohet ne nje vend
 * te vetem — config/roles.js — keshtu qe rruget lexohen si fjali dhe nuk ka
 * lista rolesh te shperndara neper skedare.
 *
 * Kontrolli behet KETU, ne server: fshehja e butonave te nderfaqja eshte
 * vetem lehtesi per syrin, jo mbrojtje.
 */
const MESSAGES = {
  settings: 'Ky veprim kërkon të drejta administratori.',
  manage: 'Ky veprim kërkon të drejta administratori ose menaxheri.',
  finance: 'Ky veprim kërkon të drejta për financat.',
  ditari: 'Ky veprim kërkon të drejta kujdestari.',
  requests: 'Ky veprim kërkon të drejta kujdestari.',
  register: 'Ky veprim kërkon të drejta për regjistrimin e nxënësve.',
  students: 'Ky veprim kërkon të drejta për nxënësit.',
  dashboard: 'Ky veprim kërkon të drejta administratori ose menaxheri.',
  logs: 'Ky veprim kërkon të drejta administratori.',
};

function requireArea(area) {
  return function guard(req, res, next) {
    if (!can(req.user, area)) {
      return next(httpError(403, MESSAGES[area] || 'Nuk keni të drejta për këtë veprim.'));
    }
    next();
  };
}

/** Vetem administratoret — konfigurimi i sistemit. */
const requireAdmin = requireArea('settings');

/** Administrator ose menaxher — veprimet e forta jashte cilesimeve. */
const requireManager = requireArea('manage');

/** Qasje te te dhenat financiare. */
const requireFinance = requireArea('finance');

/**
 * Ditari i klases.
 *
 * Ky kontroll thote vetem «a ka fare qasje ne ditar». Se CILEN paralele
 * mund ta preke, e verifikon registerService.assertClassAccess ne cdo
 * veprim — kujdestari sheh vetem paralelen ku eshte caktuar.
 */
const requireKujdestar = requireArea('ditari');

/**
 * Mbrojtje shtese nga CSRF.
 * Cookie eshte SameSite=strict, por kerkojme edhe nje header te posacem:
 * shfletuesi nuk e lejon nje faqe te huaj ta shtoje ate pa leje CORS.
 */
function requireXhrHeader(req, res, next) {
  const safe = ['GET', 'HEAD', 'OPTIONS'];
  if (safe.includes(req.method)) return next();

  if (req.get('X-Requested-With') !== 'XMLHttpRequest') {
    return next(httpError(403, 'Kërkesa u refuzua (mbrojtje CSRF).'));
  }
  next();
}

module.exports = {
  requireAuth,
  requireArea,
  requireAdmin,
  requireManager,
  requireFinance,
  requireKujdestar,
  canSeeFinance,
  isManager,
  requireXhrHeader,
};