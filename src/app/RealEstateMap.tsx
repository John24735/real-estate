"use client";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useEffect, useState } from "react";
import { FaHome, FaTag } from "react-icons/fa";
import { Icon } from "leaflet";

// Fix for default marker icons
const DefaultIcon = L.icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface Property {
    _id: string;
    images: string[];
    name: string;
    location: string;
    description: string;
    lat: number;
    lng: number;
    createdAt: string | number;
    price: number;
    beds?: number;
    baths?: number;
    area?: number;
    __v?: number;
}

interface RealEstateMapProps {
    properties: Property[];
    onMapClick?: (lat: number, lng: number) => void;
    selectedLocation?: { lat: number; lng: number };
    showProperties?: boolean;
}

// Map click handler component
function MapClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
    useMapEvents({
        click: (e) => {
            if (onMapClick) {
                onMapClick(e.latlng.lat, e.latlng.lng);
            }
        },
    });
    return null;
}

export default function RealEstateMap({
    properties,
    onMapClick,
    selectedLocation,
    showProperties = true
}: RealEstateMapProps) {
    const [isClient, setIsClient] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) {
        return (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center rounded-2xl border shadow-lg">
                <div className="text-gray-500">Loading map...</div>
            </div>
        );
    }

    if (hasError) {
        return (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center rounded-2xl border shadow-lg">
                <div className="text-red-500">Map failed to load. Please refresh the page.</div>
            </div>
        );
    }

    try {
        return (
            <div className="w-full h-full rounded-2xl border border-purple-100 shadow-lg overflow-hidden">
                <MapContainer
                    key={selectedLocation && selectedLocation.lat !== undefined && selectedLocation.lng !== undefined ? `${selectedLocation.lat}-${selectedLocation.lng}` : 'default-map'}
                    center={[7.9465, -1.0232] as [number, number]}
                    zoom={7}
                    scrollWheelZoom={true}
                    style={{ width: "100%", height: "100%", minHeight: 300 }}
                    className="w-full h-full"
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {/* Map click handler */}
                    {onMapClick && <MapClickHandler onMapClick={onMapClick} />}

                    {/* Selected location marker */}
                    {selectedLocation && selectedLocation.lat !== 0 && selectedLocation.lng !== 0 && (
                        <Marker position={[selectedLocation.lat, selectedLocation.lng] as [number, number]} icon={DefaultIcon}>
                            <Popup>
                                <div>
                                    <h3 className="font-bold">Selected Location</h3>
                                    <p className="text-sm">Click to select this location</p>
                                </div>
                            </Popup>
                        </Marker>
                    )}

                    {/* Property markers */}
                    {showProperties && properties.map((property) => {
                        const mainImg = property.images && property.images.length > 0
                            ? (typeof property.images[0] === 'string' && property.images[0].startsWith('placeholder')
                                ? 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80'
                                : `/api/image/${property.images[0]}`)
                            : 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80';
                        return (
                            <Marker
                                key={property._id}
                                position={[property.lat, property.lng] as [number, number]}
                                icon={DefaultIcon}
                                eventHandlers={{
                                    mouseover: () => setHoveredId(property._id),
                                    mouseout: () => setHoveredId(null),
                                }}
                            >
                                {/* Stylish Popup */}
                                <Popup className="rounded-xl shadow-xl border-0 p-0 overflow-hidden">
                                    <div className="w-64">
                                        <img src={mainImg} alt={property.name} className="w-full h-28 object-cover rounded-t-xl" />
                                        <div className="p-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <FaHome className="text-purple-500" />
                                                <span className="font-bold text-lg text-gray-900">{property.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-purple-700 font-semibold mb-1">
                                                <FaTag /> ${property.price?.toLocaleString() || 0}
                                            </div>
                                            <div className="text-xs text-gray-500 mb-1">{property.location}</div>
                                            <button className="mt-2 w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-1 rounded-lg transition">View Details</button>
                                        </div>
                                    </div>
                                </Popup>
                                {/* Image preview on hover */}
                                {hoveredId === property._id && (
                                    <div
                                        style={{ position: 'absolute', left: 40, top: -10, zIndex: 1000 }}
                                        className="pointer-events-none"
                                    >
                                        <div className="bg-white rounded-xl shadow-xl border border-purple-100 p-2 flex flex-col items-center w-48 animate-fade-in">
                                            <img src={mainImg} alt={property.name} className="w-full h-20 object-cover rounded mb-2" />
                                            <div className="font-bold text-gray-800 text-sm truncate w-full">{property.name}</div>
                                            <div className="text-purple-600 font-semibold text-xs flex items-center gap-1"><FaTag />${property.price?.toLocaleString() || 0}</div>
                                        </div>
                                    </div>
                                )}
                            </Marker>
                        );
                    })}
                </MapContainer>
            </div>
        );
    } catch (error) {
        console.error("Map rendering error:", error);
        setHasError(true);
        return (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center rounded-2xl border shadow-lg">
                <div className="text-red-500">Map failed to load. Please refresh the page.</div>
            </div>
        );
    }
} 