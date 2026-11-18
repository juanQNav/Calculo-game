/* tests/verify.js — Verificación ligera del banco de preguntas y sintaxis.
 * Uso: node tests/verify.js
 */

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const files = {
  content: path.join(root, "js", "content.js"),
  app: path.join(root, "js", "app.js"),
};

let failures = 0;
function assert(condition, message) {
  if (!condition) {
    failures += 1;
    console.error(`✗ ${message}`);
  } else {
    console.log(`✓ ${message}`);
  }
}

function syntaxCheck(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  try {
    new vm.Script(src, { filename: filePath });
    console.log(`✓ Sintaxis válida: ${path.relative(root, filePath)}`);
  } catch (err) {
    failures += 1;
    console.error(`✗ Error de sintaxis en ${path.relative(root, filePath)}: ${err.message}`);
  }
}

function loadContent() {
  const context = { self: {}, window: { CalculoContent: null } };
  vm.createContext(context);
  const src = fs.readFileSync(files.content, "utf8");
  vm.runInContext(src, context);
  return context.self.CalculoContent || context.window.CalculoContent;
}

function createMockElement(tag = "div", attrs = {}) {
  const classes = new Set();
  const attrsMap = {};
  const listeners = {};
  const children = [];
  let innerHTML = "";
  const el = {
    tagName: tag,
    id: attrs.id || "",
    dataset: attrs.dataset || {},
    classList: {
      add: (...c) => c.forEach((x) => classes.add(x)),
      remove: (...c) => c.forEach((x) => classes.delete(x)),
      contains: (c) => classes.has(c),
      toggle: (c, force) => {
        const add = force === undefined ? !classes.has(c) : force;
        if (add) classes.add(c);
        else classes.delete(c);
        return classes.has(c);
      },
    },
    attributes: attrsMap,
    style: {},
    get innerHTML() {
      return innerHTML;
    },
    set innerHTML(value) {
      innerHTML = value;
      children.length = 0;
    },
    textContent: "",
    hidden: false,
    disabled: false,
    _listeners: listeners,
    addEventListener(type, fn) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    removeEventListener() {},
    setAttribute(name, val) {
      attrsMap[name] = String(val);
      if (name === "id") el.id = String(val);
      if (name === "class") el.className = String(val);
    },
    getAttribute(name) {
      return attrsMap[name] || null;
    },
    get className() {
      return Array.from(classes).join(" ");
    },
    set className(val) {
      classes.clear();
      (val || "").split(/\s+/).forEach((c) => c && classes.add(c));
    },
    focus() {},
    appendChild(child) {
      children.push(child);
      return child;
    },
    removeChild(child) {
      const i = children.indexOf(child);
      if (i !== -1) children.splice(i, 1);
    },
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    },
    children,
    dispatchEvent(event) {
      (listeners[event.type] || []).forEach((h) => h.call(el, event));
    },
  };
  if (attrs.className) {
    attrs.className.split(/\s+/).forEach((c) => c && classes.add(c));
  }
  return el;
}

