import { Document, Model, ObjectId, Types } from 'mongoose';

export interface CursorPage<T> { items: T[]; nextCursor: string | null }

/** Keyset pagination avoids the growing cost of skip/limit on deep pages. */
export async function paginateByCreatedAt<T extends Document>(query: ReturnType<Model<T>['find']>, cursor?: string, limit = 50): Promise<CursorPage<T>> {
  const pageSize = Math.min(Math.max(limit, 1), 100);
  if (cursor) {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { createdAt: string; id: string };
    query.where({ $or: [{ createdAt: { $lt: new Date(decoded.createdAt) } }, { createdAt: new Date(decoded.createdAt), _id: { $lt: new Types.ObjectId(decoded.id) } }] });
  }
  const items = await query.sort({ createdAt: -1, _id: -1 }).limit(pageSize + 1).exec();
  const hasMore = items.length > pageSize;
  const page = hasMore ? items.slice(0, pageSize) : items;
  const last = page.at(-1) as (T & { createdAt?: Date; _id: ObjectId }) | undefined;
  const nextCursor = hasMore && last?.createdAt ? Buffer.from(JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last._id.toString() })).toString('base64url') : null;
  return { items: page, nextCursor };
}
