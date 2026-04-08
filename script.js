// ==========================================
// VAGABOND SCANS - FIREBASE & LOGIC CORE
// ==========================================


const firebaseConfig = {
    apiKey: "AIzaSyDTpShDJCjOoTRt1rEPrOEvzQNr2e2nvYM",
    authDomain: "vagabond-scans-1be72.firebaseapp.com",
    projectId: "vagabond-scans-1be72",
    storageBucket: "vagabond-scans-1be72.firebasestorage.app",
    messagingSenderId: "750319869714",
    appId: "1:750319869714:web:19984837fe96da5534ddcb",
    measurementId: "G-HEP7FY1SQH"
  };

// Initialize Firebase (wrapped in try/catch so site works cleanly before setup)
let db, auth;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    console.log("Firebase initialized successfully.");
} catch (e) {
    console.warn("Firebase is not configured yet. The site will run in Mock Mode.");
}

// ==========================================
// MOCK DATA (Fallback)
// ==========================================
const MOCK_RELEASES = [
    {
        id: "meguru-23",
        seriesId: "meguru",
        title: "Meguru Mirai",
        chapter: "23",
        coverUrl: "https://images.unsplash.com/photo-1541562232579-512a21360020?q=80&w=600&auto=format&fit=crop",
        badge: "NEW", // Optional badging
        uploadTime: Date.now() - 3600000 
    },
    {
        id: "vagabond-327",
        seriesId: "vagabond",
        title: "Vagabond (Remastered Edition)",
        chapter: "327",
        coverUrl: "https://images.unsplash.com/photo-1613376023733-f529810b10be?q=80&w=600&auto=format&fit=crop",
        badge: "HOT",
        uploadTime: Date.now() - 86400000
    },
    {
        id: "ronin-01",
        seriesId: "ronin",
        title: "Blade of the Ronin",
        chapter: "1",
        coverUrl: "https://images.unsplash.com/photo-1554181951-dc457db235fc?q=80&w=600&auto=format&fit=crop",
        badge: "",
        uploadTime: Date.now() - 172800000
    }
];

