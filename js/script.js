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

const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

/* ==================================================
                VARIABEL GLOBAL
   ================================================== */
let currentUser = null;
let todos = [];
const categories = {
    general: { name: 'Umum', color: '#a8d8ea' },
    work: { name: 'Pekerjaan', color: '#aa96da' },
    personal: { name: 'Pribadi', color: '#fcbad3' },
    study: { name: 'Belajar', color: '#9ec0e3' }
};

const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');

/* ==================================================
                AUTHENTIKASI
   ================================================== */
auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    
    if (user) {
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            const userData = userDoc.data();
            
            authContainer.classList.add('hidden');
            appContainer.classList.remove('hidden');
            document.getElementById('username').textContent = `Hi, ${userData?.username || user.email.split('@')[0]}`;
            
            initTodoSystem();
        } catch (error) {
            console.error("Error loading user data:", error);
            showNotification('🔥 Gagal memuat data pengguna!', 'error');
        }
    } else {
        authContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
    }
});

/* ==================================================
                EVENT LISTENERS
   ================================================== */
document.addEventListener('DOMContentLoaded', () => {
    // Switch Auth Pages
    document.getElementById('show-register')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-page').classList.remove('active');
        document.getElementById('register-page').classList.add('active');
    });

    document.getElementById('show-login')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('register-page').classList.remove('active');
        document.getElementById('login-page').classList.add('active');
    });

    // Login Form
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        try {
            await auth.signInWithEmailAndPassword(email, password);
        } catch (error) {
            showNotification(error.message, 'error');
        }
    });

    // Register Form
    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
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
            showNotification(error.message, 'error');
        }
    });

    // Google Login
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
            showNotification(error.message, 'error');
        }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        if (confirm('Yakin ingin logout?')) {
            auth.signOut();
        }
    });
});

/* ==================================================
                SISTEM TODO
   ================================================== */
function initTodoSystem() {
    console.log("Inisialisasi sistem todo");
    const todosRef = db.collection("users").doc(currentUser.uid).collection("todos");
    
    // Real-time listener dengan error handling
    todosRef.orderBy("createdAt", "desc").onSnapshot(
        (snapshot) => {
            console.log("Menerima snapshot dari Firestore");
            try {
                todos = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        text: data.text || 'Tanpa judul',
                        completed: Boolean(data.completed),
                        deadline: data.deadline?.toDate?.() || null,
                        category: data.category || 'general',
                        createdAt: data.createdAt?.toDate?.() || new Date()
                    };
                });
                console.log("Data todo yang diterima:", todos);
                renderTodos();
                setupDragAndDrop();
            } catch (error) {
                console.error("Error processing snapshot:", error);
                showNotification('🔥 Gagal memproses data!', 'error');
            }
        },
        (error) => {
            console.error("Error Firestore:", error);
            showNotification('🔥 Gagal memuat tugas!', 'error');
        }
    );

    // Handler Tambah Todo
    const handleAddTodo = async (e) => {
        e.preventDefault();
        const text = document.getElementById('todoInput').value.trim();
        const deadline = document.getElementById('todoDate').value;

        if (!text) {
            showNotification('📝 Silahkan isi nama task!', 'error');
            return;
        }

        try {
            const newTodo = {
                text,
                completed: false,
                category: 'general',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (deadline) {
                const deadlineDate = new Date(deadline);
                if (isNaN(deadlineDate)) throw new Error("Format tanggal salah");
                newTodo.deadline = firebase.firestore.Timestamp.fromDate(deadlineDate);
            }

            await todosRef.add(newTodo);
            document.getElementById('todoInput').value = '';
            document.getElementById('todoDate').value = '';
            showNotification('✅ Task berhasil ditambahkan!', 'success');
        } catch (error) {
            console.error("Error adding todo:", error);
            showNotification('❌ Gagal menambahkan task!', 'error');
        }
    };

    document.getElementById('addBtn').addEventListener('click', handleAddTodo);
    document.getElementById('todoInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAddTodo(e);
    });

    setupEditModal();
}

