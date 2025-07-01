"use client";
import Image from "next/image";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { FaBed, FaBath, FaRulerCombined, FaMapMarkerAlt, FaCalendarAlt, FaTag } from "react-icons/fa";
import PropertyDetailsModal from "./PropertyDetailsModal";

const Map = dynamic(() => import("./RealEstateMap"), { ssr: false });
const RealEstateMap = dynamic(() => import("./RealEstateMap"), { ssr: false });

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

interface FormData {
  images: string[];
  name: string;
  location: string;
  description: string;
  files: File[];
  price: number | "";
  beds: number | "";
  baths: number | "";
  area: number | "";
}

export default function Home() {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormData>({
    images: [],
    name: "",
    location: "",
    description: "",
    files: [],
    price: "",
    beds: "",
    baths: "",
    area: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState({ lat: 0, lng: 0 });
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [locationName, setLocationName] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [mounted, setMounted] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Add a small delay to ensure DOM is ready for Leaflet
  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Global error handler for Leaflet
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.error && event.error.message && event.error.message.includes('appendChild')) {
        console.warn('Leaflet DOM error caught, retrying...');
        // Retry mounting after a short delay
        setTimeout(() => {
          setMounted(false);
          setTimeout(() => setMounted(true), 200);
        }, 100);
        event.preventDefault();
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  // Fetch properties from API on initial load
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const res = await fetch("/api/properties");
        const data = await res.json();
        console.log("Fetched properties:", data);
        setProperties(data);
      } catch (error) {
        console.error("Error fetching properties:", error);
      }
    };

    fetchProperties();
  }, []); // Empty dependency array for initial load only

  // Fetch properties when modal closes
  useEffect(() => {
    if (!showModal) {
      const fetchProperties = async () => {
        try {
          const res = await fetch("/api/properties");
          const data = await res.json();
          console.log("Refreshed properties after modal close:", data);
          setProperties(data);
        } catch (error) {
          console.error("Error fetching properties:", error);
        }
      };

      fetchProperties();
    }
  }, [showModal]);

  // Get current location
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setSelectedLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setUseCurrentLocation(true);
          // Reverse geocode to get location name
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`)
            .then(res => res.json())
            .then(data => {
              setLocationName(data.display_name || "Current Location");
            });
        },
        (error) => {
          console.error("Error getting location:", error);
          alert("Could not get current location. Please select manually on the map.");
        }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  // Handle map click for location selection
  const handleMapClick = (lat: number, lng: number) => {
    setSelectedLocation({ lat, lng });
    setUseCurrentLocation(false);
    // Reverse geocode to get location name
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
      .then(res => res.json())
      .then(data => {
        setLocationName(data.display_name || "Selected Location");
      });
  };

  // Search for location suggestions
  const searchLocations = async (query: string) => {
    if (query.length < 3) {
      setLocationSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
      const data = await res.json();
      const suggestions = data.map((item: any) => item.display_name);
      setLocationSuggestions(suggestions);
      setShowSuggestions(true);
    } catch (error) {
      console.error("Error searching locations:", error);
    }
  };

  // Handle location selection from suggestions
  const selectLocation = (location: string) => {
    setForm(f => ({ ...f, location }));
    setLocationName(location);
    setShowSuggestions(false);
    setLocationSuggestions([]);
  };

  // Upload image to MongoDB GridFS
  async function uploadToMongo(file: File): Promise<string> {
    const uploadStart = Date.now();
    const data = new FormData();
    data.append("file", file);

    console.log(`Starting upload for file: ${file.name} (${file.size} bytes)`);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: data,
    });

    if (!res.ok) {
      throw new Error(`Upload failed: ${res.statusText}`);
    }

    const json = await res.json();
    const uploadEnd = Date.now();
    console.log(`File ${file.name} uploaded in ${uploadEnd - uploadStart}ms`);

    return json.fileId;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log("=== FORM SUBMISSION STARTED ===");
    console.log("Form data:", form);
    console.log("Selected location:", selectedLocation);
    console.log("Location name:", locationName);
    setSubmitting(true);
    setUploadProgress(0);

    const startTime = Date.now();

    try {
      // Upload images to MongoDB in parallel
      let imageIds: string[] = [];
      if (form.files && form.files.length > 0) {
        console.log(`Starting upload of ${form.files.length} images...`);
        setUploadProgress(10);

        const uploadStartTime = Date.now();
        const uploadPromises = form.files.map(file => {
          if (file) {
            return uploadToMongo(file);
          }
          return null;
        }).filter(Boolean) as Promise<string>[];

        imageIds = await Promise.all(uploadPromises);
        const uploadEndTime = Date.now();
        setUploadProgress(60);
        console.log(`All images uploaded successfully in ${uploadEndTime - uploadStartTime}ms:`, imageIds);
      }

      // Fallback if no images
      if (imageIds.length === 0) {
        imageIds = [
          "placeholder1",
          "placeholder2",
          "placeholder3"
        ];
      }

      setUploadProgress(70);

      // Use selected location or geocode the location name
      let lat = selectedLocation.lat, lon = selectedLocation.lng;
      if (lat === 0 && lon === 0 && form.location.trim()) {
        try {
          const geoStartTime = Date.now();
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(form.location)}`);
          const geoData = await geoRes.json();
          if (geoData.length > 0) {
            lat = Number(geoData[0].lat);
            lon = Number(geoData[0].lon);
          }
          const geoEndTime = Date.now();
          console.log(`Geocoding completed in ${geoEndTime - geoStartTime}ms`);
        } catch (error) {
          console.warn("Geocoding failed:", error);
        }
      }

      setUploadProgress(80);

      const propertyData = {
        images: imageIds,
        name: form.name,
        location: locationName || form.location,
        description: form.description,
        lat: lat,
        lng: lon,
        createdAt: Date.now(),
        price: Number(form.price),
        beds: Number(form.beds),
        baths: Number(form.baths),
        area: Number(form.area),
      };

      console.log("Creating property with data:", propertyData);

      // Create property via API
      const propertyStartTime = Date.now();
      console.log("Making API call to /api/properties");
      const propertyRes = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(propertyData),
      });

      console.log("API response status:", propertyRes.status);
      console.log("API response ok:", propertyRes.ok);

      if (!propertyRes.ok) {
        const errorText = await propertyRes.text();
        console.error("API error response:", errorText);
        throw new Error(`Failed to create property: ${propertyRes.statusText} - ${errorText}`);
      }

      const propertyResult = await propertyRes.json();
      console.log("API response data:", propertyResult);

      const propertyEndTime = Date.now();
      console.log(`Property created in ${propertyEndTime - propertyStartTime}ms`);

      // Refresh properties from database to get the latest data
      const refreshRes = await fetch("/api/properties");
      const refreshedProperties = await refreshRes.json();
      console.log("Refreshed properties after creation:", refreshedProperties);
      setProperties(refreshedProperties);

      setUploadProgress(100);
      const totalTime = Date.now() - startTime;
      console.log(`Total submission time: ${totalTime}ms`);
      console.log("Property created successfully");
      setShowModal(false);
      setForm({ images: [], name: "", location: "", description: "", files: [], price: "", beds: "", baths: "", area: "" });
      setSelectedLocation({ lat: 0, lng: 0 });
      setLocationName("");
      setUseCurrentLocation(false);

    } catch (error) {
      console.error("Error submitting property:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      alert(`Error: ${errorMessage}`);
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b bg-white z-30 sticky top-0 left-0 right-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-200 rounded-full flex items-center justify-center">
            {/* Placeholder for logo */}
            <span className="text-2xl font-bold text-purple-600">🌊</span>
          </div>
          <span className="text-2xl font-bold text-gray-800">Logoipsum</span>
        </div>
        <nav className="flex gap-8 ml-12">
          <a className="text-purple-600 font-medium" href="#">For Sell</a>
          <a className="text-gray-800 font-medium" href="#">For Rent</a>
          <a className="text-gray-800 font-medium" href="#">Agent Finder</a>
        </nav>
        <div className="flex gap-4 items-center">
          <button
            className="bg-purple-500 hover:bg-purple-600 text-white font-semibold px-6 py-2 rounded-lg flex items-center gap-2"
            onClick={() => setShowModal(true)}
          >
            <span className="text-xl">+</span> Post Your Ad
          </button>
          <button className="border border-gray-300 px-6 py-2 rounded-lg font-medium">Login</button>
        </div>
      </header>

      {/* Enhanced Modal for posting new ad */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-purple-500 to-purple-600 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold">Post New Property</h2>
                  <p className="text-purple-100 text-sm">Add your property to our marketplace</p>
                </div>
              </div>
              <button
                className="text-white/80 hover:text-white transition-colors"
                onClick={() => setShowModal(false)}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex flex-col lg:flex-row h-[calc(90vh-120px)]">
              {/* Left: Form */}
              <div className="flex-1 p-6 overflow-y-auto">
                <form className="space-y-6" onSubmit={(e) => {
                  console.log("=== FORM SUBMISSION DEBUG ===");
                  console.log("Form data:", form);
                  console.log("Form validation:");
                  console.log("- Name:", form.name, "Valid:", !!form.name);
                  console.log("- Description:", form.description, "Valid:", !!form.description);
                  console.log("- Files count:", form.files.filter(Boolean).length, "Valid:", form.files.filter(Boolean).length >= 1);
                  console.log("- Submitting:", submitting);
                  console.log("Form will submit:", !submitting && !!form.name && !!form.description && form.files.filter(Boolean).length >= 1);
                  handleSubmit(e);
                }}>
                  {/* Property Name */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      Property Name
                    </label>
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter property name"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Description
                    </label>
                    <textarea
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Describe your property..."
                      rows={3}
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      required
                    />
                  </div>

                  {/* Property Details */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Price */}
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                        Price ($)
                      </label>
                      <input
                        type="number"
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Enter price"
                        value={form.price}
                        onChange={e => setForm(f => ({ ...f, price: e.target.value === "" ? "" : Number(e.target.value) }))}
                        required
                        min="0"
                      />
                    </div>

                    {/* Area */}
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                        Area (sqft)
                      </label>
                      <input
                        type="number"
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Enter area"
                        value={form.area}
                        onChange={e => setForm(f => ({ ...f, area: e.target.value === "" ? "" : Number(e.target.value) }))}
                        required
                        min="0"
                      />
                    </div>

                    {/* Beds */}
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5v2m8-2v2M8 11h8m-8 4h8" />
                        </svg>
                        Bedrooms
                      </label>
                      <input
                        type="number"
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Number of bedrooms"
                        value={form.beds}
                        onChange={e => setForm(f => ({ ...f, beds: e.target.value === "" ? "" : Number(e.target.value) }))}
                        required
                        min="0"
                      />
                    </div>

                    {/* Baths */}
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                        </svg>
                        Bathrooms
                      </label>
                      <input
                        type="number"
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Number of bathrooms"
                        value={form.baths}
                        onChange={e => setForm(f => ({ ...f, baths: e.target.value === "" ? "" : Number(e.target.value) }))}
                        required
                        min="0"
                      />
                    </div>
                  </div>

                  {/* Location Selection */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Location
                    </label>
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={getCurrentLocation}
                          className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Use Current Location
                        </button>
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="Search for location or enter address manually"
                          value={form.location}
                          onChange={e => {
                            setForm(f => ({ ...f, location: e.target.value }));
                            searchLocations(e.target.value);
                          }}
                          onFocus={() => {
                            if (locationSuggestions.length > 0) setShowSuggestions(true);
                          }}
                        />

                        {/* Location Suggestions */}
                        {showSuggestions && locationSuggestions.length > 0 && (
                          <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                            {locationSuggestions.map((suggestion, index) => (
                              <button
                                key={index}
                                type="button"
                                className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 flex items-center gap-2"
                                onClick={() => selectLocation(suggestion)}
                              >
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className="text-sm text-gray-700 truncate">{suggestion}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {locationName && (
                        <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
                          <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-sm text-gray-700">{locationName}</span>
                        </div>
                      )}

                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        You can search for locations or click on the map to select a specific point
                      </div>
                    </div>
                  </div>

                  {/* Image Upload */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Property Images (Minimum 1)
                    </label>

                    {/* Image Upload Grid */}
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      {[0, 1, 2, 3, 4, 5].map((index) => (
                        <div key={index} className="relative">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const files = Array.from(e.target.files || []);
                              const newFiles = [...(form.files || [])];
                              if (files.length > 0) {
                                newFiles[index] = files[0];
                                setForm(f => ({ ...f, files: newFiles }));
                              }
                            }}
                            className="hidden"
                            id={`image-${index}`}
                          />
                          <label
                            htmlFor={`image-${index}`}
                            className={`block w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${form.files && form.files[index]
                              ? 'border-green-300 bg-green-50'
                              : 'border-gray-300 hover:border-purple-400'
                              }`}
                          >
                            {form.files && form.files[index] ? (
                              <div className="w-full h-full flex items-center justify-center">
                                <img
                                  src={URL.createObjectURL(form.files[index])}
                                  alt="Preview"
                                  className="w-full h-full object-cover rounded-lg"
                                />
                              </div>
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                <span className="text-xs">Add Image</span>
                              </div>
                            )}
                          </label>
                          {form.files && form.files[index] && (
                            <button
                              type="button"
                              onClick={() => {
                                const newFiles = [...(form.files || [])];
                                newFiles[index] = null as any;
                                setForm(f => ({ ...f, files: newFiles }));
                              }}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <p className="text-xs text-gray-500">
                      Upload at least 1 image. Supported formats: JPG, PNG, GIF (Max 5MB each)
                    </p>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    disabled={submitting || !form.name || !form.description}
                  >
                    {submitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        {uploadProgress > 0 ? `Uploading... ${uploadProgress}%` : "Submitting..."}
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Create Property
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Right: Map */}
              <div className="w-full lg:w-1/2 h-64 lg:h-full bg-gray-100">
                <div className="h-full relative">
                  {mounted && (
                    <div className="h-full">
                      <RealEstateMap
                        properties={[]}
                        onMapClick={handleMapClick}
                        selectedLocation={selectedLocation}
                        showProperties={false}
                      />
                    </div>
                  )}
                  {!mounted && (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-gray-500">Loading map...</div>
                    </div>
                  )}
                  <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3">
                    <p className="text-sm text-gray-600 mb-2">Click on the map to select location</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {selectedLocation.lat !== 0 ? "Location selected" : "No location selected"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row gap-0 p-0 bg-gray-50 min-h-0">
        {/* Left: Search & Properties */}
        <section className="flex-1 flex flex-col min-w-0 max-w-full lg:max-w-[calc(100%-620px)]">
          {/* Fixed Search & Filters */}
          <div className="sticky top-[80px] z-20 bg-white border-b px-6 pt-6 pb-4">
            {/* Search Bar */}
            <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
              <div className="flex items-center bg-white border rounded-lg px-4 py-2 flex-1">
                <span className="text-purple-500 mr-2 text-xl">📍</span>
                <input
                  className="flex-1 outline-none bg-transparent text-gray-700 placeholder-gray-400"
                  placeholder="Search Property Address"
                />
                <button className="ml-2 text-gray-500">▼</button>
              </div>
              <button className="bg-purple-500 hover:bg-purple-600 text-white font-semibold px-8 py-2 rounded-lg flex items-center gap-2">
                Search
              </button>
            </div>
            {/* Filters */}
            <div className="flex gap-4 flex-wrap mt-4">
              <select className="bg-white border rounded-lg px-4 py-2 min-w-[120px]">
                <option>Bed</option>
              </select>
              <select className="bg-white border rounded-lg px-4 py-2 min-w-[120px]">
                <option>Bath</option>
              </select>
              <select className="bg-white border rounded-lg px-4 py-2 min-w-[120px]">
                <option>Parking</option>
              </select>
              <select className="bg-white border rounded-lg px-4 py-2 min-w-[120px]">
                <option>Home Type</option>
              </select>
            </div>
          </div>
          {/* Scrollable Property Grid */}
          <div className="flex-1 overflow-y-auto p-6 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {properties.map((property, i) => {
                const mainImg = property.images && property.images.length > 0
                  ? (typeof property.images[0] === 'string' && property.images[0].startsWith('placeholder')
                    ? 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80'
                    : `/api/image/${property.images[0]}`)
                  : 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80';
                const createdAt = typeof property.createdAt === 'string' ? new Date(property.createdAt).getTime() : property.createdAt;
                const days = Math.floor((Date.now() - (createdAt || 0)) / (1000 * 60 * 60 * 24));
                return (
                  <div
                    key={property._id}
                    className="group bg-white rounded-xl shadow border border-gray-100 p-0 flex flex-col transition-transform duration-150 hover:scale-105 hover:shadow-xl hover:border-purple-200 cursor-pointer overflow-hidden min-h-[160px] max-h-[220px]"
                    style={{ fontSize: '0.92rem' }}
                    onClick={() => { setSelectedProperty(property); setShowDetailsModal(true); }}
                    aria-label={`View details for ${property.name}`}
                  >
                    {/* Image */}
                    <div className="relative w-full h-24 bg-gray-100 overflow-hidden">
                      <img
                        src={mainImg}
                        alt={property.name}
                        className="object-cover w-full h-full transition-transform duration-200 group-hover:scale-105"
                      />
                      {property.images && property.images.length > 1 && (
                        <div className="absolute top-1 right-1 bg-white/80 rounded-full px-1 py-0.5 text-[10px] text-gray-700 shadow flex items-center gap-1">
                          <FaTag className="text-purple-400 text-xs" />
                          {property.images.length} photos
                        </div>
                      )}
                    </div>
                    {/* Header */}
                    <div className="px-2 pt-2 flex flex-col gap-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-gray-900 truncate" title={property.name}>{property.name}</span>
                        <span className="flex items-center gap-1 text-purple-600 font-bold text-sm">
                          <FaTag className="inline-block text-xs" />
                          ${property.price?.toLocaleString() || 0}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-gray-500">
                        <FaMapMarkerAlt className="inline-block text-purple-400 text-xs" />
                        <span className="truncate" title={property.location}>{property.location}</span>
                      </div>
                    </div>
                    {/* Details Row */}
                    <div className="flex items-center justify-between gap-1 px-2 mt-1 mb-0.5">
                      <div className="flex items-center gap-0.5 text-xs text-gray-700">
                        <FaBed className="text-purple-400 text-xs" aria-label="Beds" /> {property.beds || 0}
                      </div>
                      <div className="flex items-center gap-0.5 text-xs text-gray-700">
                        <FaBath className="text-purple-400 text-xs" aria-label="Baths" /> {property.baths || 0}
                      </div>
                      <div className="flex items-center gap-0.5 text-xs text-gray-700">
                        <FaRulerCombined className="text-purple-400 text-xs" aria-label="Area" /> {property.area || 0} sqft
                      </div>
                    </div>
                    {/* Description */}
                    <div className="px-2 pb-1 text-[10px] text-gray-600 truncate" title={property.description}>
                      {property.description}
                    </div>
                    {/* Footer */}
                    <div className="flex items-center justify-between px-2 pb-2 pt-1 border-t border-gray-100 mt-auto">
                      <div className="flex items-center gap-1 text-[9px] text-gray-400">
                        <FaCalendarAlt className="inline-block text-xs" />
                        <span>{days === 0 ? 'Today' : days === 1 ? '1 day ago' : `${days} days ago`}</span>
                      </div>
                      <button
                        className="flex items-center gap-1 text-[10px] text-purple-600 font-semibold bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded transition-colors"
                        onClick={e => { e.stopPropagation(); setSelectedProperty(property); setShowDetailsModal(true); }}
                        aria-label={`View details for ${property.name}`}
                      >
                        View <FaMapMarkerAlt className="text-xs" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        {/* Right: Map with markers for properties */}
        <aside className="hidden lg:flex flex-col flex-shrink-0 w-full max-w-[600px] min-h-[200px] h-[calc(100vh-80px-2rem)] sticky top-[88px] bg-white rounded-none lg:rounded-l-lg items-center justify-center overflow-hidden mr-4 mt-4 mb-4 ml-2">
          {mounted ? (
            <RealEstateMap properties={properties} />
          ) : (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
              <div className="text-gray-500">Loading map...</div>
            </div>
          )}
        </aside>
      </main>

      {showDetailsModal && selectedProperty && (
        <PropertyDetailsModal
          property={selectedProperty}
          onClose={() => setShowDetailsModal(false)}
        />
      )}
    </div>
  );
}
