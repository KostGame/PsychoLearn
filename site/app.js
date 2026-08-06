import { lectures } from "./lectures/index.js?v=20260807-1";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const storage = {
  get(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // The learning experience still works when storage is unavailable.
    }
  },
};

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const query = new URLSearchParams(location.search);
let lecture = lectures.find((item) => item.id === query.get("lecture")) || lectures[0];
let completed = new Set(storage.get(`psycholearn:${lecture.id}:completed`, []));
let currentView = "overview";
let cardIndex = 0;
let quizIndex = 0;
let quizScore = 0;
let quizAnswered = false;

function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value;
}

function initialiseTheme() {
  const storedTheme = storage.get("psycholearn:theme", null);
  const preferredTheme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  setTheme(storedTheme || preferredTheme);
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  storage.set("psycholearn:theme", theme);
  $("meta[name='theme-color']")?.setAttribute("content", theme === "dark" ? "#171a18" : "#f4f1ea");
  $("#theme-toggle")?.setAttribute(
    "aria-label",
    theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему",
  );
}

function populateLecturePicker() {
  const picker = $("#lecture-picker");
  picker.innerHTML = lectures
    .map(
      (item) =>
        `<option value="${escapeHtml(item.id)}">${escapeHtml(item.number)} · ${escapeHtml(item.title)}</option>`,
    )
    .join("");
  picker.value = lecture.id;
  picker.disabled = lectures.length === 1;
}

function renderLecture() {
  document.title = `${lecture.number} · ${lecture.title} | PsychoLearn`;
  setText("#hero-course", `${lecture.course} · ${lecture.number}`);
  setText("#hero-title", lecture.title);
  setText("#hero-description", lecture.description);
  setText("#hero-time", `≈ ${lecture.readingTime} минут`);
  setText("#hero-sections", `${lecture.sections.length} разделов`);
  setText("#hero-cards", `${lecture.flashcards.length} карточек`);
  setText("#reader-number", `${lecture.course} · ${lecture.number}`);
  setText("#reader-title", lecture.title);
  setText("#reader-description", lecture.description);
  setText("#source-title", lecture.source.label);
  setText("#source-bibliography", lecture.source.bibliography);

  const conceptChain = lecture.conceptChain || [];
  const conceptChainElement = $("#concept-chain");
  conceptChainElement.setAttribute(
    "aria-label",
    lecture.conceptLabel || conceptChain.map((item) => item.title).join(", "),
  );
  conceptChainElement.innerHTML = conceptChain
    .map(
      (item, index) =>
        `<div><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.text)}</small></div>`,
    )
    .join("");

  $("#takeaway-grid").innerHTML = lecture.takeaways
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  $("#section-nav").innerHTML = [
    ...lecture.sections.map(
      (section, index) =>
        `<a href="#${escapeHtml(section.id)}" data-section-link="${escapeHtml(section.id)}">${index + 1}. ${escapeHtml(section.title)}</a>`,
    ),
    `<a href="#terms" data-section-link="terms">Словарь понятий</a>`,
  ].join("");

  $("#reader-sections").innerHTML = lecture.sections.map(renderSection).join("");
  $("#terms-grid").innerHTML = lecture.terms
    .map(
      (item) =>
        `<div class="term-row"><dt>${escapeHtml(item.term)}</dt><dd>${escapeHtml(item.definition)}</dd></div>`,
    )
    .join("");

  $$(".complete-button").forEach((button) => {
    button.addEventListener("click", () => toggleComplete(button.dataset.section));
  });

  $$("#section-nav a").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const target = document.getElementById(link.dataset.sectionLink);
      if (target instanceof HTMLDetailsElement) target.open = true;
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  updateProgress();
  showCard();
  resetQuiz();
  applyStoredFontScale();
}

