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
   cd remindly
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

2. Test the app using one of these options:
   - **On a Physical Device**: Open the Expo Go app on your phone and scan the QR code.
   - **On an Emulator/Simulator**:
     - Android: Install Android Studio, set up an emulator, then press `a` in the terminal. See [Android emulator setup](https://docs.expo.dev/workflow/android-studio-emulator/).
     - iOS: Install Xcode (macOS only), set up a simulator, then press `i` in the terminal. See [iOS simulator setup](https://docs.expo.dev/workflow/ios-simulator/).
   - **In a Web Browser**: Press `w` to run the app in your browser (if the project supports web).
   - **Development Build**: Build a custom version for more features. Learn more about [development builds](https://docs.expo.dev/develop/development-builds/introduction/).

You can start developing by editing the files inside the project (e.g., App.js or files in the app directory if using file-based routing).

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

All the software used here is open source and can be used freely. The components used are included in package.json



