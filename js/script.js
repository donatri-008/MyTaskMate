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
    const todosRef = db.collection("users").doc(currentUser.uid).collection("todos");
    
    todosRef.orderBy("createdAt", "desc").onSnapshot(
        (snapshot) => {
            console.log("Data diterima dari Firestore:", snapshot.docs); // Debugging
            todos = snapshot.docs.map((doc) => ({
                id: doc.id,
                text: doc.data().text,
                completed: doc.data().completed || false,
                deadline: doc.data().deadline ? new Date(doc.data().deadline) : null,
                createdAt: doc.data().createdAt ? new Date(doc.data().createdAt.seconds * 1000) : new Date(),
            }));
            renderTodos();
        },
        (error) => {
            console.error("Error Firestore:", error); // Debugging error
            alert("Gagal memuat tugas!");
        }
    );


    // Event listener untuk tombol Add Task
    document.getElementById('addBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        await addTodo();
    });

    // Event listener untuk keyboard Enter
    document.getElementById('todoInput').addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            await addTodo();
        }
    });
}

// Fungsi addTodo yang diperbaiki
async function addTodo() {
    const textInput = document.getElementById('todoInput');
    const dateInput = document.getElementById('todoDate');
    
    const text = textInput.value.trim();
    const deadline = dateInput.value;

    if (!text) {
        alert('Silahkan isi nama task!');
        textInput.focus();
        return;
    }

    if (deadline && !validateDate(deadline)) {
        alert('Deadline tidak boleh di masa lalu!');
        dateInput.focus();
        return;
    }

    try {
        await db.collection('users').doc(currentUser.uid).collection('todos').add({
            text: text,
            deadline: deadline || null,
            completed: false,
            category: 'general',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Reset form
        textInput.value = '';
        dateInput.value = '';
        textInput.focus();
        
        console.log("Task berhasil ditambahkan");
    } catch (error) {
        console.error("Error menambahkan task:", error);
        alert(`Gagal menambahkan task: ${error.message}`);
    }
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
function createTodoElement(todo, index) {
    const todoElement = document.createElement('div');
    todoElement.className = `todo-item ${todo.completed ? 'completed' : ''}`;
    todoElement.dataset.id = todo.id; // Gunakan ID Firestore
    
    // Konversi tanggal ke lokal Indonesia
    const deadlineDate = todo.deadline ? 
        new Date(todo.deadline).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }) : null;

    const deadlineText = deadlineDate ? 
        `<span class="deadline ${checkOverdue(todo.deadline) ? 'overdue' : ''}">
            📅 ${deadlineDate}
        </span>` : 
        '<span class="deadline">Tanpa deadline</span>';

    const category = categories[todo.category || 'general'];
    
    todoElement.innerHTML = `
        <div class="todo-content">
            <span class="category-tag" style="background:${category.color}">
                ${category.name}
            </span>
            <span class="todo-text">${todo.text}</span>
            ${deadlineText}
        </div>
        <div class="actions">
            <button class="editBtn">✏️</button>
            <button class="completeBtn">${todo.completed ? '❌' : '✅'}</button>
            <button class="deleteBtn">🗑️</button>
        </div>
    `;

    // Event listener yang diperbaiki
    todoElement.querySelector('.editBtn').addEventListener('click', () => {
        openEditModal(todo.id);
    });
  
    todoElement.querySelector('.completeBtn').addEventListener('click', async () => {
        await toggleComplete(todo.id);
    });
    
    todoElement.querySelector('.deleteBtn').addEventListener('click', async () => {
        await deleteTodo(todo.id);
    });

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
    if (!dateString) return true;
    const selectedDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
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
                EDIT MODAL FUNCTIONS (FIXED)
   ================================================== */
function setupEditModal() {
    const modal = document.getElementById('editModal');
    const closeBtns = document.querySelectorAll('.close-btn, .cancel-btn');
    const saveBtn = document.getElementById('saveEdit');
    let currentEditId = null;

    // 1. Fix CSS Classes
    modal.classList.add('hidden'); // Initialize modal as hidden

    // 2. Enhanced openModal function
    window.openEditModal = async (todoId) => {
        try {
            console.log("Opening edit modal for:", todoId);
            currentEditId = todoId;
            
            const todoDoc = await db.collection('users').doc(currentUser.uid)
                .collection('todos').doc(todoId).get();

            if (!todoDoc.exists) {
                alert('Tugas tidak ditemukan!');
                return;
            }

            const todo = todoDoc.data();
            
            // 3. Convert Firestore Timestamp to Date input
            const deadlineDate = todo.deadline ? 
                new Date(todo.deadline.toDate()).toISOString().split('T')[0] : '';
            
            document.getElementById('editText').value = todo.text;
            document.getElementById('editDate').value = deadlineDate;
            document.getElementById('editCategory').value = todo.category || 'general';
            
            // 4. Toggle modal visibility
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
        } catch (error) {
            console.error("Error opening modal:", error);
            alert(`Error: ${error.message}`);
        }
    };

    // 5. Enhanced close function
    const closeModal = () => {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        currentEditId = null;
    };

    // 6. Save handler with proper date conversion
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
            // 7. Convert to Firestore Timestamp
            const deadlineTimestamp = newDeadline ? 
                firebase.firestore.Timestamp.fromDate(new Date(newDeadline)) : null;
            
            await db.collection('users').doc(currentUser.uid)
                .collection('todos')
                .doc(currentEditId)
                .update({
                    text: newText,
                    deadline: deadlineTimestamp,
                    category: category,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

            closeModal();
            // 8. Force refresh data
            initTodoSystem(); 
        } catch (error) {
            console.error('Update error:', error);
            alert(`Gagal update: ${error.message}`);
        }
    });

    // Event listeners
    closeBtns.forEach(btn => btn.addEventListener('click', closeModal));
    window.addEventListener('click', (e) => e.target === modal && closeModal());
}
