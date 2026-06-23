const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const navbar = document.querySelector('.navbar');
const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');

const scrollProgress = document.createElement('div');
scrollProgress.className = 'scroll-progress';
scrollProgress.setAttribute('aria-hidden', 'true');
document.body.prepend(scrollProgress);

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: prefersReducedMotion ? 'auto' : 'smooth',
                block: 'start'
            });
        }
    });
});

function updateScrollEffects() {
    const scrollTop = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const progress = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;

    document.documentElement.style.setProperty('--scroll-progress', `${progress}%`);
    document.documentElement.style.setProperty('--hero-shift', `${Math.min(scrollTop * 0.12, 90)}px`);

    if (scrollTop > 50) {
        navbar.classList.add('is-scrolled');
    } else {
        navbar.classList.remove('is-scrolled');
    }
}

window.addEventListener('scroll', updateScrollEffects, { passive: true });
window.addEventListener('resize', updateScrollEffects);
updateScrollEffects();

if (mobileMenuToggle && navbar) {
    mobileMenuToggle.addEventListener('click', () => {
        const isOpen = navbar.classList.toggle('is-menu-open');
        mobileMenuToggle.setAttribute('aria-expanded', String(isOpen));
        mobileMenuToggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
    });

    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.addEventListener('click', () => {
            navbar.classList.remove('is-menu-open');
            mobileMenuToggle.setAttribute('aria-expanded', 'false');
            mobileMenuToggle.setAttribute('aria-label', 'Open navigation');
        });
    });
}

// Form submission handling
const contactForm = document.querySelector('.contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const name = this.querySelector('input[type="text"]').value;
        const email = this.querySelector('input[type="email"]').value;
        const message = this.querySelector('textarea').value;
        
        if (name && email && message) {
            alert('Thank you for your message! We will get back to you soon.');
            this.reset();
        } else {
            alert('Please fill in all fields.');
        }
    });
}

document.querySelectorAll('.service-expander').forEach(expander => {
    expander.addEventListener('toggle', () => {
        if (!expander.open) {
            return;
        }

        document.querySelectorAll('.service-expander[open]').forEach(openExpander => {
            if (openExpander !== expander) {
                openExpander.open = false;
            }
        });
    });
});

const careerTabs = document.querySelectorAll('[data-career-tab]');
const careerPanels = document.querySelectorAll('.career-panel');
const formNextUrl = document.querySelector('#form-next-url');
const roleSelect = document.querySelector('select[name="role"]');
const selectedRoleId = document.querySelector('#selected-role-id');
const selectedRoleLink = document.querySelector('#selected-role-link');
const selectedRoleCopy = document.querySelector('#selected-role-copy');
const roleDetailView = document.querySelector('#role-detail-view');
const ajaxResumeForm = document.querySelector('[data-ajax-submit]');
const otherRoleFields = document.querySelector('#other-role-fields');
const maxResumeBytes = 4 * 1024 * 1024;
const universalRoleId = 'MVTS-OTHER-UNIVERSAL';
const universalRoleName = 'Other / Universal Resume Upload';
const recruitingEmail = 'hrinfo@mvtechsystems.com';
const minInterviewSlots = 3;
const maxInterviewSlots = 5;
const interviewSlotList = document.querySelector('#interview-slot-list');
const addInterviewSlotButton = document.querySelector('#add-interview-slot');

if (formNextUrl) {
    formNextUrl.value = `${window.location.origin}/thank-you.html`;
}

const roleLookup = {};
document.querySelectorAll('.role-card[data-role-id]').forEach(card => {
    roleLookup[card.dataset.roleId] = {
        id: card.dataset.roleId,
        name: card.dataset.roleName,
        location: card.dataset.roleLocation || 'Remote / Hybrid',
        family: card.dataset.roleFamily || 'Technology',
        summary: card.querySelector('.role-tag')?.textContent?.trim() || 'Open role',
        content: card.querySelector('.job-content')?.innerHTML || ''
    };
});

