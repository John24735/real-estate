import mongoose, { Schema, model, models } from "mongoose";

const PropertySchema = new Schema({
    images: [String],
    name: { type: String, required: true },
    location: { type: String, required: true },
    description: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
    price: { type: Number, required: true },
    beds: { type: Number, default: 0 },
    baths: { type: Number, default: 0 },
    area: { type: Number, default: 0 },
});

export default models.Property || model("Property", PropertySchema); 