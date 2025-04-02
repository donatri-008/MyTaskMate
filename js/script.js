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
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

/* ==================================================
                VARIABEL GLOBAL
   ================================================== */
let currentUser = null;
let todos = [];
let currentEditIndex = null;
let dragStartIndex = null;

const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const categories = {
    general: { name: 'Umum', color: '#a8d8ea' },
    work: { name: 'Pekerjaan', color: '#aa96da' },
    personal: { name: 'Pribadi', color: '#fcbad3' },
    study: { name: 'Belajar', color: '#9ec0e3' }
};

// Auth State Listener
auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    
    if (user) {
        // Load user data
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userData = userDoc.data();
        
        // Update UI
        authContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        document.getElementById('username').textContent = `Hi, ${userData?.username || user.email.split('@')[0]}`;
        
        // Initialize Todo System
        initTodoSystem();
    } else {
        authContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
    }
});

// Auth Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Pastikan ID benar
    const showRegister = document.getElementById('show-register');
    const showLogin = document.getElementById('show-login');
    const loginPage = document.getElementById('login-page');
    const registerPage = document.getElementById('register-page');

    // Debugging
    console.log('Elements:', {showRegister, showLogin, loginPage, registerPage});

    showRegister?.addEventListener('click', function(e) {
        e.preventDefault();
        loginPage.classList.remove('active');
        registerPage.classList.add('active');
    });

    showLogin?.addEventListener('click', function(e) {
        e.preventDefault();
        registerPage.classList.remove('active');
        loginPage.classList.add('active');
    });
});

// Form handlers (PASTIKAN ID REGISTER FORM BENAR)
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        alert(error.message);
    }
});

document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    // PASTIKAN ID BENAR!
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value; 
    const password = document.getElementById('register-password').value; 

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection('users').doc(userCredential.user.uid).set({
            username,
            email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        alert(error.message);
    }
});

document.getElementById('google-login').addEventListener('click', async () => {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        
        if (result.additionalUserInfo.isNewUser) {
            await db.collection('users').doc(result.user.uid).set({
                username: result.user.displayName || result.user.email.split('@')[0],
                email: result.user.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    } catch (error) {
        alert(error.message);
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    auth.signOut();
});


/* ==================================================
                SISTEM TODO DENGAN FIREBASE
   ================================================== */
function initTodoSystem() {
    // Inisialisasi referensi Firestore
    const todosRef = db.collection("users").doc(currentUser.uid).collection("todos");
    
    // Setup real-time listener untuk todos
    const unsubscribe = todosRef
        .orderBy("createdAt", "desc")
        .onSnapshot(
            (snapshot) => {
                todos = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    text: doc.data().text,
                    completed: doc.data().completed || false,
                    deadline: doc.data().deadline?.toDate() || null,
                    category: doc.data().category || 'general',
                    createdAt: doc.data().createdAt?.toDate() || new Date(),
                }));
                renderTodos();
                setupEditModal(); // Inisialisasi modal edit
            },
            (error) => {
                console.error("Error fetching todos:", error);
                showNotification('⚠️ Gagal memuat tugas!', 'error');
            }
        );

    // Event listeners untuk input baru
    const addBtn = document.getElementById('addBtn');
    const todoInput = document.getElementById('todoInput');
    
    const handleAddTodo = async (e) => {
        e.preventDefault();
        const text = todoInput.value.trim();
        const deadline = document.getElementById('todoDate').value;

        if (!text) {
            showNotification('📝 Silahkan isi nama task!', 'error');
            todoInput.focus();
            return;
        }

        try {
            const newTodo = {
                text: text,
                completed: false,
                category: 'general',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (deadline) {
                const deadlineDate = new Date(deadline);
                newTodo.deadline = firebase.firestore.Timestamp.fromDate(deadlineDate);
            }

            await todosRef.add(newTodo);
            todoInput.value = '';
            document.getElementById('todoDate').value = '';
            showNotification('✅ Task berhasil ditambahkan!', 'success');
        } catch (error) {
            console.error("Error adding todo:", error);
            showNotification('❌ Gagal menambahkan task!', 'error');
        }
    };

    addBtn.addEventListener('click', handleAddTodo);
    todoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAddTodo(e);
    });
}

