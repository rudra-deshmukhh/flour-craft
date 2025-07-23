import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { StockAlert } from '../../../services/flour-mill.service';
import { FlourMillService } from '../../../services/flour-mill.service';

@Component({
  selector: 'app-alert-resolve-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatChipsModule,
    ReactiveFormsModule
  ],
  template: `
    <h2 mat-dialog-title>
      Resolve Stock Alert
      <mat-chip [color]="flourMillService.getAlertSeverityColor(data.alert.severity)" selected>
        {{ data.alert.severity }}
      </mat-chip>
    </h2>
    
    <mat-dialog-content class="resolve-alert-content">
      <!-- Alert Details -->
      <div class="alert-summary">
        <div class="alert-header">
          <mat-icon [color]="getAlertIconColor()">{{ getAlertIcon() }}</mat-icon>
          <div class="alert-info">
            <h3>{{ data.alert.product.name }}</h3>
            <p>{{ data.alert.alertType }} - {{ data.alert.product.category }}</p>
          </div>
        </div>
        
        <div class="alert-details">
          <div class="detail-item">
            <span class="label">Current Stock:</span>
            <span class="value" [class.critical]="data.alert.currentStock <= 0">
              {{ data.alert.currentStock }} kg
            </span>
          </div>
          <div class="detail-item">
            <span class="label">Threshold:</span>
            <span class="value">{{ data.alert.threshold }} kg</span>
          </div>
          <div class="detail-item">
            <span class="label">Created:</span>
            <span class="value">{{ flourMillService.formatDateTime(data.alert.createdAt) }}</span>
          </div>
        </div>
      </div>

      <!-- Resolution Form -->
      <form [formGroup]="resolveForm" class="resolve-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Resolution Notes (Optional)</mat-label>
          <textarea 
            matInput 
            formControlName="notes"
            rows="4"
            placeholder="Add any notes about how this alert was resolved..."
            maxlength="500">
          </textarea>
          <mat-hint align="end">{{ resolveForm.get('notes')?.value?.length || 0 }}/500</mat-hint>
        </mat-form-field>

        <div class="suggested-actions" *ngIf="getSuggestedActions().length > 0">
          <h4>Suggested Actions:</h4>
          <ul>
            <li *ngFor="let action of getSuggestedActions()">{{ action }}</li>
          </ul>
        </div>
      </form>

      <div class="warning-notice" *ngIf="data.alert.severity === 'CRITICAL'">
        <mat-icon>warning</mat-icon>
        <div>
          <strong>Critical Alert:</strong>
          <p>This is a critical stock alert. Please ensure the issue has been properly addressed before resolving.</p>
        </div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button 
              [color]="data.alert.severity === 'CRITICAL' ? 'warn' : 'primary'"
              (click)="onResolve()">
        <mat-icon>check</mat-icon>
        Resolve Alert
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .resolve-alert-content {
      min-width: 400px;
      padding: 16px 0;
    }

    .alert-summary {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
    }

    .alert-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .alert-header mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .alert-info h3 {
      margin: 0;
      color: #333;
      font-weight: 600;
    }

    .alert-info p {
      margin: 4px 0 0 0;
      color: #666;
      font-size: 0.9em;
    }

    .alert-details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .detail-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
    }

    .detail-item .label {
      font-weight: 500;
      color: #666;
    }

    .detail-item .value {
      font-weight: 600;
      color: #333;
    }

    .detail-item .value.critical {
      color: #f44336;
    }

    .resolve-form {
      margin-bottom: 16px;
    }

    .full-width {
      width: 100%;
    }

    .suggested-actions {
      background: #e3f2fd;
      padding: 16px;
      border-radius: 8px;
      border-left: 4px solid #2196f3;
      margin-top: 16px;
    }

    .suggested-actions h4 {
      margin: 0 0 8px 0;
      color: #1976d2;
      font-weight: 500;
    }

    .suggested-actions ul {
      margin: 0;
      padding-left: 20px;
      color: #333;
    }

    .suggested-actions li {
      margin-bottom: 4px;
      line-height: 1.4;
    }

    .warning-notice {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      background: #fff3e0;
      padding: 16px;
      border-radius: 8px;
      border-left: 4px solid #ff9800;
      margin-top: 16px;
    }

    .warning-notice mat-icon {
      color: #ff9800;
      margin-top: 2px;
    }

    .warning-notice strong {
      color: #e65100;
    }

    .warning-notice p {
      margin: 4px 0 0 0;
      color: #333;
      line-height: 1.4;
    }

    mat-dialog-actions {
      padding: 16px 0 0 0;
    }
  `]
})
export class AlertResolveDialogComponent {
  resolveForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    public flourMillService: FlourMillService,
    private dialogRef: MatDialogRef<AlertResolveDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { alert: StockAlert }
  ) {
    this.resolveForm = this.fb.group({
      notes: ['']
    });
  }

  getAlertIcon(): string {
    switch (this.data.alert.alertType) {
      case 'LOW_STOCK':
        return 'inventory_2';
      case 'OUT_OF_STOCK':
        return 'production_quantity_limits';
      case 'EXPIRY_WARNING':
        return 'schedule';
      case 'OVERSTOCKED':
        return 'warehouse';
      default:
        return 'warning';
    }
  }

  getAlertIconColor(): string {
    switch (this.data.alert.severity) {
      case 'CRITICAL':
        return 'warn';
      case 'HIGH':
        return 'accent';
      case 'MEDIUM':
        return 'primary';
      case 'LOW':
        return 'primary';
      default:
        return 'primary';
    }
  }

  getSuggestedActions(): string[] {
    const actions: string[] = [];
    
    switch (this.data.alert.alertType) {
      case 'LOW_STOCK':
        actions.push('Restock the product immediately');
        actions.push('Contact suppliers for urgent delivery');
        actions.push('Check if alternative products can substitute temporarily');
        if (this.data.alert.currentStock <= 0) {
          actions.push('Update inventory system to reflect zero stock');
          actions.push('Notify customers about potential delays');
        }
        break;
        
      case 'OUT_OF_STOCK':
        actions.push('Order emergency stock replenishment');
        actions.push('Inform customers about unavailability');
        actions.push('Update product availability status');
        actions.push('Review stock threshold settings');
        break;
        
      case 'EXPIRY_WARNING':
        actions.push('Use the stock in upcoming orders first');
        actions.push('Check if stock can be processed before expiry');
        actions.push('Consider discounting the product for quick sale');
        actions.push('Verify actual expiry date and condition');
        break;
        
      case 'OVERSTOCKED':
        actions.push('Review demand forecasting');
        actions.push('Consider promotional pricing');
        actions.push('Check storage capacity and conditions');
        actions.push('Evaluate supplier delivery schedules');
        break;
    }
    
    return actions;
  }

  onResolve(): void {
    const notes = this.resolveForm.get('notes')?.value?.trim() || '';
    this.dialogRef.close({ notes });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}