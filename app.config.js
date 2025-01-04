import 'dotenv/config'; // Load the .env file

export default {
  expo: {
    name: "ParkIt",
    slug: "ParkIt",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true
    },
    android: {
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLEMAP_API,
        }
      },
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.fossbin.ParkIt"
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-secure-store"
    ],
    extra: {
      eas: {
        projectId: "c1c85a24-0ba9-497e-80fc-671b7ef78999"
      }
    },
    owner: "fossbin"
  }
};
