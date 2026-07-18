const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api', routes);

app.use((req, res) => res.status(404).json({ error: 'Rruga nuk u gjet.' }));
app.use(errorHandler);

module.exports = app;
