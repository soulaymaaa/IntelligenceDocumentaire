import mongoose from 'mongoose';
import { PlannerTask } from '../src/modules/planner/planner.model';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const check = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/docintel');
  console.log('Connected to DB');
  
  const now = new Date();
  const tasks = await PlannerTask.find({});
  
  console.log(`Total tasks: ${tasks.length}`);
  tasks.forEach(t => {
    console.log(`- Task: "${t.text}" | Date: ${t.date} | reminderAt: ${t.reminderAt} | Sent: ${t.reminderSent} | Due: ${t.reminderAt && t.reminderAt <= now}`);
  });
  
  await mongoose.disconnect();
};

check();
