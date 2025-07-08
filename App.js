import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './LoginScreen';
import VoiceRecorderScreen from './VoiceRecorderScreen';
import CustomerIdScreen from './CustomerIdScreen';
import LocalRecordingsScreen from './LocalRecordingsScreen';
import * as SecureStore from 'expo-secure-store';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkLoginStatus = async () => {
      const token = await SecureStore.getItemAsync('userToken');
      if (token) {
        setIsLoggedIn(true);
      }
    };
    checkLoginStatus();
  }, []);

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('userToken');
    setIsLoggedIn(false);
  };

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {isLoggedIn ? (
          <Stack.Group>
            <Stack.Screen name="VoiceRecorder" options={{ headerShown: false }}>
              {(props) => <VoiceRecorderScreen {...props} onLogout={handleLogout} />}
            </Stack.Screen>
            <Stack.Screen name="CustomerId" component={CustomerIdScreen} options={{ headerShown: false }} />
            <Stack.Screen name="LocalRecordings" component={LocalRecordingsScreen} options={{ headerShown: false }} />
          </Stack.Group>
        ) : (
          <Stack.Screen name="Login" options={{ headerShown: false }}>
            {(props) => <LoginScreen {...props} onLogin={handleLogin} />}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}