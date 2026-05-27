import mongoose, { Schema, Document } from 'mongoose';

export interface IPlannerTask extends Document {
  userId: mongoose.Types.ObjectId;
  text: string;
  completed: boolean;
  date: string; // Legacy due date, kept for compatibility
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  priority: 'low' | 'medium' | 'high';
  category?: string;
  source: 'manual' | 'excel';
  importBatchId?: string;
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
    date: { type: String, required: true }, // Legacy due date / end date
    startDate: { type: String },
    endDate: { type: String },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    category: { type: String, trim: true },
    source: { type: String, enum: ['manual', 'excel'], default: 'manual' },
    importBatchId: { type: String },
    reminderAt: { type: Date },
    reminderSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

PlannerTaskSchema.pre('validate', function (next) {
  if (!this.startDate) this.startDate = this.date;
  if (!this.endDate) this.endDate = this.date;
  this.date = this.endDate || this.startDate;
  next();
});

// Index for faster lookups by userId and date
PlannerTaskSchema.index({ userId: 1, date: 1 });
PlannerTaskSchema.index({ userId: 1, startDate: 1, endDate: 1 });
PlannerTaskSchema.index({ userId: 1, importBatchId: 1 });

export const PlannerTask = mongoose.model<IPlannerTask>('PlannerTask', PlannerTaskSchema);
