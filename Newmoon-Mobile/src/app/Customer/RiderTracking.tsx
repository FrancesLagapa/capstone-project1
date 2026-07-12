import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Linking, Alert, AppState, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import api from '../../../lib/api';

interface RiderInfo {
  id: number;
  name: string;
  phone?: string;
}

function toLat(val: any): number | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function toLng(val: any): number | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

// MAP HTML - Fixed route following with proper road routing
const GENERATE_MAP_HTML = () => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=2.0, user-scalable=yes">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; }
    html, body { height: 100%; width: 100%; overflow: hidden; background: #f3f4f6; }
    #map { height: 100%; width: 100%; background: #f3f4f6; }
    .moving-dot {
      background: #3B82F6;
      border-radius: 50%;
      border: 3px solid white;
      width: 16px;
      height: 16px;
      box-shadow: 0 0 0 4px rgba(59,130,246,0.3);
    }
    .moving-dot-pulse {
      animation: pulse 1.5s ease-in-out infinite;
    }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(59,130,246,0.4); }
      70% { box-shadow: 0 0 0 10px rgba(59,130,246,0); }
      100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
    }
    .destination-marker {
      background: #EF4444;
      border-radius: 50%;
      border: 2.5px solid white;
      width: 20px;
      height: 20px;
      box-shadow: 0 0 15px rgba(239, 68, 68, 0.3);
      animation: destPulse 1.5s ease-in-out infinite;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    @keyframes destPulse {
      0% { box-shadow: 0 0 15px rgba(239, 68, 68, 0.3); }
      50% { box-shadow: 0 0 30px rgba(239, 68, 68, 0.6); }
      100% { box-shadow: 0 0 15px rgba(239, 68, 68, 0.3); }
    }
    .destination-marker::after {
      content: '\\1F4CD';
      font-size: 10px;
    }
    /* Route Line - Solid Yellow/Gold */
    .route-line {
      stroke: #F59E0B;
      stroke-width: 4;
      stroke-linecap: round;
      stroke-linejoin: round;
      filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.3));
    }
    .route-glow {
      stroke: #F59E0B;
      stroke-width: 10;
      opacity: 0.15;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    (function() {
      function initMap() {
        try {
          var map = L.map('map', {
            zoomControl: true,
            attributionControl: true,
          }).setView([14.5600, 121.0200], 15);

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
          }).addTo(map);

          window.map = map;
          window.riderMarker = null;
          window.destMarker = null;
          window.activeRoute = null;
          window.activeGlow = null;
          window.riderPos = null;
          window.destPos = null;
          window.__autoFollow = true;
          window.__fullRouteCoords = null;
          window.__routeCacheKey = null;
          window.__isDragging = false;
          window.__pendingUpdate = null;
          window.routeRetryCount = 0;
          window.maxRouteRetries = 3;
          window.lastRouteFetchTime = 0;
          window.minRouteFetchInterval = 2000; // 2 seconds

          var riderIcon = L.divIcon({
            html: '<div class="moving-dot moving-dot-pulse"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
            className: ''
          });

          function makeDestIcon() {
            return L.divIcon({
              html: '<div class="destination-marker"></div>',
              iconSize: [20, 20],
              iconAnchor: [10, 10],
              className: ''
            });
          }

          function haversine(lat1, lng1, lat2, lng2) {
            var R = 6371000;
            var dLat = (lat2 - lat1) * Math.PI / 180;
            var dLng = (lng2 - lng1) * Math.PI / 180;
            var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLng/2) * Math.sin(dLng/2);
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          }

          map.on('dragstart', function() {
            window.__isDragging = true;
            window.__autoFollow = false;
          });

          map.on('dragend', function() {
            window.__isDragging = false;
            if (window.__pendingUpdate) {
              showRoute(window.__pendingUpdate);
              window.__pendingUpdate = null;
            }
          });

          window.__enableFollow = function() {
            window.__autoFollow = true;
            window.__isDragging = false;
            if (window.riderPos) {
              map.setView([window.riderPos.lat, window.riderPos.lng], map.getZoom(), { animate: true });
            }
          };

          function showRoute(coords) {
            if (!coords || coords.length < 2) {
              if (window.riderPos && window.destPos) {
                coords = [
                  [window.riderPos.lat, window.riderPos.lng],
                  [window.destPos.lat, window.destPos.lng]
                ];
              } else {
                return;
              }
            }

            if (window.activeGlow) { window.map.removeLayer(window.activeGlow); }
            window.activeGlow = L.polyline(coords, {
              color: '#F59E0B',
              weight: 10,
              opacity: 0.15,
              smoothFactor: 1
            }).addTo(map);

            if (window.activeRoute) { window.map.removeLayer(window.activeRoute); }
            window.activeRoute = L.polyline(coords, {
              color: '#F59E0B',
              weight: 4,
              opacity: 0.9,
              smoothFactor: 1,
              lineJoin: 'round',
              lineCap: 'round',
              className: 'route-line'
            }).addTo(map);
          }

          function findNearestPointOnRoute(routeCoords, lat, lng) {
            if (!routeCoords || routeCoords.length < 2) return null;
            var minDist = Infinity;
            var nearestPoint = null;
            var nearestIndex = 0;
            for (var i = 0; i < routeCoords.length; i++) {
              var p = routeCoords[i];
              var d = Math.pow(p[0] - lat, 2) + Math.pow(p[1] - lng, 2);
              if (d < minDist) {
                minDist = d;
                nearestPoint = p;
                nearestIndex = i;
              }
            }
            return { point: nearestPoint, index: nearestIndex };
          }

          function updateRouteDisplay(currentIndex) {
            var fullCoords = window.__fullRouteCoords;
            if (!fullCoords || fullCoords.length === 0) return;

            var remainingCoords = fullCoords.slice(currentIndex);
            if (remainingCoords.length < 2) {
              if (window.riderPos && window.destPos) {
                remainingCoords = [[window.riderPos.lat, window.riderPos.lng], [window.destPos.lat, window.destPos.lng]];
              } else {
                return;
              }
            }

            if (window.activeGlow) { window.map.removeLayer(window.activeGlow); }
            window.activeGlow = L.polyline(remainingCoords, {
              color: '#F59E0B',
              weight: 10,
              opacity: 0.15,
              smoothFactor: 1
            }).addTo(map);

            if (window.activeRoute) { window.map.removeLayer(window.activeRoute); }
            window.activeRoute = L.polyline(remainingCoords, {
              color: '#F59E0B',
              weight: 4,
              opacity: 0.9,
              smoothFactor: 1,
              lineJoin: 'round',
              lineCap: 'round',
              className: 'route-line'
            }).addTo(map);
          }

          function fetchRouteWithRetry(fromLat, fromLng, toLat, toLng, retryCount) {
            retryCount = retryCount || 0;
            
            // Try different routing endpoints
            var endpoints = [
              'https://router.project-osrm.org/route/v1/driving/',
              'https://routing.openstreetmap.de/routed-car/route/v1/driving/'
            ];
            
            var endpoint = endpoints[retryCount % endpoints.length];
            var url = endpoint + fromLng + ',' + fromLat + ';' + toLng + ',' + toLat
              + '?geometries=geojson&overview=full&alternatives=true&steps=true';

            fetch(url)
              .then(function(r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
              })
              .then(function(data) {
                window.routeRetryCount = 0;
                if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                  // Find the best route (shortest distance)
                  var bestRoute = data.routes[0];
                  for (var i = 1; i < data.routes.length; i++) {
                    if (data.routes[i].distance < bestRoute.distance) {
                      bestRoute = data.routes[i];
                    }
                  }
                  var coords = bestRoute.geometry.coordinates.map(function(c) {
                    return [c[1], c[0]];
                  });
                  
                  window.__fullRouteCoords = coords;
                  window.__routeCacheKey = fromLat + ',' + fromLng + '|' + toLat + ',' + toLng;
                  window.lastRouteFetchTime = Date.now();

                  if (!window.__isDragging) {
                    showRoute(coords);
                  } else {
                    window.__pendingUpdate = coords;
                  }
                } else {
                  // Try alternative endpoint or retry
                  if (retryCount < window.maxRouteRetries) {
                    setTimeout(function() {
                      fetchRouteWithRetry(fromLat, fromLng, toLat, toLng, retryCount + 1);
                    }, 1000);
                  } else {
                    // Fallback: use a simpler routing approach
                    fallbackRoute(fromLat, fromLng, toLat, toLng);
                  }
                }
              })
              .catch(function(err) {
                console.log('Route fetch error:', err);
                if (retryCount < window.maxRouteRetries) {
                  setTimeout(function() {
                    fetchRouteWithRetry(fromLat, fromLng, toLat, toLng, retryCount + 1);
                  }, 1000);
                } else {
                  fallbackRoute(fromLat, fromLng, toLat, toLng);
                }
              });
          }

          function fallbackRoute(fromLat, fromLng, toLat, toLng) {
            // Create a more realistic fallback with intermediate points
            var coords = [];
            var steps = 20;
            for (var i = 0; i <= steps; i++) {
              var t = i / steps;
              // Add slight curve to make it look more natural
              var lat = fromLat + (toLat - fromLat) * t;
              var lng = fromLng + (toLng - fromLng) * t;
              // Add small curve offset
              var curveOffset = Math.sin(t * Math.PI) * 0.001;
              coords.push([lat + curveOffset, lng]);
            }
            
            window.__fullRouteCoords = coords;
            if (!window.__isDragging) {
              showRoute(coords);
            } else {
              window.__pendingUpdate = coords;
            }
          }

          function fetchRoute(fromLat, fromLng, toLat, toLng) {
            // Rate limit route fetching
            var now = Date.now();
            if (now - window.lastRouteFetchTime < window.minRouteFetchInterval) {
              return;
            }
            
            fetchRouteWithRetry(fromLat, fromLng, toLat, toLng, 0);
          }

          window.__updateRider = function(lat, lng) {
            if (!map) return;

            if (window.__fullRouteCoords && window.__fullRouteCoords.length >= 2) {
              var nearest = findNearestPointOnRoute(window.__fullRouteCoords, lat, lng);
              if (nearest && nearest.point) {
                window.riderPos = { lat: nearest.point[0], lng: nearest.point[1] };

                if (window.riderMarker) {
                  window.riderMarker.setLatLng([nearest.point[0], nearest.point[1]]);
                } else {
                  window.riderMarker = L.marker([nearest.point[0], nearest.point[1]], { icon: riderIcon }).addTo(map);
                }

                if (window.__autoFollow && !window.__isDragging) {
                  map.panTo([nearest.point[0], nearest.point[1]], { animate: true, duration: 0.3 });
                }

                if (!window.__isDragging) {
                  updateRouteDisplay(nearest.index);
                }
                return;
              }
            }

            // If no route exists, fetch one
            window.riderPos = { lat: lat, lng: lng };
            if (window.riderMarker) {
              window.riderMarker.setLatLng([lat, lng]);
            } else {
              window.riderMarker = L.marker([lat, lng], { icon: riderIcon }).addTo(map);
            }
            if (window.__autoFollow && !window.__isDragging) {
              map.panTo([lat, lng], { animate: true, duration: 0.3 });
            }
            
            if (window.destPos && !window.__isDragging) {
              var cacheKey = lat + ',' + lng + '|' + window.destPos.lat + ',' + window.destPos.lng;
              if (window.__routeCacheKey !== cacheKey) {
                fetchRoute(lat, lng, window.destPos.lat, window.destPos.lng);
              }
            }
          };

          window.__initDestination = function(lat, lng, address) {
            window.destPos = { lat: lat, lng: lng };
            if (window.destMarker) {
              window.destMarker.setLatLng([lat, lng]);
            } else {
              window.destMarker = L.marker([lat, lng], { icon: makeDestIcon() }).addTo(map)
                .bindPopup('<b>Delivery</b><br>' + (address || ''));
            }
            if (window.riderPos && !window.__isDragging) {
              var cacheKey = window.riderPos.lat + ',' + window.riderPos.lng + '|' + lat + ',' + lng;
              if (window.__routeCacheKey !== cacheKey) {
                fetchRoute(window.riderPos.lat, window.riderPos.lng, lat, lng);
              }
            }
          };

          window.__updateDestination = function(lat, lng, address) {
            window.destPos = { lat: lat, lng: lng };
            if (window.destMarker) {
              window.destMarker.setLatLng([lat, lng]);
            } else {
              window.destMarker = L.marker([lat, lng], { icon: makeDestIcon() }).addTo(map)
                .bindPopup('<b>Delivery</b><br>' + (address || ''));
            }
            if (window.riderPos && !window.__isDragging) {
              fetchRoute(window.riderPos.lat, window.riderPos.lng, lat, lng);
            }
          };

          window.__fitBounds = function() {
            var bounds = [];
            if (window.riderPos) bounds.push([window.riderPos.lat, window.riderPos.lng]);
            if (window.destPos) bounds.push([window.destPos.lat, window.destPos.lng]);
            if (bounds.length > 0) {
              map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
            }
          };

          window.__initRider = function(lat, lng) {
            window.riderPos = { lat: lat, lng: lng };
            if (window.riderMarker) {
              window.riderMarker.setLatLng([lat, lng]);
            } else {
              window.riderMarker = L.marker([lat, lng], { icon: riderIcon }).addTo(map);
            }
            if (window.__autoFollow && !window.__isDragging) {
              map.setView([lat, lng], 16, { animate: false });
            }
            if (window.destPos && !window.__isDragging) {
              fetchRoute(lat, lng, window.destPos.lat, window.destPos.lng);
            }
          };

          setTimeout(function() { map.invalidateSize(); }, 300);
          setTimeout(function() { map.invalidateSize(); }, 600);
          console.log('Map initialized successfully');
        } catch (error) {
          console.error('Map init error:', error);
        }
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMap);
      } else {
        initMap();
      }
    })();
  </script>
