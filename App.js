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

} from 'react-native';

import { Audio } from 'expo-av';

import { Ionicons } from '@expo/vector-icons';



export default function App() {

  const { width, height } = useWindowDimensions();

  const isPortrait = height >= width;



  const [recording, setRecording] = useState(null);

  const [recordedUri, setRecordedUri] = useState(null);

  const [sound, setSound] = useState(null);

  const [positionMillis, setPositionMillis] = useState(0);

  const [durationMillis, setDurationMillis] = useState(0);

  const [isPlaying, setIsPlaying] = useState(false);



  const pulseAnim = useRef(new Animated.Value(1)).current;

  const soundRef = useRef(null);

  const isSeeking = useRef(false);

  const progressBarWidth = useRef(0);



  const animatePulse = () => {

    Animated.loop(

      Animated.sequence([

        Animated.timing(pulseAnim, {

          toValue: 1.4,

          duration: 800,

          easing: Easing.inOut(Easing.ease),

          useNativeDriver: true,

        }),

        Animated.timing(pulseAnim, {

          toValue: 1,

          duration: 800,

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

        interruptionModeIOS: 1,

      });



      const { recording } = await Audio.Recording.createAsync(

        Audio.RecordingOptionsPresets.HIGH_QUALITY

      );



      setRecording(recording);

      setRecordedUri(null);

      stopPlayback();

      animatePulse();

    } catch (error) {

      console.error('Start recording error:', error);

    }

  };



  const stopRecording = async () => {

    try {

      if (!recording) return;

      await recording.stopAndUnloadAsync();

      const uri = recording.getURI();

      setRecordedUri(uri);

      setRecording(null);

      stopPulse();

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

          interruptionModeIOS: 1,

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

    const min = Math.floor(totalSec / 60).toString().padStart(2, '0');

    const sec = (totalSec % 60).toString().padStart(2, '0');

    return `${min}:${sec}`;

  };



  const getProgress = () =>

    durationMillis ? (positionMillis / durationMillis) * 100 : 0;



  const panResponder = useRef(

    PanResponder.create({

      onStartShouldSetPanResponder: () => true,

      onPanResponderGrant: () => (isSeeking.current = true),

      onPanResponderMove: (evt, gestureState) => {

        const x = Math.min(Math.max(gestureState.moveX, 0), progressBarWidth.current);

        const percent = x / progressBarWidth.current;

        const newPos = percent * durationMillis;

        setPositionMillis(newPos);

      },

      onPanResponderRelease: async (evt, gestureState) => {

        const x = Math.min(Math.max(gestureState.moveX, 0), progressBarWidth.current);

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



  return (

    <View style={[styles.container, { width, height }]}>

      <Text style={styles.title}>Voice Recorder</Text>



      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>

        <TouchableOpacity

          style={[styles.micButton, recording && styles.micActive]}

          onPress={recording ? stopRecording : startRecording}

        >

          <Ionicons name="mic" size={36} color="#fff" />

        </TouchableOpacity>

      </Animated.View>



      {recordedUri && (

        <>

          <View style={styles.playbackContainer}>

            <TouchableOpacity onPress={togglePlayback}>

              <Ionicons

                name={isPlaying ? 'pause' : 'play'}

                size={40}

                color="#4a90e2"

              />

            </TouchableOpacity>

            <Text style={styles.timeText}>

              {formatTime(positionMillis)} / {formatTime(durationMillis)}

            </Text>

          </View>



          <View

            style={styles.seekContainer}

            onLayout={(e) =>

              (progressBarWidth.current = e.nativeEvent.layout.width)

            }

            {...panResponder.panHandlers}

          >

            <View style={styles.seekBarBackground}>

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

            />

          </View>

        </>

      )}

    </View>

  );

}



const styles = StyleSheet.create({

  container: {

    flex: 1,

    backgroundColor: '#fafafa',

    justifyContent: 'center',

    alignItems: 'center',

    padding: 20,

  },

  title: {

    fontSize: 24,

    fontWeight: 'bold',

    marginBottom: 28,

    color: '#333',

  },

  micButton: {

    backgroundColor: '#4a90e2',

    width: 90,

    height: 90,

    borderRadius: 45,

    justifyContent: 'center',

    alignItems: 'center',

    marginBottom: 20,

  },

  micActive: {

    backgroundColor: '#e94f4f',

  },

  playbackContainer: {

    flexDirection: 'row',

    alignItems: 'center',

    gap: 16,

    marginBottom: 12,

  },

  timeText: {

    fontSize: 16,

    fontWeight: '500',

    color: '#444',

  },

  seekContainer: {

    width: '80%',

    height: 20,

    justifyContent: 'center',

    marginTop: 4,

  },

  seekBarBackground: {

    height: 6,

    backgroundColor: '#ccc',

    borderRadius: 3,

  },

  seekBarProgress: {

    height: 6,

    backgroundColor: '#4a90e2',

    borderRadius: 3,

  },

  thumb: {

    position: 'absolute',

    width: 16,

    height: 16,

    borderRadius: 8,

    backgroundColor: '#4a90e2',

    marginTop: -5,

    elevation: 5,

  },

});

