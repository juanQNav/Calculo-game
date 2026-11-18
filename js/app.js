/* app.js — Lógica del juego de Cálculo A.
 * Sin dependencias externas. Persistencia en localStorage con manejo seguro.
 */

(function (root) {
  "use strict";

  const STORAGE_KEY = "calculoA_progress";
  const content = root.CalculoContent;
  const curriculum = content.curriculum;
  const questions = content.questions;
  const formulas = content.formulas;
  const formulaFamilies = content.formulaFamilies;
  const formulaOrder = content.formulaOrder;

  // --- Utilidades ---
  function shuffle(array) {
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function pickQuestion(mode, recentIds) {
    const pool = questions.filter((q) => q.modes.includes(mode));
    const weighted = pool.map((q) => {
      const stats = state.progress[q.topic] || { total: 0, correct: 0 };
      const recentPenalty = recentIds.includes(q.id) ? 0.4 : 1;
      const mastery = stats.total > 0 ? stats.correct / stats.total : 0;
      const weight = (1 - mastery * 0.7) * recentPenalty;
      return { q, weight };
    });
    const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const item of weighted) {
      roll -= item.weight;
      if (roll <= 0) return item.q;
    }
    return weighted[weighted.length - 1]?.q || pool[0];
  }

  // --- Estado ---
  const defaultState = {
    version: 1,
    progress: {},
    skills: {
      recall: { correct: 0, total: 0 },
      methodSelection: { correct: 0, total: 0 },
      application: { correct: 0, total: 0 },
    },
  };

  let state = loadState();
  let session = { correct: 0, total: 0, streak: 0 };
  let recentIds = [];
  let currentQuestion = null;
  let detectiveState = null; // { stage, techniqueOptions, clueOptions }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(defaultState);
      const parsed = JSON.parse(raw);
      return normalizeState(parsed);
    } catch (err) {
      console.warn("No se pudo leer el progreso guardado:", err);
      return structuredClone(defaultState);
    }
  }

  function normalizeState(parsed) {
    if (!parsed || typeof parsed !== "object") return structuredClone(defaultState);
    const result = { ...structuredClone(defaultState), ...parsed };

    // Normalizar contadores de habilidades (protege contra campos parciales o NaN).
    result.skills = structuredClone(defaultState.skills);
    if (parsed.skills && typeof parsed.skills === "object") {
      Object.keys(defaultState.skills).forEach((key) => {
        const src = parsed.skills[key];
        result.skills[key] = {
          correct: Math.max(0, Number(src?.correct) || 0),
          total: Math.max(0, Number(src?.total) || 0),
        };
      });
    }

    // Normalizar progreso por tema.
    result.progress = {};
    if (parsed.progress && typeof parsed.progress === "object") {
      Object.entries(parsed.progress).forEach(([key, src]) => {
        result.progress[key] = {
          correct: Math.max(0, Number(src?.correct) || 0),
          total: Math.max(0, Number(src?.total) || 0),
          streak: Math.max(0, Number(src?.streak) || 0),
        };
      });
    }

    return result;
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn("No se pudo guardar el progreso:", err);
      showToast("No se pudo guardar el progreso localmente.");
    }
  }

  function resetState() {
    state = structuredClone(defaultState);
    saveState();
    session = { correct: 0, total: 0, streak: 0 };
    recentIds = [];
    renderProgress();
    showToast("Progreso reiniciado.");
  }

  // --- DOM refs ---
  const views = {
    home: document.getElementById("home-view"),
    formulario: document.getElementById("formulario-view"),
    game: document.getElementById("game-view"),
    progress: document.getElementById("progress-view"),
  };
  const tabDerivacion = document.getElementById("tab-derivacion");
  const tabIntegracion = document.getElementById("tab-integracion");
  const panelDerivacion = document.getElementById("panel-derivacion");
  const panelIntegracion = document.getElementById("panel-integracion");
  const derivFamilies = document.getElementById("deriv-families");
  const intFamilies = document.getElementById("int-families");
  const navButtons = document.querySelectorAll(".nav-btn");
  const modeCards = document.querySelectorAll(".mode-card");
  const modeTitle = document.getElementById("mode-title");
  const scoreDisplay = document.getElementById("score-display");
  const streakDisplay = document.getElementById("streak-display");
  const progressFill = document.getElementById("progress-fill");
  const topicPill = document.getElementById("topic-pill");
  const questionClue = document.getElementById("question-clue");
  const questionPrompt = document.getElementById("question-prompt");
  const answerForm = document.getElementById("answer-form");
  const optionsList = document.getElementById("options-list");
  const optionsLegend = document.getElementById("options-legend");
  const submitBtn = document.getElementById("submit-btn");
  const feedback = document.getElementById("feedback");
  const feedbackResult = document.getElementById("feedback-result");
  const feedbackExplanation = document.getElementById("feedback-explanation");
  const nextBtn = document.getElementById("next-btn");
  const progressGrid = document.getElementById("progress-grid");
  const resetProgressBtn = document.getElementById("reset-progress-btn");
  const toast = document.getElementById("toast");
  const flashcardControls = document.getElementById("flashcard-controls");
  const revealBtn = document.getElementById("reveal-btn");
  const recallActions = document.getElementById("recall-actions");
  const flashcardAnswer = document.getElementById("flashcard-answer");
  const flashcardExplanation = document.getElementById("flashcard-explanation");
  const rememberedBtn = document.getElementById("remembered-btn");
  const reviewBtn = document.getElementById("review-btn");

  // --- Navegación ---
  function setMode(mode) {
    const viewMap = {
      home: "home",
      formulario: "formulario",
      progreso: "progress",
      cartas: "game",
      detective: "game",
      aventura: "game",
    };
    Object.values(views).forEach((el) => el.classList.add("hidden"));
    views[viewMap[mode] || "game"].classList.remove("hidden");

    navButtons.forEach((btn) => {
      const active = btn.dataset.mode === mode;
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });

    if (mode === "progreso") {
      renderProgress();
      return;
    }

    if (mode === "formulario") {
      renderFormulario();
      selectFormulaTab("derivation");
      return;
    }

    if (mode === "home") {
      return;
    }

    modeTitle.textContent = modeLabel(mode);
    startQuestion(mode);
  }

  // --- Formulario ---
  let formularioRendered = false;

  function renderFormulaCard(formula) {
    const contextHtml = formula.context
      ? `<p class="formula-context">${formula.context}</p>`
      : "";
    const card = document.createElement("article");
    card.className = "formula-card";
    card.innerHTML = `
      <div class="formula-expr">${formula.formula}</div>
      <dl class="formula-meta">
        <div><dt>Qué</dt><dd>${formula.what}</dd></div>
        <div><dt>Por qué</dt><dd>${formula.why}</dd></div>
        <div><dt>Dónde/cuándo usarla</dt><dd>${formula.where}</dd></div>
        <div><dt>Tip</dt><dd>${formula.tip}</dd></div>
      </dl>
      <p class="formula-source">Fuentes: ${formula.sources
        .map((s) => `<span class="badge">${s}</span>`)
        .join(" ")}</p>
      ${contextHtml}
    `;
    return card;
  }

  function renderFamilyGroup(familyKey, items) {
    const info = formulaFamilies[familyKey];
    const details = document.createElement("details");
    details.className = "family-group";
    details.open = true;
    const summary = document.createElement("summary");
    summary.innerHTML = `<span>${info.label}</span><span class="count">${items.length}</span>`;
    details.appendChild(summary);
    const grid = document.createElement("div");
    grid.className = "formula-grid";
    items.forEach((f) => grid.appendChild(renderFormulaCard(f)));
    details.appendChild(grid);
    return details;
  }

  function renderFormulario() {
    if (formularioRendered) return;
    derivFamilies.innerHTML = "";
    intFamilies.innerHTML = "";

    const byFamily = {};
    formulas.forEach((f) => {
      byFamily[f.family] = byFamily[f.family] || [];
      byFamily[f.family].push(f);
    });

    formulaOrder.forEach((familyKey) => {
      const items = byFamily[familyKey];
      if (!items || items.length === 0) return;
      const branch = formulaFamilies[familyKey].branch;
      const group = renderFamilyGroup(familyKey, items);
      if (branch === "derivation") derivFamilies.appendChild(group);
      else intFamilies.appendChild(group);
    });

    formularioRendered = true;
  }

  function selectFormulaTab(branch) {
    const isDeriv = branch === "derivation";
    tabDerivacion.setAttribute("aria-selected", isDeriv ? "true" : "false");
    tabDerivacion.setAttribute("tabindex", isDeriv ? "0" : "-1");
    tabIntegracion.setAttribute("aria-selected", isDeriv ? "false" : "true");
    tabIntegracion.setAttribute("tabindex", isDeriv ? "-1" : "0");
    panelDerivacion.classList.toggle("hidden", !isDeriv);
    panelIntegracion.classList.toggle("hidden", isDeriv);
    const focusTarget = isDeriv ? tabDerivacion : tabIntegracion;
    if (typeof focusTarget.focus === "function") focusTarget.focus();
  }

  function modeLabel(mode) {
    return { cartas: "Cartas", detective: "Detective", aventura: "Aventura" }[mode] || mode;
  }

  // --- Juego ---
  function startQuestion(mode) {
    currentQuestion = pickQuestion(mode, recentIds);
    detectiveState = null;
    renderQuestion(mode);
    updateHud();
  }

  function renderQuestion(mode) {
    const q = currentQuestion;
    feedback.classList.add("hidden");
    feedback.classList.remove("correct", "wrong");

    if (mode === "cartas") {
      answerForm.classList.add("hidden");
      flashcardControls.classList.remove("hidden");
      topicPill.hidden = true;
      questionClue.hidden = true;
      resetFlashcard();
      questionPrompt.innerHTML = q.prompt;
      return;
    }

    answerForm.classList.remove("hidden");
    flashcardControls.classList.add("hidden");
    submitBtn.disabled = false;
    submitBtn.textContent = "Comprobar";

    if (mode === "aventura") {
      topicPill.hidden = true;
    } else {
      topicPill.hidden = false;
      const topic = curriculum.find((t) => t.key === q.topic);
      topicPill.textContent = topic ? topic.label : q.topic;
    }

    questionPrompt.innerHTML = q.prompt;

    if (mode === "detective") {
      renderDetectiveQuestion();
    } else {
      questionClue.hidden = true;
      renderOptions(q.options, "answer");
      optionsLegend.textContent = "Selecciona la respuesta";
    }
  }

  function resetFlashcard() {
    revealBtn.hidden = false;
    recallActions.classList.add("hidden");
    flashcardAnswer.innerHTML = "";
    flashcardExplanation.innerHTML = "";
    if (typeof revealBtn.focus === "function") {
      revealBtn.focus();
    }
  }

  function revealFlashcard() {
    revealBtn.hidden = true;
    recallActions.classList.remove("hidden");
    flashcardAnswer.innerHTML = currentQuestion.options[currentQuestion.correctIndex];
    flashcardExplanation.innerHTML = currentQuestion.explanation;
    if (typeof rememberedBtn.focus === "function") {
      rememberedBtn.focus();
    }
  }

  function handleRemembered() {
    recordResult(currentQuestion, true, "cartas");
    startQuestion("cartas");
  }

  function handleReview() {
    recordResult(currentQuestion, false, "cartas");
    startQuestion("cartas");
  }

  function renderDetectiveQuestion() {
    feedback.classList.add("hidden");
    feedback.classList.remove("correct", "wrong");
    submitBtn.disabled = false;
    submitBtn.textContent = "Comprobar";

    if (!detectiveState) {
      const { techniqueOptions, correctTechnique, clueOptions, correctClue } = content.getDetectiveOptions(currentQuestion);
      detectiveState = {
        stage: "technique",
        techniqueOptions,
        correctTechnique,
        clueOptions,
        correctClue,
        techniqueSelected: null,
        clueSelected: null,
      };
    }

    if (detectiveState.stage === "technique") {
      questionClue.hidden = true;
      optionsLegend.textContent = "Paso 1: ¿qué técnica aplica?";
      renderOptions(detectiveState.techniqueOptions, "technique");
    } else if (detectiveState.stage === "clue") {
      questionClue.hidden = true;
      optionsLegend.textContent = "Paso 2: ¿cuál es la pista de reconocimiento?";
      renderOptions(detectiveState.clueOptions, "clue");
    } else {
      questionClue.hidden = false;
      optionsLegend.textContent = "Paso 3: resuelve";
      renderOptions(currentQuestion.options, "answer");
    }
  }

  function renderOptions(optionLabels, kind) {
    optionsList.innerHTML = "";
    optionLabels.forEach((label, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option-btn";
      btn.dataset.index = index;
      btn.dataset.kind = kind;
      btn.innerHTML = label;
      btn.addEventListener("click", () => selectOption(btn));
      optionsList.appendChild(btn);
    });
  }

  function selectOption(btn) {
    // Solo bloquear selección tras una respuesta final (submit deshabilitado).
    if (submitBtn.disabled) return;
    const kind = btn.dataset.kind;
    const buttons = optionsList.querySelectorAll(`[data-kind="${kind}"]`);
    buttons.forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    if (kind === "technique") detectiveState.techniqueSelected = Number(btn.dataset.index);
    if (kind === "clue") detectiveState.clueSelected = Number(btn.dataset.index);
  }

  function getSelectedIndex(kind) {
    const selected = optionsList.querySelector(`.option-btn.selected[data-kind="${kind}"]`);
    return selected ? Number(selected.dataset.index) : -1;
  }

  function clearStageSelection(kind) {
    optionsList.querySelectorAll(`[data-kind="${kind}"]`).forEach((b) => b.classList.remove("selected"));
    if (kind === "technique") detectiveState.techniqueSelected = null;
    if (kind === "clue") detectiveState.clueSelected = null;
  }

  function showStageFeedback(message) {
    feedback.classList.remove("hidden", "correct", "wrong");
    feedback.classList.add("wrong");
    feedbackResult.textContent = "Revisa";
    feedbackExplanation.innerHTML = message;
    // Oculta "Siguiente" para que el error de etapa sea reintentable.
    nextBtn.hidden = true;
  }

  function handleSubmit(event) {
    event.preventDefault();
    const mode = getCurrentMode();

    if (mode === "detective") {
      handleDetectiveSubmit();
      return;
    }

    const selected = getSelectedIndex("answer");
    if (selected === -1) {
      showToast("Elige una respuesta.");
      return;
    }

    const q = currentQuestion;
    const isCorrect = selected === q.correctIndex;
    recordResult(q, isCorrect, mode);
    showFeedback(isCorrect, q.explanation, q);
    markOptions(q.correctIndex, selected, "answer");
  }

  function handleDetectiveSubmit() {
    const ds = detectiveState;
    if (ds.stage === "technique") {
      const selected = getSelectedIndex("technique");
      if (selected === -1) return showToast("Elige una técnica.");
      const isCorrect = ds.techniqueOptions[selected] === ds.correctTechnique;
      if (!isCorrect) {
        clearStageSelection("technique");
        showStageFeedback("Esa técnica no encaja con el ejercicio. Revisa la forma del integrando e intenta de nuevo.");
        return;
      }
      state.skills.methodSelection.total += 1;
      state.skills.methodSelection.correct += 1;
      saveState();
      ds.stage = "clue";
      showToast("¡Técnica correcta! Ahora elige la pista.");
      renderDetectiveQuestion();
      return;
    }

    if (ds.stage === "clue") {
      const selected = getSelectedIndex("clue");
      if (selected === -1) return showToast("Elige una pista.");
      const isCorrect = ds.clueOptions[selected] === ds.correctClue;
      if (!isCorrect) {
        clearStageSelection("clue");
        showStageFeedback("Esa pista no describe este ejercicio. Lee de nuevo el enunciado e intenta de nuevo.");
        return;
      }
      ds.stage = "answer";
      questionClue.textContent = ds.correctClue;
      questionClue.hidden = false;
      showToast("¡Pista correcta! Resuelve ahora.");
      renderDetectiveQuestion();
      return;
    }

    const selected = getSelectedIndex("answer");
    if (selected === -1) return showToast("Elige la respuesta.");
    const q = currentQuestion;
    const isCorrect = selected === q.correctIndex;
    recordResult(q, isCorrect, "detective");
    showFeedback(isCorrect, q.explanation, q);
    markOptions(q.correctIndex, selected, "answer");
  }

  function getCurrentMode() {
    const active = document.querySelector('.nav-btn[aria-pressed="true"]');
    return active ? active.dataset.mode : "home";
  }

  function markOptions(correctIndex, selectedIndex, kind) {
    const buttons = optionsList.querySelectorAll(`[data-kind="${kind}"]`);
    buttons.forEach((btn) => {
      btn.disabled = true;
      const idx = Number(btn.dataset.index);
      if (idx === correctIndex) btn.classList.add("correct");
      if (idx === selectedIndex && idx !== correctIndex) btn.classList.add("wrong");
    });
  }

  function recordResult(q, isCorrect, mode) {
    if (!state.progress[q.topic]) {
      state.progress[q.topic] = { correct: 0, total: 0, streak: 0 };
    }
    const topicStats = state.progress[q.topic];
    topicStats.total += 1;
    if (isCorrect) {
      topicStats.correct += 1;
      topicStats.streak += 1;
    } else {
      topicStats.streak = 0;
    }

    if (mode === "cartas") {
      state.skills.recall.total += 1;
      if (isCorrect) state.skills.recall.correct += 1;
    } else {
      state.skills.application.total += 1;
      if (isCorrect) state.skills.application.correct += 1;
    }

    session.total += 1;
    if (isCorrect) {
      session.correct += 1;
      session.streak += 1;
    } else {
      session.streak = 0;
    }

    recentIds.push(q.id);
    if (recentIds.length > 10) recentIds.shift();

    saveState();
    updateHud();
  }

  function showFeedback(isCorrect, explanationHtml, q) {
    feedback.classList.remove("hidden", "correct", "wrong");
    feedback.classList.add(isCorrect ? "correct" : "wrong");
    feedbackResult.textContent = isCorrect ? "¡Correcto!" : "Incorrecto";
    feedbackExplanation.innerHTML = explanationHtml || q.explanation;
    submitBtn.disabled = true;
    nextBtn.hidden = false;
    if (typeof nextBtn.focus === "function") {
      nextBtn.focus();
    }
  }

  function updateHud() {
    scoreDisplay.textContent = `Aciertos: ${session.correct} / ${session.total}`;
    streakDisplay.textContent = `Racha: ${session.streak}`;
    const pct = session.total > 0 ? (session.correct / session.total) * 100 : 0;
    progressFill.style.width = `${pct}%`;
  }

  // --- Progreso ---
  function renderProgress() {
    progressGrid.innerHTML = "";

    curriculum.forEach((topic) => {
      const stats = state.progress[topic.key] || { correct: 0, total: 0 };
      const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
      const card = document.createElement("div");
      card.className = "progress-card";
      card.innerHTML = `
        <h3>${topic.label}</h3>
        <div class="bar"><span style="width: ${pct}%"></span></div>
        <p class="count">${stats.correct}/${stats.total} correctos (${pct}%)</p>
      `;
      progressGrid.appendChild(card);
    });

    const heading = document.createElement("h3");
    heading.textContent = "Habilidades compartidas";
    heading.style.cssText = "grid-column: 1 / -1; margin: 1rem 0 0; color: var(--ctp-teal);";
    progressGrid.appendChild(heading);

    Object.entries(state.skills).forEach(([key, s]) => {
      const label = { recall: "Memoria", methodSelection: "Selección de método", application: "Aplicación" }[key];
      const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
      const card = document.createElement("div");
      card.className = "progress-card";
      card.innerHTML = `<h3>${label}</h3><div class="bar"><span style="width: ${pct}%"></span></div><p class="count">${s.correct}/${s.total} (${pct}%)</p></div>`;
      progressGrid.appendChild(card);
    });
  }

  // --- Toast ---
  let toastTimeout = null;
  function showToast(message) {
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.add("hidden"), 2200);
  }

  // --- Eventos ---
  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });

  tabDerivacion.addEventListener("click", () => selectFormulaTab("derivation"));
  tabIntegracion.addEventListener("click", () => selectFormulaTab("integration"));

  function handleTabKeydown(e) {
    if (e.key === "ArrowLeft" || e.key === "Home") {
      e.preventDefault();
      selectFormulaTab("derivation");
    } else if (e.key === "ArrowRight" || e.key === "End") {
      e.preventDefault();
      selectFormulaTab("integration");
    }
  }
  tabDerivacion.addEventListener("keydown", handleTabKeydown);
  tabIntegracion.addEventListener("keydown", handleTabKeydown);

  modeCards.forEach((card) => {
    card.addEventListener("click", () => setMode(card.dataset.mode));
  });

  answerForm.addEventListener("submit", handleSubmit);

  revealBtn.addEventListener("click", revealFlashcard);
  rememberedBtn.addEventListener("click", handleRemembered);
  reviewBtn.addEventListener("click", handleReview);

  nextBtn.addEventListener("click", () => {
    const mode = getCurrentMode();
    if (!["cartas", "detective", "aventura"].includes(mode)) return;
    startQuestion(mode);
  });

  resetProgressBtn.addEventListener("click", () => {
    if (confirm("¿Borrar todo tu progreso guardado? No se puede deshacer.")) {
      resetState();
    }
  });

  // Teclado: Enter en opción seleccionada envía el formulario.
  optionsList.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.classList.contains("option-btn")) {
      e.preventDefault();
      selectOption(e.target);
      handleSubmit(e);
    }
  });

  // Inicializar
  setMode("home");

  root.CalculoApp = {
    setMode,
    selectFormulaTab,
    renderFormulario,
    getState: () => state,
    getSession: () => session,
    getCurrentQuestion: () => currentQuestion,
    getCurrentMode,
  };
})(typeof self !== "undefined" ? self : this);
