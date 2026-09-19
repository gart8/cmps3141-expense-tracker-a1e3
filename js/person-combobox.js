const comboboxClass = "person-combobox";
const optionClass = "person-combobox-option";

function getSuggestions(input) {
  const listId = input.getAttribute("list") || input.dataset.suggestionsList;
  const list = listId ? document.getElementById(listId) : null;
  return [...(list?.options || [])].map(option => option.value).filter(Boolean);
}

function closeCombobox(combobox) {
  const input = combobox.querySelector("input");
  const list = combobox.querySelector("[role=listbox]");
  if (!input || !list) return;
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-activedescendant", "");
  list.hidden = true;
}

function chooseValue(combobox, value) {
  const input = combobox.querySelector("input");
  const list = combobox.querySelector("[role=listbox]");
  if (!input || !list) return;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-activedescendant", "");
  list.hidden = true;
}

function setActiveOption(combobox, index) {
  const input = combobox.querySelector("input");
  const options = [...combobox.querySelectorAll(`.${optionClass}`)];
  if (!input || !options.length) return;
  const nextIndex = (index + options.length) % options.length;
  options.forEach((option, optionIndex) => option.setAttribute("aria-selected", String(optionIndex === nextIndex)));
  input.dataset.activeIndex = String(nextIndex);
  input.setAttribute("aria-activedescendant", options[nextIndex].id);
  options[nextIndex].scrollIntoView({ block: "nearest" });
}

function renderOptions(combobox) {
  const input = combobox.querySelector("input");
  const list = combobox.querySelector("[role=listbox]");
  if (!input || !list) return;
  const query = input.value.trim().toLowerCase();
  const suggestions = [...new Set(getSuggestions(input))]
    .filter(person => person.toLowerCase().includes(query));
  list.innerHTML = suggestions.length
    ? suggestions.map((person, index) => `<li id="${list.id}-option-${index}" class="${optionClass}" role="option" aria-selected="false" data-value="${person}">${person}</li>`).join("")
    : '<li class="person-combobox-empty" role="status">No saved match. Press Enter to use this name.</li>';
  list.hidden = false;
  input.setAttribute("aria-expanded", "true");
  input.dataset.activeIndex = "-1";
}

function enhanceCombobox(input) {
  if (input.dataset.comboboxReady === "true") return;
  const listId = input.getAttribute("list");
  if (!listId) return;
  const datalist = document.getElementById(listId);
  if (!datalist) return;

  const combobox = document.createElement("div");
  combobox.className = comboboxClass;
  input.parentElement.insertBefore(combobox, input);
  combobox.appendChild(input);
  input.dataset.comboboxReady = "true";
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", `${input.id}-suggestions`);
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-activedescendant", "");
  input.dataset.suggestionsList = listId;
  input.removeAttribute("list");

  const list = document.createElement("ul");
  list.id = `${input.id}-suggestions`;
  list.className = "person-combobox-list";
  list.setAttribute("role", "listbox");
  list.hidden = true;
  combobox.appendChild(list);

  input.addEventListener("input", () => renderOptions(combobox));
  input.addEventListener("focus", () => renderOptions(combobox));
  input.addEventListener("keydown", event => {
    const options = [...combobox.querySelectorAll(`.${optionClass}`)];
    const activeIndex = Number(input.dataset.activeIndex || -1);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveOption(combobox, activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveOption(combobox, activeIndex - 1);
    } else if (event.key === "Enter") {
      if (input.getAttribute("aria-expanded") !== "true") return;
      event.preventDefault();
      if (options[activeIndex]) chooseValue(combobox, options[activeIndex].dataset.value);
      else if (input.value.trim()) chooseValue(combobox, input.value.trim());
    } else if (event.key === "Escape") {
      closeCombobox(combobox);
    }
  });

  list.addEventListener("mousedown", event => {
    const option = event.target.closest(`.${optionClass}`);
    if (option) chooseValue(combobox, option.dataset.value);
  });
}

function enhanceAllComboboxes() {
  document.querySelectorAll("input[data-person-combobox]").forEach(enhanceCombobox);
}

document.addEventListener("click", event => {
  document.querySelectorAll(`.${comboboxClass}`).forEach(combobox => {
    if (!combobox.contains(event.target)) closeCombobox(combobox);
  });
});

document.addEventListener("input", event => {
  if (event.target.matches("input[data-person-combobox]")) {
    renderOptions(event.target.closest(`.${comboboxClass}`));
  }
});

document.addEventListener("focusin", event => {
  if (event.target.matches("input[data-person-combobox]")) {
    renderOptions(event.target.closest(`.${comboboxClass}`));
  }
});

document.addEventListener("keydown", event => {
  const input = event.target.closest?.("input[data-person-combobox]");
  if (!input) return;
  const combobox = input.closest(`.${comboboxClass}`);
  const options = [...combobox.querySelectorAll(`.${optionClass}`)];
  const activeIndex = Number(input.dataset.activeIndex || -1);
  if (event.key === "ArrowDown") {
    event.preventDefault();
    setActiveOption(combobox, activeIndex + 1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    setActiveOption(combobox, activeIndex - 1);
  } else if (event.key === "Enter") {
    if (input.getAttribute("aria-expanded") !== "true") return;
    event.preventDefault();
    if (options[activeIndex]) chooseValue(combobox, options[activeIndex].dataset.value);
    else if (input.value.trim()) chooseValue(combobox, input.value.trim());
  } else if (event.key === "Escape") {
    closeCombobox(combobox);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  enhanceAllComboboxes();
  const observer = new MutationObserver(enhanceAllComboboxes);
  observer.observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
});