function renderSection(section, index) {
  const paragraphs = section.paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
  const timeline = section.timeline
    ? `<div class="timeline">${section.timeline
        .map(
          (item) =>
            `<div class="timeline-item"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p></div>`,
        )
        .join("")}</div>`
    : "";
  const figures = section.figures?.length
    ? `<div class="section-figures">${section.figures.map(renderFigure).join("")}</div>`
    : "";
  const list = section.points?.length
    ? `<h3>${escapeHtml(section.listTitle)}</h3><ul>${section.points
        .map((point) => `<li>${escapeHtml(point)}</li>`)
        .join("")}</ul>`
    : "";
  const searchable = [
    section.eyebrow,
    section.title,
    section.lead,
    ...section.paragraphs,
    ...(section.points || []),
    ...(section.timeline || []).flatMap((item) => [item.title, item.text]),
    ...(section.figures || []).flatMap((figure) => [
      figure.title,
      figure.caption,
      figure.note,
      ...(figure.items || []).flatMap((item) => [item.label, item.value]),
    ]),
    section.memory,
  ]
    .join(" ")
    .toLocaleLowerCase("ru");

  return `
    <details
      class="lecture-section"
      id="${escapeHtml(section.id)}"
      data-search="${escapeHtml(searchable)}"
      data-tone="${escapeHtml(section.tone || "standard")}"
      ${index === 0 ? "open" : ""}
    >
      <summary>
        <span><small>${escapeHtml(section.eyebrow)}</small><h2>${escapeHtml(section.title)}</h2></span>
      </summary>
      <div class="section-content">
        <p class="section-lead">${escapeHtml(section.lead)}</p>
        ${paragraphs}
        ${timeline}
        ${figures}
        ${list}
        <div class="memory-note">Запомнить: ${escapeHtml(section.memory)}</div>
        <div class="section-footer">
          <button class="complete-button" type="button" data-section="${escapeHtml(section.id)}"></button>
        </div>
      </div>
    </details>`;
}

function renderFigure(figure) {
  const items = figure.items || [];
  const max = Number(figure.max) || Math.max(...items.map((item) => Math.abs(Number(item.value))), 1);
  const rows = items
    .map((item) => {
      const value = Number(item.value);
      const width = Math.min(50, (Math.abs(value) / max) * 50);
      const left = value < 0 ? 50 - width : 50;
      const valueLabel = figure.suffix ? `${value}${figure.suffix}` : String(value).replace(".", ",");

      return `<div class="chart-row">
        <span class="chart-label">${escapeHtml(item.label)}</span>
        <span class="chart-track" aria-hidden="true">
          <span class="chart-bar ${value < 0 ? "is-negative" : "is-positive"}" style="left:${left}%;width:${width}%"></span>
        </span>
        <strong>${escapeHtml(valueLabel)}</strong>
      </div>`;
    })
    .join("");
  const original = figure.image
    ? `<details class="original-figure"><summary>Посмотреть исходный рисунок из лекции</summary><a href="${escapeHtml(figure.image)}" target="_blank" rel="noopener"><img src="${escapeHtml(figure.image)}" alt="${escapeHtml(figure.imageAlt || figure.title)}" loading="lazy"></a></details>`
    : "";

  return `<figure class="data-figure">
    <figcaption><strong>${escapeHtml(figure.title)}</strong><span>${escapeHtml(figure.caption || "")}</span></figcaption>
    <div class="responsive-chart" role="img" aria-label="${escapeHtml(figure.ariaLabel || figure.title)}">${rows}</div>
    ${figure.note ? `<p class="figure-note">${escapeHtml(figure.note)}</p>` : ""}
    ${original}
  </figure>`;
}

function toggleComplete(sectionId) {
  if (completed.has(sectionId)) completed.delete(sectionId);
  else completed.add(sectionId);
  storage.set(`psycholearn:${lecture.id}:completed`, [...completed]);
  updateProgress();
}

function updateProgress() {
  const done = lecture.sections.filter((section) => completed.has(section.id)).length;
  const total = lecture.sections.length;
  const percent = Math.round((done / total) * 100);

  setText("#progress-percent", `${percent}%`);
  setText(
    "#progress-caption",
    done === total ? "Лекция изучена" : done === 0 ? "Начните с первого раздела" : `${done} из ${total} разделов`,
  );
  setText("#sidebar-progress-value", `${done} из ${total}`);

  const orbit = $("#progress-orbit");
  orbit?.style.setProperty("--progress", `${percent * 3.6}deg`);
  orbit?.setAttribute("aria-valuenow", String(percent));

  $$(".complete-button").forEach((button) => {
    const isComplete = completed.has(button.dataset.section);
    button.classList.toggle("is-complete", isComplete);
    button.textContent = isComplete ? "✓ Изучено" : "Отметить изученным";
    button.setAttribute("aria-pressed", String(isComplete));
  });

  $$('[data-section-link]').forEach((link) => {
    link.classList.toggle("is-complete", completed.has(link.dataset.sectionLink));
  });
}

