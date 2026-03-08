const STORAGE_KEY = 'focus_tasks_data';
const SETTINGS_KEY = 'focus_settings';

const Storage = {
  getTasks() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error reading tasks from storage:', error);
      return null;
    }
  },

  saveTasks(tasks) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      return true;
    } catch (error) {
      console.error('Error saving tasks to storage:', error);
      return false;
    }
  },

  getSettings() {
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      return data ? JSON.parse(data) : this.getDefaultSettings();
    } catch (error) {
      console.error('Error reading settings from storage:', error);
      return this.getDefaultSettings();
    }
  },

  saveSettings(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      return true;
    } catch (error) {
      console.error('Error saving settings to storage:', error);
      return false;
    }
  },

  getDefaultSettings() {
    return {
      theme: 'system',
      showCompleted: true,
      sortBy: 'date',
      defaultPriority: 'medium'
    };
  },

  clearAll() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SETTINGS_KEY);
      return true;
    } catch (error) {
      console.error('Error clearing storage:', error);
      return false;
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Storage;
}