/* ==================================================
                FUNGSI TAMPILAN
   ================================================== */
function renderTodos() {
    const pendingList = document.getElementById("pendingList");
    const completedList = document.getElementById("completedList");
    
    pendingList.innerHTML = "";
    completedList.innerHTML = "";

    // Debugging: Pastikan todos ada
    console.log("Daftar Tugas:", todos);

    todos.forEach((todo) => {
        const todoElement = createTodoElement(todo);
        if (todo.completed) {
            completedList.appendChild(todoElement);
        } else {
            pendingList.appendChild(todoElement);
        }
    });

    // Tambahkan placeholder jika kosong
    if (pendingList.children.length === 0) {
        pendingList.innerHTML = '<div class="empty-state">🎉 Tidak ada tugas!</div>';
    }
    if (completedList.children.length === 0) {
        completedList.innerHTML = '<div class="empty-state">📭 Belum ada yang selesai</div>';
    }
}

// Fungsi pembuat elemen todo yang diperbaiki
function createTodoElement(todo) {
    const todoElement = document.createElement('div');
    todoElement.className = `todo-item ${todo.completed ? 'completed' : ''}`;
    todoElement.dataset.id = todo.id;
    todoElement.draggable = true;

    // Format tanggal deadline
    const deadlineDate = todo.deadline?.toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });

    // Styling kategori
    const category = categories[todo.category || 'general'];
    const categoryStyle = `style="background:${category.color}; color: ${category.color === '#fcbad3' ? '#000' : '#fff'}"`;

    // Template HTML
    todoElement.innerHTML = `
        <div class="todo-content">
            <span class="category-tag" ${categoryStyle}>
                ${category.name}
            </span>
            <span class="todo-text">${todo.text}</span>
            ${todo.deadline ? `
                <span class="deadline ${todo.deadline < new Date() ? 'overdue' : ''}">
                    📅 ${deadlineDate}
                </span>
            ` : '<span class="deadline">⏳ Tanpa deadline</span>'}
        </div>
        <div class="actions">
            <button class="editBtn" title="Edit task">✏️</button>
            <button class="completeBtn" title="${todo.completed ? 'Tandai belum selesai' : 'Tandai selesai'}">
                ${todo.completed ? '↩️' : '✅'}
            </button>
            <button class="deleteBtn" title="Hapus task">🗑️</button>
        </div>
    `;

    // Event Listeners
    const editBtn = todoElement.querySelector('.editBtn');
    const completeBtn = todoElement.querySelector('.completeBtn');
    const deleteBtn = todoElement.querySelector('.deleteBtn');

    editBtn.addEventListener('click', () => openEditModal(todo.id));
    
    completeBtn.addEventListener('click', async () => {
        try {
            await db.collection('users').doc(currentUser.uid)
                .collection('todos')
                .doc(todo.id)
                .update({
                    completed: !todo.completed,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
        } catch (error) {
            showNotification('❌ Gagal mengubah status!', 'error');
        }
    });

    deleteBtn.addEventListener('click', async () => {
        if (confirm('Apakah anda yakin ingin menghapus task ini?')) {
            try {
                await db.collection('users').doc(currentUser.uid)
                    .collection('todos')
                    .doc(todo.id)
                    .delete();
                showNotification('🗑️ Task dihapus!', 'success');
            } catch (error) {
                showNotification('❌ Gagal menghapus task!', 'error');
            }
        }
    });

    return todoElement;
}

async function openEditModal(todoId) {
    const modal = document.getElementById('editModal');
    const editText = document.getElementById('editText');
    const editDate = document.getElementById('editDate');
    const editCategory = document.getElementById('editCategory');

    try {
        // Ambil data dari Firestore
        const todoDoc = await db.collection('users').doc(currentUser.uid)
            .collection('todos').doc(todoId).get();

        if (!todoDoc.exists) {
            showNotification('📄 Task tidak ditemukan!', 'error');
            return;
        }

        const todoData = todoDoc.data();
        
        // Format tanggal untuk input
        const deadlineDate = todoData.deadline?.toDate();
        const formattedDate = deadlineDate ? 
            deadlineDate.toISOString().split('T')[0] : 
            '';

        // Isi form
        editText.value = todoData.text;
        editDate.value = formattedDate;
        editCategory.value = todoData.category || 'general';

        // Tampilkan modal
        modal.classList.add('visible');
        modal.classList.remove('hidden');
        modal.currentEditId = todoId; // Simpan ID di properti modal

    } catch (error) {
        console.error("Error opening edit modal:", error);
        showNotification('❌ Gagal membuka editor!', 'error');
    }
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
    if (!dateString) return true;
    const selectedDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);
    return selectedDate >= today;
}

