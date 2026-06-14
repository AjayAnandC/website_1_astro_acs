const storageKey = "astrologyAppData";
const defaultData = {
  profile: null,
  appointments: [],
  subscription: null,
};

const state = loadState();

const profileForm = document.getElementById("profileForm");
const openSignup = document.getElementById("openSignup");
const openLogin = document.getElementById("openLogin");
const loadProfile = document.getElementById("loadProfile");
const profileInfo = document.getElementById("profileInfo");
const appointmentForm = document.getElementById("appointmentForm");
const appointmentsList = document.getElementById("appointmentsList");
const reportContent = document.getElementById("reportContent");
const planButtons = document.querySelectorAll(".plan-select");
const messageToast = document.getElementById("messageToast");

profileForm.addEventListener("submit", handleProfileSave);
loadProfile.addEventListener("click", renderProfileInfo);
appointmentForm.addEventListener("submit", handleAppointmentBooking);
planButtons.forEach((button) => button.addEventListener("click", handlePlanSelect));
openSignup.addEventListener("click", () => scrollToSection("profile"));
openLogin.addEventListener("click", () => scrollToSection("profile"));

document.addEventListener("DOMContentLoaded", () => {
  renderProfileInfo();
  renderAppointments();
  renderReport();
});

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || JSON.parse(JSON.stringify(defaultData));
  } catch {
    return JSON.parse(JSON.stringify(defaultData));
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function handleProfileSave(event) {
  event.preventDefault();
  const name = document.getElementById("profileName").value.trim();
  const email = document.getElementById("profileEmail").value.trim().toLowerCase();
  const birthdate = document.getElementById("profileBirthdate").value;
  const zodiac = document.getElementById("profileZodiac").value.trim();
  const birthtime = document.getElementById("profileBirthtime").value;

  if (!name || !email || !birthdate || !zodiac) {
    showToast("Please fill in all required profile fields.");
    return;
  }

  state.profile = { name, email, birthdate, zodiac, birthtime, savedAt: new Date().toISOString() };
  saveState();
  renderProfileInfo();
  showToast("Profile saved successfully.");
}

function handleAppointmentBooking(event) {
  event.preventDefault();
  const name = document.getElementById("appointmentName").value.trim();
  const email = document.getElementById("appointmentEmail").value.trim().toLowerCase();
  const date = document.getElementById("appointmentDate").value;
  const time = document.getElementById("appointmentTime").value;
  const topic = document.getElementById("appointmentTopic").value;

  if (!name || !email || !date || !time) {
    showToast("Please complete all booking fields.");
    return;
  }

  state.appointments.unshift({
    id: crypto.randomUUID(),
    name,
    email,
    date,
    time,
    topic,
    createdAt: new Date().toISOString(),
  });
  saveState();
  appointmentForm.reset();
  renderAppointments();
  showToast("Appointment booked successfully.");
}

function handlePlanSelect(event) {
  const plan = event.currentTarget.dataset.plan;
  state.subscription = { plan, selectedAt: new Date().toISOString() };
  saveState();
  renderReport();
  showToast(`${capitalize(plan)} subscription activated.`);
}

function renderProfileInfo() {
  if (!state.profile) {
    profileInfo.innerHTML = `<p>No profile loaded yet. Create a profile above to view your dashboard.</p>`;
    return;
  }

  profileInfo.innerHTML = `
    <div class="dashboard-item">
      <strong>Name:</strong> ${escapeHtml(state.profile.name)}
    </div>
    <div class="dashboard-item">
      <strong>Email:</strong> ${escapeHtml(state.profile.email)}
    </div>
    <div class="dashboard-item">
      <strong>Zodiac:</strong> ${escapeHtml(state.profile.zodiac)}
    </div>
    <div class="dashboard-item">
      <strong>Birth date:</strong> ${escapeHtml(state.profile.birthdate)}
    </div>
    <div class="dashboard-item">
      <strong>Subscription:</strong> ${state.subscription ? capitalize(state.subscription.plan) : "None"}
    </div>
    <div class="dashboard-item">
      <strong>Saved:</strong> ${new Date(state.profile.savedAt).toLocaleString()}</div>
  `;
}

function renderAppointments() {
  if (!state.appointments.length) {
    appointmentsList.innerHTML = `<li>No appointments booked yet.</li>`;
    return;
  }

  appointmentsList.innerHTML = state.appointments
    .slice(0, 5)
    .map((appointment) => {
      return `<li><strong>${escapeHtml(appointment.name)}</strong> — ${formatDate(appointment.date)} at ${appointment.time} <span>${escapeHtml(appointment.topic)}</span></li>`;
    })
    .join("");
}

function renderReport() {
  const subscription = state.subscription;

  if (!subscription) {
    reportContent.innerHTML = `<p>No subscription selected yet. Choose Daily, Weekly, or Monthly to receive your horoscope report.</p>`;
    return;
  }

  const profile = state.profile;
  if (!profile) {
    reportContent.innerHTML = `<p>Create your profile to personalize report recommendations.</p>`;
    return;
  }

  reportContent.innerHTML = `
    <h4>${capitalize(subscription.plan)} astrology report</h4>
    <p>${generateReportText(subscription.plan, profile)}</p>
    <p class="muted">Based on your sign <strong>${escapeHtml(profile.zodiac)}</strong> and your chosen plan.</p>
  `;
}

function generateReportText(plan, profile) {
  const base = `Hello ${profile.name}, your ${profile.zodiac} energy is ready to guide you.`;
  const insights = {
    daily: `Today is a great day to trust your intuition and stay present. Watch for small opportunities in relationships and self-care.`,
    weekly: `This week invites balance between work and personal growth. Focus on meaningful conversations and clear intentions.`,
    monthly: `This month brings momentum for long-term change. Set goals, review your values, and move forward with confidence.`,
  };

  const custom = getCustomMessage(profile.zodiac, plan);
  return `${base} ${insights[plan]} ${custom}`;
}

function getCustomMessage(zodiac, plan) {
  const seed = zodiac.toLowerCase();
  const messages = {
    aries: {
      daily: `Trust your leadership instincts, but also let others share the spotlight.`,
      weekly: `Bold action brings progress, especially when you stay patient with timing.`,
      monthly: `Your bold vision is strong this month — build momentum and nurture your energy reserves.`,
    },
    taurus: {
      daily: `Comfort and stability are available when you remain rooted in your values.`,
      weekly: `Slow, steady progress rewards your patience and attention to detail.`,
      monthly: `Focus on what feels grounded and sustainable; your steady choices create resilience.`,
    },
    gemini: {
      daily: `Curiosity will be your strength today — listen closely and ask more questions.`,
      weekly: `Communication flows best when you balance ideas with careful listening.`,
      monthly: `Your adaptability opens opportunities; choose clarity over distraction.`,
    },
    cancer: {
      daily: `Emotional wisdom brings calm; honor your boundaries and practice self-care.`,
      weekly: `Allow yourself to receive support from trusted people around you.`,
      monthly: `Deep feelings guide you this month — nurture your home and personal dreams.`,
    },
  };

  const defaultMessages = {
    daily: `You may find meaningful energy in little rituals and thoughtful pauses.`,
    weekly: `This is a strong week for setting clear routines and honoring your pace.`,
    monthly: `A new cycle encourages you to reflect on growth and align with your inner purpose.`,
  };

  return messages[seed]?.[plan] || defaultMessages[plan];
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return value;
  }
}

function showToast(message) {
  messageToast.textContent = message;
  messageToast.classList.add("active");
  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(() => {
    messageToast.classList.remove("active");
  }, 2800);
}

function scrollToSection(id) {
  const section = document.getElementById(id);
  if (!section) return;
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return char;
    }
  });
}