// ==========================================
// UI HANDLING (Global)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    
    // Mobile Navbar Toggles
    const mobileBtn = document.querySelector('.mobile-menu-btn');
    const mobileDropdown = document.querySelector('.mobile-dropdown');

    if (mobileBtn && mobileDropdown) {
        mobileBtn.addEventListener('click', () => {
            mobileDropdown.classList.toggle('active');
            const icon = mobileBtn.querySelector('i');
            icon.classList.toggle('fa-bars');
            icon.classList.toggle('fa-xmark');
        });
    }

    // ==========================================
    // INDEX.HTML - RENDER HOME PAGE 
    // ==========================================
    const mangaGridContainer = document.getElementById('manga-grid-container');
    
    if (mangaGridContainer) {
        const renderCards = (releases) => {
            mangaGridContainer.innerHTML = '';
            
            if(releases.length === 0) {
                mangaGridContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No releases found.</p>';
                return;
            }

            releases.forEach(release => {
                const badgeHtml = release.badge ? `<div class="badge-overlay ${release.badge.toLowerCase() === 'hot' ? 'hot' : ''}">${release.badge}</div>` : '';
                
                // Note: Staff credits are explicitly omitted per user request for a cleaner look.
                const cardHtml = `
                    <article class="manga-card" onclick="window.location.href='reader.html?manga=${release.seriesId}&chap=${release.chapter}'">
                        <div class="cover-wrapper">
                            ${badgeHtml}
                            <div class="cover-placeholder">
                                <img src="${release.coverUrl}" alt="${release.title}" loading="lazy" />
                            </div>
                            <div class="cover-gradient-overlay"></div>
                            <div class="manga-info">
                                <h3 class="manga-title">${release.title}</h3>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span class="chapter-pill">Ch. ${release.chapter}</span>
                                    <span style="font-size:0.8rem; color:var(--text-secondary);">${calculateTimeAgo(release.uploadTime)}</span>
                                </div>
                            </div>
                            <div class="hover-action">
                                <i class="fa-solid fa-play"></i> READ
                            </div>
                        </div>
                    </article>
                `;
                mangaGridContainer.innerHTML += cardHtml;
            });
        };

        // Try getting real data from Firebase, else fallback to Mock Data
        if(db) {
            db.collection("releases").orderBy("uploadTime", "desc").limit(15).get()
            .then(snapshot => {
                const releases = [];
                snapshot.forEach(doc => releases.push({id: doc.id, ...doc.data()}));
                renderCards(releases);
            }).catch(err => {
                console.error("Firestore Error:", err);
                renderCards(MOCK_RELEASES); // Fallback on error
            });
        } else {
            // Using Mock Data seamlessly
            setTimeout(() => renderCards(MOCK_RELEASES), 500);
        }
    }

    // ==========================================
    // ADMIN.HTML - FIREBASE AUTH & UPLOAD
    // ==========================================
    const loginSection = document.getElementById('loginSection');
    const dashboardSection = document.getElementById('dashboardSection');
    const loginForm = document.getElementById('loginForm');
    const logoutBtn = document.getElementById('logoutBtn');
    const uploadForm = document.getElementById('uploadForm');

    // Admin Auth State Observer
    if(auth) {
        auth.onAuthStateChanged(user => {
            if (user) {
                loginSection.style.display = 'none';
                dashboardSection.style.display = 'block';
                if(logoutBtn) logoutBtn.style.display = 'block';
            } else {
                loginSection.style.display = 'block';
                dashboardSection.style.display = 'none';
                if(logoutBtn) logoutBtn.style.display = 'none';
            }
        });

        if(loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                auth.signInWithEmailAndPassword(
                    document.getElementById('loginEmail').value,
                    document.getElementById('loginPassword').value
                ).catch(err => alert("Login Failed: " + err.message));
            });
        }

        if(logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault(); auth.signOut();
            });
        }
    } else {
        // MOCK AUTH for testing UI
        if(loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                loginSection.style.display = 'none';
                dashboardSection.style.display = 'block';
                if(logoutBtn) logoutBtn.style.display = 'block';
            });
        }
        if(logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                loginSection.style.display = 'block';
                dashboardSection.style.display = 'none';
                if(logoutBtn) logoutBtn.style.display = 'none';
            });
        }
    }

    // Handle File Dropzone Visuals
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    
    if(dropzone) {
        dropzone.addEventListener('click', () => fileInput.click());
        dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            fileInput.files = e.dataTransfer.files;
            dropzone.innerHTML = `<i class="fa-solid fa-file-circle-check" style="font-size: 2rem; color: var(--purple-light); margin-bottom: 10px;"></i><h3 style="color:white;">${fileInput.files.length} Pages Queued</h3>`;
        });
        fileInput.addEventListener('change', () => {
            dropzone.innerHTML = `<i class="fa-solid fa-file-circle-check" style="font-size: 2rem; color: var(--purple-light); margin-bottom: 10px;"></i><h3 style="color:white;">${fileInput.files.length} Pages Queued</h3>`;
        });
    }

    // Handle Upload Submission to Database
    if(uploadForm) {
        uploadForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const btn = document.getElementById('uploadBtn');
            const statusBox = document.getElementById('uploadStatus');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';
            statusBox.style.display = 'block';
            statusBox.innerText = "Processing arrays to Firestore...";

            // In Real Mode: You use firebase.storage() to upload images and save URLs to DB.
            if(db) {
                db.collection("releases").add({
                    seriesId: document.getElementById('mangaSelect').value,
                    title: document.getElementById('mangaSelect').options[document.getElementById('mangaSelect').selectedIndex].text,
                    chapter: document.getElementById('chapterNum').value,
                    badge: "NEW", 
                    coverUrl: "https://images.unsplash.com/photo-1613376023733-f529810b10be?q=80&w=600&auto=format&fit=crop", // Add custom cover upload later
                    uploadTime: Date.now()
                }).then(() => {
                    btn.innerHTML = '<i class="fa-solid fa-check"></i> Published';
                    statusBox.innerText = "Chapter has been successfully pushed.";
                    setTimeout(() => window.location.reload(), 2000);
                }).catch(err => {
                    alert("Upload error: " + err.message);
                    btn.innerHTML = '<i class="fa-solid fa-upload"></i> Publish to Database';
                });
            } else {
                setTimeout(() => {
                    btn.innerHTML = '<i class="fa-solid fa-check"></i> Published (Mock)';
                    statusBox.innerText = "[Mock Mode] Chapter added to mock state successfully.";
                    setTimeout(() => window.location.reload(), 1500);
                }, 1500);
            }
        });
    }

    // ==========================================
    // UTILITIES
    // ==========================================
    function calculateTimeAgo(timestamp) {
        const diffMs = Date.now() - timestamp;
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHrs / 24);
        
        if (diffHrs < 1) return "Just now";
        if (diffHrs < 24) return `${diffHrs} hrs ago`;
        if (diffDays === 1) return `Yesterday`;
        return `${diffDays} days ago`;
    }

});
