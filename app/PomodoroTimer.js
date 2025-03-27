import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Vibration,
  Dimensions,
  Modal,
  FlatList,
  Pressable,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import LottieView from "lottie-react-native";

const AVAILABLE_SOUNDS = [
  { id: '1', name: 'Lofi Alarm Clock', source: require("../assets/sounds/lofi-alarm-clock.mp3") },
  { id: '2', name: 'Calm Piano', source: require("../assets/sounds/calm-piano.mp3") },
  { id: '3', name: 'Nature Ambience', source: require("../assets/sounds/nature-ambience.mp3") },
  { id: '4', name: 'Soft Bells', source: require("../assets/sounds/soft-bells.mp3") },
  { id: '5', name: 'White Noise', source: require("../assets/sounds/white-noise.mp3") },
];

export default function PomodoroTimer() {
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSoundLoaded, setIsSoundLoaded] = useState(false);
  const [taskCompleted, setTaskCompleted] = useState(false);
  const [isSoundModalVisible, setIsSoundModalVisible] = useState(false);
  const [selectedSound, setSelectedSound] = useState(AVAILABLE_SOUNDS[0]);
  const [previewSound, setPreviewSound] = useState(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewingSoundId, setPreviewingSoundId] = useState(null);

  const router = useRouter();
  const params = useLocalSearchParams();
  const { taskId, taskName, isSubtask, parentTaskId, listIndex } = params;
  const { width, height } = Dimensions.get("window");

  const totalTime = 25 * 60; 
  const currentTimeInSeconds = minutes * 60 + seconds;
  const progress = (currentTimeInSeconds / totalTime) * 100;

  const handlePreviewSound = async (soundItem) => {
    try {
      if (previewingSoundId === soundItem.id) {
        await stopPreviewSound();
        return;
      }

      await stopPreviewSound();

      const { sound: newPreviewSound } = await Audio.Sound.createAsync(
        soundItem.source,
        { isLooping: true }
      );
      
      setPreviewSound(newPreviewSound);
      await newPreviewSound.playAsync();
      setIsPreviewPlaying(true);
      setPreviewingSoundId(soundItem.id);
    } catch (error) {
      console.error("Error previewing sound:", error);
    }
  };

  const stopPreviewSound = async () => {
    if (previewSound) {
      await previewSound.stopAsync();
      await previewSound.unloadAsync();
      setPreviewSound(null);
      setIsPreviewPlaying(false);
      setPreviewingSoundId(null);
    }
  };

  const handleSoundSelection = async (soundItem) => {
    try {
      await stopPreviewSound();
      
      if (sound && isPlaying) {
        await sound.stopAsync();
        await sound.unloadAsync();
      }

      setSelectedSound(soundItem);
      setIsSoundModalVisible(false);

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        playThroughEarpieceAndroid: false,
        allowsRecordingIOS: false,
      });

      const { sound: newSound } = await Audio.Sound.createAsync(
        soundItem.source,
        { isLooping: true, shouldPlay: isPlaying },
        (status) => {
          if (status.isLoaded) {
            setIsPlaying(status.isPlaying);
            setIsSoundLoaded(true);
          }
        }
      );

      setSound(newSound);
      
      if (isPlaying) {
        await newSound.playAsync();
      }
    } catch (error) {
      console.error("Error switching sounds:", error);
      setIsSoundLoaded(false);
    }
  };

  const loadMusic = async () => {
    try {
      console.log("Loading music...");
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        playThroughEarpieceAndroid: false,
        allowsRecordingIOS: false,
      });

      const { sound: loadedSound } = await Audio.Sound.createAsync(
        selectedSound.source,
        { isLooping: true, shouldPlay: false },
        (status) => {
          if (status.isLoaded) {
            setIsPlaying(status.isPlaying);
            setIsSoundLoaded(true);
          }
        }
      );
      setSound(loadedSound);

      loadedSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setIsPlaying(status.isPlaying);
        }
      });
    } catch (error) {
      console.error("Error loading sound:", error);
      setIsSoundLoaded(false);
    }
  };

  const toggleMusic = async () => {
    try {
      console.log("Toggle music - current state:", isPlaying, "Sound object:", sound ? "exists" : "null", "Loaded:", isSoundLoaded);
      
      if (!sound) {
        console.log("Sound is null, trying to reload");
        await loadMusic();
        return;
      }
      
      if (!isSoundLoaded) {
        console.log("Sound not loaded yet");
        return;
      }
      
      // Get current status to be sure
      const status = await sound.getStatusAsync();
      console.log("Current sound status:", status);
      
      if (status.isPlaying) {
        console.log("Pausing sound");
        await sound.pauseAsync();
      } else {
        console.log("Playing sound");
        await sound.playAsync();
      }
    } catch (error) {
      console.error("Error toggling music:", error);
      // If we get an error, try to reload the sound
      setSound(null);
      setIsSoundLoaded(false);
      loadMusic();
    }
  };

  const handleTaskCompletion = () => {
    Alert.alert("Task Completion", "Have you finished the task?", [
      {
        text: "No",
        style: "cancel",
      },
      {
        text: "Yes",
        onPress: async () => {
          if (sound && isPlaying) {
            await sound.stopAsync();
          }
          setTaskCompleted(true);
          
          // Make sure values are strings
          const taskIdNum = taskId ? taskId.toString() : "";
          const parentIdNum = parentTaskId ? parentTaskId.toString() : "";
          const listIndexNum = listIndex ? listIndex.toString() : "0";
          
          // Set the destination based on where we came from
          const destination = params.returnTo === "calendar" 
            ? "/(tabs)/calendar" 
            : "/(tabs)/taskslist";
          
          // Get the original calendar view mode 
          const calendarViewMode = params.calendarViewMode || "today";
          
          console.log('Navigating back with params:', {
            completedTaskId: taskIdNum,
            isSubtask: isSubtask === "true" ? "true" : "false",
            parentTaskId: parentIdNum,
            listIndex: listIndexNum,
            completedAt: new Date().toISOString(),
            returnTo: params.returnTo,
            calendarViewMode
          });
          
          router.replace({
            pathname: destination,
            params: { 
              completedTaskId: taskIdNum,
              isSubtask: isSubtask === "true" ? "true" : "false",
              parentTaskId: parentIdNum,
              listIndex: listIndexNum,
              completedAt: new Date().toISOString(),
              returnTo: params.returnTo,
              calendarViewMode 
            }
          });
        },
      },
    ]);
  };

  useEffect(() => {
    loadMusic();
    
    return () => {
      if (sound) {
        console.log("Cleaning up sound resources");
        try {
          sound.stopAsync().then(() => {
            sound.unloadAsync();
          }).catch(err => {
            console.error("Error stopping sound in cleanup:", err);
          });
        } catch (error) {
          console.error("Error cleaning up sound:", error);
        }
      }
    };
  }, []);  

  useEffect(() => {
    let timer = null;
    if (isTimerRunning && (minutes > 0 || seconds > 0)) {
      timer = setInterval(() => {
        if (seconds === 0) {
          if (minutes === 0) {
            clearInterval(timer);
            Vibration.vibrate(1000);
            Alert.alert(
              "Pomodoro Timer",
              `Pomodoro session completed! Would you like to mark "${taskName}" as complete?`,
              [
                {
                  text: "No",
                  style: "cancel",
                },
                {
                  text: "Yes",
                  onPress: handleTaskCompletion,
                },
              ]
            );
            setIsTimerRunning(false);
          } else {
            setMinutes((prev) => prev - 1);
            setSeconds(59);
          }
        } else {
          setSeconds((prev) => prev - 1);
        }
      }, 1000);
    }

    return () => clearInterval(timer);
  }, [minutes, seconds, isTimerRunning]);

  const resetTimer = () => {
    setMinutes(25);
    setSeconds(0);
    setIsPaused(false);
    setIsTimerRunning(true);
  };

  const togglePause = () => {
    setIsPaused((prev) => !prev);
    setIsTimerRunning((prev) => !prev);
  };

  const closeTimer = () => {
    Alert.alert("End Timer", "Are you sure you want to end the timer?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Yes",
        onPress: async () => {
          if (sound && isPlaying) {
            await sound.stopAsync();
          }
          // Determine where to return based on params
          const destination = params.returnTo === "calendar" 
            ? "/(tabs)/calendar" 
            : "/(tabs)/taskslist";
   
          const calendarViewMode = params.calendarViewMode || "today";
          
          router.replace({
            pathname: destination,
            params: {
              calendarViewMode 
            }
          });
        },
      },
    ]);
  };

  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const renderSoundItem = ({ item }) => (
    <Pressable style={styles.soundItem}>
      <View style={styles.soundItemContent}>
        <Text style={styles.soundName}>{item.name}</Text>
        <View style={styles.soundControls}>
          <TouchableOpacity
            onPress={() => handlePreviewSound(item)}
            style={styles.previewButton}
          >
            <Ionicons
              name={previewingSoundId === item.id ? "stop-circle" : "play-circle"}
              size={30}
              color="#4792DD"
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleSoundSelection(item)}
            style={[
              styles.selectButton,
              selectedSound.id === item.id && styles.selectedButton
            ]}
          >
            <Text style={styles.selectButtonText}>
              {selectedSound.id === item.id ? 'Selected' : 'Select'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Pressable>
  );

  const handleModalClose = async () => {
    await stopPreviewSound();
    setIsSoundModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.taskContainer}>
        <Text style={styles.taskName}>{taskName}</Text>
        <TouchableOpacity
          style={styles.taskCheckbox}
          onPress={handleTaskCompletion}
        >
          <Ionicons
            name={taskCompleted ? "checkbox" : "square-outline"}
            size={30}
            color={taskCompleted ? "green" : "gray"}
          />
        </TouchableOpacity>
      </View>

      <LottieView
        source={{
          uri: "https://lottie.host/3cb25439-1421-4ee8-ab59-7a76cb746f38/opyknpd6DE.lottie",
        }}
        autoPlay
        loop
        style={[styles.backgroundAnimation, { width, height }]}
        resizeMode="cover"
      />

      <Svg width="300" height="300" viewBox="0 0 200 200">
        <Circle
          cx="100"
          cy="100"
          r={radius}
          stroke="#ddd"
          strokeWidth="15"
          fill="none"
        />
        <Circle
          cx="100"
          cy="100"
          r={radius}
          stroke="#4792DD"
          strokeWidth="15"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="90"
          origin="100, 100"
        />
      </Svg>

      <Text style={styles.timer}>
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </Text>

      <View style={[styles.iconButtonContainer, { width: width * 0.8 }]}>
        <TouchableOpacity onPress={togglePause} style={styles.iconButton}>
          <Ionicons
            name={isPaused ? "play-circle" : "pause-circle"}
            size={60}
            color={isPaused ? "#4CAF50" : "#F44336"}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={resetTimer} style={styles.iconButton}>
          <Ionicons name="refresh-circle" size={60} color="#2196F3" />
        </TouchableOpacity>
        <TouchableOpacity onPress={closeTimer} style={styles.iconButton}>
          <Ionicons name="close-circle" size={60} color="#9E9E9E" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={toggleMusic}
        onLongPress={() => setIsSoundModalVisible(true)}
        delayLongPress={500}
        style={[
          styles.soundIconContainer, 
          isPlaying ? styles.soundIconActive : null,
          !isSoundLoaded && styles.soundIconDisabled
        ]}
      >
        <Ionicons
          name={isPlaying ? "volume-high" : "volume-mute"}
          size={32}
          color={isSoundLoaded ? "#333" : "#999"}
        />
      </TouchableOpacity>

      <Modal
        visible={isSoundModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleModalClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Sound</Text>
              <TouchableOpacity onPress={handleModalClose}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={AVAILABLE_SOUNDS}
              renderItem={renderSoundItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.soundList}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  taskContainer: {
    position: "absolute",
    top: 80,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    padding: 15,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  taskName: {
    fontSize: 20,
    marginRight: 10,
    color: "#333",
    fontWeight: "500",
  },
  taskCheckbox: {
    padding: 5,
  },
  backgroundAnimation: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: -1,
  },
  timer: {
    position: "absolute",
    fontSize: 48,
    fontFamily: "AbhayaLibre-ExtraBold",
    color: "#333333",
    textAlign: "center",
  },
  iconButtonContainer: {
    position: "absolute",
    bottom: 30,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  iconButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  soundIconContainer: {
    position: "absolute",
    top: 40,
    right: 20,
    backgroundColor: "#e0e0e0",
    borderRadius: 40,
    padding: 10,
    shadowColor: "#bebebe",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  soundIconActive: {
    backgroundColor: "#f0f0f0",
    shadowColor: "#a0a0a0",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
  },
  soundIconDisabled: {
    backgroundColor: "#e9e9e9",
    shadowOpacity: 0.1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  soundList: {
    paddingVertical: 10,
  },
  soundItem: {
    marginBottom: 10,
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#fff',
    elevation: 2,
  },
  soundItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  soundName: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  soundControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewButton: {
    marginRight: 10,
  },
  selectButton: {
    backgroundColor: '#4792DD',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  selectedButton: {
    backgroundColor: '#4CAF50',
  },
  selectButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
});
