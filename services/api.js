import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store'; // Import SecureStore

const API_BASE_URL = '';

export const uploadRecordingApi = async (recordingItem) => {
  console.log('uploadRecordingApi called with:', recordingItem);
  try {
    const userToken = await SecureStore.getItemAsync('userToken'); // Retrieve token
    if (!userToken) {
      return { success: false, error: 'Authentication token not found. Please log in.' };
    }

    const fileUri = recordingItem.uri;
    const cleanFileUri = fileUri.startsWith('file://') ? fileUri.substring(7) : fileUri; // Remove 'file://' prefix
    const fileName = fileUri.split('/').pop();
    const customerNumber = recordingItem.customerNumber;
    const agentId = recordingItem.agentId;
    const callDuration = recordingItem.duration; // Assuming this is the formatted duration like "00:03:25"

    const formData = new FormData();
    formData.append('file', {
      uri: cleanFileUri, // Use the cleaned URI
      name: fileName,
      type: 'audio/m4a', // Adjust content type if your audio format is different
    });

    const url = `${API_BASE_URL}/recordings/upload_recording?customer_number=${customerNumber}&call_duration=${callDuration}&agent_id=${agentId}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
      },
      body: formData,
    });

    if (response.ok) {
      const result = await response.json();
      return { success: true, data: result };
    } else {
      const errorText = await response.text();
      return { success: false, error: `Upload failed: ${errorText}` };
    }

  } catch (error) {
    console.error('Network or other error during upload:', error);
    return { success: false, error: error.message };
  }
};
