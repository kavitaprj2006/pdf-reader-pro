// ✅ LOGIN CHECK
if (!localStorage.getItem("loggedIn")) {
  window.location.href = "login.html";
}

// Global Variables
let pdfDoc = null;
let pageNum = 1;
let canvas = document.getElementById("pdfRenderer");
let ctx = canvas.getContext("2d");
let currentSpeechText = "";
let speechStartTime = 0;
let speechPaused = false;
let currentUtterance = null;
let speechSpeed = 1.0;

// Initialize speed control
document.getElementById("speedControl").addEventListener("input", function(e) {
  speechSpeed = parseFloat(e.target.value);
  document.getElementById("speedValue").textContent = speechSpeed + "x";
  if (currentUtterance) {
    currentUtterance.rate = speechSpeed;
  }
});

// ✅ PDF LOADER
document.getElementById("fileInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  if (file.type !== "application/pdf") {
    alert("Please upload a PDF file");
    return;
  }

  // Show file info
  const fileInfo = document.getElementById("fileInfo");
  fileInfo.innerHTML = `
    <i class="fas fa-file-pdf"></i> 
    ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)
  `;

  const fileReader = new FileReader();
  fileReader.onload = function () {
    const typedArray = new Uint8Array(this.result);
    pdfjsLib.getDocument(typedArray).promise.then((pdf) => {
      pdfDoc = pdf;
      pageNum = 1;
      renderPage(pageNum);
    }).catch(error => {
      console.error("Error loading PDF:", error);
      alert("Error loading PDF file. Please try another file.");
    });
  };
  fileReader.readAsArrayBuffer(file);
});

// ✅ PDF RENDERING
function renderPage(num) {
  if (!pdfDoc) return;
  
  pdfDoc.getPage(num).then((page) => {
    const viewport = page.getViewport({ scale: 1.5 });
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };
    
    page.render(renderContext);
    document.getElementById("pageInfo").textContent = 
      `Page ${num} of ${pdfDoc.numPages}`;
  }).catch(error => {
    console.error("Error rendering page:", error);
  });
}

function prevPage() {
  if (pageNum <= 1) return;
  pageNum--;
  renderPage(pageNum);
}

function nextPage() {
  if (pageNum >= pdfDoc.numPages) return;
  pageNum++;
  renderPage(pageNum);
}

// ✅ TEXT EXTRACTION FROM PDF
async function extractCurrentPageText() {
  if (!pdfDoc) {
    alert("Please upload a PDF first!");
    return;
  }
  
  try {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item) => item.str).join(" ");
    
    if (text.trim()) {
      document.getElementById("textInput").value = text;
      // Show success message briefly
      showNotification("Text extracted successfully!", "success");
    } else {
      showNotification("No text found on this page.", "warning");
    }
  } catch (error) {
    console.error("Error extracting text:", error);
    showNotification("Error extracting text from PDF.", "error");
  }
}

// ✅ SPEECH FUNCTIONS
function getVoiceForLang(langCode) {
  const voices = speechSynthesis.getVoices();
  let voice = voices.find(v => v.lang.toLowerCase().startsWith(langCode.toLowerCase()));
  return voice || voices[0];
}

function speakText(text, lang = "en") {
  if (!text) {
    showNotification("No text to speak.", "warning");
    return;
  }
  
  speechSynthesis.cancel(); // Stop previous speech
  
  currentUtterance = new SpeechSynthesisUtterance(text);
  currentUtterance.lang = lang;
  currentUtterance.rate = speechSpeed;
  const voice = getVoiceForLang(lang);
  if (voice) currentUtterance.voice = voice;
  
  currentSpeechText = text;
  speechStartTime = Date.now();
  speechPaused = false;
  
  // Update pause/resume button
  updatePauseResumeButton();
  
  currentUtterance.onend = () => {
    currentUtterance = null;
    updatePauseResumeButton();
  };
  
  currentUtterance.onerror = (event) => {
    console.error("Speech error:", event.error);
    showNotification("Speech error occurred.", "error");
  };
  
  speechSynthesis.speak(currentUtterance);
}

async function speakOriginal() {
  if (!pdfDoc) {
    alert("Upload a PDF first!");
    return;
  }
  
  try {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((s) => s.str).join(" ");
    
    if (text.trim()) {
      speakText(text, "en");
    } else {
      showNotification("No text found on this page to read.", "warning");
    }
  } catch (error) {
    console.error("Error reading PDF text:", error);
    showNotification("Error reading PDF text.", "error");
  }
}

