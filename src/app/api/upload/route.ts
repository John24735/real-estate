import { NextRequest, NextResponse } from "next/server";
import { MongoClient, GridFSBucket } from "mongodb";
import { Readable } from "stream";
import { createGzip } from "zlib";

const uri = process.env.MONGODB_URI!;
const dbName = "Estate";

// Create a connection pool
let client: MongoClient | null = null;

async function getClient() {
    if (!client) {
        client = new MongoClient(uri, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
    }
    return client;
}

export const config = {
    api: {
        bodyParser: false,
    },
};

export async function POST(req: NextRequest) {
    const startTime = Date.now();
    try {
        const formDataStart = Date.now();
        const formData = await req.formData();
        const formDataEnd = Date.now();
        console.log(`FormData parsing took: ${formDataEnd - formDataStart}ms`);

        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        console.log(`Processing file: ${file.name}, size: ${file.size} bytes`);

        // Validate file size (5MB limit)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            return NextResponse.json({ error: "File too large. Maximum size is 5MB" }, { status: 400 });
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
        }

        const clientStart = Date.now();
        const client = await getClient();
        const clientEnd = Date.now();
        console.log(`MongoDB client connection took: ${clientEnd - clientStart}ms`);

        const db = client.db(dbName);
        const bucket = new GridFSBucket(db);

        const bufferStart = Date.now();
        const buffer = Buffer.from(await file.arrayBuffer());
        const bufferEnd = Date.now();
        console.log(`Buffer conversion took: ${bufferEnd - bufferStart}ms`);

        // Create a readable stream from buffer
        const stream = Readable.from(buffer);

        // Add compression for large files (over 1MB)
        const shouldCompress = buffer.length > 1024 * 1024;
        const finalStream = shouldCompress ? stream.pipe(createGzip()) : stream;

        const uploadStream = bucket.openUploadStream(file.name, {
            contentType: shouldCompress ? 'application/gzip' : file.type,
            metadata: {
                uploadedAt: new Date(),
                originalName: file.name,
                size: file.size,
                compressed: shouldCompress
            }
        });

        const uploadStart = Date.now();
        finalStream.pipe(uploadStream);

        // Add timeout to prevent hanging uploads
        const uploadPromise = new Promise((resolve, reject) => {
            uploadStream.on("finish", resolve);
            uploadStream.on("error", reject);
        });

        await Promise.race([
            uploadPromise,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Upload timeout")), 30000)
            )
        ]);

        const uploadEnd = Date.now();
        console.log(`GridFS upload took: ${uploadEnd - uploadStart}ms (compressed: ${shouldCompress})`);

        const totalTime = Date.now() - startTime;
        console.log(`Total upload API time: ${totalTime}ms`);

        return NextResponse.json({ fileId: uploadStream.id.toString() });

    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
} 