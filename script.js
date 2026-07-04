const canvas = document.getElementById("cardCanvas");
const ctx = canvas.getContext("2d");
const cardFrame = document.querySelector(".card-frame");

const adminUsers = {
  mitpatel4235: "Mit@56566",
  admin2: "Mit@4235"
};

const defaultSize = { width: 1080, height: 1350 };
const defaultLayout = {
  photoX: 540,
  photoY: 250,
  photoSize: 420,
  titleX: 540,
  titleY: 800,
  titleSize: 58,
  nameX: 540,
  nameY: 925,
  nameSize: 116,
  messageX: 540,
  messageY: 1010,
  messageSize: 34
};

const baseTemplates = [
  {
    id: "premium-bloom",
    source: "builtin",
    name: "Premium Bloom",
    palette: ["#fbf2e4", "#b85d68", "#1f6f62", "#c99b3b"],
    size: { ...defaultSize },
    layout: { ...defaultLayout }
  },
  {
    id: "modern-gold",
    source: "builtin",
    name: "Modern Gold",
    palette: ["#f8f7f2", "#20201f", "#c99b3b", "#d7e6df"],
    size: { ...defaultSize },
    layout: { ...defaultLayout, photoY: 225, titleY: 790 }
  },
  {
    id: "fresh-celebration",
    source: "builtin",
    name: "Fresh Celebration",
    palette: ["#eef7f4", "#1f6f62", "#e1775f", "#f0c85a"],
    size: { ...defaultSize },
    layout: { ...defaultLayout, photoY: 270, nameY: 940 }
  }
];

let uploadedTemplates = JSON.parse(localStorage.getItem("wishCardTemplates") || "[]");
let hiddenBuiltIns = JSON.parse(localStorage.getItem("hiddenBuiltInTemplates") || "[]");
let builtInOverrides = JSON.parse(localStorage.getItem("builtInTemplateOverrides") || "{}");
let activeTemplate = 0;
let personImage = null;
let draftTemplate = null;
let editingRef = null;

const fields = {
  personUpload: document.getElementById("personUpload"),
  name: document.getElementById("nameInput"),
  message: document.getElementById("messageInput"),
  shape: document.getElementById("shapeInput"),
  template: document.getElementById("templateInput"),
  font: document.getElementById("fontInput"),
  zoom: document.getElementById("zoomInput"),
  x: document.getElementById("xInput"),
  y: document.getElementById("yInput"),
  download: document.getElementById("downloadCard"),
  confirmDownload: document.getElementById("confirmDownload"),
  downloadDialog: document.getElementById("downloadDialog"),
  adminToggle: document.getElementById("adminToggle"),
  adminBox: document.getElementById("adminBox"),
  adminId: document.getElementById("adminId"),
  adminPass: document.getElementById("adminPass"),
  loginButton: document.getElementById("loginButton"),
  logoutButton: document.getElementById("logoutButton"),
  templateName: document.getElementById("templateName"),
  templateUpload: document.getElementById("templateUpload"),
  saveLayoutButton: document.getElementById("saveLayoutButton"),
  selectedElement: document.getElementById("selectedElement"),
  templateList: document.getElementById("templateList"),
  adminStatus: document.getElementById("adminStatus")
};

const layoutInputs = Array.from(document.querySelectorAll("[data-layout]"));
const allRangeInputs = Array.from(document.querySelectorAll('input[type="range"]'));

function addNumberBoxForRange(range) {
  if (range.dataset.numberLinked === "true") return;
  const number = document.createElement("input");
  number.type = "number";
  number.className = "range-number";
  number.value = range.value;
  number.min = range.min;
  number.max = range.max;
  number.step = range.step || "1";
  number.setAttribute("aria-label", `${range.closest("label")?.textContent.trim() || "Value"} number value`);

  const pair = document.createElement("span");
  pair.className = "range-pair";
  range.parentNode.insertBefore(pair, range);
  pair.append(range, number);

  range.dataset.numberLinked = "true";
  range.linkedNumber = number;
  number.linkedRange = range;

  range.addEventListener("input", () => {
    number.value = range.value;
  });
  range.addEventListener("change", () => {
    number.value = range.value;
  });
  number.addEventListener("input", () => {
    const min = Number(range.min);
    const max = Number(range.max);
    const next = Math.min(max, Math.max(min, Number(number.value)));
    range.value = String(next);
    number.value = String(next);
    range.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

allRangeInputs.forEach(addNumberBoxForRange);

function loadImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.src = src;
  });
}

