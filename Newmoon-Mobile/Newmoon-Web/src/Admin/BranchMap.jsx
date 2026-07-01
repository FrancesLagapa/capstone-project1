import React, { useState, useEffect, useCallback, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { Icon, divIcon, point } from "leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { 
  EnvironmentOutlined, 
  PhoneOutlined, 
  MailOutlined,
  ReloadOutlined,
  SearchOutlined,
  EditOutlined,
  LoadingOutlined
} from "@ant-design/icons";
import { api } from "../config/api";
import { getCache, setCache, invalidateCache } from "../utils/cache";
import "leaflet/dist/leaflet.css";

// Add cluster icon styles
const style = document.createElement('style');
style.innerHTML = `
  .custom-marker-cluster {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 50%;
    color: white;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 3px solid white;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
  }
  .cluster-icon {
    font-size: 14px;
    font-weight: bold;
  }
`;
document.head.appendChild(style);

// Fix for default marker icon in react-leaflet
const customIcon = new Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -38],
  shadowSize: [38, 38]
});

// Custom cluster icon
const createClusterCustomIcon = function (cluster) {
  return new divIcon({
    html: `<div class="cluster-icon">${cluster.getChildCount()}</div>`,
    className: "custom-marker-cluster",
    iconSize: point(40, 40, true)
  });
};

