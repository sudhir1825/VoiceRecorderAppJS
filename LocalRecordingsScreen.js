import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system'; // Import FileSystem
import { uploadRecordingApi } from './services/api'; // Import the upload function

export default function LocalRecordingsScreen({ navigation }) {
  const [recordings, setRecordings] = useState([]);
  const [currentPlayingId, setCurrentPlayingId] = useState(null);
  const [playbackObject, setPlaybackObject] = useState(null);
  const [selectedRecordings, setSelectedRecordings] = useState([]); // New state for selected recordings

  const fetchRecordings = async () => {
    try {
      const storedRecordings = await AsyncStorage.getItem('localRecordings');
      if (storedRecordings) {
        let parsedRecordings = JSON.parse(storedRecordings);
        const validRecordings = [];
        const recordingsToRemove = [];

        for (const recording of parsedRecordings) {
          const fileInfo = await FileSystem.getInfoAsync(recording.uri);
          if (fileInfo.exists) {
            validRecordings.push(recording);
          } else {
            console.warn(`Recording file not found, removing from list: ${recording.uri}`);
            recordingsToRemove.push(recording.id);
          }
        }

        setRecordings(validRecordings);

        // Optionally, clean up AsyncStorage by removing entries for non-existent files
        if (recordingsToRemove.length > 0) {
          await AsyncStorage.setItem('localRecordings', JSON.stringify(validRecordings));
        }
      }
    } catch (error) {
      console.error('Error fetching recordings:', error);
      Alert.alert('Error', 'Failed to load local recordings.');
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchRecordings();
      return () => {
        // Clean up playback object when leaving screen
        if (playbackObject) {
          playbackObject.unloadAsync();
          setPlaybackObject(null);
          setCurrentPlayingId(null);
        }
      };
    }, [playbackObject])
  );

  const playSound = async (uri, id) => {
    if (playbackObject) {
      await playbackObject.unloadAsync();
      setPlaybackObject(null);
      setCurrentPlayingId(null);
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeIOS: 1,
        playsThroughEarpieceAndroid: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );
      setPlaybackObject(sound);
      setCurrentPlayingId(id);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          sound.unloadAsync();
          setPlaybackObject(null);
          setCurrentPlayingId(null);
        }
      });
    } catch (error) {
      console.error('Error playing sound:', error);
      Alert.alert('Error', 'Could not play the recorded audio.');
    }
  };

  const stopSound = async () => {
    if (playbackObject) {
      await playbackObject.stopAsync();
      await playbackObject.unloadAsync();
      setPlaybackObject(null);
      setCurrentPlayingId(null);
    }
  };

  const toggleSelection = (id) => {
    setSelectedRecordings((prevSelected) =>
      prevSelected.includes(id)
        ? prevSelected.filter((item) => item !== id)
        : [...prevSelected, id]
    );
  };

  const selectAll = () => {
    setSelectedRecordings(recordings.map((rec) => rec.id));
  };

  const deselectAll = () => {
    setSelectedRecordings([]);
  };

  const batchDelete = async () => {
    if (selectedRecordings.length === 0) {
      Alert.alert('No Selection', 'Please select recordings to delete.');
      return;
    }

    Alert.alert(
      'Delete Selected Recordings',
      `Are you sure you want to delete ${selectedRecordings.length} recording(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              const updatedRecordings = recordings.filter(
                (rec) => !selectedRecordings.includes(rec.id)
              );
              await AsyncStorage.setItem(
                'localRecordings',
                JSON.stringify(updatedRecordings)
              );
              setRecordings(updatedRecordings);
              setSelectedRecordings([]); // Clear selection after deletion
              stopSound(); // Stop any playing audio
              Alert.alert('Deleted', 'Selected recordings deleted successfully.');
            } catch (error) {
              console.error('Error deleting recordings:', error);
              Alert.alert('Error', 'Failed to delete selected recordings.');
            }
          },
        },
      ]
    );
  };

  const batchUpload = async () => {
    if (selectedRecordings.length === 0) {
      Alert.alert('No Selection', 'Please select recordings to upload.');
      return;
    }

    Alert.alert(
      'Upload Selected Recordings',
      `Are you sure you want to upload ${selectedRecordings.length} recording(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Upload',
          onPress: async () => {
            console.log('Starting batch upload...');
            let successfulUploads = [];
            let failedUploads = [];
            const updatedRecordings = [...recordings];
            let recordingsToDelete = [];

            for (const recordId of selectedRecordings) {
              const recordingToUpload = updatedRecordings.find((rec) => rec.id === recordId);
              if (!recordingToUpload || recordingToUpload.uploaded) {
                console.log(`Skipping recording ${recordId}: already uploaded or not found.`);
                continue;
              }

              console.log(`Attempting to upload recording: ${recordingToUpload.id} for customer ${recordingToUpload.customerNumber} with URI: ${recordingToUpload.uri}`);
              const uploadResult = await uploadRecordingApi(recordingToUpload);
              console.log(`Upload result for ${recordingToUpload.id}:`, uploadResult);

              if (uploadResult.success) {
                const index = updatedRecordings.findIndex((rec) => rec.id === recordId);
                if (index !== -1) {
                  updatedRecordings[index] = { ...updatedRecordings[index], uploaded: true };
                }
                successfulUploads.push(recordingToUpload);
                recordingsToDelete.push(recordingToUpload.uri); // Collect URIs for deletion
              } else {
                failedUploads.push({
                  id: recordingToUpload.id,
                  customerNumber: recordingToUpload.customerNumber,
                  error: uploadResult.error,
                });
              }
            }

            console.log('Updating AsyncStorage with latest recordings state...');
            await AsyncStorage.setItem('localRecordings', JSON.stringify(updatedRecordings));
            setRecordings(updatedRecordings);
            setSelectedRecordings([]); // Clear selection after batch operation

            let summaryMessage = `Successful uploads: ${successfulUploads.length}\nFailed uploads: ${failedUploads.length}`;

            if (failedUploads.length > 0) {
              summaryMessage += '\n\nFailed details:';
              failedUploads.forEach((fail) => {
                summaryMessage += `\n- ${fail.customerNumber || fail.id}: ${fail.error}`;
              });
            }

            const alertButtons = [];

            if (successfulUploads.length > 0) {
              alertButtons.push(
                { text: 'Keep Local', style: 'cancel' },
                {
                  text: 'Delete Uploaded Local Files',
                  onPress: async () => {
                    try {
                      const remainingRecordings = updatedRecordings.filter(
                        (rec) => !successfulUploads.some(s => s.id === rec.id)
                      );
                      await AsyncStorage.setItem('localRecordings', JSON.stringify(remainingRecordings));
                      setRecordings(remainingRecordings);
                      for (const uri of recordingsToDelete) {
                        await FileSystem.deleteAsync(uri).catch(e => console.error('Error deleting file:', uri, e));
                      }
                      Alert.alert('Deleted', 'Successfully deleted uploaded local files.');
                    } catch (deleteError) {
                      console.error('Error deleting batch local files:', deleteError);
                      Alert.alert('Error', 'Failed to delete some local files.');
                    }
                  },
                }
              );
            } else {
              alertButtons.push({ text: 'OK' });
            }

            Alert.alert(
              'Batch Upload Complete',
              summaryMessage,
              alertButtons
            );
            console.log('Batch upload process finished.');
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const isSelected = selectedRecordings.includes(item.id);
    return (
      <TouchableOpacity
        style={[styles.recordingItem, isSelected && styles.selectedItem]}
        onPress={() => toggleSelection(item.id)}
      >
        <MaterialIcons
          name={isSelected ? "check-box" : "check-box-outline-blank"}
          size={24}
          color={isSelected ? "#4CAF50" : "#666"}
          style={styles.checkboxIcon}
        />
        <View style={styles.recordingDetails}>
          <Text style={styles.detailText}>Customer Number: {item.customerNumber}</Text>
          <Text style={styles.detailText}>Agent ID: {item.agentId}</Text>
          <Text style={styles.detailText}>Recorded: {new Date(item.timestamp).toLocaleString()}</Text>
          {item.duration && <Text style={styles.detailText}>Duration: {item.duration}</Text>}
          <Text style={styles.detailText}>Status: {item.uploaded ? 'Uploaded' : 'Local'}</Text>
        </View>
        <View style={styles.recordingActions}>
          <TouchableOpacity
            onPress={() => (currentPlayingId === item.id ? stopSound() : playSound(item.uri, item.id))}
            style={styles.actionButton}
          >
            <MaterialIcons
              name={currentPlayingId === item.id ? "stop" : "play-arrow"}
              size={24}
              color="#fff"
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
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
          <Text style={styles.headerTitle}>Local Recordings</Text>
          <View style={{ width: 24 }} />{/* Spacer to balance title */}
        </View>

        {recordings.length > 0 && (
          <View style={styles.batchActionsContainer}>
            <TouchableOpacity onPress={selectAll} style={styles.batchActionButton}>
              <Text style={styles.batchActionButtonText}>Select All</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={deselectAll} style={styles.batchActionButton}>
              <Text style={styles.batchActionButtonText}>Deselect All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={batchUpload}
              style={[styles.batchActionButton, selectedRecordings.length === 0 && styles.batchActionButtonDisabled]}
              disabled={selectedRecordings.length === 0}
            >
              <Text style={styles.batchActionButtonText}>Upload Selected</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={batchDelete}
              style={[styles.batchActionButton, selectedRecordings.length === 0 && styles.batchActionButtonDisabled]}
              disabled={selectedRecordings.length === 0}
            >
              <Text style={styles.batchActionButtonText}>Delete Selected</Text>
            </TouchableOpacity>
          </View>
        )}

        {recordings.length > 0 ? (
          <FlatList
            data={recordings}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
          />
        ) : (
          <View style={styles.noRecordingsContainer}>
            <Text style={styles.noRecordingsText}>No local recordings found.</Text>
            <Text style={styles.noRecordingsText}>Record audio and enter Customer Number to save locally.</Text>
          </View>
        )}
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
  listContent: {
    padding: 20,
  },
  recordingItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedItem: {
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  checkboxIcon: {
    marginRight: 10,
  },
  recordingDetails: {
    flex: 1,
    marginRight: 10,
  },
  detailText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  recordingActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    backgroundColor: '#D62F55',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  uploadButton: {
    backgroundColor: '#4CAF50',
  },
  uploadedButton: {
    backgroundColor: '#9E9E9E', // Grey out if already uploaded
  },
  deleteButton: {
    backgroundColor: '#FF4500',
  },
  noRecordingsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noRecordingsText: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  batchActionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  batchActionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    margin: 5,
  },
  batchActionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  batchActionButtonDisabled: {
    opacity: 0.5,
  },
});


