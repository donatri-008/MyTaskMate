/* ==================================================
                KONFIGURASI FIREBASE
   ================================================== */
const firebaseConfig = {
    apiKey: "AIzaSyBgVA3bFwydCDPJLF38vrklk_Mllt9XjLI",
    authDomain: "mytaskmate-6fcf5.firebaseapp.com",
    projectId: "mytaskmate-6fcf5",
    storageBucket: "mytaskmate-6fcf5.firebasestorage.app",
    messagingSenderId: "986388619299",
    appId: "1:986388619299:web:ac9c15d7fdd7347ab2d196",
    measurementId: "G-6757LELMBR"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

  // Handle Register Link
  document.getElementById('show-register').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('login-page').classList.remove('active');
    document.getElementById('register-page').classList.add('active');
  });

  // Handle Login Link
  document.getElementById('show-login').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('register-page').classList.remove('active');
    document.getElementById('login-page').classList.add('active');
  });

  // Handle Google Login
  document.getElementById('google-login').addEventListener('click', async () => {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(provider);
      window.location.href = 'app.html';
    } catch (error) {
      console.error('Google Login Error:', error);
      alert(`Login Gagal: ${error.message}`);
    }
  });

/* ==================================================
                VARIABEL GLOBAL
   ================================================== */
let currentUser = null;
let todos = [];
let currentEditIndex = null;
let dragStartIndex = null;

const categories = {
    general: { name: 'Umum', color: '#a8d8ea' },
    work: { name: 'Pekerjaan', color: '#aa96da' },
    personal: { name: 'Pribadi', color: '#fcbad3' },
    study: { name: 'Belajar', color: '#9ec0e3' }
};

/* ==================================================
                INISIALISASI APLIKASI
   ================================================== */
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initDOMElements();
    initEventListeners();
});

/* ==================================================
                FUNGSI INISIALISASI
   ================================================== */
function initAuth() {
  auth.onAuthStateChanged(user => {
      if (!user) {
          if (window.location.pathname !== '/index.html') {
              window.location.href = 'index.html';
          }
      } else {
          currentUser = user;
          const usernameElement = document.getElementById('username');
          if (usernameElement) {
              usernameElement.textContent = `Hi, ${user.displayName || user.email.split('@')[0]}`;
          }
          initTodoSystem();
      }
  });
}

function initDOMElements() {
    setupEditModal();
    setupDragAndDrop();
}

function initEventListeners() {
    const addBtn = document.getElementById('addBtn');
    const todoInput = document.getElementById('todoInput');
    const sortSelect = document.getElementById('sortSelect');
    const logoutBtn = document.getElementById('logout-btn');

    if (addBtn) {
        addBtn.addEventListener('click', addTodo);
    }

    if (todoInput) {
        todoInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') addTodo();
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', () => renderTodos());
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => auth.signOut());
    }
}

/* ==================================================
                SISTEM TODO DENGAN FIREBASE
   ================================================== */
function initTodoSystem() {
    const todosRef = db.collection('users').doc(currentUser.uid).collection('todos');
    
    todosRef.orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        todos = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        renderTodos();
    });
}

