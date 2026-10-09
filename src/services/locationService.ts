import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  DEFAULT_TRANSMIT_INTERVAL_MS,
  LOCATION_TASK_NAME,
  STORAGE_KEYS,
} from '@/config/constants';
import {
  registrarPingApi,
  finalizarViagemApi,
  TelemetriaPingPayload,
  ViagemResponse,
} from '@/api/tracking';

export interface TrackingStatus {
  isTracking: boolean;
  activeTrip: ViagemResponse | null;
  lastTransmissionTime: string | null;
  gpsAccuracy: number | null;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  queuedCount: number;
  totalTransmissions: number;
  lastError: string | null;
}

type StatusListener = (status: TrackingStatus) => void;

class LocationTrackingService {
  private trackingInterval: ReturnType<typeof setInterval> | null = null;
  private locationSubscription: Location.LocationSubscription | null = null;
  private activeTrip: ViagemResponse | null = null;
  private listeners: Set<StatusListener> = new Set();

  private status: TrackingStatus = {
    isTracking: false,
    activeTrip: null,
    lastTransmissionTime: null,
    gpsAccuracy: null,
    latitude: null,
    longitude: null,
    speed: null,
    queuedCount: 0,
    totalTransmissions: 0,
    lastError: null,
  };

  constructor() {
    this.restoreSavedTrip();
  }