function readUpload(file, callback) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => callback(await loadImage(reader.result), reader.result);
  reader.readAsDataURL(file);
}

function scaledDefaultLayout(width, height) {
  const xRatio = width / defaultSize.width;
  const yRatio = height / defaultSize.height;
  const scale = Math.min(xRatio, yRatio);
  return {
    photoX: Math.round(defaultLayout.photoX * xRatio),
    photoY: Math.round(defaultLayout.photoY * yRatio),
    photoSize: Math.round(defaultLayout.photoSize * scale),
    titleX: Math.round(defaultLayout.titleX * xRatio),
    titleY: Math.round(defaultLayout.titleY * yRatio),
    titleSize: Math.round(defaultLayout.titleSize * scale),
    nameX: Math.round(defaultLayout.nameX * xRatio),
    nameY: Math.round(defaultLayout.nameY * yRatio),
    nameSize: Math.round(defaultLayout.nameSize * scale),
    messageX: Math.round(defaultLayout.messageX * xRatio),
    messageY: Math.round(defaultLayout.messageY * yRatio),
    messageSize: Math.round(defaultLayout.messageSize * scale)
  };
}

function hydrateBuiltIns() {
  return baseTemplates
    .filter((template) => !hiddenBuiltIns.includes(template.id))
    .map((template) => ({
      ...template,
      ...(builtInOverrides[template.id] || {}),
      source: "builtin",
      id: template.id,
      palette: template.palette,
      size: { ...template.size, ...(builtInOverrides[template.id]?.size || {}) },
      layout: { ...template.layout, ...(builtInOverrides[template.id]?.layout || {}) }
    }));
}

function allTemplates() {
  return [...hydrateBuiltIns(), ...uploadedTemplates.map((template, index) => ({ ...template, source: "upload", uploadIndex: index }))];
}

function activeTemplateData() {
  if (draftTemplate) return draftTemplate;
  return allTemplates()[activeTemplate] || allTemplates()[0] || {
    id: "blank",
    name: "Blank",
    palette: ["#fbf2e4", "#b85d68", "#1f6f62", "#c99b3b"],
    size: { ...defaultSize },
    layout: { ...defaultLayout }
  };
}

function getLayout(template = activeTemplateData()) {
  return { ...scaledDefaultLayout(getSize(template).width, getSize(template).height), ...(template.layout || {}) };
}

function getSize(template = activeTemplateData()) {
  return { ...defaultSize, ...(template.size || {}) };
}

function applyCanvasSize(template = activeTemplateData()) {
  const size = getSize(template);
  if (canvas.width !== size.width) canvas.width = size.width;
  if (canvas.height !== size.height) canvas.height = size.height;
  cardFrame.style.setProperty("--card-ratio", `${size.width} / ${size.height}`);
  updateLayoutInputRanges(size);
}

function updateLayoutInputRanges(size) {
  layoutInputs.forEach((input) => {
    const key = input.dataset.layout;
    if (key.endsWith("X")) input.max = size.width;
    if (key.endsWith("Y")) input.max = size.height;
    if (key.endsWith("Size")) input.max = Math.max(80, Math.round(Math.max(size.width, size.height) * 0.7));
    if (input.linkedNumber) {
      input.linkedNumber.min = input.min;
      input.linkedNumber.max = input.max;
      input.linkedNumber.step = input.step || "1";
      input.linkedNumber.value = input.value;
    }
  });
}

function getAdminLayoutFromControls() {
  return layoutInputs.reduce((layout, input) => {
    layout[input.dataset.layout] = Number(input.value);
    return layout;
  }, {});
}

function setAdminControlsFromLayout(layout) {
  layoutInputs.forEach((input) => {
    input.value = layout[input.dataset.layout] ?? input.value;
    if (input.linkedNumber) input.linkedNumber.value = input.value;
  });
}

function updateSelectedElement() {
  document.querySelectorAll("[data-element-group]").forEach((group) => {
    group.classList.toggle("is-selected", group.dataset.elementGroup === fields.selectedElement.value);
  });
}