function navigate(view, updateUrl = true) {
  if (!$("[data-view='" + view + "']")) view = "overview";
  currentView = view;

  $$(".view").forEach((element) => {
    const active = element.dataset.view === view;
    element.hidden = !active;
    element.classList.toggle("is-active", active);
  });
  $$(".bottom-nav [data-go]").forEach((button) => {
    const active = button.dataset.go === view;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  if (updateUrl) history.pushState({ view }, "", `#${view}`);
  window.scrollTo({ top: 0, behavior: "instant" });
  updatePageProgress();
}

function filterSections() {
  const input = $("#reader-search");
  const queryText = input.value.trim().toLocaleLowerCase("ru");
  let visible = 0;

  $$(".lecture-section").forEach((section) => {
    const matches = !queryText || section.dataset.search.includes(queryText);
    section.hidden = !matches;
    if (matches) {
      visible += 1;
      if (queryText) section.open = true;
    }
  });

  setText(
    "#search-status",
    queryText
      ? visible
        ? `Найдено разделов: ${visible}`
        : "Ничего не найдено. Попробуйте другое слово."
      : "",
  );
}

function toggleAllSections() {
  const visibleSections = $$(".lecture-section").filter((section) => !section.hidden);
  const shouldOpen = visibleSections.some((section) => !section.open);
  visibleSections.forEach((section) => {
    section.open = shouldOpen;
  });
  $("#toggle-sections").textContent = shouldOpen ? "Свернуть всё" : "Раскрыть всё";
}

function applyStoredFontScale() {
  const scale = storage.get("psycholearn:font-scale", 1);
  document.documentElement.style.setProperty("--reader-scale", String(scale));
}

function changeFontScale(delta) {
  const current = Number(
    getComputedStyle(document.documentElement).getPropertyValue("--reader-scale").trim() || 1,
  );
  const next = Math.min(1.2, Math.max(0.9, Math.round((current + delta) * 100) / 100));
  document.documentElement.style.setProperty("--reader-scale", String(next));
  storage.set("psycholearn:font-scale", next);
}

function showCard() {
  const cards = lecture.flashcards;
  const card = cards[cardIndex];
  $("#flashcard")?.classList.remove("is-flipped");
  setText("#flashcard-front", card.front);
  setText("#flashcard-back", card.back);
  setText("#card-counter", `${cardIndex + 1} / ${cards.length}`);
  $("#card-progress").style.width = `${((cardIndex + 1) / cards.length) * 100}%`;
  $("#card-prev").disabled = cardIndex === 0;
  $("#card-next").textContent = cardIndex === cards.length - 1 ? "Сначала ↻" : "Дальше →";
}

function moveCard(direction) {
  const total = lecture.flashcards.length;
  if (direction > 0 && cardIndex === total - 1) cardIndex = 0;
  else cardIndex = Math.min(total - 1, Math.max(0, cardIndex + direction));
  showCard();
}

function resetQuiz() {
  quizIndex = 0;
  quizScore = 0;
  quizAnswered = false;
  $("#quiz-stage").hidden = false;
  $("#quiz-result").hidden = true;
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const item = lecture.quiz[quizIndex];
  quizAnswered = false;
  setText("#quiz-counter", `Вопрос ${quizIndex + 1} из ${lecture.quiz.length}`);
  setText("#quiz-score", `${quizScore} верно`);
  setText("#quiz-question", item.question);
  $("#quiz-progress").style.width = `${(quizIndex / lecture.quiz.length) * 100}%`;
  $("#quiz-feedback").hidden = true;
  $("#quiz-feedback").textContent = "";
  $("#quiz-next").disabled = true;
  $("#quiz-next").textContent =
    quizIndex === lecture.quiz.length - 1 ? "Показать результат →" : "Следующий вопрос →";

  $("#quiz-options").innerHTML = item.options
    .map(
      (option, index) =>
        `<button class="quiz-option" type="button" data-option="${index}">${escapeHtml(option)}</button>`,
    )
    .join("");
  $$(".quiz-option").forEach((button) => {
    button.addEventListener("click", () => answerQuiz(Number(button.dataset.option)));
  });
}

function answerQuiz(selectedIndex) {
  if (quizAnswered) return;
  quizAnswered = true;
  const item = lecture.quiz[quizIndex];
  const correct = selectedIndex === item.answer;
  if (correct) quizScore += 1;

  $$(".quiz-option").forEach((button) => {
    const index = Number(button.dataset.option);
    button.disabled = true;
    button.classList.toggle("is-correct", index === item.answer);
    button.classList.toggle("is-wrong", index === selectedIndex && !correct);
  });

  const feedback = $("#quiz-feedback");
  feedback.hidden = false;
  feedback.textContent = `${correct ? "Верно. " : "Не совсем. "}${item.explanation}`;
  $("#quiz-next").disabled = false;
  setText("#quiz-score", `${quizScore} верно`);
}

function nextQuizQuestion() {
  if (!quizAnswered) return;
  if (quizIndex < lecture.quiz.length - 1) {
    quizIndex += 1;
    renderQuizQuestion();
    $("#quiz-question")?.focus?.();
    return;
  }
  showQuizResult();
}

function showQuizResult() {
  const total = lecture.quiz.length;
  const ratio = quizScore / total;
  const previousBest = storage.get(`psycholearn:${lecture.id}:best-quiz`, 0);
  storage.set(`psycholearn:${lecture.id}:best-quiz`, Math.max(previousBest, quizScore));
  $("#quiz-stage").hidden = true;
  $("#quiz-result").hidden = false;

  if (ratio >= 0.9) {
    setText("#result-title", "Отлично усвоено");
    setText("#result-copy", "Главные связи и понятия уже держатся уверенно.");
  } else if (ratio >= 0.7) {
    setText("#result-title", "Хорошая база");
    setText("#result-copy", "Есть несколько мест, которые стоит быстро повторить по карточкам.");
  } else {
    setText("#result-title", "Нужно закрепить");
    setText("#result-copy", "Вернитесь к разделам с терминами и пройдите карточки ещё один круг.");
  }
  setText("#result-score", `${quizScore} из ${total}`);
}

function updatePageProgress() {
  const max = document.documentElement.scrollHeight - innerHeight;
  const percent = max > 0 ? Math.min(100, (scrollY / max) * 100) : 0;
  $("#page-progress-bar").style.width = `${percent}%`;
}

function attachEvents() {
  $$('[data-go]').forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.go));
  });

  $("#theme-toggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(next);
  });

  $("#lecture-picker").addEventListener("change", (event) => {
    const selected = lectures.find((item) => item.id === event.target.value);
    if (!selected) return;
    lecture = selected;
    completed = new Set(storage.get(`psycholearn:${lecture.id}:completed`, []));
    cardIndex = 0;
    $("#reader-search").value = "";
    setText("#search-status", "");
    const params = new URLSearchParams(location.search);
    params.set("lecture", lecture.id);
    history.replaceState({}, "", `${location.pathname}?${params.toString()}#overview`);
    renderLecture();
    navigate("overview", false);
  });

  $("#reader-search").addEventListener("input", filterSections);
  $("#toggle-sections").addEventListener("click", toggleAllSections);
  $("#font-decrease").addEventListener("click", () => changeFontScale(-0.05));
  $("#font-increase").addEventListener("click", () => changeFontScale(0.05));
  $("#flashcard").addEventListener("click", () => $("#flashcard").classList.toggle("is-flipped"));
  $("#card-prev").addEventListener("click", () => moveCard(-1));
  $("#card-next").addEventListener("click", () => moveCard(1));
  $("#quiz-next").addEventListener("click", nextQuizQuestion);
  $("#quiz-restart").addEventListener("click", resetQuiz);

  addEventListener("popstate", () => navigate(location.hash.slice(1) || "overview", false));
  addEventListener("scroll", updatePageProgress, { passive: true });
  addEventListener("resize", updatePageProgress, { passive: true });
  addEventListener("keydown", (event) => {
    if (event.code !== "Space" || currentView !== "cards") return;
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    event.preventDefault();
    $("#flashcard").classList.toggle("is-flipped");
  });
}

initialiseTheme();
populateLecturePicker();
renderLecture();
attachEvents();
navigate(location.hash.slice(1) || "overview", false);
