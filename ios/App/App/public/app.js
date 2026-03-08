const App = (() => {
  let tasks = [];
  let currentFilter = 'today';
  let searchQuery = '';
  let editingTaskId = null;
  let searchDebounceTimer = null;
  // Track if user was swiping to prevent accidental taps
  let wasSwiping = false;
  let swipeThresholdMet = false;

  // Calendar state
  let calendarCurrentDate = new Date();
  let calendarSelectedDate = null;

  const getToday = () => new Date().toISOString().split('T')[0];

  const haptic = (type = 'light') => {
    if (navigator.vibrate) {
      const patterns = { light: 10, medium: 20, heavy: 30, success: [10, 50, 10, 50], error: [30, 50, 30, 50] };
      navigator.vibrate(patterns[type] || 10);
    }
  };

  const loadTasks = () => {
    const saved = Storage.getTasks();
    if (saved && Array.isArray(saved) && saved.length > 0) {
      tasks = saved;
    } else {
      // Start with empty list - no example tasks
      tasks = [];
      saveTasks();
    }
  };

  const saveTasks = () => {
    Storage.saveTasks(tasks);
  };

  const generateId = () => Date.now() + Math.random().toString(36).substr(2, 9);

  const addTask = (title, date, priority, tag = '') => {
    const task = {
      id: generateId(),
      title,
      date: date || getToday(),
      priority: priority || 'medium',
      completed: false,
      tag,
      createdAt: Date.now()
    };
    tasks.unshift(task);
    saveTasks();
    renderTasks();
    updateProgress();
    haptic('medium');
    return task;
  };

  const updateTask = (id, updates) => {
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      tasks[index] = { ...tasks[index], ...updates };
      saveTasks();
      renderTasks();
      updateProgress();
    }
  };

  const deleteTask = (id, silent = false) => {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    renderTasks();
    updateProgress();
    if (!silent) haptic('medium');
  };

  const toggleTaskComplete = (id) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      task.completed = !task.completed;
      task.completedAt = task.completed ? Date.now() : null;
      saveTasks();
      renderTasks();
      updateProgress();
      haptic(task.completed ? 'success' : 'light');
    }
  };

  const filterTasks = () => {
    const today = getToday();
    let filtered = [...tasks];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(query) ||
        (t.tag && t.tag.toLowerCase().includes(query))
      );
    }

    if (currentFilter === 'today') {
      filtered = filtered.filter(t => t.date === today && !t.completed);
    } else if (currentFilter === 'upcoming') {
      filtered = filtered.filter(t => t.date > today && !t.completed);
    } else if (currentFilter === 'completed') {
      filtered = filtered.filter(t => t.completed);
    }

    filtered.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;

      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }

      return new Date(a.date) - new Date(b.date);
    });

    return filtered;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = getToday();

    if (dateStr === today) return 'Today';

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateStr === tomorrow.toISOString().split('T')[0]) return 'Tomorrow';

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const isOverdue = (dateStr) => {
    return dateStr < getToday();
  };

  const renderDate = () => {
    const dateEl = document.getElementById('header-date');
    if (dateEl) {
      const options = { weekday: 'long', month: 'short', day: 'numeric' };
      dateEl.textContent = new Date().toLocaleDateString('en-US', options);
    }
  };

  const updateProgress = () => {
    const today = getToday();
    const todayTasks = tasks.filter(t => t.date === today);
    const total = todayTasks.length;
    const completed = todayTasks.filter(t => t.completed).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    const progressContainer = document.getElementById('progress-container');
    if (progressContainer) {
      progressContainer.innerHTML = `
        <div class="progress-header">
          <span class="progress-label">Today's Progress</span>
          <span class="progress-value">${completed}/${total}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${percentage}%"></div>
        </div>
      `;
    }
  };

  const renderTasks = () => {
    const container = document.getElementById('task-list');
    const emptyState = document.getElementById('empty-state');
    const filtered = filterTasks();

    if (!container) return;
    if (!emptyState) return;

    // Show empty state only when there are NO tasks at all
    if (tasks.length === 0) {
      container.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    // Hide empty state when there are tasks (regardless of filter)
    emptyState.classList.add('hidden');

    // If filtered is empty but tasks exist, just show empty container
    if (filtered.length === 0) {
      container.innerHTML = '';
      return;
    }

    let html = '';
    let currentSection = '';

    filtered.forEach((task, index) => {
      let sectionTitle = '';

      if (currentFilter === 'all' || currentFilter === 'completed') {
        if (task.completed && currentSection !== 'completed') {
          sectionTitle = '<div class="task-section-title">Completed</div>';
          currentSection = 'completed';
        } else if (!task.completed && currentSection !== 'pending') {
          sectionTitle = '<div class="task-section-title">To Do</div>';
          currentSection = 'pending';
        }
      }

      const overdueClass = !task.completed && isOverdue(task.date) ? 'overdue' : '';

      // Determine swipe action icon and color based on completion status
      const swipeActionClass = task.completed ? 'undo' : 'complete';
      const swipeBgColor = task.completed ? '#FF9500' : '#34C759';
      const swipeActionType = task.completed ? 'undo' : 'complete';
      const swipeIcon = task.completed ? `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
          <path d="M3 3v5h5"></path>
        </svg>
      ` : `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;

      // For completed tasks: undo (orange) is on left
      // For incomplete tasks: complete (green) is on left
      // Swipe right to reveal complete/undo, swipe left to delete
      const primaryActionClass = task.completed ? 'undo' : 'complete';
      const primaryActionBg = task.completed ? '#FF9500' : '#34C759';
      const primaryActionType = task.completed ? 'undo' : 'complete';

      html += sectionTitle + `
        <div class="task-card ${task.completed ? 'completed' : ''}" data-id="${task.id}" data-completed="${task.completed}" data-animated="false">
          <div class="swipe-actions">
            <div class="swipe-action ${primaryActionClass} ${primaryActionType}" data-action="${primaryActionType}" style="background-color: ${primaryActionBg} !important;">
              ${swipeIcon}
            </div>
            <div class="swipe-action delete" data-action="delete">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </div>
          </div>
          <div class="task-content">
            <div class="task-title">${escapeHtml(task.title)}</div>
            <div class="task-meta">
              <span class="task-date ${overdueClass}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                ${formatDate(task.date)}
              </span>
              <span class="priority-badge ${task.priority}">${task.priority}</span>
              ${task.tag ? `<span class="tag-badge">${escapeHtml(task.tag)}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    initCardAnimations();
    initSwipeGestures();
    initEventDelegation();
  };

  const initCardAnimations = () => {
    const cards = document.querySelectorAll('.task-card[data-animated="false"]');
    cards.forEach((card, index) => {
      card.style.animationDelay = `${index * 50}ms`;
      card.dataset.animated = 'true';
      // Mark as already animated after animation completes
      setTimeout(() => {
        card.classList.add('has-been-animated');
      }, 300 + (index * 50));
    });
  };

  const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const initEventDelegation = () => {
    const container = document.getElementById('task-list');
    if (!container) return;

    // Prevent accidental edit modal when swiping
    container.addEventListener('click', (e) => {
      // If user was swiping above threshold, don't process click
      if (wasSwiping && swipeThresholdMet) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;
      const id = target.dataset.id;

      switch (action) {
        case 'toggle':
          toggleTaskComplete(id);
          break;
        case 'edit':
          openEditModal(id);
          break;
        case 'delete':
          showDeleteConfirmation(id);
          break;
      }
    });
  };

  const showDeleteConfirmation = (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    haptic('medium');

    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-dialog">
        <div class="confirm-title">Delete Task?</div>
        <div class="confirm-message">"${escapeHtml(task.title)}" will be permanently deleted.</div>
        <div class="confirm-actions">
          <button class="confirm-btn cancel" data-action="cancel">Cancel</button>
          <button class="confirm-btn delete" data-action="confirm">Delete</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));

    const handleConfirm = (e) => {
      const action = e.target.dataset.action;
      if (action === 'confirm') {
        // Find and animate the card away before deleting
        const card = document.querySelector(`.task-card[data-id="${id}"]`);
        if (card) {
          card.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
          card.style.transform = 'translateX(-150%)';
          card.style.opacity = '0';

          setTimeout(() => {
            deleteTask(id);
            haptic('medium');
          }, 150);
        } else {
          deleteTask(id);
          haptic('medium');
        }
      }
      overlay.remove();
    };

    overlay.addEventListener('click', handleConfirm);
  };

  const initSwipeGestures = () => {
    const cards = document.querySelectorAll('.task-card');

    cards.forEach(card => {
      let startX = 0;
      let startY = 0;
      let currentX = 0;
      let isSwiping = false;
      let startTime = 0;
      let hasMoved = false;
      const swipeActions = card.querySelector('.swipe-actions');

      const onStart = (e) => {
        // Don't process if multiple touches
        if (e.touches && e.touches.length > 1) return;

        startX = e.touches ? e.touches[0].clientX : e.clientX;
        startY = e.touches ? e.touches[0].clientY : e.clientY;
        currentX = 0;
        isSwiping = true;
        hasMoved = false;
        startTime = Date.now();
        wasSwiping = false;
        swipeThresholdMet = false;

        e.preventDefault();
      };

      const onMove = (e) => {
        if (!isSwiping) return;

        e.preventDefault();

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const deltaX = clientX - startX;
        const deltaY = clientY - startY;

        // Determine if horizontal or vertical gesture
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 15) {
          isSwiping = false;
          card.style.transform = '';
          card.style.transition = '';
          return;
        }

        hasMoved = true;
        currentX = deltaX;

        // iOS-style: reveal actions from behind, don't move card much
        // Limit translation to max ~80px for action reveal effect
        const translate = Math.max(-80, Math.min(80, deltaX * 0.4));
        card.style.transform = `translateX(${translate}px)`;
        card.style.transition = 'none';

        // Threshold for showing action highlights
        const actionThreshold = 50;

        if (swipeActions) {
          // Get the correct action button based on swipe direction and task state
          const isCompleted = card.dataset.completed === 'true';
          const primaryAction = isCompleted
            ? swipeActions.querySelector('[data-action="undo"]')
            : swipeActions.querySelector('[data-action="complete"]');
          const deleteAction = swipeActions.querySelector('.swipe-action.delete');

          // Always update active state based on current position
          if (deltaX > actionThreshold) {
            // Swiping right - reveal complete/undo from left
            if (primaryAction) {
              primaryAction.classList.add('active');
              primaryAction.style.opacity = '1';
            }
            deleteAction.classList.remove('active');
            deleteAction.style.opacity = '';

            // Update tracking for click prevention
            if (deltaX > actionThreshold * 1.5) {
              swipeThresholdMet = true;
              wasSwiping = true;
            }
          } else if (deltaX < -actionThreshold) {
            // Swiping left - reveal delete from right
            deleteAction.classList.add('active');
            deleteAction.style.opacity = '1';
            if (primaryAction) {
              primaryAction.classList.remove('active');
              primaryAction.style.opacity = '';
            }

            if (Math.abs(deltaX) > actionThreshold * 1.5) {
              swipeThresholdMet = true;
              wasSwiping = true;
            }
          } else {
            // In middle zone - remove all highlights
            if (primaryAction) {
              primaryAction.classList.remove('active');
              primaryAction.style.opacity = '';
            }
            deleteAction.classList.remove('active');
            deleteAction.style.opacity = '';
            swipeThresholdMet = false;
          }
        }
      };

      const onEnd = () => {
        if (!isSwiping || !hasMoved) {
          isSwiping = false;
          card.style.transform = '';
          card.style.transition = '';
          return;
        }

        // Use 1/3 of card width as threshold (approximately 80-100px)
        const cardWidth = card.offsetWidth;
        const threshold = Math.max(80, cardWidth / 3);

        const elapsed = Date.now() - startTime;
        const velocity = Math.abs(currentX) / (elapsed || 1);
        // Allow lower threshold for fast swipes
        const fastThreshold = threshold * 0.6;

        if (currentX > threshold || (velocity > 0.5 && currentX > fastThreshold)) {
          // Swipe right - complete/undo
          const taskId = card.dataset.id;
          const isCompleted = card.dataset.completed === 'true';

          // Animate card away
          card.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
          card.style.transform = 'translateX(150%)';
          card.style.opacity = '0';

          setTimeout(() => {
            toggleTaskComplete(taskId);
          }, 150);

          haptic(isCompleted ? 'medium' : 'success');
        } else if (currentX < -threshold || (velocity > 0.5 && currentX < -fastThreshold)) {
          // Swipe left - delete - show confirmation but don't hide card yet
          const taskId = card.dataset.id;

          // Spring back the card - don't hide it
          card.style.transition = 'transform 0.3s var(--ease-out-quart)';
          card.style.transform = '';

          // Show delete confirmation
          showDeleteConfirmation(taskId);
        } else {
          // Reset card position - spring back
          card.style.transition = 'transform 0.3s var(--ease-out-quart)';
          card.style.transform = '';
        }

        if (swipeActions) {
          swipeActions.querySelectorAll('.swipe-action').forEach(a => {
            a.classList.remove('active');
            a.style.opacity = '';
          });
        }

        isSwiping = false;

        setTimeout(() => {
          wasSwiping = false;
          swipeThresholdMet = false;
        }, 300);
      };

      // Touch events for iOS
      card.addEventListener('touchstart', onStart, { passive: false });
      card.addEventListener('touchmove', onMove, { passive: false });
      card.addEventListener('touchend', onEnd, { passive: true });
      card.addEventListener('touchcancel', onEnd, { passive: true });

      // Mouse events for desktop
      card.addEventListener('mousedown', onStart);
      card.addEventListener('mousemove', onMove);
      card.addEventListener('mouseup', onEnd);
      card.addEventListener('mouseleave', onEnd);
    });
  };

  const setFilter = (filter) => {
    currentFilter = filter;

    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.classList.remove('active');
    });

    const activeTab = document.getElementById(`filter-${filter}`);
    if (activeTab) {
      activeTab.classList.add('active');
    }

    renderTasks();
    updateProgress();
    haptic('light');
  };

  const setSearch = (query) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      searchQuery = query;
      renderTasks();
      updateProgress();
    }, 150);
  };

  const openAddModal = () => {
    editingTaskId = null;
    document.getElementById('modal-title').textContent = 'New Task';
    document.getElementById('task-title').value = '';
    document.getElementById('task-date').value = getToday();
    document.getElementById('task-priority').value = 'medium';
    document.getElementById('task-tag').value = '';

    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('task-modal').classList.add('active');
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
      document.getElementById('task-title').focus();
    }, 100);

    haptic('light');
  };

  const openEditModal = (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    editingTaskId = id;
    document.getElementById('modal-title').textContent = 'Edit Task';
    document.getElementById('task-title').value = task.title;
    document.getElementById('task-date').value = task.date;
    document.getElementById('task-priority').value = task.priority;
    document.getElementById('task-tag').value = task.tag || '';

    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('task-modal').classList.add('active');
    document.body.style.overflow = 'hidden';

    haptic('light');
  };

  const closeModal = () => {
    document.getElementById('modal-overlay').classList.remove('active');
    document.getElementById('task-modal').classList.remove('active');
    document.getElementById('calendar-modal').classList.remove('active');
    document.body.style.overflow = '';
    editingTaskId = null;
  };

  const saveTask = () => {
    const title = document.getElementById('task-title').value.trim();
    const date = document.getElementById('task-date').value;
    const priority = document.getElementById('task-priority').value;
    const tag = document.getElementById('task-tag').value.trim();

    if (!title) {
      document.getElementById('task-title').focus();
      haptic('error');
      return;
    }

    if (editingTaskId) {
      updateTask(editingTaskId, { title, date, priority, tag });
    } else {
      addTask(title, date, priority, tag);
    }

    closeModal();
  };

  const toggleTheme = () => {
    const html = document.documentElement;
    const isDark = html.classList.toggle('dark');

    const settings = Storage.getSettings();
    settings.theme = isDark ? 'dark' : 'light';
    Storage.saveSettings(settings);

    updateThemeIcon();
    haptic('light');
  };

  // ========== CALENDAR FUNCTIONS ==========

  const openCalendarModal = () => {
    calendarCurrentDate = new Date();
    calendarSelectedDate = getToday();
    renderCalendar();
    renderCalendarTasks();

    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('calendar-modal').classList.add('active');
    document.body.style.overflow = 'hidden';

    haptic('light');
  };

  const closeCalendarModal = () => {
    document.getElementById('modal-overlay').classList.remove('active');
    document.getElementById('calendar-modal').classList.remove('active');
    document.body.style.overflow = '';
  };

  const renderCalendar = () => {
    const year = calendarCurrentDate.getFullYear();
    const month = calendarCurrentDate.getMonth();

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    // Update header
    document.getElementById('calendar-month-year').textContent = `${monthNames[month]} ${year}`;

    // Get first day of month and total days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const today = getToday();
    const daysContainer = document.getElementById('calendar-days');
    daysContainer.innerHTML = '';

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEl = createCalendarDay(day, dateStr, true);
      daysContainer.appendChild(dayEl);
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEl = createCalendarDay(day, dateStr, false, dateStr === today);
      daysContainer.appendChild(dayEl);
    }

    // Next month days to fill grid
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    const remainingCells = totalCells - (firstDay + daysInMonth);
    for (let day = 1; day <= remainingCells; day++) {
      const nextMonth = month + 1 > 11 ? 0 : month + 1;
      const nextYear = month + 1 > 11 ? year + 1 : year;
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEl = createCalendarDay(day, dateStr, true);
      daysContainer.appendChild(dayEl);
    }
  };

  const createCalendarDay = (day, dateStr, isOtherMonth, isToday = false) => {
    const dayEl = document.createElement('button');
    dayEl.className = 'calendar-day';
    dayEl.textContent = day;

    if (isOtherMonth) {
      dayEl.classList.add('other-month');
    }

    if (isToday) {
      dayEl.classList.add('today');
    }

    if (calendarSelectedDate === dateStr) {
      dayEl.classList.add('selected');
    }

    // Check if day has tasks
    const dayTasks = tasks.filter(t => t.date === dateStr);
    if (dayTasks.length > 0) {
      dayEl.classList.add('has-tasks');
    }

    dayEl.addEventListener('click', () => selectCalendarDate(dateStr));

    return dayEl;
  };

  const selectCalendarDate = (dateStr) => {
    calendarSelectedDate = dateStr;
    renderCalendar();
    renderCalendarTasks();
    haptic('light');
  };

  const renderCalendarTasks = () => {
    const tasksContainer = document.getElementById('calendar-tasks');
    const headerEl = document.getElementById('calendar-tasks-header');

    if (!calendarSelectedDate) {
      tasksContainer.innerHTML = '';
      return;
    }

    const dayTasks = tasks.filter(t => t.date === calendarSelectedDate);

    // Format date for header
    const date = new Date(calendarSelectedDate + 'T00:00:00');
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    headerEl.textContent = date.toLocaleDateString('en-US', options);

    if (dayTasks.length === 0) {
      tasksContainer.innerHTML = '<div class="calendar-no-tasks">No tasks for this day</div>';
      return;
    }

    tasksContainer.innerHTML = dayTasks.map(task => `
      <div class="calendar-task-item" data-id="${task.id}">
        <div class="calendar-task-checkbox ${task.completed ? 'checked' : ''}" data-action="toggle" data-id="${task.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <span class="calendar-task-text ${task.completed ? 'completed' : ''}">${escapeHtml(task.title)}</span>
      </div>
    `).join('');

    // Add click handlers for task checkboxes
    tasksContainer.querySelectorAll('.calendar-task-checkbox').forEach(checkbox => {
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskId = checkbox.dataset.id;
        toggleTaskComplete(taskId);
        renderCalendarTasks();
      });
    });

    // Add click handlers for task items to edit
    tasksContainer.querySelectorAll('.calendar-task-item').forEach(item => {
      item.addEventListener('click', () => {
        const taskId = item.dataset.id;
        closeCalendarModal();
        openEditModal(taskId);
      });
    });
  };

  const navigateCalendar = (direction) => {
    calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() + direction);
    renderCalendar();
    haptic('light');
  };

  const updateThemeIcon = () => {
    const isDark = document.documentElement.classList.contains('dark');
    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');

    if (sunIcon && moonIcon) {
      sunIcon.style.display = isDark ? 'block' : 'none';
      moonIcon.style.display = isDark ? 'none' : 'block';
    }
  };

  const initTheme = () => {
    const settings = Storage.getSettings();

    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (settings.theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    }

    updateThemeIcon();
  };

  const registerServiceWorker = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('SW registered'))
        .catch(err => console.log('SW registration failed'));
    }
  };

  const init = () => {
    loadTasks();
    renderDate();
    updateProgress();
    renderTasks();
    initTheme();
    registerServiceWorker();

    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeModal();
    });
    document.getElementById('btn-cancel').addEventListener('click', closeModal);
    document.getElementById('btn-save').addEventListener('click', saveTask);

    // Save button state based on title input
    document.getElementById('task-title').addEventListener('input', function () {
      const saveBtn = document.getElementById('btn-save');
      if (this.value.trim()) {
        saveBtn.classList.add('has-title');
      } else {
        saveBtn.classList.remove('has-title');
      }
    });
    document.getElementById('btn-add').addEventListener('click', openAddModal);
    document.getElementById('btn-theme').addEventListener('click', toggleTheme);

    document.getElementById('search-input').addEventListener('input', (e) => {
      setSearch(e.target.value);
    });

    document.getElementById('filter-today').addEventListener('click', () => setFilter('today'));
    document.getElementById('filter-upcoming').addEventListener('click', () => setFilter('upcoming'));
    document.getElementById('filter-all').addEventListener('click', () => setFilter('all'));
    document.getElementById('filter-completed').addEventListener('click', () => setFilter('completed'));

    // Calendar event listeners
    document.getElementById('btn-calendar').addEventListener('click', openCalendarModal);
    document.getElementById('calendar-prev').addEventListener('click', () => navigateCalendar(-1));
    document.getElementById('calendar-next').addEventListener('click', () => navigateCalendar(1));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
      if (e.key === 'Enter' && document.getElementById('task-modal').classList.contains('active')) {
        saveTask();
      }
    });
  };

  return {
    init,
    toggleComplete: toggleTaskComplete,
    confirmDelete: showDeleteConfirmation,
    openEditModal,
    openAddModal
  };
})();

document.addEventListener('DOMContentLoaded', App.init);