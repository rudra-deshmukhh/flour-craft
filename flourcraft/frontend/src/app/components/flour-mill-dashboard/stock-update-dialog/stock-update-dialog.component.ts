import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MillInventory, UpdateStockRequest } from '../../../services/flour-mill.service';

@Component({
  selector: 'app-stock-update-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    ReactiveFormsModule
  ],
  template: `
    <h2 mat-dialog-title>Update Stock - {{ data.inventory.product.name }}</h2>
    
    <mat-dialog-content>
      <form [formGroup]="updateForm" class="stock-update-form">
        <div class="current-stock-info">
          <h4>Current Stock Information</h4>
          <div class="info-grid">
            <div class="info-item">
              <span class="label">Current Stock:</span>
              <span class="value">{{ data.inventory.currentStock }} kg</span>
            </div>
            <div class="info-item">
              <span class="label">Max Capacity:</span>
              <span class="value">{{ data.inventory.maxCapacity }} kg</span>
            </div>
            <div class="info-item">
              <span class="label">Min Threshold:</span>
              <span class="value">{{ data.inventory.minThreshold }} kg</span>
            </div>
            <div class="info-item" *ngIf="data.inventory.lastRestocked">
              <span class="label">Last Restocked:</span>
              <span class="value">{{ formatDate(data.inventory.lastRestocked) }}</span>
            </div>
          </div>
        </div>

        <div class="update-fields">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Operation Type</mat-label>
            <mat-select formControlName="operation" required>
              <mat-option value="add">Add to existing stock</mat-option>
              <mat-option value="set">Set exact stock level</mat-option>
            </mat-select>
            <mat-error *ngIf="updateForm.get('operation')?.hasError('required')">
              Please select an operation type
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>
              {{ updateForm.get('operation')?.value === 'add' ? 'Quantity to Add (kg)' : 'New Stock Level (kg)' }}
            </mat-label>
            <input matInput type="number" formControlName="quantity" min="0" step="0.1" required>
            <mat-error *ngIf="updateForm.get('quantity')?.hasError('required')">
              Quantity is required
            </mat-error>
            <mat-error *ngIf="updateForm.get('quantity')?.hasError('min')">
              Quantity must be greater than 0
            </mat-error>
            <mat-error *ngIf="updateForm.get('quantity')?.hasError('max')">
              Quantity cannot exceed maximum capacity ({{ data.inventory.maxCapacity }} kg)
            </mat-error>
          </mat-form-field>

          <div class="preview-section" *ngIf="updateForm.get('quantity')?.value">
            <h4>Preview</h4>
            <div class="preview-info">
              <span class="label">New Stock Level:</span>
              <span class="value" [class.warning]="getNewStockLevel() > data.inventory.maxCapacity">
                {{ getNewStockLevel() }} kg
              </span>
            </div>
            <div class="warning-message" *ngIf="getNewStockLevel() > data.inventory.maxCapacity">
              ⚠️ Warning: New stock level exceeds maximum capacity
            </div>
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Batch Number (Optional)</mat-label>
            <input matInput formControlName="batchNumber" placeholder="e.g., BATCH001">
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Unit Cost per kg (Optional)</mat-label>
            <input matInput type="number" formControlName="unitCost" min="0" step="0.01" placeholder="0.00">
            <span matPrefix>₹&nbsp;</span>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Expiry Date (Optional)</mat-label>
            <input matInput [matDatepicker]="picker" formControlName="expiryDate">
            <mat-hint>Select expiry date for this batch</mat-hint>
            <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
            <mat-datepicker #picker></mat-datepicker>
          </mat-form-field>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" 
              (click)="onSubmit()" 
              [disabled]="!updateForm.valid || getNewStockLevel() > data.inventory.maxCapacity">
        Update Stock
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .stock-update-form {
      min-width: 400px;
      padding: 16px 0;
    }

    .current-stock-info {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
    }

    .current-stock-info h4 {
      margin: 0 0 12px 0;
      color: #333;
      font-weight: 500;
    }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
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

    .update-fields {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .full-width {
      width: 100%;
    }

    .preview-section {
      background: #e3f2fd;
      padding: 16px;
      border-radius: 8px;
      border-left: 4px solid #2196f3;
    }

    .preview-section h4 {
      margin: 0 0 8px 0;
      color: #1976d2;
      font-weight: 500;
    }

    .preview-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .preview-info .label {
      font-weight: 500;
      color: #1976d2;
    }

    .preview-info .value {
      font-weight: 600;
      color: #1976d2;
      font-size: 1.1em;
    }

    .preview-info .value.warning {
      color: #f44336;
    }

    .warning-message {
      margin-top: 8px;
      color: #f44336;
      font-weight: 500;
      font-size: 0.9em;
    }

    mat-dialog-actions {
      padding: 16px 0 0 0;
    }
  `]
})
export class StockUpdateDialogComponent {
  updateForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<StockUpdateDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { inventory: MillInventory }
  ) {
    this.updateForm = this.fb.group({
      operation: ['add', Validators.required],
      quantity: [0, [Validators.required, Validators.min(0.1)]],
      batchNumber: [''],
      unitCost: [data.inventory.unitCost || ''],
      expiryDate: ['']
    });

    // Update validators when operation changes
    this.updateForm.get('operation')?.valueChanges.subscribe((operation) => {
      const quantityControl = this.updateForm.get('quantity');
      if (operation === 'set') {
        quantityControl?.setValidators([
          Validators.required,
          Validators.min(0),
          Validators.max(this.data.inventory.maxCapacity)
        ]);
      } else {
        quantityControl?.setValidators([
          Validators.required,
          Validators.min(0.1)
        ]);
      }
      quantityControl?.updateValueAndValidity();
    });
  }

  getNewStockLevel(): number {
    const quantity = this.updateForm.get('quantity')?.value || 0;
    const operation = this.updateForm.get('operation')?.value;
    
    if (operation === 'add') {
      return this.data.inventory.currentStock + quantity;
    } else {
      return quantity;
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  onSubmit(): void {
    if (this.updateForm.valid) {
      const formValue = this.updateForm.value;
      const updateData: UpdateStockRequest = {
        quantity: formValue.quantity,
        operation: formValue.operation,
        batchNumber: formValue.batchNumber || undefined,
        unitCost: formValue.unitCost || undefined,
        expiryDate: formValue.expiryDate ? formValue.expiryDate.toISOString() : undefined
      };

      this.dialogRef.close(updateData);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}