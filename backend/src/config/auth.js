const crypto = require('crypto');

const isProd = process.env.NODE_ENV === 'production';

/**
 * Çelësi i nënshkrimit të token-ave.
 * Pa të, askush nuk duhet të nisë serverin — prandaj ndalojmë me një mesazh
 * të qartë dhe një çelës të gatshëm për t'u kopjuar.
 */
function loadSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    const suggestion = crypto.randomBytes(48).toString('base64');
    console.error(
      '\n────────────────────────────────────────────────────────────\n' +
        ' GABIM SIGURIE: JWT_SECRET mungon ose është shumë i shkurtër.\n\n' +
        ' Shtoni këtë rresht te backend/.env dhe rinisni serverin:\n\n' +
        `   JWT_SECRET=${suggestion}\n\n` +
        ' Mos e ndani këtë çelës me askënd dhe mos e vendosni në Git.\n' +
        '────────────────────────────────────────────────────────────\n'
    );
    process.exit(1);
  }
  return secret;
}

module.exports = {
  JWT_SECRET: loadSecret(),

  // ── Sesioni: 15 minuta PA VEPRIMTARI ─────────────────────────
  //
  // Nuk eshte afat i prere nga hyrja, por nga veprimi i FUNDIT: cdo
  // kerkese e vlefshme e rifreskon cookie-n (shih middleware/auth.js).
  // Kush punon vazhdimisht nuk e verejne kurre; kush largohet nga tavolina
  // e humb sesionin brenda nje cerek ore — kompjuteret e zyres jane te
  // perbashket dhe nje sesion i hapur eshte deren e hapur.
  SESSION_IDLE_MINUTES: 15,
  TOKEN_TTL: '15m',
  COOKIE_NAME: 'ispe_session',
  COOKIE_MAX_AGE: 15 * 60 * 1000,

  // Cookie: e palexueshme nga JavaScript, nuk dërgohet nga faqe të tjera
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProd, // kërkon HTTPS në prodhim
    path: '/',
    maxAge: 15 * 60 * 1000,
  },

  // Fjalëkalimet
  BCRYPT_ROUNDS: 12,
  MIN_PASSWORD_LENGTH: 8,

  // Bllokimi i llogarisë pas provave të dështuara
  MAX_FAILED_ATTEMPTS: 5,
  LOCK_MINUTES: 15,

  isProd,
};