function persistUploadedTemplates() {
  const templatesToSave = uploadedTemplates.map(({ loadedImage, source, uploadIndex, ...item }) => item);
  localStorage.setItem("wishCardTemplates", JSON.stringify(templatesToSave));
}

function persistBuiltIns() {
  localStorage.setItem("hiddenBuiltInTemplates", JSON.stringify(hiddenBuiltIns));
  localStorage.setItem("builtInTemplateOverrides", JSON.stringify(builtInOverrides));
}

function renderTemplateList() {
  fields.templateList.innerHTML = "";
  const templates = allTemplates();
  if (!templates.length) {
    const empty = document.createElement("p");
    empty.className = "empty-list";
    empty.textContent = "No templates available.";
    fields.templateList.appendChild(empty);
    return;
  }

  templates.forEach((template, index) => {
    const row = document.createElement("div");
    row.className = "template-row";

    const name = document.createElement("span");
    name.textContent = template.name;

    const edit = document.createElement("button");
    edit.className = "edit-template";
    edit.type = "button";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => editTemplate(index));

    const remove = document.createElement("button");
    remove.className = "remove-template";
    remove.type = "button";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => deleteTemplate(index));

    row.append(name, edit, remove);
    fields.templateList.appendChild(row);
  });
}

function refreshTemplateOptions() {
  const templates = allTemplates();
  fields.template.innerHTML = "";
  templates.forEach((template, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = template.name;
    fields.template.appendChild(option);
  });
  activeTemplate = Math.min(activeTemplate, Math.max(templates.length - 1, 0));
  fields.template.value = String(activeTemplate);
  applyCanvasSize(activeTemplateData());
  setAdminControlsFromLayout(getLayout());
  renderTemplateList();
}

