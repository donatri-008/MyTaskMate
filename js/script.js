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
    general: { name: 'General', color: '#a8d8ea' },
    work: { name: 'Work', color: '#aa96da' },
    personal: { name: 'Personal', color: '#fcbad3' },
    study: { name: 'Study', color: '#9ec0e3' }
};

const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');

/* ==================================================
                AUTHENTIKASI (SWEETALERT2)
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
            Swal.fire({
                icon: 'error',
                title: 'Gagal Memuat Data!',
                text: 'Terjadi kesalahan saat memuat data pengguna',
                timer: 2000
            });
        }
    } else {
        authContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
    }
});

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
            Swal.fire({
                icon: 'error',
                title: 'Login Gagal!',
                text: error.message,
                timer: 2000
            });
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
            Swal.fire({
                icon: 'success',
                title: 'Registrasi Berhasil!',
                showConfirmButton: false,
                timer: 1500
            });
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Registrasi Gagal!',
                text: error.message,
                timer: 2000
            });
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
            Swal.fire({
                icon: 'error',
                title: 'Login Gagal!',
                text: error.message,
                timer: 2000
            });
        }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        Swal.fire({
            title: 'Yakin ingin logout?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Ya, Logout!'
        }).then((result) => {
            if (result.isConfirmed) {
                auth.signOut();
                Swal.fire({
                    icon: 'success',
                    title: 'Berhasil Logout!',
                    timer: 1000
                });
            }
        });
    });
});

/* ==================================================
                SISTEM TODO (SWEETALERT2)
   ================================================== */
function initTodoSystem() {
    const todosRef = db.collection("users").doc(currentUser.uid).collection("todos");
    
    // Real-time listener
    todosRef.orderBy("createdAt", "desc").onSnapshot(
        (snapshot) => {
            todos = snapshot.docs.map(doc => ({
                id: doc.id,
                text: doc.data().text || '[Tidak ada judul]',
                completed: Boolean(doc.data().completed),
                deadline: doc.data().deadline?.toDate?.() || null,
                category: doc.data().category || 'study',
                createdAt: doc.data().createdAt?.toDate?.() || new Date()
            }));
            renderTodos();
            setupDragAndDrop();
        },
        (error) => {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Memuat Data!',
                text: 'Terjadi kesalahan saat memuat tugas',
                timer: 2000
            });
        }
    );

    // Add Todo Handler
    const handleAddTodo = async (e) => {
        e.preventDefault();
        const text = document.getElementById('todoInput').value.trim();
        const deadline = document.getElementById('todoDate').value;

        if (!text) {
            Swal.fire({
                icon: 'error',
                title: 'Nama Task Kosong!',
                text: 'Silahkan isi nama task terlebih dahulu',
                timer: 2000,
                toast: true,
                position: 'top-end'
            });
            return;
        }

        try {
            const newTodo = {
                text,
                completed: false,
                category: 'study',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (deadline) {
                if (!validateDate(deadline)) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Deadline Tidak Valid!',
                        text: 'Pastikan deadline tidak di masa lalu',
                        timer: 2000
                    });
                    return;
                }
                newTodo.deadline = firebase.firestore.Timestamp.fromDate(new Date(deadline));
            }

            await todosRef.add(newTodo);
            document.getElementById('todoInput').value = '';
            document.getElementById('todoDate').value = '';
            Swal.fire({
                icon: 'success',
                title: 'Task Ditambahkan!',
                timer: 1000,
                toast: true,
                position: 'top-end'
            });
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Menambahkan!',
                text: 'Terjadi kesalahan saat menambahkan task',
                timer: 2000
            });
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
    const pendingList = document.getElementById("pendingList");
    const completedList = document.getElementById("completedList");
    
    pendingList.innerHTML = '';
    completedList.innerHTML = '';

    todos.forEach(todo => {
        try {
            const todoElement = createTodoElement(todo);
            if (todo.completed) {
                completedList.appendChild(todoElement);
            } else {
                pendingList.appendChild(todoElement);
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error!',
                text: 'Gagal menampilkan task',
                timer: 2000,
                toast: true,
                position: 'top-end'
            });
        }
    });

    if (!pendingList.children.length) {
        pendingList.innerHTML = '<div class="empty-state">🎉 Tidak ada tugas!</div>';
    }
    if (!completedList.children.length) {
        completedList.innerHTML = '<div class="empty-state">📭 Belum ada yang selesai</div>';
    }
}

function createTodoElement(todo) {
    const todoElement = document.createElement('div');
    todoElement.className = `todo-item ${todo.completed ? 'completed' : ''}`;
    todoElement.dataset.id = todo.id;
    todoElement.draggable = true;

    const deadlineDate = todo.deadline?.toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });

    const category = categories[todo.category] || categories.study;
    const categoryStyle = `style="background:${category.color}; 
        color: ${category.color === '#fcbad3' ? '#000' : '#fff'}"`;

    todoElement.innerHTML = `
        <div class="todo-content">
            <span class="category-tag" ${categoryStyle}>${category.name}</span>
            <span class="todo-text">${todo.text}</span>
            ${todo.deadline ? `
                <span class="deadline ${todo.deadline < new Date() ? 'overdue' : ''}">
                    📅 ${deadlineDate}
                </span>
            ` : '<span class="deadline">⏳ Tanpa deadline</span>'}
        </div>
        <div class="actions">
            <button class="editBtn" title="Edit">✏️</button>
            <button class="completeBtn" title="${todo.completed ? 'Batal selesai' : 'Selesai'}">
                ${todo.completed ? '↩️' : '✅'}
            </button>
            <button class="deleteBtn" title="Hapus">🗑️</button>
        </div>
    `;

    todoElement.querySelector('.editBtn').addEventListener('click', () => openEditModal(todo.id));
    todoElement.querySelector('.completeBtn').addEventListener('click', () => toggleComplete(todo.id));
    todoElement.querySelector('.deleteBtn').addEventListener('click', () => deleteTodo(todo.id));

    return todoElement;
}