  public subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener({ ...this.status }));
  }

  public getStatus(): TrackingStatus {
    return { ...this.status };
  }

  /**
   * Check and restore active trip from AsyncStorage on app boot
   */
  public async restoreSavedTrip(): Promise<ViagemResponse | null> {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_TRIP);
      if (saved) {
        const trip: ViagemResponse = JSON.parse(saved);
        if (trip.id && trip.id > 0) {
          this.activeTrip = trip;
          this.status.activeTrip = trip;
          await this.updateQueueCount();
          this.notify();
          return trip;
        } else {
          // Clean up invalid legacy sessions with id 0
          await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_TRIP);
          await AsyncStorage.removeItem(STORAGE_KEYS.OFFLINE_COORDINATES_QUEUE);
          this.activeTrip = null;
          this.status.activeTrip = null;
          this.status.isTracking = false;
          this.status.queuedCount = 0;
          this.notify();
        }
      }
    } catch {
      // Storage error
    }
    return null;
  }

  /**
   * Request foreground and background location permissions
   */
  public async requestPermissions(): Promise<{
    foreground: boolean;
    background: boolean;
  }> {
    const fg = await Location.requestForegroundPermissionsAsync();
    let bgGranted = false;

    if (fg.status === Location.PermissionStatus.GRANTED && Platform.OS !== 'web') {
      try {
        const bg = await Location.requestBackgroundPermissionsAsync();
        bgGranted = bg.status === Location.PermissionStatus.GRANTED;
      } catch {
        bgGranted = false;
      }
    }

    return {
      foreground: fg.status === Location.PermissionStatus.GRANTED,
      background: bgGranted,
    };
  }

  /**
   * Start tracking an active trip
   */
  public async startTrip(trip: ViagemResponse): Promise<void> {
    const { foreground } = await this.requestPermissions();
    if (!foreground) {
      throw new Error(
        'Permissão de localização negada. O aplicativo necessita de acesso ao GPS para rastrear a viagem.'
      );
    }

    this.activeTrip = trip;
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_TRIP, JSON.stringify(trip));

    this.status = {
      ...this.status,
      isTracking: true,
      activeTrip: trip,
      lastError: null,
    };
    this.notify();

    // 1. Keep awake
    try {
      await activateKeepAwakeAsync('citmobi-trip');
    } catch {
      // Non-fatal if keep-awake is not supported on web
    }

    // 2. Transmit initial coordinate immediately
    await this.captureAndTransmit(trip);

    // 3. Register background updates if supported
    await this.registerBackgroundLocationWatcher();

    // 4. Start periodic transmission loop (every 60 seconds)
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
    }

    this.trackingInterval = setInterval(() => {
      if (this.activeTrip) {
        this.captureAndTransmit(this.activeTrip);
      }
    }, DEFAULT_TRANSMIT_INTERVAL_MS);
  }

  /**
   * Capture current device location and transmit ping
   */
  private async captureAndTransmit(trip: ViagemResponse): Promise<void> {
    try {
      // Attempt to flush offline queue first
      await this.flushOfflineQueue();

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude, speed, heading, accuracy } = loc.coords;

      if (!trip.id || trip.id <= 0) {
        this.status.lastError = 'Aguardando validação da viagem pelo servidor';
        return;
      }

      // Sanitize coordinates to PostgreSQL DECIMAL(8,6) and DECIMAL(9,6) limits
      const sanitizedLat = Number(latitude.toFixed(6));
      const sanitizedLng = Number(longitude.toFixed(6));
      const sanitizedSpeed = Number(Math.max(0, speed ?? 0).toFixed(2));
      const sanitizedBearing = Number(Math.max(0, heading ?? 0).toFixed(2));

      const payload: TelemetriaPingPayload = {
        viagemId: trip.id,
        latitude: sanitizedLat,
        longitude: sanitizedLng,
        velocidade: sanitizedSpeed,
        bearing: sanitizedBearing,
        odometer: 0,
      };

      try {
        await registrarPingApi(payload);
        const now = new Date();
        let timeStr: string;
        try {
          timeStr = now.toLocaleTimeString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          });
        } catch {
          const pad = (n: number) => String(n).padStart(2, '0');
          timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        }

        this.status = {
          ...this.status,
          lastTransmissionTime: timeStr,
          gpsAccuracy: accuracy ? Math.round(accuracy) : null,
          latitude,
          longitude,
          speed: speed ? Math.round(speed * 3.6) : 0, // convert m/s to km/h
          totalTransmissions: this.status.totalTransmissions + 1,
          lastError: null,
        };
      } catch (err: any) {
        // Enqueue offline coordinate
        await this.enqueueCoordinate(payload);
        const serverMsg = err?.response?.data?.message || err?.message;
        this.status.lastError = serverMsg ? `Falha envio: ${serverMsg}` : 'Sem conexão: coordenada salva na fila offline';
      }
    } catch (locErr: any) {
      this.status.lastError = locErr?.message || 'Falha ao obter sinal de GPS';
    } finally {
      await this.updateQueueCount();
      this.notify();
    }
  }

  /**
   * Register background location updates using expo-task-manager and expo-location
   */
  private async registerBackgroundLocationWatcher() {
    if (Platform.OS === 'web') return;

    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (!isRegistered) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.High,
          timeInterval: DEFAULT_TRANSMIT_INTERVAL_MS,
          distanceInterval: 10,
          foregroundService: {
            notificationTitle: 'CitMobi Motorista em Viagem',
            notificationBody: 'Transmitindo localização operacional em tempo real.',
            notificationColor: '#00B4D8',
          },
        });
      }
    } catch {
      // Fallback: watchPositionAsync foreground
      try {
        if (!this.locationSubscription) {
          this.locationSubscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: DEFAULT_TRANSMIT_INTERVAL_MS,
              distanceInterval: 10,
            },
            (location) => {
              this.status.latitude = location.coords.latitude;
              this.status.longitude = location.coords.longitude;
              this.status.gpsAccuracy = location.coords.accuracy
                ? Math.round(location.coords.accuracy)
                : null;
              this.status.speed = location.coords.speed
                ? Math.round(location.coords.speed * 3.6)
                : 0;
              this.notify();
            }
          );
        }
      } catch {
        // Location watcher fallback failed
      }
    }
  }

  /**
   * Stop active trip tracking
   */
  public async stopTrip(tripId: number): Promise<ViagemResponse> {
    // 1. Clear interval
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }

    // 2. Unregister background & watchers
    if (Platform.OS !== 'web') {
      try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
        if (isRegistered) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        }
      } catch {
        // Ignore
      }
    }

    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }

    // 3. Deactivate KeepAwake
    try {
      deactivateKeepAwake('citmobi-trip');
    } catch {
      // Ignore
    }

    // 4. Try flushing offline queue before ending
    await this.flushOfflineQueue();

    // 5. Finalize trip on backend
    let finishedTrip: ViagemResponse;
    try {
      finishedTrip = await finalizarViagemApi(tripId);
    } catch {
      // Fallback object if backend error
      finishedTrip = {
        ...(this.activeTrip || ({} as ViagemResponse)),
        id: tripId,
        status: 'FINALIZADA',
      };
    }

    // 6. Reset state and storage
    this.activeTrip = null;
    await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_TRIP);
    await AsyncStorage.removeItem(STORAGE_KEYS.OFFLINE_COORDINATES_QUEUE);

    this.status = {
      isTracking: false,
      activeTrip: null,
      lastTransmissionTime: this.status.lastTransmissionTime,
      gpsAccuracy: null,
      latitude: null,
      longitude: null,
      speed: null,
      queuedCount: 0,
      totalTransmissions: this.status.totalTransmissions,
      lastError: null,
    };
    this.notify();

    return finishedTrip;
  }

  /**
   * Enqueue coordinate in offline storage queue
   */
  private async enqueueCoordinate(payload: TelemetriaPingPayload) {
    try {
      const queueRaw = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_COORDINATES_QUEUE);
      const queue: TelemetriaPingPayload[] = queueRaw ? JSON.parse(queueRaw) : [];
      queue.push(payload);
      // Limit queue to 100 items to avoid excessive storage growth
      if (queue.length > 100) {
        queue.shift();
      }
      await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_COORDINATES_QUEUE, JSON.stringify(queue));
    } catch {
      // Ignore
    }
  }

  /**
   * Flush pending offline coordinates to CitMobi2
   */
  public async flushOfflineQueue(): Promise<void> {
    try {
      const queueRaw = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_COORDINATES_QUEUE);
      if (!queueRaw) return;

      const queue: TelemetriaPingPayload[] = JSON.parse(queueRaw);
      if (queue.length === 0) return;

      const remaining: TelemetriaPingPayload[] = [];
      const validTripId = this.activeTrip?.id && this.activeTrip.id > 0 ? this.activeTrip.id : null;

      for (const item of queue) {
        const targetTripId = item.viagemId && item.viagemId > 0 ? item.viagemId : validTripId;
        if (!targetTripId || targetTripId <= 0) {
          // Discard legacy/corrupted coordinate that has no valid trip ID
          continue;
        }

        const payloadToSend = {
          ...item,
          viagemId: targetTripId,
        };

        try {
          await registrarPingApi(payloadToSend);
        } catch {
          remaining.push(payloadToSend);
        }
      }

      await AsyncStorage.setItem(
        STORAGE_KEYS.OFFLINE_COORDINATES_QUEUE,
        JSON.stringify(remaining)
      );
      this.status.queuedCount = remaining.length;
    } catch {
      // Ignore
    }
  }

  private async updateQueueCount() {
    try {
      const queueRaw = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_COORDINATES_QUEUE);
      const queue = queueRaw ? JSON.parse(queueRaw) : [];
      this.status.queuedCount = Array.isArray(queue) ? queue.length : 0;
    } catch {
      this.status.queuedCount = 0;
    }
  }
}

export const locationService = new LocationTrackingService();

// Define background task once at module level for Expo TaskManager
if (Platform.OS !== 'web') {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
    if (error) {
      return;
    }
    if (data) {
      const { locations } = data;
      if (Array.isArray(locations) && locations.length > 0) {
        const latest = locations[locations.length - 1];
        try {
          const tripRaw = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_TRIP);
          if (tripRaw) {
            const trip: ViagemResponse = JSON.parse(tripRaw);
            const payload: TelemetriaPingPayload = {
              viagemId: trip.id,
              latitude: Number(latest.coords.latitude.toFixed(6)),
              longitude: Number(latest.coords.longitude.toFixed(6)),
              velocidade: Number(Math.max(0, latest.coords.speed ?? 0).toFixed(2)),
              bearing: Number(Math.max(0, latest.coords.heading ?? 0).toFixed(2)),
              odometer: 0,
            };
            await registrarPingApi(payload);
          }
        } catch {
          // Task failure will be retried or caught on next foreground cycle
        }
      }
    }
  });
}
