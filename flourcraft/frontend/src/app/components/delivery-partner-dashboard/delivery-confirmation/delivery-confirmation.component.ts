import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

interface DeliveryConfirmationData {
  orderId: string;
  location: {
    latitude: number;
    longitude: number;
  };
}

@Component({
  selector: 'app-delivery-confirmation',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatCheckboxModule,
    ReactiveFormsModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>location_on</mat-icon>
      Confirm Delivery
    </h2>
    
    <mat-dialog-content class="delivery-confirmation-content">
      <div class="location-info">
        <h4>📍 Delivery Location Captured</h4>
        <div class="coordinates">
          <p><strong>Latitude:</strong> {{ data.location.latitude.toFixed(6) }}</p>
          <p><strong>Longitude:</strong> {{ data.location.longitude.toFixed(6) }}</p>
          <p><strong>Timestamp:</strong> {{ getCurrentTime() }}</p>
        </div>
      </div>

      <form [formGroup]="confirmationForm" class="confirmation-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Delivery Notes (Optional)</mat-label>
          <textarea 
            matInput 
            formControlName="deliveryNotes"
            rows="3"
            placeholder="Add any notes about the delivery..."
            maxlength="200">
          </textarea>
          <mat-hint align="end">{{ confirmationForm.get('deliveryNotes')?.value?.length || 0 }}/200</mat-hint>
        </mat-form-field>

        <div class="delivery-options">
          <h4>Delivery Confirmation</h4>
          
          <mat-checkbox formControlName="customerReceived" class="delivery-checkbox">
            Customer received the order personally
          </mat-checkbox>
          
          <mat-checkbox formControlName="leftAtDoor" class="delivery-checkbox">
            Left at door/security (if customer not available)
          </mat-checkbox>
          
          <mat-form-field appearance="outline" class="full-width" 
                         *ngIf="confirmationForm.get('leftAtDoor')?.value">
            <mat-label>Person who received (Name)</mat-label>
            <input matInput formControlName="receiverName" placeholder="Enter receiver's name">
          </mat-form-field>
        </div>

        <div class="payment-confirmation" *ngIf="needsPaymentConfirmation()">
          <h4>Payment Status</h4>
          <mat-checkbox formControlName="paymentReceived" class="delivery-checkbox">
            Cash payment received (if COD)
          </mat-checkbox>
          
          <mat-form-field appearance="outline" class="full-width" 
                         *ngIf="confirmationForm.get('paymentReceived')?.value">
            <mat-label>Amount Received</mat-label>
            <input matInput type="number" formControlName="amountReceived" placeholder="0.00">
            <span matPrefix>₹&nbsp;</span>
          </mat-form-field>
        </div>

        <div class="photo-section">
          <h4>Delivery Photo (Optional)</h4>
          <div class="photo-upload">
            <input type="file" 
                   accept="image/*" 
                   capture="environment"
                   (change)="onPhotoSelected($event)"
                   #photoInput
                   style="display: none;">
            
            <button type="button" mat-stroked-button (click)="photoInput.click()">
              <mat-icon>camera_alt</mat-icon>
              Take Photo
            </button>
            
            <div class="photo-preview" *ngIf="selectedPhoto">
              <img [src]="photoPreviewUrl" alt="Delivery photo" />
              <button type="button" mat-icon-button (click)="removePhoto()">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          </div>
        </div>
      </form>

      <div class="delivery-summary">
        <h4>Delivery Summary</h4>
        <div class="summary-item">
          <span>Location Verified:</span>
          <mat-icon color="primary">check_circle</mat-icon>
        </div>
        <div class="summary-item">
          <span>Timestamp:</span>
          <span>{{ getCurrentTime() }}</span>
        </div>
        <div class="summary-item">
          <span>GPS Accuracy:</span>
          <span>Good</span>
        </div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" 
              (click)="onConfirm()" 
              [disabled]="!canConfirm()">
        <mat-icon>done</mat-icon>
        Confirm Delivery
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .delivery-confirmation-content {
      min-width: 450px;
      max-width: 600px;
      padding: 16px 0;
    }

    .location-info {
      background: #e8f5e8;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      border-left: 4px solid #4caf50;
    }

    .location-info h4 {
      margin: 0 0 12px 0;
      color: #2e7d32;
      font-weight: 500;
    }

    .coordinates {
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }

    .coordinates p {
      margin: 4px 0;
      color: #333;
    }

    .confirmation-form {
      margin-bottom: 24px;
    }

    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }

    .delivery-options,
    .payment-confirmation,
    .photo-section {
      margin-bottom: 24px;
    }

    .delivery-options h4,
    .payment-confirmation h4,
    .photo-section h4 {
      margin: 0 0 12px 0;
      color: #333;
      font-weight: 500;
    }

    .delivery-checkbox {
      display: block;
      margin-bottom: 12px;
    }

    .photo-upload {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .photo-preview {
      position: relative;
      display: inline-block;
      max-width: 200px;
    }

    .photo-preview img {
      width: 100%;
      height: auto;
      border-radius: 8px;
      border: 2px solid #e0e0e0;
    }

    .photo-preview button {
      position: absolute;
      top: -8px;
      right: -8px;
      background: #f44336;
      color: white;
    }

    .delivery-summary {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 16px;
    }

    .delivery-summary h4 {
      margin: 0 0 12px 0;
      color: #333;
      font-weight: 500;
    }

    .summary-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
    }

    .summary-item:first-child mat-icon {
      color: #4caf50;
    }

    mat-dialog-actions {
      padding: 16px 0 0 0;
    }

    @media (max-width: 600px) {
      .delivery-confirmation-content {
        min-width: 300px;
      }
    }
  `]
})
export class DeliveryConfirmationComponent {
  confirmationForm: FormGroup;
  selectedPhoto: File | null = null;
  photoPreviewUrl: string | null = null;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<DeliveryConfirmationComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DeliveryConfirmationData
  ) {
    this.confirmationForm = this.fb.group({
      deliveryNotes: [''],
      customerReceived: [true],
      leftAtDoor: [false],
      receiverName: [''],
      paymentReceived: [false],
      amountReceived: ['']
    });

    // Set up form validators based on selections
    this.setupFormValidators();
  }

  private setupFormValidators(): void {
    // Watch for leftAtDoor changes
    this.confirmationForm.get('leftAtDoor')?.valueChanges.subscribe(leftAtDoor => {
      const receiverNameControl = this.confirmationForm.get('receiverName');
      if (leftAtDoor) {
        receiverNameControl?.setValidators([Validators.required]);
        // Uncheck customerReceived if leftAtDoor is checked
        this.confirmationForm.get('customerReceived')?.setValue(false);
      } else {
        receiverNameControl?.clearValidators();
      }
      receiverNameControl?.updateValueAndValidity();
    });

    // Watch for customerReceived changes
    this.confirmationForm.get('customerReceived')?.valueChanges.subscribe(customerReceived => {
      if (customerReceived) {
        // Uncheck leftAtDoor if customerReceived is checked
        this.confirmationForm.get('leftAtDoor')?.setValue(false);
      }
    });

    // Watch for paymentReceived changes
    this.confirmationForm.get('paymentReceived')?.valueChanges.subscribe(paymentReceived => {
      const amountControl = this.confirmationForm.get('amountReceived');
      if (paymentReceived) {
        amountControl?.setValidators([Validators.required, Validators.min(0.01)]);
      } else {
        amountControl?.clearValidators();
      }
      amountControl?.updateValueAndValidity();
    });
  }

  needsPaymentConfirmation(): boolean {
    // In a real app, this would check the order's payment method
    // For now, we'll show it for demonstration
    return true;
  }

  onPhotoSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedPhoto = file;
      
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        this.photoPreviewUrl = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  removePhoto(): void {
    this.selectedPhoto = null;
    this.photoPreviewUrl = null;
  }

  getCurrentTime(): string {
    return new Date().toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  canConfirm(): boolean {
    const formValue = this.confirmationForm.value;
    
    // Must have either customerReceived or leftAtDoor checked
    const deliveryConfirmed = formValue.customerReceived || formValue.leftAtDoor;
    
    // If leftAtDoor is checked, receiverName is required
    const receiverNameValid = !formValue.leftAtDoor || 
      (formValue.leftAtDoor && formValue.receiverName && formValue.receiverName.trim());
    
    // If paymentReceived is checked, amountReceived is required
    const paymentValid = !formValue.paymentReceived || 
      (formValue.paymentReceived && formValue.amountReceived && formValue.amountReceived > 0);

    return deliveryConfirmed && receiverNameValid && paymentValid;
  }

  onConfirm(): void {
    if (this.canConfirm()) {
      const formValue = this.confirmationForm.value;
      
      const deliveryData = {
        orderId: this.data.orderId,
        latitude: this.data.location.latitude,
        longitude: this.data.location.longitude,
        deliveryNotes: formValue.deliveryNotes || undefined,
        deliveryMethod: formValue.customerReceived ? 'CUSTOMER_RECEIVED' : 'LEFT_AT_LOCATION',
        receiverName: formValue.receiverName || undefined,
        paymentReceived: formValue.paymentReceived || false,
        amountReceived: formValue.amountReceived || undefined,
        photoUrl: this.photoPreviewUrl || undefined, // In real app, upload to cloud storage first
        timestamp: new Date().toISOString()
      };

      this.dialogRef.close(deliveryData);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}