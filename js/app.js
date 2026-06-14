const storageKey = "astrologyAppData";
const defaultData = {
  profile: null,
  appointments: [],
  subscription: null,
};

let db = null;
let isFirebaseEnabled = false;

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
const authStatus = document.getElementById("authStatus");
const signInForm = document.getElementById("signInForm");
const signUpForm = document.getElementById("signUpForm");
const signOutButton = document.getElementById("signOutButton");

let auth = null;
let currentUser = null;

profileForm.addEventListener("submit", handleProfileSave);
loadProfile.addEventListener("click", handleLoadProfile);
appointmentForm.addEventListener("submit", handleAppointmentBooking);
planButtons.forEach((button) => button.addEventListener("click", handlePlanSelect));
openSignup.addEventListener("click", () => scrollToSection("profile"));
openLogin.addEventListener("click", () => scrollToSection("profile"));
signInForm.addEventListener("submit", handleSignIn);
signUpForm.addEventListener("submit", handleSignUp);
signOutButton.addEventListener("click", handleSignOut);

document.addEventListener("DOMContentLoaded", () => {
  initFirebase();
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

function initFirebase() {
  try {
    if (typeof firebase !== "undefined" && firebase.firestore && firebase.auth) {
      db = firebase.firestore();
      auth = firebase.auth();
      isFirebaseEnabled = true;
      auth.onAuthStateChanged(handleAuthStateChanged);
      console.log("Firebase enabled");
    }
  } catch (error) {
    console.warn("Firebase initialization failed", error);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function handleAuthStateChanged(user) {
  currentUser = user;

  if (user) {
    authStatus.textContent = `Signed in as ${user.email || "anonymous"}`;
    authStatus.classList.add("signed-in");
    authStatus.classList.remove("signed-out");
    document.getElementById("profileEmail").value = user.email || "";
  } else {
    authStatus.textContent = "Not signed in.";
    authStatus.classList.add("signed-out");
    authStatus.classList.remove("signed-in");
  }
}

async function handleSignIn(event) {
  event.preventDefault();
  const email = document.getElementById("signInEmail").value.trim();
  const password = document.getElementById("signInPassword").value.trim();

  if (!email || !password) {
    showToast("Enter email and password to sign in.");
    return;
  }

  try {
    await auth.signInWithEmailAndPassword(email, password);
    showToast("Successfully signed in.");
  } catch (error) {
    showToast(`Sign in failed: ${error.message}`);
  }
}

async function handleSignUp(event) {
  event.preventDefault();
  const email = document.getElementById("signUpEmail").value.trim();
  const password = document.getElementById("signUpPassword").value.trim();

  if (!email || !password) {
    showToast("Enter email and password to create an account.");
    return;
  }

  try {
    await auth.createUserWithEmailAndPassword(email, password);
    showToast("Account created and signed in.");
  } catch (error) {
    showToast(`Sign up failed: ${error.message}`);
  }
}

async function handleSignOut() {
  if (!auth) return;
  await auth.signOut();
  showToast("Signed out.");
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

  if (isFirebaseEnabled && currentUser) {
    saveProfileToFirestore(currentUser.uid, state.profile).then(() => {
      showToast("Profile saved successfully and synced to Firebase.");
    }).catch((error) => {
      console.error("Firebase profile save error:", error);
      showToast("Profile saved locally, but Firebase sync failed.");
    });
  } else if (isFirebaseEnabled && !currentUser) {
    showToast("Please sign in before saving your profile.");
  } else {
    showToast("Profile saved successfully.");
  }

  renderProfileInfo();
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

  const appointment = {
    id: crypto.randomUUID(),
    name,
    email,
    date,
    time,
    topic,
    createdAt: new Date().toISOString(),
  };

  state.appointments.unshift(appointment);
  saveState();
  appointmentForm.reset();
  renderAppointments();

  if (isFirebaseEnabled && currentUser) {
    saveAppointmentToFirestore(appointment).then(() => {
      showToast("Appointment booked successfully and synced to Firebase.");
    }).catch((error) => {
      console.error("Firebase appointment save error:", error);
      showToast("Appointment booked locally, but Firebase sync failed.");
    });
  } else if (isFirebaseEnabled && !currentUser) {
    showToast("Please sign in before booking an appointment.");
  } else {
    showToast("Appointment booked successfully.");
  }
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

function handleLoadProfile() {
  if (!state.profile) {
    showToast("No profile saved locally yet.");
    return;
  }

  if (isFirebaseEnabled && state.profile.email) {
    loadProfileFromFirestore(state.profile.email)
      .then((profile) => {
        if (profile) {
          state.profile = profile;
          saveState();
          renderProfileInfo();
          showToast("Profile loaded from Firebase.");
        } else {
          showToast("No profile found in Firebase, showing local profile.");
        }
      })
      .catch(() => {
        showToast("Failed to load profile from Firebase.");
      });
  } else {
    renderProfileInfo();
    showToast("Loaded local profile.");
  }
}

async function saveProfileToFirestore(uid, profile) {
  if (!db || !uid) throw new Error("Firebase not configured");
  await db.collection("profiles").doc(uid).set(profile);
}

async function saveAppointmentToFirestore(appointment) {
  if (!db) throw new Error("Firebase not configured");
  await db.collection("appointments").add(appointment);
}

async function loadProfileFromFirestore(email) {
  if (!db || !email) throw new Error("Firebase not configured");
  const doc = await db.collection("profiles").doc(email).get();
  return doc.exists ? doc.data() : null;
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
