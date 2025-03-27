import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  Alert,
  SafeAreaView,
  Platform,
  BackHandler,
  StatusBar,
  Dimensions,
  Image
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import TaskStorage from "./taskStorage";
import { synchronize, startBackgroundSync } from "../services/syncService";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  Appbar, 
  FAB, 
  List, 
  Checkbox, 
  Divider, 
  Portal, 
  Dialog, 
  Button, 
  IconButton,
  Surface,
  Provider,
  useTheme,
  Searchbar
} from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import { getDatabase } from '../database/database'; 
import { colors } from '../styles/colors';

export default function TasksList() {
  const [lists, setLists] = useState([]);
  const [newListName, setNewListName] = useState("");
  const [selectedListIndex, setSelectedListIndex] = useState(null);
  const [newTaskName, setNewTaskName] = useState("");
  const [newSubtaskName, setNewSubtaskName] = useState("");
  const [isModalVisible, setModalVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [taskDate, setTaskDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [subtaskDate, setSubtaskDate] = useState(new Date());
  const [showSubtaskDatePicker, setShowSubtaskDatePicker] = useState(false);
  const [editingSubtaskId, setEditingSubtaskId] = useState(null);
  const [selectedTaskIndex, setSelectedTaskIndex] = useState(null);
  const [isTaskModalVisible, setTaskModalVisible] = useState(false);
  const [completionHandled, setCompletionHandled] = useState(false);
  const [subtaskDateError, setSubtaskDateError] = useState(null);
  const [isSubtaskDateValid, setIsSubtaskDateValid] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isGlobalSearch, setIsGlobalSearch] = useState(true);
  const [lastSaveTimestamp, setLastSaveTimestamp] = useState(0);

  const router = useRouter();
  const params = useLocalSearchParams();
  const theme = useTheme();

  const STATUSBAR_HEIGHT = Platform.OS === 'android' ? Constants.statusBarHeight : 0;

  const CustomStatusBar = ({backgroundColor, ...props}) => (
    <View style={{ height: STATUSBAR_HEIGHT, backgroundColor, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
      <StatusBar translucent backgroundColor={backgroundColor} {...props} />
    </View>
  );

  // Create a constant for the AsyncStorage key
  const LAST_LIST_KEY = 'lastSelectedList'; 

  // Add refs for input values
  const listNameRef = useRef(null);
  const taskNameRef = useRef(null);
  

  useEffect(() => {
    if (!isModalVisible) {
      listNameRef.current = null; 
    }
  }, [isModalVisible]);

  useEffect(() => {
    if (!isTaskModalVisible) {
      taskNameRef.current = null; 
    }
  }, [isTaskModalVisible]);

  useEffect(() => {
    if (
      !completionHandled &&
      params?.completedTaskId &&
      params?.listIndex !== undefined
    ) {
      const taskId = params.completedTaskId;
      const isSubtask = params.isSubtask === "true";
      const parentTaskId = params.parentTaskId || null;
      const listIndex = parseInt(params.listIndex);

      if (listIndex >= 0 && listIndex < lists.length) {
        setSelectedListIndex(listIndex);

        if (isSubtask) {
          handleSubtaskCompletionFromPomodoro(listIndex, parentTaskId, taskId);
        } else {
          handleTaskCompletionFromPomodoro(listIndex, taskId);
        }

        setCompletionHandled(true);
      }
    }
  }, [params, lists, completionHandled]);

  useEffect(() => {
    if (!params?.completedTaskId) {
      setCompletionHandled(false);
    }
  }, [params?.completedTaskId]);

  const handleTaskCompletionFromPomodoro = (listIndex, taskId) => {
    if (listIndex >= 0 && listIndex < lists.length) {
      setLists((currentLists) => {
        const updatedLists = [...currentLists];
        const taskIndex = updatedLists[listIndex].tasks.findIndex(
          (t) => t.id === taskId
        );
        if (taskIndex !== -1) {
          updatedLists[listIndex].tasks[taskIndex].isCompleted = true;

          saveLists();
        }
        return updatedLists;
      });
    }
  };

  const deleteList = async (index) => {
    try {
      Alert.alert(
        "Delete List",
        "Are you sure you want to delete this list? This action cannot be undone.",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              const updatedLists = [...lists];
              updatedLists.splice(index, 1);
              setLists(updatedLists);
          
              if (selectedListIndex === index) {
                if (updatedLists.length > 0) {
                  const newIndex = index > 0 ? index - 1 : 0;
                  setSelectedListIndex(newIndex);
                } else {
                  setSelectedListIndex(null);
                }
              } else if (selectedListIndex > index) {
                setSelectedListIndex(selectedListIndex - 1);
              }

              saveLists();
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to delete list. Please try again.", [
        { text: "OK" }
      ]);
    }
  };

  const handleSubtaskCompletionFromPomodoro = (
    listIndex,
    parentTaskId,
    subtaskId
  ) => {
    if (listIndex >= 0 && listIndex < lists.length) {
      setLists((currentLists) => {
        const updatedLists = [...currentLists];
        const taskIndex = updatedLists[listIndex].tasks.findIndex(
          (t) => t.id === parentTaskId
        );
        if (taskIndex !== -1) {
          const subtaskIndex = updatedLists[listIndex].tasks[
            taskIndex
          ].subtasks.findIndex((st) => st.id === subtaskId);
          if (subtaskIndex !== -1) {
            updatedLists[listIndex].tasks[taskIndex].subtasks[
              subtaskIndex
            ].isCompleted = true;

            saveLists();
          }
        }
        return updatedLists;
      });
    }
  };

  useEffect(() => {
    const fetchEmail = async () => {
      try {
        const db = await getDatabase();
        const user = await db.getFirstAsync('SELECT email FROM users WHERE is_deleted = 0 LIMIT 1');
        if (user) {
          setEmail(user.email);
          loadSavedLists(user.email);
          startBackgroundSync(); 
        } else {
          router.replace("/signin");
        }
      } catch (error) {
        console.error('Error fetching user email:', error);
        Alert.alert("Error", "Failed to retrieve user information");
      }
    };
    fetchEmail();
  }, []);


  useEffect(() => {
    const saveSelectedListIndex = async () => {
      if (selectedListIndex !== null) {
        try {
          const listData = { 
            email: email, 
            index: selectedListIndex 
          };
          await AsyncStorage.setItem(LAST_LIST_KEY, JSON.stringify(listData));
        } catch (error) {
          console.error('Error saving last selected list:', error);
        }
      }
    };

    if (email) {
      saveSelectedListIndex();
    }
  }, [selectedListIndex, email]);

  const handleLogout = async () => {
    try {
      try {
        await synchronize({ skipOnOffline: false, silent: false });
      } catch (error) {
        console.log("Final sync before logout failed:", error);
      }
      
      const db = await getDatabase();
      const timestamp = Date.now();
      
      await db.runAsync(
        'UPDATE users SET is_deleted = 1, updated_at = ? WHERE email = ?', 
        [timestamp, email]
      );
      
      // Clear auth token and sync data
      await SecureStore.deleteItemAsync("authToken");
      await SecureStore.deleteItemAsync("lastSync");
      
      // Clear memory state
      setLists([]);
      setEmail("");
      router.replace("/signin");
    } catch (error) {
      console.error('Error during logout:', error);
      Alert.alert("Error", "Failed to log out. Please try again.");
    }
  };

  useEffect(() => {
    loadSavedLists(email);
  }, [email]);

  useEffect(() => {
    if (lists.length > 0 && email) {
      saveLists();
    }
  }, [lists, email]);

  const loadSavedLists = async (userEmail) => {
    try {
      const savedLists = await TaskStorage.loadLists(userEmail);
      setLists(savedLists);
      
      // After loading lists, try to restore the last selected list
      try {
        const lastListJSON = await AsyncStorage.getItem(LAST_LIST_KEY);
        if (lastListJSON) {
          const lastList = JSON.parse(lastListJSON);
          // Only restore if it's for the current user and the index is valid
          if (lastList.email === userEmail && 
              lastList.index >= 0 && 
              lastList.index < savedLists.length) {
            setSelectedListIndex(lastList.index);
          } else if (savedLists.length > 0) {
            // If the saved index is invalid but we have lists, select the first one
            setSelectedListIndex(0);
          }
        } else if (savedLists.length > 0) {
          // If no saved selection but we have lists, select the first one
          setSelectedListIndex(0);
        }
      } catch (error) {
        console.error('Error restoring last selected list:', error);
        // If there was an error but we have lists, select the first one
        if (savedLists.length > 0) {
          setSelectedListIndex(0);
        }
      }
    } catch (error) {
      Alert.alert("Error", "Failed to load your tasks. Please try again.", [
        { text: "OK" },
      ]);
    }
  };

  const saveLists = async () => {
    try {
      if (!email) {
        console.warn("Cannot save lists: No user email available");
        return;
      }
      
      if (isSaving) {
        console.log("Save operation already in progress, skipping...");
        return;
      }
      
      setIsSaving(true);
      await TaskStorage.saveLists(lists, email);
      
      // Track when save happened
      const saveTime = Date.now();
      setLastSaveTimestamp(saveTime);
      
      // Store this in AsyncStorage to persist across reloads
      try {
        await AsyncStorage.setItem('LAST_SAVE_TIME', saveTime.toString());
      } catch (e) {
        console.error("Failed to store save timestamp:", e);
      }
      
    } catch (error) {
      console.error("Error saving lists:", error);
      Alert.alert("Error", "Failed to save your changes. Please try again.", [
        { text: "OK" },
      ]);
    } finally {
      setIsSaving(false);
    }
  };

  const addList = async () => {
    const listName = listNameRef.current || "";
    if (listName.trim() === "") {
      Alert.alert("Error", "List name cannot be empty");
      return;
    }
    
    if (!email) {
      Alert.alert("Error", "User information not available");
      return;
    }
    
    try {
      const updatedLists = [
        ...lists,
        {
          id: Date.now().toString(),
          name: listName,
          created_at: Date.now(),
          email: email,
          tasks: [],
        },
      ];
      setLists(updatedLists);
      setNewListName("");
      setModalVisible(false);
    } catch (error) {
      console.error("Error adding list:", error);
      Alert.alert("Error", "Failed to create new list. Please try again.", [
        { text: "OK" },
      ]);
    }
  };

  const addTask = async (index) => {
    const taskName = taskNameRef.current || "";
    if (taskName.trim() === "") {
      Alert.alert("Error", "Task name cannot be empty");
      return;
    }
    if (index === null || index < 0 || index >= lists.length) {
      Alert.alert("Error", "Please select a valid list");
      return;
    }
    try {
      const updatedLists = [...lists];
      updatedLists[index].tasks.push({
        id: Date.now().toString(),
        name: taskName,
        date: taskDate,
        subtasks: [],
        isExpanded: false,
        isCompleted: false,
        created_at: Date.now()
      });
      setLists(updatedLists);
      setNewTaskName("");
      setTaskDate(new Date());
      setTaskModalVisible(false);
      saveLists();
    } catch (error) {
      Alert.alert("Error", "Failed to add task. Please try again.", [
        { text: "OK" },
      ]);
    }
  };
  const addSubtask = async (taskIndex) => {
    if (newSubtaskName.trim() === "") {
      Alert.alert("Error", "Subtask name cannot be empty");
      return;
    }
    
    // Get parent task date for validation
    const parentTask = lists[selectedListIndex].tasks[taskIndex];
    const parentDate = new Date(parentTask.date);
    const subtaskDateObj = new Date(subtaskDate);
    
    // Validate that subtask date is not after parent task date
    if (subtaskDateObj > parentDate) {
      Alert.alert(
        "Invalid Date", 
        `Subtask due date cannot be after the parent task due date (${parentDate.toLocaleDateString()}).`
      );
      return;
    }
    
    try {
      const updatedLists = [...lists];
      updatedLists[selectedListIndex].tasks[taskIndex].subtasks.push({
        id: Date.now().toString(),
        name: newSubtaskName,
        date: subtaskDate,
        isCompleted: false,
        created_at: Date.now()
      });
      setLists(updatedLists);
      setNewSubtaskName("");
      setSubtaskDate(new Date());
      saveLists();
    } catch (error) {
      Alert.alert("Error", "Failed to add subtask. Please try again.", [
        { text: "OK" },
      ]);
    }
  };

  const startPomodoro = (
    taskId,
    taskName,
    isSubtask = false,
    parentTaskId = null
  ) => {
    router.push({
      pathname: "/PomodoroTimer",
      params: {
        taskId,
        taskName,
        isSubtask,
        parentTaskId,
        listIndex: selectedListIndex,
      },
    });
  };

  const onDateChange = (event, selectedDate) => {
    if (event.type === "dismissed") {
      setShowDatePicker(false);
      return;
    }

    const currentDate = selectedDate || taskDate;
    setShowDatePicker(false);

    if (editingTaskId) {
      updateTaskDate(currentDate);
    } else {
      setTaskDate(currentDate);
    }
  };

  const onSubtaskDateChange = (event, selectedDate) => {
    if (event.type === "dismissed") {
      setShowSubtaskDatePicker(false);
      return;
    }

    const currentDate = selectedDate || subtaskDate;
    setShowSubtaskDatePicker(false);

    if (editingSubtaskId) {
      const parentTask = lists[selectedListIndex]?.tasks[selectedTaskIndex];
      const parentDate = new Date(parentTask.date);
      
      if (new Date(currentDate) > parentDate) {
        Alert.alert(
          "Invalid Date", 
          `Subtask due date cannot be after the parent task due date (${parentDate.toLocaleDateString()}).`
        );
        setIsSubtaskDateValid(false);
        setSubtaskDateError(`Cannot be after ${parentDate.toLocaleDateString()}`);
      } else {
        setIsSubtaskDateValid(true);
        setSubtaskDateError(null);
        updateSubtaskDate(currentDate);
      }
    } else {
      if (selectedTaskIndex !== null) {
        const parentTask = lists[selectedListIndex]?.tasks[selectedTaskIndex];
        const parentDate = new Date(parentTask.date);
        
        if (new Date(currentDate) > parentDate) {
          Alert.alert(
            "Invalid Date", 
            `Subtask due date cannot be after the parent task due date (${parentDate.toLocaleDateString()}).`
          );
          setIsSubtaskDateValid(false);
          setSubtaskDateError(`Cannot be after ${parentDate.toLocaleDateString()}`);
        } else {
          setIsSubtaskDateValid(true);
          setSubtaskDateError(null);
          setSubtaskDate(currentDate);
        }
      } else {
        setSubtaskDate(currentDate);
      }
    }
  };

  const updateTaskDate = (newDate) => {
    if (!editingTaskId || selectedListIndex === null) return;

    const updatedLists = [...lists];
    updatedLists[selectedListIndex].tasks = updatedLists[
      selectedListIndex
    ].tasks.map((task) => {
      if (task.id === editingTaskId) {
        return { ...task, date: newDate };
      }
      return task;
    });
    setLists(updatedLists);
    setEditingTaskId(null);
    saveLists();
  };

  const updateSubtaskDate = (newDate) => {
    if (
      !editingSubtaskId ||
      selectedListIndex === null ||
      selectedTaskIndex === null
    )
      return;

    const updatedLists = [...lists];
    const task = updatedLists[selectedListIndex].tasks[selectedTaskIndex];
    task.subtasks = task.subtasks.map((subtask) => {
      if (subtask.id === editingSubtaskId) {
        return { ...subtask, date: newDate };
      }
      return subtask;
    });

    setLists(updatedLists);
    setEditingSubtaskId(null);
    saveLists();
  };

  const startEditingDate = (taskId) => {
    // Find which list contains this task
    const listIndex = searchQuery.trim() 
      ? lists.findIndex(list => 
          list.tasks.some(task => task.id === taskId)
        )
      : selectedListIndex;
    
    if (listIndex !== -1 && listIndex !== null) {
      setSelectedListIndex(listIndex); 
    }
    
    setEditingTaskId(taskId);
    setShowDatePicker(true);
  };

  const startEditingSubtaskDate = (taskIndex, subtaskId) => {
    setSelectedTaskIndex(taskIndex);
    setEditingSubtaskId(subtaskId);
    setShowSubtaskDatePicker(true);
  };

  const toggleTaskExpansion = (taskIndex, taskId) => {
    try {
      // Find which list contains this task
      const listIndex = searchQuery.trim() 
        ? lists.findIndex(list => 
            list.tasks.some(task => task.id === taskId)
          )
        : selectedListIndex;
      
      if (listIndex === -1 || listIndex === null) return;
      
      const updatedLists = [...lists];
      const currentList = updatedLists[listIndex];
      
      // Find the task directly by ID
      const taskToToggleIndex = currentList.tasks.findIndex(t => t.id === taskId);
      if (taskToToggleIndex === -1) return;
      
      const taskToToggle = currentList.tasks[taskToToggleIndex];
      
      const isExpanding = !taskToToggle.isExpanded;
      taskToToggle.isExpanded = isExpanding;
      
      // When expanding a task, set the default subtask date to the parent task's date
      if (isExpanding) {
        const parentTaskDate = taskToToggle.date;
        setSubtaskDate(new Date(parentTaskDate));
        setSelectedTaskIndex(taskToToggleIndex);
        setSelectedListIndex(listIndex); 
        setIsSubtaskDateValid(true);
        setSubtaskDateError(null);
      }
      
      setLists(updatedLists);
      saveLists();
    } catch (error) {
      console.error("Error toggling task expansion:", error);
    }
  };

  const toggleTaskCompletion = async (taskIndex, taskId) => {
    try {
      // Find which list contains this task
      const listIndex = searchQuery.trim() 
        ? lists.findIndex(list => 
            list.tasks.some(task => task.id === taskId)
          )
        : selectedListIndex;
      
      if (listIndex === -1 || listIndex === null) return;
      
      const updatedLists = [...lists];
      const currentList = updatedLists[listIndex];
      
      // Find the task directly by ID
      const taskToToggleIndex = currentList.tasks.findIndex(t => t.id === taskId);
      if (taskToToggleIndex === -1) return;
      
      const taskToToggle = currentList.tasks[taskToToggleIndex];
      
      // Toggle completion state
      const newCompletedState = !taskToToggle.isCompleted;
      taskToToggle.isCompleted = newCompletedState;
      
      // If task is being marked as completed, also mark all subtasks as completed
      if (newCompletedState) {
        taskToToggle.subtasks.forEach(subtask => {
          subtask.isCompleted = true;
        });
      }
      // If task is being marked as incomplete, also mark all subtasks as incomplete
      else {
        taskToToggle.subtasks.forEach(subtask => {
          subtask.isCompleted = false;
        });
      }
      
      setLists(updatedLists);
      saveLists();
    } catch (error) {
      Alert.alert("Error", "Failed to update task status. Please try again.", [
        { text: "OK" },
      ]);
    }
  };

  const toggleSubtaskCompletion = async (taskIndex, subtaskIndex) => {
    try {
      const updatedLists = [...lists];
      const currentList = updatedLists[selectedListIndex];
      
      // Find the actual task in the original array
      const taskToToggle = currentList.tasks[taskIndex];
      
      if (!taskToToggle) return;
      
      // Toggle subtask completion
      const subtask = taskToToggle.subtasks[subtaskIndex];
      if (!subtask) return;
      
      // Toggle the completion status
      subtask.isCompleted = !subtask.isCompleted;
      
      setLists(updatedLists);
      saveLists();
      
      // If this subtask was just marked as completed, check if all subtasks are now completed
      if (subtask.isCompleted) {
        checkAllSubtasksCompleted(selectedListIndex, taskIndex);
      }
    } catch (error) {
      Alert.alert(
        "Error",
        "Failed to update subtask status. Please try again.",
        [{ text: "OK" }]
      );
    }
  };

  const deleteTask = (taskIndex, taskId) => {
    try {
      Alert.alert(
        "Delete Task",
        "Are you sure you want to delete this task and all its subtasks?",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                // Find which list contains this task
                const listIndex = searchQuery.trim() 
                  ? lists.findIndex(list => 
                      list.tasks.some(task => task.id === taskId)
                    )
                  : selectedListIndex;
                
                if (listIndex === -1 || listIndex === null) return;
                
                const updatedLists = [...lists];
                const currentList = updatedLists[listIndex];
                
                // Find the task index directly by ID
                const originalTaskIndex = currentList.tasks.findIndex(t => t.id === taskId);
                
                if (originalTaskIndex !== -1) {
                  currentList.tasks.splice(originalTaskIndex, 1);
                  setLists(updatedLists);
                  saveLists();
                }
              } catch (error) {
                Alert.alert("Error", "Failed to delete task. Please try again.");
              }
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to prepare task deletion. Please try again.");
    }
  };

  const deleteSubtask = (taskIndex, subtaskIndex) => {
    Alert.alert(
      "Delete Subtask",
      "Are you sure you want to delete this subtask?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const updatedLists = [...lists];
              updatedLists[selectedListIndex].tasks[taskIndex].subtasks.splice(subtaskIndex, 1);
              setLists(updatedLists);
              saveLists();
            } catch (error) {
              Alert.alert("Error", "Failed to delete subtask. Please try again.");
            }
          }
        }
      ]
    );
  };

  const renderSubtasks = (task, taskIndex) => {
    if (!task.isExpanded && !task.isCompleted) return null;
    if (task.isCompleted) return null; 

    const parentTaskDate = new Date(task.date);

    return (
      <View style={styles.subtasksContainer}>
        <View style={styles.addSubtaskContainer}>
          <View style={styles.subtaskInputRow}>
            <TextInput
              mode="outlined"
              label="Enter Subtask Name"
              value={newSubtaskName}
              onChangeText={setNewSubtaskName}
              style={styles.subtaskInput}
              disabled={task.isCompleted}
            />
            
            <IconButton
              icon="calendar"
              size={20}
              onPress={() => !task.isCompleted && setShowSubtaskDatePicker(true)}
              style={[
                styles.calendarIconButton,
                !isSubtaskDateValid && styles.calendarIconButtonError,
                task.isCompleted && styles.disabledIcon
              ]}
              disabled={task.isCompleted}
            />
            
            <Button
              mode="contained"
              onPress={() => !task.isCompleted && addSubtask(taskIndex)}
              style={[styles.addSubtaskButton, task.isCompleted && styles.disabledButton]}
              labelStyle={styles.addSubtaskButtonLabel}
              compact
              icon="plus"
              iconColor="#FFFFFF"
              disabled={task.isCompleted || !isSubtaskDateValid || newSubtaskName.trim() === ""}
            >
              Add
            </Button>
          </View>
          
          {!task.isCompleted && (
            <View style={styles.subtaskDateContainer}>
              <Text style={styles.subtaskDateLabel}>
                Due: {subtaskDate.toLocaleDateString()} 
                {subtaskDate.getTime() === parentTaskDate.getTime() && 
                  <Text style={styles.parentDateNote}> (same as parent task)</Text>
                }
              </Text>
              {subtaskDateError && (
                <Text style={styles.dateErrorText}>{subtaskDateError}</Text>
              )}
            </View>
          )}
        </View>

        {task.subtasks.map((subtask, subtaskIndex) => (
          <Surface key={subtask.id} style={styles.subtaskItem} elevation={1}>
            <List.Item
              title={subtask.name}
              titleStyle={subtask.isCompleted ? styles.completedSubtask : null}
              description={new Date(subtask.date).toLocaleDateString()}
              descriptionStyle={styles.subtaskDateText}
              left={() => (
                <RoundCheckbox
                  status={subtask.isCompleted ? 'checked' : 'unchecked'}
                  onPress={() => toggleSubtaskCompletion(taskIndex, subtaskIndex)}
                  size={20}
                />
              )}
              right={() => (
                <View style={styles.subtaskActions}>
                  <TouchableOpacity
                    style={[
                      styles.tomatoButton, 
                      (subtask.isCompleted || task.isCompleted) && styles.disabledButton
                    ]}
                    onPress={() => !subtask.isCompleted && !task.isCompleted && startPomodoro(subtask.id, subtask.name, true, task.id)}
                    disabled={subtask.isCompleted || task.isCompleted}
                  >
                    <Image 
                      source={require('../assets/images/tomato.png')} 
                      style={[
                        styles.tomatoImage, 
                        (subtask.isCompleted || task.isCompleted) && styles.disabledImage
                      ]} 
                    />
                  </TouchableOpacity>
                  <IconButton
                    icon={() => <Ionicons name="calendar-outline" size={20} color={subtask.isCompleted || task.isCompleted ? "#CCCCCC" : colors.primary} />}
                    size={20}
                    onPress={() => !subtask.isCompleted && !task.isCompleted && startEditingSubtaskDate(taskIndex, subtask.id)}
                    disabled={subtask.isCompleted || task.isCompleted}
                  />
                  <IconButton
                    icon={() => <Ionicons name="trash-outline" size={16} color={colors.danger} />}
                    size={16}
                    onPress={() => deleteSubtask(taskIndex, subtaskIndex)}
                  />
                </View>
              )}
            />
          </Surface>
        ))}
      </View>
    );
  };

  const RoundCheckbox = ({ status, onPress, size = 24 }) => {
    const isChecked = status === 'checked';
    return (
      <TouchableOpacity 
        onPress={onPress}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: isChecked ? colors.success : colors.gray,
          backgroundColor: isChecked ? colors.success : 'transparent',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {isChecked && (
          <Ionicons 
            name="checkmark" 
            size={size - 8} 
            color="white" 
          />
        )}
      </TouchableOpacity>
    );
  };

  // Filter all active tasks across lists
  const getFilteredActiveTasks = () => {
    if (!lists.length) return [];

    // If no search query, show selected list's tasks
    if (!searchQuery.trim() && selectedListIndex !== null) {
      return lists[selectedListIndex].tasks
        .filter(task => !task.isCompleted)
        .map(task => ({ ...task, listName: lists[selectedListIndex].name }));
    }

    if (searchQuery.trim()) {
      // If searching, decide whether to search globally or just in the current list
      if (isGlobalSearch) {
        // Global search across all lists
        const activeTasks = lists.flatMap(list =>
          list.tasks
            .filter(task => !task.isCompleted)
            .map(task => ({ ...task, listName: list.name }))
        );

        return activeTasks.filter(task => {
          const taskMatch = task.name.toLowerCase().includes(searchQuery.toLowerCase());
          const subtaskMatch = task.subtasks.some(subtask =>
            subtask.name.toLowerCase().includes(searchQuery.toLowerCase())
          );
          return taskMatch || subtaskMatch;
        });
      } else {
        // Search only in current list
        if (selectedListIndex === null) return [];
        
        return lists[selectedListIndex].tasks
          .filter(task => !task.isCompleted)
          .filter(task => {
            const taskMatch = task.name.toLowerCase().includes(searchQuery.toLowerCase());
            const subtaskMatch = task.subtasks.some(subtask =>
              subtask.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
            return taskMatch || subtaskMatch;
          })
          .map(task => ({ ...task, listName: lists[selectedListIndex].name }));
      }
    }

    return [];
  };

  // Filter all completed tasks across lists
  const getFilteredCompletedTasks = () => {
    if (!lists.length) return [];

    // If no search query, show selected list's tasks
    if (!searchQuery.trim() && selectedListIndex !== null) {
      return lists[selectedListIndex].tasks
        .filter(task => task.isCompleted)
        .map(task => ({ ...task, listName: lists[selectedListIndex].name }));
    }

    if (searchQuery.trim()) {
      // If searching, decide whether to search globally or just in the current list
      if (isGlobalSearch) {
        // Global search across all lists
        const completedTasks = lists.flatMap(list =>
          list.tasks
            .filter(task => task.isCompleted)
            .map(task => ({ ...task, listName: list.name }))
        );

        return completedTasks.filter(task => {
          const taskMatch = task.name.toLowerCase().includes(searchQuery.toLowerCase());
          const subtaskMatch = task.subtasks.some(subtask =>
            subtask.name.toLowerCase().includes(searchQuery.toLowerCase())
          );
          return taskMatch || subtaskMatch;
        });
      } else {
        // Search only in current list
        if (selectedListIndex === null) return [];
        
        return lists[selectedListIndex].tasks
          .filter(task => task.isCompleted)
          .filter(task => {
            const taskMatch = task.name.toLowerCase().includes(searchQuery.toLowerCase());
            const subtaskMatch = task.subtasks.some(subtask =>
              subtask.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
            return taskMatch || subtaskMatch;
          })
          .map(task => ({ ...task, listName: lists[selectedListIndex].name }));
      }
    }

    return [];
  };

  const renderTask = ({ item: task, index: taskIndex }) => {
    // Calculate completion percentage for subtasks
    let completionPercentage = 0;
    if (task.subtasks && task.subtasks.length > 0) {
      const completedSubtasks = task.subtasks.filter(subtask => subtask.isCompleted).length;
      completionPercentage = (completedSubtasks / task.subtasks.length) * 100;
    }

    return (
      <Surface style={styles.taskItem} elevation={1}>
        <List.Item
          title={task.name}
          titleStyle={task.isCompleted ? styles.completedTask : null}
          description={() => (
            <View>
              <Text style={styles.dateText}>{new Date(task.date).toLocaleDateString()}</Text>
              {searchQuery.trim() && <Text style={styles.listNameText}>List: {task.listName}</Text>}
            </View>
          )}
          descriptionStyle={styles.dateText}
          left={() => (
            <View style={{ paddingLeft: 10 }}>
              <RoundCheckbox
                status={task.isCompleted ? 'checked' : 'unchecked'}
                onPress={() => toggleTaskCompletion(taskIndex, task.id)}
              />
            </View>
          )}
          right={() => (
            <View style={styles.taskActions}>
              {task.subtasks.length > 0 && !task.isCompleted && (
                <View style={styles.completionIndicator}>
                  <View 
                    style={[
                      styles.completionFill, 
                      { 
                        height: `${completionPercentage}%`,
                        backgroundColor: colors.success 
                      }
                    ]} 
                  />
                </View>
              )}
              <TouchableOpacity
                style={[
                  styles.tomatoButton, 
                  task.isCompleted && styles.disabledButton
                ]}
                onPress={() => !task.isCompleted && startPomodoro(task.id, task.name)}
                disabled={task.isCompleted}
              >
                <Image 
                  source={require('../assets/images/tomato.png')} 
                  style={[
                    styles.tomatoImageLarge, 
                    task.isCompleted && styles.disabledImage
                  ]} 
                />
              </TouchableOpacity>
              <IconButton
                icon={() => <Ionicons name="calendar-outline" size={20} color={task.isCompleted ? "#CCCCCC" : colors.primary} />}
                size={20}
                onPress={() => !task.isCompleted && startEditingDate(task.id)}
                disabled={task.isCompleted}
              />
              <IconButton
                icon={() => <Ionicons name="trash-outline" size={20} color={colors.danger} />}
                size={20}
                onPress={() => deleteTask(taskIndex, task.id)}
              />
              <IconButton
                icon={() => <Ionicons name={task.isExpanded ? "chevron-up" : "chevron-down"} size={24} color={task.isCompleted ? "#CCCCCC" : colors.primary} />}
                size={24}
                onPress={() => !task.isCompleted && toggleTaskExpansion(taskIndex, task.id)}
                disabled={task.isCompleted}
              />
            </View>
          )}
        />
        {renderSubtasks(task, searchQuery.trim() 
          ? lists.findIndex(list => list.name === task.listName) !== -1
            ? lists[lists.findIndex(list => list.name === task.listName)].tasks.findIndex(t => t.id === task.id)
            : taskIndex
          : taskIndex
        )}
      </Surface>
    );
  };

  useFocusEffect(
    React.useCallback(() => {
      // Disable hardware back button on Android
      const onBackPress = () => {
        if (email) {
          // If user is authenticated, prevent going back
          return true;
        }
        return false;
      };

      BackHandler.addEventListener('hardwareBackPress', onBackPress);

      // Cleanup function
      return () => {
        BackHandler.removeEventListener('hardwareBackPress', onBackPress);
      };
    }, [email])
  );

  useEffect(() => {
    if (Platform.OS === 'ios' && email) {
      // Get the navigation object
      const navigation = router.getParent();
      if (navigation) {
        navigation.setOptions({
          gestureEnabled: false,
        });
      }
    }
  }, [email, router]);

  useFocusEffect(
    React.useCallback(() => {
      // Load the last saved timestamp from AsyncStorage
      const loadLastSaveTime = async () => {
        try {
          const savedTime = await AsyncStorage.getItem('LAST_SAVE_TIME');
          if (savedTime) {
            setLastSaveTimestamp(parseInt(savedTime));
          }
        } catch (e) {
          console.error("Failed to load save timestamp:", e);
        }
      };
      
      // Only reload if we have an email (user is logged in)
      if (email) {
        console.log('Taskslist tab focused');
        
        const now = Date.now();
        const timeSinceLastSave = now - lastSaveTimestamp;
        
        if (timeSinceLastSave > 5000) { 
          console.log('Data hasn\'t been saved recently, reloading from database');
          loadSavedLists(email);
        } else {
          console.log('Data was saved recently, skipping reload');
        }

        loadLastSaveTime();
      }
      
      return () => {
        // No cleanup needed
      };
    }, [email, lastSaveTimestamp])
  );

  const renderHeader = () => (
    <Stack.Screen
      options={{
        headerShown: false,
      }}
    />
  );

  const getListCompletionPercentage = (list) => {
    if (!list || !list.tasks || list.tasks.length === 0) return 0;
    
    const totalTasks = list.tasks.length;
    const completedTasks = list.tasks.filter(task => task.isCompleted).length;
    
    return Math.floor((completedTasks / totalTasks) * 100);
  };

  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;

  const onSearchIconPress = () => {
    // This will focus the Searchbar input
    if (searchBarRef.current) {
      searchBarRef.current.focus();
    }
  };

  const searchBarRef = React.useRef(null);

  // Handle toggling the search visibility
  const toggleSearch = () => {
    setIsSearchVisible(!isSearchVisible);
    // If we're hiding the search, also clear it
    if (isSearchVisible) {
      setSearchQuery('');
    }
  };

  const toggleSearchScope = () => {
    setIsGlobalSearch(!isGlobalSearch);
    // When changing scope, reset search results
    if (searchQuery.trim()) {
      // Keep the query but refresh results based on new scope
      const currentQuery = searchQuery;
      setSearchQuery('');
      setTimeout(() => setSearchQuery(currentQuery), 0);
    }
  };

  const checkAllSubtasksCompleted = (listIndex, taskIndex) => {
    const task = lists[listIndex].tasks[taskIndex];
    
    // Only check if task has subtasks and is not already completed
    if (task.subtasks.length > 0 && !task.isCompleted) {
      const allSubtasksCompleted = task.subtasks.every(subtask => subtask.isCompleted);
      
      if (allSubtasksCompleted) {
        Alert.alert(
          "All Subtasks Completed",
          "Would you like to mark the entire task as completed or add another subtask?",
          [
            {
              text: "Add Another Subtask",
              onPress: () => {
                // Make sure task is expanded so user can add subtask
                if (!task.isExpanded) {
                  const updatedLists = [...lists];
                  updatedLists[listIndex].tasks[taskIndex].isExpanded = true;
                  setLists(updatedLists);
                  setSelectedTaskIndex(taskIndex);
                  saveLists();
                }
              },
              style: "cancel"
            },
            {
              text: "Mark Task Complete",
              onPress: () => {
                // Mark the task as completed
                const updatedLists = [...lists];
                updatedLists[listIndex].tasks[taskIndex].isCompleted = true;
                setLists(updatedLists);
                saveLists();
              },
              style: "default"
            }
          ]
        );
      }
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar backgroundColor={colors.primary} barStyle="light-content" translucent={false} />
      <View style={{ flex: 1, backgroundColor: colors.primary }}>
        <Provider>
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.primary }}>
            <LinearGradient
              colors={colors.gradient}
              style={{ flex: 1 }}
            >
              <View style={[styles.customHeader]}>
                {email && (
                  <View style={styles.emailContainer}>
                    <Text style={styles.emailText}>{email.split("@")[0]}</Text>
                    <IconButton
                      icon={() => <Ionicons name="log-out-outline" size={24} color="#FFFFFF" />}
                      size={24}
                      onPress={handleLogout}
                      style={styles.logoutButton}
                    />
                  </View>
                )}
              </View>
              
              <View style={styles.mainContent}>
                <View style={styles.taskWindow}>
                  {lists.length > 0 ? (
                    <View style={styles.taskContent}>
                      <View style={styles.taskHeader}>
                        <Text style={[styles.listName, isSearchVisible && styles.reducedMargin]}>
                          {searchQuery.trim()
                            ? isGlobalSearch ? "Global Search Results" : `Search in ${lists[selectedListIndex]?.name}`
                            : (selectedListIndex !== null ? lists[selectedListIndex]?.name || "Unnamed List" : "All Tasks")}
                        </Text>
                      </View>
                      

                      {isSearchVisible && (
                        <View style={styles.searchContainer}>
                          <Searchbar
                            placeholder={isGlobalSearch 
                              ? "Search across all lists..." 
                              : `Search in "${lists[selectedListIndex]?.name}" only...`}
                            onChangeText={setSearchQuery}
                            value={searchQuery}
                            style={styles.mainSearchBar}
                            autoFocus={true}
                            theme={{ colors: { primary: colors.primary } }}
                          />
                          <TouchableOpacity 
                            style={[styles.searchScopeToggle, {backgroundColor: isGlobalSearch ? colors.accent : colors.gray}]}
                            onPress={toggleSearchScope}
                          >
                            <Ionicons
                              name={isGlobalSearch ? "globe-outline" : "list-outline"}
                              size={22}
                              color="#fff"
                              style={{ opacity: 1 }}
                            />
                          </TouchableOpacity>
                        </View>
                      )}
                      
                      <FlatList
                        data={getFilteredActiveTasks()}
                        renderItem={renderTask}
                        keyExtractor={(item) => item.id.toString()}
                        ListEmptyComponent={
                          <Text style={styles.emptyListText}>
                            {searchQuery ? "No matching active tasks" : "No active tasks"}
                          </Text>
                        }
                      />
                      
                      {getFilteredCompletedTasks().length > 0 && (
                        <>
                          <Text style={styles.completedSectionTitle}>Completed</Text>
                          <FlatList
                            data={getFilteredCompletedTasks()}
                            renderItem={renderTask}
                            keyExtractor={(item) => item.id.toString()}
                            style={styles.completedTasksList}
                            scrollEnabled={true}
                          />
                        </>
                      )}
                      
                      {!searchQuery.trim() && selectedListIndex !== null && (
                        <TouchableOpacity
                          style={{
                            position: "absolute",
                            bottom: 10,
                            left: 0,
                            backgroundColor: colors.accent,
                            width: 50,
                            height: 50,
                            borderRadius: 25,
                            justifyContent: "center",
                            alignItems: "center",
                            elevation: 4,
                            zIndex: 10,
                          }}
                          onPress={() => setTaskModalVisible(true)}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="add-outline" size={24} color="#FFFFFF" />
                            <Ionicons name="list-outline" size={18} color="#FFFFFF" style={{ marginLeft: -5 }} />
                          </View>
                          <Text style={{ color: '#FFFFFF', fontSize: 8, fontWeight: 'bold', marginTop: -2 }}>TASK</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <Text style={styles.noListText}>
                      Create a list to get started
                    </Text>
                  )}
                </View>

                <View style={styles.sidebar}>
                  <View style={styles.sidebarTop}>
                    <TouchableOpacity
                      style={styles.searchIconContainer}
                      onPress={toggleSearch}
                    >
                      <Ionicons
                        name="search"
                        size={24}
                        color={colors.primary}
                        style={{ opacity: 1 }}
                      />
                    </TouchableOpacity>
                  </View>
                  <FlatList
                    data={lists}
                    keyExtractor={(_, index) => index.toString()}
                    renderItem={({ item, index }) => {
                      // Calculate the completion percentage for this list
                      const completionPercentage = getListCompletionPercentage(item);
                      // Determine if all tasks are completed (100%) or not
                      const allTasksCompleted = completionPercentage === 100;
                      
                      return (
                        <Surface 
                          style={[
                            styles.listItem,
                            selectedListIndex === index && styles.selectedListItem,
                          ]}
                          elevation={2}
                        >
                          <TouchableOpacity 
                            style={styles.verticalListItem}
                            onPress={() => setSelectedListIndex(index)}
                            onLongPress={() => deleteList(index)}
                            delayLongPress={500}
                          >

                            <View style={styles.listCompletionIndicator}>
                              <View style={styles.completionBar}>
                                {item.tasks.length > 0 ? (
                                  <View 
                                    style={[
                                      styles.completionBarFill, 
                                      { 
                                        height: completionPercentage > 0 ? `${completionPercentage}%` : '100%',
                                        backgroundColor: allTasksCompleted ? colors.success : colors.danger 
                                      }
                                    ]} 
                                  />
                                ) : (
                                  <View 
                                    style={[
                                      styles.completionBarFill, 
                                      { 
                                        height: '100%',
                                        backgroundColor: colors.danger 
                                      }
                                    ]} 
                                  />
                                )}
                              </View>
                            </View>
                            
                            <Text 
                              style={[
                                styles.verticalText, 
                                selectedListIndex === index && styles.selectedVerticalText
                              ]}
                              numberOfLines={1}
                            >
                              {item.name}
                            </Text>
                          </TouchableOpacity>
                        </Surface>
                      );
                    }}
                  />
                  <TouchableOpacity
                    style={{
                      position: "absolute",
                      bottom: 10,
                      left: 5,
                      backgroundColor: colors.accent,
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      justifyContent: "center",
                      alignItems: "center",
                      elevation: 4,
                    }}
                    onPress={() => setModalVisible(true)}
                  >
                    <Ionicons name="add-outline" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
              
              <Portal>
                <Dialog visible={isModalVisible} onDismiss={() => setModalVisible(false)} style={styles.dialog}>
                  <Dialog.Title style={styles.dialogTitle}>Add New List</Dialog.Title>
                  <Dialog.Content>
                    <TextInput
                      label="List Name"
                      mode="outlined"
                      onChangeText={(text) => {
                        listNameRef.current = text; 
                      }}
                      outlineColor={colors.lightGray}
                      activeOutlineColor={colors.primary}
                      autoFocus={true}
                      style={styles.dialogInput}
                    />
                  </Dialog.Content>
                  <Dialog.Actions style={styles.dialogActions}>
                    <Button onPress={() => setModalVisible(false)} textColor={colors.gray} style={styles.cancelButton}>Cancel</Button>
                    <Button onPress={addList} mode="contained" buttonColor={colors.accent} style={styles.confirmButton}>Add</Button>
                  </Dialog.Actions>
                </Dialog>
              </Portal>

              <Portal>
                <Dialog visible={isTaskModalVisible} onDismiss={() => setTaskModalVisible(false)} style={styles.dialog}>
                  <Dialog.Title style={styles.dialogTitle}>Add New Task</Dialog.Title>
                  <Dialog.Content>
                    <TextInput
                      label="Task Name"
                      mode="outlined"
                      onChangeText={(text) => {
                        taskNameRef.current = text; 
                      }}
                      style={[styles.dialogInput, {marginBottom: 16}]}
                      outlineColor={colors.lightGray}
                      activeOutlineColor={colors.primary}
                      autoFocus={true}
                    />
                    <Button
                      mode="outlined"
                      icon="calendar"
                      onPress={() => setShowDatePicker(true)}
                      textColor={colors.primary}
                      style={styles.dateButton}
                      iconColor={colors.primary}
                    >
                      {taskDate.toLocaleDateString()}
                    </Button>
                  </Dialog.Content>
                  <Dialog.Actions style={styles.dialogActions}>
                    <Button onPress={() => setTaskModalVisible(false)} textColor={colors.gray} style={styles.cancelButton}>Cancel</Button>
                    <Button 
                      onPress={() => {
                        if (
                          selectedListIndex !== null &&
                          selectedListIndex >= 0 &&
                          selectedListIndex < lists.length
                        ) {
                          addTask(selectedListIndex);
                        } else {
                          Alert.alert("Error", "Please select a valid list first");
                        }
                      }} 
                      mode="contained" 
                      buttonColor={colors.accent}
                      style={styles.confirmButton}
                    >
                      Add
                    </Button>
                  </Dialog.Actions>
                </Dialog>
              </Portal>
              
              {showDatePicker && (
                <DateTimePicker
                  value={
                    editingTaskId
                      ? lists[selectedListIndex]?.tasks.find(
                          (t) => t.id === editingTaskId
                        )?.date || new Date()
                      : taskDate
                  }
                  mode="date"
                  display="default"
                  onChange={onDateChange}
                />
              )}
              {showSubtaskDatePicker && (
                <DateTimePicker
                  value={
                    editingSubtaskId
                      ? lists[selectedListIndex]?.tasks[
                          selectedTaskIndex
                        ]?.subtasks.find((st) => st.id === editingSubtaskId)?.date ||
                      new Date()
                    : subtaskDate
                  }
                  mode="date"
                  display="default"
                  onChange={onSubtaskDateChange}
                />
              )}
            </LinearGradient>
          </SafeAreaView>
        </Provider>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: colors.primary, 
  },
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  customHeader: {
    backgroundColor: colors.primary,
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    justifyContent: "space-between",
  },
  emailContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  emailText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "500",
  },
  logoutButton: {
    margin: 0,
    padding: 0,
    width: 32,
    height: 32,
  },
  mainContent: {
    flex: 1,
    flexDirection: "row",
  },
  taskContent: {
    flex: 1,
    position: "relative",
  },
  pomodoroButton: {
    padding: 5,
    marginHorizontal: 5,
  },
  addTaskButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
  },
  taskWindow: {
    flex: 0.9,
    padding: 2,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    position: "relative",
  },
  modalContent: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    width: "80%",
    maxWidth: 400,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  sidebar: {
    flex: 0.1,
    backgroundColor: "rgba(235, 245, 251, 0.9)",
    padding: 3,
    borderLeftWidth: 1,
    borderLeftColor: colors.lightGray,
  },
  listItem: {
    marginBottom: 4,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#fff',
    marginHorizontal: 2,
    position: 'relative',
  },
  verticalListItem: {
    height: 70,
    width: 30,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 0,
  },
  verticalText: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: 'center',
    width: 70,
    transform: [{ rotate: '90deg' }],
    color: colors.primary,
    letterSpacing: 0.5,
    position: 'absolute',
    left: -20,
    right: -20,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  selectedVerticalText: {
    color: '#fff',
    fontWeight: "700",
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  selectedListItem: {
    backgroundColor: colors.primary,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
  },
  addListButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "#ADA996",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  input: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 5,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  taskItem: {
    marginBottom: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  taskActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subtaskActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateButton: {
    marginHorizontal: 5,
  },
  subtaskDateButton: {
    marginHorizontal: 5,
    fontSize: 12,
  },
  noListText: {
    textAlign: "center",
    color: colors.gray,
    marginTop: 20,
    fontSize: 16,
  },
  listName: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: colors.primary,
  },
  buttonTextList: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "bold",
  },
  buttonTextList2: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  buttonTextTask: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  buttonTextSubtask: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  subtasksContainer: {
    marginLeft: 20,
    marginTop: 10,
    borderLeftWidth: 1,
    borderLeftColor: colors.lightGray,
    paddingLeft: 10,
  },
  addSubtaskContainer: {
    marginBottom: 10,
  },
  subtaskInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  subtaskInput: {
    flex: 1,
    backgroundColor: "#fff",
    marginRight: 4,
  },
  calendarIconButton: {
    margin: 0,
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    borderRadius: 4,
  },
  calendarIconButtonError: {
    backgroundColor: 'rgba(245, 183, 177, 0.3)',
  },
  addSubtaskButton: {
    backgroundColor: colors.accent,
    borderRadius: 4,
    marginLeft: 4,
    height: 40,
    justifyContent: 'center',
    elevation: 2,
  },
  addSubtaskButtonLabel: {
    fontSize: 12,
    marginHorizontal: 4,
  },
  subtaskItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    marginVertical: 2,
  },
  subtaskText: {
    flex: 1,
    fontSize: 14,
    color: colors.dark,
  },
  completedSubtask: {
    textDecorationLine: "line-through",
    color: colors.gray,
  },
  subtaskDateContainer: {
    marginTop: 2,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  subtaskDateLabel: {
    fontSize: 12,
    color: colors.gray,
  },
  parentDateNote: {
    fontStyle: 'italic',
    color: colors.gray,
  },
  dateErrorText: {
    color: colors.danger,
    fontSize: 11,
    marginTop: 2,
  },
  addButton: {
    backgroundColor: colors.accent,
    padding: 10,
    borderRadius: 5,
    alignItems: "center",
    marginVertical: 5,
  },
  cancelButton: {
    backgroundColor: colors.gray,
    padding: 10,
    borderRadius: 5,
    alignItems: "center",
    marginTop: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  completedTask: {
    textDecorationLine: "line-through",
    color: colors.gray,
  },
  dateText: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 2,
  },
  subtaskDateText: {
    fontSize: 10,
    color: colors.gray,
    marginTop: 2,
  },
  tomatoIcon: {
    backgroundColor: 'rgba(249, 231, 159, 0.3)',
    borderRadius: 12,
  },
  safeContainer: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  emptyListText: {
    textAlign: "center",
    color: colors.gray,
    marginTop: 20,
    fontStyle: "italic",
  },
  completedSectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 10,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
    color: colors.primary,
    textAlign: "center",
  },
  disabledIcon: {
    opacity: 0.5,
    backgroundColor: 'rgba(200, 200, 200, 0.3)',
  },
  disabledButton: {
    backgroundColor: colors.lightGray,
    opacity: 0.7,
  },
  completedTasksList: {
    maxHeight: Dimensions.get('window').height / 3,
    marginBottom: 50,
  },
  tomatoButton: {
    padding: 8,
    marginHorizontal: 4,
    backgroundColor: 'rgba(249, 231, 159, 0.3)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tomatoImage: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  tomatoImageLarge: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  disabledImage: {
    opacity: 0.5,
  },
  searchBar: {
    margin: 5,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    height: 40,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  listNameText: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 2,
  },
  taskHeader: {
    flexDirection: 'row', 
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  searchButton: {
    position: 'absolute',
    right: 0,
    top: -10,
  },
  reducedMargin: {
    marginBottom: 5,
  },
  mainSearchBar: {
    flex: 0.85, 
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    height: 45,
  },
  sidebarTop: {
    alignItems: 'center',
    marginVertical: 5,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  searchIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 25, 
    width: 40,
    height: 40,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    marginBottom: 15,
    justifyContent: 'space-between',
  },
  searchScopeToggle: {
    flex: 0.13, 
    height: 45, 
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    marginLeft: 6,
  },
  dialog: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 8,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dialogTitle: {
    color: colors.primary,
    fontWeight: 'bold',
    fontSize: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  dialogInput: {
    backgroundColor: '#f9f9f9',
    marginTop: 8,
  },
  dialogActions: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  dateButton: {
    borderColor: colors.primary,
    borderWidth: 1.5,
    borderRadius: 8,
  },
  cancelButton: {
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  confirmButton: {
    paddingHorizontal: 16,
    borderRadius: 8,
    elevation: 2,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  completionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(200, 200, 200, 0.2)', 
    overflow: 'hidden',
    marginRight: 4,
    borderWidth: 1,
    borderColor: 'rgba(200, 200, 200, 0.3)',
  },
  completionFill: {
    width: '100%',
    backgroundColor: '#4CAF50', 
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
  hasProgress: {
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  listCompletionIndicator: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    left: 0,
    width: 4,
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 5,
  },
  completionBar: {
    width: 4,
    height: '100%',
    backgroundColor: 'rgba(200, 200, 200, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  completionBarFill: {
    width: '100%', 
    borderRadius: 2,
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
});
