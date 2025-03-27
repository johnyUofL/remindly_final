const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.status(200).json({ status: "OK", message: "Server is running", dbConnected });
});

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is not set");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

let dbConnected = false;

const connectWithRetry = async (retries = 5, delay = 2000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      console.log("Connected to PostgreSQL successfully");
      client.release();
      dbConnected = true;
      return;
    } catch (err) {
      console.error(`Database connection attempt ${i + 1} of ${retries} failed:`, err.message);
      if (i === retries - 1) {
        console.error("Max retries reached, proceeding without DB connection...");
        dbConnected = false;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

connectWithRetry();

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

const createUserTables = async (email) => {
  const userTable = email.replace("@", "_").replace(".", "_");
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS ${userTable}_lists (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      is_deleted BOOLEAN DEFAULT FALSE
    );
    CREATE TABLE IF NOT EXISTS ${userTable}_tasks (
      id VARCHAR(36) PRIMARY KEY,
      list_id VARCHAR(36) REFERENCES ${userTable}_lists(id),
      name VARCHAR(255) NOT NULL,
      date BIGINT,
      is_completed BOOLEAN DEFAULT FALSE,
      is_expanded BOOLEAN DEFAULT FALSE,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      is_deleted BOOLEAN DEFAULT FALSE
    );
    CREATE TABLE IF NOT EXISTS ${userTable}_subtasks (
      id VARCHAR(36) PRIMARY KEY,
      task_id VARCHAR(36) REFERENCES ${userTable}_tasks(id),
      name VARCHAR(255) NOT NULL,
      date BIGINT,
      is_completed BOOLEAN DEFAULT FALSE,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      is_deleted BOOLEAN DEFAULT FALSE
    );
  `;

  try {
    await pool.query(createTableQuery);
    console.log(`Tables for user ${email} created or already exist`);
  } catch (error) {
    console.error(`Error creating tables for ${email}:`, error.message, error.stack);
    throw error;
  }
};

const authenticateJWT = (req, res, next) => {
  const token = req.header("Authorization") && req.header("Authorization").split(" ")[1];
  if (!token) {
    return res.status(403).json({ error: "Access denied" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

const getUserTables = (email) => {
  const userTable = email.replace("@", "_").replace(".", "_");
  return {
    lists: `${userTable}_lists`,
    tasks: `${userTable}_tasks`,
    subtasks: `${userTable}_subtasks`,
  };
};

app.post("/signin", async (req, res) => {
  const { email, password } = req.body;

  console.log(`Signin attempt for ${email}`);

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    if (!dbConnected) throw new Error("Database not connected");
    const result = await pool.query("SELECT id, password FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    console.log(`Signin successful for ${email}, token: ${token}`);
    res.status(200).json({ success: true, token });
  } catch (error) {
    console.error(`Error during sign-in for ${email}:`, error.message);
    res.status(500).json({ error: "An error occurred during sign-in", details: error.message });
  }
});

app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  console.log(`Signup attempt for ${email}`);

  if (!name || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters long" });
  }

  try {
    if (!dbConnected) throw new Error("Database not connected");
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id",
      [name, email, hashedPassword]
    );

    await createUserTables(email);
    console.log(`Signup successful for ${email}, userId: ${result.rows[0].id}`);
    res.status(201).json({ message: "User created", userId: result.rows[0].id });
  } catch (error) {
    if (error.code === "23505") {
      console.error(`Email ${email} already exists`);
      res.status(400).json({ error: "Email already exists" });
    } else {
      console.error(`Error inserting user ${email}:`, error.message);
      res.status(500).json({ error: "Failed to create user", details: error.message });
    }
  }
});

app.get("/sync", authenticateJWT, async (req, res) => {
  const { email } = req.user;
  const { since } = req.query;
  const tables = getUserTables(email);

  console.log(`Sync request for ${email} with since=${since}`);

  try {
    if (!dbConnected) {
      console.error("Database not connected during sync");
      throw new Error("Database not connected");
    }

    console.log(`Ensuring tables exist for ${email}`);
    await createUserTables(email);

    const lastSyncTimestamp = since ? parseInt(since) : 0;
    const response = {
      task_lists: [],
      tasks: [],
      subtasks: [],
    };

    console.log(`Querying task_lists for ${email} since ${lastSyncTimestamp}`);
    const listsQuery = `
      SELECT id, name, created_at, updated_at, is_deleted
      FROM ${tables.lists}
      WHERE updated_at > $1 OR created_at > $1
    `;
    const listsResult = await pool.query(listsQuery, [lastSyncTimestamp]);
    response.task_lists = listsResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      created_at: parseInt(row.created_at),
      updated_at: parseInt(row.updated_at),
      is_deleted: row.is_deleted,
    }));

    console.log(`Querying tasks for ${email} since ${lastSyncTimestamp}`);
    const tasksQuery = `
      SELECT id, list_id, name, date, is_completed, is_expanded, created_at, updated_at, is_deleted
      FROM ${tables.tasks}
      WHERE updated_at > $1 OR created_at > $1
    `;
    const tasksResult = await pool.query(tasksQuery, [lastSyncTimestamp]);
    response.tasks = tasksResult.rows.map(row => ({
      id: row.id,
      list_id: row.list_id,
      name: row.name,
      date: row.date ? parseInt(row.date) : null,
      is_completed: row.is_completed,
      is_expanded: row.is_expanded,
      created_at: parseInt(row.created_at),
      updated_at: parseInt(row.updated_at),
      is_deleted: row.is_deleted,
    }));

    console.log(`Querying subtasks for ${email} since ${lastSyncTimestamp}`);
    const subtasksQuery = `
      SELECT id, task_id, name, date, is_completed, created_at, updated_at, is_deleted
      FROM ${tables.subtasks}
      WHERE updated_at > $1 OR created_at > $1
    `;
    const subtasksResult = await pool.query(subtasksQuery, [lastSyncTimestamp]);
    response.subtasks = subtasksResult.rows.map(row => ({
      id: row.id,
      task_id: row.task_id,
      name: row.name,
      date: row.date ? parseInt(row.date) : null,
      is_completed: row.is_completed,
      created_at: parseInt(row.created_at),
      updated_at: parseInt(row.updated_at),
      is_deleted: row.is_deleted,
    }));

    console.log(`Sync successful for ${email}:`, JSON.stringify(response));
    res.status(200).json(response);
  } catch (error) {
    console.error(`Error during sync pull for ${email}:`, error.message, error.stack);
    res.status(500).json({ error: "Internal server error during sync", details: error.message });
  }
});

app.post("/task_lists", authenticateJWT, async (req, res) => {
  const { email } = req.user;
  const { id, name, created_at, updated_at } = req.body;
  const tables = getUserTables(email);

  try {
    if (!dbConnected) throw new Error("Database not connected");
    await pool.query(
      `INSERT INTO ${tables.lists} (id, name, created_at, updated_at, is_deleted)
       VALUES ($1, $2, $3, $4, FALSE)
       ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       updated_at = EXCLUDED.updated_at,
       is_deleted = FALSE`,
      [id, name, created_at, updated_at]
    );
    res.status(201).json({ id });
  } catch (error) {
    console.error("Error creating/updating task list:", error.message);
    res.status(500).json({ error: "Failed to create/update task list" });
  }
});

app.put("/task_lists", authenticateJWT, async (req, res) => {
  const { email } = req.user;
  const { id, name, created_at, updated_at } = req.body;
  const tables = getUserTables(email);

  try {
    if (!dbConnected) throw new Error("Database not connected");
    const result = await pool.query(
      `UPDATE ${tables.lists} SET name = $2, created_at = $3, updated_at = $4, is_deleted = FALSE
       WHERE id = $1 RETURNING id`,
      [id, name, created_at, updated_at]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Task list not found" });
    }
    res.status(200).json({ id });
  } catch (error) {
    console.error("Error updating task list:", error.message);
    res.status(500).json({ error: "Failed to update task list" });
  }
});

app.post("/tasks", authenticateJWT, async (req, res) => {
  const { email } = req.user;
  const { id, list_id, name, date, is_completed, created_at, updated_at } = req.body;
  const tables = getUserTables(email);

  try {
    if (!dbConnected) throw new Error("Database not connected");
    await pool.query(
      `INSERT INTO ${tables.tasks} (id, list_id, name, date, is_completed, is_expanded, created_at, updated_at, is_deleted)
       VALUES ($1, $2, $3, $4, $5, FALSE, $6, $7, FALSE)
       ON CONFLICT (id) DO UPDATE SET
       list_id = EXCLUDED.list_id,
       name = EXCLUDED.name,
       date = EXCLUDED.date,
       is_completed = EXCLUDED.is_completed,
       updated_at = EXCLUDED.updated_at,
       is_deleted = FALSE`,
      [id, list_id, name, date, is_completed, created_at, updated_at]
    );
    res.status(201).json({ id });
  } catch (error) {
    console.error("Error creating/updating task:", error.message);
    res.status(500).json({ error: "Failed to create/update task" });
  }
});

app.put("/tasks", authenticateJWT, async (req, res) => {
  const { email } = req.user;
  const { id, list_id, name, date, is_completed, created_at, updated_at } = req.body;
  const tables = getUserTables(email);

  try {
    if (!dbConnected) throw new Error("Database not connected");
    const result = await pool.query(
      `UPDATE ${tables.tasks} SET list_id = $2, name = $3, date = $4, is_completed = $5, created_at = $6, updated_at = $7, is_deleted = FALSE
       WHERE id = $1 RETURNING id`,
      [id, list_id, name, date, is_completed, created_at, updated_at]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.status(200).json({ id });
  } catch (error) {
    console.error("Error updating task:", error.message);
    res.status(500).json({ error: "Failed to update task" });
  }
});

app.post("/subtasks", authenticateJWT, async (req, res) => {
  const { email } = req.user;
  const { id, task_id, name, date, is_completed, created_at, updated_at } = req.body;
  const tables = getUserTables(email);

  try {
    if (!dbConnected) throw new Error("Database not connected");
    await pool.query(
      `INSERT INTO ${tables.subtasks} (id, task_id, name, date, is_completed, created_at, updated_at, is_deleted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
       ON CONFLICT (id) DO UPDATE SET
       task_id = EXCLUDED.task_id,
       name = EXCLUDED.name,
       date = EXCLUDED.date,
       is_completed = EXCLUDED.is_completed,
       updated_at = EXCLUDED.updated_at,
       is_deleted = FALSE`,
      [id, task_id, name, date, is_completed, created_at, updated_at]
    );
    res.status(201).json({ id });
  } catch (error) {
    console.error("Error creating/updating subtask:", error.message);
    res.status(500).json({ error: "Failed to create/update subtask" });
  }
});

app.put("/subtasks", authenticateJWT, async (req, res) => {
  const { email } = req.user;
  const { id, task_id, name, date, is_completed, created_at, updated_at } = req.body;
  const tables = getUserTables(email);

  try {
    if (!dbConnected) throw new Error("Database not connected");
    const result = await pool.query(
      `UPDATE ${tables.subtasks} SET task_id = $2, name = $3, date = $4, is_completed = $5, created_at = $6, updated_at = $7, is_deleted = FALSE
       WHERE id = $1 RETURNING id`,
      [id, task_id, name, date, is_completed, created_at, updated_at]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Subtask not found" });
    }
    res.status(200).json({ id });
  } catch (error) {
    console.error("Error updating subtask:", error.message);
    res.status(500).json({ error: "Failed to update subtask" });
  }
});

app.delete("/delete/:id", authenticateJWT, async (req, res) => {
  const { email } = req.user;
  const { id } = req.params;
  const tables = getUserTables(email);
  const timestamp = Date.now();

  try {
    if (!dbConnected) throw new Error("Database not connected");
    const listResult = await pool.query(
      `UPDATE ${tables.lists} SET is_deleted = TRUE, updated_at = $2 WHERE id = $1 RETURNING id`,
      [id, timestamp]
    );
    if (listResult.rowCount > 0) {
      return res.status(200).json({ success: true });
    }

    const taskResult = await pool.query(
      `UPDATE ${tables.tasks} SET is_deleted = TRUE, updated_at = $2 WHERE id = $1 RETURNING id`,
      [id, timestamp]
    );
    if (taskResult.rowCount > 0) {
      return res.status(200).json({ success: true });
    }

    const subtaskResult = await pool.query(
      `UPDATE ${tables.subtasks} SET is_deleted = TRUE, updated_at = $2 WHERE id = $1 RETURNING id`,
      [id, timestamp]
    );
    if (subtaskResult.rowCount > 0) {
      return res.status(200).json({ success: true });
    }

    res.status(404).json({ error: "Item not found" });
  } catch (error) {
    console.error("Error deleting item:", error.message);
    res.status(500).json({ error: "Failed to delete item" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});