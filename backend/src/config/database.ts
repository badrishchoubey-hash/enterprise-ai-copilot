import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  // MONGODB_URI is the canonical setting. DATABASE_URL is retained as a
  // compatibility fallback for existing local environments that already hold
  // a MongoDB Atlas URI under that name.
  const configuredUri = process.env.MONGODB_URI ?? process.env.DATABASE_URL;

  if (!configuredUri) {
    throw new Error(
      'MongoDB connection string is missing. Set MONGODB_URI in backend/.env.'
    );
  }

  const authorityPart = configuredUri.split('@')[0] ?? '';
  const usesCredentialPlaceholders =
    configuredUri.startsWith('mongodb') &&
    authorityPart.includes('<') &&
    authorityPart.includes('>');

  const username = process.env.DB_USERNAME;
  const password = process.env.DB_PASSWORD;

  if (usesCredentialPlaceholders && (!username || !password)) {
    throw new Error(
      'MongoDB URI contains credential placeholders. Set DB_USERNAME and DB_PASSWORD in backend/.env.'
    );
  }

  const mongoUri = usesCredentialPlaceholders
    ? configuredUri.replace(
      /^(mongodb(?:\+srv)?:\/\/)[^@]+@/,
      `$1${encodeURIComponent(username as string)}:${encodeURIComponent(password as string)}@`
    )
    : configuredUri;

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10_000 });
    console.log('MongoDB connected');
  } catch (error) {
    console.error(JSON.stringify({ code: 'DATABASE_UNAVAILABLE', message: 'MongoDB connection failed.' }));
    throw error;
  }
};

export const disconnectDB = async (): Promise<void> => {
  await mongoose.disconnect();
};