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
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");
const chatSendButton = document.getElementById("chatSendButton");
const chatWindow = document.getElementById("chatWindow");
const chatToggle = document.getElementById("chatToggle");
const chatClose = document.getElementById("chatClose");
const chatLoginButton = document.getElementById("chatLoginButton");
const chatLocked = document.getElementById("chatLocked");
const chatLauncherLock = document.getElementById("chatLauncherLock");
const chatStatusText = document.getElementById("chatStatusText");
const messageToast = document.getElementById("messageToast");
const authStatus = document.getElementById("authStatus");
const signInForm = document.getElementById("signInForm");
const signUpForm = document.getElementById("signUpForm");
const signOutButton = document.getElementById("signOutButton");

let auth = null;
let currentUser = null;
let chatHistory = [];
const apiBaseUrl = (window.ASTRO_API_BASE_URL || "").replace(/\/+$/, "");

profileForm.addEventListener("submit", handleProfileSave);
loadProfile.addEventListener("click", handleLoadProfile);
appointmentForm.addEventListener("submit", handleAppointmentBooking);
planButtons.forEach((button) => button.addEventListener("click", handlePlanSelect));
openSignup.addEventListener("click", () => scrollToSection("profile"));
openLogin.addEventListener("click", () => scrollToSection("profile"));
signInForm.addEventListener("submit", handleSignIn);
signUpForm.addEventListener("submit", handleSignUp);
signOutButton.addEventListener("click", handleSignOut);
chatForm.addEventListener("submit", handleChatSubmit);
chatToggle.addEventListener("click", toggleChatWindow);
chatClose.addEventListener("click", closeChatWindow);
chatLoginButton.addEventListener("click", () => {
  closeChatWindow();
  scrollToSection("profile");
  document.getElementById("signInEmail").focus({ preventScroll: true });
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !chatWindow.hidden) closeChatWindow();
});

