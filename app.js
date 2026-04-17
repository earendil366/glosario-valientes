// 🎼 CHORDPRO
const parser = new chordsheetjs.ChordProParser();
const formatter = new chordsheetjs.HtmlDivFormatter();
let song = null;

// 🎯 UI
const viewer = document.getElementById("viewer");
const songsDiv = document.getElementById("songs");
const setlistsDiv = document.getElementById("setlists");
const fileInput = document.getElementById("fileInput");

// 💾 BASE DE DATOS
let db;

const request = indexedDB.open("ChordDB", 1);

request.onupgradeneeded = e => {
  db = e.target.result;
  db.createObjectStore("songs", { keyPath: "id", autoIncrement: true });
  db.createObjectStore("setlists", { keyPath: "id", autoIncrement: true });
};

request.onsuccess = e => {
  db = e.target.result;
  loadSongs();
  loadSetlists();
};

// ➕ GUARDAR CANCIÓN
function saveSong(title, content) {
  const tx = db.transaction("songs", "readwrite");
  tx.objectStore("songs").add({ title, content });
}

// 📚 CARGAR CANCIONES
function loadSongs() {
  songsDiv.innerHTML = "";
  const tx = db.transaction("songs", "readonly");
  const store = tx.objectStore("songs");

  store.openCursor().onsuccess = e => {
    const cursor = e.target.result;
    if (cursor) {
      const div = document.createElement("div");
      div.textContent = cursor.value.title;
      div.onclick = () => render(cursor.value.content);
      songsDiv.appendChild(div);
      cursor.continue();
    }
  };
}

// 🗂 SETLISTS
function saveSetlist(name) {
  const tx = db.transaction("setlists", "readwrite");
  tx.objectStore("setlists").add({ name });
}

function loadSetlists() {
  setlistsDiv.innerHTML = "";
  const tx = db.transaction("setlists", "readonly");

  tx.objectStore("setlists").openCursor().onsuccess = e => {
    const cursor = e.target.result;
    if (cursor) {
      const div = document.createElement("div");
      div.textContent = "📁 " + cursor.value.name;
      setlistsDiv.appendChild(div);
      cursor.continue();
    }
  };
}

// 🎼 RENDER
function render(text) {
  song = parser.parse(text);
  viewer.innerHTML = formatter.format(song);
}

// 📂 IMPORTAR ARCHIVOS
document.getElementById("importBtn").onclick = () => fileInput.click();

fileInput.onchange = async e => {
  for (let file of e.target.files) {
    const text = await file.text();
    saveSong(file.name, text);
  }
  loadSongs();
};

// 🗂 CREAR SETLIST
document.getElementById("newSetlist").onclick = () => {
  const name = prompt("Nombre del setlist:");
  if (!name) return;
  saveSetlist(name);
  loadSetlists();
};

// 🔎 BUSCAR
document.getElementById("search").oninput = e => {
  const term = e.target.value.toLowerCase();

  const tx = db.transaction("songs", "readonly");
  const store = tx.objectStore("songs");

  songsDiv.innerHTML = "";

  store.openCursor().onsuccess = ev => {
    const cursor = ev.target.result;
    if (cursor) {
      if (cursor.value.title.toLowerCase().includes(term)) {
        const div = document.createElement("div");
        div.textContent = cursor.value.title;
        div.onclick = () => render(cursor.value.content);
        songsDiv.appendChild(div);
      }
      cursor.continue();
    }
  };
};

// 🎹 TRANSPOSICIÓN
document.getElementById("transposeUp").onclick = () => {
  song = song.transpose(1);
  viewer.innerHTML = formatter.format(song);
};

document.getElementById("transposeDown").onclick = () => {
  song = song.transpose(-1);
  viewer.innerHTML = formatter.format(song);
};

// 🔍 TAMAÑO LETRA
document.getElementById("fontSize").oninput = e => {
  viewer.style.fontSize = e.target.value + "px";
};

// ⏱ SCROLL
let scrolling = false;
let speed = 1;

document.getElementById("speed").oninput = e => speed = e.target.value;

document.getElementById("playScroll").onclick = () => {
  scrolling = true;
  scrollLoop();
};

document.getElementById("stopScroll").onclick = () => scrolling = false;

function scrollLoop() {
  if (!scrolling) return;
  viewer.scrollBy(0, speed);
  requestAnimationFrame(scrollLoop);
}