function drawBackground(template) {
  const size = getSize(template);
  const [base, primary, accent, soft] = template.palette || ["#fbf2e4", "#b85d68", "#1f6f62", "#c99b3b"];
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size.width, size.height);

  if (template.image && template.loadedImage) {
    ctx.drawImage(template.loadedImage, 0, 0, size.width, size.height);
    return;
  }

  ctx.fillStyle = soft;
  ctx.fillRect(size.width * 0.065, size.height * 0.06, size.width * 0.87, size.height * 0.88);
  ctx.strokeStyle = primary;
  ctx.lineWidth = Math.max(3, size.width * 0.007);
  ctx.strokeRect(size.width * 0.09, size.height * 0.08, size.width * 0.82, size.height * 0.84);

  ctx.fillStyle = accent;
  for (let i = 0; i < 18; i += 1) {
    const x = size.width * 0.08 + (i * 137) % Math.max(1, size.width * 0.84);
    const y = size.height * 0.06 + (i * 211) % Math.max(1, size.height * 0.86);
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.arc(x, y, 18 + (i % 3) * 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPhoto(image) {
  const layout = getLayout();
  const shape = fields.shape.value;
  const size = shape === "circle" ? layout.photoSize : layout.photoSize + 20;
  const x = layout.photoX - size / 2;
  const y = layout.photoY;
  const zoom = Number(fields.zoom.value);
  const moveX = Number(fields.x.value);
  const moveY = Number(fields.y.value);

  ctx.save();
  ctx.beginPath();
  if (shape === "circle") {
    ctx.arc(layout.photoX, y + size / 2, size / 2, 0, Math.PI * 2);
  } else {
    ctx.roundRect(x, y, size, size, Math.max(8, size * 0.08));
  }
  ctx.clip();

  if (image) {
    const scale = Math.max(size / image.width, size / image.height) * zoom;
    const width = image.width * scale;
    const height = image.height * scale;
    ctx.drawImage(image, x + (size - width) / 2 + moveX, y + (size - height) / 2 + moveY, width, height);
  } else {
    ctx.fillStyle = "#fffaf1";
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = "#b85d68";
    ctx.font = `800 ${Math.max(18, size * 0.1)}px Inter`;
    ctx.textAlign = "center";
    ctx.fillText("Upload Photo", layout.photoX, y + size / 2 + 14);
  }
  ctx.restore();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(4, size * 0.04);
  ctx.beginPath();
  if (shape === "circle") {
    ctx.arc(layout.photoX, y + size / 2, size / 2 + ctx.lineWidth / 2, 0, Math.PI * 2);
  } else {
    ctx.roundRect(x - ctx.lineWidth / 2, y - ctx.lineWidth / 2, size + ctx.lineWidth, size + ctx.lineWidth, Math.max(8, size * 0.09));
  }
  ctx.stroke();
}

function wrapText(text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  words.forEach((word, index) => {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = testLine;
    }
    if (index === words.length - 1) ctx.fillText(line, x, y);
  });
}

function drawCard() {
  const template = activeTemplateData();
  applyCanvasSize(template);
  const layout = getLayout(template);
  const size = getSize(template);
  const cardFont = fields.font.value || "Inter";
  drawBackground(template);
  drawPhoto(personImage);

  ctx.textAlign = "center";
  ctx.fillStyle = "#181716";
  ctx.font = `800 ${layout.titleSize}px "${cardFont}"`;
  ctx.fillText("Happy Birthday", layout.titleX, layout.titleY);

  ctx.fillStyle = template.palette?.[1] || "#b85d68";
  ctx.font = `800 ${layout.nameSize}px "${cardFont}"`;
  ctx.fillText(fields.name.value || "Your Name", layout.nameX, layout.nameY);

  ctx.fillStyle = "#514a43";
  ctx.font = `500 ${layout.messageSize}px "${cardFont}"`;
  wrapText(fields.message.value || "Wishing you the happiest day.", layout.messageX, layout.messageY, size.width * 0.7, layout.messageSize * 1.42);
}

function showDownloadDialog() {
  if (typeof fields.downloadDialog.showModal === "function") {
    fields.downloadDialog.showModal();
  } else if (window.confirm("Download this card as a PNG image?")) {
    downloadCard();
  }
}

function downloadCard() {
  const link = document.createElement("a");
  const safeName = (fields.name.value || "birthday-card").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  link.download = `${safeName}-wish-card.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
  if (fields.downloadDialog.open) fields.downloadDialog.close();
}

function loginAdmin() {
  const id = fields.adminId.value.trim();
  const pass = fields.adminPass.value;
  if (adminUsers[id] === pass) {
    fields.adminBox.classList.add("is-logged-in");
    fields.adminStatus.textContent = "Logged in. Upload, edit, remove, and save templates.";
  } else {
    fields.adminStatus.textContent = "Wrong admin ID or password.";
    fields.adminBox.classList.add("is-open");
  }
}

async function hydrateUploadedTemplates() {
  for (const template of uploadedTemplates) {
    if (template.image) template.loadedImage = await loadImage(template.image);
    template.size = getSize(template);
    template.layout = getLayout(template);
  }
  refreshTemplateOptions();
  drawCard();
}

function clearDraft() {
  draftTemplate = null;
  editingRef = null;
  fields.templateUpload.value = "";
  fields.templateName.value = "";
  setAdminControlsFromLayout(getLayout());
}

function editTemplate(index) {
  const template = allTemplates()[index];
  if (!template) return;
  draftTemplate = {
    ...template,
    layout: getLayout(template),
    size: getSize(template)
  };
  editingRef = template.source === "builtin"
    ? { source: "builtin", id: template.id }
    : { source: "upload", index: template.uploadIndex };
  fields.templateName.value = template.name;
  activeTemplate = index;
  applyCanvasSize(draftTemplate);
  setAdminControlsFromLayout(getLayout(draftTemplate));
  fields.adminStatus.textContent = `${template.name} is ready to edit. Adjust and click Save Layout.`;
  drawCard();
}

function deleteTemplate(index) {
  const template = allTemplates()[index];
  if (!template) return;
  if (template.source === "builtin") {
    hiddenBuiltIns = [...new Set([...hiddenBuiltIns, template.id])];
    delete builtInOverrides[template.id];
    persistBuiltIns();
  } else {
    uploadedTemplates.splice(template.uploadIndex, 1);
    persistUploadedTemplates();
  }
  if (editingRef && editingRef.id === template.id) clearDraft();
  activeTemplate = Math.max(0, Math.min(activeTemplate, allTemplates().length - 1));
  refreshTemplateOptions();
  fields.adminStatus.textContent = `${template.name} removed.`;
  drawCard();
}

function saveTemplate() {
  const name = fields.templateName.value.trim();
  if (!draftTemplate) {
    fields.adminStatus.textContent = "Upload or edit a template before saving.";
    return;
  }
  if (!name) {
    fields.adminStatus.textContent = "Enter a template name before saving.";
    fields.templateName.focus();
    return;
  }

  const saved = {
    ...draftTemplate,
    name,
    layout: getAdminLayoutFromControls(),
    size: getSize(draftTemplate)
  };

  if (editingRef?.source === "builtin") {
    builtInOverrides[editingRef.id] = {
      name: saved.name,
      size: saved.size,
      layout: saved.layout
    };
    persistBuiltIns();
    fields.adminStatus.textContent = `${name} updated.`;
  } else if (editingRef?.source === "upload") {
    uploadedTemplates[editingRef.index] = saved;
    persistUploadedTemplates();
    fields.adminStatus.textContent = `${name} updated.`;
  } else {
    uploadedTemplates.push(saved);
    persistUploadedTemplates();
    activeTemplate = allTemplates().length - 1;
    fields.adminStatus.textContent = `${name} saved and added for users.`;
  }

  clearDraft();
  refreshTemplateOptions();
  drawCard();
}

function selectElementFromCanvas(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  const layout = getLayout();
  const points = [
    { key: "photo", x: layout.photoX, y: layout.photoY + layout.photoSize / 2 },
    { key: "title", x: layout.titleX, y: layout.titleY },
    { key: "name", x: layout.nameX, y: layout.nameY },
    { key: "message", x: layout.messageX, y: layout.messageY }
  ];
  points.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
  fields.selectedElement.value = points[0].key;
  updateSelectedElement();
}

function updateDraftLayout() {
  activeTemplateData().layout = getAdminLayoutFromControls();
  drawCard();
}

fields.personUpload.addEventListener("change", (event) => {
  readUpload(event.target.files[0], (image) => {
    personImage = image;
    drawCard();
  });
});

["input", "change"].forEach((eventName) => {
  [fields.name, fields.message, fields.shape, fields.font, fields.zoom, fields.x, fields.y].forEach((field) => {
    field.addEventListener(eventName, drawCard);
  });
  layoutInputs.forEach((input) => input.addEventListener(eventName, updateDraftLayout));
});

fields.template.addEventListener("change", () => {
  draftTemplate = null;
  editingRef = null;
  activeTemplate = Number(fields.template.value);
  applyCanvasSize(activeTemplateData());
  setAdminControlsFromLayout(getLayout());
  drawCard();
});

fields.download.addEventListener("click", showDownloadDialog);
fields.confirmDownload.addEventListener("click", downloadCard);
fields.selectedElement.addEventListener("change", updateSelectedElement);
fields.adminToggle.addEventListener("click", () => fields.adminBox.classList.toggle("is-open"));
fields.loginButton.addEventListener("click", loginAdmin);
fields.logoutButton.addEventListener("click", () => {
  fields.adminBox.classList.remove("is-logged-in");
  fields.adminPass.value = "";
  fields.adminStatus.textContent = "";
});

fields.templateUpload.addEventListener("change", (event) => {
  readUpload(event.target.files[0], (image, src) => {
    const size = { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height };
    draftTemplate = {
      id: `template-${Date.now()}`,
      source: "upload",
      name: fields.templateName.value.trim() || "New Template Preview",
      image: src,
      loadedImage: image,
      size,
      layout: scaledDefaultLayout(size.width, size.height),
      palette: ["#fffaf2", "#b85d68", "#1f6f62", "#c99b3b"]
    };
    editingRef = null;
    applyCanvasSize(draftTemplate);
    setAdminControlsFromLayout(getLayout(draftTemplate));
    fields.adminStatus.textContent = "Template image uploaded. Adjust layout, enter a name, then click Save Layout.";
    drawCard();
  });
});

fields.saveLayoutButton.addEventListener("click", saveTemplate);
canvas.addEventListener("click", selectElementFromCanvas);

refreshTemplateOptions();
hydrateUploadedTemplates();
updateSelectedElement();
drawCard();
