const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');
const { requireXhrHeader } = require('./middleware/auth');
const { isProd } = require('./config/auth');

const app = express();

// Adresat e lejuara te frontend-it (te ndara me presje ne .env)
const ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:4173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// IP-ja reale nese ndodhet pas nje proxy (nginx, IIS)
app.set('trust proxy', 1);

// Header-a sigurie standarde
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-site' },
  contentSecurityPolicy: isProd ? undefined : false, // CSP e plote vetem ne prodhim
}));

// CORS i kufizuar: vetem origjinat e njohura, me cookie
app.use(cors({
  origin(origin, cb) {
    // kerkesat pa origjine (curl, aplikacione desktop) lejohen
    if (!origin || ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('Origjina nuk lejohet nga CORS.'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Requested-With'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Kufizim i pergjithshem i kerkesave
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Shumë kërkesa. Provoni sërish pas pak.' },
}));

// Kufizim i rrepte per hyrjen — mbrojtje nga provat e njepasnjeshme
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Shumë prova hyrjeje. Provoni sërish pas 15 minutash.' },
}));

// Mbrojtje CSRF per kerkesat qe ndryshojne te dhena
app.use('/api', requireXhrHeader);

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api', routes);

app.use((req, res) => res.status(404).json({ error: 'Rruga nuk u gjet.' }));
app.use(errorHandler);

module.exports = app;