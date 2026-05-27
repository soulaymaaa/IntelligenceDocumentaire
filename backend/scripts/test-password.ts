import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDatabase } from '../src/config/database';
import { UserModel } from '../src/modules/users/user.model';

async function run() {
  await connectDatabase();
  console.log('Connected to database.');
  
  const testPassword = 'Adam1234!';
  const users = await UserModel.find({
    email: { $in: ['mohamedjerbi2506@gmail.com', 'adamfezzani789@gmail.com'] }
  }).select('+passwordHash').lean();

  for (const user of users) {
    const isMatch = await bcrypt.compare(testPassword, user.passwordHash);
    console.log(`User: ${user.email}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  isVerified: ${user.isVerified}`);
    console.log(`  Password matches "${testPassword}": ${isMatch}`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
