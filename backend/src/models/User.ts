import { Schema } from 'mongoose';
import { optionalText, registered, requiredText } from './modelHelpers';
import type { UserDocument } from '../types/modelTypes/User.js';

const userSchema = new Schema<UserDocument>({
  name: requiredText(160),
  email: { type: String, required: true, trim: true, lowercase: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  passwordHash: optionalText(200),
  role: { type: String, enum: ['employee', 'support_agent', 'admin'], default: 'employee' },
  department: optionalText(120), isActive: { type: Boolean, default: true }, lastLoginAt: Date,
}, { timestamps: true, strict: 'throw' });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ department: 1, isActive: 1 });

export const Users = registered<UserDocument>('Users', userSchema, 'Users');
export default Users;
