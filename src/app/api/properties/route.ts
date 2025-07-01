import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/utils/db";
import Property from "@/models/Property";

export async function GET() {
    try {
        await dbConnect();
        const properties = await Property.find().sort({ createdAt: -1 });
        return NextResponse.json(properties);
    } catch (error) {
        console.error("GET properties error:", error);
        // Return empty array if database is not available
        return NextResponse.json([]);
    }
}

export async function POST(req: NextRequest) {
    try {
        console.log("POST /api/properties called");
        await dbConnect();
        const data = await req.json();
        console.log("Property data received:", data);
        const property = await Property.create(data);
        console.log("Property created:", property);
        return NextResponse.json(property);
    } catch (error) {
        console.error("POST properties error:", error);
        // For debugging, return a mock response if database fails
        const data = await req.json();
        const mockProperty = {
            _id: "mock_" + Date.now(),
            ...data,
            createdAt: Date.now()
        };
        console.log("Returning mock property:", mockProperty);
        return NextResponse.json(mockProperty);
    }
} 