document.addEventListener("DOMContentLoaded", () => {
  initFirebase();
  renderProfileInfo();
  renderAppointments();
  renderReport();
  updateAiAccess();
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
  const userChanged = currentUser?.uid !== user?.uid;
  currentUser = user;

  if (userChanged) {
    chatHistory = [];
    renderChatIntro();
  }

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
  updateAiAccess();
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

async function handlePlanSelect(event) {
  const button = event.currentTarget;
  const plan = button.dataset.plan;
  if (!currentUser) {
    showToast("Sign in before generating a personal reading.");
    scrollToSection("profile");
    return;
  }

  const profile = getProfileForCurrentUser();
  if (!profile?.zodiac) {
    showToast("Save a profile with your zodiac sign before generating a reading.");
    scrollToSection("profile");
    return;
  }

  button.disabled = true;
  reportContent.textContent = "Preparing your reading…";
  reportContent.classList.add("is-loading");

  try {
    const result = await requestAi("/api/ai/reports", {
      plan,
      zodiac: profile.zodiac,
    });
    if (typeof result.report !== "string" || !result.report.trim()) {
      throw new Error("The AI service returned an empty reading. Please try again.");
    }
    state.subscription = { plan, selectedAt: new Date().toISOString() };
    saveState();
    renderGeneratedReport(`${capitalize(plan)} reading`, result.report);
    renderProfileInfo();
  } catch (error) {
    reportContent.textContent = error.message;
    showToast(error.message);
  } finally {
    button.disabled = false;
    reportContent.classList.remove("is-loading");
  }
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
      <strong>Latest reading:</strong> ${state.subscription ? capitalize(state.subscription.plan) : "None"}
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
  reportContent.textContent = "Choose a reading above to receive a fresh reflection based on your zodiac sign.";
}

function handleLoadProfile() {
  if (!state.profile && !(isFirebaseEnabled && currentUser)) {
    showToast("No profile saved locally yet.");
    return;
  }

  if (isFirebaseEnabled && currentUser) {
    loadProfileFromFirestore(currentUser.uid)
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
      .catch((error) => {
        console.error("Firebase profile load error:", error);
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

async function loadProfileFromFirestore(uid) {
  if (!db || !uid) throw new Error("Firebase not configured");
  const doc = await db.collection("profiles").doc(uid).get();
  return doc.exists ? doc.data() : null;
}

function getProfileForCurrentUser() {
  if (!currentUser?.email || !state.profile?.email) return null;
  return state.profile.email.toLowerCase() === currentUser.email.toLowerCase()
    ? state.profile
    : null;
}

async function handleChatSubmit(event) {
  event.preventDefault();
  const message = chatInput.value.trim();
  if (!message) return;
  if (!currentUser) {
    showToast("Sign in before starting a conversation.");
    return;
  }

  const profile = getProfileForCurrentUser();
  const history = [...chatHistory];
  appendChatMessage("user", message);
  chatInput.value = "";
  chatInput.disabled = true;
  chatSendButton.disabled = true;
  chatMessages.setAttribute("aria-busy", "true");
  const pendingMessage = appendChatMessage("assistant", "Thinking…", "chat-pending");

  try {
    const result = await requestAi("/api/ai/chat", {
      message,
      history,
      ...(profile?.zodiac ? { zodiac: profile.zodiac } : {}),
    });
    if (typeof result.reply !== "string" || !result.reply.trim()) {
      throw new Error("The AI service returned an empty reply. Please try again.");
    }
    pendingMessage.textContent = result.reply;
    pendingMessage.classList.remove("chat-pending");
    chatHistory.push(
      { role: "user", content: message },
      { role: "assistant", content: result.reply },
    );
    chatHistory = chatHistory.slice(-12);
  } catch (error) {
    pendingMessage.textContent = error.message;
    pendingMessage.classList.remove("chat-pending");
    pendingMessage.classList.add("chat-error");
    showToast(error.message);
  } finally {
    chatInput.disabled = false;
    chatSendButton.disabled = false;
    chatMessages.setAttribute("aria-busy", "false");
    chatInput.focus();
  }
}

async function requestAi(path, payload) {
  if (!currentUser) throw new Error("Sign in before using AI features.");

  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await currentUser.getIdToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("AI request could not reach the backend:", error);
    throw new Error("Could not reach the AI service. Please try again.");
  }

  const body = await response.text();
  let result;
  try {
    result = JSON.parse(body);
  } catch (error) {
    console.error("AI backend returned an invalid response:", error);
    throw new Error("The AI service returned an unreadable response. Please try again.");
  }

  if (!response.ok) {
    throw new Error(result.detail || "AI generation failed. Please try again.");
  }
  return result;
}

function renderGeneratedReport(title, content) {
  reportContent.replaceChildren();
  const heading = document.createElement("h4");
  heading.textContent = title;
  const reading = document.createElement("p");
  reading.className = "generated-reading";
  reading.textContent = content;
  reportContent.append(heading, reading);
}

function renderChatIntro() {
  chatMessages.replaceChildren();
  const intro = document.createElement("p");
  intro.className = "chat-empty";
  intro.textContent = "Welcome. What would you like to explore today?";
  chatMessages.append(intro);
}

function appendChatMessage(role, content, extraClass = "") {
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${role === "user" ? "chat-user" : "chat-assistant"} ${extraClass}`.trim();
  bubble.setAttribute("aria-label", role === "user" ? "You" : "Astro ACS");
  bubble.textContent = content;
  chatMessages.append(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return bubble;
}

function updateAiAccess() {
  const signedIn = Boolean(currentUser);
  chatLocked.hidden = signedIn;
  chatMessages.hidden = !signedIn;
  chatForm.hidden = !signedIn;
  chatInput.disabled = !signedIn;
  chatSendButton.disabled = !signedIn;
  chatLauncherLock.hidden = signedIn;
  chatStatusText.textContent = signedIn
    ? "Your private space is ready"
    : "Sign in to begin a conversation";
  chatToggle.setAttribute("aria-label", signedIn ? "Open astrology chat" : "Open astrology chat — sign in required");
  chatInput.placeholder = signedIn
    ? "What’s on your mind?"
    : "Sign in to start a conversation";
  planButtons.forEach((button) => {
    button.disabled = !signedIn;
  });
}

function toggleChatWindow() {
  const shouldOpen = chatWindow.hidden;
  chatWindow.hidden = !shouldOpen;
  chatToggle.setAttribute("aria-expanded", String(shouldOpen));
  if (shouldOpen) {
    window.requestAnimationFrame(() => {
      (currentUser ? chatInput : chatLoginButton).focus({ preventScroll: true });
    });
  } else {
    chatToggle.focus({ preventScroll: true });
  }
}

function closeChatWindow() {
  chatWindow.hidden = true;
  chatToggle.setAttribute("aria-expanded", "false");
  chatToggle.focus({ preventScroll: true });
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
