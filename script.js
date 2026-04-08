// ==========================================
// VAGABOND SCANS V4 - FULL MANGADEX LOGIC BACKEND
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

// Initialize Firebase App
let db, auth, storage;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    storage = firebase.storage();
    console.log("Firebase App, Auth, Firestore, and Storage initialized successfully.");
} catch (e) {
    console.warn("Firebase initialization failed. Make sure your services are enabled.", e);
}

// ==========================================
// UI HANDLING (Global)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    // --- MOBILE MENU ---
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
    // INDEX.HTML - FETCH LATEST CHAPTERS
    // ==========================================
    const mangaGridContainer = document.getElementById('manga-grid-container');
    
    if (mangaGridContainer && db) {
        // Mangadex Logic: Fetch newest chapters, then visually link them to their Series Data
        db.collection("chapters").orderBy("uploadTime", "desc").limit(20).get()
        .then(async snapshot => {
            if (snapshot.empty) {
                mangaGridContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No chapters found in database.</p>';
                return;
            }
            
            mangaGridContainer.innerHTML = ''; // clear loading
            
            // For each chapter, we must get its parent Series document to load the cover!
            for (let doc of snapshot.docs) {
                const chapData = doc.data();
                const chapId = doc.id;
                
                // Fetch the series info
                const seriesDoc = await db.collection("series").doc(chapData.seriesId).get();
                if(seriesDoc.exists) {
                    const seriesData = seriesDoc.data();
                    
                    const cardHtml = `
                        <article class="manga-card" onclick="window.location.href='reader.html?chapId=${chapId}'">
                            <div class="cover-wrapper">
                                <div class="badge-overlay">NEW</div>
                                <div class="cover-placeholder">
                                    <img src="${seriesData.coverUrl}" alt="${seriesData.title}" loading="lazy" />
                                </div>
                                <div class="cover-gradient-overlay"></div>
                                <div class="manga-info">
                                    <h3 class="manga-title">${seriesData.title}</h3>
                                    <div style="display:flex; justify-content:space-between; align-items:center;">
                                        <span class="chapter-pill">Ch. ${chapData.chapterNum}</span>
                                        <span style="font-size:0.8rem; color:var(--text-secondary);">${calculateTimeAgo(chapData.uploadTime)}</span>
                                    </div>
                                </div>
                                <div class="hover-action">
                                    <i class="fa-solid fa-play"></i> READ
                                </div>
                            </div>
                        </article>
                    `;
                    mangaGridContainer.innerHTML += cardHtml;
                }
            }
        }).catch(err => {
            mangaGridContainer.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: red;">Database Error: ${err.message}</p>`;
        });
    }

    // ==========================================
    // ADMIN.HTML - FIREBASE AUTH & STORAGE MANGADEX SYSTEM
    // ==========================================
    const loginSection = document.getElementById('loginSection');
    const dashboardSection = document.getElementById('dashboardSection');
    const loginError = document.getElementById('loginError');
    if (auth && loginSection) {
        
        // --- 1. ADMIN AUTH STATE ---
        auth.onAuthStateChanged(user => {
            if (user) {
                loginSection.style.display = 'none';
                dashboardSection.style.display = 'block';
                document.getElementById('logoutBtn').style.display = 'block';
                loadSeriesIntoDropdown(); // Load manga dropdown when logged in
            } else {
                loginSection.style.display = 'block';
                dashboardSection.style.display = 'none';
                document.getElementById('logoutBtn').style.display = 'none';
            }
        });

        // Handle Login Submission
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            auth.signInWithEmailAndPassword(
                document.getElementById('loginEmail').value,
                document.getElementById('loginPassword').value
            ).catch(err => {
                loginError.innerText = "Login Failed: Check email/password.";
                loginError.style.display = 'block';
            });
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault(); auth.signOut();
        });

        // --- 2. ADMIN TABS UI ---
        const tabSeriesBtn = document.getElementById('tabSeriesBtn');
        const tabChapterBtn = document.getElementById('tabChapterBtn');
        const tabSeries = document.getElementById('tabSeries');
        const tabChapter = document.getElementById('tabChapter');

        if(tabSeriesBtn && tabChapterBtn) {
            tabSeriesBtn.addEventListener('click', () => {
                tabSeries.style.display = 'block';
                tabChapter.style.display = 'none';
                tabSeriesBtn.classList.remove('btn-transparent');
                tabChapterBtn.classList.add('btn-transparent');
            });
            tabChapterBtn.addEventListener('click', () => {
                tabSeries.style.display = 'none';
                tabChapter.style.display = 'block';
                tabChapterBtn.classList.remove('btn-transparent');
                tabSeriesBtn.classList.add('btn-transparent');
            });
        }

        // --- 3. CREATE NEW SERIES ---
        const seriesForm = document.getElementById('seriesForm');
        if (seriesForm) {
            seriesForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const btn = document.getElementById('seriesBtn');
                const status = document.getElementById('seriesStatus');
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...';
                
                db.collection("series").add({
                    title: document.getElementById('seriesTitle').value,
                    coverUrl: document.getElementById('seriesCoverUrl').value,
                    author: document.getElementById('seriesAuthor').value || "Unknown",
                    synopsis: document.getElementById('seriesSynopsis').value || "",
                    createdAt: Date.now()
                }).then(() => {
                    btn.innerHTML = '<i class="fa-solid fa-check"></i> Series Added';
                    status.innerText = "Series Created Successfully! You can now upload chapters to it.";
                    status.style.display = 'block';
                    seriesForm.reset();
                    loadSeriesIntoDropdown(); // Refresh dropdown
                    setTimeout(() => { 
                        btn.innerHTML = '<i class="fa-solid fa-plus"></i> Create Series';
                        status.style.display = 'none';
                    }, 3000);
                }).catch(err => {
                    alert("Error: " + err.message);
                    btn.innerHTML = '<i class="fa-solid fa-plus"></i> Create Series';
                });
            });
        }

        // --- 4. POPULATE SERIES DROPDOWN FOR UPLOADING ---
        function loadSeriesIntoDropdown() {
            const select = document.getElementById('mangaSelect');
            if(!select) return;
            
            db.collection("series").get().then(snapshot => {
                select.innerHTML = '<option value="">-- Choose Series --</option>';
                snapshot.forEach(doc => {
                    select.innerHTML += `<option value="${doc.id}">${doc.data().title}</option>`;
                });
            });
        }

        // --- 5. DRAG & DROP FILE LOGIC ---
        const dropzone = document.getElementById('dropzone');
        const fileInput = document.getElementById('fileInput');
        let selectedFiles = [];

        if(dropzone) {
            dropzone.addEventListener('click', () => fileInput.click());
            dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
            dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
            
            dropzone.addEventListener('drop', (e) => {
                e.preventDefault(); dropzone.classList.remove('dragover');
                handleFiles(e.dataTransfer.files);
            });
            fileInput.addEventListener('change', () => {
                handleFiles(fileInput.files);
            });

            function handleFiles(files) {
                selectedFiles = Array.from(files).sort((a,b) => a.name.localeCompare(b.name)); // Sort by filename (e.g. 01.jpg, 02.jpg)
                dropzone.innerHTML = `<i class="fa-solid fa-file-circle-check" style="font-size: 2rem; color: var(--purple-light); margin-bottom: 10px;"></i>
                                      <h3 style="color:white;">${selectedFiles.length} Pages Queued</h3>
                                      <p style="color:var(--text-secondary); font-size: 0.8rem;">Ready for upload.</p>`;
            }
        }

        // --- 6. UPLOAD CHAPTER LOGIC (UPLOAD TO STORAGE THEN DB) ---
        const uploadForm = document.getElementById('uploadForm');
        if(uploadForm) {
            uploadForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if(selectedFiles.length === 0) return alert("Please select image files first!");

                const btn = document.getElementById('uploadBtn');
                const statusBox = document.getElementById('uploadStatus');
                btn.disabled = true;
                statusBox.style.display = 'block';

                const seriesId = document.getElementById('mangaSelect').value;
                const chapNum = document.getElementById('chapterNum').value;

                try {
                    const downloadURLs = [];
                    // Upload each file to Storage concurrently
                    statusBox.innerText = `Uploading ${selectedFiles.length} pages to Storage Bucket... Please wait.`;
                    
                    for(let i=0; i < selectedFiles.length; i++) {
                        const file = selectedFiles[i];
                        const storageRef = storage.ref(`manga/${seriesId}/chapter_${chapNum}/${file.name}`);
                        const snapshot = await storageRef.put(file);
                        const downloadURL = await snapshot.ref.getDownloadURL();
                        downloadURLs.push(downloadURL);
                        statusBox.innerText = `Uploading pages... ${i+1}/${selectedFiles.length} done.`;
                    }

                    statusBox.innerText = "Saving Chapter record to Database...";

                    // Save the array of URLs to Firestore chapters collection
                    await db.collection("chapters").add({
                        seriesId: seriesId,
                        chapterNum: Number(chapNum),
                        pages: downloadURLs,
                        uploadTime: Date.now()
                    });

                    btn.innerHTML = '<i class="fa-solid fa-check"></i> Published';
                    statusBox.innerText = "Chapter has been successfully pushed and is Live!";
                    
                    setTimeout(() => { window.location.reload(); }, 2000);

                } catch (err) {
                    console.error(err);
                    alert("Upload error: " + err.message);
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-upload"></i> Upload & Publish';
                }
            });
        }
    }

    // ==========================================
    // READER.HTML - LOAD CHAPTER PAGES
    // ==========================================
    const readerPages = document.getElementById('readerPages');
    if (readerPages && db) {
        const urlParams = new URLSearchParams(window.location.search);
        const chapId = urlParams.get('chapId'); // We now look for the unique chapter document ID
        
        if (!chapId) {
            document.getElementById('readerTitle').textContent = "Error: Invalid Link";
            readerPages.innerHTML = "<h2 style='color: var(--text-muted); text-align: center; padding: 40px;'>No chapter specified in URL.</h2>";
            return;
        }

        db.collection("chapters").doc(chapId).get().then(async doc => {
            if (!doc.exists) {
                readerPages.innerHTML = "<h2 style='color: var(--text-muted); text-align: center; padding: 40px;'>Chapter not found in Database.</h2>";
                return;
            }

            const chapterData = doc.data();
            
            // Get Series Title for Header
            const seriesDoc = await db.collection("series").doc(chapterData.seriesId).get();
            const seriesTitle = seriesDoc.exists ? seriesDoc.data().title : "Unknown Series";
            
            document.getElementById('readerTitle').textContent = `${seriesTitle} - Ch. ${chapterData.chapterNum}`;
            
            // Render Real Image Array from Storage!
            readerPages.innerHTML = ''; 
            chapterData.pages.forEach((pageUrl, index) => {
                const img = document.createElement('img');
                img.src = pageUrl;
                img.alt = `Page ${index + 1}`;
                img.loading = "lazy";
                readerPages.appendChild(img);
            });

        }).catch(err => {
            readerPages.innerHTML = `<h2 style='color: red; text-align: center; padding: 40px;'>Error loading chapter: ${err.message}</h2>`;
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
