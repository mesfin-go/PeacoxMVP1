
        let GLOBAL_USER_ID = null; 
        let supabaseClient = null;
        
        // TAB LOGIC
        function switchTab(tabId) {
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            event.currentTarget.classList.add('active');
        }

        // AVATAR LOGIC
        document.getElementById('avatar-upload').addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if(file && GLOBAL_USER_ID) {
                const avatar = document.getElementById('pm-avatar');
                avatar.innerText = '...'; 
                
                const fileExt = file.name.split('.').pop();
                const fileName = `${GLOBAL_USER_ID}.${fileExt}`;
                const { data, error } = await supabaseClient.storage.from('avatars').upload(fileName, file, { upsert: true });
                
                if(!error) {
                    const { data: urlData } = supabaseClient.storage.from('avatars').getPublicUrl(fileName);
                    const publicURL = urlData.publicUrl;
                    
                    await supabaseClient.from('profiles').update({ avatar_url: publicURL }).eq('id', GLOBAL_USER_ID);
                    
                    avatar.innerText = ''; 
                    avatar.style.backgroundImage = `url("${publicURL}?t=${new Date().getTime()}")`;
                } else {
                    console.error("Upload error:", error);
                    alert("Avatar upload failed.");
                }
            }
        });

        // CURRICULUM CHECKBOX LIMITS
        function enforceCheckboxLimit(selector, limit) {
            const checkboxes = document.querySelectorAll(selector);
            checkboxes.forEach(cb => {
                cb.addEventListener('change', () => {
                    const checkedCount = document.querySelectorAll(`${selector}:checked`).length;
                    if (checkedCount > limit) {
                        cb.checked = false;
                        alert(`You can only select up to ${limit} options in this category.`);
                    }
                });
            });
        }

        // Apply limits for Add User Form
        enforceCheckboxLimit('.ep-youth', 2);
        enforceCheckboxLimit('.ep-comm', 1);
        enforceCheckboxLimit('.ep-event', 2);

        // Apply limits for Edit User Form
        enforceCheckboxLimit('.edit-ep-youth', 2);
        enforceCheckboxLimit('.edit-ep-comm', 1);
        enforceCheckboxLimit('.edit-ep-event', 2);

        // MODAL LOGIC
        function toggleSidePane() { document.getElementById('side-pane').classList.toggle('active'); document.getElementById('side-overlay').classList.toggle('active'); }
        
        function toggleStudentFields() {
            const role = document.getElementById('new-role').value;
            document.getElementById('student-extra-fields').style.display = (role === 'student') ? 'block' : 'none';
        }

        function openModal(type) {
            document.getElementById('side-pane').classList.remove('active'); 
            document.getElementById('side-overlay').classList.remove('active');
            
            ['basic-info', 'add-user', 'edit-user'].forEach(id => document.getElementById(`content-${id}`).style.display = 'none');
            document.getElementById(`content-${type}`).style.display = 'block';
            
            const titles = {'basic-info': 'Manager Details', 'add-user': 'Add System User', 'edit-user': 'Edit Student Profile'};
            document.getElementById('modal-title').innerText = titles[type];
            document.getElementById('modal-header-controls').style.display = (type === 'add-user') ? 'block' : 'none';
            document.getElementById('master-modal').style.display = 'flex';
        }
        
        function closeModal() { document.getElementById('master-modal').style.display = 'none'; }
    