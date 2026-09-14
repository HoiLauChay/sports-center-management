import cookieParser from 'cookie-parser';
import cors from 'cors';
import 'dotenv/config';
import express from 'express';

const PORT = Number(process.env.PORT) || 8000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: CLIENT_URL, credentials: true }));

app.get('/api/v1/health', (_req, res) => {
  res.json({ status: true, message: 'OK' });
});

app.listen(PORT, () => {
  console.warn(`✓ Server running on http://localhost:${PORT}`);
});
