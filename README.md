# Remindly 👋

Welcome to Remindly, an Expo project hosted on GitHub at johnyUofL/remindly. This is a mobile app built with Expo for Task Management and Pomodoro Technique integration. 

## Get Started

Follow these steps to set up and run the remindly project locally.

### Prerequisites

Before you begin, ensure the following are installed on your machine:

- **Node.js and npm**: Expo requires Node.js (preferably LTS version like 18.x or 20.x). Download it from [nodejs.org](https://nodejs.org). npm comes bundled with Node.js.
- **Git**: Required to clone the repository from GitHub. Download it from [git-scm.com](https://git-scm.com) if not installed.
- **Visual Studio Code**: Recommended editor. Download from [code.visualstudio.com](https://code.visualstudio.com).
- **Expo Go App** (optional but recommended): Install on your iOS or Android device to test the app by scanning a QR code.

### Step 1: Clone the Repository

Since remindly is an existing Expo project, you'll clone it from GitHub and set it up locally.

1. Open a terminal (in VS Code or elsewhere).
2. Navigate to the directory where you want to store the project:
   ```bash
   cd ~/Desktop
   ```
3. Clone the repository:
   ```bash
   git clone https://github.com/johnyUofL/remindly_final.git
   ```

4. Navigate into the project folder:
   ```bash
   cd remindly_final
   ```

Important: Since this project is already an Expo app, do not run npx create-expo-app as it will create a new project and overwrite the existing structure.

### Step 2: Install Dependencies

The project's package.json lists its dependencies. Install them to set up the project.

From the remindly folder, run:
```bash
npm install
```

This installs all dependencies, including the expo package, which includes the modern Expo CLI. Note: You may see deprecation warnings for transitive dependencies (e.g., rimraf, uuid). These are typically safe to ignore for now but indicate outdated packages. To minimize issues:

- Update the expo package:
  ```bash
  npx expo install expo
  ```
- Update other dependencies:
  ```bash
  npm update
  ```

### Step 3: Start the App

Use the modern local Expo CLI to start the project.

1. Start the development server:
   ```bash
   npx expo start
   ```
   This launches the Metro bundler and displays a QR code in the terminal or browser.

## 2. Test the App
You can test the app using one of these options, the app works just for Android devices:

- **On a Physical Device**: Open the Expo Go app on your phone and scan the QR code below.  
  ![QR Code](https://raw.githubusercontent.com/johnyUofL/remindly_final/refs/heads/main/qr-code.jpeg)
- **On an Emulator/Simulator**:
  - Android: Install Android Studio, set up an emulator, then press `a` in the terminal. See [Android emulator setup](https://docs.expo.dev/workflow/android-studio-emulator/).
- **Development Build**: Build a custom version for more features. Learn more about [development builds](https://docs.expo.dev/develop/development-builds/introduction/).

You can start developing by editing the files inside the project (e.g., `App.js` or files in the `app` directory if using file-based routing).

## Running Test

For Running test use 
```bash
npm test
```

## Learn More

To learn more about developing your project with Expo, check out these resources:

- [Expo Documentation](https://docs.expo.dev/): Learn fundamentals or dive into advanced topics with guides.
- [Learn Expo Tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial to create a project that runs on Android, iOS, and the web.

## Troubleshooting

Here are some common issues and solutions:

- **Node Version Compatibility**: If you see warnings about Node.js versions, ensure you're using a supported LTS version (e.g., 18 or 20). Use nvm to switch if needed:
  ```bash
  nvm install 18
  nvm use 18
  ```
- **Deprecated Dependencies**: When running npm install, you might see deprecation warnings. These are usually safe for development but can be mitigated by updating dependencies:
  ```bash
  npx expo install expo
  npm update
  ```
- **QR Code Not Working**: Ensure your phone and computer are on the same Wi-Fi network. If it fails, use the "Tunnel" connection by pressing `t` in the terminal.
- **Virtual Android Emulator Too Big**: If using an emulator (e.g., Android Studio's AVD) and the window is too large:
  - Open the emulator toolbar, go to Settings > Appearance, and enable "Show window frame around device."
  - Drag the corners to resize.
  - Alternatively, adjust the resolution in AVD Manager (Tools > Device Manager > Edit Device > Change Resolution).

## Contributing

If you make changes and want to push them back to GitHub:

1. Stage your changes:
   ```bash
   git add .
   ```
2. Commit them:
   ```bash
   git commit -m "Your message"
   ```
3. Push to GitHub:
   ```bash
   git push origin main
   ```
   Replace `main` with your branch name if different.

## Join the Community

Join our community of developers creating universal apps:

- [Expo on GitHub](https://github.com/expo/expo): View our open-source platform and contribute.
- [Discord Community](https://chat.expo.dev): Chat with Expo users and ask questions.

## License

All the software used here is open source and can be used freely. The components used are included in package.json.

## Dependencies

Here’s a summary of the dependencies used in Remindly:

| **Category**            | **Dependency**                            | **Version**    | **Functionality**                                                                 |
|--------------------------|-------------------------------------------|----------------|----------------------------------------------------------------------------------|
| **UI and Navigation**   | `@expo/vector-icons`                     | `^14.0.2`      | Customizable icons for React Native apps.                                        |
|                          | `@react-navigation/bottom-tabs`          | `^7.3.1`       | Bottom tab navigation for React Native.                                          |
|                          | `@react-navigation/native`               | `^7.0.17`      | Core navigation library for stack, tab, and drawer navigation.                   |
|                          | `@react-navigation/stack`                | `^7.1.0`       | Stack-based navigation (push/pop screens).                                       |
|                          | `expo-blur`                              | `~14.0.1`      | Blur effects for UI elements in Expo apps.                                       |
|                          | `expo-linear-gradient`                   | `~14.0.1`      | Linear gradient backgrounds/effects.                                             |
|                          | `react-native-calendars`                 | `^1.1310.0`    | Customizable calendar component.                                                 |
|                          | `react-native-gesture-handler`           | `~2.20.2`      | Gesture-based interactions (swipe, pinch).                                       |
|                          | `react-native-modal-datetime-picker`     | `^18.0.0`      | Cross-platform modal date/time picker.                                           |
|                          | `react-native-paper`                     | `^5.13.1`      | Material Design UI components.                                                   |
|                          | `react-native-reanimated`                | `~3.16.1`      | Smooth animations and transitions.                                               |
|                          | `react-native-safe-area-context`         | `^4.14.1`      | Ensures UI respects device safe areas (notches, status bars).                    |
|                          | `react-native-screens`                   | `~4.1.0`       | Optimizes navigation with native screen components.                              |
|                          | `react-native-svg`                       | `^15.11.2`     | Renders SVG images and shapes.                                                   |
|                          | `react-native-vector-icons`              | `^10.2.0`      | Customizable icons for React Native.                                             |
| **Animations and Media** | `@lottiefiles/dotlottie-react`           | `^0.6.5`       | Lottie animations for React (web-focused).                                       |
|                          | `lottie-react-native`                    | `^7.1.0`       | Lottie animations for React Native.                                              |
|                          | `expo-av`                                | `~15.0.1`      | Audio and video playback in Expo apps.                                           |
|                          | `expo-haptics`                           | `~14.0.0`      | Haptic feedback (vibration) for Expo apps.                                       |
| **Data Storage**        | `@nozbe/watermelondb`                    | `^0.27.1`      | High-performance, offline-first database.                                        |
|                          | `@nozbe/with-observables`                | `^1.6.0`       | Observable bindings for WatermelonDB.                                            |
|                          | `@react-native-async-storage/async-storage` | `^2.1.0`     | Persistent key-value storage.                                                    |
|                          | `expo-secure-store`                      | `~14.0.1`      | Secure, encrypted storage for sensitive data.                                    |
|                          | `expo-sqlite`                            | `~15.1.2`      | SQLite database integration for Expo apps.                                       |
| **Networking/Utilities**| `axios`                                  | `^1.7.9`       | Promise-based HTTP client for API requests.                                      |
|                          | `@react-native-community/netinfo`        | `11.4.1`       | Monitors network connectivity status.                                            |
|                          | `jsonwebtoken`                           | `^9.0.2`       | JSON Web Tokens (JWT) for authentication.                                        |
|                          | `uuid`                                   | `^11.1.0`      | Generates unique identifiers (UUIDs).                                            |
|                          | `react-native-get-random-values`         | `^1.11.0`      | Polyfill for cryptographically secure random values.                             |
| **Date and Time**       | `@react-native-community/datetimepicker` | `^8.2.0`       | Native date and time picker.                                                     |
|                          | `date-fns`                               | `^4.1.0`       | Lightweight date manipulation and formatting.                                    |
| **Expo-Specific**       | `expo`                                   | `~52.0.38`     | Core Expo SDK for React Native apps.                                             |
|                          | `expo-constants`                         | `~17.0.3`      | Exposes app configuration constants.                                             |
|                          | `expo-font`                              | `~13.0.1`      | Loads custom fonts in Expo apps.                                                 |
|                          | `expo-linking`                           | `~7.0.3`       | Handles deep linking and universal links.                                        |
|                          | `expo-router`                            | `4.0.11`       | File-based routing for Expo apps.                                                |
|                          | `expo-splash-screen`                     | `~0.29.18`     | Manages app splash screen during loading.                                        |
|                          | `expo-status-bar`                        | `~2.0.0`       | Controls status bar appearance.                                                  |
|                          | `expo-symbols`                           | `~0.2.0`       | Access to system icons in Expo apps.                                             |
|                          | `expo-system-ui`                         | `~4.0.6`       | Customizes system UI elements (e.g., background).                                |
|                          | `expo-updates`                           | `~0.27.4`      | Over-the-air updates for Expo apps.                                              |
|                          | `expo-web-browser`                       | `~14.0.2`      | Opens web pages in an in-app browser.                                            |
| **Web/Cross-Platform**  | `react-native-web`                       | `~0.19.13`     | Runs React Native components on the web.                                         |
|                          | `react-native-webview`                   | `13.12.5`      | Renders web content in a native WebView.                                         |
| **Core Frameworks**     | `react`                                  | `18.3.1`       | Core React library for UI.                                                       |
|                          | `react-dom`                              | `18.3.1`       | React rendering for the DOM (web).                                               |
|                          | `react-native`                           | `0.76.5`       | Core framework for native mobile apps with React.                                |
| **Configuration**       | `dotenv`                                 | `^16.4.7`      | Loads environment variables from `.env`.                                         |
| **Dev: Build**          | `@babel/core`                            | `^7.25.2`      | Core Babel compiler for JS/TS transpilation.                                     |
|                          | `@expo/config-plugins`                   | `^9.0.17`      | Customizes Expo configuration.                                                   |
| **Dev: Testing**        | `@testing-library/jest-native`           | `^5.4.3`       | Extends Jest for React Native testing.                                           |
|                          | `@testing-library/react-native`          | `^13.2.0`      | Testing utilities for React Native.                                              |
|                          | `jest`                                   | `^29.2.1`      | JavaScript testing framework.                                                    |
|                          | `jest-expo`                              | `~52.0.2`      | Jest preset for Expo projects.                                                   |
|                          | `react-test-renderer`                    | `18.3.1`       | Renders React components for testing.                                            |
| **Dev: Type Checking**  | `typescript`                             | `^5.3.3`       | Static typing for JavaScript.                                                    |
|                          | `@types/jest`                            | `^29.5.12`     | Type definitions for Jest.                                                       |
|                          | `@types/react`                           | `~18.3.12`     | Type definitions for React.                                                      |
|                          | `@types/react-native`                    | `^0.72.8`      | Type definitions for React Native.                                               |
|                          | `@types/react-test-renderer`             | `^18.3.0`      | Type definitions for React Test Renderer.                                        |


