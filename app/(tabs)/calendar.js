import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Segmented, Card, Chip, Surface, useTheme, SegmentedButtons } from 'react-native-paper';
import { Calendar, CalendarList, Agenda, WeekCalendar } from 'react-native-calendars';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isSameDay, addDays } from 'date-fns';
import TaskStorage from '../taskStorage';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from "@expo/vector-icons";
import { getDatabase } from '../../database/database';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function CalendarScreen() {
  const theme = useTheme();
  const [viewMode, setViewMode] = useState('today'); 
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [allLists, setAllLists] = useState([]);
  const [markedDates, setMarkedDates] = useState({});
  const isFocused = useIsFocused();
  const router = useRouter();
  const [completionHandled, setCompletionHandled] = useState(false);
  const params = useLocalSearchParams();

  // Load tasks from storage ONLY when the tab is focused
  useEffect(() => {
    let isMounted = true;
    console.log('Calendar tab focus state changed:', isFocused);
    
    const loadTasks = async () => {
      try {
        // Only proceed if the tab is focused
        if (!isFocused) return;
        
        console.log('Loading calendar data...');

        const db = await getDatabase();
        const user = await db.getFirstAsync('SELECT email FROM users WHERE is_deleted = 0 LIMIT 1');
        
        if (user && user.email && isMounted) {
          const lists = await TaskStorage.loadLists(user.email);
          setAllLists(lists);
          
          // Process tasks for calendar display
          processTasksForCalendar(lists);
        }
      } catch (error) {
        console.error('Error loading tasks for calendar:', error);
      }
    };
    
    // Only load data when the tab is focused
    if (isFocused) {
      loadTasks();
    }
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [isFocused]); 


  useEffect(() => {
    if (
      !completionHandled &&
      params?.completedTaskId &&
      params?.returnTo === "calendar"
    ) {
      const taskId = params.completedTaskId;
      const isSubtask = params.isSubtask === "true";
      const parentTaskId = params.parentTaskId || null;
      
      console.log('Pomodoro completion detected:', { taskId, isSubtask, parentTaskId });
      

      if (allLists && allLists.length > 0) {
        if (isSubtask) {
          handleSubtaskCompletionFromPomodoro(parentTaskId, taskId);
        } else {
          handleTaskCompletionFromPomodoro(taskId);
        }
        
        setCompletionHandled(true);
      } else {
        console.log('No lists loaded yet, waiting for data...');
      }
    }
  }, [params, allLists, completionHandled]);

  useEffect(() => {
    if (!params?.completedTaskId) {
      setCompletionHandled(false);
    }
  }, [params?.completedTaskId]);

  // Process tasks to mark dates and organize data
  const processTasksForCalendar = (lists) => {
    // Only run this if lists is valid
    if (!lists || !Array.isArray(lists)) return;
    
    const marked = {};
    let allTasks = [];
    
    lists.forEach(list => {
      if (!list || !list.tasks || !Array.isArray(list.tasks)) return;
      
      list.tasks.forEach(task => {
        if (!task) return;
        
        try {
          // Ensure task date is a valid Date object
          const taskDate = task.date instanceof Date ? task.date : new Date(task.date);
          if (isNaN(taskDate.getTime())) return; 
          
          const dateStr = format(taskDate, 'yyyy-MM-dd');
          
          allTasks.push({
            ...task,
            listName: list.name,
            formattedDate: dateStr,
            date: taskDate
          });
          
          // Mark dates with tasks on the calendar
          if (!marked[dateStr]) {
            marked[dateStr] = {
              marked: true,
              dotColor: task.isCompleted ? '#4CAF50' : theme.colors.primary
            };
          }
          
          // Add subtasks to the allTasks array
          if (task.subtasks && Array.isArray(task.subtasks)) {
            task.subtasks.forEach(subtask => {
              if (!subtask) return;
              
              try {
                // Ensure subtask date is a valid Date object
                const subtaskDate = subtask.date instanceof Date ? subtask.date : new Date(subtask.date);
                if (isNaN(subtaskDate.getTime())) return; 
                
                const subtaskDateStr = format(subtaskDate, 'yyyy-MM-dd');
                
                allTasks.push({
                  ...subtask,
                  isSubtask: true,
                  parentTaskName: task.name,
                  parentTaskId: task.id, 
                  listName: list.name,
                  formattedDate: subtaskDateStr,
                  date: subtaskDate
                });
                
                // Mark dates with subtasks
                if (!marked[subtaskDateStr]) {
                  marked[subtaskDateStr] = {
                    marked: true,
                    dotColor: subtask.isCompleted ? '#4CAF50' : '#FF9800'
                  };
                }
              } catch (e) {
                console.error("Error processing subtask date:", e);
              }
            });
          }
        } catch (e) {
          console.error("Error processing task date:", e);
        }
      });
    });
    
    // Mark today's date
    const today = format(new Date(), 'yyyy-MM-dd');
    marked[today] = {
      ...marked[today],
      selected: viewMode === 'month',
      selectedColor: '#E3F2FD'
    };
    
    setTasks(allTasks);
    setMarkedDates(marked);
  };

  const toggleTaskCompletion = async (taskId, isSubtask, parentTaskId) => {
    try {
      const updatedLists = allLists.map(list => ({
        ...list,
        tasks: list.tasks.map(task => {
          // Convert dates back to Date objects for each task
          const newTask = {
            ...task,
            date: new Date(task.date),
            subtasks: task.subtasks.map(subtask => ({
              ...subtask,
              date: new Date(subtask.date)
            }))
          };
          return newTask;
        })
      }));
      
      let found = false;
      
      if (isSubtask) {
        // Handle subtask completion
        for (const list of updatedLists) {
          for (const task of list.tasks) {
            if (task.id === parentTaskId) {
              const subtask = task.subtasks.find(st => st.id === taskId);
              if (subtask) {
                subtask.isCompleted = !subtask.isCompleted;
                found = true;
                break;
              }
            }
          }
          if (found) break;
        }
      } else {
        // Handle task completion
        for (const list of updatedLists) {
          const taskToUpdate = list.tasks.find(t => t.id === taskId);
          if (taskToUpdate) {
            taskToUpdate.isCompleted = !taskToUpdate.isCompleted;
            
            // When a task is completed, also complete all its subtasks
            if (taskToUpdate.isCompleted && taskToUpdate.subtasks) {
              taskToUpdate.subtasks.forEach(subtask => {
                subtask.isCompleted = true;
              });
            }
            found = true;
            break;
          }
        }
      }
      
      if (!found) {
        console.warn('Task not found for toggling completion');
        return;
      }
      
      setAllLists(updatedLists);
      
      // Process to show the updated calendar
      processTasksForCalendar(updatedLists);
      
      // Save to database 
      const db = await getDatabase();
      const user = await db.getFirstAsync('SELECT email FROM users WHERE is_deleted = 0 LIMIT 1');
      if (user && user.email) {
        // Save in a try/catch to ensure it completes
        try {
          await TaskStorage.saveLists(updatedLists, user.email);
          console.log('Successfully saved task completion change to database');
        } catch (saveError) {
          console.error('Error saving task completion to database:', saveError);
        }
      }
    } catch (error) {
      console.error('Error toggling task completion:', error);
    }
  };
  
  // function to start Pomodoro timer
  const startPomodoro = (taskId, taskName, isSubtask = false, parentTaskId = null) => {
    router.push({
      pathname: "/PomodoroTimer",
      params: {
        taskId,
        taskName,
        isSubtask: isSubtask ? "true" : "false",
        parentTaskId,
        listIndex: 0, 
        returnTo: "calendar", 
        calendarViewMode: viewMode 
      },
    });
  };

  const getFilteredTasks = () => {
    const filteredByDate = [];
    
    if (viewMode === 'today') {
      filteredByDate.push(...tasks.filter(task => {
        const taskDate = new Date(task.formattedDate);
        return isToday(taskDate);
      }));
    } else if (viewMode === 'week') {
      const weekStart = startOfWeek(selectedDate);
      const weekEnd = endOfWeek(selectedDate);
      
      filteredByDate.push(...tasks.filter(task => {
        const taskDate = new Date(task.formattedDate);
        return taskDate >= weekStart && taskDate <= weekEnd;
      }));
    } else {
      // Month view - filtered by the selected date
      filteredByDate.push(...tasks.filter(task => {
        const taskDate = new Date(task.formattedDate);
        return isSameDay(taskDate, selectedDate);
      }));
    }
    
    // Only return non-completed tasks
    return filteredByDate;
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
          borderColor: isChecked ? '#4CAF50' : '#888',
          backgroundColor: isChecked ? '#4CAF50' : 'transparent',
          justifyContent: 'center',
          alignItems: 'center',
          marginHorizontal: 8
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

  const renderTaskItem = ({ item }) => {
    const isSubtask = item.isSubtask;
    const parentTaskId = isSubtask ? (item.parentTaskId || item.task_id) : null;

    const displayParentName = item.parentTaskName && item.parentTaskName.length > 20 
      ? item.parentTaskName.substring(0, 18) + '...' 
      : item.parentTaskName;
    
    return (
      <Surface 
        style={[
          styles.taskCard,
          item.isCompleted && styles.completedTask
        ]} 
        elevation={2}
      >

        {isSubtask && <View style={styles.subtaskIndicator} />}
        
        <View style={styles.taskHeader}>
          <View style={styles.taskHeaderLeft}>
            <RoundCheckbox
              status={item.isCompleted ? 'checked' : 'unchecked'}
              onPress={() => toggleTaskCompletion(item.id, isSubtask, parentTaskId)}
              size={24}
            />
            <Text style={[styles.taskName, item.isCompleted && styles.completedTaskText]}>
              {item.name}
            </Text>
            

            {isSubtask && (
              <Chip 
                compact
                mode="outlined" 
                style={styles.subtaskChip}
                textStyle={{ fontSize: 11 }} 
              >
                Sub of {displayParentName}
              </Chip>
            )}
            
            <TouchableOpacity
              style={[
                styles.tomatoButton, 
                item.isCompleted && styles.disabledButton
              ]}
              onPress={() => !item.isCompleted && startPomodoro(item.id, item.name, isSubtask, parentTaskId)}
              disabled={item.isCompleted}
            >
              <Image 
                source={require('../../assets/images/tomato.png')} 
                style={[
                  styles.tomatoImage, 
                  item.isCompleted && styles.disabledImage
                ]} 
              />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.taskDetails}>
          <Text style={styles.listName}>List: {item.listName}</Text>
          
          <View style={styles.statusContainer}>
            <Ionicons
              name={item.isCompleted ? "checkmark-circle" : "ellipse-outline"}
              size={16}
              color={item.isCompleted ? "#4CAF50" : "#2196F3"}
            />
            <Text style={[styles.statusText, item.isCompleted && styles.completedStatusText]}>
              {item.isCompleted ? "Completed" : "Pending"}
            </Text>
          </View>
        </View>
      </Surface>
    );
  };

  const renderWeeklyCalendar = () => {
    const weekStart = startOfWeek(selectedDate);
    const weekDays = eachDayOfInterval({
      start: weekStart,
      end: addDays(weekStart, 6)
    });
    
    return (
      <View style={styles.weekContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {weekDays.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const isSelected = isSameDay(day, selectedDate);
            const dayHasTasks = markedDates[dateStr]?.marked;
            
            return (
              <TouchableOpacity
                key={dateStr}
                style={[
                  styles.weekDay,
                  isSelected && styles.selectedWeekDay
                ]}
                onPress={() => setSelectedDate(day)}
              >
                <Text style={[styles.weekDayName, isSelected && styles.selectedWeekDayText]}>
                  {format(day, 'EEE')}
                </Text>
                <Text style={[styles.weekDayNumber, isSelected && styles.selectedWeekDayText]}>
                  {format(day, 'd')}
                </Text>
                {dayHasTasks && <View style={styles.taskIndicator} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const handleTaskCompletionFromPomodoro = (taskId) => {
    console.log('Handling task completion from Pomodoro:', taskId);
    
    // Create a deep copy
    const updatedLists = JSON.parse(JSON.stringify(allLists));
    
    let found = false;
    
    // Find and update the task
    for (const list of updatedLists) {
      const taskIndex = list.tasks.findIndex(t => t.id.toString() === taskId.toString());
      if (taskIndex !== -1) {
        console.log('Found task to complete:', list.tasks[taskIndex].name);
        
        // Mark task as completed
        list.tasks[taskIndex].isCompleted = true;
        
        // Ensure date is a proper Date object
        if (list.tasks[taskIndex].date) {
          list.tasks[taskIndex].date = new Date(list.tasks[taskIndex].date);
        } else {
          // If date is undefined, set it to current date
          list.tasks[taskIndex].date = new Date();
        }
        
        // Also mark all subtasks as completed and fix their dates
        if (list.tasks[taskIndex].subtasks) {
          list.tasks[taskIndex].subtasks.forEach(subtask => {
            subtask.isCompleted = true;
            
            // Ensure subtask date is a proper Date object
            if (subtask.date) {
              subtask.date = new Date(subtask.date);
            } else {
              // If date is undefined, set it to current date
              subtask.date = new Date();
            }
          });
        }
        
        found = true;
        break;
      }
    }
    
    if (!found) {
      console.warn('Task not found for completion from Pomodoro:', taskId);
      return;
    }
    
    setAllLists(updatedLists);
    
    // show the updated calendar
    processTasksForCalendar(updatedLists);
    
    // Save to database
    saveListsToDatabase(updatedLists);
  };

  const handleSubtaskCompletionFromPomodoro = async (parentTaskId, subtaskId) => {
    console.log('Handling subtask completion from Pomodoro:', { parentTaskId, subtaskId });

    const updatedLists = JSON.parse(JSON.stringify(allLists));
    let found = false;
    
    // Find the parent task and then the subtask
    for (const list of updatedLists) {
      for (const task of list.tasks) {
        if (task.id.toString() === parentTaskId.toString()) {
          // Ensure task date is a proper Date object
          if (task.date) {
            task.date = new Date(task.date);
          } else {
            task.date = new Date();
          }
          
          const subtaskIndex = task.subtasks.findIndex(st => st.id.toString() === subtaskId.toString());
          if (subtaskIndex !== -1) {
            console.log('Found subtask to complete:', task.subtasks[subtaskIndex].name);
            
            // Mark subtask as completed
            task.subtasks[subtaskIndex].isCompleted = true;
            
            // Ensure subtask date is a proper Date object
            if (task.subtasks[subtaskIndex].date) {
              task.subtasks[subtaskIndex].date = new Date(task.subtasks[subtaskIndex].date);
            } else {
              task.subtasks[subtaskIndex].date = new Date();
            }
            
            found = true;
            break;
          }
        }
      }
      if (found) break;
    }
    
    if (!found) {
      console.warn('Subtask not found for completion from Pomodoro:', { parentTaskId, subtaskId });
      return;
    }

    setAllLists(updatedLists);
    
    // Process to show the updated calendar
    processTasksForCalendar(updatedLists);
    
    // Save to database
    await saveListsToDatabase(updatedLists);
  };

  const saveListsToDatabase = async (listsToSave) => {
    try {
      console.log('Saving lists to database...');
      
      // Make sure all dates are properly converted to Date objects
      const listsWithFixedDates = listsToSave.map(list => ({
        ...list,
        tasks: list.tasks.map(task => {
          // Ensure task date is a proper Date object
          let taskDate = task.date;
          if (taskDate) {
            if (!(taskDate instanceof Date)) {
              taskDate = new Date(taskDate);
            }
          } else {
            taskDate = new Date();
          }
          
          return {
            ...task,
            date: taskDate,
            subtasks: task.subtasks.map(subtask => {
              // Ensure subtask date is a proper Date object
              let subtaskDate = subtask.date;
              if (subtaskDate) {
                if (!(subtaskDate instanceof Date)) {
                  subtaskDate = new Date(subtaskDate);
                }
              } else {
                subtaskDate = new Date();
              }
              
              return {
                ...subtask,
                date: subtaskDate
              };
            })
          };
        })
      }));
      
      const db = await getDatabase();
      const user = await db.getFirstAsync('SELECT email FROM users WHERE is_deleted = 0 LIMIT 1');
      if (user && user.email) {
        await TaskStorage.saveLists(listsWithFixedDates, user.email);
        console.log('Successfully saved lists to database');
        
        // After saving, reload tasks to ensure UI is in sync
        const reloadedLists = await TaskStorage.loadLists(user.email);
        setAllLists(reloadedLists);
        processTasksForCalendar(reloadedLists);
      }
    } catch (error) {
      console.error('Error saving lists to database:', error);
    }
  };

  useEffect(() => {
    if (params?.calendarViewMode && params.calendarViewMode !== viewMode) {
      console.log('Setting calendar view mode to:', params.calendarViewMode);
      setViewMode(params.calendarViewMode);
    }
  }, [params?.calendarViewMode]);

  return (
    <SafeAreaView style={styles.container}>
      <Appbar.Header>
        <Appbar.Content title="Calendar" />
      </Appbar.Header>
      
      <View style={styles.viewSelectorContainer}>
        <SegmentedButtons
          value={viewMode}
          onValueChange={setViewMode}
          buttons={[
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' }
          ]}
          theme={{ 
            colors: { 
              secondaryContainer: '#E3F2FD',  
              primary: '#2196F3',             
              outline: '#BBDEFB'             
            } 
          }}
          style={{ backgroundColor: 'transparent' }} // Keep transparent background
        />
      </View>
      
      {viewMode === 'month' && (
        <Calendar
          onDayPress={(day) => setSelectedDate(new Date(day.dateString))}
          markedDates={markedDates}
          theme={{
            selectedDayBackgroundColor: theme.colors.primary,
            todayTextColor: theme.colors.primary,
            dotColor: theme.colors.accent,
            arrowColor: theme.colors.primary,
          }}
        />
      )}
      
      {viewMode === 'week' && renderWeeklyCalendar()}
      
      {viewMode === 'today' && (
        <View style={styles.todayHeader}>
          <Text style={styles.todayTitle}>Today's Tasks</Text>
          <Text style={styles.todayDate}>{format(new Date(), 'EEEE, MMMM d, yyyy')}</Text>
        </View>
      )}
      
      <View style={styles.taskListContainer}>
        <FlatList
          data={getFilteredTasks()}
          renderItem={renderTaskItem}
          keyExtractor={(item) => `${item.id}-${item.isSubtask ? 'sub' : 'task'}`}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No tasks for this {viewMode === 'today' ? 'day' : viewMode}</Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  viewSelectorContainer: {
    padding: 16,
    backgroundColor: 'white',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  taskListContainer: {
    flex: 1,
    padding: 12,
  },
  taskCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    position: 'relative', 
    overflow: 'hidden', 
  },
  completedTask: {
    backgroundColor: '#f8f8f8',
    borderLeftColor: '#4CAF50',
    borderLeftWidth: 3,
    opacity: 0.8,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  taskHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
  },
  checkboxContainer: {
    marginRight: 8,
  },
  taskName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginBottom: 2, 
  },
  subtaskChip: {
    marginHorizontal: 4, 
    marginVertical: 2, 
    maxWidth: 200, 
    minHeight: 28, 
    paddingHorizontal: 4, 
  },
  taskDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  listName: {
    fontSize: 12,
    color: '#666',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    marginLeft: 4,
    color: '#666',
  },
  completedStatusText: {
    color: '#4CAF50',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#888',
    fontStyle: 'italic',
  },
  todayHeader: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  todayTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  todayDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  weekContainer: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  weekDay: {
    width: 60,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  selectedWeekDay: {
    backgroundColor: '#2196F3',
  },
  weekDayName: {
    fontSize: 14,
    color: '#666',
  },
  weekDayNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  selectedWeekDayText: {
    color: 'white',
  },
  taskIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF5722',
    marginTop: 4,
  },
  completedTaskText: {
    textDecorationLine: 'line-through',
    color: '#888',
  },
  tomatoButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(249, 231, 159, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: '#FFA07A',
  },
  taskActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tomatoImage: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  disabledImage: {
    opacity: 0.5,
  },
  disabledButton: {
    backgroundColor: '#e0e0e0',
    opacity: 0.7,
    borderColor: '#ccc',
  },
  subtaskIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 8,
    backgroundColor: '#2196F3',
  },
}); 