/* ==================================================
                RENDER TODO
   ================================================== */
function renderTodos() {
    console.log("Memulai render todos");
    const pendingList = document.getElementById("pendingList");
    const completedList = document.getElementById("completedList");
    
    if (!pendingList || !completedList) {
        console.error("Element DOM tidak ditemukan!");
        return;
    }

    // Clear list dengan aman
    pendingList.innerHTML = '';
    completedList.innerHTML = '';

    // Filter dan hitung task
    const pendingTodos = todos.filter(todo => !todo.completed);
    const completedTodos = todos.filter(todo => todo.completed);
    console.log(`Pending: ${pendingTodos.length}, Completed: ${completedTodos.length}`);

    // Render pending tasks
    pendingTodos.forEach(todo => {
        try {
            const todoElement = createTodoElement(todo);
            pendingList.appendChild(todoElement);
        } catch (error) {
            console.error("Gagal membuat element todo:", error);
        }
    });

    // Render completed tasks
    completedTodos.forEach(todo => {
        try {
            const todoElement = createTodoElement(todo);
            completedList.appendChild(todoElement);
        } catch (error) {
            console.error("Gagal membuat element todo:", error);
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

function createTodoElement(todo) {
    const todoElement = document.createElement('div');
    todoElement.className = `todo-item ${todo.completed ? 'completed' : ''}`;
    todoElement.dataset.id = todo.id;
    todoElement.draggable = true;

    // Format tanggal deadline
    let deadlineText = '⏳ Tanpa deadline';
    if (todo.deadline instanceof Date) {
        const options = { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric' 
        };
        deadlineText = `📅 ${todo.deadline.toLocaleDateString('id-ID', options)}`;
        
        if (todo.deadline < new Date()) {
            deadlineText += ' (Terlambat)';
        }
    }

    // Styling kategori
    const category = categories[todo.category] || categories.general;
    const categoryStyle = `style="background:${category.color}; 
        color: ${category.color === '#fcbad3' ? '#000' : '#fff'}"`;

    todoElement.innerHTML = `
        <div class="todo-content">
            <span class="category-tag" ${categoryStyle}>${category.name}</span>
            <span class="todo-text">${todo.text}</span>
            <span class="deadline">${deadlineText}</span>
        </div>
        <div class="actions">
            <button class="editBtn" title="Edit">✏️</button>
            <button class="completeBtn" title="${todo.completed ? 'Batal selesai' : 'Selesai'}">
                ${todo.completed ? '↩️' : '✅'}
            </button>
            <button class="deleteBtn" title="Hapus">🗑️</button>
        </div>
    `;

    // Event Listeners
    todoElement.querySelector('.editBtn').addEventListener('click', () => openEditModal(todo.id));
    todoElement.querySelector('.completeBtn').addEventListener('click', () => toggleComplete(todo.id));
    todoElement.querySelector('.deleteBtn').addEventListener('click', () => deleteTodo(todo.id));

    return todoElement;
}

/* ==================================================
                CRUD OPERATIONS
   ================================================== */
async function toggleComplete(todoId) {
    try {
        const todoRef = db.collection('users').doc(currentUser.uid)
            .collection('todos').doc(todoId);
        const todoDoc = await todoRef.get();
        
        await todoRef.update({
            completed: !todoDoc.data().completed,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error("Error toggling complete:", error);
        showNotification('❌ Gagal mengubah status!', 'error');
    }
}

async function deleteTodo(todoId) {
    if (confirm('Apakah anda yakin ingin menghapus task ini?')) {
        try {
            await db.collection('users').doc(currentUser.uid)
                .collection('todos').doc(todoId).delete();
            showNotification('🗑️ Task dihapus!', 'success');
        } catch (error) {
            console.error("Error deleting todo:", error);
            showNotification('❌ Gagal menghapus task!', 'error');
        }
    }
}

/* ==================================================
                EDIT MODAL
   ================================================== */
function setupEditModal() {
    const modal = document.getElementById('editModal');
    const saveBtn = document.getElementById('saveEdit');
    const closeBtns = document.querySelectorAll('.close-btn');
    let currentEditId = null;

    window.openEditModal = async (todoId) => {
        try {
            currentEditId = todoId;
            const todoDoc = await db.collection('users').doc(currentUser.uid)
                .collection('todos').doc(todoId).get();

            if (!todoDoc.exists) {
                showNotification('📄 Task tidak ditemukan!', 'error');
                return;
            }

            const todoData = todoDoc.data();
            const deadlineDate = todoData.deadline?.toDate();
            
            document.getElementById('editText').value = todoData.text || '';
            document.getElementById('editDate').value = deadlineDate?.toISOString().split('T')[0] || '';
            document.getElementById('editCategory').value = todoData.category || 'general';

            modal.classList.add('visible');
            modal.classList.remove('hidden');
        } catch (error) {
            console.error("Error opening modal:", error);
            showNotification('❌ Gagal membuka editor!', 'error');
        }
    };

    saveBtn.addEventListener('click', async () => {
        if (!currentEditId) return;

        const newText = document.getElementById('editText').value.trim();
        const newDeadline = document.getElementById('editDate').value;
        const newCategory = document.getElementById('editCategory').value;

        if (!newText) {
            showNotification('📝 Nama task tidak boleh kosong!', 'error');
            return;
        }

        try {
            const updateData = {
                text: newText,
                category: newCategory,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (newDeadline) {
                const deadlineDate = new Date(newDeadline);
                if (isNaN(deadlineDate)) throw new Error("Format tanggal salah");
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
            showNotification('✅ Perubahan berhasil disimpan!', 'success');
        } catch (error) {
            console.error("Error saving edit:", error);
            showNotification('❌ Gagal menyimpan perubahan!', 'error');
        }
    });

    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modal.classList.remove('visible');
            modal.classList.add('hidden');
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('visible');
            modal.classList.add('hidden');
        }
    });
}

/* ==================================================
                DRAG & DROP
   ================================================== */
function setupDragAndDrop() {
    const containers = document.querySelectorAll('.task-column');

    containers.forEach(container => {
        container.addEventListener('dragover', e => {
            e.preventDefault();
            const afterElement = getDragAfterElement(container, e.clientY);
            const draggable = document.querySelector('.dragging');
            
            if (draggable) {
                container.insertBefore(draggable, afterElement || null);
            }
        });
    });

    document.querySelectorAll('.todo-item').forEach(item => {
        item.addEventListener('dragstart', () => {
            item.classList.add('dragging');
        });

        item.addEventListener('dragend', async () => {
            item.classList.remove('dragging');
            const newStatus = item.parentElement.id === 'completedList';
            
            try {
                await db.collection('users').doc(currentUser.uid)
                    .collection('todos')
                    .doc(item.dataset.id)
                    .update({
                        completed: newStatus,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
            } catch (error) {
                console.error("Error updating drag & drop:", error);
                showNotification('❌ Gagal memperbarui status!', 'error');
                renderTodos();
            }
        });
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.todo-item:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        return offset < 0 && offset > closest.offset 
            ? { offset: offset, element: child } 
            : closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/* ==================================================
                UTILITIES
   ================================================== */
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

function validateDate(dateString) {
    if (!dateString) return true;
    const selectedDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);
    return selectedDate >= today;
}

/* ==================================================
                INITIALIZATION
   ================================================== */
document.addEventListener('DOMContentLoaded', () => {
    // Validasi date input
    const dateInput = document.getElementById('todoDate');
    if (dateInput) {
        dateInput.addEventListener('change', function() {
            if (!validateDate(this.value)) {
                showNotification('⚠️ Deadline tidak boleh di masa lalu!', 'error');
                this.value = '';
            }
        });
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(() => console.log('Service Worker terdaftar'))
            .catch(err => console.error('Gagal mendaftar Service Worker:', err));
    }
});
