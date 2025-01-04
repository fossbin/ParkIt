import { Alert } from 'react-native';

// Validation utility types
interface ValidationRule<T> {
  validate: (value: T) => boolean;
  errorMessage: string;
}

interface ComplexValidationRule<T> {
  validate: (value: T, additionalContext?: any) => boolean;
  errorMessage: string;
}

class Validator {
  // Basic required field validation
  static required(value: any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }

  // Price validation
  static validatePrice(price: string): { isValid: boolean; errorMessage?: string } {
    const priceNum = Number(price);
    
    if (!this.required(price)) {
      return { 
        isValid: false, 
        errorMessage: 'Price is required' 
      };
    }

    if (isNaN(priceNum) || priceNum <= 0) {
      return { 
        isValid: false, 
        errorMessage: 'Please enter a valid positive price' 
      };
    }

    return { isValid: true };
  }

  // Capacity validation
  static validateCapacity(capacity: string): { isValid: boolean; errorMessage?: string } {
    const capacityNum = Number(capacity);

    if (!this.required(capacity)) {
      return { 
        isValid: false, 
        errorMessage: 'Capacity is required' 
      };
    }

    if (isNaN(capacityNum) || capacityNum <= 0 || !Number.isInteger(capacityNum)) {
      return { 
        isValid: false, 
        errorMessage: 'Capacity must be a positive whole number' 
      };
    }

    // Optional: Add reasonable capacity limit
    if (capacityNum > 50) {
      return { 
        isValid: false, 
        errorMessage: 'Capacity cannot exceed 50 vehicles' 
      };
    }

    return { isValid: true };
  }

  // Vehicle types validation
  static validateVehicleTypes(types: string[]): { isValid: boolean; errorMessage?: string } {
    if (!types || types.length === 0) {
      return { 
        isValid: false, 
        errorMessage: 'Select at least one vehicle type' 
      };
    }

    return { isValid: true };
  }

  // Photo validation
  static validatePhotos(photos: any[], maxPhotos: number = 5): { isValid: boolean; errorMessage?: string } {
    if (!photos || photos.length === 0) {
      return { 
        isValid: false, 
        errorMessage: 'Upload at least one photo' 
      };
    }

    if (photos.length > maxPhotos) {
      return { 
        isValid: false, 
        errorMessage: `Maximum ${maxPhotos} photos allowed` 
      };
    }

    return { isValid: true };
  }

  // Location validation
  static validateLocation(location: { latitude: number; longitude: number } | null): { isValid: boolean; errorMessage?: string } {
    if (!location || !location.latitude || !location.longitude) {
      return { 
        isValid: false, 
        errorMessage: 'Please select a valid location' 
      };
    }

    // Optional: Add geographic bounds validation
    const isWithinValidBounds = 
      location.latitude >= -90 && location.latitude <= 90 &&
      location.longitude >= -180 && location.longitude <= 180;

    if (!isWithinValidBounds) {
      return { 
        isValid: false, 
        errorMessage: 'Invalid geographic coordinates' 
      };
    }

    return { isValid: true };
  }

  // Document validation
  static validateDocument(document: any): { isValid: boolean; errorMessage?: string } {
    if (!document) {
      return { 
        isValid: false, 
        errorMessage: 'Ownership document is required' 
      };
    }

    // Optional: Additional document type or size validation
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (document.size && document.size > MAX_FILE_SIZE) {
      return { 
        isValid: false, 
        errorMessage: 'Document size must be less than 5MB' 
      };
    }

    return { isValid: true };
  }

  // Comprehensive form validation
  static validateCreateSpotForm(formData: {
    title: string;
    price: string;
    capacity: string;
    vehicleTypesAllowed: string[];
    photos: any[];
    location: { latitude: number; longitude: number } | null;
    ownershipDocument: any;
  }): { isValid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};

    // Validate each field
    const titleValidation = this.required(formData.title) ? 
      { isValid: true } : 
      { isValid: false, errorMessage: 'Title is required' };

    const priceValidation = this.validatePrice(formData.price);
    const capacityValidation = this.validateCapacity(formData.capacity);
    const vehicleTypesValidation = this.validateVehicleTypes(formData.vehicleTypesAllowed);
    const photosValidation = this.validatePhotos(formData.photos);
    const locationValidation = this.validateLocation(formData.location);
    const documentValidation = this.validateDocument(formData.ownershipDocument);

    // Collect errors
    if (!titleValidation.isValid) errors.title = titleValidation.errorMessage || 'Title is required';
    if (!priceValidation.isValid) errors.price = priceValidation.errorMessage || 'Price is required';
    if (!capacityValidation.isValid) errors.capacity = capacityValidation.errorMessage || 'Capacity is required';
    if (!vehicleTypesValidation.isValid) errors.vehicleTypes = vehicleTypesValidation.errorMessage || 'Vehicle types is required';
    if (!photosValidation.isValid) errors.photos = photosValidation.errorMessage || 'Photos are required';
    if (!locationValidation.isValid) errors.location = locationValidation.errorMessage || 'Location is required';
    if (!documentValidation.isValid) errors.document = documentValidation.errorMessage || 'Document is required';

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  // Utility method to show validation alert
  static showValidationAlert(errors: Record<string, string>) {
    const errorMessages = Object.values(errors).join('\n');
    Alert.alert(
      'Validation Error', 
      errorMessages, 
      [{ text: 'OK' }]
    );
  }
}

export default Validator;