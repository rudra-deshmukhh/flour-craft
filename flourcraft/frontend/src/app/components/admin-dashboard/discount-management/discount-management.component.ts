import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

import { AdminService, Discount, Product } from '../../../services/admin.service';

@Component({
  selector: 'app-discount-management',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSlideToggleModule,
    MatChipsModule,
    MatDialogModule,
    MatSnackBarModule,
    ReactiveFormsModule
  ],
  template: `
    <div class="discount-management">
      <!-- Header -->
      <div class="management-header">
        <h2>Discount Management</h2>
        <div class="header-actions">
          <button mat-raised-button color="primary" (click)="openDiscountDialog()">
            <mat-icon>add</mat-icon>
            Create Discount
          </button>
          <button mat-raised-button (click)="refreshData()">
            <mat-icon>refresh</mat-icon>
            Refresh
          </button>
        </div>
      </div>

      <!-- Filters -->
      <mat-card class="filters-card">
        <mat-card-content>
          <div class="filters-grid">
            <mat-form-field appearance="outline">
              <mat-label>Status</mat-label>
              <mat-select [(ngModel)]="statusFilter" (selectionChange)="applyFilters()">
                <mat-option value="all">All Discounts</mat-option>
                <mat-option value="active">Active</mat-option>
                <mat-option value="inactive">Inactive</mat-option>
                <mat-option value="expired">Expired</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Type</mat-label>
              <mat-select [(ngModel)]="typeFilter" (selectionChange)="applyFilters()">
                <mat-option value="all">All Types</mat-option>
                <mat-option value="PERCENTAGE">Percentage</mat-option>
                <mat-option value="FIXED_AMOUNT">Fixed Amount</mat-option>
                <mat-option value="BUY_X_GET_Y">Buy X Get Y</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Search</mat-label>
              <input matInput [(ngModel)]="searchTerm" (input)="applyFilters()" placeholder="Search discounts...">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Discounts Table -->
      <mat-card class="table-card">
        <mat-card-content>
          <div class="table-container">
            <table mat-table [dataSource]="filteredDiscounts" class="discounts-table">
              
              <!-- Name Column -->
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Name</th>
                <td mat-cell *matCellDef="let discount">
                  <div class="discount-name">
                    <strong>{{ discount.name }}</strong>
                    <p class="description">{{ discount.description }}</p>
                  </div>
                </td>
              </ng-container>

              <!-- Type & Value Column -->
              <ng-container matColumnDef="value">
                <th mat-header-cell *matHeaderCellDef>Type & Value</th>
                <td mat-cell *matCellDef="let discount">
                  <div class="discount-value">
                    <mat-chip [color]="getTypeColor(discount.type)" selected>
                      {{ discount.type }}
                    </mat-chip>
                    <div class="value-display">
                      <span *ngIf="discount.type === 'PERCENTAGE'">{{ discount.value }}% off</span>
                      <span *ngIf="discount.type === 'FIXED_AMOUNT'">₹{{ discount.value }} off</span>
                      <span *ngIf="discount.type === 'BUY_X_GET_Y'">
                        Buy {{ discount.conditions?.buyQuantity }} Get {{ discount.conditions?.getQuantity }}
                      </span>
                    </div>
                  </div>
                </td>
              </ng-container>

              <!-- Validity Column -->
              <ng-container matColumnDef="validity">
                <th mat-header-cell *matHeaderCellDef>Validity Period</th>
                <td mat-cell *matCellDef="let discount">
                  <div class="validity-info">
                    <div class="dates">
                      <p><strong>Start:</strong> {{ formatDate(discount.startDate) }}</p>
                      <p><strong>End:</strong> {{ formatDate(discount.endDate) }}</p>
                    </div>
                    <mat-chip [color]="getValidityColor(discount)" selected>
                      {{ getValidityStatus(discount) }}
                    </mat-chip>
                  </div>
                </td>
              </ng-container>

              <!-- Conditions Column -->
              <ng-container matColumnDef="conditions">
                <th mat-header-cell *matHeaderCellDef>Conditions</th>
                <td mat-cell *matCellDef="let discount">
                  <div class="conditions-info">
                    <div *ngIf="discount.minOrderAmount" class="condition-item">
                      <mat-icon>attach_money</mat-icon>
                      <span>Min order: ₹{{ discount.minOrderAmount }}</span>
                    </div>
                    <div *ngIf="discount.maxDiscountAmount" class="condition-item">
                      <mat-icon>money_off</mat-icon>
                      <span>Max discount: ₹{{ discount.maxDiscountAmount }}</span>
                    </div>
                    <div *ngIf="discount.usageLimit" class="condition-item">
                      <mat-icon>confirmation_number</mat-icon>
                      <span>{{ discount.usedCount }}/{{ discount.usageLimit }} used</span>
                    </div>
                  </div>
                </td>
              </ng-container>

              <!-- Applicable Products Column -->
              <ng-container matColumnDef="products">
                <th mat-header-cell *matHeaderCellDef>Applicable To</th>
                <td mat-cell *matCellDef="let discount">
                  <div class="applicable-info">
                    <div *ngIf="!discount.applicableProducts?.length && !discount.applicableCategories?.length">
                      <mat-chip color="primary" selected>All Products</mat-chip>
                    </div>
                    <div *ngIf="discount.applicableProducts?.length">
                      <mat-chip *ngFor="let productId of discount.applicableProducts.slice(0, 2)" 
                               color="accent" selected>
                        {{ getProductName(productId) }}
                      </mat-chip>
                      <span *ngIf="discount.applicableProducts.length > 2">
                        +{{ discount.applicableProducts.length - 2 }} more
                      </span>
                    </div>
                    <div *ngIf="discount.applicableCategories?.length">
                      <mat-chip *ngFor="let category of discount.applicableCategories" 
                               color="accent" selected>
                        {{ category }}
                      </mat-chip>
                    </div>
                  </div>
                </td>
              </ng-container>

              <!-- Status Column -->
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let discount">
                  <mat-slide-toggle 
                    [checked]="discount.isActive"
                    (change)="toggleDiscountStatus(discount, $event.checked)"
                    [disabled]="isExpired(discount)">
                  </mat-slide-toggle>
                </td>
              </ng-container>

              <!-- Actions Column -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Actions</th>
                <td mat-cell *matCellDef="let discount">
                  <div class="action-buttons">
                    <button mat-icon-button (click)="editDiscount(discount)">
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button mat-icon-button (click)="viewDiscountDetails(discount)">
                      <mat-icon>visibility</mat-icon>
                    </button>
                    <button mat-icon-button color="warn" (click)="deleteDiscount(discount)">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;" 
                  [class.expired-row]="isExpired(row)"></tr>
            </table>

            <!-- No Data -->
            <div *ngIf="filteredDiscounts.length === 0" class="no-data">
              <mat-icon>local_offer</mat-icon>
              <h3>No discounts found</h3>
              <p>Create your first discount to start offering promotions to customers.</p>
              <button mat-raised-button color="primary" (click)="openDiscountDialog()">
                Create Discount
              </button>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>

    <!-- Discount Form Dialog -->
    <div class="discount-dialog" *ngIf="showDiscountDialog">
      <div class="dialog-backdrop" (click)="closeDiscountDialog()"></div>
      <div class="dialog-container">
        <mat-card class="dialog-card">
          <mat-card-header>
            <mat-card-title>
              {{ editingDiscount ? 'Edit Discount' : 'Create New Discount' }}
            </mat-card-title>
            <button mat-icon-button (click)="closeDiscountDialog()" class="close-button">
              <mat-icon>close</mat-icon>
            </button>
          </mat-card-header>

          <mat-card-content>
            <form [formGroup]="discountForm" class="discount-form">
              <!-- Basic Information -->
              <div class="form-section">
                <h4>Basic Information</h4>
                
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Discount Name</mat-label>
                  <input matInput formControlName="name" placeholder="e.g., Summer Sale 2024">
                  <mat-error *ngIf="discountForm.get('name')?.hasError('required')">
                    Name is required
                  </mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Description</mat-label>
                  <textarea matInput formControlName="description" rows="3" 
                           placeholder="Brief description of the discount"></textarea>
                </mat-form-field>
              </div>

              <!-- Discount Type & Value -->
              <div class="form-section">
                <h4>Discount Details</h4>
                
                <mat-form-field appearance="outline">
                  <mat-label>Discount Type</mat-label>
                  <mat-select formControlName="type" (selectionChange)="onDiscountTypeChange()">
                    <mat-option value="PERCENTAGE">Percentage Off</mat-option>
                    <mat-option value="FIXED_AMOUNT">Fixed Amount Off</mat-option>
                    <mat-option value="BUY_X_GET_Y">Buy X Get Y</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" *ngIf="discountForm.get('type')?.value !== 'BUY_X_GET_Y'">
                  <mat-label>Discount Value</mat-label>
                  <input matInput type="number" formControlName="value" 
                         [placeholder]="getValuePlaceholder()">
                  <span matPrefix *ngIf="discountForm.get('type')?.value === 'FIXED_AMOUNT'">₹</span>
                  <span matSuffix *ngIf="discountForm.get('type')?.value === 'PERCENTAGE'">%</span>
                </mat-form-field>
              </div>

              <!-- Buy X Get Y Conditions -->
              <div class="form-section" *ngIf="discountForm.get('type')?.value === 'BUY_X_GET_Y'">
                <h4>Buy X Get Y Details</h4>
                
                <div class="buy-get-grid">
                  <mat-form-field appearance="outline">
                    <mat-label>Buy Quantity</mat-label>
                    <input matInput type="number" formControlName="buyQuantity" min="1">
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Get Quantity</mat-label>
                    <input matInput type="number" formControlName="getQuantity" min="1">
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Free Product (Optional)</mat-label>
                    <mat-select formControlName="freeProductId">
                      <mat-option value="">Same Product</mat-option>
                      <mat-option *ngFor="let product of products" [value]="product.id">
                        {{ product.name }}
                      </mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>
              </div>

              <!-- Validity Period -->
              <div class="form-section">
                <h4>Validity Period</h4>
                
                <div class="date-grid">
                  <mat-form-field appearance="outline">
                    <mat-label>Start Date</mat-label>
                    <input matInput [matDatepicker]="startPicker" formControlName="startDate">
                    <mat-datepicker-toggle matSuffix [for]="startPicker"></mat-datepicker-toggle>
                    <mat-datepicker #startPicker></mat-datepicker>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>End Date</mat-label>
                    <input matInput [matDatepicker]="endPicker" formControlName="endDate">
                    <mat-datepicker-toggle matSuffix [for]="endPicker"></mat-datepicker-toggle>
                    <mat-datepicker #endPicker></mat-datepicker>
                  </mat-form-field>
                </div>
              </div>

              <!-- Conditions -->
              <div class="form-section">
                <h4>Additional Conditions</h4>
                
                <div class="conditions-grid">
                  <mat-form-field appearance="outline">
                    <mat-label>Minimum Order Amount</mat-label>
                    <input matInput type="number" formControlName="minOrderAmount" 
                           placeholder="Optional">
                    <span matPrefix>₹</span>
                  </mat-form-field>

                  <mat-form-field appearance="outline" 
                                 *ngIf="discountForm.get('type')?.value === 'PERCENTAGE'">
                    <mat-label>Maximum Discount Amount</mat-label>
                    <input matInput type="number" formControlName="maxDiscountAmount" 
                           placeholder="Optional">
                    <span matPrefix>₹</span>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Usage Limit</mat-label>
                    <input matInput type="number" formControlName="usageLimit" 
                           placeholder="Unlimited">
                  </mat-form-field>
                </div>
              </div>

              <!-- Applicable Products -->
              <div class="form-section">
                <h4>Applicable Products</h4>
                
                <div class="applicability-options">
                  <mat-slide-toggle formControlName="applyToAllProducts" 
                                   (change)="onApplyToAllChange()">
                    Apply to all products
                  </mat-slide-toggle>
                </div>

                <div class="product-selection" *ngIf="!discountForm.get('applyToAllProducts')?.value">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Select Products</mat-label>
                    <mat-select formControlName="applicableProducts" multiple>
                      <mat-option *ngFor="let product of products" [value]="product.id">
                        {{ product.name }} - {{ product.category }}
                      </mat-option>
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Or Select Categories</mat-label>
                    <mat-select formControlName="applicableCategories" multiple>
                      <mat-option *ngFor="let category of categories" [value]="category">
                        {{ category }}
                      </mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>
              </div>

              <!-- Status -->
              <div class="form-section">
                <mat-slide-toggle formControlName="isActive">
                  Activate discount immediately
                </mat-slide-toggle>
              </div>
            </form>
          </mat-card-content>

          <mat-card-actions align="end">
            <button mat-button (click)="closeDiscountDialog()">Cancel</button>
            <button mat-raised-button color="primary" 
                   (click)="saveDiscount()" 
                   [disabled]="discountForm.invalid || isSaving">
              {{ isSaving ? 'Saving...' : (editingDiscount ? 'Update' : 'Create') }}
            </button>
          </mat-card-actions>
        </mat-card>
      </div>
    </div>
  `,
  styleUrls: ['./discount-management.component.scss']
})
export class DiscountManagementComponent implements OnInit {
  discounts: Discount[] = [];
  filteredDiscounts: Discount[] = [];
  products: Product[] = [];
  categories: string[] = [];

