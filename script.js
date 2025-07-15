// --- GLOBAL STATE & INITIALIZATION ---
let testPapers = [];
let currentTest = null;
let editingTest = null; // For the edit modal
let currentQuestionIndex = 0;
let userAnswers = [];
let testTimer = null;
let confirmCallback = null;

document.addEventListener("DOMContentLoaded", function () {
    loadTestPapers();
    showSection("dashboard");
});

// --- DATA PERSISTENCE (LOCALSTORAGE) ---
function saveTestPapers() {
    localStorage.setItem("jeeTestPapers", JSON.stringify(testPapers));
    // Refresh relevant views
    updateDashboard();
    displayTestPapers();
    displayAvailableTests();
}

function loadTestPapers() {
    const savedTests = localStorage.getItem("jeeTestPapers");
    if (savedTests) {
        testPapers = JSON.parse(savedTests);
    } else {
        // Initialize with an empty array if nothing is saved
        testPapers = [];
    }
}

// --- NAVIGATION & UI RENDERING ---
function showSection(sectionId) {
    document
        .querySelectorAll(".section")
        .forEach((s) => s.classList.remove("active"));
    document.getElementById(sectionId).classList.add("active");

    document.querySelectorAll(".nav-btn").forEach((btn) => {
        btn.classList.remove("active");
        if (btn.getAttribute("onclick").includes(sectionId)) {
            btn.classList.add("active");
        }
    });

    // Refresh data for the shown section
    if (sectionId === "dashboard") updateDashboard();
    if (sectionId === "manage-tests") displayTestPapers();
    if (sectionId === "take-test") displayAvailableTests();
}

function showMessage(message, type) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    const mainContent = document.querySelector(".main-content");
    mainContent.insertBefore(messageDiv, mainContent.firstChild);
    setTimeout(() => messageDiv.remove(), 4000);
}

// --- MANAGE & EDIT TESTS ---
function displayTestPapers() {
    const list = document.getElementById("test-list");
    if (testPapers.length === 0) {
        list.innerHTML =
            '<p style="text-align: center; padding: 40px;">No test papers found. Create one!</p>';
        return;
    }
    list.innerHTML = testPapers
        .map(
            (test) => `
                <div class="test-paper-item">
                    <div class="test-info">
                        <div class="test-title">${test.title}</div>
                        <div class="test-meta">${test.subject} • ${test.questions.length} questions • ${test.duration} min</div>
                    </div>
                    <div class="test-actions" style="display: flex; gap: 8px;">
                        <button class="btn btn-sm btn-secondary" onclick="exportTestPaper(${test.id})">Export</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteTest(${test.id})">Delete</button>
                    </div>
                </div>
            `
        )
        .join("");
}

function deleteTest(testId) {
    showConfirmModal(
        "Are you sure you want to delete this test paper? This action cannot be undone.",
        () => {
            testPapers = testPapers.filter((t) => t.id !== testId);
            saveTestPapers();
            showMessage("Test paper deleted.", "success");
        }
    );
}

// --- TAKE TEST ---
function displayAvailableTests() {
    const container = document.getElementById("available-tests");
    const available = testPapers.filter((t) => t.questions.length > 0);
    if (available.length === 0) {
        container.innerHTML =
            '<p style="text-align: center; padding: 40px;">No tests with questions are available.</p>';
        return;
    }
    container.innerHTML = available
        .map(
            (test) => `
                <div class="test-paper-item">
                    <div class="test-info">
                        <div class="test-title">${test.title}</div>
                        <div class="test-meta">${test.subject} • ${test.questions.length} questions • ${test.duration} min</div>
                    </div>
                    <button class="btn btn-sm" onclick="startTest(${test.id})">Start Test</button>
                </div>
            `
        )
        .join("");
}

function startTest(testId) {
    currentTest = testPapers.find((t) => t.id === testId);
    currentQuestionIndex = 0;
    userAnswers = new Array(currentTest.questions.length).fill(null);
    document.getElementById("test-selection").style.display = "none";
    document.getElementById("test-results").style.display = "none";
    document.getElementById("test-interface").style.display = "block";
    displayQuestion();
}

function displayQuestion() {
    const question = currentTest.questions[currentQuestionIndex];
    const container = document.getElementById("test-interface");
    container.innerHTML = `
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">${currentTest.title}</h3>
                        <div class="question-counter">Question ${
                            currentQuestionIndex + 1
                        } of ${currentTest.questions.length}</div>
                    </div>
                    <div id="question-display">
                        <h4 style="font-size: 18px; margin-bottom: 16px; line-height: 1.5;">${
                            question.text
                        }</h4>
                        <div class="option-group">
                            ${question.options
                                .map(
                                    (option, index) => `
                                <div class="option-input ${
                                    userAnswers[currentQuestionIndex] === index
                                        ? "selected"
                                        : ""
                                }" onclick="selectAnswer(${index})">
                                    <input type="radio" name="test-answer" value="${index}" ${
                                        userAnswers[currentQuestionIndex] ===
                                        index
                                            ? "checked"
                                            : ""
                                    }>
                                    <span style="flex: 1;">${String.fromCharCode(
                                        65 + index
                                    )}. ${option}</span>
                                </div>
                            `
                                )
                                .join("")}
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 20px;">
                        <button class="btn btn-secondary" onclick="previousQuestion()" ${
                            currentQuestionIndex === 0 ? "disabled" : ""
                        }>Previous</button>
                        <button class="btn" onclick="nextQuestion()">${
                            currentQuestionIndex ===
                            currentTest.questions.length - 1
                                ? "Finish Test"
                                : "Next"
                        }</button>
                    </div>
                </div>
            `;
}

