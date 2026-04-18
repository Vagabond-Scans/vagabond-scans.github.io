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
    console.log("Firebase App initialized successfully.");
} catch (e) {
    console.warn("Firebase initialization failed.", e);
}

// ==========================================
// UI HANDLING (Global)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

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
        db.collection("chapters").orderBy("uploadTime", "desc").limit(20).get()
        .then(async snapshot => {
            if (snapshot.empty) {
                mangaGridContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No chapters found in database.</p>';
                return;
            }
            mangaGridContainer.innerHTML = ''; 
            
            for (let doc of snapshot.docs) {
                const chapData = doc.data();
                const chapId = doc.id;
                
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
    // ADMIN.HTML - FIREBASE AUTH & UNIFIED UPLOAD
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
                loadSeriesIntoDropdown();
            } else {
                loginSection.style.display = 'block';
                dashboardSection.style.display = 'none';
                document.getElementById('logoutBtn').style.display = 'none';
            }
        });

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

        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault(); auth.signOut();
        });

        // --- 2. POPULATE SERIES DROPDOWN WITH "+ ADD NEW" ---
        const mangaSelect = document.getElementById('mangaSelect');
        const newSeriesFields = document.getElementById('newSeriesFields');
        const seriesTitle = document.getElementById('seriesTitle');
        const seriesCoverUrl = document.getElementById('seriesCoverUrl');

        function loadSeriesIntoDropdown() {
            if(!mangaSelect) return;
            db.collection("series").get().then(snapshot => {
                mangaSelect.innerHTML = '<option value="" disabled selected>-- Choose Series --</option>';
                snapshot.forEach(doc => {
                    mangaSelect.innerHTML += `<option value="${doc.id}">${doc.data().title}</option>`;
                });
                mangaSelect.innerHTML += `<option value="NEW_SERIES" style="font-weight:bold; color:var(--purple-main);">+ Add New Series</option>`;
            });
        }

        // Show/Hide New Series Fields based on dropdown selection
        if(mangaSelect) {
            mangaSelect.addEventListener('change', () => {
                if(mangaSelect.value === 'NEW_SERIES') {
                    newSeriesFields.style.display = 'block';
                    seriesTitle.required = true;
                    seriesCoverUrl.required = true;
                } else {
                    newSeriesFields.style.display = 'none';
                    seriesTitle.required = false;
                    seriesCoverUrl.required = false;
                }
            });
        }

        // --- 3. DRAG & DROP FILE LOGIC ---
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
            fileInput.addEventListener('change', () => handleFiles(fileInput.files));

            function handleFiles(files) {
                selectedFiles = Array.from(files).sort((a,b) => a.name.localeCompare(b.name));
                dropzone.innerHTML = `<i class="fa-solid fa-file-circle-check" style="font-size: 2rem; color: var(--purple-light); margin-bottom: 10px;"></i>
                                      <h3 style="color:white;">${selectedFiles.length} Pages Queued</h3>
                                      <p style="color:var(--text-secondary); font-size: 0.8rem;">Ready for upload.</p>`;
            }
        }

        // --- 4. UNIFIED UPLOAD LOGIC ---
        const uploadForm = document.getElementById('uploadForm');
        if(uploadForm) {
            uploadForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if(selectedFiles.length === 0) return alert("Please select image files first!");

                const btn = document.getElementById('uploadBtn');
                const statusBox = document.getElementById('uploadStatus');
                btn.disabled = true;
                statusBox.style.display = 'block';

                let targetSeriesId = mangaSelect.value;
                const chapNum = document.getElementById('chapterNum').value;

                try {
                    // IF NEW SERIES, REGISTER IT FIRST
                    if (targetSeriesId === 'NEW_SERIES') {
                        statusBox.innerText = "Registering new Manga Series into database...";
                        const seriesRef = await db.collection("series").add({
                            title: seriesTitle.value,
                            coverUrl: seriesCoverUrl.value,
                            author: document.getElementById('seriesAuthor').value || "Unknown",
                            createdAt: Date.now()
                        });
                        targetSeriesId = seriesRef.id;
                    }

                    // UPLOAD CHAPTER IMAGES TO FIREBASE STORAGE
                    statusBox.innerText = `Uploading ${selectedFiles.length} pages to Storage Bucket... Please wait.`;
                    const downloadURLs = [];
                    
                    for(let i=0; i < selectedFiles.length; i++) {
                        const file = selectedFiles[i];
                        const storageRef = storage.ref(`manga/${targetSeriesId}/chapter_${chapNum}/${file.name}`);
                        const snapshot = await storageRef.put(file);
                        const downloadURL = await snapshot.ref.getDownloadURL();
                        downloadURLs.push(downloadURL);
                        statusBox.innerText = `Uploading pages... ${i+1}/${selectedFiles.length} done.`;
                    }

                    // SAVE CHAPTER RECORD
                    statusBox.innerText = "Saving Chapter record to Database...";
                    await db.collection("chapters").add({
                        seriesId: targetSeriesId,
                        chapterNum: Number(chapNum),
                        pages: downloadURLs,
                        uploadTime: Date.now()
                    });

                    btn.innerHTML = '<i class="fa-solid fa-check"></i> Published Successfully';
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
        const chapId = urlParams.get('chapId'); 
        
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
            
            // Get Series Title
            const seriesDoc = await db.collection("series").doc(chapterData.seriesId).get();
            const seriesTitle = seriesDoc.exists ? seriesDoc.data().title : "Unknown Series";
            
            document.getElementById('readerTitle').textContent = `${seriesTitle} - Ch. ${chapterData.chapterNum}`;
            
            // Render Real Image Array from Storage
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
