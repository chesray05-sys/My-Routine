import React, { useState, useEffect, useRef } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────

const PRESET_FREQUENCIES = [
  { label: "One-time task", days: 0 },
  { label: "Every day", days: 1 },
  { label: "Every 2 days", days: 2 },
  { label: "Every 3 days", days: 3 },
  { label: "Once a week", days: 7 },
  { label: "Every 2 weeks", days: 14 },
  { label: "Once a month", days: 30 },
];

const DEFAULT_CATEGORIES = [
  { id: "hygiene", name: "Hygiene", color: "#60a5fa" },
  { id: "home", name: "Home", color: "#34d399" },
  { id: "health", name: "Health", color: "#f472b6" },
  { id: "work", name: "Work", color: "#a78bfa" },
];

const DEFAULT_TASKS = [
  { id: 1, name: "Clean litter box", frequencyDays: 1, lastCompleted: null, createdAt: new Date().toISOString(), categoryId: "home", notes: "", streak: 0, order: 0, previousState: null },
  { id: 2, name: "Water the plants", frequencyDays: 3, lastCompleted: null, createdAt: new Date().toISOString(), categoryId: "home", notes: "", streak: 0, order: 1, previousState: null },
  { id: 3, name: "Take out trash", frequencyDays: 7, lastCompleted: null, createdAt: new Date().toISOString(), categoryId: "home", notes: "", streak: 0, order: 2, previousState: null },
];

const COLOR_OPTIONS = [
  "#ef4444","#f97316","#f59e0b","#84cc16","#22c55e","#14b8a6",
  "#06b6d4","#3b82f6","#6366f1","#8b5cf6","#ec4899","#f43f5e",
  "#a78bfa","#34d399","#60a5fa","#f472b6",
];

const VERSION = "v1.5";

// ─── Time helpers ─────────────────────────────────────────────────────────────

function getMidnightOf(isoStr) {
  const d = new Date(isoStr); d.setHours(0,0,0,0); return d;
}
function getNextMidnightAfter(isoStr) {
  const d = new Date(isoStr); d.setHours(0,0,0,0); d.setDate(d.getDate()+1); return d;
}
function todayMidnight() {
  const d = new Date(); d.setHours(0,0,0,0); return d;
}
function midnightsSinceCompletion(isoStr) {
  return Math.floor((todayMidnight() - getMidnightOf(isoStr)) / 86400000);
}
function midnightsSinceCreation(isoStr) {
  const diff = todayMidnight() - getNextMidnightAfter(isoStr);
  return diff < 0 ? 0 : Math.floor(diff / 86400000);
}

// ─── Task logic ───────────────────────────────────────────────────────────────

function isOneTime(task) { return task.frequencyDays === 0; }

function isCompleted(task) {
  if (!task.lastCompleted) return false;
  if (isOneTime(task)) return true;
  return midnightsSinceCompletion(task.lastCompleted) < task.frequencyDays;
}

function getDaysOverdue(task) {
  if (isOneTime(task)) return 0;
  if (task.lastCompleted) {
    return Math.max(0, midnightsSinceCompletion(task.lastCompleted) - task.frequencyDays);
  }
  return Math.max(0, midnightsSinceCreation(task.createdAt));
}

function getDaysUntilDue(task) {
  if (isOneTime(task) || !task.lastCompleted) return null;
  return Math.max(0, task.frequencyDays - midnightsSinceCompletion(task.lastCompleted));
}

function getActiveStatus(task) {
  const o = getDaysOverdue(task);
  if (o === 0) return "green";
  if (o === 1) return "yellow";
  if (o === 2) return "orange";
  if (o === 3) return "red";
  return "critical";
}

function isDueTomorrow(task) {
  if (isOneTime(task) || !isCompleted(task)) return false;
  return getDaysUntilDue(task) === 1;
}

function getDueLabel(task) {
  if (isOneTime(task)) return task.lastCompleted ? `done at ${formatTime(task.lastCompleted)}` : "one-time";
  if (isCompleted(task)) {
    const r = getDaysUntilDue(task);
    if (r === 0) return "due today";
    if (r === 1) return "due tomorrow";
    return `due in ${r} days`;
  }
  const o = getDaysOverdue(task);
  if (o === 0) return "due today";
  if (o === 1) return "1 day late";
  return `${o} days late`;
}

function getFrequencyLabel(days) {
  return PRESET_FREQUENCIES.find(f => f.days === days)?.label || `Every ${days} days`;
}