async function addTodo() {
    const text = document.getElementById('todoInput').value.trim();
    const deadline = document.getElementById('todoDate').value;
    
    if (!text) {
        alert('Silahkan isi nama task!');
        return;
    }
    
    if (deadline && !validateDate(deadline)) {
        alert('Deadline tidak boleh di masa lalu!');
        return;
    }

    try {
        await db.collection('users').doc(currentUser.uid).collection('todos').add({
            text,
            deadline: deadline || null,
            completed: false,
            category: 'general',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        document.getElementById('todoInput').value = '';
        document.getElementById('todoDate').value = '';
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function toggleComplete(index) {
    const todo = todos[index];
    try {
        await db.collection('users').doc(currentUser.uid).collection('todos')
            .doc(todo.id)
            .update({
                completed: !todo.completed
            });
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function deleteTodo(index) {
    if (!confirm('Apakah anda yakin ingin menghapus task ini?')) return;
    
    const todo = todos[index];
    try {
        await db.collection('users').doc(currentUser.uid).collection('todos')
            .doc(todo.id)
            .delete();
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

/* ==================================================
                FUNGSI TAMPILAN
   ================================================== */
function renderTodos() {
    const pendingList = document.getElementById('pendingList');
    const completedList = document.getElementById('completedList');
    
    pendingList.innerHTML = '';
    completedList.innerHTML = '';

    getSortedTodos().forEach((todo, index) => {
        const todoElement = createTodoElement(todo, index);
        todo.completed ? completedList.appendChild(todoElement) : pendingList.appendChild(todoElement);
        checkDeadlineNotifications(todo);
    });
}

function createTodoElement(todo, index) {
    const todoElement = document.createElement('div');
    todoElement.className = `todo-item ${todo.completed ? 'completed' : ''}`;
    todoElement.draggable = true;
    todoElement.dataset.index = index;

    const deadlineDate = todo.deadline ? new Date(todo.deadline) : null;
    const deadlineText = deadlineDate ? 
        `<span class="deadline ${checkOverdue(deadlineDate) ? 'overdue' : ''}">
            📅 ${formatDate(deadlineDate)}
        </span>` : 
        '<span class="deadline">Tanpa deadline</span>';

    const category = categories[todo.category || 'general'];
    
    todoElement.innerHTML = `
        <div class="todo-content">
            <span class="category-tag" style="background:${category.color}">${category.name}</span>
            <span>${todo.text}</span>
            ${deadlineText}
        </div>
        <div class="actions">
            <button class="editBtn">✏️</button>
            <button class="completeBtn">${todo.completed ? 'Batalkan' : 'Selesai'}</button>
            <button class="deleteBtn">🗑️</button>
        </div>
    `;

    todoElement.querySelector('.completeBtn').addEventListener('click', () => toggleComplete(index));
    todoElement.querySelector('.deleteBtn').addEventListener('click', () => deleteTodo(index));
    todoElement.querySelector('.editBtn').addEventListener('click', () => openEditModal(index));

    return todoElement;
}

/* ==================================================
                FUNGSI UTILITAS
   ================================================== */
function formatDate(date) {
    const options = { 
        day: 'numeric', 
        month: 'short', 
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined 
    };
    return date.toLocaleDateString('id-ID', options);
}

function checkOverdue(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
}

function validateDate(dateString) {
    const selectedDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selectedDate >= today;
}

function getSortedTodos() {
    const sortBy = document.getElementById('sortSelect').value;
    return [...todos].sort((a, b) => {
        switch(sortBy) {
            case 'deadline':
                const aDeadline = a.deadline || '9999-12-31';
                const bDeadline = b.deadline || '9999-12-31';
                return aDeadline.localeCompare(bDeadline);
            
            case 'no-deadline':
                const aHasDeadline = a.deadline ? 1 : 0;
                const bHasDeadline = b.deadline ? 1 : 0;
                return bHasDeadline - aHasDeadline;
            
            default:
                return 0;
        }
    });
}

function checkDeadlineNotifications(todo) {
    if (!todo.deadline || todo.completed) return;

    const deadline = new Date(todo.deadline);
    const today = new Date();
    const timeDiff = deadline - today;
    const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    if (daysLeft === 0) {
        showNotification(`⏰ Deadline hari ini: "${todo.text}"!`);
    } else if (daysLeft === 1) {
        showNotification(`⏳ 1 hari tersisa untuk "${todo.text}"!`);
    } else if (daysLeft < 0) {
        showNotification(`🚨 Deadline "${todo.text}" sudah lewat!`);
    }
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

/* ==================================================
                DRAG & DROP FUNCTIONS
   ================================================== */
function setupDragAndDrop() {
    const containers = document.querySelectorAll('.task-column');

    containers.forEach(container => {
        container.addEventListener('dragover', e => {
            e.preventDefault();
            const afterElement = getDragAfterElement(container, e.clientY);
            const draggable = document.querySelector('.dragging');
            
            if (draggable) {
                if (afterElement) {
                    container.insertBefore(draggable, afterElement);
                } else {
                    container.appendChild(draggable);
                }
            }
        });
    });

    document.querySelectorAll('.todo-item').forEach(item => {
        item.addEventListener('dragstart', () => {
            item.classList.add('dragging');
            dragStartIndex = parseInt(item.dataset.index);
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            const newIndex = parseInt(item.dataset.index);
            if (dragStartIndex !== newIndex) {
                const [removed] = todos.splice(dragStartIndex, 1);
                todos.splice(newIndex, 0, removed);
                saveTodos();
                renderTodos();
            }
            dragStartIndex = null;
        });
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.todo-item:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/* ==================================================
                EDIT MODAL FUNCTIONS
   ================================================== */
function setupEditModal() {
    const modal = document.getElementById('editModal');
    const closeBtns = document.querySelectorAll('.close-btn, .cancel-btn');
    const saveBtn = document.getElementById('saveEdit');

    window.openEditModal = (index) => {
        currentEditIndex = index;
        const todo = todos[index];
        document.getElementById('editText').value = todo.text;
        document.getElementById('editDate').value = todo.deadline || '';
        document.getElementById('editCategory').value = todo.category || 'general';
        modal.style.display = 'block';
    };

    const closeModal = () => {
        modal.style.display = 'none';
        currentEditIndex = null;
    };

    closeBtns.forEach(btn => btn.addEventListener('click', closeModal));
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    saveBtn.addEventListener('click', async () => {
        if (currentEditIndex === null) return;

        const newText = document.getElementById('editText').value.trim();
        const newDeadline = document.getElementById('editDate').value;
        const category = document.getElementById('editCategory').value;

        if (!newText) {
            alert('Nama tugas tidak boleh kosong!');
            return;
        }

        if (newDeadline && !validateDate(newDeadline)) {
            alert('Deadline tidak boleh di masa lalu!');
            return;
        }

        try {
            await db.collection('users').doc(currentUser.uid).collection('todos')
                .doc(todos[currentEditIndex].id)
                .update({
                    text: newText,
                    deadline: newDeadline || null,
                    category: category
                });
            
            closeModal();
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    });
}