function selectAnswer(answerIndex) {
    userAnswers[currentQuestionIndex] = answerIndex;
    displayQuestion();
}

function nextQuestion() {
    if (currentQuestionIndex < currentTest.questions.length - 1) {
        currentQuestionIndex++;
        displayQuestion();
    } else {
        finishTestAttempt();
    }
}

function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        displayQuestion();
    }
}

function finishTestAttempt() {
    let correctCount = 0;
    userAnswers.forEach((answer, index) => {
        if (answer === currentTest.questions[index].correctAnswer) {
            correctCount++;
        }
    });
    const score =
        currentTest.questions.length > 0
            ? Math.round((correctCount / currentTest.questions.length) * 100)
            : 0;

    document.getElementById("test-interface").style.display = "none";
    document.getElementById("test-results").style.display = "block";
    document.getElementById("test-results").innerHTML = `
                <div class="card" style="text-align: center;">
                    <h3 class="card-title">🎉 Test Completed!</h3>
                    <div style="font-size: 48px; font-weight: 700; color: var(--primary-start); margin: 20px 0;">${score}%</div>
                    <p style="font-size: 18px;">You answered ${correctCount} out of ${currentTest.questions.length} questions correctly.</p>
                    <button class="btn" style="margin-top: 30px;" onclick="resetTest()">Take Another Test</button>
                </div>
            `;
}

function resetTest() {
    currentTest = null;
    document.getElementById("test-results").style.display = "none";
    document.getElementById("test-selection").style.display = "block";
    displayAvailableTests();
}

// --- DASHBOARD ---
function updateDashboard() {
    const totalTests = testPapers.length;
    const totalQuestions = testPapers.reduce(
        (sum, test) => sum + test.questions.length,
        0
    );
    const subjects = new Set(testPapers.map((test) => test.subject));

    document.getElementById("total-tests").textContent = totalTests;
    document.getElementById("total-questions").textContent = totalQuestions;
    document.getElementById("subjects-count").textContent = subjects.size;

    const recentActivity = document.getElementById("recent-activity");
    if (testPapers.length === 0) {
        recentActivity.innerHTML =
            '<p style="color: #666; text-align: center; padding: 20px;">No recent activity yet. Create your first test paper!</p>';
    } else {
        const recentTests = [...testPapers]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 3);
        let activityHtml = "";

        recentTests.forEach((test) => {
            activityHtml += `
                        <div style="padding: 12px; margin-bottom: 8px; margin-top: 8px; background: var(--light-gray); border-radius: 8px; border-left: 4px solid var(--primary-start);">
                            <div style="font-weight: 600; margin-bottom: 4px;">${
                                test.title
                            }</div>
                            <div style="font-size: 14px; color: #666;">
                                ${test.subject} • ${
                test.questions.length
            } questions • Created: ${new Date(
                test.createdAt
            ).toLocaleDateString()}
                            </div>
                        </div>
                    `;
        });

        recentActivity.innerHTML = activityHtml;
    }
}

// --- MODALS ---
function showConfirmModal(message, callback) {
    document.getElementById("confirm-modal-text").textContent = message;
    confirmCallback = callback;
    document.getElementById("confirm-modal").style.display = "flex";
}

function closeConfirmModal() {
    confirmCallback = null;
    document.getElementById("confirm-modal").style.display = "none";
}

function executeConfirm() {
    if (confirmCallback) {
        confirmCallback();
    }
    closeConfirmModal();
}

// --- IMPORT / EXPORT ---
function exportTestPaper(testId) {
    const test = testPapers.find((t) => t.id === testId);
    const dataStr = JSON.stringify(test, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${test.title.replace(/ /g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importTestPaper(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (!imported.id || !imported.title || !imported.questions) {
                throw new Error("Invalid test paper format.");
            }
            if (testPapers.some((t) => t.id === imported.id)) {
                showMessage("A test with this ID already exists.", "error");
                return;
            }
            testPapers.push(imported);
            saveTestPapers();
            showMessage("Test paper imported successfully!", "success");
        } catch (error) {
            showMessage(`Import failed: ${error.message}`, "error");
        }
    };
    reader.readAsText(file);
    event.target.value = ""; // Reset file input
}
