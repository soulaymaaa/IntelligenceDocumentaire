import mongoose, { Schema, Document } from 'mongoose';

export interface IPlannerTask extends Document {
  userId: mongoose.Types.ObjectId;
  text: string;
  completed: boolean;
  date: string; // YYYY-MM-DD
  reminderAt?: Date; // Specific time for reminder
  reminderSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PlannerTaskSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    completed: { type: Boolean, default: false },
    date: { type: String, required: true }, // Format YYYY-MM-DD
    reminderAt: { type: Date },
    reminderSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Index for faster lookups by userId and date
PlannerTaskSchema.index({ userId: 1, date: 1 });

export const PlannerTask = mongoose.model<IPlannerTask>('PlannerTask', PlannerTaskSchema);
