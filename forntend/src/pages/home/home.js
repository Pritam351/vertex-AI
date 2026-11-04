import { courseService } from '../../services/courseService.js';
import { enrollmentService } from '../../services/enrollmentService.js';
import { getSession, isAuthenticated } from '../../store/session.js';
import { toast } from '../../components/common/toast.js';

// ── State ──
let userEnrollments = [];
let allCourses = [];
let filteredCourses = [];

// ── Main Mount Function ──
// home.css is bundled into app.css via @import — no dynamic injection needed
export async function mountHomePage(container) {
  // container is the #app element that already has the home.html injected
  // Mark #app so home-only CSS rules (noise overlay, etc.) are scoped here
  container.classList.add('home-page');
  setupNavScrollEffect(container);
  setupScrollAnimations(container);
  setupSmoothAnchors(container);
  await checkAuthStatus(container);
  await loadCourses(container);
}

// ── Auth Check ──
async function checkAuthStatus(container) {
  const navLogin    = container.querySelector('#nav-login');
  const navRegister = container.querySelector('#nav-register');
  const navDashboard = container.querySelector('#nav-dashboard');

  if (isAuthenticated()) {
    if (navLogin)    navLogin.hidden    = true;
    if (navRegister) navRegister.hidden = true;
    if (navDashboard) navDashboard.hidden = false;
    await loadEnrollments();
  }
}

async function loadEnrollments() {
  try {
    const response = await enrollmentService.getMyEnrollments();
    userEnrollments = response?.data?.enrollments || response?.enrollments || [];
  } catch (e) {
    console.warn('Enrollments fetch failed:', e);
  }
}

function isEnrolledInCourse(courseId) {
  return userEnrollments.some(e => {
    const id = e.courseId?._id || e.courseId || e.course?._id || e.course;
    return String(id) === String(courseId);
  });
}

// ── Courses ──
async function loadCourses(container) {
  const loading   = container.querySelector('#courses-loading');
  const grid      = container.querySelector('#courses-container');
  const emptyEl   = container.querySelector('#courses-empty');
  const errorEl   = container.querySelector('#courses-error');
  const countLabel = container.querySelector('#courses-count-label');
  const statEl    = container.querySelector('#stat-courses');
  const filterTabs = container.querySelector('#filter-tabs');

  try {
    // Show skeleton, hide others
    if (loading)  loading.hidden  = false;
    if (grid)     grid.hidden     = true;
    if (emptyEl)  emptyEl.hidden  = true;
    if (errorEl)  errorEl.hidden  = true;

    const response = await courseService.listCourses({ limit: 100 });
    allCourses = response?.data?.courses || response?.courses || [];

    // Hide skeleton
    if (loading) loading.hidden = true;

    if (!allCourses.length) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }

    // Hero stat counter
    if (statEl) animateCount(statEl, allCourses.length);

    // Build category filter tabs
    buildFilterTabs(container, allCourses);

    // Render all courses initially
    filteredCourses = allCourses;
    renderCourses(grid, filteredCourses);
    if (grid) grid.hidden = false;

    updateCountLabel(countLabel, filteredCourses.length, allCourses.length);

  } catch (err) {
    console.error('Failed to load courses:', err);
    if (loading) loading.hidden = true;
    if (errorEl) errorEl.hidden = false;
  }
}

function buildFilterTabs(container, courses) {
  const tabs = container.querySelector('#filter-tabs');
  if (!tabs) return;

  const categories = [...new Set(courses.map(c => c.category).filter(Boolean))].sort();

  // Wire up "All" tab
  const allTab = tabs.querySelector('[data-filter="all"]');
  if (allTab) {
    allTab.addEventListener('click', () => applyFilter(container, 'all'));
  }

  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-tab';
    btn.dataset.filter = cat;
    btn.textContent = cat;
    btn.addEventListener('click', () => applyFilter(container, cat));
    tabs.appendChild(btn);
  });
}

function applyFilter(container, filter) {
  const tabs = container.querySelectorAll('.filter-tab');
  tabs.forEach(t => t.classList.toggle('is-active', t.dataset.filter === filter));

  filteredCourses = filter === 'all'
    ? allCourses
    : allCourses.filter(c => c.category === filter);

  const grid = container.querySelector('#courses-container');
  const countLabel = container.querySelector('#courses-count-label');
  renderCourses(grid, filteredCourses);
  updateCountLabel(countLabel, filteredCourses.length, allCourses.length);
}

function updateCountLabel(el, shown, total) {
  if (!el) return;
  el.innerHTML = `Showing <span>${shown}</span> of <span>${total}</span> courses`;
}

function renderCourses(grid, courses) {
  if (!grid) return;
  grid.innerHTML = '';
  courses.forEach((course, i) => {
    grid.appendChild(createCourseCard(course, i));
  });
}