function loadAppWithMocks(content) {
  const ids = [
    "home-view",
    "formulario-view",
    "game-view",
    "progress-view",
    "mode-title",
    "score-display",
    "streak-display",
    "progress-fill",
    "topic-pill",
    "question-clue",
    "question-prompt",
    "answer-form",
    "options-list",
    "options-legend",
    "submit-btn",
    "feedback",
    "feedback-result",
    "feedback-explanation",
    "next-btn",
    "progress-grid",
    "reset-progress-btn",
    "toast",
    "flashcard-controls",
    "reveal-btn",
    "recall-actions",
    "flashcard-answer",
    "flashcard-explanation",
    "remembered-btn",
    "review-btn",
    "tab-derivacion",
    "tab-integracion",
    "panel-derivacion",
    "panel-integracion",
    "deriv-families",
    "int-families",
  ];
  const elements = {};
  ids.forEach((id) => {
    elements[id] = createMockElement("div", { id });
  });

  const navButtons = ["home", "formulario", "cartas", "detective", "aventura", "progreso"].map((mode) =>
    createMockElement("button", { dataset: { mode } })
  );
  const modeCards = ["cartas", "detective", "aventura"].map((mode) =>
    createMockElement("button", { dataset: { mode } })
  );


  function elementMatches(el, sel) {
    if (!sel) return true;
    const tokens = sel.match(/(\.[^.\[]+|\[[^\]]+\])/g) || [];
    for (const token of tokens) {
      if (token.startsWith(".")) {
        if (!el.classList.contains(token.slice(1))) return false;
      } else if (token.startsWith("[")) {
        const inner = token.slice(1, -1);
        const [name, rawVal] = inner.split("=");
        const val = rawVal ? rawVal.replace(/^["']|["']$/g, "") : null;
        if (name === "data-kind") {
          if (el.dataset.kind !== val) return false;
        } else if (name === "data-index") {
          if (String(el.dataset.index) !== val) return false;
        } else if (val === null) {
          if (!el.attributes[name]) return false;
        } else if (el.attributes[name] !== val) {
          return false;
        }
      }
    }
    return true;
  }

  const optionsList = elements["options-list"];
  optionsList.querySelectorAll = (sel) => optionsList.children.filter((c) => elementMatches(c, sel));
  optionsList.querySelector = (sel) => optionsList.querySelectorAll(sel)[0] || null;

  const doc = {
    getElementById: (id) => elements[id] || createMockElement("div", { id }),
    querySelectorAll: (sel) => {
      if (sel === ".nav-btn") return navButtons;
      if (sel === ".mode-card") return modeCards;
      if (sel === '.nav-btn[aria-pressed="true"]')
        return navButtons.filter((b) => b.attributes["aria-pressed"] === "true");
      return [];
    },
    querySelector: (sel) => doc.querySelectorAll(sel)[0] || null,
    addEventListener() {},
    createElement: (tag) => createMockElement(tag),
  };

  const storage = {};
  const ls = {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => {
      storage[k] = v;
    },
    removeItem: (k) => {
      delete storage[k];
    },
  };

  const ctx = {
    self: {},
    window: {},
    document: doc,
    localStorage: ls,
    console,
    Math,
    Date,
    JSON,
    setTimeout,
    clearTimeout,
    structuredClone:
      typeof structuredClone !== "undefined"
        ? structuredClone
        : (x) => JSON.parse(JSON.stringify(x)),
    confirm: () => true,
  };
  ctx.window.CalculoContent = content;
  ctx.self = ctx.window;
  vm.createContext(ctx);
  const src = fs.readFileSync(files.app, "utf8");
  vm.runInContext(src, ctx);
  return { app: ctx.self.CalculoApp, elements, navButtons };
}

function testCartasFlow(content) {
  console.log("\n--- Flujo Cartas ---");
  const { app, elements } = loadAppWithMocks(content);

  assert(typeof app === "object", "app.js expone CalculoApp");
  assert(typeof app.setMode === "function", "CalculoApp expone setMode");

  app.setMode("cartas");

  assert(
    elements["answer-form"].classList.contains("hidden"),
    "Cartas oculta el formulario de opciones"
  );
  assert(
    !elements["flashcard-controls"].classList.contains("hidden"),
    "Cartas muestra los controles de flashcard"
  );
  assert(elements["reveal-btn"].hidden === false, "Cartas muestra 'Mostrar respuesta'");
  assert(
    elements["recall-actions"].classList.contains("hidden"),
    "Cartas oculta las acciones de autoevaluación inicialmente"
  );

  elements["reveal-btn"].dispatchEvent({ type: "click" });

  assert(elements["reveal-btn"].hidden === true, "Tras revelar se oculta 'Mostrar respuesta'");
  assert(
    !elements["recall-actions"].classList.contains("hidden"),
    "Tras revelar se muestran las acciones de autoevaluación"
  );
  const q = app.getCurrentQuestion();
  assert(
    q && elements["flashcard-answer"].innerHTML === q.options[q.correctIndex],
    "Tras revelar se muestra la respuesta correcta"
  );
  assert(
    q && elements["flashcard-explanation"].innerHTML === q.explanation,
    "Tras revelar se muestra la explicación"
  );

  const before = app.getState();
  const recallCorrectBefore = before.skills.recall.correct;
  const recallTotalBefore = before.skills.recall.total;
  const appCorrectBefore = before.skills.application.correct;
  const appTotalBefore = before.skills.application.total;
  const topicBefore = before.progress[q.topic] || { total: 0 };

  elements["remembered-btn"].dispatchEvent({ type: "click" });

  const after = app.getState();
  assert(
    after.skills.recall.correct === recallCorrectBefore + 1,
    "'La recordé' incrementa recall.correct"
  );
  assert(
    after.skills.recall.total === recallTotalBefore + 1,
    "'La recordé' incrementa recall.total"
  );
  assert(
    after.skills.application.correct === appCorrectBefore,
    "'La recordé' no toca application.correct"
  );
  assert(
    after.skills.application.total === appTotalBefore,
    "'La recordé' no toca application.total"
  );
  const topicAfter = after.progress[q.topic] || { total: 0 };
  assert(
    topicAfter.total === topicBefore.total + 1,
    "'La recordé' incrementa el progreso del tema"
  );

  assert(
    !elements["flashcard-controls"].classList.contains("hidden"),
    "Avanzar carta mantiene el modo flashcard"
  );
  assert(
    elements["reveal-btn"].hidden === false,
    "Nueva carta vuelve a mostrar 'Mostrar respuesta'"
  );
  assert(
    elements["recall-actions"].classList.contains("hidden"),
    "Nueva carta oculta las acciones de autoevaluación"
  );

  elements["reveal-btn"].dispatchEvent({ type: "click" });
  const before2 = app.getState();
  const recallCorrectBefore2 = before2.skills.recall.correct;
  const recallTotalBefore2 = before2.skills.recall.total;

  elements["review-btn"].dispatchEvent({ type: "click" });

  const after2 = app.getState();
  assert(
    after2.skills.recall.correct === recallCorrectBefore2,
    "'Necesito repasarla' no incrementa recall.correct"
  );
  assert(
    after2.skills.recall.total === recallTotalBefore2 + 1,
    "'Necesito repasarla' incrementa recall.total"
  );
}

function testAventuraApplication(content) {
  console.log("\n--- Aventura sigue contribuyendo a application ---");
  const { app, elements } = loadAppWithMocks(content);

  app.setMode("aventura");
  const q = app.getCurrentQuestion();
  const optionBtns = elements["options-list"].children;
  assert(optionBtns.length >= 2, "Aventura renderiza opciones");

  const wrongBtn =
    optionBtns.find((b) => Number(b.dataset.index) !== q.correctIndex) || optionBtns[0];
  wrongBtn.dispatchEvent({ type: "click" });

  const before = app.getState();
  const appTotalBefore = before.skills.application.total;
  const recallTotalBefore = before.skills.recall.total;

  elements["answer-form"].dispatchEvent({ type: "submit", preventDefault() {} });

  const after = app.getState();
  assert(
    after.skills.application.total === appTotalBefore + 1,
    "Aventura incrementa application.total"
  );
  assert(after.skills.recall.total === recallTotalBefore, "Aventura no toca recall.total");
}

function testDetectiveFlow(content) {
  console.log("\n--- Flujo Detective con reintento ---");
  const { app, elements } = loadAppWithMocks(content);

  app.setMode("detective");
  const q = app.getCurrentQuestion();
  assert(q.modes.includes("detective"), "Detective carga una pregunta del modo");

  function optionButton(kind, label) {
    return elements["options-list"]
      .querySelectorAll(`[data-kind="${kind}"]`)
      .find((b) => b.innerHTML === label);
  }

  const baseline = app.getState();
  const appCorrectBefore = baseline.skills.application.correct;
  const appTotalBefore = baseline.skills.application.total;
  const topicTotalBefore = (baseline.progress[q.topic] || { total: 0 }).total;
  const methodSelectionTotalBefore = baseline.skills.methodSelection.total;
  const methodSelectionCorrectBefore = baseline.skills.methodSelection.correct;

  // 1. Técnica incorrecta: el escenario debe ser reintentable.
  const wrongTechniqueBtn = elements["options-list"]
    .querySelectorAll('[data-kind="technique"]')
    .find((b) => b.innerHTML !== q.techniqueLabel);
  wrongTechniqueBtn.dispatchEvent({ type: "click" });
  elements["answer-form"].dispatchEvent({ type: "submit", preventDefault() {} });

  const afterWrongTechnique = app.getState();
  assert(
    elements["options-legend"].textContent.includes("Paso 1"),
    "Detective: técnica incorrecta mantiene la etapa de técnica"
  );
  assert(
    elements["feedback"].classList.contains("wrong") && !elements["feedback"].classList.contains("hidden"),
    "Detective: técnica incorrecta muestra feedback de error"
  );
  assert(elements["submit-btn"].disabled === false, "Detective: técnica incorrecta deja submit habilitado");
  assert(elements["next-btn"].hidden === true, "Detective: técnica incorrecta mantiene Next oculto");
  assert(
    afterWrongTechnique.skills.application.correct === appCorrectBefore,
    "Detective: técnica incorrecta no incrementa application.correct"
  );
  assert(
    afterWrongTechnique.skills.application.total === appTotalBefore,
    "Detective: técnica incorrecta no incrementa application.total"
  );
  assert(
    afterWrongTechnique.skills.methodSelection.total === methodSelectionTotalBefore,
    "Detective: técnica incorrecta no incrementa methodSelection.total"
  );
  assert(
    afterWrongTechnique.skills.methodSelection.correct === methodSelectionCorrectBefore,
    "Detective: técnica incorrecta no incrementa methodSelection.correct"
  );
  assert(
    (afterWrongTechnique.progress[q.topic] || { total: 0 }).total === topicTotalBefore,
    "Detective: técnica incorrecta no incrementa el progreso del tema"
  );

  // 2. Técnica correcta: avanza a la pista.
  const correctTechniqueBtn = optionButton("technique", q.techniqueLabel);
  correctTechniqueBtn.dispatchEvent({ type: "click" });
  elements["answer-form"].dispatchEvent({ type: "submit", preventDefault() {} });

  const afterCorrectTechnique = app.getState();
  assert(
    elements["options-legend"].textContent.includes("Paso 2"),
    "Detective: técnica correcta avanza a la etapa de pista"
  );
  assert(
    afterCorrectTechnique.skills.methodSelection.total === methodSelectionTotalBefore + 1,
    "Detective: técnica correcta incrementa methodSelection.total"
  );
  assert(
    afterCorrectTechnique.skills.methodSelection.correct === methodSelectionCorrectBefore + 1,
    "Detective: técnica correcta incrementa methodSelection.correct"
  );
  assert(
    afterCorrectTechnique.skills.application.total === appTotalBefore,
    "Detective: técnica correcta aún no toca application.total"
  );

  // 3. Pista incorrecta: mismo comportamiento de reintento.
  const wrongClueBtn = elements["options-list"]
    .querySelectorAll('[data-kind="clue"]')
    .find((b) => b.innerHTML !== q.clue);
  wrongClueBtn.dispatchEvent({ type: "click" });
  elements["answer-form"].dispatchEvent({ type: "submit", preventDefault() {} });

  const afterWrongClue = app.getState();
  assert(
    elements["options-legend"].textContent.includes("Paso 2"),
    "Detective: pista incorrecta mantiene la etapa de pista"
  );
  assert(
    elements["feedback"].classList.contains("wrong") && !elements["feedback"].classList.contains("hidden"),
    "Detective: pista incorrecta muestra feedback de error"
  );
  assert(elements["submit-btn"].disabled === false, "Detective: pista incorrecta deja submit habilitado");
  assert(elements["next-btn"].hidden === true, "Detective: pista incorrecta mantiene Next oculto");
  assert(
    afterWrongClue.skills.application.total === appTotalBefore,
    "Detective: pista incorrecta no incrementa application.total"
  );
  assert(
    (afterWrongClue.progress[q.topic] || { total: 0 }).total === topicTotalBefore,
    "Detective: pista incorrecta no incrementa el progreso del tema"
  );

  // 4. Pista correcta y respuesta correcta: contabiliza application una sola vez.
  const correctClueBtn = optionButton("clue", q.clue);
  correctClueBtn.dispatchEvent({ type: "click" });
  elements["answer-form"].dispatchEvent({ type: "submit", preventDefault() {} });

  assert(
    elements["options-legend"].textContent.includes("Paso 3"),
    "Detective: pista correcta avanza a la etapa de respuesta"
  );
  assert(elements["question-clue"].hidden === false, "Detective: pista correcta muestra la pista");

  const correctAnswerLabel = q.options[q.correctIndex];
  const correctAnswerBtn = optionButton("answer", correctAnswerLabel);
  correctAnswerBtn.dispatchEvent({ type: "click" });
  elements["answer-form"].dispatchEvent({ type: "submit", preventDefault() {} });

  const afterCorrectAnswer = app.getState();
  assert(
    elements["feedback"].classList.contains("correct"),
    "Detective: respuesta correcta muestra feedback de acierto"
  );
  assert(elements["next-btn"].hidden === false, "Detective: respuesta correcta muestra Next");
  assert(
    afterCorrectAnswer.skills.application.correct === appCorrectBefore + 1,
    "Detective: respuesta correcta incrementa application.correct una vez"
  );
  assert(
    afterCorrectAnswer.skills.application.total === appTotalBefore + 1,
    "Detective: respuesta correcta incrementa application.total una vez"
  );
  assert(
    (afterCorrectAnswer.progress[q.topic] || { total: 0 }).total === topicTotalBefore + 1,
    "Detective: respuesta correcta incrementa el progreso del tema una vez"
  );
}

function testHtmlStructure() {
  console.log("\n--- Estructura HTML ---");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const requiredIds = [
    "flashcard-controls",
    "reveal-btn",
    "recall-actions",
    "flashcard-answer",
    "flashcard-explanation",
    "remembered-btn",
    "review-btn",
    "formulario-view",
    "tab-derivacion",
    "tab-integracion",
    "panel-derivacion",
    "panel-integracion",
    "deriv-families",
    "int-families",
  ];
  requiredIds.forEach((id) => {
    assert(html.includes(`id="${id}"`), `index.html incluye #${id}`);
  });
}

function testFormulaCatalog(content) {
  console.log("\n--- Catálogo de fórmulas ---");
  assert(
    Array.isArray(content.formulas) && content.formulas.length > 0,
    "Hay catálogo de fórmulas"
  );
  assert(typeof content.formulaFamilies === "object", "Hay definición de familias de fórmulas");
  assert(
    Array.isArray(content.formulaOrder) && content.formulaOrder.length > 0,
    "Hay orden de familias de fórmulas"
  );

  const ids = new Set();
  content.formulas.forEach((f, i) => {
    assert(typeof f.id === "string" && f.id.trim() !== "", `Fórmula ${i} tiene id`);
    assert(!ids.has(f.id), `Id único de fórmula: ${f.id}`);
    ids.add(f.id);
    assert(content.formulaFamilies[f.family], `Fórmula ${f.id} pertenece a una familia conocida`);
    assert(typeof f.formula === "string" && f.formula.length > 0, `Fórmula ${f.id} tiene expresión`);
    assert(typeof f.what === "string" && f.what.length > 0, `Fórmula ${f.id} tiene campo Qué`);
    assert(typeof f.why === "string" && f.why.length > 0, `Fórmula ${f.id} tiene campo Por qué`);
    assert(typeof f.where === "string" && f.where.length > 0, `Fórmula ${f.id} tiene campo Dónde/cuándo`);
    assert(typeof f.tip === "string" && f.tip.length > 0, `Fórmula ${f.id} tiene campo Tip`);
    assert(Array.isArray(f.sources) && f.sources.length > 0, `Fórmula ${f.id} tiene fuentes`);
  });

  content.formulaOrder.forEach((familyKey) => {
    const count = content.formulas.filter((f) => f.family === familyKey).length;
    assert(count > 0, `La familia ${familyKey} tiene al menos una fórmula`);
  });

  const derivationFamilies = content.formulaOrder.filter(
    (k) => content.formulaFamilies[k].branch === "derivation"
  );
  const integrationFamilies = content.formulaOrder.filter(
    (k) => content.formulaFamilies[k].branch === "integration"
  );
  assert(derivationFamilies.length >= 4, "Hay cobertura de familias de derivación");
  assert(integrationFamilies.length >= 4, "Hay cobertura de familias de integración");
}

function testFormularioNavigation(content) {
  console.log("\n--- Navegación Home / Formulario ---");
  const { app, elements, navButtons } = loadAppWithMocks(content);

  assert(typeof app.getCurrentMode === "function", "CalculoApp expone getCurrentMode");

  app.setMode("home");
  assert(!elements["home-view"].classList.contains("hidden"), "Home muestra la vista de inicio");
  assert(elements["formulario-view"].classList.contains("hidden"), "Home oculta Formulario");
  assert(elements["game-view"].classList.contains("hidden"), "Home oculta el juego");
  assert(app.getCurrentMode() === "home", "getCurrentMode reporta home");
  const homeBtn = navButtons.find((b) => b.dataset.mode === "home");
  assert(homeBtn.attributes["aria-pressed"] === "true", "Home activa su botón de navegación");

  app.setMode("formulario");
  assert(
    !elements["formulario-view"].classList.contains("hidden"),
    "Formulario muestra su vista"
  );
  assert(elements["home-view"].classList.contains("hidden"), "Formulario oculta Home");
  assert(elements["game-view"].classList.contains("hidden"), "Formulario oculta el juego");
  assert(app.getCurrentMode() === "formulario", "getCurrentMode reporta formulario");
  const formBtn = navButtons.find((b) => b.dataset.mode === "formulario");
  assert(formBtn.attributes["aria-pressed"] === "true", "Formulario activa su botón de navegación");
  assert(homeBtn.attributes["aria-pressed"] === "false", "Home desactiva su botón en Formulario");
  assert(elements["deriv-families"].children.length > 0, "Formulario renderiza familias de derivación");
}

function testFormulaTabs(content) {
  console.log("\n--- Pestañas del Formulario ---");
  const { app, elements } = loadAppWithMocks(content);
  app.setMode("formulario");

  const derivTab = elements["tab-derivacion"];
  const intTab = elements["tab-integracion"];
  const derivPanel = elements["panel-derivacion"];
  const intPanel = elements["panel-integracion"];

  assert(derivTab.attributes["aria-selected"] === "true", "Inicialmente Derivación está seleccionada");
  assert(intTab.attributes["aria-selected"] === "false", "Inicialmente Integración no está seleccionada");
  assert(!derivPanel.classList.contains("hidden"), "Panel de derivación visible inicialmente");
  assert(intPanel.classList.contains("hidden"), "Panel de integración oculto inicialmente");

  intTab.dispatchEvent({ type: "click" });
  assert(intTab.attributes["aria-selected"] === "true", "Click en Integración la selecciona");
  assert(derivTab.attributes["aria-selected"] === "false", "Click en Integración deselecciona Derivación");
  assert(!intPanel.classList.contains("hidden"), "Panel de integración visible tras click");
  assert(derivPanel.classList.contains("hidden"), "Panel de derivación oculto tras click");

  derivTab.dispatchEvent({ type: "click" });
  assert(derivTab.attributes["aria-selected"] === "true", "Click en Derivación la vuelve a seleccionar");
  assert(intTab.attributes["aria-selected"] === "false", "Click en Derivación deselecciona Integración");
  assert(!derivPanel.classList.contains("hidden"), "Panel de derivación visible al regresar");
  assert(intPanel.classList.contains("hidden"), "Panel de integración oculto al regresar");
}

function testFormulaTabKeyboard(content) {
  console.log("\n--- Teclado en pestañas del Formulario ---");
  const { app, elements } = loadAppWithMocks(content);
  app.setMode("formulario");

  const derivTab = elements["tab-derivacion"];
  const intTab = elements["tab-integracion"];
  const keyEvent = (key) => ({ type: "keydown", key, preventDefault() {} });

  derivTab.dispatchEvent(keyEvent("ArrowRight"));
  assert(intTab.attributes["aria-selected"] === "true", "ArrowRight selecciona Integración");
  derivTab.dispatchEvent(keyEvent("ArrowLeft"));
  assert(derivTab.attributes["aria-selected"] === "true", "ArrowLeft selecciona Derivación");
  derivTab.dispatchEvent(keyEvent("End"));
  assert(intTab.attributes["aria-selected"] === "true", "End selecciona la última pestaña");
  intTab.dispatchEvent(keyEvent("Home"));
  assert(derivTab.attributes["aria-selected"] === "true", "Home selecciona la primera pestaña");
}

function main() {
  console.log("=== Verificación de Cálculo A ===\n");

  syntaxCheck(files.content);
  syntaxCheck(files.app);

  const content = loadContent();

  assert(typeof content === "object", "content.js expone un objeto");
  assert(Array.isArray(content.curriculum) && content.curriculum.length > 0, "Hay currículo definido");
  assert(Array.isArray(content.questions) && content.questions.length > 0, "Hay preguntas definidas");
  assert(Array.isArray(content.formulas) && content.formulas.length > 0, "Hay catálogo de fórmulas");
  assert(typeof content.formulaFamilies === "object", "Hay familias de fórmulas definidas");

  const ids = new Set();
  content.questions.forEach((q, i) => {
    assert(typeof q.id === "string" && q.id.trim() !== "", `Pregunta ${i} tiene id`);
    assert(!ids.has(q.id), `Id único: ${q.id}`);
    ids.add(q.id);
    assert(content.curriculum.some((t) => t.key === q.topic), `Pregunta ${q.id} tiene topic válido`);
    assert(Array.isArray(q.options) && q.options.length >= 2, `Pregunta ${q.id} tiene opciones`);
    assert(new Set(q.options).size === q.options.length, `Pregunta ${q.id}: opciones con etiquetas únicas`);
    assert(typeof q.correctIndex === "number", `Pregunta ${q.id} tiene correctIndex numérico`);
    assert(q.correctIndex >= 0 && q.correctIndex < q.options.length, `Pregunta ${q.id}: correctIndex dentro de rango`);
    assert(typeof q.explanation === "string" && q.explanation.length > 0, `Pregunta ${q.id} tiene explicación`);
    assert(Array.isArray(q.modes) && q.modes.length > 0, `Pregunta ${q.id} tiene modos`);
    assert(q.modes.every((m) => ["cartas", "detective", "aventura"].includes(m)), `Pregunta ${q.id} tiene modos válidos`);
    const tLabel = q.techniqueLabel || content.techniques[q.technique] || q.technique;
    assert(Object.values(content.techniques).includes(tLabel), `Pregunta ${q.id}: técnica '${tLabel}' está en el pool de técnicas`);
    assert(typeof q.clue === "string" && q.clue.length > 0, `Pregunta ${q.id} tiene pista`);
  });

  // Verificar que existan preguntas para cada modo.
  ["cartas", "detective", "aventura"].forEach((mode) => {
    const count = content.questions.filter((q) => q.modes.includes(mode)).length;
    assert(count > 0, `Hay ${count} preguntas para modo ${mode}`);
  });

  // Verificar opciones de Detective.
  const detectiveQuestions = content.questions.filter((q) => q.modes.includes("detective"));
  detectiveQuestions.forEach((q) => {
    const det = content.getDetectiveOptions(q);
    assert(Array.isArray(det.techniqueOptions) && det.techniqueOptions.includes(det.correctTechnique), `Detective técnica válida para ${q.id}`);
    assert(Array.isArray(det.clueOptions) && det.clueOptions.includes(det.correctClue), `Detective pista válida para ${q.id}`);
    assert(det.techniqueOptions.length >= 2, `Detective técnica tiene distractores ${q.id}`);
    assert(det.clueOptions.length >= 2, `Detective pista tiene distractores ${q.id}`);
  });

  // Verificar que no aparezcan las formas racionales diferidas 29/30.
  const forbidden = [
    "∫ du/(a²-u²)",
    "∫ du/(u²-a²)",
    "∫ u du/(a²±u²)",
    "1/(2a) ln",
    "29",
    "30",
  ];
  const allText = (
    JSON.stringify(content.questions) + JSON.stringify(content.formulas)
  ).toLowerCase();
  forbidden.forEach((term) => {
    assert(!allText.includes(term.toLowerCase()), `No aparece término diferido: ${term}`);
  });

  // Regresión: distractores previamente equivalentes a la respuesta correcta.
  const equivalentDistractors = {
    "i-trig-log-1": ["−ln|cos x| + C"],
    "i-csc-1": ["−ln|csc x + cot x| + C"],
    "i-arco-1": ["−arccos x + C", "arccos x + C"],
  };
  Object.entries(equivalentDistractors).forEach(([id, terms]) => {
    const q = content.questions.find((item) => item.id === id);
    assert(q, `Pregunta de regresión encontrada: ${id}`);
    terms.forEach((term) => {
      const present = q.options.some((opt) => opt.includes(term));
      assert(!present, `Pregunta ${id}: no incluye distractor equivalente '${term}'`);
    });
  });

  // Regresión: el distractor ln|cos x| en ∫ tan x dx es plausible pero incorrecto.
  const tanQuestion = content.questions.find((q) => q.id === "i-trig-log-1");
  assert(tanQuestion, "Pregunta i-trig-log-1 disponible para regresión");
  const cosDistractorIndex = tanQuestion.options.findIndex((opt) =>
    opt.includes("ln|cos x| + C")
  );
  assert(cosDistractorIndex !== -1, "i-trig-log-1 incluye distractor plausible ln|cos x| + C");
  assert(
    cosDistractorIndex !== tanQuestion.correctIndex,
    "i-trig-log-1: ln|cos x| + C no es la respuesta correcta"
  );
  const hasNegativeSen = tanQuestion.options.some((opt) => opt.includes("−ln|sen x| + C"));
  const hasPositiveSen = tanQuestion.options.some((opt) => opt.includes("ln|sen x| + C"));
  assert(
    !(hasNegativeSen && hasPositiveSen),
    "i-trig-log-1 no conserva el par espejo −ln|sen x| y ln|sen x|"
  );

  // Corrección matemática: i-arco-3 debe conservar |x/3| para ser válida en x>3 y x<−3.
  const arcsecQuestion = content.questions.find((q) => q.id === "i-arco-3");
  assert(arcsecQuestion, "Pregunta i-arco-3 disponible");
  const arcsecCorrect = arcsecQuestion.options[arcsecQuestion.correctIndex];
  assert(
    arcsecCorrect.includes("|x/3|"),
    `i-arco-3: la respuesta correcta conserva el valor absoluto |x/3| (obtenida: ${arcsecCorrect})`
  );

  testHtmlStructure();
  testFormulaCatalog(content);
  testFormularioNavigation(content);
  testFormulaTabs(content);
  testFormulaTabKeyboard(content);
  testCartasFlow(content);
  testAventuraApplication(content);
  testDetectiveFlow(content);

  console.log("\n=== Resumen ===");
  if (failures === 0) {
    console.log("Todas las verificaciones pasaron.");
    process.exit(0);
  } else {
    console.error(`${failures} verificación(es) fallaron.`);
    process.exit(1);
  }
}

main();