</body>
</html>`;
};

export default function RiderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const webViewRef = useRef<WebView>(null);
  const [rider, setRider] = useState<RiderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hasLocation, setHasLocation] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const noId = !id;

  const mapHtmlRef = useRef<string>(GENERATE_MAP_HTML());
  const mapReadyRef = useRef(false);
  const riderRef = useRef<RiderInfo | null>(null);
  const orderFetchCountRef = useRef(0);
  const liveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const injectJS = (js: string) => {
    webViewRef.current?.injectJavaScript(js);
  };

  const fetchTracking = async () => {
    if (!id) return;
    try {
      const trackRes = await api.get(`/customer/orders/${id}/track`);
      const riderData = trackRes.data.rider;

      if (riderData && (!riderRef.current || riderData.id !== riderRef.current.id)) {
        riderRef.current = riderData;
        setRider(riderData);
      }

      const lat = toLat(trackRes.data.latitude);
      const lng = toLng(trackRes.data.longitude);
      setUpdatedAt(trackRes.data.updated_at);

      if (lat !== null && lng !== null) {
        if (!hasLocation) setHasLocation(true);
        setIsLive(true);

        if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
        liveTimerRef.current = setTimeout(() => setIsLive(false), 5000);

        if (mapReadyRef.current) {
          injectJS(`if(window.__updateRider){window.__updateRider(${lat},${lng})}true;`);
        }
      }

      orderFetchCountRef.current++;
      if (orderFetchCountRef.current % 10 === 1) {
        const orderRes = await api.get(`/customer/orders/${id}`);
        const addr = orderRes.data.delivery_address || '';
        setDeliveryAddress(addr);
        const dLat = toLat(orderRes.data.delivery_latitude);
        const dLng = toLng(orderRes.data.delivery_longitude);
        if (dLat && dLng && mapReadyRef.current) {
          injectJS(`if(window.__initDestination){window.__initDestination(${dLat},${dLng},'${addr.replace(/'/g,"\\'")}')}true;`);
        }
      }
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setError('No rider assigned yet');
      } else if (!hasLocation) {
        setError('Unable to load tracking');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    fetchTracking();
    const interval = setInterval(fetchTracking, 1000);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') fetchTracking();
    });

    return () => {
      clearInterval(interval);
      sub.remove();
      if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
    };
  }, [id]);

  useEffect(() => {
    if (!mapReadyRef.current || !webViewRef.current) return;
    injectJS('if(window.__enableFollow){window.__enableFollow()}true;');
  }, [mapLoaded]);

  const openDirections = () => {
    injectJS(`
      if(window.riderPos){
        window.open('https://www.google.com/maps/dir/?api=1&destination='+window.riderPos.lat+','+window.riderPos.lng+'&travelmode=driving','_blank');
      }true;`);
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  if (noId) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <StatusBar barStyle="dark-content" backgroundColor="#FBBF24" />
        <View className="bg-white px-4 py-4 border-b border-gray-100 flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-900">Track Rider</Text>
        </View>
        <View className="flex-1 items-center justify-center px-6 bg-gray-50">
          <Ionicons name="locate-outline" size={64} color="#D1D5DB" />
          <Text className="text-gray-900 text-lg font-bold mt-4">No Order Selected</Text>
          <Text className="text-gray-500 text-sm text-center mt-2">
            Go to an order that's out for delivery to track your rider.
          </Text>
          <TouchableOpacity className="mt-6 bg-yellow-400 px-8 py-3 rounded-full" onPress={() => router.back()}>
            <Text className="text-yellow-900 font-semibold">Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 justify-center items-center">
        <ActivityIndicator size="large" color="#F59E0B" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <StatusBar barStyle="dark-content" backgroundColor="#FBBF24" />
        <View className="bg-white px-4 py-4 border-b border-gray-100 flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-900">Track Rider</Text>
        </View>
        <View className="flex-1 items-center justify-center px-6 bg-gray-50">
          <Ionicons name="locate-outline" size={64} color="#D1D5DB" />
          <Text className="text-gray-900 text-lg font-bold mt-4">No Rider Assigned</Text>
          <Text className="text-gray-500 text-sm text-center mt-2">
            A rider will be assigned to your order once it's out for delivery.
          </Text>
          <TouchableOpacity className="mt-6 bg-yellow-400 px-8 py-3 rounded-full" onPress={() => router.back()}>
            <Text className="text-yellow-900 font-semibold">Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="#FBBF24" />

      <View className="bg-white px-4 pt-2 pb-3 border-b border-gray-100">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <TouchableOpacity 
              onPress={() => router.back()} 
              className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center mr-2"
            >
              <Ionicons name="arrow-back" size={22} color="#1F2937" />
            </TouchableOpacity>
            <View>
              <Text className="text-lg font-bold text-gray-900">Track Order</Text>
              <View className="flex-row items-center mt-0.5">
                <Text className="text-xs text-gray-500">
                  {hasLocation ? formatTime(updatedAt) : 'Waiting...'}
                </Text>
                {isLive && hasLocation && (
                  <View className="flex-row items-center ml-2">
                    <View className="w-2 h-2 rounded-full bg-green-500 mr-1" />
                    <Text className="text-green-600 text-xs font-medium">Live</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          <TouchableOpacity 
            className="bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200 flex-row items-center"
            onPress={() => injectJS('if(window.__enableFollow){window.__enableFollow()}true;')}
          >
            <Ionicons name="locate" size={12} color="#3B82F6" />
            <Text className="text-blue-600 text-xs font-medium ml-1">Follow</Text>
          </TouchableOpacity>
        </View>
      </View>

      {rider && (
        <View className="bg-white mx-4 mt-3 rounded-2xl p-4 border border-gray-100 shadow-sm">
          <View className="flex-row items-center">
            <View className="w-14 h-14 rounded-full bg-yellow-100 items-center justify-center border-2 border-yellow-300">
              <FontAwesome5 name="motorcycle" size={24} color="#F59E0B" />
            </View>
            <View className="ml-4 flex-1">
              <Text className="text-gray-500 text-xs font-medium">Your Rider</Text>
              <Text className="text-gray-900 font-bold text-lg">{rider.name}</Text>
              <View className="flex-row items-center mt-0.5">
                <View className={`w-2 h-2 rounded-full ${hasLocation ? 'bg-green-500' : 'bg-gray-300'} mr-1.5`} />
                <Text className={`text-xs ${hasLocation ? 'text-green-600' : 'text-gray-400'}`}>
                  {hasLocation ? 'En route to you' : 'Waiting for location'}
                </Text>
              </View>
            </View>
            <View className="flex-row">
              {rider.phone && (
                <TouchableOpacity 
                  className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center border border-gray-200 mr-2"
                  onPress={() => Linking.openURL(`tel:${rider.phone}`)}
                >
                  <Ionicons name="call" size={18} color="#F59E0B" />
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                className="w-10 h-10 rounded-full bg-yellow-50 items-center justify-center border border-yellow-200"
                onPress={openDirections}
                disabled={!hasLocation}
              >
                <Ionicons name="navigate" size={18} color="#F59E0B" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <View className="flex-1 mt-3 mx-4 rounded-2xl overflow-hidden border border-gray-200">
        {!mapLoaded && (
          <View className="absolute inset-0 items-center justify-center bg-gray-50 z-10">
            <ActivityIndicator size="large" color="#F59E0B" />
            <Text className="text-gray-500 mt-3 text-sm">Loading map...</Text>
          </View>
        )}

        <WebView
          ref={webViewRef}
          style={{ flex: 1, backgroundColor: '#f3f4f6' }}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="always"
          source={{ html: mapHtmlRef.current }}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          onLoadEnd={() => {
            setMapLoaded(true);
            mapReadyRef.current = true;
            setTimeout(() => {
              injectJS('if(window.map){window.map.invalidateSize()}true;');
            }, 300);
          }}
        />

        {!hasLocation && mapLoaded && (
          <View className="absolute inset-0 bg-white/90 items-center justify-center">
            <ActivityIndicator size="large" color="#F59E0B" />
            <Text className="text-gray-900 mt-4 text-base font-semibold">Waiting for rider location...</Text>
            <Text className="text-gray-500 text-sm mt-1 text-center px-6">
              Rider will appear on the map once location is available
            </Text>
          </View>
        )}
      </View>

      {deliveryAddress && (
        <View className="bg-white mx-4 mt-3 rounded-2xl p-4 border border-gray-100 shadow-sm">
          <View className="flex-row items-center">
            <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center border border-blue-200">
              <Ionicons name="location" size={18} color="#3B82F6" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-gray-500 text-xs font-medium">Delivery Address</Text>
              <Text className="text-gray-900 text-sm font-medium" numberOfLines={2}>
                {deliveryAddress}
              </Text>
              {hasLocation && rider && (
                <View className="flex-row items-center mt-1">
                  <Ionicons name="time-outline" size={12} color="#F59E0B" />
                  <Text className="text-yellow-600 text-xs ml-1">Rider is on the way</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}