async function toggleComplete(todoId) {
    try {
        const todoRef = db.collection('users').doc(currentUser.uid)
                          .collection('todos').doc(todoId);
        const todoDoc = await todoRef.get();
        
        await todoRef.update({
            completed: !todoDoc.data().completed
        });
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
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
    
    const today = new Date();
    const timeDiff = todo.deadline - today;
    const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    if (daysLeft === 0) {
        showNotification(`⏰ Deadline hari ini: "${todo.text}"!`);
    } else if (daysLeft === 1) {
        showNotification(`⏳ 1 hari tersisa untuk "${todo.text}"!`);
    } else if (daysLeft < 0) {
        showNotification(`🚨 Deadline "${todo.text}" sudah lewat!`);
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
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
    let currentEditId = null; // Gunakan ID dokumen Firestore

    // Buka modal dengan mengambil data langsung dari Firestore
    window.openEditModal = async (todoId) => {
        try {
            const todoDoc = await db.collection('users').doc(currentUser.uid)
                .collection('todos').doc(todoId).get();
                
            const todo = todoDoc.data();
            document.getElementById('editText').value = todo.text;
            document.getElementById('editDate').value = todo.deadline?.toDate().toISOString().split('T')[0] || '';
            
            if (!todoDoc.exists) {
                alert("Dokumen tidak ditemukan!");
                return;
            }

            const todo = todoDoc.data();
            document.getElementById('editText').value = todo.text;
            document.getElementById('editDate').value = todo.deadline || '';
            document.getElementById('editCategory').value = todo.category || 'general';
            
            // Tampilkan modal dengan class CSS
            modal.classList.remove('hidden');
            modal.classList.add('visible');
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    };

    // Tutup modal
    const closeModal = () => {
        modal.classList.remove('visible');
        modal.classList.add('hidden');
        currentEditId = null;
    };

    // Event listeners
    closeBtns.forEach(btn => btn.addEventListener('click', closeModal));
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Handle save
  saveBtn.addEventListener('click', async () => {
      if (!currentEditId) return;
  
      const newText = document.getElementById('editText').value.trim();
      const newDeadline = document.getElementById('editDate').value;
      const category = document.getElementById('editCategory').value;
  
      if (!newText) {
          alert('Nama tugas tidak boleh kosong!');
          return;
      }
  
      try {
          const updateData = {
              text: newText,
              category: category,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          };
  
          // Handle deadline conversion
          if (newDeadline) {
              const deadlineDate = new Date(newDeadline);
              updateData.deadline = firebase.firestore.Timestamp.fromDate(deadlineDate);
          } else {
              updateData.deadline = null;
          }
  
          await db.collection('users').doc(currentUser.uid)
              .collection('todos')
              .doc(currentEditId)
              .update(updateData);
  
          modal.classList.remove('visible');
          modal.classList.add('hidden');
          currentEditId = null;
      } catch (error) {
          console.error('Error updating task:', error);
          alert(`Gagal menyimpan perubahan: ${error.message}`);
      }
  });
}