document.querySelectorAll('.role-card[data-role-id]').forEach(card => {
    const header = card.querySelector('.role-card-header');
    const viewLink = header?.querySelector('[data-open-role]');

    if (!header || !viewLink || header.querySelector('[data-open-upload]')) {
        return;
    }

    const actions = document.createElement('div');
    actions.className = 'role-card-actions';
    viewLink.replaceWith(actions);
    actions.append(viewLink);

    const applyLink = document.createElement('a');
    applyLink.href = `careers.html?role=${card.dataset.roleId}#upload-panel`;
    applyLink.className = 'role-apply-link role-submit-link';
    applyLink.dataset.openUpload = '';
    applyLink.dataset.roleId = card.dataset.roleId;
    applyLink.dataset.roleName = card.dataset.roleName;
    applyLink.textContent = 'Apply';
    actions.append(applyLink);
});

roleLookup[universalRoleId] = {
    id: universalRoleId,
    name: universalRoleName,
    location: 'Open location / Role-specific',
    family: 'Universal Resume Upload',
    summary: 'Custom role',
    content: `
        <h4>Universal Resume Upload</h4>
        <ul>
            <li>Select this option when the exact role is not listed.</li>
            <li>Target role and mandatory skillset fields are required for universal submissions.</li>
            <li>Please include candidate availability, notice period, and at least 3 interview slots.</li>
        </ul>
    `
};

function showCareerPanel(panelName) {
    careerTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.careerTab === panelName);
    });

    careerPanels.forEach(panel => {
        panel.classList.toggle('active', panel.id === `${panelName}-panel`);
    });
}

careerTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        window.history.replaceState(null, '', 'careers.html');
        showCareerPanel(tab.dataset.careerTab);
    });
});

document.addEventListener('click', event => {
    const uploadLink = event.target.closest('[data-open-upload]');
    if (uploadLink) {
        event.preventDefault();
        setSelectedRole(uploadLink.dataset.roleId, uploadLink.dataset.roleName);
        window.history.replaceState(null, '', uploadLink.getAttribute('href'));
        showCareerPanel('upload');
        document.querySelector('#upload-panel')?.scrollIntoView({
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
            block: 'start'
        });
        return;
    }

    const roleLink = event.target.closest('[data-open-role]');
    if (roleLink) {
        event.preventDefault();
        renderRoleDetail(roleLink.dataset.roleId);
        window.history.replaceState(null, '', roleLink.getAttribute('href'));
        showCareerPanel('role-detail');
        document.querySelector('#role-detail-panel')?.scrollIntoView({
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
            block: 'start'
        });
        return;
    }

    const copyRoleLink = event.target.closest('[data-copy-role-link]');
    if (copyRoleLink) {
        event.preventDefault();
        const shareUrl = copyRoleLink.dataset.shareUrl;
        const status = document.querySelector('#role-share-status');

        navigator.clipboard?.writeText(shareUrl).then(() => {
            if (status) {
                status.textContent = 'Role link copied.';
            }
        }).catch(() => {
            if (status) {
                status.textContent = shareUrl;
            }
        });
    }
});

function setSelectedRole(roleId, roleName) {
    if (!roleSelect || !roleId) {
        return;
    }

    const resolvedRoleName = roleName || roleLookup[roleId]?.name || '';

    if (resolvedRoleName) {
        roleSelect.value = resolvedRoleName;
    }

    if (selectedRoleId) {
        selectedRoleId.value = roleId;
    }

    if (selectedRoleLink) {
        selectedRoleLink.value = `${window.location.origin}${window.location.pathname}?role=${roleId}`;
    }

    if (selectedRoleCopy && resolvedRoleName) {
        selectedRoleCopy.textContent = `Applying for ${resolvedRoleName} (${roleId}). Submissions are sent to ${recruitingEmail}.`;
    }

    updateOtherRoleFields();
}

function renderRoleDetail(roleId) {
    const role = roleLookup[roleId];

    if (!roleDetailView || !role) {
        return;
    }

    const shareUrl = `${window.location.origin}${window.location.pathname}?role=${role.id}`;
    const applyUrl = `careers.html?role=${role.id}#upload-panel`;

    roleDetailView.innerHTML = `
        <header class="role-detail-hero">
            <div class="role-detail-meta">
                <span>${role.family}</span>
                <span>Role ID: ${role.id}</span>
            </div>
            <h2>${role.name}</h2>
            <p>${role.location}</p>
            <div class="role-detail-actions">
                <a href="${applyUrl}" class="submit-button" data-open-upload data-role-id="${role.id}" data-role-name="${role.name}">Submit Resume</a>
                <button type="button" class="secondary-button" data-copy-role-link data-share-url="${shareUrl}">Copy Role Link</button>
            </div>
            <p class="role-share-status" id="role-share-status"></p>
        </header>
        <div class="role-detail-layout">
            <aside class="role-summary-card">
                <h3>Summary</h3>
                <p><strong>Role ID:</strong> ${role.id}</p>
                <p><strong>Location:</strong> ${role.location}</p>
                <p><strong>Team:</strong> ${role.family}</p>
            </aside>
            <section class="role-description-card">
                <h3>Description</h3>
                ${role.content}
            </section>
        </div>
    `;
}

