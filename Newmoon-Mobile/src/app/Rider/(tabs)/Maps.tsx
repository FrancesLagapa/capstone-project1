import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import api from '../../../../lib/api';
import * as Location from 'expo-location';

const { width, height } = Dimensions.get('window');

interface Branch {
  id: number;
  name: string;
  code: string;
  address: string;
  phone?: string;
  email?: string;
  latitude: number;
  longitude: number;
  is_active?: boolean;
}

interface DeliveryOrder {
  id: string;
  orderNumber: string;
  customer: string;
  address: string;
  items: string;
  total: string;
  status: 'Pending' | 'Preparing' | 'Ready' | 'Picked Up' | 'Out for Delivery' | 'Delivered';
  time: string;
  distance?: string;
  duration?: string;
  latitude: number;
  longitude: number;
  branchId?: number;
}

// MAP HTML - INITIAL LOAD WITH ROUTE MANAGEMENT FUNCTIONS
const GENERATE_MAP_HTML = (branches: Branch[], orders: DeliveryOrder[], riderLat?: number, riderLng?: number) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=2.0, user-scalable=yes">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; }
    html, body { 
      height: 100%; 
      width: 100%; 
      overflow: hidden;
      background: #f3f4f6;
    }
    #map { 
      height: 100%; 
      width: 100%;
      background: #f3f4f6;
    }
    .marker-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      color: white;
      font-weight: bold;
      font-size: 12px;
      border: 2px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    (function() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMap);
      } else {
        initMap();
      }

      function initMap() {
        try {
          var map = L.map('map', {
            zoomControl: true,
            attributionControl: true,
          }).setView([14.5600, 121.0200], 12);

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
          }).addTo(map);

          window.map = map;
          window.markers = [];
          window.routeLines = [];
          window.orderMarkers = {};
          window.branchMarkers = [];

          // ─── Icons ──────────────────────────────────────────
          var branchIcon = L.divIcon({
            html: '<div class="marker-icon" style="width:30px;height:30px;background:#F59E0B;font-size:13px;">B</div>',
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            className: ''
          });

          var pinSvg = function(color) {
            return '<svg viewBox="0 0 36 48" width="30" height="40"><path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 30 18 30s18-16.5 18-30C36 8.06 27.94 0 18 0z" fill="' + color + '" stroke="white" stroke-width="1.5"/><circle cx="18" cy="18" r="10" fill="white"/><path d="M18 10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 2c-2.67 0-8 1.34-8 4v1h16v-1c0-2.66-5.33-4-8-4z" fill="' + color + '" transform="translate(4,2)"/></svg>';
          };

          var orderIcons = {
            'Ready': L.divIcon({
              html: pinSvg('#7C3AED'),
              iconSize: [30, 40],
              iconAnchor: [15, 40],
              className: ''
            }),
            'Preparing': L.divIcon({
              html: pinSvg('#2563EB'),
              iconSize: [30, 40],
              iconAnchor: [15, 40],
              className: ''
            }),
            'Pending': L.divIcon({
              html: pinSvg('#D97706'),
              iconSize: [30, 40],
              iconAnchor: [15, 40],
              className: ''
            }),
            'Picked Up': L.divIcon({
              html: pinSvg('#059669'),
              iconSize: [30, 40],
              iconAnchor: [15, 40],
              className: ''
            }),
            'Out for Delivery': L.divIcon({
              html: pinSvg('#F97316'),
              iconSize: [30, 40],
              iconAnchor: [15, 40],
              className: ''
            }),
            'Delivered': L.divIcon({
              html: pinSvg('#10B981'),
              iconSize: [30, 40],
              iconAnchor: [15, 40],
              className: ''
            })
          };

          window.orderIcons = orderIcons;

          // ─── Rider Marker - BLUE ──────────────────────────
          var riderIcon = L.divIcon({
            html: '<div style="width:16px;height:16px;background:#3B82F6;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(59,130,246,0.3);"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
            className: ''
          });

          var riderLat = ${riderLat || 'null'};
          var riderLng = ${riderLng || 'null'};
          
          if (riderLat && riderLng) {
            window.__riderMarker = L.marker([riderLat, riderLng], { icon: riderIcon }).addTo(map)
              .bindPopup('You are here');
            window.__riderPos = { lat: riderLat, lng: riderLng };
          }

          // ─── Store Routes ──────────────────────────────────
          window.routeCache = {};
          window.routeColor = '#3B82F6';
          window.__routeGeneration = 0;

          // ─── Function to update/refresh routes ────────────
          window.__updateRoutes = function(ordersData, riderLat, riderLng) {
            // Increment generation — stale fetches will see this and bail
            var myGen = ++window.__routeGeneration;

            if (window.routeLines) {
              window.routeLines.forEach(function(layer) {
                if (window.map) window.map.removeLayer(layer);
              });
              window.routeLines = [];
            }

            if (!riderLat || !riderLng || !ordersData || ordersData.length === 0) return;

            var color = window.routeColor;
            var fetchPromises = [];

            ordersData.forEach(function(o) {
              if (!o.latitude || !o.longitude) return;
              var cacheKey = riderLat + ',' + riderLng + '|' + o.latitude + ',' + o.longitude;

              if (window.routeCache && window.routeCache[cacheKey]) {
                if (window.__routeGeneration !== myGen) return;
                var cached = window.routeCache[cacheKey];
                drawRoute(cached, color, o);
                return;
              }

              var url = 'https://router.project-osrm.org/route/v1/driving/'
                + riderLng + ',' + riderLat + ';'
                + o.longitude + ',' + o.latitude
                + '?geometries=geojson&overview=full&alternatives=false&steps=false';

              var promise = fetch(url)
                .then(function(r) { return r.json(); })
                .then(function(data) {
                  // Stale — a newer update already ran, discard this result
                  if (window.__routeGeneration !== myGen) return null;
                  if (data.code !== 'Ok' || !data.routes || !data.routes[0]) return null;
                  var route = data.routes[0];
                  var coords = route.geometry.coordinates.map(function(c) {
                    return [c[1], c[0]];
                  });
                  
                  if (window.routeCache) {
                    window.routeCache[cacheKey] = { coords: coords, route: route };
                  }
                  
                  drawRoute({ coords: coords, route: route }, color, o);
                  return { coords: coords, route: route };
                })
                .catch(function(err) {
                  console.log('Route fetch error:', err);
                  return null;
                });

              fetchPromises.push(promise);
            });

            Promise.all(fetchPromises).then(function() {
              // Don't force fit bounds - preserve user's view
            });
          };

          // ─── Helper to draw a single route ────────────────
          function drawRoute(routeData, color, order) {
            if (!routeData || !routeData.coords || routeData.coords.length < 2) return;
            if (!window.map) return;

            var coords = routeData.coords;
            var route = routeData.route;

            var line = L.polyline(coords, {
              color: color,
              weight: 5,
              opacity: 0.9,
            }).addTo(window.map);

            window.routeLines.push(line);
          }

          // ─── Function to update order markers ─────────────
          window.__updateOrderMarkers = function(ordersData) {
            if (window.orderMarkers) {
              Object.keys(window.orderMarkers).forEach(function(key) {
                if (window.map) window.map.removeLayer(window.orderMarkers[key]);
              });
              window.orderMarkers = {};
            }

            if (!ordersData || ordersData.length === 0) return;

            var orderIcons = window.orderIcons || {};
            
            ordersData.forEach(function(o) {
              if (!o.latitude || !o.longitude) return;
              var icon = orderIcons[o.status] || orderIcons['Pending'];
              var m = L.marker([o.latitude, o.longitude], { icon: icon }).addTo(window.map);
              m.bindPopup('<b>' + o.customer + '</b><br>' + o.address + '<br>' + o.items + '<br>' + o.total);
              window.orderMarkers[o.id] = m;
            });
          };

          // ─── Initial data load ────────────────────────────
          var initialOrders = ${JSON.stringify(orders)};
          var initialBranches = ${JSON.stringify(branches)};

          if (initialBranches && initialBranches.length > 0) {
            initialBranches.forEach(function(b) {
              if (b.latitude && b.longitude) {
                var m = L.marker([b.latitude, b.longitude], { icon: branchIcon }).addTo(map);
                m.bindPopup('<b>' + b.name + '</b><br>' + (b.address || ''));
                window.branchMarkers.push(m);
              }
            });
          }

          window.__updateOrderMarkers(initialOrders);

          var riderLat2 = ${riderLat || 'null'};
          var riderLng2 = ${riderLng || 'null'};
          if (riderLat2 && riderLng2) {
            window.__updateRoutes(initialOrders, riderLat2, riderLng2);
          }

          map.on('moveend', function() {
            try {
              var c = map.getCenter();
              sessionStorage.setItem('riderMapView', JSON.stringify({ lat: c.lat, lng: c.lng, zoom: map.getZoom() }));
            } catch(e) {}
          });

          var savedView = null;
          try {
            var raw = sessionStorage.getItem('riderMapView');
            if (raw) savedView = JSON.parse(raw);
          } catch(e) {}

          if (savedView && savedView.lat != null && savedView.lng != null && savedView.zoom != null) {
            map.setView([savedView.lat, savedView.lng], savedView.zoom, { animate: false });
          }

          window.__updateRiderPos = function(lat, lng) {
            if (window.__riderMarker) {
              window.__riderMarker.setLatLng([lat, lng]);
            }
            window.__riderPos = { lat: lat, lng: lng };
          };

          window.__updateOrders = function(newOrders) {
            window.__orders = newOrders;
            window.__updateOrderMarkers(newOrders);
            var riderPos = window.__riderPos || { lat: ${riderLat || 14.5600}, lng: ${riderLng || 121.0200} };
            window.__updateRoutes(newOrders, riderPos.lat, riderPos.lng);
          };

          setTimeout(function() {
            map.invalidateSize();
          }, 300);

          setTimeout(function() {
            map.invalidateSize();
          }, 600);

          console.log('Map initialized successfully');
        } catch (error) {
          console.error('Map init error:', error);
        }
      }
    })();
  </script>