function formatTime(isoStr) {
  return new Date(isoStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDate(isoStr) {
  return new Date(isoStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Streak logic ─────────────────────────────────────────────────────────────

function updateStreak(task) {
  const overdue = getDaysOverdue(task);
  const gracePeriod = task.frequencyDays === 1 ? 0 : 1;
  if (overdue <= gracePeriod) return (task.streak || 0) + 1;
  return 0;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

function loadTasks() {
  const v3 = load("myroutine_tasks", null);
  if (v3) return v3.map(t => ({ previousState: null, ...t }));
  const old = load("tasklog_v3", null) || load("tasklog_v2", null);
  if (old) return old.map((t, i) => ({ ...t, categoryId: null, notes: "", streak: 0, order: i, previousState: null }));
  return DEFAULT_TASKS;
}

// ─── Status styles ────────────────────────────────────────────────────────────

const SS = {
  green:    { card: "border-emerald-400/40 bg-emerald-950/30", dot: "bg-emerald-400", dotAnim: "", badge: "bg-emerald-900/60 text-emerald-300 border border-emerald-600/40", cb: "border-emerald-700 hover:border-emerald-400" },
  yellow:   { card: "border-yellow-400/40 bg-yellow-950/20",   dot: "bg-yellow-400",  dotAnim: "", badge: "bg-yellow-900/60 text-yellow-300 border border-yellow-600/40",   cb: "border-yellow-700 hover:border-yellow-400" },
  orange:   { card: "border-orange-400/40 bg-orange-950/20",   dot: "bg-orange-400",  dotAnim: "", badge: "bg-orange-900/60 text-orange-300 border border-orange-600/40",   cb: "border-orange-700 hover:border-orange-400" },
  red:      { card: "border-red-400/50 bg-red-950/25",         dot: "bg-red-500",     dotAnim: "", badge: "bg-red-900/60 text-red-300 border border-red-600/40",             cb: "border-red-700 hover:border-red-400" },
  critical: { card: "border-red-500/60 bg-red-950/30",         dot: "bg-red-500",     dotAnim: "pulse-critical", badge: "bg-red-900/70 text-orange-300 border border-red-500/60", cb: "border-red-600 hover:border-orange-400" },
};
const STATUS_ORDER = { critical:0, red:1, orange:2, yellow:3, green:4 };

// ─── Small Components ─────────────────────────────────────────────────────────

function Checkbox({ checked, status, onChange }) {
  const s = SS[status] || SS.green;
  return (
    <button onClick={onChange}
      className={`w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-all duration-150 ${checked ? "bg-zinc-600 border-zinc-600" : `bg-transparent ${s.cb}`}`}>
      {checked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
    </button>
  );
}

function CategoryTag({ color, dark }) {
  return (
    <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: color || (dark ? "#52525b" : "#d4d4d8") }} />
  );
}

function Modal({ children, onClose }) {
  return (
    <div className="modal-bg fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box w-full max-w-sm shadow-2xl">{children}</div>
    </div>
  );
}

function ColourPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-8 gap-2">
      {COLOR_OPTIONS.map(c => (
        <button key={c} onClick={() => onChange(c)}
          className={`w-7 h-7 rounded-full border-2 transition-all ${value === c ? "border-white scale-110" : "border-transparent"}`}
          style={{ backgroundColor: c }} />
      ))}
    </div>
  );
}

function GridIcon({ active }) {
  return (
    <div className="grid grid-cols-2 gap-0.5 w-3.5 h-3.5">
      {[0,1,2,3].map(i => <div key={i} className={`rounded-sm ${active ? "bg-emerald-400" : "bg-zinc-500"}`} />)}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [tasks, setTasks] = useState(loadTasks);
  const [categories, setCategories] = useState(() => load("myroutine_cats", DEFAULT_CATEGORIES));
  const [dark, setDark] = useState(() => load("myroutine_dark", true));
  const [gridView, setGridView] = useState(() => load("myroutine_grid", false));

  // Filters
  const [filterCatIds, setFilterCatIds] = useState([]);
  const [filterStatus, setFilterStatus] = useState(null);

  const [completedOpen, setCompletedOpen] = useState(true);
  const [now, setNow] = useState(new Date());

  // Modals
  const [showAddTask, setShowAddTask] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [longPressTask, setLongPressTask] = useState(null);
  const [showAddCat, setShowAddCat] = useState(false);
  const [showCatManager, setShowCatManager] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [showTaskAssign, setShowTaskAssign] = useState(false);
  const [assigningTask, setAssigningTask] = useState(null);

  // New task form
  const [newName, setNewName] = useState("");
  const [newFreqPreset, setNewFreqPreset] = useState(1);
  const [newCustomDays, setNewCustomDays] = useState(2);
  const [newFreqMode, setNewFreqMode] = useState("preset");
  const [newCatId, setNewCatId] = useState(null);

  // New category form
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState(COLOR_OPTIONS[0]);

  // Edit category form
  const [editCatName, setEditCatName] = useState("");
  const [editCatColor, setEditCatColor] = useState(COLOR_OPTIONS[0]);

  // Edit task form
  const [editName, setEditName] = useState("");
  const [editFreqPreset, setEditFreqPreset] = useState(1);
  const [editCustomDays, setEditCustomDays] = useState(2);
  const [editFreqMode, setEditFreqMode] = useState("preset");
  const [editCatId, setEditCatId] = useState(null);
  const [editNotes, setEditNotes] = useState("");
  const [editMode, setEditMode] = useState(false);

  // Drag state
  const dragItem = useRef(null);
  const dragOver = useRef(null);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  useEffect(() => { save("myroutine_tasks", tasks); }, [tasks]);
  useEffect(() => { save("myroutine_cats", categories); }, [categories]);
  useEffect(() => { save("myroutine_dark", dark); }, [dark]);
  useEffect(() => { save("myroutine_grid", gridView); }, [gridView]);

  // Long press (1200ms) on category tag / checkbox zone -> edit task panel
  const longPressTimer = useRef(null);
  const LONG_PRESS_MS = 1200;

  function openEditPanel(task) {
    setLongPressTask(task);
    setEditName(task.name);
    const preset = PRESET_FREQUENCIES.find(f => f.days === task.frequencyDays);
    if (preset) { setEditFreqMode("preset"); setEditFreqPreset(task.frequencyDays); }
    else { setEditFreqMode("custom"); setEditCustomDays(task.frequencyDays); }
    setEditCatId(task.categoryId || null);
    setEditNotes(task.notes || "");
    setEditMode(false);
  }

  function onLeftZonePressStart(e, task) {
    e.stopPropagation();
    longPressTimer.current = setTimeout(() => openEditPanel(task), LONG_PRESS_MS);
  }
  function onPressEnd() { clearTimeout(longPressTimer.current); }

  // Toggle complete / undo
  function toggleTask(id) {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      if (isCompleted(t)) {
        if (isOneTime(t)) return t;
        if (t.previousState) {
          return { ...t, lastCompleted: t.previousState.lastCompleted, streak: t.previousState.streak, previousState: null };
        }
        return { ...t, lastCompleted: null, previousState: null };
      }
      const newStreak = updateStreak(t);
      return {
        ...t,
        previousState: { lastCompleted: t.lastCompleted, streak: t.streak },
        lastCompleted: new Date().toISOString(),
        streak: newStreak,
        order: 9999,
      };
    }));
  }

  function deleteTask(id) {
    setTasks(prev => prev.filter(t => t.id !== id));
    setDeleteConfirm(null);
    setLongPressTask(null);
  }

  function addTask() {
    if (!newName.trim()) return;
    const days = newFreqMode === "custom" ? Math.max(1, newCustomDays) : newFreqPreset;
    const newTask = {
      id: Date.now(), name: newName.trim(), frequencyDays: days,
      lastCompleted: null, createdAt: new Date().toISOString(),
      categoryId: newCatId, notes: "", streak: 0,
      order: tasks.length, previousState: null,
    };
    setTasks(prev => [...prev, newTask]);
    setNewName(""); setNewFreqPreset(1); setNewFreqMode("preset"); setNewCatId(null);
    setShowAddTask(false);
  }

  function saveEdit() {
    if (!longPressTask) return;
    const days = editFreqMode === "custom" ? Math.max(1, editCustomDays) : editFreqPreset;
    setTasks(prev => prev.map(t => t.id === longPressTask.id
      ? { ...t, name: editName.trim() || t.name, frequencyDays: days, categoryId: editCatId, notes: editNotes }
      : t
    ));
    setLongPressTask(null);
  }

  function addCategory() {
    if (!newCatName.trim()) return;
    const cat = { id: Date.now().toString(), name: newCatName.trim(), color: newCatColor };
    setCategories(prev => [...prev, cat]);
    setNewCatName(""); setNewCatColor(COLOR_OPTIONS[0]);
    setShowAddCat(false);
  }

  // ── Categories manager actions ──
  function openEditCat(cat) {
    setEditingCat(cat);
    setEditCatName(cat.name);
    setEditCatColor(cat.color);
  }
  function saveEditCat() {
    setCategories(prev => prev.map(c => c.id === editingCat.id
      ? { ...c, name: editCatName.trim() || c.name, color: editCatColor }
      : c));
    setEditingCat(null);
  }
  function deleteCat(id) {
    setCategories(prev => prev.filter(c => c.id !== id));
    setTasks(prev => prev.map(t => t.categoryId === id ? { ...t, categoryId: null } : t));
    // remove from active filters too
    setFilterCatIds(prev => prev.filter(cid => cid !== id));
    setEditingCat(null);
  }
  function assignCat(taskId, catId) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, categoryId: catId } : t));
    setAssigningTask(null);
  }

  function getCat(catId) { return categories.find(c => c.id === catId) || null; }

  // ── Drag handlers ──
  function handleDragStart(e, id) { dragItem.current = id; e.dataTransfer.effectAllowed = "move"; }
  function handleDragEnter(e, id) { dragOver.current = id; }
  function handleDragEnd() {
    if (dragItem.current === null || dragOver.current === null || dragItem.current === dragOver.current) {
      dragItem.current = null; dragOver.current = null; return;
    }
    setTasks(prev => {
      const arr = [...prev];
      const fromIdx = arr.findIndex(t => t.id === dragItem.current);
      const toIdx = arr.findIndex(t => t.id === dragOver.current);
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return arr.map((t, i) => ({ ...t, order: i }));
    });
    dragItem.current = null; dragOver.current = null;
  }

  // ── Filter helpers ──
  function toggleCatFilter(catId) {
    setFilterCatIds(prev => prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]);
  }
  function toggleStatusFilter(status) {
    setFilterStatus(prev => prev === status ? null : status);
  }
  function clearAllFilters() {
    setFilterCatIds([]);
    setFilterStatus(null);
  }

  // ── Sorting & filtering ──
  const activeTasks = tasks.filter(t => !isCompleted(t));
  const completedTasks = tasks.filter(t => isCompleted(t));

  function applyFilters(list) {
    return list.filter(t => {
      const catMatch = filterCatIds.length === 0 || filterCatIds.includes(t.categoryId);
      const statusMatch = !filterStatus || getActiveStatus(t) === filterStatus;
      return catMatch && statusMatch;
    });
  }

  const sortedActive = [...activeTasks].sort((a, b) => {
    const sa = getActiveStatus(a), sb = getActiveStatus(b);
    if (sa !== sb) return STATUS_ORDER[sa] - STATUS_ORDER[sb];
    return (a.order ?? 0) - (b.order ?? 0);
  });
  const filteredActive = applyFilters(sortedActive);

  const completedFiltered = completedTasks.filter(t => filterCatIds.length === 0 || filterCatIds.includes(t.categoryId));
  const completedDueTomorrow = completedFiltered.filter(t => isDueTomorrow(t))
    .sort((a, b) => new Date(b.lastCompleted) - new Date(a.lastCompleted));
  const completedRest = completedFiltered.filter(t => !isDueTomorrow(t))
    .sort((a, b) => new Date(b.lastCompleted) - new Date(a.lastCompleted));
  const sortedCompleted = [...completedDueTomorrow, ...completedRest];

  const counts = { critical:0, red:0, orange:0, yellow:0, green:0 };
  activeTasks.forEach(t => counts[getActiveStatus(t)]++);

  const hasFilters = filterCatIds.length > 0 || filterStatus !== null;

  // ── Theme ──
  const bg = dark ? "bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-black";
  const textMain = dark ? "text-zinc-100" : "text-black";
  const textBody = dark ? "text-zinc-300" : "text-black";
  const subText = dark ? "text-zinc-500" : "text-black";
  const mutedText = dark ? "text-zinc-600" : "text-black";
  const inputCls = dark
    ? "bg-zinc-800 border-zinc-700 text-zinc-100 placeholder-zinc-600 focus:border-emerald-500"
    : "bg-white border-zinc-300 text-black placeholder-zinc-400 focus:border-emerald-500";
  const modalBg = dark ? "bg-zinc-900 border-zinc-700" : "bg-white border-zinc-200";
  const cardLineCls = dark ? "border-zinc-800" : "border-zinc-200";
  const hoverPanel = dark ? "hover:bg-zinc-800" : "hover:bg-zinc-100";
  const dashedBtn = dark
    ? "border-zinc-800 text-zinc-600 hover:border-emerald-700 hover:text-emerald-400 hover:bg-emerald-950/20"
    : "border-zinc-300 text-black hover:border-emerald-500 hover:bg-emerald-50";
  const pillBorder = dark ? "border-zinc-700" : "border-zinc-300";
  const dividerCls = dark ? "bg-zinc-800 group-hover:bg-zinc-700" : "bg-zinc-200 group-hover:bg-zinc-300";

  const freqDays = newFreqMode === "custom" ? Math.max(1, newCustomDays) : newFreqPreset;

  // Uncategorised / grouped tasks for category manager
  const uncatTasks = tasks.filter(t => !t.categoryId);
  const catGroups = categories.map(c => ({ cat: c, tasks: tasks.filter(t => t.categoryId === c.id) })).filter(g => g.tasks.length > 0);

  return (
    <div style={{ fontFamily: "'DM Mono', 'Courier New', monospace" }} className={`min-h-screen ${bg} px-4 py-10 transition-colors duration-200`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');
        .task-card { transition: transform 0.15s ease; }
        .task-card:hover { transform: translateY(-1px); }
        .modal-bg { animation: fadeIn 0.15s ease; }
        .modal-box { animation: slideUp 0.2s ease; border-radius: 1rem; border-width: 1px; overflow: hidden; }
        @keyframes fadeIn { from{opacity:0}to{opacity:1} }
        @keyframes slideUp { from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1} }
        select option { background: #18181b; }
        .collapse-body { overflow:hidden; transition: max-height 0.3s ease, opacity 0.3s ease; }
        .collapse-body.open { max-height:9999px; opacity:1; }
        .collapse-body.closed { max-height:0; opacity:0; }
        @keyframes pulseCritical {
          0%,100%{background-color:#ef4444;box-shadow:0 0 6px #ef4444aa;}
          50%{background-color:#f97316;box-shadow:0 0 10px #f97316aa;}
        }
        .pulse-critical { animation: pulseCritical 1.2s ease-in-out infinite; }
        .filter-pill { cursor: pointer; transition: all 0.15s ease; }
        .filter-pill:active { transform: scale(0.95); }
        .clamp2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>

      {/* ── Header ── */}
      <div className="max-w-lg mx-auto mb-8">
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-3">
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em" }} className="text-5xl">
              <span className={textMain}>MY</span>
              <span className="text-emerald-400">ROUTINE</span>
            </h1>
            <button onClick={() => setDark(d => !d)}
              className={`mt-1 text-lg ${mutedText} hover:text-emerald-400 transition-colors`}
              title="Toggle theme">
              {dark ? "☀️" : "🌙"}
            </button>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-3">
              <button onClick={() => setShowFilter(true)}
                className={`text-sm ${filterCatIds.length > 0 ? "text-emerald-400" : mutedText} hover:text-emerald-400 transition-colors`} title="Filter categories">
                🔍{filterCatIds.length > 0 ? ` ${filterCatIds.length}` : ""}
              </button>
              <button onClick={() => { setShowCatManager(true); setShowTaskAssign(false); setAssigningTask(null); }}
                className={`text-xs px-2 py-1 rounded border ${pillBorder} ${mutedText} hover:border-emerald-600 hover:text-emerald-400 transition-colors`}
                title="Manage categories">
                Categories
              </button>
              <button onClick={() => setGridView(g => !g)} title="Toggle grid view"
                className={`p-1.5 rounded border ${gridView ? "border-emerald-500" : pillBorder} hover:border-emerald-500 transition-colors`}>
                <GridIcon active={gridView} />
              </button>
            </div>
            <span className={`${subText} text-xs`}>
              {now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </span>
            <button onClick={() => setShowAddTask(true)}
              className="text-emerald-400 hover:text-emerald-300 text-xl font-bold leading-none transition-colors" title="New task">
              +
            </button>
          </div>
        </div>

        {/* Active filters row */}
        {hasFilters && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {filterCatIds.map(id => {
              const cat = getCat(id);
              return cat ? (
                <div key={id} className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-emerald-600/50 bg-emerald-950/30">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="text-xs text-emerald-400">{cat.name}</span>
                  <button onClick={() => toggleCatFilter(id)} className="text-xs text-emerald-600 hover:text-red-400 ml-0.5">×</button>
                </div>
              ) : null;
            })}
            {filterStatus && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-emerald-600/50 bg-emerald-950/30">
                <span className="text-xs text-emerald-400 capitalize">{filterStatus}</span>
                <button onClick={() => setFilterStatus(null)} className="text-xs text-emerald-600 hover:text-red-400 ml-0.5">×</button>
              </div>
            )}
            <button onClick={clearAllFilters} className={`text-xs ${mutedText} hover:text-red-400 transition-colors`}>clear all</button>
          </div>
        )}

        <div className={`h-px bg-gradient-to-r from-emerald-500/60 via-zinc-600/40 to-transparent my-3`} />

        {/* Summary pills */}
        <div className="flex gap-2 flex-wrap text-xs">
          {counts.critical > 0 && (
            <button onClick={() => toggleStatusFilter("critical")}
              className={`filter-pill px-2 py-1 rounded border ${filterStatus === "critical" ? "bg-red-900/80 text-orange-200 border-red-500" : "bg-red-900/60 text-orange-300 border-red-600/50"}`}>
              {counts.critical} critical
            </button>
          )}
          {counts.red > 0 && (
            <button onClick={() => toggleStatusFilter("red")}
              className={`filter-pill px-2 py-1 rounded border ${filterStatus === "red" ? "bg-red-900/80 text-red-200 border-red-500" : "bg-red-900/50 text-red-300 border-red-700/40"}`}>
              {counts.red} overdue
            </button>
          )}
          {counts.orange > 0 && (
            <button onClick={() => toggleStatusFilter("orange")}
              className={`filter-pill px-2 py-1 rounded border ${filterStatus === "orange" ? "bg-orange-900/80 text-orange-200 border-orange-500" : "bg-orange-900/50 text-orange-300 border-orange-700/40"}`}>
              {counts.orange} late
            </button>
          )}
          {counts.yellow > 0 && (
            <button onClick={() => toggleStatusFilter("yellow")}
              className={`filter-pill px-2 py-1 rounded border ${filterStatus === "yellow" ? "bg-yellow-900/80 text-yellow-200 border-yellow-500" : "bg-yellow-900/50 text-yellow-300 border-yellow-700/40"}`}>
              {counts.yellow} due soon
            </button>
          )}
          {counts.green > 0 && (
            <button onClick={() => toggleStatusFilter("green")}
              className={`filter-pill px-2 py-1 rounded border ${filterStatus === "green" ? "bg-emerald-900/80 text-emerald-200 border-emerald-500" : "bg-emerald-900/50 text-emerald-300 border-emerald-700/40"}`}>
              {counts.green} on track
            </button>
          )}
          {tasks.length === 0 && <span className={`${mutedText} py-1`}>No tasks yet</span>}
        </div>
      </div>

      {/* ── Task List ── */}
      <div className="max-w-lg mx-auto space-y-3">

        {/* Active tasks: list or grid */}
        {!gridView && filteredActive.map(task => {
          const status = getActiveStatus(task);
          const s = SS[status];
          const cat = getCat(task.categoryId);
          return (
            <div key={task.id}
              draggable
              onDragStart={e => handleDragStart(e, task.id)}
              onDragEnter={e => handleDragEnter(e, task.id)}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
              className={`task-card rounded-xl border px-3 py-4 shadow-md ${s.card} cursor-grab active:cursor-grabbing`}>
              <div className="flex items-center gap-2">
                <div
                  onMouseDown={e => onLeftZonePressStart(e, task)}
                  onMouseUp={e => { e.stopPropagation(); onPressEnd(); }}
                  onMouseLeave={onPressEnd}
                  onTouchStart={e => onLeftZonePressStart(e, task)}
                  onTouchEnd={e => { e.stopPropagation(); onPressEnd(); }}
                  className="flex items-center gap-2 self-stretch cursor-pointer"
                  title="Hold to edit">
                  <CategoryTag color={cat?.color} dark={dark} />
                  <Checkbox checked={false} status={status} onChange={() => toggleTask(task.id)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${textMain}`}>{task.name}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`${subText} text-xs`}>{getFrequencyLabel(task.frequencyDays)}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${s.badge}`}>{getDueLabel(task)}</span>
                    {(task.streak || 0) > 0 && <span className="text-xs text-orange-400">🔥 {task.streak}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className={`w-2.5 h-2.5 rounded-full ${s.dot} ${s.dotAnim}`} />
                  <button onClick={e => { e.stopPropagation(); setDeleteConfirm(task.id); }}
                    className={`w-7 h-7 rounded-lg border ${dark ? "border-zinc-800 bg-zinc-900/60 text-zinc-600" : "border-zinc-200 bg-zinc-100 text-black"} flex items-center justify-center hover:text-red-400 hover:border-red-800 hover:bg-red-950/40 transition-colors text-lg leading-none`}>
                    ×
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Grid view */}
        {gridView && filteredActive.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5">
            {filteredActive.map(task => {
              const status = getActiveStatus(task);
              const s = SS[status];
              const cat = getCat(task.categoryId);
              return (
                <div key={task.id}
                  draggable
                  onDragStart={e => handleDragStart(e, task.id)}
                  onDragEnter={e => handleDragEnter(e, task.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={e => e.preventDefault()}
                  className={`task-card relative rounded-xl border p-3 shadow-md ${s.card} cursor-grab active:cursor-grabbing flex flex-col gap-2 min-h-[92px]`}>
                  <button onClick={e => { e.stopPropagation(); setDeleteConfirm(task.id); }}
                    className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-lg border ${dark ? "border-zinc-800 bg-zinc-900/60 text-zinc-600" : "border-zinc-200 bg-zinc-100 text-black"} flex items-center justify-center hover:text-red-400 hover:border-red-800 hover:bg-red-950/40 transition-colors text-base leading-none`}>
                    ×
                  </button>
                  <div className="flex items-start gap-2 pr-6">
                    <div
                      onMouseDown={e => onLeftZonePressStart(e, task)}
                      onMouseUp={e => { e.stopPropagation(); onPressEnd(); }}
                      onMouseLeave={onPressEnd}
                      onTouchStart={e => onLeftZonePressStart(e, task)}
                      onTouchEnd={e => { e.stopPropagation(); onPressEnd(); }}
                      className="flex items-center gap-2 self-stretch cursor-pointer"
                      title="Hold to edit">
                      <CategoryTag color={cat?.color} dark={dark} />
                      <Checkbox checked={false} status={status} onChange={() => toggleTask(task.id)} />
                    </div>
                    <div className={`text-sm font-medium clamp2 ${textMain}`}>{task.name}</div>
                  </div>
                  <div className="flex items-center justify-between mt-auto">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${s.badge}`}>{getDueLabel(task)}</span>
                    <div className="flex items-center gap-1.5">
                      {(task.streak || 0) > 0 && <span className="text-xs text-orange-400">🔥{task.streak}</span>}
                      <div className={`w-2.5 h-2.5 rounded-full ${s.dot} ${s.dotAnim}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredActive.length === 0 && tasks.length > 0 && (
          <div className={`text-center ${mutedText} text-xs py-1`}>
            {hasFilters ? "No tasks match the current filter" : "All tasks completed ✓"}
          </div>
        )}

        {/* ── Completed Section ── */}
        {sortedCompleted.length > 0 && (
          <div className="pt-1">
            <button onClick={() => setCompletedOpen(o => !o)}
              className="w-full flex items-center gap-3 py-1 group">
              <div className={`flex-1 h-px ${dividerCls} transition-colors`} />
              <span className={`${mutedText} text-xs tracking-wider whitespace-nowrap group-hover:text-emerald-400 transition-colors flex items-center gap-1.5`}>
                {completedOpen ? "∧" : "∨"} Completed ({sortedCompleted.length})
              </span>
              <div className={`flex-1 h-px ${dividerCls} transition-colors`} />
            </button>

            <div className={`collapse-body ${completedOpen ? "open" : "closed"} space-y-3 mt-3`}>
              {sortedCompleted.map(task => {
                const cat = getCat(task.categoryId);
                const dueTomorrow = isDueTomorrow(task);
                const badgeCls = dueTomorrow
                  ? SS.green.badge
                  : (dark ? "bg-zinc-800/80 text-zinc-500 border border-zinc-700/40" : "bg-zinc-200 text-black border border-zinc-300/40");
                return (
                  <div key={task.id}
                    className={`task-card rounded-xl border px-3 py-4 opacity-55 ${dark ? "border-zinc-800/50 bg-zinc-900/20" : "border-zinc-200 bg-zinc-100/50"}`}>
                    <div className="flex items-center gap-2">
                      <div
                        onMouseDown={e => onLeftZonePressStart(e, task)}
                        onMouseUp={e => { e.stopPropagation(); onPressEnd(); }}
                        onMouseLeave={onPressEnd}
                        onTouchStart={e => onLeftZonePressStart(e, task)}
                        onTouchEnd={e => { e.stopPropagation(); onPressEnd(); }}
                        className="flex items-center gap-2 self-stretch cursor-pointer"
                        title="Hold to edit">
                        <CategoryTag color={cat?.color} dark={dark} />
                        <Checkbox checked={true} status="green" onChange={() => toggleTask(task.id)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium truncate line-through ${dark ? "text-zinc-500 decoration-zinc-600" : "text-black decoration-zinc-400"}`}>{task.name}</div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`${mutedText} text-xs`}>{getFrequencyLabel(task.frequencyDays)}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${badgeCls}`}>{getDueLabel(task)}</span>
                          {task.lastCompleted && !isOneTime(task) && <span className={`text-xs ${mutedText}`}>· done at {formatTime(task.lastCompleted)}</span>}
                        </div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); setDeleteConfirm(task.id); }}
                        className={`w-7 h-7 flex-shrink-0 rounded-lg border ${dark ? "border-zinc-800 bg-zinc-900/60 text-zinc-700" : "border-zinc-200 bg-zinc-100 text-black"} flex items-center justify-center hover:text-red-400 hover:border-red-800 hover:bg-red-950/40 transition-colors text-lg leading-none`}>
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Add task button ── */}
        <button onClick={() => setShowAddTask(true)}
          className={`w-full mt-2 py-3 rounded-xl border border-dashed ${dashedBtn} text-sm transition-all`}>
          + New Task
        </button>
      </div>

      {/* ── Legend ── */}
      <div className={`max-w-lg mx-auto mt-8 flex gap-4 text-xs ${mutedText} flex-wrap`}>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> On track</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> 1 day late</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> 2 days late</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> 3 days late</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block pulse-critical" /> 4+ days late</span>
      </div>

      {/* ── Version ── */}
      <div className={`max-w-lg mx-auto mt-4 text-center text-xs ${dark ? "text-zinc-800" : "text-zinc-300"}`}>
        {VERSION}
      </div>

      {/* ══════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════ */}

      {/* ── Add Task Modal ── */}
      {showAddTask && (
        <Modal onClose={() => setShowAddTask(false)}>
          <div className={`${modalBg} border rounded-2xl p-6`}>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em" }} className={`text-2xl mb-4 ${textMain}`}>NEW TASK</h2>
            <div className="space-y-4">
              <div>
                <label className={`block text-xs ${subText} mb-1.5 uppercase tracking-wider`}>Task name</label>
                <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addTask()}
                  placeholder="e.g. Change bedding"
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors ${inputCls}`} />
              </div>
              <div>
                <label className={`block text-xs ${subText} mb-1.5 uppercase tracking-wider`}>Frequency</label>
                <div className={`flex items-center gap-2 mb-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${newFreqMode === "custom" ? "border-emerald-500 bg-emerald-950/20" : `${pillBorder} hover:border-zinc-500`}`}
                  onClick={() => setNewFreqMode("custom")}>
                  <input type="radio" readOnly checked={newFreqMode === "custom"} className="accent-emerald-500" />
                  <span className={`text-sm ${textBody}`}>Every</span>
                  <input type="number" min="1" max="365" value={newCustomDays}
                    onClick={e => { e.stopPropagation(); setNewFreqMode("custom"); }}
                    onChange={e => setNewCustomDays(Number(e.target.value))}
                    className={`w-16 border rounded px-2 py-1 text-sm text-center focus:outline-none ${inputCls}`} />
                  <span className={`text-sm ${textBody}`}>days</span>
                </div>
                <select value={newFreqMode === "preset" ? newFreqPreset : ""}
                  onChange={e => { setNewFreqMode("preset"); setNewFreqPreset(Number(e.target.value)); }}
                  onClick={() => setNewFreqMode("preset")}
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors appearance-none cursor-pointer ${inputCls} ${newFreqMode === "preset" ? "border-emerald-500" : ""}`}>
                  {PRESET_FREQUENCIES.map(f => <option key={f.days} value={f.days}>{f.label}</option>)}
                </select>
              </div>
              {freqDays === 0 && <p className={`text-xs ${subText} ${dark ? "bg-zinc-800/60 border-zinc-700/50" : "bg-zinc-100 border-zinc-200"} rounded-lg px-3 py-2 border`}>One-time tasks stay completed permanently once checked off.</p>}
              <div>
                <label className={`block text-xs ${subText} mb-1.5 uppercase tracking-wider`}>Category</label>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setNewCatId(null)}
                    className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${!newCatId ? "border-emerald-500 text-emerald-400" : `${pillBorder} ${mutedText} hover:border-zinc-500`}`}>
                    None
                  </button>
                  {categories.map(cat => (
                    <button key={cat.id} onClick={() => setNewCatId(cat.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs border transition-colors flex items-center gap-1.5 ${newCatId === cat.id ? "border-emerald-500" : `${pillBorder} hover:border-zinc-500`}`}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className={textBody}>{cat.name}</span>
                    </button>
                  ))}
                  <button onClick={() => setShowAddCat(true)}
                    className={`px-2.5 py-1 rounded-lg text-xs border border-dashed ${dashedBtn} transition-colors`}>
                    + New
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowAddTask(false)} className={`flex-1 py-2.5 rounded-lg border ${pillBorder} ${mutedText} ${hoverPanel} text-sm transition-colors`}>Cancel</button>
              <button onClick={addTask} disabled={!newName.trim()} className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm font-medium transition-colors">Add Task</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Filter Modal ── */}
      {showFilter && (
        <Modal onClose={() => setShowFilter(false)}>
          <div className={`${modalBg} border rounded-2xl p-6`}>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em" }} className={`text-2xl mb-4 ${textMain}`}>FILTER</h2>
            <div className="space-y-2">
              <button onClick={() => setFilterCatIds([])}
                className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${filterCatIds.length === 0 ? "border-emerald-500 text-emerald-400" : `${pillBorder} ${mutedText} hover:border-zinc-500`}`}>
                All tasks
              </button>
              {categories.map(cat => (
                <button key={cat.id} onClick={() => toggleCatFilter(cat.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors flex items-center gap-2 ${filterCatIds.includes(cat.id) ? "border-emerald-500" : `${pillBorder} hover:border-zinc-500`}`}>
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className={textBody}>{cat.name}</span>
                  <span className={`ml-auto text-xs ${mutedText}`}>{tasks.filter(t => t.categoryId === cat.id).length}</span>
                  {filterCatIds.includes(cat.id) && <span className="text-emerald-400 text-xs">✓</span>}
                </button>
              ))}
            </div>
            <button onClick={() => setShowFilter(false)} className={`w-full mt-4 py-2.5 rounded-lg border ${pillBorder} ${mutedText} ${hoverPanel} text-sm transition-colors`}>Done</button>
          </div>
        </Modal>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteConfirm && (
        <Modal onClose={() => setDeleteConfirm(null)}>
          <div className={`${modalBg} border rounded-2xl p-6 text-center`}>
            <div className="text-3xl mb-3">🗑️</div>
            <h2 className={`text-base font-medium mb-1 ${textMain}`}>Delete task?</h2>
            <p className={`text-xs ${subText} mb-6`}>"{tasks.find(t => t.id === deleteConfirm)?.name}"</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className={`flex-1 py-2.5 rounded-lg border ${pillBorder} ${textBody} ${hoverPanel} text-sm font-medium transition-colors`}>Keep</button>
              <button onClick={() => deleteTask(deleteConfirm)} className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors">Delete</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Long Press / Task Detail Modal ── */}
      {longPressTask && (
        <Modal onClose={() => setLongPressTask(null)}>
          <div className={`${modalBg} border rounded-2xl p-6`}>
            {!editMode ? (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className={`text-base font-medium ${textMain}`}>{longPressTask.name}</h2>
                    <p className={`text-xs ${subText} mt-0.5`}>{getFrequencyLabel(longPressTask.frequencyDays)}</p>
                  </div>
                  {getCat(longPressTask.categoryId) && (
                    <span className="text-xs px-2 py-1 rounded-full text-white" style={{ backgroundColor: getCat(longPressTask.categoryId)?.color }}>
                      {getCat(longPressTask.categoryId)?.name}
                    </span>
                  )}
                </div>
                <div className={`space-y-3 text-sm ${textBody}`}>
                  <div className={`flex justify-between py-2 border-b ${cardLineCls}`}>
                    <span className={subText}>Status</span><span>{getDueLabel(longPressTask)}</span>
                  </div>
                  <div className={`flex justify-between py-2 border-b ${cardLineCls}`}>
                    <span className={subText}>Streak</span>
                    <span>{(longPressTask.streak || 0) > 0 ? `🔥 ${longPressTask.streak} in a row` : "No streak yet"}</span>
                  </div>
                  <div className={`flex justify-between py-2 border-b ${cardLineCls}`}>
                    <span className={subText}>Last completed</span>
                    <span>{longPressTask.lastCompleted ? formatDate(longPressTask.lastCompleted) : "Never"}</span>
                  </div>
                  <div className={`flex justify-between py-2 border-b ${cardLineCls}`}>
                    <span className={subText}>Created</span><span>{formatDate(longPressTask.createdAt)}</span>
                  </div>
                  {longPressTask.notes && (
                    <div className={`py-2 border-b ${cardLineCls}`}>
                      <span className={`${subText} block mb-1`}>Notes</span>
                      <span className="text-xs">{longPressTask.notes}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-5">
                  <button onClick={() => setLongPressTask(null)} className={`flex-1 py-2.5 rounded-lg border ${pillBorder} ${mutedText} ${hoverPanel} text-sm transition-colors`}>Close</button>
                  <button onClick={() => setEditMode(true)} className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors">Edit</button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em" }} className={`text-2xl mb-4 ${textMain}`}>EDIT TASK</h2>
                <div className="space-y-4">
                  <div>
                    <label className={`block text-xs ${subText} mb-1.5 uppercase tracking-wider`}>Task name</label>
                    <input value={editName} onChange={e => setEditName(e.target.value)}
                      className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors ${inputCls}`} />
                  </div>
                  <div>
                    <label className={`block text-xs ${subText} mb-1.5 uppercase tracking-wider`}>Frequency</label>
                    <div className={`flex items-center gap-2 mb-2 p-2.5 rounded-lg border cursor-pointer ${editFreqMode === "custom" ? "border-emerald-500 bg-emerald-950/20" : pillBorder}`}
                      onClick={() => setEditFreqMode("custom")}>
                      <input type="radio" readOnly checked={editFreqMode === "custom"} className="accent-emerald-500" />
                      <span className={`text-sm ${textBody}`}>Every</span>
                      <input type="number" min="1" max="365" value={editCustomDays}
                        onClick={e => { e.stopPropagation(); setEditFreqMode("custom"); }}
                        onChange={e => setEditCustomDays(Number(e.target.value))}
                        className={`w-16 border rounded px-2 py-1 text-sm text-center focus:outline-none ${inputCls}`} />
                      <span className={`text-sm ${textBody}`}>days</span>
                    </div>
                    <select value={editFreqMode === "preset" ? editFreqPreset : ""}
                      onChange={e => { setEditFreqMode("preset"); setEditFreqPreset(Number(e.target.value)); }}
                      onClick={() => setEditFreqMode("preset")}
                      className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none appearance-none cursor-pointer ${inputCls} ${editFreqMode === "preset" ? "border-emerald-500" : ""}`}>
                      {PRESET_FREQUENCIES.map(f => <option key={f.days} value={f.days}>{f.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-xs ${subText} mb-1.5 uppercase tracking-wider`}>Category</label>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setEditCatId(null)} className={`px-2.5 py-1 rounded-lg text-xs border ${!editCatId ? "border-emerald-500 text-emerald-400" : `${pillBorder} ${mutedText}`}`}>None</button>
                      {categories.map(cat => (
                        <button key={cat.id} onClick={() => setEditCatId(cat.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs border flex items-center gap-1.5 ${editCatId === cat.id ? "border-emerald-500" : pillBorder}`}>
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                          <span className={textBody}>{cat.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={`block text-xs ${subText} mb-1.5 uppercase tracking-wider`}>Notes</label>
                    <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3}
                      placeholder="Any notes about this task..."
                      className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none resize-none transition-colors ${inputCls}`} />
                  </div>
                </div>
                <div className="flex gap-2 mt-5">
                  <button onClick={() => setEditMode(false)} className={`flex-1 py-2.5 rounded-lg border ${pillBorder} ${mutedText} ${hoverPanel} text-sm transition-colors`}>Back</button>
                  <button onClick={saveEdit} className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors">Save</button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ── Add Category Modal ── */}
      {showAddCat && (
        <Modal onClose={() => setShowAddCat(false)}>
          <div className={`${modalBg} border rounded-2xl p-6`}>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em" }} className={`text-2xl mb-4 ${textMain}`}>NEW CATEGORY</h2>
            <div className="space-y-4">
              <div>
                <label className={`block text-xs ${subText} mb-1.5 uppercase tracking-wider`}>Name</label>
                <input autoFocus value={newCatName} onChange={e => setNewCatName(e.target.value)}
                  placeholder="e.g. Fitness"
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors ${inputCls}`} />
              </div>
              <div>
                <label className={`block text-xs ${subText} mb-1.5 uppercase tracking-wider`}>Colour</label>
                <ColourPicker value={newCatColor} onChange={setNewCatColor} />
                <div className="flex items-center gap-2 mt-3">
                  <div className="w-6 h-6 rounded-full" style={{ backgroundColor: newCatColor }} />
                  <span className={`text-xs ${subText}`}>{newCatName || "Preview"}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowAddCat(false)} className={`flex-1 py-2.5 rounded-lg border ${pillBorder} ${mutedText} ${hoverPanel} text-sm transition-colors`}>Cancel</button>
              <button onClick={addCategory} disabled={!newCatName.trim()} className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm font-medium transition-colors">Create</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Categories Manager Modal (large) ── */}
      {showCatManager && !editingCat && (
        <Modal onClose={() => setShowCatManager(false)}>
          <div className={`${modalBg} border`} style={{ maxHeight: "85vh", overflowY: "auto" }}>
            <div className="p-6 pb-0">
              <div className="flex items-center justify-between mb-4">
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em" }} className={`text-2xl ${textMain}`}>CATEGORIES</h2>
                <button onClick={() => setShowAddCat(true)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white transition-colors">
                  + New
                </button>
              </div>

              <div className="space-y-2 mb-4">
                {categories.length === 0 && <p className={`text-xs ${mutedText} text-center py-2`}>No categories yet</p>}
                {categories.map(cat => (
                  <div key={cat.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${cardLineCls} ${dark ? "bg-zinc-800/40" : "bg-zinc-50"}`}>
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className={`text-sm flex-1 ${textBody}`}>{cat.name}</span>
                    <span className={`text-xs ${mutedText}`}>{tasks.filter(t => t.categoryId === cat.id).length} tasks</span>
                    <button onClick={() => openEditCat(cat)}
                      className={`text-xs ${mutedText} hover:text-emerald-400 transition-colors px-1`}>
                      ✏️
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 mb-3">
                <div className={`flex-1 h-px ${dark ? "bg-zinc-800" : "bg-zinc-200"}`} />
                <button onClick={() => setShowTaskAssign(v => !v)}
                  className={`text-xs ${mutedText} hover:text-emerald-400 transition-colors whitespace-nowrap flex items-center gap-1`}>
                  {showTaskAssign ? "∧" : "+"} Assign tasks
                </button>
                <div className={`flex-1 h-px ${dark ? "bg-zinc-800" : "bg-zinc-200"}`} />
              </div>
            </div>

            {showTaskAssign && (
              <div className="px-6 pb-4 space-y-4">
                {uncatTasks.length > 0 && (
                  <div>
                    <p className={`text-xs ${mutedText} uppercase tracking-wider mb-2`}>Uncategorised</p>
                    <div className="space-y-1">
                      {uncatTasks.map(task => (
                        <div key={task.id}>
                          <button onClick={() => setAssigningTask(assigningTask === task.id ? null : task.id)}
                            className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors flex items-center justify-between
                              ${assigningTask === task.id ? "border-emerald-600 bg-emerald-950/20" : `${cardLineCls} hover:border-zinc-500 ${textBody}`}`}>
                            <span>{task.name}</span>
                            <span className={`${mutedText} text-xs`}>{assigningTask === task.id ? "∧" : "+"}</span>
                          </button>
                          {assigningTask === task.id && (
                            <div className="mt-1 pl-2 flex flex-wrap gap-1.5">
                              {categories.map(cat => (
                                <button key={cat.id} onClick={() => assignCat(task.id, cat.id)}
                                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${pillBorder} hover:border-emerald-600 transition-colors`}>
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                                  <span className={`text-xs ${textBody}`}>{cat.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {uncatTasks.length === 0 && (
                  <p className={`text-xs ${mutedText} text-center py-2`}>All tasks have a category ✓</p>
                )}

                {catGroups.map(({ cat, tasks: grpTasks }) => (
                  <div key={cat.id}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                      <p className={`text-xs ${mutedText} uppercase tracking-wider`}>{cat.name}</p>
                    </div>
                    <div className="space-y-1">
                      {grpTasks.map(task => (
                        <div key={task.id}>
                          <button onClick={() => setAssigningTask(assigningTask === task.id ? null : task.id)}
                            className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors flex items-center justify-between
                              ${assigningTask === task.id ? "border-emerald-600 bg-emerald-950/20" : `${cardLineCls} hover:border-zinc-500`}`}>
                            <span className={textBody}>{task.name}</span>
                            <span className={`${mutedText} text-xs`}>{assigningTask === task.id ? "∧" : "✎"}</span>
                          </button>
                          {assigningTask === task.id && (
                            <div className="mt-1 pl-2 flex flex-wrap gap-1.5">
                              <button onClick={() => assignCat(task.id, null)}
                                className={`px-2 py-1 rounded-lg border ${pillBorder} hover:border-red-700 text-xs ${mutedText} hover:text-red-400 transition-colors`}>
                                Clear
                              </button>
                              {categories.filter(c => c.id !== task.categoryId).map(c => (
                                <button key={c.id} onClick={() => assignCat(task.id, c.id)}
                                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${pillBorder} hover:border-emerald-600 transition-colors`}>
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                                  <span className={`text-xs ${textBody}`}>{c.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="px-6 pb-6 pt-2">
              <button onClick={() => setShowCatManager(false)}
                className={`w-full py-2.5 rounded-lg border ${pillBorder} ${mutedText} ${hoverPanel} text-sm transition-colors`}>
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Edit Category Modal (from manager) ── */}
      {editingCat && (
        <Modal onClose={() => setEditingCat(null)}>
          <div className={`${modalBg} border rounded-2xl p-6`}>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em" }} className={`text-2xl mb-4 ${textMain}`}>EDIT CATEGORY</h2>
            <div className="space-y-4">
              <div>
                <label className={`block text-xs ${subText} mb-1.5 uppercase tracking-wider`}>Name</label>
                <input value={editCatName} onChange={e => setEditCatName(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors ${inputCls}`} />
              </div>
              <div>
                <label className={`block text-xs ${subText} mb-1.5 uppercase tracking-wider`}>Colour</label>
                <ColourPicker value={editCatColor} onChange={setEditCatColor} />
                <div className="flex items-center gap-2 mt-3">
                  <div className="w-6 h-6 rounded-full" style={{ backgroundColor: editCatColor }} />
                  <span className={`text-xs ${subText}`}>{editCatName || "Preview"}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => deleteCat(editingCat.id)}
                className="py-2.5 px-3 rounded-lg border border-red-800 text-red-400 text-sm hover:bg-red-950/40 transition-colors">
                Delete
              </button>
              <button onClick={() => setEditingCat(null)} className={`flex-1 py-2.5 rounded-lg border ${pillBorder} ${mutedText} ${hoverPanel} text-sm transition-colors`}>Cancel</button>
              <button onClick={saveEditCat} className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors">Save</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
