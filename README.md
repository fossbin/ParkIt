# ParkIt

ParkIt is a parking space application that helps users find and reserve parking spots in real-time. The app provides a seamless experience for locating available parking spaces, making reservations, and navigating to the parking location using Google Maps.

## Features

- Real-time parking space availability
- Reservation system
- Navigation to parking spots using Google Maps
- Integration with Supabase for backend services

## Getting Started

### Prerequisites

- Node.js
- Expo CLI
- Visual Studio
- Supabase account and API keys
- Google Maps API keys

### Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/yourusername/ParkIt.git
    cd ParkIt
    ```

2. Install dependencies:
    ```sh
    npm install
    ```

3. Add your Supabase and Google Maps API keys in the appropriate configuration files.

### Generating Expo APK

1. Build the project:
    ```sh
    expo build:android
    ```

2. Follow the instructions to generate the APK. You will need to log in to your Expo account.

### Generating Release Keystore

1. Generate a release keystore:
    ```sh
    keytool -genkey -v -keystore release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias your-key-alias
    ```

2. Follow the prompts to set up the keystore.

### Generating Debug Keystore

1. Generate a debug keystore:
    ```sh
    keytool -genkey -v -keystore debug-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias your-key-alias
    ```

2. Follow the prompts to set up the keystore.

### Reminder

- Ensure you have added your Supabase and Google Maps API keys in the appropriate configuration files before building the project.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is licensed under the MIT License.
