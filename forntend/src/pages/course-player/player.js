import { courseService } from "../../services/courseService.js";
import { enrollmentService } from "../../services/enrollmentService.js";
import { aiService } from "../../services/aiService.js";
import { $, escapeHtml } from "../../utils/dom.js";
import { toast } from "../../components/common/toast.js";
import { setBusy } from "../../components/common/loading.js";
import { errorText } from "../../utils/validation.js";

let currentCourse = null;
let currentModules = [];
let activeLecture = null;

export async function mountCoursePlayer(container) {
  const hashParts = window.location.hash.split("?");
  const params = new URLSearchParams(hashParts[1] || "");
  const courseId = params.get("courseId");

  if (!courseId) {
    toast("No course specified to play.", "error");
    window.location.hash = "#/student/dashboard";
    return;
  }

  const courseTitleEl = $("#player-course-title", container);
  const courseCategoryEl = $("#player-course-category", container);
  const videoContainer = $("#player-video-container", container);
  const lectureTitleEl = $("#player-lecture-title", container);
  const lectureMetaEl = $("#player-lecture-meta", container);
  const transcriptBox = $("#player-transcript-box", container);
  const transcriptContent = $("#player-transcript-content", container);
  const btnComplete = $("#btn-complete-lecture", container);
  const curriculumTree = $("#player-curriculum-tree", container);
  const aiChatForm = $("#ai-chat-form", container);
  const aiChatMessages = $("#ai-chat-messages", container);

  function selectLecture(lecture, moduleTitle) {
    activeLecture = lecture;
    if (lectureTitleEl) lectureTitleEl.textContent = lecture.title;
    if (lectureMetaEl) lectureMetaEl.textContent = `${moduleTitle || "Module"} • ${lecture.durationSeconds ? Math.round(lecture.durationSeconds / 60) + " min" : "Lesson"}`;

    if (btnComplete) {
      btnComplete.disabled = false;
      btnComplete.textContent = "Mark as Completed ✓";
    }

    if (lecture.transcript) {
      if (transcriptBox) transcriptBox.style.display = "block";
      if (transcriptContent) transcriptContent.textContent = lecture.transcript;
    } else {
      if (transcriptBox) transcriptBox.style.display = "none";
    }

    if (videoContainer) {
      if (lecture.videoUrl && (lecture.videoUrl.includes("youtube.com") || lecture.videoUrl.includes("youtu.be"))) {
        let embedUrl = lecture.videoUrl;
        const ytMatch = lecture.videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
        if (ytMatch && ytMatch[1]) {
          embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
        }
        videoContainer.innerHTML = `<iframe src="${embedUrl}" style="width:100%; height:100%; border:0;" allowfullscreen></iframe>`;
      } else if (lecture.videoUrl) {
        videoContainer.innerHTML = `<video controls src="${escapeHtml(lecture.videoUrl)}" style="width:100%; height:100%;"></video>`;
      } else {
        videoContainer.innerHTML = `
          <div style="text-align:center; padding:2rem;">
            <p style="font-size:1.1rem; margin-bottom:0.5rem; color:var(--ink);">📖 Text / Reading Lesson</p>
            <p style="color:var(--muted); font-size:0.9rem;">Review the lesson notes and transcript below.</p>
          </div>
        `;
      }
    }

    container.querySelectorAll(".curriculum-lecture-item").forEach((item) => {
      item.classList.toggle("is-active-lecture", item.dataset.lectureId === lecture._id);
    });
  }

  function renderCurriculum() {
    if (!curriculumTree) return;
    if (!currentModules.length) {
      curriculumTree.innerHTML = '<p style="color:var(--muted); font-size:0.85rem;">No modules added to this course yet.</p>';
      return;
    }

    curriculumTree.innerHTML = currentModules
      .map((mod, modIdx) => {
        const lecturesHtml = (mod.lectures || [])
          .map((lec, lecIdx) => {
            const isSelected = activeLecture?._id === lec._id;
            return `
              <div class="curriculum-lecture-item ${isSelected ? "is-active-lecture" : ""}" data-lecture-id="${lec._id}" data-mod-idx="${modIdx}" data-lec-idx="${lecIdx}" style="padding:0.6rem 0.75rem; border-radius:0.4rem; background:var(--surface-2); cursor:pointer; display:flex; justify-content:space-between; align-items:center; transition:background 0.2s;">
                <span style="font-size:0.9rem;">▶ ${lecIdx + 1}. ${escapeHtml(lec.title)}</span>
                <small style="color:var(--muted);">${lec.durationSeconds ? Math.round(lec.durationSeconds / 60) + "m" : ""}</small>
              </div>
            `;
          })
          .join("");

        return `
          <div class="curriculum-module-group" style="border:1px solid var(--line); border-radius:0.5rem; padding:0.75rem;">
            <strong style="display:block; font-size:0.95rem; margin-bottom:0.5rem; color:var(--violet-light);">Module ${mod.orderIndex || modIdx + 1}: ${escapeHtml(mod.title)}</strong>
            <div style="display:flex; flex-direction:column; gap:0.4rem;">
              ${lecturesHtml || '<small style="color:var(--muted);">No lectures yet</small>'}
            </div>
          </div>
        `;
      })
      .join("");
  }

  try {
    const [courseRes, modRes] = await Promise.all([
      courseService.getCourseById(courseId),
      courseService.listModules(courseId)
    ]);

    currentCourse = courseRes?.data?.course || null;
    currentModules = modRes?.data?.modules || [];

    if (courseTitleEl && currentCourse) courseTitleEl.textContent = currentCourse.title;
    if (courseCategoryEl && currentCourse) courseCategoryEl.textContent = (currentCourse.category || "COURSE").toUpperCase();

    renderCurriculum();

    // Select first lecture by default
    if (currentModules[0]?.lectures?.[0]) {
      selectLecture(currentModules[0].lectures[0], currentModules[0].title);
    }
  } catch (error) {
    toast(`Failed to load course: ${errorText(error)}`, "error");
  }

  curriculumTree?.addEventListener("click", (e) => {
    const item = e.target.closest("[data-lecture-id]");
    if (!item) return;
    const modIdx = Number(item.dataset.modIdx);
    const lecIdx = Number(item.dataset.lecIdx);
    const mod = currentModules[modIdx];
    const lec = mod?.lectures?.[lecIdx];
    if (lec) selectLecture(lec, mod.title);
  });

  btnComplete?.addEventListener("click", async () => {
    if (!activeLecture) return;
    setBusy(btnComplete, true, "Saving…");
    try {
      await enrollmentService.updateProgress(activeLecture._id, { isCompleted: true });
      toast("Lecture marked as completed! Keep going!");
      btnComplete.textContent = "Completed ✓";
      btnComplete.disabled = true;
    } catch (error) {
      toast(errorText(error), "error");
      setBusy(btnComplete, false);
    }
  });

  aiChatForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = aiChatForm.querySelector("input[name='message']");
    const userMsg = input?.value?.trim();
    if (!userMsg) return;

    const userBubble = document.createElement("div");
    userBubble.style.cssText = "background:var(--violet); color:#fff; align-self:flex-end; padding:0.6rem 0.85rem; border-radius:0.5rem; max-width:85%;";
    userBubble.textContent = userMsg;
    aiChatMessages?.appendChild(userBubble);
    input.value = "";
    if (aiChatMessages) aiChatMessages.scrollTop = aiChatMessages.scrollHeight;

    const loadingBubble = document.createElement("div");
    loadingBubble.style.cssText = "background:var(--line); padding:0.6rem 0.85rem; border-radius:0.5rem; max-width:85%;";
    loadingBubble.textContent = "Thinking…";
    aiChatMessages?.appendChild(loadingBubble);
    if (aiChatMessages) aiChatMessages.scrollTop = aiChatMessages.scrollHeight;

    try {
      const response = await aiService.sendChatMessage(courseId, userMsg);
      const reply = response?.data?.reply || response?.data?.message || "I am here to help!";
      loadingBubble.textContent = reply;
    } catch {
      loadingBubble.textContent = "I'm having trouble connecting to AI tutor services at the moment. Please try again soon.";
    }
    if (aiChatMessages) aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
  });
}
