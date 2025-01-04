  interface User {
    id: string;
    name: string | null;
    email: string;
    phone_number: string | null;
    created_at: string | null;
  }

  export interface UserProfile {
    id: string;
    email: string;
    name: string | null;
    phone_number: string | null;
    created_at: string | null;
    profile_picture: {
      url: string;
      filename: string;
    } | null;
  }
  
  export interface Booking {
    vehicle: any;
    id: string;
    renter_id: string | null;
    parking_space_id: string | null;
    booking_start: string;
    booking_end: string;
    price: number | null;
    status: 'Confirmed' | 'Completed' | 'Cancelled';
    created_at: string | null;
    vehicle_id: string | null;
    renter: User;
  }

  export type ParkingSpaceStatus = 'Pending' | 'Approved' | 'Rejected';
  export type ParkingSpaceType = 'Public' | 'Lender-provided' | 'Non-accountable';
  export type AddedBy = 'Lender' | 'Admin' | 'User-Suggestion';
  
  export interface ParkingSpace {
    bookings: Booking[];
    id: string;
    title: string;
    type: ParkingSpaceType;
    price: number;
    capacity: number;
    vehicle_types_allowed: string[];
    photos: string[]; 
    occupancy: number;
    verified: boolean;
    review_score: number;
    status: ParkingSpaceStatus;
    latitude: number;
    longitude: number;
    rejection_reason?: string;
    user_id?: string | null;
    created_at: string;  
    added_by?: AddedBy;
  }

  export type PartialParkingSpace = Partial<ParkingSpace>;
  
  export interface ParkingSpaceListProps {
    spaces: ParkingSpace[];
    onEditSpace?: (space: ParkingSpace) => void;
    onDelete?: (spaceId: string) => void;
    onVerify?: (spaceId: string, verified: boolean) => void;
    onUpdateStatus?: (spaceId: string, status: ParkingSpaceStatus, rejectionReason?: string) => void;
    showActions?: boolean;
    showVerification?: boolean;
    showStatus?: boolean;
    loading?: boolean;
  }

  // Update the RootStackParamList with your full navigation structure
  export type RootStackParamList = {
    RenterHomeScreen: undefined;
    LenderHomeScreen: undefined;
    AdminHomeScreen: undefined;
    MapScreen: undefined;
    Account: undefined;
    Auth: undefined;
    CreateSpot: undefined;
    RoleSelection: undefined;
    TabNavigatorRenter: undefined;
    TabNavigatorLender: undefined;
    TabNavigatorAdmin: undefined;
    BookingScreen: {
      parkingSpaceId: string;
      parkingSpace: ParkingSpace;
    };
    CreateReview: { parkingSpaceId: string; onReviewAdded: () => Promise<void> };
    ParkingSpotDetails: { parkingSpaceId: string };
    PendingSpots: undefined;
    EditLenderSpace: { parkingSpace: ParkingSpace };
    ApprovalReview: undefined;
    VerificationStatus: undefined;
    AdminDashboard: undefined;
    PendingSpaces: undefined;
    ApprovedSpaces: undefined;
    SpaceDetails: { spaceId: string };
    ManagePublicSpaces: undefined;
    EditPublicSpace: {
      spaceId: string;
      onUpdate?: () => void;
    };
    CreatePublicSpace: {
      onCreate?: () => void;
    };
    LenderPendingSpaces: undefined;
    ManageLenderSpaces: undefined;
    UserSuggestedSpaces: undefined;
    ManageUserSuggestions: undefined;
    AccountDetails: undefined;
    WalletScreen: undefined;
    SuggestedSpaces: undefined;
    SupportTicket: undefined;
    HelpAndSupport: undefined;
    SignOut: undefined;
    AddVehicle: undefined;
    EditVehicle:{ vehicleId: string;  };
    VehicleDetails: undefined;
    PreviousBookings: undefined;
    UpcomingBookings: undefined;
    DocumentUpload: undefined;
    SuggestParkingSpace: { location: SuggestionLocation };
  };
  
  export interface ParkingSpaceLocation {
    parking_space_id: string;
    parkingSpace: ParkingSpace;
  }
  
  export interface DatabaseParkingSpace extends Omit<ParkingSpace, 'lender'> {
    lender?: User | null;
  }
  
  export interface DatabaseParkingLocation {
    parking_space_id: string;
    parkingSpace: DatabaseParkingSpace;
  }

  export type SuggestionLocation = {
    latitude: number;
    longitude: number;
  };
