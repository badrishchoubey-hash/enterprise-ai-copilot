import { Document, Model, Schema, model, models } from 'mongoose';

export const objectId = () => Schema.Types.ObjectId;
export const requiredText = (max: number) => ({ type: String, required: true, trim: true, minlength: 1, maxlength: max });
export const optionalText = (max: number) => ({ type: String, trim: true, maxlength: max });
export const accessFields = {
  tenantId: { type: objectId(), required: true, ref: 'Users' },
  department: optionalText(120),
  visibility: { type: String, enum: ['private', 'department', 'organization'] as const, default: 'organization' as const },
};

export const registered = <T extends Document>(name: string, schema: Schema<T>, collection: string): Model<T> =>
  (models[name] as Model<T> | undefined) ?? model<T>(name, schema, collection);