// Component to auto-fit map bounds to show all markers
function MapBounds({ branches }) {
  const map = useMap();

  useEffect(() => {
    if (branches.length > 0) {
      const validBranches = branches.filter(b => b.latitude && b.longitude);
      if (validBranches.length > 0) {
        const bounds = validBranches.map(b => [b.latitude, b.longitude]);
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [branches, map]);

  return null;
}

// Component to fix map rendering issues
function MapInitializer() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

function BranchMap() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [editForm, setEditForm] = useState({
    address: ""
  });
  const [isGeocoding, setIsGeocoding] = useState(false);

  const loadBranches = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const cachedBranches = forceRefresh ? null : getCache('branches');

      if (cachedBranches) {
        setBranches(cachedBranches);
        setLoading(false);
        return;
      }

      const response = await api.get("/branches");
      const branchesData = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      console.log("Loaded branches:", branchesData);
      console.log("Branches with location:", branchesData.filter(b => b.latitude && b.longitude));
      setBranches(branchesData);
      setCache('branches', branchesData);
    } catch (error) {
      console.error("Failed to load branches:", error);
      alert("Failed to load branches from backend.");
      setBranches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    const updatePHTime = () => {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const phTime = new Date(utc + 8 * 60 * 60 * 1000);
      setCurrentTime(phTime);
    };

    updatePHTime();
    const timer = setInterval(updatePHTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const filteredBranches = useMemo(() => {
    return branches.filter(branch =>
      branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (branch.address && branch.address.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [branches, searchTerm]);

  const branchesWithLocation = useMemo(() => {
    return filteredBranches.filter(b => b.latitude && b.longitude);
  }, [filteredBranches]);

  const branchesWithoutLocation = useMemo(() => {
    return filteredBranches.filter(b => !b.latitude || !b.longitude);
  }, [filteredBranches]);

  const handleOpenGoogleMaps = (branch) => {
    if (branch.latitude && branch.longitude) {
      window.open(`https://www.google.com/maps?q=${branch.latitude},${branch.longitude}`, '_blank');
    }
  };

  const handleOpenOpenStreetMap = (branch) => {
    if (branch.latitude && branch.longitude) {
      window.open(`https://www.openstreetmap.org/?mlat=${branch.latitude}&mlon=${branch.longitude}#map=15/${branch.latitude}/${branch.longitude}`, '_blank');
    }
  };

  const handleEditLocation = (branch) => {
    setEditingBranch(branch);
    setEditForm({
      address: branch.address || ""
    });
    setIsEditModalVisible(true);
  };

  const handleSaveLocation = async () => {
    if (!editingBranch) return;

    if (!editForm.address || editForm.address.trim() === "") {
      alert("Please enter an address.");
      return;
    }

    setIsGeocoding(true);
    try {
      console.log("Geocoding address:", editForm.address);
      
      // Try geocoding with multiple variations
      const searchQueries = [
        editForm.address,
        editForm.address.replace(/,/g, ''), // Remove commas
        editForm.address.split(',')[0], // Try just the first part
        `${editForm.address}, Philippines`, // Add country
        editForm.address.replace(/\+/g, ' '), // Replace plus signs with spaces (for Plus Codes)
      ];

      let geocodeResult = null;
      
      for (const query of searchQueries) {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
          );
          const data = await response.json();
          console.log(`Geocoding result for "${query}":`, data);

          if (data && data.length > 0) {
            geocodeResult = data[0];
            break;
          }
        } catch (e) {
          console.log(`Failed to geocode "${query}":`, e);
          continue;
        }
      }

      if (!geocodeResult) {
        // If all geocoding attempts fail, offer manual coordinate entry
        const manualCoords = prompt(
          "Automatic geocoding failed. Please enter coordinates manually.\n\n" +
          "Format: latitude, longitude\n" +
          "Example: 8.4845, 124.6522\n\n" +
          "Or click Cancel to try a different address."
        );
        
        if (manualCoords) {
          const coords = manualCoords.split(',').map(c => c.trim());
          if (coords.length === 2) {
            const lat = parseFloat(coords[0]);
            const lng = parseFloat(coords[1]);
            
            if (isNaN(lat) || isNaN(lng)) {
              throw new Error("Invalid coordinates. Please enter valid numbers.");
            }
            
            const { data: updatedBranch } = await api.put(`/branches/${editingBranch.id}`, {
              latitude: lat,
              longitude: lng,
              address: editForm.address
            });
            
            setBranches(branches.map(b => b.id === editingBranch.id ? updatedBranch : b));
            invalidateCache('branches');
            
            setIsEditModalVisible(false);
            setEditingBranch(null);
            setEditForm({ address: "" });
            
            alert("Branch location updated successfully!");
            setIsGeocoding(false);
            return;
          } else {
            throw new Error("Invalid coordinate format. Please use: latitude, longitude");
          }
        } else {
          throw new Error("Geocoding cancelled. Please try a different address.");
        }
      }

      const lat = parseFloat(geocodeResult.lat);
      const lng = parseFloat(geocodeResult.lon);
      console.log("Coordinates:", { lat, lng });

      const { data: updatedBranch } = await api.put(`/branches/${editingBranch.id}`, {
        latitude: lat,
        longitude: lng,
        address: editForm.address
      });
      console.log("Updated branch:", updatedBranch);

      setBranches(branches.map(b => b.id === editingBranch.id ? updatedBranch : b));
      invalidateCache('branches');

      setIsEditModalVisible(false);
      setEditingBranch(null);
      setEditForm({ address: "" });

      alert("Branch location updated successfully!");
    } catch (error) {
      console.error("Update error:", error);
      alert(error.message || error?.response?.data?.message || "Failed to update branch location");
    } finally {
      setIsGeocoding(false);
    }
  };


  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Branch Locations Map</h1>
            <p className="text-gray-500 mt-1">View all branch locations on an interactive map</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Current Philippines Time</p>
            <p className="text-lg font-semibold">
              {currentTime.toLocaleTimeString('en-PH', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
            <p className="text-xs text-gray-400">
              {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total Branches</p>
                  <p className="text-2xl font-bold text-gray-800">{branches.length}</p>
                </div>
                <div className="bg-blue-100 rounded-full p-3">
                  <EnvironmentOutlined className="text-xl text-blue-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">With Location</p>
                  <p className="text-2xl font-bold text-green-600">{branchesWithLocation.length}</p>
                </div>
                <div className="bg-green-100 rounded-full p-3">
                  <EnvironmentOutlined className="text-xl text-green-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Missing Location</p>
                  <p className="text-2xl font-bold text-orange-600">{branchesWithoutLocation.length}</p>
                </div>
                <div className="bg-orange-100 rounded-full p-3">
                  <EnvironmentOutlined className="text-xl text-orange-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div className="flex gap-4 items-center">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Search Branch</label>
                  <div className="flex items-center border border-gray-300 rounded-md px-3 py-1.5">
                    <SearchOutlined className="text-gray-400 text-sm mr-2" />
                    <input
                      type="text"
                      placeholder="Enter branch name or address..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="text-sm outline-none w-48 bg-transparent"
                      aria-label="Search branches"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => loadBranches(true)}
                  aria-label="Refresh branch locations"
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <ReloadOutlined />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Google Map */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-500 mt-4">Loading map...</p>
                </div>
              </div>
            ) : branchesWithLocation.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <EnvironmentOutlined className="text-6xl text-gray-300 mb-4" />
                <p className="text-gray-500 text-lg mb-2">No branch locations found</p>
                <p className="text-gray-400">Add latitude and longitude to branches to see them on the map</p>
              </div>
            ) : (
              <div className="h-[600px] w-full md:h-[700px] lg:h-[800px] relative">
                <MapContainer
                  key={branchesWithLocation.length}
                  center={[14.5995, 120.9842]}
                  zoom={10}
                  style={{ height: "100%", width: "100%" }}
                  zoomControl={true}
                >
                  <MapInitializer />
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapBounds branches={branchesWithLocation} />
                  <MarkerClusterGroup
                    chunkedLoading
                    iconCreateFunction={createClusterCustomIcon}
                  >
                    {branchesWithLocation.map((branch) => (
                    <Marker
                      key={branch.id}
                      position={[branch.latitude, branch.longitude]}
                      icon={customIcon}
                      eventHandlers={{
                        click: () => setSelectedBranch(branch)
                      }}
                    >
                      <Popup>
                        <div className="p-2 min-w-[200px]">
                          <h3 className="font-bold text-lg text-gray-800 mb-2">{branch.name}</h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-start gap-2">
                              <EnvironmentOutlined className="text-gray-500 mt-0.5" />
                              <span className="text-gray-600">{branch.address || 'No address'}</span>
                            </div>
                            {branch.phone && (
                              <div className="flex items-start gap-2">
                                <PhoneOutlined className="text-gray-500 mt-0.5" />
                                <span className="text-gray-600">{branch.phone}</span>
                              </div>
                            )}
                            {branch.email && (
                              <div className="flex items-start gap-2">
                                <MailOutlined className="text-gray-500 mt-0.5" />
                                <span className="text-gray-600">{branch.email}</span>
                              </div>
                            )}
                            <div className="pt-2 border-t border-gray-200 flex gap-2">
                              <button
                                onClick={() => handleOpenGoogleMaps(branch)}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium flex-1"
                              >
                                Google Maps →
                              </button>
                              <button
                                onClick={() => handleOpenOpenStreetMap(branch)}
                                className="text-green-600 hover:text-green-800 text-sm font-medium flex-1"
                              >
                                OpenStreetMap →
                              </button>
                              <button
                                onClick={() => handleEditLocation(branch)}
                                className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                              >
                                <EditOutlined />
                              </button>
                            </div>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                  </MarkerClusterGroup>
                </MapContainer>
              </div>
            )}
          </div>

          {/* Branches Without Location */}
          {branchesWithoutLocation.length > 0 && (
            <div className="bg-orange-50 rounded-lg border border-orange-200 p-4 mb-6">
              <h3 className="text-sm font-semibold text-orange-800 mb-3">
                Branches Missing Location Data ({branchesWithoutLocation.length})
              </h3>
              <div className="space-y-2">
                {branchesWithoutLocation.map((branch) => (
                  <div key={branch.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-orange-200">
                    <div>
                      <p className="font-medium text-gray-800">{branch.name}</p>
                      <p className="text-xs text-gray-500">{branch.address || 'No address'}</p>
                    </div>
                    <button
                      onClick={() => handleEditLocation(branch)}
                      className="px-3 py-1.5 text-xs border border-blue-500 text-blue-600 rounded hover:bg-blue-50 transition-colors flex items-center gap-1"
                    >
                      <EditOutlined className="text-[10px]" />
                      Add Location
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Branch List */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">All Branches</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {filteredBranches.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <EnvironmentOutlined className="text-5xl mb-3" />
                  <p className="text-gray-500">No branches found</p>
                </div>
              ) : (
                filteredBranches.map((branch) => (
                  <div key={branch.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium text-gray-800">{branch.name}</h4>
                          <span className="text-xs text-gray-500">({branch.code})</span>
                          {branch.latitude && branch.longitude ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Located
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                              No Location
                            </span>
                          )}
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <EnvironmentOutlined className="text-gray-400" />
                            <span>{branch.address || 'No address provided'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="ml-4 flex gap-2">
                        <button
                          onClick={() => handleEditLocation(branch)}
                          className="px-3 py-1.5 text-sm border border-gray-500 text-gray-600 rounded hover:bg-gray-50 transition-colors"
                        >
                          Edit Location
                        </button>
                        {branch.latitude && branch.longitude && (
                          <button
                            onClick={() => handleOpenGoogleMaps(branch)}
                            className="px-3 py-1.5 text-sm border border-blue-500 text-blue-600 rounded hover:bg-blue-50 transition-colors"
                          >
                            View on Map
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center text-xs text-gray-400 border-t border-gray-200 pt-4">
            <p>Generated on {currentTime.toLocaleString()} | New Moon Branch Location System</p>
          </div>
        </div>
      </div>

      {/* Edit Location Modal */}
      {isEditModalVisible && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-opacity-50 backdrop-blur-sm transition-opacity duration-200"
            onClick={() => {
              setIsEditModalVisible(false);
              setEditingBranch(null);
              setEditForm({ address: "" });
            }}
          />
          <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 z-[10000]">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingBranch?.name} - Set Location
              </h3>
              <button
                onClick={() => {
                  setIsEditModalVisible(false);
                  setEditingBranch(null);
                  setEditForm({ address: "" });
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="address">
                  Address
                </label>
                <input
                  id="address"
                  type="text"
                  placeholder="e.g., 123 Main St, Manila, Philippines"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-xs text-blue-800">
                  <strong>Tip:</strong> Enter a complete address including street, city, and country for accurate location detection.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setIsEditModalVisible(false);
                    setEditingBranch(null);
                    setEditForm({ address: "" });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveLocation}
                  disabled={isGeocoding}
                  className="px-4 py-2 rounded-md text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeocoding ? "Locating..." : "Save Location"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
  );
}

export default BranchMap;