import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export const getCurrentLocation = async (): Promise<string | null> => {
  return new Promise((resolve, reject) => {
    if (Platform.OS === 'android') {
      PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      ).then(result => {
        if (result === PermissionsAndroid.RESULTS.GRANTED) {
          Geolocation.getCurrentPosition(
            position => {
              const { latitude, longitude } = position.coords;
              resolve(`Latitude: ${latitude}, Longitude: ${longitude}`);
            },
            error => reject(error),
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
          );
        } else {
          reject(new Error('Location permission denied'));
        }
      }).catch(error => reject(error));
    } else {
      Geolocation.requestAuthorization();  
      Geolocation.getCurrentPosition(
        position => {
          const { latitude, longitude } = position.coords;
          resolve(`Latitude: ${latitude}, Longitude: ${longitude}`);
        },
        error => reject(error),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
      );
    }
  });
};
