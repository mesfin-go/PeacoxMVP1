
        try {
            const SUPABASE_URL = 'https://lgmzqktvkvyfycyrhrbt.supabase.co';
            const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnbXpxa3R2a3Z5ZnljeXJocmJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NDA2OTUsImV4cCI6MjA5NjExNjY5NX0.oDSGz97-15p3OFhHTPALbgnJ1lDRJNBM9ayA17uF2Lc';
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

            async function loadDatabaseData() {
                const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
                if (authError || !user) { if(window.location.protocol !== 'file:') window.location.href = 'index.html'; return; }
                GLOBAL_USER_ID = user.id;

                    const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', user.id).single();
                if (profile) {
                    const fn = profile.first_name || 'Peacox'; const ln = profile.last_name || 'Manager';
                    const pmNameEl = document.getElementById('pm-name');
                    if (pmNameEl) pmNameEl.innerText = `${fn} ${ln}`;
                    
                    const infoNameEl = document.getElementById('info-name');
                    if (infoNameEl) infoNameEl.value = `${fn} ${ln}`; 
                    
                    const infoEmailEl = document.getElementById('info-email');
                    if (infoEmailEl) infoEmailEl.value = user.email || '';
                    
                    if(profile.avatar_url) { 
                        const pmAv = document.getElementById('pm-avatar');
                        if(pmAv) { pmAv.innerText = ''; pmAv.style.backgroundImage = `url("${profile.avatar_url}")`; }
                    }
                    else { 
                        const pmAv = document.getElementById('pm-avatar');
                        if(pmAv) pmAv.innerText = (profile.avatar_initials || (fn[0]+ln[0])).toUpperCase(); 
                    }
                }

                // SECURITY: Only the primary manager can create new users
                if (user.email && user.email.toLowerCase() === 'ketesfa@outlook.com') {
                    const addBtn = document.getElementById('add-user-btn');
                    if(addBtn) addBtn.style.display = 'block';
                }

                try {
                    await loadMetrics();
                } catch(e) { console.error("loadMetrics error", e); }
                
                try {
                    await loadStudents();
                } catch(e) { console.error("loadStudents error", e); }
                
                if(window.filterFeedback) window.filterFeedback('all');
            });

            async function loadMetrics() {
                const { count: studentCount } = await supabaseClient.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student');
                
                // Mentees count logic
                if (studentCount !== null) {
                    const el = document.getElementById('pm-mentees-count');
                    if(el) el.innerHTML = `${studentCount}<span style="font-size: 1.5rem; color: var(--text-muted);"> Active</span>`;
                }
            }

            let ALL_STUDENTS = [];

            async function loadStudents() {
                const { data: students, error } = await supabaseClient
                    .from('profiles')
                    .select('*')
                    .eq('role', 'student');
                
                let dbStudents = [];
                if (students && students.length > 0) {
                    dbStudents = students.map(s => {
                        // Check if metadata exists
                        const meta = s.raw_user_meta_data || {};
                        const gpa = meta.gpa || s.gpa || 0; 
                        const att = meta.attendance_pct || s.attendance_pct || 0;
                        const isActive = meta.is_active === undefined ? true : meta.is_active; 
                        
                        return {
                            id: s.id,
                            name: `${s.first_name || meta.first_name || 'No'} ${s.last_name || meta.last_name || 'Name'}`,
                            created_at: s.created_at,
                            gpa: parseFloat(gpa),
                            attendance: parseInt(att),
                            is_active: isActive
                        };
                    });
                }

                // Fallback: Merge with localStorage to bypass potential RLS read restrictions
                const localStudents = JSON.parse(localStorage.getItem('pm_local_students') || '[]');
                const merged = [...dbStudents];
                
                localStudents.forEach(ls => {
                    if (!merged.find(s => s.id === ls.id)) {
                        merged.push(ls);
                    }
                });

                ALL_STUDENTS = merged;
                renderStudentTable();
            }

            window.renderStudentTable = function() {
                const tbody = document.getElementById('student-table-body');
                if(!tbody) return;

                const statusFilter = document.getElementById('filter-status').value;
                const sortBy = document.getElementById('sort-by').value;

                // Filter
                let filtered = ALL_STUDENTS.filter(s => {
                    if (statusFilter === 'active') return s.is_active;
                    if (statusFilter === 'inactive') return !s.is_active;
                    return true;
                });

                // Sort
                filtered.sort((a, b) => {
                    if (sortBy === 'name') return a.name.localeCompare(b.name);
                    if (sortBy === 'date') return new Date(b.created_at) - new Date(a.created_at);
                    if (sortBy === 'gpa') return b.gpa - a.gpa;
                    return 0;
                });

                // Calculate Risk Metrics
                let gpaHigh = 0, gpaOk = 0;
                let attHigh = 0, attOk = 0;
                let behHigh = 0, behOk = 0;
                
                const localGab = JSON.parse(localStorage.getItem('pm_local_gab') || '{}');

                filtered.forEach(s => {
                    let gpa = s.gpa || 0;
                    let absent = 0;
                    let behavior = 0;
                    
                    const history = localGab[s.id] || [];
                    if (history.length > 0) {
                        const latest = history[history.length - 1];
                        gpa = parseFloat(latest.gpa || gpa);
                        absent = parseInt(latest.absent || 0);
                        behavior = parseInt(latest.behavior || 0);
                    }
                    
                    if (gpa > 0 && gpa < 2.0) gpaHigh++; else gpaOk++;
                    if (absent > 4) attHigh++; else attOk++;
                    if (behavior > 0) behHigh++; else behOk++;
                });

                const rCountEl = document.getElementById('risk-n-count');
                if (rCountEl) {
                    rCountEl.innerText = `(N=${filtered.length})`;
                    document.getElementById('risk-gpa-high').innerText = gpaHigh;
                    document.getElementById('risk-att-high').innerText = attHigh;
                    document.getElementById('risk-beh-high').innerText = behHigh;
                    
                    document.getElementById('risk-gpa-ok').innerText = gpaOk;
                    document.getElementById('risk-att-ok').innerText = attOk;
                    document.getElementById('risk-beh-ok').innerText = behOk;
                }

                if (filtered.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 1rem; color: var(--text-muted);">No students found.</td></tr>`;
                    return;
                }

                tbody.innerHTML = filtered.map(s => {
                    const dateStr = new Date(s.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                    
                    let gpaColor = 'var(--text-main)';
                    if (s.gpa < 2.0) gpaColor = '#EF4444';
                    else if (s.gpa < 3.0) gpaColor = '#F59E0B';
                    else gpaColor = '#10B981';

                    return `
                        <tr style="border-bottom: 1px solid var(--border-color); transition: background 0.2s;">
                            <td style="padding: 0.25rem;">
                                <a href="student.html?student_id=${s.id}" style="text-decoration: none; color: var(--peacox-purple); font-weight: bold; font-size: 0.85rem;">${s.name}</a>
                            </td>
                            <td style="padding: 0.25rem; color: var(--text-muted); font-size: 0.75rem;">${dateStr}</td>
                            <td style="padding: 0.25rem; text-align: center; font-weight: bold; color: ${gpaColor}; font-size: 0.8rem;">${s.gpa.toFixed(1)} / ${s.attendance}%</td>
                            <td style="padding: 0.25rem; text-align: center;">
                                <div style="display: flex; align-items: center; justify-content: center; gap: 0.25rem;">
                                    <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer; margin: 0;" onclick="event.stopPropagation();">
                                        <input type="checkbox" ${s.is_active ? 'checked' : ''} onchange="toggleStudentStatus('${s.id}', this.checked)" style="cursor: pointer;" title="Toggle Active Status">
                                    </label>
                                    <button onclick="window.openEditModal('${s.id}')" style="background: none; border: none; cursor: pointer; color: var(--peacox-purple); padding: 0.25rem; border-radius: 4px;" title="Edit Profile">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    </button>
                                    <button onclick="window.deleteStudent('${s.id}')" style="background: none; border: none; cursor: pointer; color: #EF4444; padding: 0.25rem; border-radius: 4px;" title="Delete Student">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');
            };

            window.toggleStudentStatus = async function(id, newStatus) {
                const student = ALL_STUDENTS.find(s => s.id === id);
                if (student) student.is_active = newStatus;
                
                // Update local storage
                localStorage.setItem('pm_local_students', JSON.stringify(ALL_STUDENTS));
                renderStudentTable();
                
                // Update Supabase via auth API or user update (since we use raw_user_meta_data here due to constraints)
                await supabaseClient.auth.updateUser({ data: { is_active: newStatus } });
                // We also update profiles table if we have permissions 
                await supabaseClient.from('profiles').update({ is_active: newStatus }).eq('id', id);
            };

            window.deleteStudent = async function(id) {
                if(!confirm("Are you sure you want to permanently delete this student account?")) return;

                // Remove locally
                ALL_STUDENTS = ALL_STUDENTS.filter(s => s.id !== id);
                localStorage.setItem('pm_local_students', JSON.stringify(ALL_STUDENTS));
                renderStudentTable();

                // Delete from Supabase profiles (Will cascade to other tables if foreign keys are set up)
                await supabaseClient.from('profiles').delete().eq('id', id);
            };

            // ADD USER LOGIC
            document.getElementById('add-user-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('create-user-btn'); const msg = document.getElementById('form-msg');
                const fn = document.getElementById('new-first').value; const ln = document.getElementById('new-last').value;
                const email = document.getElementById('new-email').value; const pass = document.getElementById('new-pass').value;
                const role = document.getElementById('new-role').value; const initials = (fn[0] + ln[0]).toUpperCase();

                // Basic Contact Info
                const phone = document.getElementById('new-phone').value;
                const address = document.getElementById('new-address').value;
                const contactMethod = document.getElementById('new-contact-method').value;

                const epYouth = Array.from(document.querySelectorAll('.ep-youth:checked')).map(cb => cb.value);
                const epComm = Array.from(document.querySelectorAll('.ep-comm:checked')).map(cb => cb.value);
                const epEvent = Array.from(document.querySelectorAll('.ep-event:checked')).map(cb => cb.value);

                const schoolGrade = document.getElementById('new-school') ? document.getElementById('new-school').value : '';
                const startDate = document.getElementById('new-start-date') ? document.getElementById('new-start-date').value : '';
                const guardianName = document.getElementById('new-guardian-name') ? document.getElementById('new-guardian-name').value : '';
                const guardianPhone = document.getElementById('new-guardian-phone') ? document.getElementById('new-guardian-phone').value : '';

                let payloadData = { 
                    first_name: fn, 
                    last_name: ln, 
                    role: role, 
                    avatar_initials: initials,
                    phone: phone,
                    address: address,
                    contact_method: contactMethod
                };

                if (role === 'student') {
                    payloadData = {
                        ...payloadData,
                        engagement_youth: epYouth,
                        engagement_community: epComm,
                        engagement_events: epEvent,
                        school_grade: schoolGrade,
                        start_date: startDate,
                        guardian_name: guardianName,
                        guardian_phone: guardianPhone
                    };
                }

                btn.innerText = 'Creating...'; msg.style.display = 'none';

                // Create a temporary client that DOES NOT persist the session to local storage
                // This prevents the Program Manager from being logged out when creating a new user
                const tempClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                    auth: { persistSession: false, autoRefreshToken: false }
                });

                const { data: authData, error } = await tempClient.auth.signUp({
                    email: email, password: pass, options: { data: payloadData }
                });

                // Force insert into profiles table in case backend trigger is missing
                if (!error && authData?.user) {
                    
                    // Add instantly to local frontend state to bypass RLS read issues
                    if (role === 'student') {
                        const newStudent = {
                            id: authData.user.id,
                            name: `${fn} ${ln}`,
                            created_at: new Date().toISOString(),
                            gpa: 0,
                            attendance: 0,
                            is_active: true
                        };
                        ALL_STUDENTS.push(newStudent);
                        localStorage.setItem('pm_local_students', JSON.stringify(ALL_STUDENTS));
                        renderStudentTable();

                        // Initialize empty GAB array in local storage fallback
                        let localGabCache = JSON.parse(localStorage.getItem('pm_local_gab') || '{}');
                        localGabCache[authData.user.id] = [];
                        localStorage.setItem('pm_local_gab', JSON.stringify(localGabCache));
                    }

                    await supabaseClient.from('profiles').upsert({
                        id: authData.user.id,
                        first_name: fn,
                        last_name: ln,
                        role: role,
                        avatar_initials: initials,
                        phone: phone,
                        address: address,
                        contact_method: contactMethod,
                        is_active: true,
                        raw_user_meta_data: payloadData
                    });

                    // Force insert curriculum progress
                    if (role === 'student') {
                        let curriculumInserts = [];
                        epYouth.forEach(item => curriculumInserts.push({ student_id: authData.user.id, category: 'Youth Programs', item_name: item, status: 'Pending Selection' }));
                        epComm.forEach(item => curriculumInserts.push({ student_id: authData.user.id, category: 'Community Engagement', item_name: item, status: 'Pending Selection' }));
                        epEvent.forEach(item => curriculumInserts.push({ student_id: authData.user.id, category: 'Major Events', item_name: item, status: 'Pending Selection' }));
                        
                        if (curriculumInserts.length > 0) {
                            await supabaseClient.from('curriculum_progress').insert(curriculumInserts);
                        }

                        // Also push to local storage so student.html can read it immediately if RLS blocks curriculum_progress!
                        let localPlans = JSON.parse(localStorage.getItem('pm_local_curriculum') || '{}');
                        localPlans[authData.user.id] = { youth: epYouth, comm: epComm, events: epEvent };
                        localStorage.setItem('pm_local_curriculum', JSON.stringify(localPlans));

                        // Also push full profile info to local storage for RLS bypass editing
                        let localProfiles = JSON.parse(localStorage.getItem('pm_local_profiles') || '{}');
                        localProfiles[authData.user.id] = {
                            first_name: fn,
                            last_name: ln,
                            email: email, // Saved locally for display only
                            phone: phone,
                            address: address,
                            contact_method: contactMethod
                        };
                        localStorage.setItem('pm_local_profiles', JSON.stringify(localProfiles));
                    }
                }

                if (error) { msg.innerText = error.message; msg.style.color = '#DC2626'; msg.style.display = 'block'; btn.innerText = 'Create Account'; } 
                else {
                    msg.innerText = `Account created successfully!`; msg.style.color = '#10B981'; msg.style.display = 'block'; btn.innerText = 'Create Account';
                    document.getElementById('add-user-form').reset(); 
                    if(typeof toggleStudentFields === 'function') toggleStudentFields();
                    setTimeout(() => { closeModal(); msg.style.display = 'none'; }, 2000);
                }
            });

            window.openEditModal = async function(id) {
                // Fetch full data using local fallback strategy
                let profile = null;
                const localProfiles = JSON.parse(localStorage.getItem('pm_local_profiles') || '{}');
                
                // Try Supabase first
                const { data } = await supabaseClient.from('profiles').select('*').eq('id', id).single();
                if (data && data.phone !== undefined) { 
                    profile = data;
                } else if (localProfiles[id]) {
                    profile = localProfiles[id];
                }

                if (!profile) {
                    alert("Unable to load full profile data. They may have been created before the local cache upgrade, and Supabase RLS is blocking the read.");
                    return;
                }

                document.getElementById('edit-user-id').value = id;
                document.getElementById('edit-first').value = profile.first_name || '';
                document.getElementById('edit-last').value = profile.last_name || '';
                document.getElementById('edit-email').value = profile.email || 'Email hidden by RLS';
                document.getElementById('edit-phone').value = profile.phone || '';
                document.getElementById('edit-address').value = profile.address || '';
                document.getElementById('edit-contact-method').value = profile.contact_method || 'Email';

                window.currentEditProfile = profile;
                const meta = profile.raw_user_meta_data || {};
                document.getElementById('edit-school').value = profile.school_grade || meta.school_grade || '';
                document.getElementById('edit-start-date').value = profile.start_date || meta.start_date || '';
                document.getElementById('edit-guardian-name').value = profile.guardian_name || meta.guardian_name || '';
                document.getElementById('edit-guardian-phone').value = profile.guardian_phone || meta.guardian_phone || '';

                // Fetch Curriculum
                const localPlans = JSON.parse(localStorage.getItem('pm_local_curriculum') || '{}');
                let plan = localPlans[id] || { youth: [], comm: [], events: [] };
                
                document.querySelectorAll('.edit-ep-youth').forEach(cb => cb.checked = plan.youth.includes(cb.value));
                document.querySelectorAll('.edit-ep-comm').forEach(cb => cb.checked = plan.comm.includes(cb.value));
                document.querySelectorAll('.edit-ep-event').forEach(cb => cb.checked = plan.events.includes(cb.value));

                openModal('edit-user');
            };

            document.getElementById('edit-user-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('save-user-btn'); const msg = document.getElementById('edit-form-msg');
                const id = document.getElementById('edit-user-id').value;
                const fn = document.getElementById('edit-first').value; const ln = document.getElementById('edit-last').value;
                const phone = document.getElementById('edit-phone').value;
                const address = document.getElementById('edit-address').value;
                const contactMethod = document.getElementById('edit-contact-method').value;

                const epYouth = Array.from(document.querySelectorAll('.edit-ep-youth:checked')).map(cb => cb.value);
                const epComm = Array.from(document.querySelectorAll('.edit-ep-comm:checked')).map(cb => cb.value);
                const epEvent = Array.from(document.querySelectorAll('.edit-ep-event:checked')).map(cb => cb.value);

                const schoolGrade = document.getElementById('edit-school').value;
                const startDate = document.getElementById('edit-start-date').value;
                const guardianName = document.getElementById('edit-guardian-name').value;
                const guardianPhone = document.getElementById('edit-guardian-phone').value;

                let existingMeta = {};
                if (window.currentEditProfile && window.currentEditProfile.raw_user_meta_data) {
                    existingMeta = window.currentEditProfile.raw_user_meta_data;
                }
                const newMeta = {
                    ...existingMeta,
                    school_grade: schoolGrade,
                    start_date: startDate,
                    guardian_name: guardianName,
                    guardian_phone: guardianPhone
                };

                btn.innerText = 'Saving...'; msg.style.display = 'none';

                // Update Supabase Profiles
                await supabaseClient.from('profiles').update({
                    first_name: fn, last_name: ln, phone: phone, address: address, contact_method: contactMethod,
                    raw_user_meta_data: newMeta
                }).eq('id', id);

                // Update Supabase Curriculum (Wipe and re-insert is easiest)
                await supabaseClient.from('curriculum_progress').delete().eq('student_id', id);
                let curriculumInserts = [];
                epYouth.forEach(item => curriculumInserts.push({ student_id: id, category: 'Youth Programs', item_name: item, status: 'Pending Selection' }));
                epComm.forEach(item => curriculumInserts.push({ student_id: id, category: 'Community Engagement', item_name: item, status: 'Pending Selection' }));
                epEvent.forEach(item => curriculumInserts.push({ student_id: id, category: 'Major Events', item_name: item, status: 'Pending Selection' }));
                if (curriculumInserts.length > 0) {
                    await supabaseClient.from('curriculum_progress').insert(curriculumInserts);
                }

                // Update Local Caches!
                let localProfiles = JSON.parse(localStorage.getItem('pm_local_profiles') || '{}');
                if(localProfiles[id]) {
                    localProfiles[id].first_name = fn; localProfiles[id].last_name = ln;
                    localProfiles[id].phone = phone; localProfiles[id].address = address; localProfiles[id].contact_method = contactMethod;
                    localStorage.setItem('pm_local_profiles', JSON.stringify(localProfiles));
                }

                let localPlans = JSON.parse(localStorage.getItem('pm_local_curriculum') || '{}');
                localPlans[id] = { youth: epYouth, comm: epComm, events: epEvent };
                localStorage.setItem('pm_local_curriculum', JSON.stringify(localPlans));

                const studentIndex = ALL_STUDENTS.findIndex(s => s.id === id);
                if (studentIndex > -1) {
                    ALL_STUDENTS[studentIndex].name = `${fn} ${ln}`;
                    localStorage.setItem('pm_local_students', JSON.stringify(ALL_STUDENTS));
                    renderStudentTable();
                }

                msg.innerText = `Changes saved successfully!`; msg.style.color = '#10B981'; msg.style.display = 'block'; btn.innerText = 'Save Changes';
                setTimeout(() => { closeModal(); msg.style.display = 'none'; }, 2000);

        // --- FEEDBACK LIST LOGIC ---
        window.filterFeedback = function(type) {
            const msgs = JSON.parse(localStorage.getItem('pm_local_messages') || '[]');
            let filtered = msgs;
            if (type !== 'all') {
                filtered = msgs.filter(m => m.reason === type);
            }
            
            const list = document.getElementById('feedback-list');
            if (!list) return;

            if (filtered.length === 0) {
                list.innerHTML = `<p style="font-size: 0.75rem; color: var(--text-muted); text-align: center;">No feedback found.</p>`;
                return;
            }

            // Sort by date newest first
            filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

            list.innerHTML = filtered.map(m => {
                const dateStr = new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const badgeColor = m.reason === 'program' ? '#10B981' : '#F59E0B';
                const specific = m.specific ? ` - ${m.specific}` : '';
                
                return `
                    <div class="escalation-item" style="flex-direction: column; align-items: flex-start; gap: 0.25rem; padding: 0.5rem; background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 4px;">
                        <div style="display: flex; justify-content: space-between; width: 100%;">
                            <span style="font-size: 0.75rem; font-weight: bold; color: var(--text-main);">${m.student_name || 'Student'}</span>
                            <span style="font-size: 0.65rem; color: var(--text-muted);">${dateStr}</span>
                        </div>
                        <span class="badge" style="background: ${badgeColor}; align-self: flex-start; max-width: 100%; white-space: normal; text-align: left;">${m.reason.toUpperCase()}${specific}</span>
                        <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0; line-height: 1.3;">${m.message}</p>
                    </div>
                `;
            }).join('');
        };

            document.getElementById('logout-btn').addEventListener('click', async () => {
                document.getElementById('logout-btn').innerText = 'Signing out...';
                try { await supabaseClient.auth.signOut(); } catch(e){} finally { window.location.replace('index.html'); }
            });

            loadDatabaseData();
        } catch (error) { console.warn("Supabase bypassed locally."); }
    