import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCookie, setCookie } from "hono/cookie";

type Variables = {
  userId: number;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("/*", cors());

// Simple session storage (in production, use a proper session store)
const sessions = new Map<string, number>();

// Middleware to check authentication
const authMiddleware = async (c: any, next: any) => {
  const sessionId = getCookie(c, "session_id");
  if (!sessionId || !sessions.has(sessionId)) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userId = sessions.get(sessionId);
  c.set("userId", userId);
  await next();
};

// Login endpoint - phone number only
app.post("/api/auth/login", async (c) => {
  try {
    const { phone_number } = await c.req.json();

    // Check if user exists in directory
    const user = await c.env.DB.prepare(
      "SELECT * FROM users WHERE phone_number = ?"
    ).bind(phone_number).first();

    if (!user) {
      return c.json({ error: "Phone number not registered. Please contact your administrator." }, 401);
    }

    // Create session
    const sessionId = crypto.randomUUID();
    sessions.set(sessionId, user.id as number);

    setCookie(c, "session_id", sessionId, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return c.json({ user });
  } catch (error) {
    console.error("Login error:", error);
    return c.json({ error: "Login failed" }, 500);
  }
});

// Get current user
app.get("/api/auth/me", async (c) => {
  const sessionId = getCookie(c, "session_id");
  if (!sessionId || !sessions.has(sessionId)) {
    return c.json({ user: null });
  }

  const userId = sessions.get(sessionId);
  const user = await c.env.DB.prepare(
    "SELECT * FROM users WHERE id = ?"
  ).bind(userId).first();

  return c.json({ user });
});

// Logout
app.post("/api/auth/logout", async (c) => {
  const sessionId = getCookie(c, "session_id");
  if (sessionId) {
    sessions.delete(sessionId);
  }

  setCookie(c, "session_id", "", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: 0,
  });

  return c.json({ success: true });
});

// Get all activities
app.get("/api/activities", authMiddleware, async (c) => {
  try {
    const userId = c.get("userId");
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM activities WHERE user_id = ? ORDER BY created_at DESC"
    ).bind(userId).all();
    return c.json(results);
  } catch (error) {
    console.error("Error fetching activities:", error);
    return c.json({ error: "Failed to fetch activities" }, 500);
  }
});

// Create new activity
app.post("/api/activities", authMiddleware, async (c) => {
  try {
    const userId = c.get("userId");
    const body = await c.req.json();
    const { team, contact, type, notes, location, latitude, longitude, image_url, follow_up_date } = body;

    const result = await c.env.DB.prepare(
      `INSERT INTO activities 
       (user_id, team, contact, type, notes, location, latitude, longitude, image_url, follow_up_date, is_completed, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(userId, team, contact, type, notes, location || null, latitude || null, longitude || null, image_url || null, follow_up_date).run();

    const { results } = await c.env.DB.prepare(
      "SELECT * FROM activities WHERE id = ?"
    ).bind(result.meta.last_row_id).all();

    return c.json(results[0], 201);
  } catch (error) {
    console.error("Error creating activity:", error);
    return c.json({ error: "Failed to create activity" }, 500);
  }
});

// Update activity completion status
app.patch("/api/activities/:id", authMiddleware, async (c) => {
  try {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const body = await c.req.json();
    const { is_completed } = body;

    await c.env.DB.prepare(
      "UPDATE activities SET is_completed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?"
    ).bind(is_completed ? 1 : 0, id, userId).run();

    const { results } = await c.env.DB.prepare(
      "SELECT * FROM activities WHERE id = ?"
    ).bind(id).all();

    return c.json(results[0]);
  } catch (error) {
    console.error("Error updating activity:", error);
    return c.json({ error: "Failed to update activity" }, 500);
  }
});

// Delete activity
app.delete("/api/activities/:id", authMiddleware, async (c) => {
  try {
    const userId = c.get("userId");
    const id = c.req.param("id");
    await c.env.DB.prepare("DELETE FROM activities WHERE id = ? AND user_id = ?").bind(id, userId).run();
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting activity:", error);
    return c.json({ error: "Failed to delete activity" }, 500);
  }
});

// Admin endpoints - only for Admins
const adminMiddleware = async (c: any, next: any) => {
  const sessionId = getCookie(c, "session_id");
  if (!sessionId || !sessions.has(sessionId)) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userId = sessions.get(sessionId);
  const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
  
  if (!user || user.role !== 'Admin') {
    return c.json({ error: "Access denied. Admin only." }, 403);
  }
  
  c.set("userId", userId);
  await next();
};

// Get all users in directory
app.get("/api/admin/users", adminMiddleware, async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT id, phone_number, name, team, role, created_at FROM users ORDER BY name ASC"
    ).all();
    return c.json(results);
  } catch (error) {
    console.error("Error fetching users:", error);
    return c.json({ error: "Failed to fetch users" }, 500);
  }
});

// Add user to directory
app.post("/api/admin/users", adminMiddleware, async (c) => {
  try {
    const { phone_number, name, team, role } = await c.req.json();

    // Check if phone number already exists
    const existing = await c.env.DB.prepare(
      "SELECT id FROM users WHERE phone_number = ?"
    ).bind(phone_number).first();

    if (existing) {
      return c.json({ error: "Phone number already registered" }, 400);
    }

    const userRole = role || 'user';
    const result = await c.env.DB.prepare(
      "INSERT INTO users (phone_number, name, team, role, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
    ).bind(phone_number, name, team, userRole).run();

    const user = await c.env.DB.prepare(
      "SELECT id, phone_number, name, team, role, created_at FROM users WHERE id = ?"
    ).bind(result.meta.last_row_id).first();

    return c.json(user, 201);
  } catch (error) {
    console.error("Error adding user:", error);
    return c.json({ error: "Failed to add user" }, 500);
  }
});

// Delete user from directory
app.delete("/api/admin/users/:id", adminMiddleware, async (c) => {
  try {
    const id = c.req.param("id");
    await c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return c.json({ error: "Failed to delete user" }, 500);
  }
});

// Get all activities from all users (admin only)
app.get("/api/admin/activities", adminMiddleware, async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT a.*, u.name as user_name, u.phone_number as user_phone 
       FROM activities a 
       LEFT JOIN users u ON a.user_id = u.id 
       ORDER BY a.created_at DESC`
    ).all();
    return c.json(results);
  } catch (error) {
    console.error("Error fetching admin activities:", error);
    return c.json({ error: "Failed to fetch activities" }, 500);
  }
});

// Upload image to R2
app.post("/api/upload-image", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }

    // Generate unique key with timestamp
    const timestamp = Date.now();
    const filename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const key = `activities/${timestamp}-${filename}`;

    // Upload to R2
    await c.env.R2_BUCKET.put(key, file, {
      httpMetadata: {
        contentType: file.type,
      },
    });

    return c.json({ 
      success: true, 
      key,
      url: `/api/images/${key}`
    });
  } catch (error) {
    console.error("Upload error:", error);
    return c.json({ error: "Upload failed" }, 500);
  }
});

// Retrieve image from R2
app.get("/api/images/*", async (c) => {
  try {
    const key = c.req.path.replace("/api/images/", "");
    const object = await c.env.R2_BUCKET.get(key);

    if (!object) {
      return c.json({ error: "Image not found" }, 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "public, max-age=31536000");

    return c.body(object.body, { headers });
  } catch (error) {
    console.error("Retrieval error:", error);
    return c.json({ error: "Failed to retrieve image" }, 500);
  }
});

export default app;
