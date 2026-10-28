import { Document, Schema, Types } from 'mongoose';
import { objectId, registered, requiredText } from './modelHelpers';

export interface RefreshTokenDocument extends Document {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  replacedByTokenHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSchema = new Schema<RefreshTokenDocument>({
  userId: { type: objectId(), required: true, ref: 'Users', immutable: true },
  tokenHash: { ...requiredText(128), unique: true, immutable: true },
  // Indexed once below as a TTL index. Defining index:true here as well causes
  // Mongoose to report a duplicate schema index warning.
  expiresAt: { type: Date, required: true },
  revokedAt: Date,
  replacedByTokenHash: { type: String, maxlength: 128 },
}, { timestamps: true, strict: 'throw' });

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ userId: 1, revokedAt: 1, expiresAt: 1 });

export const RefreshTokens = registered<RefreshTokenDocument>('RefreshTokens', refreshTokenSchema, 'RefreshTokens');
export default RefreshTokens;
