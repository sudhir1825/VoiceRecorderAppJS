import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  PanResponder,
  useWindowDimensions,
  Platform,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native'; // Import useNavigation
import * as FileSystem from 'expo-file-system';

import { LinearGradient } from 'expo-linear-gradient';


export default function VoiceRecorderScreen({ onLogout }) {
  const { width } = useWindowDimensions();
  const navigation = useNavigation(); // Initialize useNavigation

  const [recording, setRecording] = useState(null);
  const [recordedUri, setRecordedUri] = useState(null);
  const [sound, setSound] = useState(null);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0); // New state for recording duration

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const soundRef = useRef(null);
  const isSeeking = useRef(false);
  const progressBarWidth = useRef(0);
  const timerIntervalRef = useRef(null); // Ref to store the timer interval

  const animatePulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopPulse = () => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        alert('Permission is required to record audio');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeIOS: 1, // InterruptionModeIOS.DoNotMix
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setRecordedUri(null);
      stopPlayback();
      animatePulse();
      setRecordingDuration(0); // Reset duration
      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prevDuration) => prevDuration + 1);
      }, 1000); // Update every second
    } catch (error) {
      console.error('Start recording error:', error);
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      console.log('Temporary recording URI:', uri);
      setRecordedUri(uri);
      setRecording(null);
      stopPulse();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }

      const permanentUri = `${FileSystem.documentDirectory}${uri.split('/').pop()}`;
      console.log('Attempting to move to permanent URI:', permanentUri);
      await FileSystem.moveAsync({
        from: uri,
        to: permanentUri,
      });
      setRecordedUri(permanentUri);
      console.log('Permanent recording URI set to:', permanentUri);

      // New logic to get duration immediately
      if (permanentUri) {
        const { sound: newSound, status } = await Audio.Sound.createAsync(
          { uri: permanentUri },
          { shouldPlay: false } // Don't play, just load to get duration
        );
        if (status.isLoaded) {
          setDurationMillis(status.durationMillis);
          await newSound.unloadAsync(); // Unload immediately after getting duration
        }
      }

    } catch (error) {
      console.error('Stop recording error:', error);
    }
  };

  const togglePlayback = async () => {
    if (!recordedUri) return;

    try {
      if (!soundRef.current) {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          interruptionModeIOS: 1, // InterruptionModeIOS.DoNotMix
          playsThroughEarpieceAndroid: false,
        });

        const { sound } = await Audio.Sound.createAsync(
          { uri: recordedUri },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );

        soundRef.current = sound;
        setSound(sound);
        setIsPlaying(true);
      } else {
        const status = await soundRef.current.getStatusAsync();
        if (status.isPlaying) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
        } else {
          if (status.positionMillis >= status.durationMillis) {
            await soundRef.current.setPositionAsync(0);
          }
          await soundRef.current.playAsync();
          setIsPlaying(true);
        }
      }
    } catch (error) {
      console.error('Playback error:', error);
    }
  };

  const stopPlayback = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      setIsPlaying(false);
      setPositionMillis(0);
      setDurationMillis(0);
    }
  };

  const onPlaybackStatusUpdate = async (status) => {
    if (!status.isLoaded) return;

    if (status.didJustFinish && !status.isLooping) {
      setIsPlaying(false);
      setPositionMillis(0);
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        setSound(null);
      }
    } else if (!isSeeking.current) {
      setPositionMillis(status.positionMillis);
      setDurationMillis(status.durationMillis);
      setIsPlaying(status.isPlaying);
    }
  };

  const formatTime = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const hours = Math.floor(totalSec / 3600).toString().padStart(2, '0');
    const min = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
    const sec = (totalSec % 60).toString().padStart(2, '0');
    return `${hours}:${min}:${sec}`;
  };

  const getProgress = () =>
    durationMillis ? (positionMillis / durationMillis) * 100 : 0;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => (isSeeking.current = true),
      onPanResponderMove: (evt, gestureState) => {
        const x = Math.min(Math.max(gestureState.moveX - (width * 0.1), 0), progressBarWidth.current);
        const percent = x / progressBarWidth.current;
        const newPos = percent * durationMillis;
        setPositionMillis(newPos);
      },
      onPanResponderRelease: async (evt, gestureState) => {
        const x = Math.min(Math.max(gestureState.moveX - (width * 0.1), 0), progressBarWidth.current);
        const percent = x / progressBarWidth.current;
        const newPos = percent * durationMillis;
        if (soundRef.current) await soundRef.current.setPositionAsync(newPos);
        setPositionMillis(newPos);
        isSeeking.current = false;
      },
    })
  ).current;

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, []);

  const navigateToCustomerIdScreen = () => {
    if (recordedUri) {
      navigation.navigate('CustomerId', { 
        recordedUri, 
        durationMillis, 
        agentId: 'agent123' // Placeholder for agentId
      });
    } else {
      alert('Please record audio first.');
    }
  };

  return (
    <LinearGradient
      colors={['#D62F55', '#EE6382']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Voice Recorder</Text>
          <TouchableOpacity onPress={onLogout}>
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Record Audio</Text>

          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={styles.micButton}
              onPress={recording ? stopRecording : startRecording}
            >
              {recording ? (
                <LinearGradient
                  colors={['#EE6382', '#D62F55']}
                  style={styles.micButtonGradient}
                >
                  <Ionicons name="pause" size={48} color="#fff" />
                </LinearGradient>
              ) : (
                <Ionicons name="mic" size={48} color="#000" />
              )}
            </TouchableOpacity>
          </Animated.View>

          {recording && (
            <Text style={styles.recordingDurationText}>
              Recording: {formatTime(recordingDuration * 1000)}
            </Text>
          )}

          {recordedUri && (
            <View style={styles.playbackSection}>
              <View style={styles.playbackContainer}>
                <TouchableOpacity onPress={togglePlayback} style={styles.playButton}>
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={32}
                    color="#D62F55"
                  />
                </TouchableOpacity>
                <View style={styles.seekBarAndTimeContainer}>
                  <View style={styles.seekContainer}
                    onLayout={(e) =>
                    (progressBarWidth.current = e.nativeEvent.layout.width)
                  }>
                    <View style={styles.seekBarContainer}>
                      <View
                        style={[
                          styles.seekBarProgress,
                          { width: `${getProgress()}%` },
                        ]}
                      />
                    </View>
                    <View
                      style={[
                        styles.thumb,
                        {
                          left: `${getProgress()}%`,
                          transform: [{ translateX: -8 }],
                        },
                      ]}
                      {...panResponder.panHandlers}
                    />
                  </View>
                  <Text style={styles.timeText}>
                    {formatTime(positionMillis)} / {formatTime(durationMillis)}
                  </Text>
                </View>
              </View>
              {!recording && (
                <TouchableOpacity
                  style={styles.navigateButton}
                  onPress={navigateToCustomerIdScreen}
                >
                  <LinearGradient
                    colors={['#A020F0', '#C71585']} // Changed colors for better match
                    style={styles.navigateButtonGradient}
                  >
                    <Ionicons name="arrow-forward" size={24} color="#fff" />
                    <Text style={styles.navigateButtonText}>Enter Customer Number</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.viewRecordingsButton}
            onPress={() => navigation.navigate('LocalRecordings')}
          >
            <LinearGradient
              colors={['#1E90FF', '#87CEEB']}
              style={styles.viewRecordingsButtonGradient}
            >
              <Ionicons name="folder-open" size={24} color="#fff" />
              <Text style={styles.viewRecordingsButtonText}>View Local Recordings</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
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
    paddingTop: Platform.OS === 'android' ? 40 : 20, // Adjust for status bar
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 40,
    color: '#fff',
  },
  micButton: {
    backgroundColor: '#fff',
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  micButtonGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micActive: {
    backgroundColor: 'transparent',
  },
  playbackSection: {
    width: '100%',
    alignItems: 'center',
  },
  playbackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '90%',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  playButton: {
    backgroundColor: '#fff',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seekBarAndTimeContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 15,
  },
  seekContainer: {
    flex: 1,
    height: 20,
    justifyContent: 'center',
    marginHorizontal: 15,
    position: 'relative',
  },
  seekBarContainer: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 2,
    width: '100%',
  },
  seekBarProgress: {
    height: 4,
    backgroundColor: '#D62F55',
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#D62F55',
    top: 2,
    ...Platform.select({
      android: {
        elevation: 5,
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
      },
    }),
  },
  navigateButton: {
    marginTop: 20,
    width: '90%',
    borderRadius: 12,
    overflow: 'hidden', // Ensures gradient respects border radius
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  navigateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  navigateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  recordingDurationText: {
    fontSize: 20,
    color: '#fff',
    marginTop: 20,
    fontWeight: 'bold',
  },
  viewRecordingsButton: {
    marginTop: 20,
    width: '90%',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  viewRecordingsButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  viewRecordingsButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});