// ✅ AUDIO CONTROLS
function pauseResumeSpeech() {
  if (speechSynthesis.speaking && !speechSynthesis.paused) {
    speechSynthesis.pause();
    speechPaused = true;
  } else if (speechSynthesis.paused) {
    speechSynthesis.resume();
    speechPaused = false;
  }
  updatePauseResumeButton();
}

function stopSpeech() {
  speechSynthesis.cancel();
  currentUtterance = null;
  speechPaused = false;
  updatePauseResumeButton();
}

function updatePauseResumeButton() {
  const btn = document.getElementById("pauseResumeBtn");
  if (speechSynthesis.speaking && !speechSynthesis.paused) {
    btn.innerHTML = '<i class="fas fa-pause"></i> Pause';
  } else if (speechSynthesis.paused) {
    btn.innerHTML = '<i class="fas fa-play"></i> Resume';
  } else {
    btn.innerHTML = '<i class="fas fa-pause"></i> Pause';
  }
}

// Note: Real 10-second rewind/forward is complex with Web Speech API
// These functions provide alternative functionality
function rewind10() {
  if (currentUtterance && currentSpeechText) {
    // Stop current speech and restart from beginning
    // This is a limitation of Web Speech API - can't seek to specific positions
    speechSynthesis.cancel();
    setTimeout(() => {
      speakText(currentSpeechText, currentUtterance.lang);
    }, 100);
    showNotification("Restarted from beginning", "info");
  } else {
    showNotification("No active speech to rewind", "warning");
  }
}

function forward10() {
  if (currentUtterance) {
    // Increase speech rate temporarily for "fast forward" effect
    const originalRate = currentUtterance.rate;
    currentUtterance.rate = Math.min(originalRate + 0.5, 3.0);
    setTimeout(() => {
      if (currentUtterance) {
        currentUtterance.rate = originalRate;
      }
    }, 3000);
    showNotification("Increased speed temporarily", "info");
  } else {
    showNotification("No active speech to fast forward", "warning");
  }
}

