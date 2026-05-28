import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/database';
import { UserModel } from '../src/modules/users/user.model';

async function run() {
  await connectDatabase();
  console.log('Connected to database.');

  const adminEmail = 'admin@example.com';
  const result = await UserModel.deleteOne({ email: adminEmail });
  
  if (result.deletedCount > 0) {
    console.log(`Successfully deleted admin user: ${adminEmail}`);
  } else {
    console.log(`No user found with email: ${adminEmail}`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