function createCourseCard(course, index = 0) {
  const card = document.createElement('div');
  card.className = 'course-card';
  card.style.animationDelay = `${Math.min(index * 0.06, 0.6)}s`;

  const isLoggedIn   = isAuthenticated();
  const isEnrolled   = isLoggedIn && isEnrolledInCourse(course._id);
  const instructorName = course.instructorId?.fullName || course.instructorId?.name || 'Instructor';
  const initials = instructorName.split(' ').map(n => n[0] || '').join('').slice(0, 2).toUpperCase() || 'IN';
  const diffClass  = (course.difficulty || 'beginner').toLowerCase();
  const hasThumbnail = !!course.thumbnailUrl;

  // CTA logic: show all courses to everyone, smart CTA based on auth state
  let btnClass  = 'btn-primary';
  let btnLabel  = '🚀 Enroll Free';
  let btnTitle  = 'Enroll in this course';
  if (isEnrolled) {
    btnClass = 'btn-secondary';
    btnLabel = '▶ Continue Learning';
    btnTitle = 'Continue where you left off';
  } else if (!isLoggedIn) {
    btnClass = 'btn-primary';
    btnLabel = '🚀 Enroll Free';
    btnTitle = 'Sign up to enroll';
  }

  card.innerHTML = `
    <div class="course-thumbnail">
      ${hasThumbnail
        ? `<img src="${esc(course.thumbnailUrl)}" alt="${esc(course.title)}" loading="lazy">`
        : `<div class="course-thumbnail-placeholder">📚</div>`}
      <div class="course-thumbnail-overlay">
        <div class="course-play-icon">▶</div>
      </div>
    </div>
    <div class="course-content">
      <div class="course-meta">
        <span class="course-badge badge-category">${esc(course.category || 'General')}</span>
        <span class="course-badge badge-difficulty ${diffClass}">${esc(course.difficulty || 'Beginner')}</span>
      </div>
      <h3 class="course-title">${esc(course.title)}</h3>
      <div class="course-instructor">
        <span class="course-instructor-avatar">${initials}</span>
        By ${esc(instructorName)}
      </div>
      <p class="course-description">${esc(course.description || 'Explore this course to learn more.')}</p>
      <div class="course-footer">
        <div class="course-stat">📚 ${course.totalModules || 0} modules</div>
        <div class="course-stat">🎬 ${course.totalLectures || 0} lectures</div>
      </div>
      <button class="btn ${btnClass} course-action" title="${btnTitle}"
              data-course-id="${esc(course._id)}">
        ${btnLabel}
      </button>
    </div>
  `;

  card.querySelector('.course-action').addEventListener('click', (e) => {
    e.stopPropagation();
    handleCourseAction(course._id, isEnrolled);
  });

  // Whole card click (not the button) → same action
  card.addEventListener('click', (e) => {
    if (!e.target.closest('.course-action')) {
      handleCourseAction(course._id, isEnrolled);
    }
  });

  return card;
}

async function handleCourseAction(courseId, isEnrolled) {
  // Already enrolled → jump straight to player
  if (isEnrolled) {
    window.location.hash = `#/student/player?courseId=${courseId}`;
    return;
  }

  // Not logged in → redirect to register with pending enrollment intent
  if (!isAuthenticated()) {
    try { sessionStorage.setItem('vertex:pendingEnrollment', courseId); } catch (_) {}
    window.location.hash = `#/register?redirect=enroll&courseId=${courseId}`;
    return;
  }

  // Logged in but not enrolled → enroll now
  const button = document.querySelector(`[data-course-id="${courseId}"]`);
  if (button) {
    button.disabled = true;
    button.textContent = '⏳ Enrolling...';
  }

  try {
    await enrollmentService.enroll(courseId);
    toast('Enrolled successfully! Starting course…', 'success');
    await loadEnrollments();
    setTimeout(() => {
      window.location.hash = `#/student/player?courseId=${courseId}`;
    }, 1200);
  } catch (err) {
    toast(err.message || 'Failed to enroll. Please try again.', 'error');
    if (button) {
      button.disabled = false;
      button.textContent = '🚀 Enroll Free';
    }
  }
}

// ── Nav Scroll Effect ──
function setupNavScrollEffect(container) {
  const nav = container.querySelector('#home-nav');
  if (!nav) return;
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 50);
  window.addEventListener('scroll', onScroll, { passive: true });
}

// ── Smooth Anchor Scroll ──
function setupSmoothAnchors(container) {
  container.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (!href || href.startsWith('#/')) return;
      const id = href.slice(1);
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// ── Scroll-triggered animations ──
function setupScrollAnimations(container) {
  const elements = container.querySelectorAll('.animate-on-scroll');
  if (!elements.length) return;

  const viewportH = window.innerHeight;

  // Only animate elements that start BELOW the fold
  elements.forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.top > viewportH * 0.95) {
      el.classList.add('will-animate');
    }
  });

  // Observe only the ones we marked
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          entry.target.classList.remove('will-animate');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
  );

  elements.forEach(el => {
    if (el.classList.contains('will-animate')) observer.observe(el);
  });
}

// ── Utilities ──
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function animateCount(el, target) {
  let current = 0;
  const step = Math.max(1, Math.ceil(target / 40));
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current + '+';
    if (current >= target) clearInterval(timer);
  }, 35);
}

