import dotenv from 'dotenv';
dotenv.config();

import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';

async function run() {
  const userId = '6a146f8499bf62cc5a243040'; // Adam Fezzani
  const role = 'admin';

  const token = jwt.sign({ userId, role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
    issuer: 'intelligence-documentaire',
  });

  console.log(`Generated Admin Token: Bearer ${token}`);

  try {
    const res = await fetch(`http://localhost:${env.PORT}/api/admin-portal/metrics`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json();
    console.log('Metrics Response:', data);
  } catch (err: any) {
    console.error('Error fetching metrics:', err.message);
  }
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
