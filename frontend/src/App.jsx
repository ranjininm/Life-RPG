import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import "./App.css";

const API = "http://localhost:5000";

function App() {

  // =====================================================
  // STATE
  // =====================================================

  const [session, setSession] = useState(null);
  const [character, setCharacter] = useState(null);
  const [tasks, setTasks] = useState([]);

  const [shopItems, setShopItems] = useState([]);
  const [inventory, setInventory] = useState([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [activePage, setActivePage] =
    useState("dashboard");

  const [editingTask, setEditingTask] =
    useState(null);

  const [buyingItem, setBuyingItem] =
    useState(null);

  // =====================================================
  // AUTH FORM
  // =====================================================

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // =====================================================
  // QUEST FORM
  // =====================================================

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Study");
  const [difficulty, setDifficulty] = useState(1);
  const [attribute, setAttribute] = useState("discipline");

  // =====================================================
  // AUTHENTICATED API HELPER
  // =====================================================

  async function apiFetch(path, options = {}) {

    const {
      data: { session: currentSession }
    } = await supabase.auth.getSession();

    if (!currentSession?.access_token) {
      throw new Error("Authentication required.");
    }

    const headers = {
      ...(options.headers || {}),
      Authorization:
        `Bearer ${currentSession.access_token}`
    };

    if (options.body) {
      headers["Content-Type"] =
        "application/json";
    }

    return fetch(
      `${API}${path}`,
      {
        ...options,
        headers
      }
    );
  }

  // =====================================================
  // SESSION
  // =====================================================

  useEffect(() => {

    checkSession();

    const {
      data: { subscription }
    } =
      supabase.auth.onAuthStateChange(
        (_event, newSession) => {

          setSession(newSession);

          if (newSession) {

            loadAll();

          } else {

            clearApp();
          }
        }
      );

    return () => {
      subscription.unsubscribe();
    };

  }, []);

  async function checkSession() {

    const {
      data: { session: currentSession }
    } =
      await supabase.auth.getSession();

    setSession(currentSession);

    if (currentSession) {
      await loadAll();
    }

    setLoading(false);
  }

  async function loadAll() {

    await Promise.all([
      loadCharacter(),
      loadTasks(),
      loadShop(),
      loadInventory()
    ]);
  }

  function clearApp() {

    setCharacter(null);
    setTasks([]);
    setShopItems([]);
    setInventory([]);
  }

  // =====================================================
  // AUTH
  // =====================================================

  async function handleAuth(e) {

    e.preventDefault();

    setAuthLoading(true);
    setMessage("");

    try {

      if (isSignup) {

        const {
          error
        } =
          await supabase.auth.signUp({
            email,
            password
          });

        if (error) {
          throw error;
        }

        setMessage(
          "Account created! Check your email if confirmation is required."
        );

      } else {

        const {
          error
        } =
          await supabase.auth.signInWithPassword({
            email,
            password
          });

        if (error) {
          throw error;
        }

        setMessage(
          "Welcome back, adventurer! ⚔️"
        );
      }

    } catch (error) {

      setMessage(
        error.message ||
        "Authentication failed."
      );

    } finally {

      setAuthLoading(false);
    }
  }

  async function logout() {

    await supabase.auth.signOut();

    clearApp();
  }

  // =====================================================
  // CHARACTER
  // =====================================================

  async function loadCharacter() {

    try {

      const response =
        await apiFetch("/character");

      const data =
        await response.json();

      if (response.ok) {
        setCharacter(data);
      }

    } catch (error) {

      console.error(
        "Character error:",
        error
      );
    }
  }

  // =====================================================
  // TASKS
  // =====================================================

  async function loadTasks() {

    try {

      const response =
        await apiFetch("/tasks");

      const data =
        await response.json();

      if (response.ok) {
        setTasks(data);
      }

    } catch (error) {

      console.error(
        "Tasks error:",
        error
      );
    }
  }

  // =====================================================
  // CREATE / UPDATE QUEST
  // =====================================================

  async function saveTask(e) {

    e.preventDefault();

    if (!title.trim()) {

      setMessage(
        "Please enter a quest title."
      );

      return;
    }

    if (!session) return;

    const task = {

      title:
        title.trim(),

      description:
        description.trim(),

      category,

      difficulty:
        Number(difficulty),

      status:
        editingTask
          ? editingTask.status
          : "pending",

      attribute
    };

    try {

      const url =
        editingTask
          ? `/tasks/${editingTask.id}`
          : "/tasks";

      const method =
        editingTask
          ? "PUT"
          : "POST";

      const response =
        await apiFetch(
          url,
          {
            method,
            body:
              JSON.stringify(task)
          }
        );

      const data =
        await response.json();

      if (!response.ok) {

        setMessage(
          data.message ||
          "Failed to save quest."
        );

        return;
      }

      if (editingTask) {

        setTasks(
          previous =>
            previous.map(item =>
              item.id === editingTask.id
                ? data
                : item
            )
        );

        setMessage(
          "Quest updated successfully! ✨"
        );

      } else {

        setTasks(
          previous => [
            data,
            ...previous
          ]
        );

        setMessage(
          "Quest created successfully! ⚔️"
        );
      }

      resetForm();

    } catch (error) {

      console.error(error);

      setMessage(
        error.message ||
        "Could not connect to backend."
      );
    }
  }

  function resetForm() {

    setTitle("");
    setDescription("");
    setCategory("Study");
    setDifficulty(1);
    setAttribute("discipline");
    setEditingTask(null);
  }

  function startEdit(task) {

    setEditingTask(task);

    setTitle(task.title);
    setDescription(
      task.description || ""
    );
    setCategory(task.category);
    setDifficulty(
      Number(task.difficulty)
    );
    setAttribute(
      task.attribute
    );

    setActivePage("quests");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  // =====================================================
  // COMPLETE QUEST
  // =====================================================

  async function completeTask(task) {

    try {

      const response =
        await apiFetch(
          `/tasks/${task.id}/complete`,
          {
            method: "POST"
          }
        );

      const data =
        await response.json();

      if (!response.ok) {

        setMessage(
          data.message ||
          "Completion failed."
        );

        return;
      }

      setTasks(
        previous =>
          previous.map(item =>
            item.id === task.id
              ? data.task
              : item
          )
      );

      if (data.character) {
        setCharacter(data.character);
      }

      if (data.levelUp) {

        setMessage(
          `🎉 LEVEL UP! +${data.rewards.xp} XP • +${data.rewards.coins} Coins • 🔥 ${data.streak.current} day streak`
        );

      } else {

        setMessage(
          `⚔️ Quest Complete! +${data.rewards.xp} XP • +${data.rewards.coins} Coins • 🔥 ${data.streak.current} day streak`
        );
      }

    } catch (error) {

      console.error(error);

      setMessage(
        error.message ||
        "Could not connect to backend."
      );
    }
  }

  // =====================================================
  // DELETE
  // =====================================================

  async function deleteTask(taskId) {

    try {

      const response =
        await apiFetch(
          `/tasks/${taskId}`,
          {
            method: "DELETE"
          }
        );

      const data =
        await response.json();

      if (!response.ok) {

        setMessage(
          data.message ||
          "Delete failed."
        );

        return;
      }

      setTasks(
        previous =>
          previous.filter(
            task =>
              task.id !== taskId
          )
      );

      setMessage(
        "Quest deleted."
      );

    } catch (error) {

      console.error(error);

      setMessage(
        error.message ||
        "Could not connect to backend."
      );
    }
  }

  // =====================================================
  // SHOP
  // =====================================================

  async function loadShop() {

    try {

      const response =
        await apiFetch("/shop");

      const data =
        await response.json();

      if (response.ok) {
        setShopItems(data);
      }

    } catch (error) {

      console.error(
        "Shop error:",
        error
      );
    }
  }

  // =====================================================
  // INVENTORY
  // =====================================================

  async function loadInventory() {

    try {

      const response =
        await apiFetch("/inventory");

      const data =
        await response.json();

      if (response.ok) {
        setInventory(data);
      }

    } catch (error) {

      console.error(
        "Inventory error:",
        error
      );
    }
  }

  // =====================================================
  // BUY
  // =====================================================

  async function buyItem(item) {

    if (!session || !character) {
      return;
    }

    if (
      Number(character.coins) <
      Number(item.price)
    ) {

      setMessage(
        "🪙 You don't have enough coins."
      );

      return;
    }

    setBuyingItem(item.id);

    try {

      const response =
        await apiFetch(
          `/shop/${item.id}/buy`,
          {
            method: "POST"
          }
        );

      const data =
        await response.json();

      if (!response.ok) {

        setMessage(
          data.message ||
          "Purchase failed."
        );

        return;
      }

      setCharacter(
        data.character
      );

      await loadInventory();

      setMessage(
        `🛒 ${item.name} purchased successfully!`
      );

    } catch (error) {

      console.error(error);

      setMessage(
        error.message ||
        "Could not connect to backend."
      );

    } finally {

      setBuyingItem(null);
    }
  }

  // =====================================================
  // HELPERS
  // =====================================================

  function getDifficultyName(value) {

    const number =
      Number(value);

    if (number === 1)
      return "Easy";

    if (number === 2)
      return "Medium";

    if (number === 3)
      return "Hard";

    return "Unknown";
  }

  function getDifficultyClass(value) {

    const number =
      Number(value);

    if (number === 1)
      return "easy";

    if (number === 2)
      return "medium";

    return "hard";
  }

  function getItemIcon(type) {

    if (type === "boost")
      return "⚡";

    if (type === "badge")
      return "🏅";

    if (type === "title")
      return "👑";

    if (type === "theme")
      return "🎨";

    return "🎁";
  }

  function getCategoryIcon(category) {

    if (category === "Study")
      return "📚";

    if (category === "Coding")
      return "💻";

    if (category === "Health")
      return "💪";

    if (category === "Creative")
      return "🎨";

    return "🌱";
  }

  function getLevelProgress() {

    if (!character)
      return 0;

    const level =
      Number(character.level) || 1;

    const xp =
      Number(character.xp) || 0;

    if (level === 1) {

      return Math.min(
        (xp / 100) * 100,
        100
      );
    }

    const currentRequirement =
      100 *
      level *
      level;

    const previousRequirement =
      100 *
      (level - 1) *
      (level - 1);

    const progress =
      xp -
      previousRequirement;

    const required =
      currentRequirement -
      previousRequirement;

    return Math.min(
      Math.max(
        (progress / required) *
          100,
        0
      ),
      100
    );
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {

    return (
      <div className="fullscreen-center">

        <div className="loading-card">

          <div className="loading-icon">
            ⚔️
          </div>

          <h1>Life RPG</h1>

          <p>
            Preparing your adventure...
          </p>

        </div>

      </div>
    );
  }

  // =====================================================
  // LOGIN
  // =====================================================

  if (!session) {

    return (
      <div className="auth-page">

        <div className="auth-card">

          <div className="auth-logo">
            ⚔️
          </div>

          <h1>Life RPG</h1>

          <p className="auth-subtitle">
            Turn your real life into an adventure.
          </p>

          <form
            onSubmit={handleAuth}
            className="auth-form"
          >

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={
                e =>
                  setEmail(
                    e.target.value
                  )
              }
              required
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={
                e =>
                  setPassword(
                    e.target.value
                  )
              }
              required
              minLength={6}
            />

            <button
              className="primary-btn full"
              disabled={authLoading}
            >
              {authLoading
                ? "Please wait..."
                : isSignup
                  ? "Create Account"
                  : "Enter the Realm"}
            </button>

          </form>

          {message && (
            <div className="message">
              {message}
            </div>
          )}

          <button
            className="switch-auth"
            onClick={() => {
              setIsSignup(
                previous =>
                  !previous
              );
              setMessage("");
            }}
          >
            {isSignup
              ? "Already have an account? Login"
              : "New adventurer? Create an account"}
          </button>

        </div>

      </div>
    );
  }

  // =====================================================
  // MAIN APP
  // =====================================================

  return (

    <div className="app">

      <div className="app-container">

        {/* HEADER */}

        <header className="header">

          <div className="brand">

            <div className="brand-icon">
              ⚔️
            </div>

            <div>

              <h1>
                Life RPG
              </h1>

              <p>
                Your life. Your quests. Your story.
              </p>

            </div>

          </div>

          <div className="header-right">

            <div className="coin-display">
              🪙{" "}
              <strong>
                {character?.coins || 0}
              </strong>
            </div>

            <button
              className="logout-btn"
              onClick={logout}
            >
              Logout
            </button>

          </div>

        </header>

        {/* NAVIGATION */}

        <nav className="navigation">

          <button
            className={
              activePage === "dashboard"
                ? "nav-btn active"
                : "nav-btn"
            }
            onClick={() =>
              setActivePage("dashboard")
            }
          >
            🏠 Dashboard
          </button>

          <button
            className={
              activePage === "quests"
                ? "nav-btn active"
                : "nav-btn"
            }
            onClick={() =>
              setActivePage("quests")
            }
          >
            ⚔️ Quests
          </button>

          <button
            className={
              activePage === "shop"
                ? "nav-btn active"
                : "nav-btn"
            }
            onClick={() =>
              setActivePage("shop")
            }
          >
            🛒 Shop
          </button>

          <button
            className={
              activePage === "inventory"
                ? "nav-btn active"
                : "nav-btn"
            }
            onClick={() =>
              setActivePage("inventory")
            }
          >
            🎒 Inventory
          </button>

        </nav>

        {/* MESSAGE */}

        {message && (

          <div className="message">

            <span>
              {message}
            </span>

            <button
              onClick={() =>
                setMessage("")
              }
            >
              ×
            </button>

          </div>

        )}

        {/* DASHBOARD */}

        {activePage === "dashboard" && (

          <>

            <section className="hero-card">

              <div>

                <p className="eyebrow">
                  ADVENTURER PROFILE
                </p>

                <h2>
                  Welcome back, Adventurer ⚔️
                </h2>

                <p>
                  Keep completing quests and
                  level up your real life.
                </p>

              </div>

              <div className="hero-level">

                <span>
                  LEVEL
                </span>

                <strong>
                  {character?.level || 1}
                </strong>

              </div>

            </section>

            {/* CHARACTER */}

            {character && (

              <section className="character-card">

                <div className="section-heading">

                  <div>

                    <p className="eyebrow">
                      CHARACTER
                    </p>

                    <h2>
                      Your Stats
                    </h2>

                  </div>

                  <div className="streak">
                    🔥{" "}
                    {character.streak || 0}
                    {" "}day streak
                  </div>

                </div>

                <div className="stat-grid">

                  <div className="stat-box">
                    <span>⭐ XP</span>
                    <strong>
                      {character.xp || 0}
                    </strong>
                  </div>

                  <div className="stat-box">
                    <span>🪙 Coins</span>
                    <strong>
                      {character.coins || 0}
                    </strong>
                  </div>

                  <div className="stat-box">
                    <span>🔥 Streak</span>
                    <strong>
                      {character.streak || 0}
                    </strong>
                  </div>

                  <div className="stat-box">
                    <span>🏆 Level</span>
                    <strong>
                      {character.level || 1}
                    </strong>
                  </div>

                </div>

                <div className="xp-section">

                  <div className="xp-label">

                    <span>
                      Level {character.level}
                    </span>

                    <span>
                      {character.xp} XP
                    </span>

                  </div>

                  <div className="xp-bar">

                    <div
                      className="xp-fill"
                      style={{
                        width:
                          `${getLevelProgress()}%`
                      }}
                    />

                  </div>

                </div>

                <div className="attributes">

                  <div className="attribute">
                    <span>💪</span>
                    <small>
                      Strength
                    </small>
                    <strong>
                      {character.strength || 0}
                    </strong>
                  </div>

                  <div className="attribute">
                    <span>🧠</span>
                    <small>
                      Intellect
                    </small>
                    <strong>
                      {character.intellect || 0}
                    </strong>
                  </div>

                  <div className="attribute">
                    <span>🎯</span>
                    <small>
                      Discipline
                    </small>
                    <strong>
                      {character.discipline || 0}
                    </strong>
                  </div>

                  <div className="attribute">
                    <span>🎨</span>
                    <small>
                      Creativity
                    </small>
                    <strong>
                      {character.creativity || 0}
                    </strong>
                  </div>

                </div>

              </section>

            )}

            {/* DASHBOARD QUESTS */}

            <section className="section">

              <div className="section-heading">

                <div>

                  <p className="eyebrow">
                    QUEST BOARD
                  </p>

                  <h2>
                    Active Quests
                  </h2>

                </div>

                <button
                  className="secondary-btn"
                  onClick={() =>
                    setActivePage("quests")
                  }
                >
                  View all →
                </button>

              </div>

              {tasks.length === 0 ? (

                <div className="empty-state">

                  <div>
                    📜
                  </div>

                  <h3>
                    No quests yet
                  </h3>

                  <p>
                    Create your first real-life
                    quest and start earning XP.
                  </p>

                  <button
                    className="primary-btn"
                    onClick={() =>
                      setActivePage("quests")
                    }
                  >
                    Create Quest
                  </button>

                </div>

              ) : (

                <div className="quest-grid">

                  {tasks
                    .slice(0, 4)
                    .map(task => (

                      <QuestCard
                        key={task.id}
                        task={task}
                        onComplete={completeTask}
                        onDelete={deleteTask}
                        onEdit={startEdit}
                        getDifficultyName={getDifficultyName}
                        getDifficultyClass={getDifficultyClass}
                        getCategoryIcon={getCategoryIcon}
                      />

                    ))}

                </div>

              )}

            </section>

          </>

        )}

        {/* QUEST PAGE */}

        {activePage === "quests" && (

          <>

            <section className="section">

              <div className="section-heading">

                <div>

                  <p className="eyebrow">
                    QUEST CREATOR
                  </p>

                  <h2>
                    {editingTask
                      ? "Edit Quest"
                      : "Create a Quest"}
                  </h2>

                </div>

              </div>

              <form
                className="quest-form"
                onSubmit={saveTask}
              >

                <div className="form-group">

                  <label>
                    Quest title
                  </label>

                  <input
                    placeholder="e.g. Study Java for 1 hour"
                    value={title}
                    onChange={
                      e =>
                        setTitle(
                          e.target.value
                        )
                    }
                  />

                </div>

                <div className="form-group">

                  <label>
                    Description
                  </label>

                  <textarea
                    placeholder="What do you want to accomplish?"
                    value={description}
                    onChange={
                      e =>
                        setDescription(
                          e.target.value
                        )
                    }
                  />

                </div>

                <div className="form-grid">

                  <div className="form-group">

                    <label>
                      Category
                    </label>

                    <select
                      value={category}
                      onChange={
                        e =>
                          setCategory(
                            e.target.value
                          )
                      }
                    >

                      <option>
                        Study
                      </option>

                      <option>
                        Coding
                      </option>

                      <option>
                        Health
                      </option>

                      <option>
                        Personal
                      </option>

                      <option>
                        Creative
                      </option>

                    </select>

                  </div>

                  <div className="form-group">

                    <label>
                      Difficulty
                    </label>

                    <select
                      value={difficulty}
                      onChange={
                        e =>
                          setDifficulty(
                            Number(
                              e.target.value
                            )
                          )
                      }
                    >

                      <option value={1}>
                        Easy • 20 XP
                      </option>

                      <option value={2}>
                        Medium • 40 XP
                      </option>

                      <option value={3}>
                        Hard • 70 XP
                      </option>

                    </select>

                  </div>

                  <div className="form-group">

                    <label>
                      Attribute
                    </label>

                    <select
                      value={attribute}
                      onChange={
                        e =>
                          setAttribute(
                            e.target.value
                          )
                      }
                    >

                      <option value="discipline">
                        🎯 Discipline
                      </option>

                      <option value="intellect">
                        🧠 Intellect
                      </option>

                      <option value="strength">
                        💪 Strength
                      </option>

                      <option value="creativity">
                        🎨 Creativity
                      </option>

                    </select>

                  </div>

                </div>

                <div className="form-actions">

                  <button
                    className="primary-btn"
                    type="submit"
                  >
                    {editingTask
                      ? "Save Changes"
                      : "⚔️ Create Quest"}
                  </button>

                  {editingTask && (

                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={resetForm}
                    >
                      Cancel
                    </button>

                  )}

                </div>

              </form>

            </section>

            <section className="section">

              <div className="section-heading">

                <div>

                  <p className="eyebrow">
                    QUEST LOG
                  </p>

                  <h2>
                    All Quests
                  </h2>

                </div>

                <span className="count">
                  {tasks.length} quests
                </span>

              </div>

              {tasks.length === 0 ? (

                <div className="empty-state">
                  📜 No quests yet.
                </div>

              ) : (

                <div className="quest-grid">

                  {tasks.map(task => (

                    <QuestCard
                      key={task.id}
                      task={task}
                      onComplete={completeTask}
                      onDelete={deleteTask}
                      onEdit={startEdit}
                      getDifficultyName={getDifficultyName}
                      getDifficultyClass={getDifficultyClass}
                      getCategoryIcon={getCategoryIcon}
                    />

                  ))}

                </div>

              )}

            </section>

          </>

        )}

        {/* SHOP */}

        {activePage === "shop" && (

          <section className="section">

            <div className="section-heading">

              <div>

                <p className="eyebrow">
                  REWARD SHOP
                </p>

                <h2>
                  Spend Your Coins
                </h2>

                <p className="section-description">
                  Earn coins from quests and
                  exchange them for rewards.
                </p>

              </div>

              <div className="coin-display large">
                🪙{" "}
                {character?.coins || 0}
              </div>

            </div>

            <div className="shop-grid">

              {shopItems.map(item => {

                const canBuy =
                  Number(character?.coins || 0) >=
                  Number(item.price);

                return (

                  <div
                    className="shop-card"
                    key={item.id}
                  >

                    <div className="shop-icon">
                      {getItemIcon(
                        item.item_type
                      )}
                    </div>

                    <div className="shop-type">
                      {item.item_type}
                    </div>

                    <h3>
                      {item.name}
                    </h3>

                    <p>
                      {item.description}
                    </p>

                    <div className="shop-bottom">

                      <strong className="price">
                        🪙 {item.price}
                      </strong>

                      <button
                        className="buy-btn"
                        disabled={
                          !canBuy ||
                          buyingItem === item.id
                        }
                        onClick={() =>
                          buyItem(item)
                        }
                      >

                        {buyingItem === item.id
                          ? "Buying..."
                          : canBuy
                            ? "Buy"
                            : "Need coins"}

                      </button>

                    </div>

                  </div>

                );

              })}

            </div>

          </section>

        )}

        {/* INVENTORY */}

        {activePage === "inventory" && (

          <section className="section">

            <div className="section-heading">

              <div>

                <p className="eyebrow">
                  YOUR COLLECTION
                </p>

                <h2>
                  Inventory
                </h2>

                <p className="section-description">
                  Rewards you've earned through
                  the Life RPG journey.
                </p>

              </div>

              <span className="count">
                {inventory.length} items
              </span>

            </div>

            {inventory.length === 0 ? (

              <div className="empty-state">

                <div>
                  🎒
                </div>

                <h3>
                  Your inventory is empty
                </h3>

                <p>
                  Visit the shop and spend
                  your hard-earned coins.
                </p>

                <button
                  className="primary-btn"
                  onClick={() =>
                    setActivePage("shop")
                  }
                >
                  Visit Shop
                </button>

              </div>

            ) : (

              <div className="inventory-grid">

                {inventory.map(item => (

                  <div
                    className="inventory-card"
                    key={item.id}
                  >

                    <div className="inventory-icon">
                      {getItemIcon(
                        item.item_type
                      )}
                    </div>

                    <h3>
                      {item.name}
                    </h3>

                    <span>
                      {item.item_type}
                    </span>

                    <p>
                      {item.description}
                    </p>

                  </div>

                ))}

              </div>

            )}

          </section>

        )}

      </div>

    </div>
  );
}

// =====================================================
// QUEST CARD
// =====================================================

function QuestCard({
  task,
  onComplete,
  onDelete,
  onEdit,
  getDifficultyName,
  getDifficultyClass,
  getCategoryIcon
}) {

  const completed =
    task.status === "completed";

  return (

    <article
      className={
        completed
          ? "quest-card completed"
          : "quest-card"
      }
    >

      <div className="quest-card-top">

        <span className="category-icon">
          {getCategoryIcon(
            task.category
          )}
        </span>

        <span
          className={
            `difficulty ${getDifficultyClass(
              task.difficulty
            )}`
          }
        >
          {getDifficultyName(
            task.difficulty
          )}
        </span>

      </div>

      <h3>
        {task.title}
      </h3>

      {task.description && (

        <p className="quest-description">
          {task.description}
        </p>

      )}

      <div className="quest-rewards">

        <span>
          ⭐ {task.xp_reward} XP
        </span>

        <span>
          🪙 {task.coin_reward}
        </span>

        <span>
          🎯 {task.attribute}
        </span>

      </div>

      <div className="quest-status">

        {completed
          ? "✓ Completed"
          : "○ In Progress"}

      </div>

      <div className="quest-actions">

        {!completed && (

          <button
            className="complete-btn"
            onClick={() =>
              onComplete(task)
            }
          >
            ✓ Complete
          </button>

        )}

        <button
          className="edit-btn"
          onClick={() =>
            onEdit(task)
          }
        >
          ✎
        </button>

        <button
          className="delete-btn"
          onClick={() =>
            onDelete(task.id)
          }
        >
          🗑
        </button>

      </div>

    </article>
  );
}

export default App;