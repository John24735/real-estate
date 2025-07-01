import { NextRequest } from "next/server";
import { MongoClient, GridFSBucket, ObjectId } from "mongodb";
import { createGunzip } from "zlib";

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

export async function GET(req: NextRequest) {
    try {
        const pathname = new URL(req.url).pathname;
        const idMatch = pathname.match(/\/api\/image\/([^\/]+)/);
        const id = idMatch?.[1];

        if (!id) {
            return new Response("Invalid image ID", { status: 400 });
        }

        const client = await getClient();
        const db = client.db(dbName);
        const bucket = new GridFSBucket(db);

        const downloadStream = bucket.openDownloadStream(new ObjectId(id));

        // Get file metadata to check if it's compressed
        const files = db.collection("fs.files");
        const fileDoc = await files.findOne({ _id: new ObjectId(id) });

        let finalStream: any = downloadStream;
        let contentType = "image/jpeg"; // default

        if (fileDoc) {
            contentType = fileDoc.metadata?.compressed
                ? "application/gzip"
                : fileDoc.contentType || "image/jpeg";

            // Decompress if needed
            if (fileDoc.metadata?.compressed) {
                finalStream = downloadStream.pipe(createGunzip());
                contentType = fileDoc.metadata.originalContentType || "image/jpeg";
            }
        }

        return new Response(finalStream as any, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000",
            },
        });
    } catch (error) {
        console.error("Error serving image:", error);
        return new Response("Image not found", { status: 404 });
    }
}