if (roleSelect && selectedRoleId) {
    roleSelect.addEventListener('change', () => {
        const selectedOption = roleSelect.options[roleSelect.selectedIndex];
        selectedRoleId.value = selectedOption?.dataset.roleId || '';
        if (selectedRoleLink) {
            selectedRoleLink.value = selectedOption?.dataset.roleId
                ? `${window.location.origin}${window.location.pathname}?role=${selectedOption.dataset.roleId}`
                : '';
        }
        updateOtherRoleFields();
    });
}

function updateOtherRoleFields() {
    if (!roleSelect || !otherRoleFields) {
        return;
    }

    const selectedOption = roleSelect.options[roleSelect.selectedIndex];
    const isOtherRole = selectedOption?.dataset.roleId === universalRoleId;
    const customFields = otherRoleFields.querySelectorAll('input, textarea');

    otherRoleFields.hidden = !isOtherRole;
    customFields.forEach(field => {
        field.required = isOtherRole;
        if (!isOtherRole) {
            field.value = '';
        }
    });
}

updateOtherRoleFields();

function getInterviewSlotInputs() {
    return Array.from(document.querySelectorAll('input[name^="interview_slot_"]'));
}

function updateInterviewSlotControls() {
    if (!addInterviewSlotButton) {
        return;
    }

    addInterviewSlotButton.disabled = getInterviewSlotInputs().length >= maxInterviewSlots;
}

function addInterviewSlot() {
    if (!interviewSlotList) {
        return;
    }

    const nextSlotNumber = getInterviewSlotInputs().length + 1;
    if (nextSlotNumber > maxInterviewSlots) {
        return;
    }

    const label = document.createElement('label');
    label.textContent = `Slot ${nextSlotNumber}`;

    const input = document.createElement('input');
    input.type = 'datetime-local';
    input.name = `interview_slot_${nextSlotNumber}`;

    label.append(input);
    interviewSlotList.append(label);
    updateInterviewSlotControls();
}

if (addInterviewSlotButton) {
    addInterviewSlotButton.addEventListener('click', addInterviewSlot);
    updateInterviewSlotControls();
}

const requestedRoleId = new URLSearchParams(window.location.search).get('role');
if (requestedRoleId && roleLookup[requestedRoleId]) {
    if (window.location.hash === '#upload-panel') {
        setSelectedRole(requestedRoleId);
        showCareerPanel('upload');
        requestAnimationFrame(() => {
            document.querySelector('#upload-panel')?.scrollIntoView({
                behavior: 'auto',
                block: 'start'
            });
        });
    } else {
        renderRoleDetail(requestedRoleId);
        showCareerPanel('role-detail');
        requestAnimationFrame(() => {
            document.querySelector('#role-detail-panel')?.scrollIntoView({
                behavior: 'auto',
                block: 'start'
            });
        });
    }
}

