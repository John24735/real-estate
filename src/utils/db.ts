import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error("MONGODB_URI environment variable is not set!");
    console.error("Please create a .env.local file with MONGODB_URI=mongodb://localhost:27017/real-estate");
    // Don't throw error, let the API handle it gracefully
}

console.log("MongoDB URI found:", MONGODB_URI?.substring(0, 20) + "...");

let cached = (global as any).mongoose;

if (!cached) {
    cached = (global as any).mongoose = { conn: null, promise: null };
}

export async function dbConnect() {
    if (!MONGODB_URI) {
        throw new Error("MONGODB_URI environment variable is not set");
    }

    if (cached.conn) {
        console.log("Using cached database connection");
        return cached.conn;
    }

    if (!cached.promise) {
        console.log("Creating new database connection...");
        cached.promise = mongoose.connect(MONGODB_URI, {
            bufferCommands: false,
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4
        }).then((mongoose) => {
            console.log("Database connected successfully");
            return mongoose;
        }).catch((error) => {
            console.error("Database connection failed:", error);
            throw error;
        });
    }

    try {
        cached.conn = await cached.promise;
        return cached.conn;
    } catch (error) {
        console.error("Error in dbConnect:", error);
        throw error;
    }
} 