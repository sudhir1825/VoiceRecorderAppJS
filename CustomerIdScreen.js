import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  SafeAreaView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export default function CustomerIdScreen({ route, navigation }) {
  const { recordedUri, durationMillis, agentId } = route.params;
  console.log('CustomerIdScreen received recordedUri:', recordedUri);
  const [customerId, setCustomerId] = useState('');
  const [playbackObject, setPlaybackObject] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const playSound = async () => {
    if (recordedUri) {
      try {
        console.log('Loading Sound');
        const { sound } = await Audio.Sound.createAsync(
          { uri: recordedUri },
          { shouldPlay: true }
        );
        setPlaybackObject(sound);
        setIsPlaying(true);
        console.log('Playing Sound');
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            setIsPlaying(false);
            sound.unloadAsync();
          }
        });
      } catch (error) {
        console.error('Error playing sound:', error);
        Alert.alert('Error', 'Could not play the recorded audio.');
      }
    }
  };

  const pauseSound = async () => {
    if (playbackObject) {
      console.log('Pausing Sound');
      await playbackObject.pauseAsync();
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    return () => {
      if (playbackObject) {
        playbackObject.unloadAsync();
      }
    };
  }, [playbackObject]);

  const handleSubmit = async () => {
    if (!customerId.trim()) {
      setErrorMessage('Please enter a Customer ID.');
      return;
    }
    setErrorMessage(''); // Clear error message if valid

    const formatTime = (ms) => {
      const totalSec = Math.floor(ms / 1000);
      const hours = Math.floor(totalSec / 3600).toString().padStart(2, '0');
      const min = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
      const sec = (totalSec % 60).toString().padStart(2, '0');
      return `${hours}:${min}:${sec}`;
    };

    try {
      const newRecording = {
        id: uuidv4(),
        uri: recordedUri,
        customerNumber: customerId,
        agentId: agentId, // Assuming agentId is available from context
        uploaded: false, // Flag to indicate if it's uploaded to server
        timestamp: new Date().toISOString(),
        duration: formatTime(durationMillis), // Store the formatted duration
      };

      const existingRecordings = await AsyncStorage.getItem('localRecordings');
      const recordings = existingRecordings ? JSON.parse(existingRecordings) : [];

      // Check if a recording with the same URI already exists
      const isDuplicate = recordings.some(rec => rec.uri === newRecording.uri);

      if (isDuplicate) {
        Alert.alert(
          'Duplicate Recording',
          'This audio recording has already been saved locally.'
        );
        return; // Stop the function if it's a duplicate
      }

      recordings.push(newRecording);
      await AsyncStorage.setItem('localRecordings', JSON.stringify(recordings));

      Alert.alert(
        'Recording Saved Locally',
        'Audio and Customer Number have been saved to local storage.'
      );
      navigation.goBack(); // Go back to VoiceRecorderScreen
    } catch (error) {
      console.error('Error saving recording locally:', error);
      Alert.alert('Error', 'Failed to save recording locally.');
    }
  };

  return (
    <LinearGradient
      colors={['#D62F55', '#EE6382']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Customer Information</Text>
          <View style={{ width: 24 }} />{/* Spacer to balance title */}
        </View>
        <View style={styles.content}>
            <View style={styles.audioPlaybackContainer}>
              <Text style={styles.audioLabel}>Recorded Audio:</Text>
              {recordedUri ? (
                <View style={styles.audioControls}>
                  <TouchableOpacity onPress={isPlaying ? pauseSound : playSound} style={styles.playButton}>
                    <MaterialIcons
                      name={isPlaying ? "pause" : "play-arrow"}
                      size={32}
                      color="#D62F55"
                    />
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.noAudioText}>No audio recorded.</Text>
              )}
            </View>

          <Text style={styles.label}>Enter Customer Number:</Text>
          <TextInput
            style={styles.input}
            onChangeText={(text) => {
              setCustomerId(text);
              if (text.trim()) setErrorMessage(''); // Clear error on typing
            }}
            value={customerId}
            placeholder="e.g., CUST12345"
            placeholderTextColor="#999"
            keyboardType="default"
            autoCapitalize="none"
          />
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <TouchableOpacity onPress={handleSubmit} style={styles.submitButton}>
            <LinearGradient
              colors={['#A020F0', '#C71585']}
              style={styles.submitButtonGradient}
            >
              <Text style={styles.submitButtonText}>Submit Audio and Number</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioPlaybackContainer: {
    width: '90%',
    alignItems: 'center',
    marginBottom: 30,
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  audioLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#555',
  },
  audioControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  playButton: {
    backgroundColor: '#fff',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  uriText: {
    fontSize: 14,
    color: '#666',
    flexShrink: 1,
  },
  noAudioText: {
    fontSize: 16,
    color: '#888',
    fontStyle: 'italic',
  },
  label: {
    fontSize: 20,
    marginBottom: 10,
    color: '#fff',
    alignSelf: 'center',
    width: '90%',
  },
  input: {
    width: '80%',
    height: 50,
    borderColor: '#ADD8E6',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 10,
    fontSize: 18,
    backgroundColor: '#FFFFFF',
    color: '#333',
  },
  errorText: {
    color: '#FFD700',
    fontSize: 14,
    marginBottom: 20,
    alignSelf: 'flex-start',
    width: '90%',
  },
  submitButton: {
    width: '80%',
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  submitButtonGradient: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
