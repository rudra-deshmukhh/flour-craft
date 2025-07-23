import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, interval } from 'rxjs';

import { AdminService, DeliveryPartner, Order } from '../../../services/admin.service';

// Google Maps types
declare var google: any;

interface PartnerMarker {
  partner: DeliveryPartner;
  marker: any;
  infoWindow: any;
  lastUpdate: Date;
}

@Component({
  selector: 'app-live-tracking',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatChipsModule,
    MatSlideToggleModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    FormsModule
  ],
  template: `
    <div class="live-tracking">
      <!-- Header -->
      <div class="tracking-header">
        <h2>Live Delivery Tracking</h2>
        <div class="header-controls">
          <mat-slide-toggle [(ngModel)]="autoRefresh" (change)="toggleAutoRefresh()">
            Auto Refresh
          </mat-slide-toggle>
          <button mat-raised-button color="primary" (click)="refreshTracking()">
            <mat-icon>refresh</mat-icon>
            Refresh
          </button>
        </div>
      </div>

      <div class="tracking-content">
        <!-- Partner List Sidebar -->
        <div class="partners-sidebar">
          <div class="sidebar-header">
            <h3>Delivery Partners ({{ activePartners.length }})</h3>
            
            <!-- Filters -->
            <div class="filters">
              <mat-form-field appearance="outline" class="filter-field">
                <mat-label>Status</mat-label>
                <mat-select [(ngModel)]="statusFilter" (selectionChange)="applyFilters()">
                  <mat-option value="all">All Partners</mat-option>
                  <mat-option value="available">Available</mat-option>
                  <mat-option value="busy">On Delivery</mat-option>
                  <mat-option value="offline">Offline</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
          </div>

          <!-- Partner Cards -->
          <div class="partners-list">
            <mat-card *ngFor="let partner of filteredPartners; trackBy: trackByPartner" 
                     class="partner-card"
                     [class.selected]="selectedPartnerId === partner.id"
                     [class.online]="partner.isAvailable"
                     [class.has-location]="partner.currentLocation"
                     (click)="selectPartner(partner)">
              
              <mat-card-content>
                <div class="partner-header">
                  <div class="partner-info">
                    <h4>{{ partner.name }}</h4>
                    <p>{{ partner.vehicleType }} - {{ partner.vehicleNumber }}</p>
                  </div>
                  
                  <div class="partner-status">
                    <mat-chip [color]="getPartnerStatusColor(partner)" selected>
                      <mat-icon>{{ getPartnerStatusIcon(partner) }}</mat-icon>
                      {{ getPartnerStatusText(partner) }}
                    </mat-chip>
                  </div>
                </div>

                <div class="partner-details">
                  <div class="detail-row" *ngIf="partner.currentLocation">
                    <mat-icon>location_on</mat-icon>
                    <span>Last seen: {{ getLastSeenText(partner.currentLocation.timestamp) }}</span>
                  </div>
                  
                  <div class="detail-row" *ngIf="!partner.currentLocation">
                    <mat-icon>location_off</mat-icon>
                    <span>Location unavailable</span>
                  </div>

                  <div class="detail-row">
                    <mat-icon>star</mat-icon>
                    <span>{{ partner.ratings.average.toFixed(1) }} ({{ partner.ratings.count }} reviews)</span>
                  </div>

                  <div class="detail-row">
                    <mat-icon>assignment</mat-icon>
                    <span>{{ partner.stats.completedDeliveries }} completed deliveries</span>
                  </div>
                </div>

                <!-- Active Orders -->
                <div class="active-orders" *ngIf="getPartnerActiveOrders(partner.id).length > 0">
                  <h5>Active Orders:</h5>
                  <div class="order-chip" *ngFor="let order of getPartnerActiveOrders(partner.id)">
                    <mat-chip color="accent" selected>
                      #{{ order.orderNumber }}
                    </mat-chip>
                  </div>
                </div>
              </mat-card-content>

              <mat-card-actions>
                <button mat-button (click)="focusOnPartner(partner); $event.stopPropagation()">
                  <mat-icon>zoom_in</mat-icon>
                  View on Map
                </button>
                <button mat-button (click)="showPartnerHistory(partner); $event.stopPropagation()">
                  <mat-icon>history</mat-icon>
                  History
                </button>
              </mat-card-actions>
            </mat-card>
          </div>
        </div>

        <!-- Map Container -->
        <div class="map-container">
          <div #mapElement class="google-map" id="tracking-map"></div>
          
          <div class="map-overlay" *ngIf="!mapLoaded">
            <mat-icon>map</mat-icon>
            <p>Loading map...</p>
          </div>

          <!-- Map Controls -->
          <div class="map-controls">
            <button mat-mini-fab color="primary" (click)="centerMapOnAll()" 
                   matTooltip="Fit all partners">
              <mat-icon>center_focus_strong</mat-icon>
            </button>
            
            <button mat-mini-fab color="accent" (click)="toggleTrafficLayer()" 
                   matTooltip="Toggle traffic">
              <mat-icon>traffic</mat-icon>
            </button>
            
            <button mat-mini-fab (click)="toggleMapType()" 
                   matTooltip="Toggle satellite view">
              <mat-icon>satellite</mat-icon>
            </button>
          </div>

          <!-- Legend -->
          <div class="map-legend">
            <h4>Legend</h4>
            <div class="legend-item">
              <div class="legend-marker available"></div>
              <span>Available</span>
            </div>
            <div class="legend-item">
              <div class="legend-marker busy"></div>
              <span>On Delivery</span>
            </div>
            <div class="legend-item">
              <div class="legend-marker offline"></div>
              <span>Offline</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Partner Details Panel -->
      <div class="partner-details-panel" *ngIf="selectedPartner">
        <mat-card>
          <mat-card-header>
            <mat-card-title>
              <div class="panel-header">
                <span>{{ selectedPartner.name }}</span>
                <button mat-icon-button (click)="closeDetailsPanel()">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            </mat-card-title>
          </mat-card-header>

          <mat-card-content>
            <div class="panel-content">
              <!-- Location Info -->
              <div class="info-section" *ngIf="selectedPartner.currentLocation">
                <h4>Current Location</h4>
                <div class="location-details">
                  <p><strong>Coordinates:</strong> {{ selectedPartner.currentLocation.latitude.toFixed(6) }}, {{ selectedPartner.currentLocation.longitude.toFixed(6) }}</p>
                  <p><strong>Last Update:</strong> {{ adminService.formatDateTime(selectedPartner.currentLocation.timestamp) }}</p>
                  <p><strong>Accuracy:</strong> {{ selectedPartner.currentLocation.accuracy || 'Unknown' }}m</p>
                </div>
              </div>

              <!-- Active Deliveries -->
              <div class="info-section">
                <h4>Active Deliveries</h4>
                <div class="delivery-list">
                  <div *ngFor="let order of getPartnerActiveOrders(selectedPartner.id)" class="delivery-item">
                    <div class="delivery-header">
                      <span><strong>#{{ order.orderNumber }}</strong></span>
                      <mat-chip [color]="adminService.getStatusColor(order.status)" selected>
                        {{ order.status }}
                      </mat-chip>
                    </div>
                    <p>{{ order.customerName }} • {{ adminService.formatCurrency(order.finalAmount) }}</p>
                    <p><small>{{ order.address.fullAddress }}</small></p>
                  </div>
                  
                  <div *ngIf="getPartnerActiveOrders(selectedPartner.id).length === 0" class="no-deliveries">
                    <mat-icon>assignment</mat-icon>
                    <p>No active deliveries</p>
                  </div>
                </div>
              </div>

              <!-- Performance Stats -->
              <div class="info-section">
                <h4>Performance</h4>
                <div class="stats-grid">
                  <div class="stat-item">
                    <span class="stat-label">Total Deliveries</span>
                    <span class="stat-value">{{ selectedPartner.stats.totalDeliveries }}</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">Completed</span>
                    <span class="stat-value">{{ selectedPartner.stats.completedDeliveries }}</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">On-Time Rate</span>
                    <span class="stat-value">{{ selectedPartner.stats.onTimeDeliveries }}%</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">Rating</span>
                    <span class="stat-value">{{ selectedPartner.ratings.average.toFixed(1) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styleUrls: ['./live-tracking.component.scss']
})
export class LiveTrackingComponent implements OnInit, OnDestroy {
  @ViewChild('mapElement', { static: true }) mapElement!: ElementRef;

  private destroy$ = new Subject<void>();
  
  map: any;
  mapLoaded = false;
  trafficLayer: any;
  isTrafficVisible = false;
  isSatelliteView = false;

  partners: DeliveryPartner[] = [];
  activePartners: DeliveryPartner[] = [];
  filteredPartners: DeliveryPartner[] = [];
  activeOrders: Order[] = [];
  
  partnerMarkers: Map<string, PartnerMarker> = new Map();
  selectedPartner: DeliveryPartner | null = null;
  selectedPartnerId: string | null = null;

  statusFilter = 'all';
  autoRefresh = true;
  refreshInterval: any;

  constructor(
    public adminService: AdminService
  ) {}

  ngOnInit(): void {
    this.loadGoogleMaps();
    this.loadInitialData();
    this.setupSubscriptions();
    this.setupAutoRefresh();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.clearAutoRefresh();
  }

  private loadGoogleMaps(): void {
    // Check if Google Maps is already loaded
    if (typeof google !== 'undefined' && google.maps) {
      this.initializeMap();
      return;
    }

    // Load Google Maps API
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&libraries=geometry`;
    script.onload = () => {
      this.initializeMap();
    };
    script.onerror = () => {
      console.error('Failed to load Google Maps API');
    };
    document.head.appendChild(script);
  }

  private initializeMap(): void {
    try {
      // Initialize map centered on Bangalore
      this.map = new google.maps.Map(this.mapElement.nativeElement, {
        zoom: 12,
        center: { lat: 12.9716, lng: 77.5946 }, // Bangalore
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });

      // Initialize traffic layer
      this.trafficLayer = new google.maps.TrafficLayer();

      this.mapLoaded = true;
      this.updatePartnerMarkers();
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }

  private loadInitialData(): void {
    this.adminService.loadDeliveryPartners();
    this.adminService.loadOrders({ status: 'OUT_FOR_DELIVERY' });
  }

  private setupSubscriptions(): void {
    this.adminService.deliveryPartners$
      .pipe(takeUntil(this.destroy$))
      .subscribe(partners => {
        this.partners = partners;
        this.activePartners = partners.filter(p => p.isActive);
        this.applyFilters();
        this.updatePartnerMarkers();
      });

    this.adminService.orders$
      .pipe(takeUntil(this.destroy$))
      .subscribe(orders => {
        this.activeOrders = orders.filter(order => 
          order.status === 'OUT_FOR_DELIVERY' && order.assignedPartnerId
        );
      });
  }

  private setupAutoRefresh(): void {
    if (this.autoRefresh) {
      this.refreshInterval = setInterval(() => {
        this.refreshTracking();
      }, 30000); // Refresh every 30 seconds
    }
  }

  private clearAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  // Map Management
  private updatePartnerMarkers(): void {
    if (!this.mapLoaded) return;

    // Clear existing markers
    this.partnerMarkers.forEach(markerData => {
      markerData.marker.setMap(null);
    });
    this.partnerMarkers.clear();

    // Add markers for partners with location
    this.activePartners.forEach(partner => {
      if (partner.currentLocation) {
        this.addPartnerMarker(partner);
      }
    });
  }

  private addPartnerMarker(partner: DeliveryPartner): void {
    if (!partner.currentLocation || !this.mapLoaded) return;

    const position = {
      lat: partner.currentLocation.latitude,
      lng: partner.currentLocation.longitude
    };

    // Determine marker color based on status
    const markerColor = this.getPartnerMarkerColor(partner);
    
    const marker = new google.maps.Marker({
      position,
      map: this.map,
      title: partner.name,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="${markerColor}">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="2.5" fill="white"/>
          </svg>
        `),
        scaledSize: new google.maps.Size(32, 32),
        anchor: new google.maps.Point(16, 32)
      }
    });

    // Create info window
    const infoWindow = new google.maps.InfoWindow({
      content: this.createMarkerInfoContent(partner)
    });

    marker.addListener('click', () => {
      // Close other info windows
      this.partnerMarkers.forEach(markerData => {
        markerData.infoWindow.close();
      });
      
      infoWindow.open(this.map, marker);
      this.selectPartner(partner);
    });

    this.partnerMarkers.set(partner.id, {
      partner,
      marker,
      infoWindow,
      lastUpdate: new Date()
    });
  }

  private createMarkerInfoContent(partner: DeliveryPartner): string {
    const activeOrders = this.getPartnerActiveOrders(partner.id);
    const lastSeen = partner.currentLocation ? 
      this.getLastSeenText(partner.currentLocation.timestamp) : 'Unknown';

    return `
      <div style="padding: 8px; min-width: 200px;">
        <h4 style="margin: 0 0 8px 0;">${partner.name}</h4>
        <p style="margin: 4px 0;"><strong>Vehicle:</strong> ${partner.vehicleType} - ${partner.vehicleNumber}</p>
        <p style="margin: 4px 0;"><strong>Status:</strong> ${this.getPartnerStatusText(partner)}</p>
        <p style="margin: 4px 0;"><strong>Last Seen:</strong> ${lastSeen}</p>
        <p style="margin: 4px 0;"><strong>Active Orders:</strong> ${activeOrders.length}</p>
        <p style="margin: 4px 0;"><strong>Rating:</strong> ${partner.ratings.average.toFixed(1)} ⭐</p>
      </div>
    `;
  }

  private getPartnerMarkerColor(partner: DeliveryPartner): string {
    if (!partner.isAvailable) return '#9E9E9E'; // Grey for offline
    
    const hasActiveOrders = this.getPartnerActiveOrders(partner.id).length > 0;
    return hasActiveOrders ? '#FF9800' : '#4CAF50'; // Orange for busy, Green for available
  }

  // Partner Management
  selectPartner(partner: DeliveryPartner): void {
    this.selectedPartner = partner;
    this.selectedPartnerId = partner.id;
  }

  closeDetailsPanel(): void {
    this.selectedPartner = null;
    this.selectedPartnerId = null;
  }

  focusOnPartner(partner: DeliveryPartner): void {
    if (!partner.currentLocation || !this.mapLoaded) return;

    const position = {
      lat: partner.currentLocation.latitude,
      lng: partner.currentLocation.longitude
    };

    this.map.setCenter(position);
    this.map.setZoom(16);

    // Open info window
    const markerData = this.partnerMarkers.get(partner.id);
    if (markerData) {
      markerData.infoWindow.open(this.map, markerData.marker);
    }
  }

  centerMapOnAll(): void {
    if (!this.mapLoaded || this.partnerMarkers.size === 0) return;

    const bounds = new google.maps.LatLngBounds();
    this.partnerMarkers.forEach(markerData => {
      bounds.extend(markerData.marker.getPosition());
    });

    this.map.fitBounds(bounds);
    
    // Ensure minimum zoom level
    google.maps.event.addListenerOnce(this.map, 'bounds_changed', () => {
      if (this.map.getZoom() > 15) {
        this.map.setZoom(15);
      }
    });
  }

  toggleTrafficLayer(): void {
    if (!this.mapLoaded) return;

    if (this.isTrafficVisible) {
      this.trafficLayer.setMap(null);
    } else {
      this.trafficLayer.setMap(this.map);
    }
    this.isTrafficVisible = !this.isTrafficVisible;
  }

  toggleMapType(): void {
    if (!this.mapLoaded) return;

    const newType = this.isSatelliteView ? 
      google.maps.MapTypeId.ROADMAP : 
      google.maps.MapTypeId.SATELLITE;
    
    this.map.setMapTypeId(newType);
    this.isSatelliteView = !this.isSatelliteView;
  }

  // Filtering and Search
  applyFilters(): void {
    let filtered = [...this.activePartners];

    switch (this.statusFilter) {
      case 'available':
        filtered = filtered.filter(p => p.isAvailable && this.getPartnerActiveOrders(p.id).length === 0);
        break;
      case 'busy':
        filtered = filtered.filter(p => p.isAvailable && this.getPartnerActiveOrders(p.id).length > 0);
        break;
      case 'offline':
        filtered = filtered.filter(p => !p.isAvailable);
        break;
    }

    this.filteredPartners = filtered;
  }

  // Data Management
  refreshTracking(): void {
    this.adminService.loadDeliveryPartners();
    this.adminService.loadOrders({ status: 'OUT_FOR_DELIVERY' });
  }

  toggleAutoRefresh(): void {
    if (this.autoRefresh) {
      this.setupAutoRefresh();
    } else {
      this.clearAutoRefresh();
    }
  }

  // Utility Methods
  getPartnerActiveOrders(partnerId: string): Order[] {
    return this.activeOrders.filter(order => order.assignedPartnerId === partnerId);
  }

  getPartnerStatusText(partner: DeliveryPartner): string {
    if (!partner.isAvailable) return 'Offline';
    
    const activeOrders = this.getPartnerActiveOrders(partner.id);
    return activeOrders.length > 0 ? 'On Delivery' : 'Available';
  }

  getPartnerStatusColor(partner: DeliveryPartner): string {
    if (!partner.isAvailable) return 'warn';
    
    const activeOrders = this.getPartnerActiveOrders(partner.id);
    return activeOrders.length > 0 ? 'accent' : 'primary';
  }

  getPartnerStatusIcon(partner: DeliveryPartner): string {
    if (!partner.isAvailable) return 'offline_bolt';
    
    const activeOrders = this.getPartnerActiveOrders(partner.id);
    return activeOrders.length > 0 ? 'local_shipping' : 'check_circle';
  }

  getLastSeenText(timestamp: string): string {
    const now = new Date();
    const lastSeen = new Date(timestamp);
    const diffMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }

  showPartnerHistory(partner: DeliveryPartner): void {
    // In a real implementation, this would show a dialog with partner's route history
    console.log('Show history for partner:', partner.name);
  }

  trackByPartner(index: number, partner: DeliveryPartner): string {
    return partner.id;
  }
}