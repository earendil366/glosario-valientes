/**********************
 * 🎼 CHORDPRO
 **********************/
const parser = new chordsheetjs.ChordProParser();
const formatter = new chordsheetjs.HtmlDivFormatter();
let currentSong = null;

/**********************
 * 🎯 UI
 **********************/
const viewer = document.getElementById("viewer");
const keyLabel = document.getElementById("keyLabel");

const songsDiv = document.getElementById("songs");
const setlistsDiv = document.getElementById("setlists");

const importBtn = document.getElementById("importBtn");
const newSetlistBtn = document.getElementById("newSetlist");
const fileInput = document.getElementById("fileInput");
const searchInput = document.getElementById("search");

const transposeUpBtn = document.getElementById("transposeUp");
const transposeDownBtn = document.getElementById("transposeDown");

const playBtn = document.getElementById("playScroll");
const stopBtn = document.getElementById("stopScroll");
const speedInput = document.getElementById("speed");

const fontSizeInput = document.getElementById("fontSize");

/**********************
 * 💾 DATABASE (IndexedDB)
 **********************/
let db;

const request = indexedDB.open("ChordDB", 3);

request.onupgradeneeded = (e) => {
  db = e.target.result;

  if (!db.objectStoreNames.contains("songs")) {
    const s = db.createObjectStore("songs", { keyPath: "id", autoIncrement: true });
    s.createIndex("title", "title", { unique: false });
  }

  if (!db.objectStoreNames.contains("setlists")) {
    db.createObjectStore("setlists", { keyPath: "id", autoIncrement: true });
  }

  if (!db.objectStoreNames.contains("setlistSongs")) {
    // relación + orden opcional
    db.createObjectStore("setlistSongs", { keyPath: "id", autoIncrement: true });
  }
};

request.onsuccess = (e) => {
  db = e.target.result;
  loadSongs();
  loadSetlists();
};

request.onerror = () => {
  console.error("Error al abrir DB");
};

/**********************
 * 🧠 HELPERS
 **********************/
function extractTitle(text, fallback = "Sin título") {
  const m = text.match(/\{title:\s*(.*?)\}/i);
  return m ? m[1].trim() : fallback;
}

/**********************
 * 🎼 RENDER
 **********************/
function render(content) {
  currentSong = parser.parse(content);
  viewer.innerHTML = formatter.format(currentSong);
  updateKey();
}

function updateKey() {
  try {
    keyLabel.textContent = "Key: " + (currentSong?.metadata?.key || "—");
  } catch {
    keyLabel.textContent = "Key: —";
  }
}

/**********************
 * 📚 SONGS
 **********************/
function saveSong(title, content) {
  const tx = db.transaction("songs", "readwrite");
  tx.objectStore("songs").add({ title, content });
}

function loadSongs(filter = "") {
  songsDiv.innerHTML = "";
  const term = filter.toLowerCase();

  const tx = db.transaction("songs", "readonly");
  tx.objectStore("songs").openCursor().onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      const { id, title, content } = cursor.value;

      if (!term || title.toLowerCase().includes(term)) {
        const div = document.createElement("div");
        div.className = "item";
        div.textContent = title;

        // Drag
        div.draggable = true;
        div.ondragstart = (ev) => {
          ev.dataTransfer.setData("songId", id);
        };

        // Click
        div.onclick = () => render(content);

        songsDiv.appendChild(div);
      }

      cursor.continue();
    }
  };
}

/**********************
 * 🗂 SETLISTS
 **********************/
function saveSetlist(name) {
  const tx = db.transaction("setlists", "readwrite");
  tx.objectStore("setlists").add({ name });
}

function loadSetlists() {
  setlistsDiv.innerHTML = "";

  const tx = db.transaction("setlists", "readonly");
  tx.objectStore("setlists").openCursor().onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      createSetlistUI(cursor.value);
      cursor.continue();
    }
  };
}

function createSetlistUI(setlist) {
  const container = document.createElement("div");
  container.className = "setlist";

  const title = document.createElement("div");
  title.className = "setlist-title";
  title.textContent = "📁 " + setlist.name;

  const dropzone = document.createElement("div");
  dropzone.className = "dropzone";

  // Drag over
  dropzone.ondragover = (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  };

  dropzone.ondragleave = () => {
    dropzone.classList.remove("dragover");
  };

  // Drop
  dropzone.ondrop = (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");

    const songId = Number(e.dataTransfer.getData("songId"));
    if (!songId) return;

    addSongToSetlist(setlist.id, songId);
    renderSetlistSongs(dropzone, setlist.id);
  };

  container.appendChild(title);
  container.appendChild(dropzone);
  setlistsDiv.appendChild(container);

  renderSetlistSongs(dropzone, setlist.id);
}

/**********************
 * 🔗 RELACIONES
 **********************/
function addSongToSetlist(setlistId, songId) {
  const tx = db.transaction("setlistSongs", "readwrite");
  tx.objectStore("setlistSongs").add({ setlistId, songId });
}

function renderSetlistSongs(container, setlistId) {
  container.innerHTML = "";

  const tx = db.transaction(["setlistSongs", "songs"], "readonly");
  const relStore = tx.objectStore("setlistSongs");

  relStore.openCursor().onsuccess = (e) => {
    const cursor = e.target.result;

    if (cursor) {
      const rel = cursor.value;

      if (rel.setlistId === setlistId) {
        const songStore = tx.objectStore("songs");
        songStore.get(rel.songId).onsuccess = (ev) => {
          const song = ev.target.result;
          if (!song) return;

          const div = document.createElement("div");
          div.className = "item";
          div.textContent = song.title;

          div.onclick = () => render(song.content);

          container.appendChild(div);
        };
      }

      cursor.continue();
    }
  };
}

/**********************
 * 📂 IMPORTAR
 **********************/
importBtn.onclick = () => fileInput.click();

fileInput.onchange = async (e) => {
  for (let file of e.target.files) {
    const text = await file.text();
    const title = extractTitle(text, file.name);
    saveSong(title, text);
  }
  loadSongs();
};

/**********************
 * 🔎 BUSCAR
 **********************/
searchInput.oninput = (e) => {
  loadSongs(e.target.value);
};

/**********************
 * ➕ NUEVO SETLIST
 **********************/
newSetlistBtn.onclick = () => {
  const name = prompt("Nombre del setlist:");
  if (!name) return;
  saveSetlist(name);
  loadSetlists();
};

/**********************
 * 🎹 TRANSPOSICIÓN
 **********************/
transposeUpBtn.onclick = () => {
  if (!currentSong) return;
  currentSong = currentSong.transpose(1);
  viewer.innerHTML = formatter.format(currentSong);
  updateKey();
};

transposeDownBtn.onclick = () => {
  if (!currentSong) return;
  currentSong = currentSong.transpose(-1);
  viewer.innerHTML = formatter.format(currentSong);
  updateKey();
};

/**********************
 * 🔍 TAMAÑO LETRA
 **********************/
fontSizeInput.oninput = (e) => {
  viewer.style.fontSize = e.target.value + "px";
};

/**********************
 * ⏱ SCROLL
 **********************/
let scrolling = false;
let speed = 1;

speedInput.oninput = (e) => {
  speed = parseFloat(e.target.value);
};

playBtn.onclick = () => {
  scrolling = true;
  scrollLoop();
};

stopBtn.onclick = () => {
  scrolling = false;
};

function scrollLoop() {
  if (!scrolling) return;
  viewer.scrollBy(0, speed);
  requestAnimationFrame(scrollLoop);
}