/* ==================================================
                CRUD OPERATIONS (SWEETALERT2)
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
        Swal.fire({
            icon: 'success',
            title: 'Status Diperbarui!',
            timer: 1000,
            toast: true,
            position: 'top-end'
        });
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Gagal Memperbarui!',
            text: 'Terjadi kesalahan saat mengubah status',
            timer: 2000
        });
    }
}

async function deleteTodo(todoId) {
    const result = await Swal.fire({
        title: 'Hapus Task?',
        text: "Anda tidak bisa mengembalikan data yang terhapus!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Ya, Hapus!'
    });

    if (result.isConfirmed) {
        try {
            await db.collection('users').doc(currentUser.uid)
                .collection('todos').doc(todoId).delete();
            Swal.fire({
                icon: 'success',
                title: 'Terhapus!',
                timer: 1000,
                toast: true,
                position: 'top-end'
            });
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Menghapus!',
                text: 'Terjadi kesalahan saat menghapus task',
                timer: 2000
            });
        }
    }
}

/* ==================================================
                EDIT MODAL (SWEETALERT2)
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
                Swal.fire({
                    icon: 'error',
                    title: 'Task Tidak Ditemukan!',
                    text: 'Task yang ingin diedit tidak dapat ditemukan',
                    timer: 2000
                });
                return;
            }

            const todoData = todoDoc.data();
            const deadlineDate = todoData.deadline?.toDate();
            
            document.getElementById('editText').value = todoData.text || '';
            document.getElementById('editDate').value = deadlineDate?.toISOString().split('T')[0] || '';
            document.getElementById('editCategory').value = todoData.category || 'study';

            modal.classList.add('visible');
            modal.classList.remove('hidden');
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Membuka Editor!',
                text: 'Terjadi kesalahan saat membuka editor task',
                timer: 2000
            });
        }
    };

    saveBtn.addEventListener('click', async () => {
        if (!currentEditId) return;

        const newText = document.getElementById('editText').value.trim();
        const newDeadline = document.getElementById('editDate').value;
        const newCategory = document.getElementById('editCategory').value;

        if (!newText) {
            Swal.fire({
                icon: 'error',
                title: 'Nama Task Kosong!',
                text: 'Silahkan isi nama task terlebih dahulu',
                timer: 2000,
                toast: true,
                position: 'top-end'
            });
            return;
        }

        try {
            const updateData = {
                text: newText,
                category: newCategory,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (newDeadline) {
                if (!validateDate(newDeadline)) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Deadline Tidak Valid!',
                        text: 'Pastikan deadline tidak di masa lalu',
                        timer: 2000
                    });
                    return;
                }
                updateData.deadline = firebase.firestore.Timestamp.fromDate(new Date(newDeadline));
            }

            await db.collection('users').doc(currentUser.uid)
                .collection('todos')
                .doc(currentEditId)
                .update(updateData);

            modal.classList.remove('visible');
            modal.classList.add('hidden');
            Swal.fire({
                icon: 'success',
                title: 'Perubahan Tersimpan!',
                timer: 1000,
                toast: true,
                position: 'top-end'
            });
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Menyimpan!',
                text: 'Terjadi kesalahan saat menyimpan perubahan',
                timer: 2000
            });
        }
    });

    closeBtns.forEach(btn => btn.addEventListener('click', () => modal.classList.add('hidden')));
    window.addEventListener('click', (e) => e.target === modal && modal.classList.add('hidden'));
}

/* ==================================================
                DRAG & DROP (SWEETALERT2)
   ================================================== */
function setupDragAndDrop() {
    const containers = document.querySelectorAll('.task-column');

    containers.forEach(container => {
        container.addEventListener('dragover', e => {
            e.preventDefault();
            const afterElement = getDragAfterElement(container, e.clientY);
            const draggable = document.querySelector('.dragging');
            draggable && container.insertBefore(draggable, afterElement || null);
        });
    });

    document.querySelectorAll('.todo-item').forEach(item => {
        item.addEventListener('dragstart', () => item.classList.add('dragging'));
        item.addEventListener('dragend', async () => {
            item.classList.remove('dragging');
            try {
                await db.collection('users').doc(currentUser.uid)
                    .collection('todos')
                    .doc(item.dataset.id)
                    .update({
                        completed: item.parentElement.id === 'completedList',
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                Swal.fire({
                    icon: 'success',
                    title: 'Posisi Diperbarui!',
                    timer: 1000,
                    toast: true,
                    position: 'top-end'
                });
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Gagal Memperbarui!',
                    text: 'Terjadi kesalahan saat mengubah posisi task',
                    timer: 2000
                });
                renderTodos();
            }
        });
    });
}

function getDragAfterElement(container, y) {
    return [...container.querySelectorAll('.todo-item:not(.dragging)')].reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        return offset < 0 && offset > closest.offset ? { offset, element: child } : closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/* ==================================================
                UTILITIES
   ================================================== */
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
    document.getElementById('todoDate').addEventListener('change', function() {
        if (!validateDate(this.value)) {
            Swal.fire({
                icon: 'error',
                title: 'Deadline Invalid!',
                text: 'Tidak boleh menggunakan tanggal masa lalu',
                timer: 2000,
                toast: true,
                position: 'top-end'
            });
            this.value = '';
        }
    });
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(() => console.log('Service Worker terdaftar'))
            .catch(err => console.error('Gagal mendaftar Service Worker:', err));
    }
});
