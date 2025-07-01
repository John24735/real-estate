import React from "react";
import { FaMapMarkerAlt, FaBed, FaBath, FaRulerCombined, FaTag, FaCalendarAlt, FaTimes } from "react-icons/fa";

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

interface Props {
    property: Property;
    onClose: () => void;
}

const PropertyDetailsModal: React.FC<Props> = ({ property, onClose }) => {
    const createdAt = typeof property.createdAt === 'string' ? new Date(property.createdAt).getTime() : property.createdAt;
    const days = Math.floor((Date.now() - (createdAt || 0)) / (1000 * 60 * 60 * 24));
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-purple-500 to-purple-600 text-white">
                    <div className="flex items-center gap-3">
                        <FaMapMarkerAlt className="text-xl" />
                        <div>
                            <h2 className="text-xl font-bold">{property.name}</h2>
                            <p className="text-purple-100 text-sm flex items-center gap-1"><FaMapMarkerAlt />{property.location}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition-colors text-2xl"><FaTimes /></button>
                </div>
                {/* Images */}
                <div className="w-full h-64 bg-gray-100 flex overflow-x-auto gap-2 p-2">
                    {property.images && property.images.length > 0 ? property.images.map((imgId, idx) => (
                        <img
                            key={idx}
                            src={typeof imgId === 'string' && imgId.startsWith('placeholder') ?
                                'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80' :
                                `/api/image/${imgId}`}
                            alt={property.name}
                            className="object-cover h-full rounded-lg min-w-[200px]"
                        />
                    )) : (
                        <div className="flex items-center justify-center w-full h-full text-gray-400">No images</div>
                    )}
                </div>
                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4 p-6">
                    <div className="flex items-center gap-2 text-lg font-semibold text-purple-700"><FaTag />${property.price?.toLocaleString() || 0}</div>
                    <div className="flex items-center gap-2 text-lg text-gray-700"><FaBed />{property.beds || 0} Beds</div>
                    <div className="flex items-center gap-2 text-lg text-gray-700"><FaBath />{property.baths || 0} Baths</div>
                    <div className="flex items-center gap-2 text-lg text-gray-700"><FaRulerCombined />{property.area || 0} sqft</div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 col-span-2 mt-2"><FaCalendarAlt />{days === 0 ? 'Today' : days === 1 ? '1 day ago' : `${days} days ago`}</div>
                </div>
                {/* Description */}
                <div className="px-6 pb-6">
                    <h3 className="font-bold text-gray-800 mb-2">Description</h3>
                    <p className="text-gray-700 whitespace-pre-line">{property.description}</p>
                </div>
            </div>
        </div>
    );
};

export default PropertyDetailsModal; 