# 🎮 Life RPG

> **Turn your real-life goals into quests. Complete them, earn XP, level up, and build your character.**

Life RPG is a gamified productivity web application that transforms everyday tasks into an RPG-style progression system.

Instead of simply checking off tasks, users complete quests, earn XP and coins, improve their attributes, maintain streaks, and unlock rewards as they progress.

---

## ✨ Features

- 🔐 **User Authentication** – Secure signup and login
- ⚔️ **Quest System** – Turn real-life tasks into RPG quests
- ⭐ **XP & Leveling** – Earn XP by completing quests and progress through levels
- 🪙 **Coins & Rewards** – Earn coins and spend them in the in-app shop
- 🧠 **Character Attributes** – Build attributes through different types of activities
- 🔥 **Streak System** – Maintain consistency through completion streaks
- 🛍️ **Reward Shop** – Purchase rewards using earned coins
- 🎒 **Inventory** – Keep track of purchased rewards
- 💾 **Persistent Data** – Progress is stored in the database and remains after refreshing
- 🛡️ **Secure Backend** – User-specific data and server-side validation
- 📱 **Responsive UI** – Designed to work across different screen sizes

---

## 🎯 The Idea

Traditional productivity apps often reduce progress to a simple checklist.

Life RPG changes that experience by creating a progression loop:

**Create Quest → Complete Quest → Earn XP & Coins → Improve Character → Level Up → Unlock Rewards**

The goal is to make productivity feel like a journey rather than a checklist.

---

## 🛠️ Tech Stack

### Frontend
- React
- Vite
- CSS
- Supabase JavaScript Client

### Backend
- Node.js
- Express.js
- PostgreSQL
- Supabase

### Authentication & Security
- Supabase Authentication
- Row Level Security (RLS)
- Server-side authentication and validation

---

## 🏗️ Architecture

```text
             ┌──────────────────┐
             │    React + Vite  │
             │     Frontend     │
             └────────┬─────────┘
                      │
                Authenticated API
                      │
             ┌────────▼─────────┐
             │  Node + Express  │
             │     Backend      │
             └────────┬─────────┘
                      │
             ┌────────▼─────────┐
             │     Supabase     │
             │ PostgreSQL + Auth│
             └──────────────────┘
