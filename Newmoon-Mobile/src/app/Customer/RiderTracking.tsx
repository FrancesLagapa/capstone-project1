import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Linking, Alert, AppState, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
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

// MAP HTML - Only generated once, with dynamic initialization
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
          }).setView([14.5600, 121.0200], 13);

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
          }).addTo(map);

          function makeRiderIcon() {
            return L.divIcon({
              html: '<div style="width:32px;height:32px;background:#F59E0B;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M19 7c0-1.1-.9-2-2-2h-3v2h3v2.65L13.52 14H10V9H6c-2.21 0-4 1.79-4 4v3h2c0 1.66 1.34 3 3 3s3-1.34 3-3h4.48L19 10.35V7zM7 17c-.55 0-1-.45-1-1h2c0 .55-.45 1-1 1z"/><circle cx="19" cy="17" r="3" fill="white"/><circle cx="19" cy="17" r="1.5" fill="#F59E0B"/></svg></div>',
              iconSize: [32, 32],
              iconAnchor: [16, 16],
              className: ''
            });
          }

          function makeDestIcon() {
            return L.divIcon({
              html: '<div style="width:16px;height:16px;background:#3B82F6;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(59,130,246,0.3);"></div>',
              iconSize: [16, 16],
              iconAnchor: [8, 8],
              className: ''
            });
          }

          function fetchRoute(fromLat, fromLng, toLat, toLng) {
            var url = 'https://router.project-osrm.org/route/v1/driving/'
              + fromLng + ',' + fromLat + ';' + toLng + ',' + toLat
              + '?geometries=geojson&overview=full';
            fetch(url)
              .then(function(r) { return r.json(); })
              .then(function(data) {
                if (data.code !== 'Ok' || !data.routes || !data.routes[0]) return;
                var route = data.routes[0];
                var coords = route.geometry.coordinates.map(function(c) { return [c[1], c[0]]; });
                if (window.__state.routeLine) {
                  window.__state.routeLine.setLatLngs(coords);
                } else {
                  window.__state.routeLine = L.polyline(coords, {
                    color: '#F59E0B', weight: 4, opacity: 0.8,
                  }).addTo(window.__state.map);
                }
              })
              .catch(function() {});
          }

          // ─── Store state ──────────────────────────────────
          window.__state = {
            map: map,
            riderMarker: null,
            destMarker: null,
            routeLine: null,
            riderName: '',
            destLat: null,
            destLng: null,
            destAddress: '',
            isInitialized: false,
            hasRider: false,
            hasDestination: false,
          };

          // ─── Initialize rider ────────────────────────────
          window.__initRider = function(lat, lng, name) {
            if (!window.__state.map) return;
            
            window.__state.riderName = name || 'Rider';
            window.__state.hasRider = true;
            
            if (window.__state.riderMarker) {
              window.__state.riderMarker.setLatLng([lat, lng]);
            } else {
              window.__state.riderMarker = L.marker([lat, lng], { icon: makeRiderIcon() }).addTo(window.__state.map)
                .bindPopup('<b>' + window.__state.riderName + '</b>');
            }
            
            if (window.__state.hasDestination && window.__state.destLat && window.__state.destLng) {
              window.__updateRoute(lat, lng, window.__state.destLat, window.__state.destLng);
            }
            
            window.__state.isInitialized = true;
          };

          // ─── Initialize destination ──────────────────────
          window.__initDestination = function(lat, lng, address) {
            if (!window.__state.map) return;
            
            window.__state.destLat = lat;
            window.__state.destLng = lng;
            window.__state.destAddress = address || '';
            window.__state.hasDestination = true;
            
            if (window.__state.destMarker) {
              window.__state.destMarker.setLatLng([lat, lng]);
              window.__state.destMarker.setPopupContent('<b>Delivery</b><br>' + (address || ''));
            } else {
              window.__state.destMarker = L.marker([lat, lng], { icon: makeDestIcon() }).addTo(window.__state.map)
                .bindPopup('<b>Delivery</b><br>' + (address || ''));
            }
            
            if (window.__state.hasRider && window.__state.riderMarker) {
              var pos = window.__state.riderMarker.getLatLng();
              window.__updateRoute(pos.lat, pos.lng, lat, lng);
            }
          };

          // ─── Update route ────────────────────────────────
          window.__updateRoute = function(fromLat, fromLng, toLat, toLng) {
            if (!window.__state.map) return;
            
            if (window.__state.routeLine) {
              window.__state.routeLine.setLatLngs([[fromLat, fromLng], [toLat, toLng]]);
            } else {
              window.__state.routeLine = L.polyline([[fromLat, fromLng], [toLat, toLng]], {
                color: '#F59E0B', weight: 4, opacity: 0.8,
              }).addTo(window.__state.map);
            }
            
            fetchRoute(fromLat, fromLng, toLat, toLng);
          };

          // ─── Update rider position ───────────────────────
          window.__updateRider = function(lat, lng) {
            if (!window.__state.map) return;
            
            if (window.__state.riderMarker) {
              window.__state.riderMarker.setLatLng([lat, lng]);
            } else {
              window.__state.riderMarker = L.marker([lat, lng], { icon: makeRiderIcon() }).addTo(window.__state.map)
                .bindPopup('<b>' + window.__state.riderName + '</b>');
              window.__state.hasRider = true;
            }
            
            if (window.__state.hasDestination && window.__state.destLat && window.__state.destLng) {
              window.__updateRoute(lat, lng, window.__state.destLat, window.__state.destLng);
            }
          };

          // ─── Update destination ──────────────────────────
          window.__updateDestination = function(lat, lng, address) {
            if (!window.__state.map) return;
            
            window.__state.destLat = lat;
            window.__state.destLng = lng;
            window.__state.destAddress = address || '';
            window.__state.hasDestination = true;
            
            if (window.__state.destMarker) {
              window.__state.destMarker.setLatLng([lat, lng]);
              window.__state.destMarker.setPopupContent('<b>Delivery</b><br>' + (address || ''));
            } else {
              window.__state.destMarker = L.marker([lat, lng], { icon: makeDestIcon() }).addTo(window.__state.map)
                .bindPopup('<b>Delivery</b><br>' + (address || ''));
            }
            
            if (window.__state.hasRider && window.__state.riderMarker) {
              var pos = window.__state.riderMarker.getLatLng();
              window.__updateRoute(pos.lat, pos.lng, lat, lng);
            }
          };

          // ─── Fit bounds to show all markers ──────────────
          window.__fitBounds = function() {
            if (!window.__state.map) return;
            var bounds = [];
            
            if (window.__state.riderMarker) {
              var pos = window.__state.riderMarker.getLatLng();
              bounds.push([pos.lat, pos.lng]);
            }
            
            if (window.__state.destMarker) {
              var pos = window.__state.destMarker.getLatLng();
              bounds.push([pos.lat, pos.lng]);
            }
            
            if (bounds.length > 0) {
              window.__state.map.fitBounds(bounds, { padding: [60, 60], maxZoom: 18 });
            }
          };

          // ─── Persist view state ──────────────────────────
          map.on('moveend', function() {
            try {
              var c = map.getCenter();
              sessionStorage.setItem('trackerView', JSON.stringify({ lat: c.lat, lng: c.lng, zoom: map.getZoom() }));
            } catch(e) {}
          });

          var savedView = null;
          try {
            var raw = sessionStorage.getItem('trackerView');
            if (raw) savedView = JSON.parse(raw);
          } catch(e) {}

          if (savedView && savedView.lat != null && savedView.lng != null && savedView.zoom != null) {
            map.setView([savedView.lat, savedView.lng], savedView.zoom, { animate: false });
          }

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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [rider, setRider] = useState<RiderInfo | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [destLat, setDestLat] = useState<number | null>(null);
  const [destLng, setDestLng] = useState<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const noId = !id;

  const mapHtmlRef = useRef<string>(GENERATE_MAP_HTML());

  const prevLatLngRef = useRef<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const prevDestRef = useRef<{ lat: number | null; lng: number | null; address: string }>({ 
    lat: null, lng: null, address: '' 
  });

  const fetchTracking = async () => {
    if (!id) return;
    try {
      const [trackRes, orderRes] = await Promise.all([
        api.get(`/customer/orders/${id}/track`),
        api.get(`/customer/orders/${id}`),
      ]);
      const riderData = trackRes.data.rider;
      setRider(riderData);

      const lat = toLat(trackRes.data.latitude);
      const lng = toLng(trackRes.data.longitude);
      
      if (Math.abs((lat || 0) - (latitude || 0)) > 0.000001 || Math.abs((lng || 0) - (longitude || 0)) > 0.000001) {
        setLatitude(lat);
        setLongitude(lng);
      }
      
      setUpdatedAt(trackRes.data.updated_at);

      const newAddress = orderRes.data.delivery_address || '';
      const newDestLat = toLat(orderRes.data.delivery_latitude);
      const newDestLng = toLng(orderRes.data.delivery_longitude);
      
      if (newAddress !== deliveryAddress) {
        setDeliveryAddress(newAddress);
      }
      
      if (newDestLat !== destLat || newDestLng !== destLng) {
        setDestLat(newDestLat);
        setDestLng(newDestLng);
      }
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setError('No rider assigned yet');
      } else {
        setError('Unable to load tracking');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    fetchTracking();
    intervalRef.current = setInterval(fetchTracking, 3000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        fetchTracking();
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(fetchTracking, 3000);
      } else {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    });
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, [id]);

  useEffect(() => {
    if (!mapReady || !webViewRef.current) return;
    
    if (latitude && longitude && rider) {
      const js = `
        if (window.__initRider) {
          window.__initRider(${latitude}, ${longitude}, '${rider.name || 'Rider'}');
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
      prevLatLngRef.current = { lat: latitude, lng: longitude };
    }
    
    if (destLat && destLng) {
      const js = `
        if (window.__initDestination) {
          window.__initDestination(${destLat}, ${destLng}, '${deliveryAddress.replace(/'/g, "\\'")}');
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
      prevDestRef.current = { lat: destLat, lng: destLng, address: deliveryAddress };
    }
    
    setTimeout(() => {
      webViewRef.current?.injectJavaScript('if (window.__fitBounds) { window.__fitBounds(); } true;');
    }, 500);
    
  }, [mapReady]);

  useEffect(() => {
    if (!mapReady || !webViewRef.current) return;
    if (latitude && longitude) {
      const lat = Number(latitude);
      const lng = Number(longitude);
      
      const prev = prevLatLngRef.current;
      if (Math.abs((prev.lat || 0) - lat) > 0.000001 || Math.abs((prev.lng || 0) - lng) > 0.000001) {
        const js = `
          if (window.__updateRider) {
            window.__updateRider(${lat}, ${lng});
          }
          true;
        `;
        webViewRef.current.injectJavaScript(js);
        prevLatLngRef.current = { lat, lng };
      }
    }
  }, [latitude, longitude, mapReady]);

  useEffect(() => {
    if (!mapReady || !webViewRef.current) return;
    if (destLat && destLng) {
      const prev = prevDestRef.current;
      if (prev.lat !== destLat || prev.lng !== destLng || prev.address !== deliveryAddress) {
        const js = `
          if (window.__updateDestination) {
            window.__updateDestination(${destLat}, ${destLng}, '${deliveryAddress.replace(/'/g, "\\'")}');
          }
          true;
        `;
        webViewRef.current.injectJavaScript(js);
        prevDestRef.current = { lat: destLat, lng: destLng, address: deliveryAddress };
      }
    }
  }, [destLat, destLng, deliveryAddress, mapReady]);

  const openDirections = () => {
    if (!latitude || !longitude) return;
    const latLng = `${latitude},${longitude}`;
    const googleMapsAppUrl = `comgooglemaps://?daddr=${latLng}&directionsmode=driving`;
    const googleMapsWebUrl = `https://www.google.com/maps/dir/?api=1&destination=${latLng}&travelmode=driving`;
    const appleMapsUrl = `maps:${latLng}?q=${latLng}`;

    Linking.openURL(googleMapsAppUrl).catch(() => {
      const fallback = Platform.OS === 'ios' ? appleMapsUrl : googleMapsWebUrl;
      Linking.openURL(fallback).catch(() => {
        Alert.alert('Rider Location', latLng);
      });
    });
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const hasLocation = latitude !== null && longitude !== null;

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

      {/* Combined header */}
      <View className="bg-white px-4 pb-3 border-b border-gray-100">
        {/* Top row: back + title + live dot */}
        <View className="flex-row items-center justify-between pt-1">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
              <Ionicons name="arrow-back" size={24} color="#1F2937" />
            </TouchableOpacity>
            <View>
              <Text className="text-lg font-bold text-gray-900">Track Your Order</Text>
              <Text className="text-xs text-gray-500">
                {hasLocation ? formatTime(updatedAt) : 'Waiting...'}
              </Text>
            </View>
          </View>
          {hasLocation ? (
            <View className="flex-row items-center gap-1">
              <View className="w-2 h-2 rounded-full bg-yellow-400" />
              <Text className="text-yellow-600 text-xs font-medium">Live</Text>
            </View>
          ) : null}
        </View>

        {/* Rider info card */}
        {rider ? (
          <View className="flex-row items-center mt-3 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200">
            <View className="w-9 h-9 rounded-full bg-yellow-50 items-center justify-center border border-yellow-200">
              <Ionicons name="person" size={18} color="#F59E0B" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-gray-900 font-semibold text-sm">{rider.name}</Text>
              <Text className="text-yellow-600 text-xs">
                {hasLocation ? 'Moving' : 'Waiting for location'}
              </Text>
            </View>
            {rider.phone ? (
              <TouchableOpacity className="bg-gray-100 p-2 rounded-full" onPress={() => Linking.openURL(`tel:${rider.phone}`)}>
                <Ionicons name="call" size={16} color="#F59E0B" />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>

      <View className="flex-1">
        {!mapLoaded ? (
          <View className="flex-1 items-center justify-center bg-gray-50">
            <ActivityIndicator size="large" color="#F59E0B" />
            <Text className="text-gray-500 mt-3 text-sm">Loading map...</Text>
          </View>
        ) : null}

        <WebView
          ref={webViewRef}
          style={{
            flex: 1,
            backgroundColor: '#f3f4f6',
            opacity: mapLoaded ? 1 : 0,
          }}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="always"
          source={{ html: mapHtmlRef.current }}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          onLoadEnd={() => {
            if (!mapLoaded) setMapLoaded(true);
            setTimeout(() => {
              webViewRef.current?.injectJavaScript('if(window.__map){window.__map.invalidateSize()}true;');
              setMapReady(true);
            }, 500);
          }}
        />

        {!hasLocation && mapLoaded ? (
          <View className="absolute inset-0 bg-white/80 items-center justify-center">
            <ActivityIndicator size="large" color="#F59E0B" />
            <Text className="text-gray-900 mt-4 text-base font-semibold">Waiting for rider location...</Text>
            <Text className="text-gray-500 text-sm mt-1">Rider will appear on the map once location is available</Text>
          </View>
        ) : null}

        <View className="absolute bottom-6 left-4 right-4">
          {rider ? (
            <View className="bg-white/95 rounded-2xl p-4 mb-3 border border-gray-200 shadow-sm">
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-yellow-50 items-center justify-center border-2 border-yellow-200">
                  <Ionicons name="bicycle" size={20} color="#F59E0B" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-gray-500 text-xs">Your Rider</Text>
                  <Text className="text-gray-900 text-base font-bold">{rider.name}</Text>
                  <View className="flex-row items-center mt-0.5">
                    <View className="w-1.5 h-1.5 rounded-full bg-yellow-400 mr-1.5" />
                    <Text className="text-yellow-600 text-xs font-medium">
                      {hasLocation ? 'En route' : 'Waiting'}
                    </Text>
                    {hasLocation && updatedAt ? (
                      <>
                        <Text className="text-gray-400 text-xs mx-1">·</Text>
                        <Text className="text-gray-500 text-xs">{formatTime(updatedAt)}</Text>
                      </>
                    ) : null}
                  </View>
                </View>
                {rider.phone ? (
                  <TouchableOpacity className="bg-yellow-50 p-2.5 rounded-full border border-yellow-200" onPress={() => Linking.openURL(`tel:${rider.phone}`)}>
                    <Ionicons name="call" size={18} color="#F59E0B" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : null}

          {deliveryAddress ? (
            <View className="bg-white/95 rounded-2xl p-4 mb-3 border border-gray-200 shadow-sm">
              <View className="flex-row items-center">
                <View className="w-9 h-9 rounded-full bg-blue-50 items-center justify-center border border-blue-200">
                  <Ionicons name="location" size={18} color="#3B82F6" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-gray-500 text-xs">Delivery Address</Text>
                  <Text className="text-gray-900 text-sm font-medium" numberOfLines={2}>{deliveryAddress}</Text>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}