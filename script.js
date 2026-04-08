document.addEventListener('DOMContentLoaded', () => {
    
    // --- Mobile Menu Toggle ---
    const mobileBtn = document.querySelector('.mobile-menu-btn');
    const mobileDropdown = document.querySelector('.mobile-dropdown');

    if (mobileBtn && mobileDropdown) {
        mobileBtn.addEventListener('click', () => {
            mobileDropdown.classList.toggle('active');
            const icon = mobileBtn.querySelector('i');
            if (mobileDropdown.classList.contains('active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-xmark');
            } else {
                icon.classList.remove('fa-xmark');
                icon.classList.add('fa-bars');
            }
        });
    }

    // --- Dynamic Manga Rendering (Home Page) ---
    const mangaGridContainer = document.getElementById('manga-grid-container');
    
    if (mangaGridContainer) {
        fetch('database.json')
            .then(response => response.json())
            .then(data => {
                mangaGridContainer.innerHTML = ''; // Clear loading text
                
                if(!data.releases || data.releases.length === 0) {
                    mangaGridContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No releases found.</p>';
                    return;
                }

                data.releases.forEach(release => {
                    const timeTag = calculateTimeAgo(release.uploadTime);
                    const badgeHtml = release.badge ? `<div class="badge-overlay ${release.badge.toLowerCase() === 'new' ? 'new' : ''}">${release.badge}</div>` : '';
                    
                    const cardHtml = `
                        <article class="manga-card">
                            <div class="cover-wrapper">
                                <div class="cover-placeholder" style="background-color: #2a2a3e;">
                                    <img src="${release.coverUrl}" alt="${release.title}" />
                                </div>
                                ${badgeHtml}
                                <div class="hover-action">
                                    <i class="fa-solid fa-book-open"></i> Read
                                </div>
                            </div>
                            <div class="manga-info">
                                <h3 class="manga-title">${release.title}</h3>
                                <div class="manga-meta">
                                    <span class="chapter-tag">Ch. ${release.chapter}</span>
                                    <span class="time-tag">${timeTag}</span>
                                </div>
                                <div class="staff-credits">
                                    ${release.staff}
                                </div>
                            </div>
                        </article>
                    `;
                    mangaGridContainer.innerHTML += cardHtml;
                });
            })
            .catch(error => {
                console.error("Error loading database:", error);
                mangaGridContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #ff3e72;">Failed to load releases. Ensure database.json exists.</p>';
            });
    }

    // --- Admin Dashboard Tab Switching ---
    const tabLinks = document.querySelectorAll('.admin-menu a');
    const panels = document.querySelectorAll('.admin-panel');

    if (tabLinks.length > 0) {
        tabLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                tabLinks.forEach(t => t.parentElement.classList.remove('active'));
                panels.forEach(p => p.classList.remove('active-panel'));
                link.parentElement.classList.add('active');
                const targetId = link.getAttribute('data-tab') + '-tab';
                document.getElementById(targetId).classList.add('active-panel');
            });
        });
    }

    // --- Upload Functionality (Staff Portal) ---
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const fileList = document.getElementById('fileList');
    const uploadForm = document.getElementById('uploadForm');
    
    let uploadedFiles = [];

    if (dropzone && fileInput) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => dropzone.addEventListener(eventName, preventDefaults, false));
        ['dragenter', 'dragover'].forEach(eventName => dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false));
        ['dragleave', 'drop'].forEach(eventName => dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false));

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        dropzone.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));
        fileInput.addEventListener('change', function() { handleFiles(this.files); });

        function handleFiles(files) {
            files = [...files];
            uploadedFiles = uploadedFiles.concat(files);
            renderFileList();
        }

        function renderFileList() {
            fileList.innerHTML = '';
            uploadedFiles.forEach((file, index) => {
                const li = document.createElement('li');
                li.className = 'file-item';
                let name = file.name.length > 30 ? file.name.substring(0, 27) + '...' : file.name;
                let size = (file.size / 1024 / 1024).toFixed(2);
                li.innerHTML = `<span><i class="fa-regular fa-file"></i> ${name} (${size} MB)</span><i class="fa-solid fa-xmark remove-file" data-index="${index}"></i>`;
                fileList.appendChild(li);
            });
            document.querySelectorAll('.remove-file').forEach(btn => {
                btn.addEventListener('click', function() {
                    uploadedFiles.splice(this.getAttribute('data-index'), 1);
                    renderFileList();
                });
            });
        }
    }

    // Form submission processing -> GitHub API 
    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const token = document.getElementById('githubToken').value.trim();
            if(!token) {
                alert("GitHub Token is required.");
                return;
            }
            if (uploadedFiles.length === 0) {
                alert("Please add files to upload.");
                return;
            }

            const progressContainer = document.getElementById('uploadProgress');
            const progressBarFill = document.getElementById('progressBarFill');
            const progressText = document.getElementById('progressText');
            const submitBtn = document.querySelector('.submit-btn .btn-inner');

            progressContainer.classList.remove('hidden');
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
            
            try {
                // 1. Fetch current database config
                const dbRes = await fetch('database.json?' + new Date().getTime()); // cache buster
                if(!dbRes.ok) throw new Error("Could not load database.json");
                let dbData = await dbRes.json();
                
                const owner = dbData.repo.owner;
                const repo = dbData.repo.name;
                const seriesId = document.getElementById('mangaSelect').value || 'unknown';
                const chapterNum = document.getElementById('chapterNum').value;
                const basePath = `chapters/${seriesId}/chap-${chapterNum}`;

                // Process files sequentially (to avoid rate limits, though slow)
                let completedFiles = 0;
                for (let i = 0; i < uploadedFiles.length; i++) {
                    const file = uploadedFiles[i];
                    progressText.textContent = `Uploading ${file.name} (${i+1}/${uploadedFiles.length})...`;
                    
                    const base64Data = await convertToBase64(file);
                    // Extract just the raw base64 string without data:mime URI prefix
                    const base64Content = base64Data.split(',')[1]; 
                    
                    const filePath = `${basePath}/${file.name}`;
                    
                    // PUT request to GitHub Contents API
                    const gitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            message: `Add ${file.name} for ${seriesId} Chapter ${chapterNum}`,
                            content: base64Content
                        })
                    });

                    if(!gitRes.ok) {
                        console.error('Error uploading file:', await gitRes.text());
                        throw new Error(`Failed uploading ${file.name}. Check token permissions.`);
                    }
                    
                    completedFiles++;
                    let pct = Math.round((completedFiles / uploadedFiles.length) * 80); // 80% of process is images
                    progressBarFill.style.width = pct + '%';
                }

                // 2. Update database.json
                progressText.textContent = "Updating database...";
                
                // We need the database file's SHA to update it via API
                const dbShaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/database.json`);
                const dbFileInfo = await dbShaRes.json();
                
                // Add new entry to our local copy
                dbData.releases.unshift({
                    id: `${seriesId}-${chapterNum}-${Date.now()}`,
                    seriesId: seriesId,
                    title: document.getElementById('mangaSelect').options[document.getElementById('mangaSelect').selectedIndex].text,
                    chapter: chapterNum,
                    coverUrl: "https://images.unsplash.com/photo-1541562232579-512a21360020?q=80&w=600&auto=format&fit=crop", // Provide way to upload cover later
                    badge: "NEW",
                    staff: document.getElementById('staffCredits').value || "Uploaded by Staff",
                    uploadTime: new Date().toISOString()
                });

                // Commit the new database.json
                const finalDbRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/database.json`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Update database with ${seriesId} Chapter ${chapterNum}`,
                        content: btoa(JSON.stringify(dbData, null, 2)), // Convert JSON str to base64
                        sha: dbFileInfo.sha
                    })
                });

                if(!finalDbRes.ok) throw new Error("Failed up updating database.json on GitHub");

                progressBarFill.style.width = '100%';
                progressText.textContent = 'Upload Complete!';
                alert("Chapter successfully published to GitHub!");
                
                uploadForm.reset();
                uploadedFiles = [];
                renderFileList();
                setTimeout(() => progressContainer.classList.add('hidden'), 2000);

            } catch (err) {
                console.error(err);
                alert("Upload failed: " + err.message);
                progressContainer.classList.add('hidden');
            } finally {
                submitBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Publish Chapter';
            }
        });
    }

    // Helper functions
    function calculateTimeAgo(dateString) {
        const date = new Date(dateString);
        const diffMs = Date.now() - date.getTime();
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHrs / 24);
        
        if (diffHrs < 1) return "Just now";
        if (diffHrs < 24) return `${diffHrs} hours ago`;
        if (diffDays === 1) return `Yesterday`;
        return `${diffDays} days ago`;
    }

    function convertToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }
});
