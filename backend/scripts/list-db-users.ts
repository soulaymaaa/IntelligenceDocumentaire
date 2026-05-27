import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/database';
import { UserModel } from '../src/modules/users/user.model';

async function run() {
  await connectDatabase();
  console.log('Connected to database.');
  const users = await UserModel.find().select('+passwordHash').lean();
  console.log('--- USERS IN DATABASE ---');
  for (const user of users) {
    console.log(`- ID: ${user._id}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  isVerified: ${user.isVerified}`);
    console.log(`  Has passwordHash: ${!!user.passwordHash}`);
    console.log('------------------------');
  }
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