</body>
</html>`;
};

const STATUS_COLORS: Record<string, string> = {
  Pending: '#D97706',
  Preparing: '#2563EB',
  Ready: '#7C3AED',
  'Picked Up': '#059669',
  'Out for Delivery': '#F97316',
  Delivered: '#10B981',
};

const STATUS_ICONS: Record<string, any> = {
  Pending: 'pending',
  Preparing: 'schedule',
  Ready: 'check-circle',
  'Picked Up': 'local-shipping',
  'Out for Delivery': 'directions-bike',
  Delivered: 'checkmark-circle',
};

export default function RiderMapScreen() {
  const webViewRef = useRef<WebView>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [riderLocation, setRiderLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapHtml, setMapHtml] = useState('');
  const [mapError, setMapError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);

  const STATUS_MAP: Record<string, DeliveryOrder['status']> = {
    pending: 'Pending',
    accepted: 'Preparing',
    preparing: 'Preparing',
    ready: 'Ready',
    picked_up: 'Picked Up',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    cancelled: 'Delivered',
  };

  const mapReadyRef = useRef(false);
  const prevOrdersRef = useRef<string>('');

  useEffect(() => {
    loadBranches();
    loadOrders();
    const interval = setInterval(loadOrders, 1000);
    return () => clearInterval(interval);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [])
  );

  const loadOrders = async () => {
    try {
      const res = await api.get('/rider/orders?per_page=50');
      const raw = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
      const key = raw.map((o: any) => o.id + '-' + (o.status || '') + '-' + (o.customer_latitude || '') + '-' + (o.customer_longitude || '')).join('|');
      
      if (key === prevOrdersRef.current) return;
      prevOrdersRef.current = key;
      
      const mapped: DeliveryOrder[] = raw.map((o: any) => ({
        id: String(o.id),
        orderNumber: o.order_number,
        customer: o.customer_name,
        address: o.customer_address,
        items: Array.isArray(o.items) ? o.items.map((i: any) => `${i.quantity}x ${i.name}`).join(', ') : '',
        total: `₱${Number(o.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        status: STATUS_MAP[o.status] || 'Pending',
        time: o.created_at,
        latitude: o.customer_latitude || 0,
        longitude: o.customer_longitude || 0,
        branchId: o.branch_id,
      }));
      
      setOrders(mapped);
      
      if (isMapReady && webViewRef.current) {
        const activeOrders = mapped.filter(o => o.status === 'Picked Up' || o.status === 'Out for Delivery');
        const js = `
          if (window.__updateOrders) {
            window.__updateOrders(${JSON.stringify(activeOrders)});
          }
          true;
        `;
        webViewRef.current.injectJavaScript(js);
      }
    } catch (err) {
      console.log('Failed to load orders:', err);
    }
  };

  // ─── GPS Tracking ─────────────────────────────────────────
  useEffect(() => {
    let watchSub: { remove: () => void } | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      watchSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 5 },
        (loc) => {
          const { latitude, longitude } = loc.coords;
          setRiderLocation({ lat: latitude, lng: longitude });
        }
      );
    })();
    return () => { watchSub?.remove(); };
  }, []);

  // ─── Send rider location to backend every 3s ────────────
  const riderLocationRef = useRef(riderLocation);
  const ordersRef = useRef(orders);
  riderLocationRef.current = riderLocation;
  ordersRef.current = orders;

  useEffect(() => {
    const interval = setInterval(async () => {
      let loc = riderLocationRef.current;
      const ords = ordersRef.current;

      if (!loc) {
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === 'granted') {
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setRiderLocation(loc);
          }
        } catch {}
      }

      if (!loc) return;

      const active = ords.filter((o) => o.status === 'Picked Up' || o.status === 'Out for Delivery');
      for (const order of active) {
        try {
          await api.post(`/rider/orders/${order.id}/location`, {
            latitude: loc.lat,
            longitude: loc.lng,
          });
        } catch {}
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadBranches = async () => {
    try {
      setIsRefreshing(true);
      const response = await api.get('/branches');
      const data = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      setBranches(data.length > 0 ? data : [
        { id: 1, name: 'Main Branch', code: 'MB', address: 'Metro Manila', latitude: 14.5600, longitude: 121.0200 }
      ]);
    } catch (error) {
      console.log('Failed to load branches:', error);
      setBranches([
        { id: 1, name: 'Main Branch', code: 'MB', address: 'Metro Manila', latitude: 14.5600, longitude: 121.0200 }
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const mapOrders = orders.filter(o => o.status === 'Picked Up' || o.status === 'Out for Delivery');

  // Generate map HTML only once (or when branches change significantly)
  useEffect(() => {
    if (branches.length > 0) {
      const html = GENERATE_MAP_HTML(branches, mapOrders, riderLocation?.lat, riderLocation?.lng);
      setMapHtml(html);
      setLoading(false);
    }
  }, [branches]);

  // Smooth rider marker movement + refresh routes from new position (debounced)
  const routeUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (routeUpdateTimerRef.current) clearTimeout(routeUpdateTimerRef.current); };
  }, []);
  useEffect(() => {
    if (!isMapReady || !riderLocation || !webViewRef.current) return;
    const js = `
      if (window.__updateRiderPos) {
        window.__updateRiderPos(${riderLocation.lat}, ${riderLocation.lng});
      }
      true;
    `;
    webViewRef.current.injectJavaScript(js);

    // Debounce route refresh from rider movement (3s)
    if (routeUpdateTimerRef.current) clearTimeout(routeUpdateTimerRef.current);
    routeUpdateTimerRef.current = setTimeout(() => {
      const activeOrders = orders.filter(o => o.status === 'Picked Up' || o.status === 'Out for Delivery');
      if (activeOrders.length > 0 && webViewRef.current) {
        const js2 = `
          if (window.__updateOrders) {
            window.__updateOrders(${JSON.stringify(activeOrders)});
          }
          true;
        `;
        webViewRef.current.injectJavaScript(js2);
      }
    }, 3000);
  }, [riderLocation, isMapReady]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'navigate' && msg.lat && msg.lng) {
        openDirections(msg.lat, msg.lng, msg.label || '');
      } else if (msg.type === 'select') {
        setSelectedId(String(msg.id));
      }
    } catch (err) {
      console.log('[Map] Message error:', err);
    }
  }, []);

  const openDirections = (lat: number, lng: number, label: string) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Open Maps', `Navigate to: ${label}\n${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    });
  };

  const focusItem = (lat: number, lng: number, id: string) => {
    setSelectedId(id);
    const js = `
      if (window.map) {
        window.map.setView([${lat}, ${lng}], 16, { animate: true });
        if (window.orderMarkers && window.orderMarkers['${id}']) {
          window.orderMarkers['${id}'].openPopup();
        }
      }
      true;
    `;
    webViewRef.current?.injectJavaScript(js);
  };

  const resetView = () => {
    setSelectedId(null);
    const js = `
      if (window.map && window.__riderPos) {
        var pos = window.__riderPos;
        window.map.setView([pos.lat, pos.lng], 14, { animate: true });
      }
      true;
    `;
    webViewRef.current?.injectJavaScript(js);
  };

  const toPickup = orders.filter(o => ['Ready', 'Preparing', 'Picked Up'].includes(o.status));
  const toDeliver = orders.filter(o => ['Ready', 'Picked Up', 'Out for Delivery'].includes(o.status));
  const displayedOrders = orders.filter(o =>
    ['Ready', 'Preparing', 'Picked Up', 'Out for Delivery'].includes(o.status)
  );

  const getStatusBadge = (order: DeliveryOrder) => {
    const color = STATUS_COLORS[order.status] || '#9CA3AF';
    return (
      <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: color + '20' }}>
        <Text className="text-xs font-semibold" style={{ color, fontSize: 10 }}>{order.status}</Text>
      </View>
    );
  };

  if (mapError) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <StatusBar barStyle="dark-content" backgroundColor="#FBBF24" />
        <View className="bg-white px-4 py-3 border-b border-gray-100">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="mr-3 p-2">
              <Ionicons name="arrow-back" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text className="text-lg font-bold text-gray-900">Delivery Map</Text>
          </View>
        </View>
        <View className="flex-1 items-center justify-center bg-gray-50 p-6">
          <Ionicons name="map-outline" size={64} color="#D1D5DB" />
          <Text className="text-gray-700 text-lg mt-4 font-bold">Map unavailable</Text>
          <Text className="text-gray-500 text-sm mt-2 text-center">Unable to load the map. Please check your internet connection.</Text>
          <TouchableOpacity 
            className="mt-6 bg-yellow-400 px-8 py-4 rounded-xl"
            onPress={() => {
              setMapError(false);
              setLoading(true);
              const html = GENERATE_MAP_HTML(branches, mapOrders, riderLocation?.lat, riderLocation?.lng);
              setMapHtml(html);
              setLoading(false);
            }}
          >
            <Text className="text-yellow-900 font-bold text-base">Retry</Text>
          </TouchableOpacity>
        </View>
        <View className="bg-white border-t border-gray-100 py-3">
          <Text className="text-gray-400 text-xs text-center">Home · Orders · Map · History · Earnings · Profile</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="#FBBF24" />
      
      {/* Header */}
      <View className="bg-white px-3 pb-3 border-b border-gray-100">
        <View className="h-10" />
        
        <View className="flex-row items-center">
          <TouchableOpacity 
            onPress={() => router.back()} 
            className="p-2 active:opacity-70"
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          
          <View className="flex-shrink mx-2">
            <Text className="text-base font-bold text-gray-900" numberOfLines={1}>Delivery Map</Text>
            <Text className="text-[10px] text-gray-500" numberOfLines={1}>
              {toDeliver.length} ready · {toPickup.length - toDeliver.length} preparing
            </Text>
          </View>
          
          <View className="flex-row items-center gap-1 ml-auto">
            <TouchableOpacity 
              onPress={resetView} 
              className="bg-gray-100 p-2 rounded-xl active:opacity-70"
              activeOpacity={0.7}
            >
              <Ionicons name="locate-outline" size={18} color="#3B82F6" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={loadBranches} 
              className="bg-gray-100 p-2 rounded-xl active:opacity-70"
              activeOpacity={0.7}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <ActivityIndicator size={18} color="#F59E0B" />
              ) : (
                <Ionicons name="refresh" size={18} color="#F59E0B" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Map */}
      <View className="flex-1">
        {loading ? (
          <View className="flex-1 items-center justify-center bg-gray-50">
            <ActivityIndicator size="large" color="#F59E0B" />
            <Text className="text-gray-500 mt-3 text-sm">Loading map...</Text>
          </View>
        ) : mapHtml ? (
          <WebView
            ref={webViewRef}
            style={{ 
              flex: 1, 
              backgroundColor: '#f3f4f6',
            }}
            originWhitelist={['*']}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            mixedContentMode="always"
            source={{ html: mapHtml }}
            onMessage={handleMessage}
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            onLoadEnd={() => {
              mapReadyRef.current = true;
              setIsMapReady(true);
              if (riderLocation) {
                const js = `
                  if (window.__updateRiderPos) {
                    window.__updateRiderPos(${riderLocation.lat}, ${riderLocation.lng});
                  }
                  true;
                `;
                webViewRef.current?.injectJavaScript(js);
              }
              setTimeout(() => {
                webViewRef.current?.injectJavaScript(`
                  if (window.map) {
                    window.map.invalidateSize();
                  }
                  true;
                `);
              }, 500);
            }}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.log('WebView error:', nativeEvent);
              setMapError(true);
            }}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.log('HTTP error:', nativeEvent);
              setMapError(true);
            }}
          />
        ) : (
          <View className="flex-1 items-center justify-center bg-gray-50">
            <Ionicons name="map-outline" size={64} color="#D1D5DB" />
            <Text className="text-gray-500 mt-3 text-sm">No map data</Text>
          </View>
        )}
      </View>

      {/* Bottom delivery list */}
      <View className="bg-white border-t border-gray-100" style={{ maxHeight: 260 }}>
        <View className="px-4 py-3 border-b border-gray-100 flex-row justify-between items-center">
          <Text className="text-gray-900 font-bold text-sm">Active Deliveries</Text>
          <View className="bg-gray-100 px-3 py-1 rounded-full">
            <Text className="text-gray-600 text-xs font-medium">{displayedOrders.length} orders</Text>
          </View>
        </View>

        <ScrollView 
          className="flex-1 px-4 pt-2" 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 8 }}
        >
          {displayedOrders.length === 0 ? (
            <View className="items-center py-8">
              <Ionicons name="checkmark-circle-outline" size={40} color="#D1D5DB" />
              <Text className="text-gray-500 text-sm mt-2 font-medium">No active deliveries</Text>
              <Text className="text-gray-400 text-xs mt-1">All caught up!</Text>
            </View>
          ) : (
            displayedOrders.map((order) => {
              const isSelected = selectedId === order.id;
              return (
                <TouchableOpacity
                  key={order.id}
                  className={`flex-row items-center py-3 border-b border-gray-100 ${
                    isSelected ? 'bg-yellow-50 -mx-2 px-2 rounded-xl' : ''
                  } active:opacity-70`}
                  activeOpacity={0.7}
                  onPress={() => focusItem(order.latitude, order.longitude, order.id)}
                >
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: (STATUS_COLORS[order.status] || '#9CA3AF') + '15' }}
                  >
                    <MaterialIcons
                      name={STATUS_ICONS[order.status] || 'pending'}
                      size={20}
                      color={STATUS_COLORS[order.status] || '#9CA3AF'}
                    />
                  </View>

                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-sm font-bold text-gray-900">{order.customer}</Text>
                      {getStatusBadge(order)}
                    </View>
                    <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>{order.address}</Text>
                    <View className="flex-row items-center mt-1 gap-2">
                      <Text className="text-xs text-gray-400">{order.distance}</Text>
                      <Text className="text-xs text-gray-400">{order.duration}</Text>
                      {order.items && (
                        <>
                          <Text className="text-xs text-gray-300">|</Text>
                          <Text className="text-xs text-gray-400" numberOfLines={1}>{order.items}</Text>
                        </>
                      )}
                    </View>
                  </View>

                  <View className="items-end ml-2">
                    <Text className="text-sm font-bold text-gray-900">{order.total}</Text>
                    <TouchableOpacity
                      className="mt-1.5 bg-yellow-50 px-3 py-1.5 rounded-full border border-yellow-200 active:opacity-70"
                      onPress={() => openDirections(order.latitude, order.longitude, order.customer)}
                      activeOpacity={0.7}
                    >
                      <View className="flex-row items-center">
                        <Ionicons name="navigate" size={12} color="#3B82F6" />
                        <Text className="text-xs font-semibold text-blue-500 ml-1">Go</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}