// ✅ TRANSLATION FUNCTION
async function translateAndSpeak() {
  const text = document.getElementById("textInput").value.trim();
  const targetLang = document.getElementById("targetLang").value;

  if (!text) {
    showNotification("Please enter text to translate", "warning");
    return;
  }

  // Show loading state
  const translateBtn = document.querySelector(".translate-btn");
  const originalContent = translateBtn.innerHTML;
  translateBtn.innerHTML = '<span class="loading"></span> Translating...';
  translateBtn.disabled = true;

  try {
    // Split text into safe chunks for API
    const chunks = text.match(/.{1,450}(\s|$)/g) || [text];
    let translatedText = "";

    for (const chunk of chunks) {
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=en|${targetLang}`
      );
      
      if (!res.ok) throw new Error("Translation API error");
      
      const data = await res.json();
      if (data.responseStatus === 200) {
        translatedText += data.responseData.translatedText + " ";
      } else {
        throw new Error(data.responseDetails || "Translation failed");
      }
    }

    translatedText = translatedText.trim();
    document.getElementById("translationResult").innerText = translatedText;

    // Show action buttons
    const speakBtn = document.getElementById("speakTranslationBtn");
    const copyBtn = document.getElementById("copyTranslationBtn");
    
    speakBtn.style.display = "inline-flex";
    copyBtn.style.display = "inline-flex";
    
    speakBtn.onclick = () => {
      speakText(translatedText, targetLang);
    };

    showNotification("Translation completed successfully!", "success");
  } catch (error) {
    console.error("Translation error:", error);
    showNotification("Translation failed. Please try again.", "error");
    document.getElementById("translationResult").innerText = "Translation failed. Please try again.";
  } finally {
    // Restore button state
    translateBtn.innerHTML = originalContent;
    translateBtn.disabled = false;
  }
}

// ✅ COPY TRANSLATION FUNCTION
function copyTranslation() {
  const translationText = document.getElementById("translationResult").innerText;
  if (!translationText || translationText === "Translation failed. Please try again.") {
    showNotification("No translation to copy", "warning");
    return;
  }
  
  navigator.clipboard.writeText(translationText).then(() => {
    showNotification("Translation copied to clipboard!", "success");
  }).catch(err => {
    console.error("Copy failed:", err);
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = translationText;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
    showNotification("Translation copied to clipboard!", "success");
  });
}

// ✅ NOTIFICATION SYSTEM
function showNotification(message, type = "info") {
  // Remove existing notifications
  const existingNotification = document.querySelector(".notification");
  if (existingNotification) {
    existingNotification.remove();
  }
  
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <i class="fas fa-${getNotificationIcon(type)}"></i>
    <span>${message}</span>
  `;
  
  // Add styles
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${getNotificationColor(type)};
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 25px;
    box-shadow: 0 5px 20px rgba(0,0,0,0.2);
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
    animation: slideIn 0.3s ease;
    max-width: 300px;
    word-wrap: break-word;
  `;
  
  document.body.appendChild(notification);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    if (notification && notification.parentNode) {
      notification.style.animation = "slideOut 0.3s ease";
      setTimeout(() => {
        if (notification && notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }
  }, 3000);
}

function getNotificationIcon(type) {
  const icons = {
    success: "check-circle",
    error: "exclamation-circle",
    warning: "exclamation-triangle",
    info: "info-circle"
  };
  return icons[type] || "info-circle";
}

function getNotificationColor(type) {
  const colors = {
    success: "linear-gradient(45deg, #10ac84, #00d2d3)",
    error: "linear-gradient(45deg, #e74c3c, #c0392b)",
    warning: "linear-gradient(45deg, #f39c12, #e67e22)",
    info: "linear-gradient(45deg, #667eea, #764ba2)"
  };
  return colors[type] || colors.info;
}

// ✅ LOGOUT FUNCTION
function logout() {
  if (confirm("Are you sure you want to logout?")) {
    localStorage.removeItem("loggedIn");
    window.location.href = "login.html";
  }
}

// ✅ KEYBOARD SHORTCUTS
document.addEventListener("keydown", (e) => {
  // Only activate shortcuts when not typing in input fields
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") {
    return;
  }
  
  switch(e.key) {
    case "ArrowLeft":
      if (e.shiftKey) {
        prevPage();
        e.preventDefault();
      }
      break;
    case "ArrowRight":
      if (e.shiftKey) {
        nextPage();
        e.preventDefault();
      }
      break;
    case " ": // Spacebar
      if (e.ctrlKey) {
        pauseResumeSpeech();
        e.preventDefault();
      }
      break;
    case "s":
      if (e.ctrlKey) {
        stopSpeech();
        e.preventDefault();
      }
      break;
    case "e":
      if (e.ctrlKey && e.shiftKey) {
        extractCurrentPageText();
        e.preventDefault();
      }
      break;
  }
});

// ✅ VOICE LOADING
function loadVoices() {
  return new Promise((resolve) => {
    let voices = speechSynthesis.getVoices();
    if (voices.length) {
      resolve(voices);
      return;
    }
    
    const interval = setInterval(() => {
      voices = speechSynthesis.getVoices();
      if (voices.length) {
        clearInterval(interval);
        resolve(voices);
      }
    }, 100);
    
    // Timeout after 5 seconds
    setTimeout(() => {
      clearInterval(interval);
      resolve(speechSynthesis.getVoices());
    }, 5000);
  });
}

// ✅ RESPONSIVE CANVAS
function resizeCanvas() {
  if (pdfDoc && canvas) {
    renderPage(pageNum);
  }
}

window.addEventListener("resize", resizeCanvas);

// ✅ INITIALIZATION
document.addEventListener("DOMContentLoaded", () => {
  // Load voices
  loadVoices().then(() => {
    console.log("Voices loaded:", speechSynthesis.getVoices().length);
  });
  
  // Add CSS animations
  const style = document.createElement("style");
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
  
  // Show keyboard shortcuts info
  setTimeout(() => {
    showNotification("Tip: Use Shift+Arrow keys for page navigation!", "info");
  }, 2000);
});

// ✅ SERVICE WORKER REGISTRATION (for offline functionality)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

// ✅ ERROR HANDLING
window.addEventListener("error", (e) => {
  console.error("Global error:", e.error);
  showNotification("An error occurred. Please refresh the page.", "error");
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled promise rejection:", e.reason);
  showNotification("An error occurred. Please try again.", "error");
});

// ✅ PREVENT CONTEXT MENU ON CANVAS (OPTIONAL)
canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

// ✅ TOUCH GESTURES FOR MOBILE
let touchStartX = 0;
let touchEndX = 0;

canvas.addEventListener("touchstart", (e) => {
  touchStartX = e.changedTouches[0].screenX;
}, { passive: true });

canvas.addEventListener("touchend", (e) => {
  touchEndX = e.changedTouches[0].screenX;
  handleSwipe();
}, { passive: true });

function handleSwipe() {
  const swipeThreshold = 50;
  const diff = touchStartX - touchEndX;
  
  if (Math.abs(diff) > swipeThreshold) {
    if (diff > 0) {
      // Swipe left - next page
      nextPage();
    } else {
      // Swipe right - previous page  
      prevPage();
    }
  }
}