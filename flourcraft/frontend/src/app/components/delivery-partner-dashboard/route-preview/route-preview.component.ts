import { Component, Inject, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { OptimizedRoute } from '../../../services/delivery-partner.service';

// Google Maps types
declare var google: any;

interface RoutePreviewData {
  route: OptimizedRoute;
}

@Component({
  selector: 'app-route-preview',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatListModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>route</mat-icon>
      Route Preview
    </h2>
    
    <mat-dialog-content class="route-preview-content">
      <!-- Route Summary -->
      <div class="route-summary">
        <div class="summary-stats">
          <mat-chip color="primary" selected>
            <mat-icon>straighten</mat-icon>
            {{ data.route.totalDistance.toFixed(1) }} km
          </mat-chip>
          <mat-chip color="primary" selected>
            <mat-icon>access_time</mat-icon>
            {{ formatTime(data.route.totalDuration) }}
          </mat-chip>
          <mat-chip color="accent" selected>
            <mat-icon>location_on</mat-icon>
            {{ data.route.waypoints.length }} stops
          </mat-chip>
        </div>
      </div>

      <!-- Google Maps Container -->
      <div class="map-container">
        <div #mapElement class="google-map" id="route-map"></div>
        <div class="map-loading" *ngIf="!mapLoaded">
          <mat-icon>map</mat-icon>
          <p>Loading map...</p>
        </div>
      </div>

      <!-- Waypoints List -->
      <div class="waypoints-section">
        <h3>Delivery Stops</h3>
        <mat-list class="waypoints-list">
          <mat-list-item *ngFor="let waypoint of data.route.waypoints; let i = index"
                        class="waypoint-item"
                        [class.completed]="waypoint.completed">
            
            <mat-icon matListItemIcon 
                     [color]="waypoint.completed ? 'primary' : 'accent'">
              {{ waypoint.completed ? 'check_circle' : 'location_on' }}
            </mat-icon>

            <div matListItemTitle class="waypoint-header">
              <span class="stop-number">Stop {{ i + 1 }}</span>
              <span class="estimated-time">
                {{ formatDateTime(waypoint.estimatedArrival) }}
              </span>
            </div>

            <div matListItemLine class="waypoint-address">
              {{ waypoint.address }}
            </div>

            <button mat-icon-button 
                   matListItemMeta
                   (click)="focusOnWaypoint(waypoint, i)"
                   [disabled]="!mapLoaded">
              <mat-icon>zoom_in</mat-icon>
            </button>
          </mat-list-item>
        </mat-list>
      </div>

      <!-- Route Instructions -->
      <div class="route-instructions" *ngIf="directions">
        <h3>Turn-by-turn Directions</h3>
        <div class="instructions-list">
          <div *ngFor="let step of getRouteSteps(); let i = index" 
               class="instruction-step">
            <div class="step-number">{{ i + 1 }}</div>
            <div class="step-content">
              <div class="step-instruction" [innerHTML]="step.instructions"></div>
              <div class="step-details">
                <span>{{ step.distance.text }}</span> • 
                <span>{{ step.duration.text }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onClose()">Close</button>
      <button mat-raised-button color="primary" (click)="openInGoogleMaps()">
        <mat-icon>map</mat-icon>
        Open in Google Maps
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .route-preview-content {
      width: 90vw;
      max-width: 800px;
      height: 80vh;
      max-height: 600px;
      padding: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .route-summary {
      padding: 16px;
      border-bottom: 1px solid #e0e0e0;
      background: #f9f9f9;
    }

    .summary-stats {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .summary-stats mat-chip {
      margin-right: 8px;
    }

    .summary-stats mat-chip mat-icon {
      margin-right: 4px;
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .map-container {
      position: relative;
      height: 300px;
      margin: 16px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #e0e0e0;
    }

    .google-map {
      width: 100%;
      height: 100%;
    }

    .map-loading {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      color: #666;
    }

    .map-loading mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 8px;
    }

    .waypoints-section {
      flex: 1;
      overflow-y: auto;
      padding: 0 16px;
    }

    .waypoints-section h3 {
      margin: 16px 0 8px 0;
      color: #333;
      font-weight: 500;
    }

    .waypoints-list {
      padding: 0;
    }

    .waypoint-item {
      border-bottom: 1px solid #f0f0f0;
      padding: 12px 0;
    }

    .waypoint-item.completed {
      opacity: 0.7;
    }

    .waypoint-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 500;
    }

    .stop-number {
      color: #1976d2;
      font-weight: 600;
    }

    .estimated-time {
      font-size: 0.9em;
      color: #666;
    }

    .waypoint-address {
      color: #333;
      margin-top: 4px;
    }

    .route-instructions {
      padding: 16px;
      background: #fafafa;
      border-top: 1px solid #e0e0e0;
      max-height: 200px;
      overflow-y: auto;
    }

    .route-instructions h3 {
      margin: 0 0 12px 0;
      color: #333;
      font-weight: 500;
    }

    .instructions-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .instruction-step {
      display: flex;
      gap: 12px;
      padding: 8px;
      background: white;
      border-radius: 6px;
      border-left: 3px solid #2196f3;
    }

    .step-number {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      background: #2196f3;
      color: white;
      border-radius: 50%;
      font-size: 0.8em;
      font-weight: 600;
      flex-shrink: 0;
    }

    .step-content {
      flex: 1;
    }

    .step-instruction {
      font-weight: 500;
      margin-bottom: 4px;
      line-height: 1.4;
    }

    .step-details {
      font-size: 0.8em;
      color: #666;
    }

    mat-dialog-actions {
      padding: 16px;
      border-top: 1px solid #e0e0e0;
    }

    @media (max-width: 768px) {
      .route-preview-content {
        width: 95vw;
        height: 90vh;
      }

      .map-container {
        height: 250px;
        margin: 12px;
      }

      .summary-stats {
        flex-direction: column;
        gap: 4px;
      }
    }
  `]
})
export class RoutePreviewComponent implements OnInit {
  @ViewChild('mapElement', { static: true }) mapElement!: ElementRef;

  map: any;
  directionsService: any;
  directionsRenderer: any;
  mapLoaded = false;
  directions: any;
  markers: any[] = [];

  constructor(
    private dialogRef: MatDialogRef<RoutePreviewComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RoutePreviewData
  ) {}

  ngOnInit(): void {
    this.loadGoogleMaps();
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
      // Show fallback content or error message
    };
    document.head.appendChild(script);
  }

  private initializeMap(): void {
    try {
      // Initialize map
      this.map = new google.maps.Map(this.mapElement.nativeElement, {
        zoom: 13,
        center: this.data.route.startLocation,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });

      // Initialize directions service and renderer
      this.directionsService = new google.maps.DirectionsService();
      this.directionsRenderer = new google.maps.DirectionsRenderer({
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: '#2196F3',
          strokeWeight: 5,
          strokeOpacity: 0.8
        }
      });

      this.directionsRenderer.setMap(this.map);
      this.mapLoaded = true;

      // Calculate and display route
      this.calculateRoute();
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }

  private calculateRoute(): void {
    const waypoints = this.data.route.waypoints.map((waypoint, index) => ({
      location: new google.maps.LatLng(waypoint.latitude, waypoint.longitude),
      stopover: true
    }));

    const start = new google.maps.LatLng(
      this.data.route.startLocation.latitude,
      this.data.route.startLocation.longitude
    );

    const end = waypoints.length > 0 ? 
      waypoints[waypoints.length - 1].location : 
      start;

    const request = {
      origin: start,
      destination: end,
      waypoints: waypoints.slice(0, -1), // Remove last waypoint as it's the destination
      travelMode: google.maps.TravelMode.DRIVING,
      optimizeWaypoints: false, // We already have optimized route
      avoidHighways: false,
      avoidTolls: false
    };

    this.directionsService.route(request, (result: any, status: any) => {
      if (status === google.maps.DirectionsStatus.OK) {
        this.directionsRenderer.setDirections(result);
        this.directions = result;
        this.addCustomMarkers();
      } else {
        console.error('Directions request failed:', status);
        this.addFallbackMarkers();
      }
    });
  }

  private addCustomMarkers(): void {
    // Add start marker
    const startMarker = new google.maps.Marker({
      position: this.data.route.startLocation,
      map: this.map,
      title: 'Start Location',
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#4CAF50">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="2.5" fill="white"/>
          </svg>
        `),
        scaledSize: new google.maps.Size(32, 32),
        anchor: new google.maps.Point(16, 32)
      }
    });

    this.markers.push(startMarker);

    // Add waypoint markers
    this.data.route.waypoints.forEach((waypoint, index) => {
      const marker = new google.maps.Marker({
        position: { lat: waypoint.latitude, lng: waypoint.longitude },
        map: this.map,
        title: `Stop ${index + 1}: ${waypoint.address}`,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="${waypoint.completed ? '#FF9800' : '#2196F3'}">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              <text x="12" y="11" text-anchor="middle" fill="white" font-size="8" font-weight="bold">${index + 1}</text>
            </svg>
          `),
          scaledSize: new google.maps.Size(28, 28),
          anchor: new google.maps.Point(14, 28)
        }
      });

      this.markers.push(marker);

      // Add info window
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px;">
            <strong>Stop ${index + 1}</strong><br>
            ${waypoint.address}<br>
            <small>ETA: ${this.formatDateTime(waypoint.estimatedArrival)}</small>
          </div>
        `
      });

      marker.addListener('click', () => {
        this.markers.forEach(m => {
          if (m.infoWindow) m.infoWindow.close();
        });
        infoWindow.open(this.map, marker);
        marker.infoWindow = infoWindow;
      });
    });
  }

  private addFallbackMarkers(): void {
    // If directions fail, just show markers without route
    this.addCustomMarkers();
    
    // Fit map to show all markers
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(this.data.route.startLocation);
    
    this.data.route.waypoints.forEach(waypoint => {
      bounds.extend({ lat: waypoint.latitude, lng: waypoint.longitude });
    });
    
    this.map.fitBounds(bounds);
  }

  focusOnWaypoint(waypoint: any, index: number): void {
    if (!this.mapLoaded) return;

    const position = { lat: waypoint.latitude, lng: waypoint.longitude };
    this.map.setCenter(position);
    this.map.setZoom(16);

    // Trigger marker click if it exists
    if (this.markers[index + 1]) { // +1 because first marker is start location
      google.maps.event.trigger(this.markers[index + 1], 'click');
    }
  }

  getRouteSteps(): any[] {
    if (!this.directions || !this.directions.routes || !this.directions.routes[0]) {
      return [];
    }

    const route = this.directions.routes[0];
    const steps: any[] = [];

    route.legs.forEach((leg: any) => {
      leg.steps.forEach((step: any) => {
        steps.push(step);
      });
    });

    return steps;
  }

  formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }

  formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  openInGoogleMaps(): void {
    // Generate Google Maps URL
    const waypoints = this.data.route.waypoints
      .map(wp => `${wp.latitude},${wp.longitude}`)
      .join('|');

    const startPoint = `${this.data.route.startLocation.latitude},${this.data.route.startLocation.longitude}`;
    const endPoint = this.data.route.waypoints.length > 0 ? 
      `${this.data.route.waypoints[this.data.route.waypoints.length - 1].latitude},${this.data.route.waypoints[this.data.route.waypoints.length - 1].longitude}` : 
      startPoint;

    let mapsUrl = `https://www.google.com/maps/dir/${startPoint}`;
    
    if (waypoints) {
      mapsUrl += `/${waypoints}`;
    }
    
    mapsUrl += `/${endPoint}?travelmode=driving`;

    // Open in new tab/app
    window.open(mapsUrl, '_blank');
    
    // Close dialog
    this.onClose();
  }

  onClose(): void {
    this.dialogRef.close();
  }
}