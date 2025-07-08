# Voice Recorder App

This is a React Native (Expo) application that allows users to record, save, and manage voice recordings.

## Features

*   User login to secure access.
*   Associate recordings with a customer ID.
*   High-quality voice recording.
*   View and play back a list of locally saved recordings.

## Prerequisites

Before you begin, ensure you have the following installed:

*   [Node.js](https://nodejs.org/) (LTS version recommended)
*   [Git](https://git-scm.com/)
*   [Expo CLI](https://docs.expo.dev/get-started/installation/)
*   **For iOS:** [Xcode](https://developer.apple.com/xcode/)
*   **For Android:** [Android Studio](https://developer.android.com/studio) & JDK

## Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    ```

2.  **Navigate to the project directory:**
    ```bash
    cd VoiceRecorderAppJS
    ```

3.  **Install dependencies:**
    ```bash
    npm install
    ```

## Running the Application

### For iOS

To run the app on a connected iPhone, first get the name of your device by running:
```bash
xcrun xctrace list devices
```

Then, run the application using that device name:
```bash
# Replace "Your Device Name" with the actual name from the list
npm run ios -- --device "Your Device Name"
```

Alternatively, to run on a simulator or be prompted to choose a device:
```bash
npm run ios
```

### For Android

Ensure you have an Android emulator running or a physical device connected via USB with debugging enabled.
```bash
npm run android
```