if (ajaxResumeForm) {
    ajaxResumeForm.addEventListener('submit', async event => {
        event.preventDefault();

        const submitButton = ajaxResumeForm.querySelector('button[type="submit"]');
        const status = ajaxResumeForm.querySelector('.form-status');
        const fallbackMessage = `Resume upload is temporarily unavailable. Please email your resume directly to ${recruitingEmail}.`;
        const filePreviewMessage = 'Resume upload requires the website server. Please open the local preview URL or the live mvtechsystems.com site, not the local HTML file.';
        const originalButtonText = submitButton?.textContent || 'Submit Resume';
        const resumeFile = ajaxResumeForm.querySelector('input[name="resume"]')?.files?.[0];

        if (status) {
            status.textContent = '';
            status.classList.remove('is-error', 'is-success');
        }

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Submitting...';
        }

        try {
            if (window.location.protocol === 'file:') {
                throw new Error(filePreviewMessage);
            }

            if (resumeFile && resumeFile.size > maxResumeBytes) {
                throw new Error(`Resume must be under 4 MB. Please compress the file or email it directly to ${recruitingEmail}.`);
            }

            const selectedOption = roleSelect?.options[roleSelect.selectedIndex];
            if (selectedOption?.dataset.roleId === universalRoleId) {
                const targetRole = ajaxResumeForm.querySelector('input[name="other_role"]')?.value.trim();
                const skillset = ajaxResumeForm.querySelector('textarea[name="skillset"]')?.value.trim();
                if (!targetRole || !skillset) {
                    throw new Error('Please fill Target Role and Mandatory Skillset for Other / Universal Resume Upload.');
                }
            }

            const interviewSlots = getInterviewSlotInputs()
                .map(input => input.value.trim())
                .filter(Boolean);
            if (interviewSlots.length < minInterviewSlots) {
                throw new Error('Please share at least 3 available 1-hour interview slots.');
            }

            if (interviewSlots.length > maxInterviewSlots) {
                throw new Error('Please share no more than 5 interview slots.');
            }

            const response = await fetch(ajaxResumeForm.action, {
                method: 'POST',
                body: new FormData(ajaxResumeForm),
                headers: {
                    'Accept': 'application/json'
                }
            });

            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                if (response.status === 504) {
                    throw new Error(`Resume upload timed out. Please email your resume directly to ${recruitingEmail}.`);
                }

                throw new Error(payload.message || `Resume upload failed with status ${response.status}. Please email your resume directly to ${recruitingEmail}.`);
            }

            if (status) {
                status.textContent = 'Resume submitted successfully. Redirecting...';
                status.classList.add('is-success');
            }

            window.location.href = formNextUrl?.value || `${window.location.origin}/thank-you.html`;
        } catch (error) {
            if (status) {
                status.textContent = error.message || fallbackMessage;
                status.classList.add('is-error');
            }

            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
        }
    });
}

function prepareReveal(selector, className = 'reveal', delayStep = 80) {
    document.querySelectorAll(selector).forEach((element, index) => {
        element.classList.add('reveal', className);
        element.style.setProperty('--reveal-delay', `${index * delayStep}ms`);
    });
}

prepareReveal('.services .section-title, .services .section-subtitle', 'reveal-zoom', 70);
prepareReveal('.service-card', 'reveal', 110);
prepareReveal('.about-text', 'reveal-left');
prepareReveal('.about-image', 'reveal-right');
prepareReveal('.stat', 'reveal-zoom', 120);
prepareReveal('.contact .section-title, .contact .section-subtitle', 'reveal-zoom', 70);
prepareReveal('.contact-item', 'reveal-left', 90);
prepareReveal('.contact-form', 'reveal-right');
prepareReveal('.careers-hero-copy', 'reveal-left');
prepareReveal('.career-apply-form', 'reveal-right');
document.querySelectorAll('.role-card').forEach(card => {
    card.classList.add('is-visible');
});
prepareReveal('.footer-logo, .footer p', 'reveal-zoom', 90);

function animateStat(statNumber) {
    if (statNumber.dataset.animated === 'true') {
        return;
    }

    statNumber.dataset.animated = 'true';
    const rawValue = statNumber.textContent.trim();
    const numericValue = parseInt(rawValue.replace(/\D/g, ''), 10);
    const suffix = rawValue.replace(/[0-9]/g, '');

    if (!numericValue || prefersReducedMotion) {
        statNumber.textContent = rawValue;
        return;
    }

    const duration = 1100;
    const start = performance.now();

    function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        statNumber.textContent = `${Math.round(numericValue * eased)}${suffix}`;

        if (progress < 1) {
            requestAnimationFrame(tick);
        }
    }

    requestAnimationFrame(tick);
}

const observerOptions = {
    threshold: 0.16,
    rootMargin: '0px 0px -70px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');

            if (entry.target.classList.contains('stat')) {
                const statNumber = entry.target.querySelector('.stat-number');
                if (statNumber) {
                    animateStat(statNumber);
                }
            }

            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

document.querySelectorAll('.reveal').forEach(element => {
    observer.observe(element);
});

function markPageLoaded() {
    document.body.classList.add('is-loaded');
    updateScrollEffects();
}

if (document.readyState === 'complete') {
    markPageLoaded();
} else {
    window.addEventListener('load', markPageLoaded);
}
