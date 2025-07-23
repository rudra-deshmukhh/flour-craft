import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MillOrder } from '../../../services/flour-mill.service';
import { FlourMillService } from '../../../services/flour-mill.service';

@Component({
  selector: 'app-order-details-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule
  ],
  template: `
    <h2 mat-dialog-title>
      Order Details - #{{ data.order.orderNumber }}
      <mat-chip [color]="flourMillService.getOrderStatusColor(data.order.status)" selected>
        {{ data.order.status }}
      </mat-chip>
    </h2>
    
    <mat-dialog-content class="order-details-content">
      <!-- Customer Information -->
      <div class="section">
        <h3>
          <mat-icon>person</mat-icon>
          Customer Information
        </h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">Name:</span>
            <span class="value">{{ data.order.user.firstName }} {{ data.order.user.lastName }}</span>
          </div>
          <div class="info-item">
            <span class="label">Phone:</span>
            <span class="value">{{ data.order.user.phoneNumber }}</span>
          </div>
        </div>
      </div>

      <!-- Delivery Address -->
      <div class="section">
        <h3>
          <mat-icon>location_on</mat-icon>
          Delivery Address
        </h3>
        <div class="address-details">
          <p>{{ data.order.address.fullAddress }}</p>
          <p><strong>Pincode:</strong> {{ data.order.address.pincode }}</p>
          <p *ngIf="data.order.address.landmark">
            <strong>Landmark:</strong> {{ data.order.address.landmark }}
          </p>
        </div>
      </div>

      <!-- Order Items -->
      <div class="section">
        <h3>
          <mat-icon>inventory</mat-icon>
          Order Items
        </h3>
        <div class="items-table">
          <div class="item-header">
            <span>Product</span>
            <span>Quantity</span>
            <span>Price/kg</span>
            <span>Total</span>
          </div>
          <div *ngFor="let item of data.order.orderItems" class="item-row">
            <span class="product-info">
              <strong>{{ item.product.name }}</strong>
              <small>{{ item.product.category }}</small>
            </span>
            <span>{{ item.quantity }} kg</span>
            <span>₹{{ item.pricePerKg }}</span>
            <span>₹{{ item.quantity * item.pricePerKg }}</span>
          </div>
        </div>
      </div>

      <!-- Order Summary -->
      <div class="section">
        <h3>
          <mat-icon>receipt</mat-icon>
          Order Summary
        </h3>
        <div class="summary-details">
          <div class="summary-row">
            <span>Total Amount:</span>
            <span>₹{{ data.order.totalAmount }}</span>
          </div>
          <div class="summary-row">
            <span>Final Amount:</span>
            <span class="final-amount">₹{{ data.order.finalAmount }}</span>
          </div>
        </div>
      </div>

      <!-- Timeline -->
      <div class="section">
        <h3>
          <mat-icon>timeline</mat-icon>
          Order Timeline
        </h3>
        <div class="timeline">
          <div class="timeline-item completed">
            <mat-icon>add_shopping_cart</mat-icon>
            <div class="timeline-content">
              <strong>Order Placed</strong>
              <span>{{ flourMillService.formatDateTime(data.order.createdAt) }}</span>
            </div>
          </div>

          <div class="timeline-item" [class.completed]="isStatusCompleted('GRINDING')">
            <mat-icon>play_circle</mat-icon>
            <div class="timeline-content">
              <strong>Grinding Started</strong>
              <span *ngIf="data.order.grindingStarted; else notStarted">
                {{ flourMillService.formatDateTime(data.order.grindingStarted) }}
              </span>
              <ng-template #notStarted>
                <span class="pending">Pending</span>
              </ng-template>
            </div>
          </div>

          <div class="timeline-item" [class.completed]="data.order.grindingCompleted">
            <mat-icon>check_circle</mat-icon>
            <div class="timeline-content">
              <strong>Grinding Completed</strong>
              <span *ngIf="data.order.grindingCompleted; else notCompleted">
                {{ flourMillService.formatDateTime(data.order.grindingCompleted) }}
              </span>
              <ng-template #notCompleted>
                <span class="pending">Pending</span>
              </ng-template>
            </div>
          </div>

          <div class="timeline-item" [class.completed]="isStatusCompleted('DISPATCHED')">
            <mat-icon>local_shipping</mat-icon>
            <div class="timeline-content">
              <strong>Dispatched</strong>
              <span *ngIf="data.order.dispatchedAt; else notDispatched">
                {{ flourMillService.formatDateTime(data.order.dispatchedAt) }}
              </span>
              <ng-template #notDispatched>
                <span class="pending">Pending</span>
              </ng-template>
            </div>
          </div>

          <div class="timeline-item" [class.completed]="isStatusCompleted('DELIVERED')">
            <mat-icon>done_all</mat-icon>
            <div class="timeline-content">
              <strong>Delivered</strong>
              <span *ngIf="data.order.deliveredAt; else notDelivered">
                {{ flourMillService.formatDateTime(data.order.deliveredAt) }}
              </span>
              <ng-template #notDelivered>
                <span class="pending">Pending</span>
              </ng-template>
            </div>
          </div>
        </div>
      </div>

      <!-- Processing Queue Info -->
      <div class="section" *ngIf="data.order.processingQueue">
        <h3>
          <mat-icon>schedule</mat-icon>
          Automation Status
        </h3>
        <div class="queue-info">
          <div class="info-item">
            <span class="label">Current Status:</span>
            <span class="value">{{ data.order.processingQueue.currentStatus }}</span>
          </div>
          <div class="info-item">
            <span class="label">Target Status:</span>
            <span class="value">{{ data.order.processingQueue.targetStatus }}</span>
          </div>
          <div class="info-item">
            <span class="label">Scheduled At:</span>
            <span class="value">{{ flourMillService.formatDateTime(data.order.processingQueue.scheduledAt) }}</span>
          </div>
          <div class="info-item" *ngIf="data.order.processingQueue.processedAt">
            <span class="label">Processed At:</span>
            <span class="value">{{ flourMillService.formatDateTime(data.order.processingQueue.processedAt) }}</span>
          </div>
          <div class="info-item">
            <span class="label">Retry Count:</span>
            <span class="value">{{ data.order.processingQueue.retryCount }}</span>
          </div>
        </div>
      </div>

      <!-- Notes -->
      <div class="section" *ngIf="data.order.notes">
        <h3>
          <mat-icon>note</mat-icon>
          Notes
        </h3>
        <p class="notes-content">{{ data.order.notes }}</p>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onClose()">Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .order-details-content {
      max-width: 600px;
      max-height: 70vh;
      overflow-y: auto;
    }

    .section {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e0e0e0;
    }

    .section:last-child {
      border-bottom: none;
      margin-bottom: 0;
    }

    .section h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 16px 0;
      color: #333;
      font-weight: 500;
    }

    .section h3 mat-icon {
      color: #666;
    }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .info-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
    }

    .info-item .label {
      font-weight: 500;
      color: #666;
    }

    .info-item .value {
      font-weight: 600;
      color: #333;
    }

    .address-details p {
      margin: 4px 0;
      line-height: 1.5;
    }

    .items-table {
      background: #f9f9f9;
      border-radius: 8px;
      overflow: hidden;
    }

    .item-header {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr;
      gap: 16px;
      padding: 12px;
      background: #e0e0e0;
      font-weight: 600;
      color: #333;
    }

    .item-row {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr;
      gap: 16px;
      padding: 12px;
      border-bottom: 1px solid #e0e0e0;
    }

    .item-row:last-child {
      border-bottom: none;
    }

    .product-info {
      display: flex;
      flex-direction: column;
    }

    .product-info small {
      color: #666;
      font-size: 0.85em;
    }

    .summary-details {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 8px;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
    }

    .summary-row:last-child {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #ddd;
    }

    .final-amount {
      font-size: 1.2em;
      font-weight: 600;
      color: #4caf50;
    }

    .timeline {
      position: relative;
      padding-left: 32px;
    }

    .timeline::before {
      content: '';
      position: absolute;
      left: 15px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: #e0e0e0;
    }

    .timeline-item {
      position: relative;
      margin-bottom: 24px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .timeline-item mat-icon {
      position: absolute;
      left: -24px;
      top: 2px;
      background: white;
      border: 2px solid #e0e0e0;
      border-radius: 50%;
      padding: 4px;
      color: #999;
    }

    .timeline-item.completed mat-icon {
      border-color: #4caf50;
      color: #4caf50;
    }

    .timeline-content {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .timeline-content strong {
      color: #333;
    }

    .timeline-content .pending {
      color: #999;
      font-style: italic;
    }

    .queue-info {
      background: #fff3e0;
      padding: 16px;
      border-radius: 8px;
      border-left: 4px solid #ff9800;
    }

    .notes-content {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 8px;
      border-left: 4px solid #2196f3;
      margin: 0;
      line-height: 1.6;
    }

    mat-dialog-actions {
      padding: 16px 0 0 0;
    }
  `]
})
export class OrderDetailsDialogComponent {
  constructor(
    public flourMillService: FlourMillService,
    private dialogRef: MatDialogRef<OrderDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { order: MillOrder }
  ) {}

  isStatusCompleted(status: string): boolean {
    const statusOrder = ['PENDING', 'CONFIRMED', 'GRINDING', 'DISPATCHED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    const currentIndex = statusOrder.indexOf(this.data.order.status);
    const targetIndex = statusOrder.indexOf(status);
    return currentIndex >= targetIndex;
  }

  onClose(): void {
    this.dialogRef.close();
  }
}