  displayedColumns = ['name', 'value', 'validity', 'conditions', 'products', 'status', 'actions'];

  // Filters
  statusFilter = 'all';
  typeFilter = 'all';
  searchTerm = '';

  // Dialog
  showDiscountDialog = false;
  editingDiscount: Discount | null = null;
  discountForm: FormGroup;
  isSaving = false;

  constructor(
    private adminService: AdminService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.discountForm = this.createDiscountForm();
  }

  ngOnInit(): void {
    this.loadData();
  }

  private createDiscountForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required]],
      description: [''],
      type: ['PERCENTAGE', [Validators.required]],
      value: [0, [Validators.required, Validators.min(0)]],
      buyQuantity: [1],
      getQuantity: [1],
      freeProductId: [''],
      startDate: [new Date(), [Validators.required]],
      endDate: [new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), [Validators.required]], // 30 days from now
      minOrderAmount: [null],
      maxDiscountAmount: [null],
      usageLimit: [null],
      applicableProducts: [[]],
      applicableCategories: [[]],
      applyToAllProducts: [true],
      isActive: [true]
    });
  }

  private loadData(): void {
    // Load discounts
    this.adminService.getDiscounts().subscribe({
      next: (response) => {
        if (response.success) {
          this.discounts = response.data;
          this.applyFilters();
        }
      },
      error: (error) => {
        this.snackBar.open('Failed to load discounts', 'Close', { duration: 3000 });
      }
    });

    // Load products
    this.adminService.getProducts().subscribe({
      next: (response) => {
        if (response.success) {
          this.products = response.data;
          this.categories = [...new Set(this.products.map(p => p.category))];
        }
      },
      error: (error) => {
        console.error('Failed to load products:', error);
      }
    });
  }

  // Filtering
  applyFilters(): void {
    let filtered = [...this.discounts];

    // Status filter
    if (this.statusFilter !== 'all') {
      switch (this.statusFilter) {
        case 'active':
          filtered = filtered.filter(d => d.isActive && !this.isExpired(d));
          break;
        case 'inactive':
          filtered = filtered.filter(d => !d.isActive);
          break;
        case 'expired':
          filtered = filtered.filter(d => this.isExpired(d));
          break;
      }
    }

    // Type filter
    if (this.typeFilter !== 'all') {
      filtered = filtered.filter(d => d.type === this.typeFilter);
    }

    // Search filter
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(d => 
        d.name.toLowerCase().includes(term) ||
        d.description.toLowerCase().includes(term)
      );
    }

    this.filteredDiscounts = filtered;
  }

  refreshData(): void {
    this.loadData();
    this.snackBar.open('Data refreshed', 'Close', { duration: 2000 });
  }

  // Dialog Management
  openDiscountDialog(discount?: Discount): void {
    this.editingDiscount = discount || null;
    this.showDiscountDialog = true;
    
    if (discount) {
      this.populateForm(discount);
    } else {
      this.discountForm.reset();
      this.discountForm.patchValue({
        type: 'PERCENTAGE',
        value: 0,
        buyQuantity: 1,
        getQuantity: 1,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        applyToAllProducts: true,
        isActive: true,
        applicableProducts: [],
        applicableCategories: []
      });
    }
  }

  closeDiscountDialog(): void {
    this.showDiscountDialog = false;
    this.editingDiscount = null;
    this.discountForm.reset();
  }

  private populateForm(discount: Discount): void {
    this.discountForm.patchValue({
      name: discount.name,
      description: discount.description,
      type: discount.type,
      value: discount.value,
      buyQuantity: discount.conditions?.buyQuantity || 1,
      getQuantity: discount.conditions?.getQuantity || 1,
      freeProductId: discount.conditions?.freeProductId || '',
      startDate: new Date(discount.startDate),
      endDate: new Date(discount.endDate),
      minOrderAmount: discount.minOrderAmount,
      maxDiscountAmount: discount.maxDiscountAmount,
      usageLimit: discount.usageLimit,
      applicableProducts: discount.applicableProducts || [],
      applicableCategories: discount.applicableCategories || [],
      applyToAllProducts: !discount.applicableProducts?.length && !discount.applicableCategories?.length,
      isActive: discount.isActive
    });
  }

  // Form Handlers
  onDiscountTypeChange(): void {
    const type = this.discountForm.get('type')?.value;
    
    if (type === 'PERCENTAGE') {
      this.discountForm.get('value')?.setValidators([Validators.required, Validators.min(0), Validators.max(100)]);
    } else {
      this.discountForm.get('value')?.setValidators([Validators.required, Validators.min(0)]);
    }
    
    this.discountForm.get('value')?.updateValueAndValidity();
  }

  onApplyToAllChange(): void {
    const applyToAll = this.discountForm.get('applyToAllProducts')?.value;
    
    if (applyToAll) {
      this.discountForm.get('applicableProducts')?.setValue([]);
      this.discountForm.get('applicableCategories')?.setValue([]);
    }
  }

  getValuePlaceholder(): string {
    const type = this.discountForm.get('type')?.value;
    switch (type) {
      case 'PERCENTAGE':
        return 'e.g., 20 (for 20% off)';
      case 'FIXED_AMOUNT':
        return 'e.g., 100 (for ₹100 off)';
      default:
        return '';
    }
  }

  // CRUD Operations
  saveDiscount(): void {
    if (this.discountForm.invalid) return;

    this.isSaving = true;
    const formValue = this.discountForm.value;
    
    const discountData: Partial<Discount> = {
      name: formValue.name,
      description: formValue.description,
      type: formValue.type,
      value: formValue.value,
      startDate: formValue.startDate.toISOString(),
      endDate: formValue.endDate.toISOString(),
      minOrderAmount: formValue.minOrderAmount || undefined,
      maxDiscountAmount: formValue.maxDiscountAmount || undefined,
      usageLimit: formValue.usageLimit || undefined,
      isActive: formValue.isActive
    };

    // Handle product/category applicability
    if (!formValue.applyToAllProducts) {
      if (formValue.applicableProducts?.length > 0) {
        discountData.applicableProducts = formValue.applicableProducts;
      }
      if (formValue.applicableCategories?.length > 0) {
        discountData.applicableCategories = formValue.applicableCategories;
      }
    }

    // Handle Buy X Get Y conditions
    if (formValue.type === 'BUY_X_GET_Y') {
      discountData.conditions = {
        buyQuantity: formValue.buyQuantity,
        getQuantity: formValue.getQuantity,
        freeProductId: formValue.freeProductId || undefined
      };
    }

    const operation = this.editingDiscount 
      ? this.adminService.updateDiscount(this.editingDiscount.id, discountData)
      : this.adminService.createDiscount(discountData);

    operation.subscribe({
      next: (response) => {
        if (response.success) {
          this.snackBar.open(
            this.editingDiscount ? 'Discount updated successfully' : 'Discount created successfully',
            'Close',
            { duration: 3000 }
          );
          this.closeDiscountDialog();
          this.loadData();
        }
        this.isSaving = false;
      },
      error: (error) => {
        this.snackBar.open('Failed to save discount', 'Close', { duration: 3000 });
        this.isSaving = false;
      }
    });
  }

  editDiscount(discount: Discount): void {
    this.openDiscountDialog(discount);
  }

  toggleDiscountStatus(discount: Discount, isActive: boolean): void {
    this.adminService.updateDiscount(discount.id, { isActive }).subscribe({
      next: (response) => {
        if (response.success) {
          discount.isActive = isActive;
          this.snackBar.open(
            `Discount ${isActive ? 'activated' : 'deactivated'} successfully`,
            'Close',
            { duration: 2000 }
          );
        }
      },
      error: (error) => {
        this.snackBar.open('Failed to update discount status', 'Close', { duration: 3000 });
        // Revert the toggle
        discount.isActive = !isActive;
      }
    });
  }

  deleteDiscount(discount: Discount): void {
    if (confirm(`Are you sure you want to delete "${discount.name}"?`)) {
      this.adminService.deleteDiscount(discount.id).subscribe({
        next: (response) => {
          if (response.success) {
            this.snackBar.open('Discount deleted successfully', 'Close', { duration: 2000 });
            this.loadData();
          }
        },
        error: (error) => {
          this.snackBar.open('Failed to delete discount', 'Close', { duration: 3000 });
        }
      });
    }
  }

  viewDiscountDetails(discount: Discount): void {
    // In a real implementation, this would open a detailed view dialog
    console.log('View discount details:', discount);
  }

  // Utility Methods
  getTypeColor(type: string): string {
    const colors = {
      'PERCENTAGE': 'primary',
      'FIXED_AMOUNT': 'accent',
      'BUY_X_GET_Y': 'warn'
    };
    return colors[type as keyof typeof colors] || 'primary';
  }

  getValidityStatus(discount: Discount): string {
    const now = new Date();
    const start = new Date(discount.startDate);
    const end = new Date(discount.endDate);

    if (now < start) return 'Not Started';
    if (now > end) return 'Expired';
    return 'Active';
  }

  getValidityColor(discount: Discount): string {
    const status = this.getValidityStatus(discount);
    switch (status) {
      case 'Active': return 'primary';
      case 'Not Started': return 'accent';
      case 'Expired': return 'warn';
      default: return 'primary';
    }
  }

  isExpired(discount: Discount): boolean {
    return new Date() > new Date(discount.endDate);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getProductName(productId: string): string {
    const product = this.products.find(p => p.id === productId);
    return product ? product.name : 'Unknown Product';
  }
}