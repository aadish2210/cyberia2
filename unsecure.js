const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const morgan = require("morgan");

const http = require('http')
const fs = require("fs");
const https = require("https"); //for ssl certification
const cors = require("cors"); //for setting origins which can access our resource
const rateLimit = require("express-rate-limit"); 

const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
require("dotenv").config();
console.log(process.env.GOOGLE_CLIENT_ID)

const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(morgan("dev"));
app.use(cors()); // using the cors middleware

const options = {
    key: fs.readFileSync("server.key"),
    cert: fs.readFileSync("server.cert"),
};

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 10, 
    message: "Too many requests, please try again later.",
  });
app.use(limiter);


// MongoDB Connection
const mongoURI = "mongodb://localhost:27017"; // Change this if using a different DB server
const dbName = "express_api";
let db;

MongoClient.connect(mongoURI)
  .then((client) => {
    db = client.db(dbName);
    console.log("Connected to MongoDB");
  })
  .catch((err) => console.error("MongoDB Connection Error:", err));

//OAuth2 Configuration
// Session configuration
// app.use(session({
//   secret: "your_secret_key",
//   resave: false,
//   saveUninitialized: true,
// }));

// app.use(passport.initialize());
// app.use(passport.session());

// Passport Google OAuth Strategy
// passport.use(new GoogleStrategy({
//   clientID: process.env.GOOGLE_CLIENT_ID, 
//   clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//   callbackURL: "https://localhost:3000/google/callback"
// },
// async (accessToken, refreshToken, profile, done) => {
//   try {
//       return done(null, profile);
//   } catch (err) {
//       return done(err);
//   }
// }));

// passport.serializeUser((user, done) => {
//   done(null, user);
// });

// passport.deserializeUser((user,done)=>{
//   done(null,user)
// });

// // Routes for Google Authentication
// app.get("/",
//   passport.authenticate("google", { scope: ["profile", "email"] })
// );

// app.get("/google/callback",
//   passport.authenticate("google", { failureRedirect: "/" }),
//   (req, res) => {
//       res.redirect("/api/items");
//   }
// );

// Role-Based Middleware
const authenticateToken = (req, res, next) => {
    const token = req.header("Authorization");
    if (!token) return res.status(401).json({ error: "Access denied" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(403).json({ error: "Invalid token" });
    }
};

const authorizeRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: "Forbidden: You do not have access" });
        }
        next();
    };
};

// User Signup
app.post("/signup", async (req, res) => {
    const { email, password, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = { email, password: hashedPassword, role: role || "user" };

    await db.collection("users").insertOne(newUser);
    res.json({ message: "User registered successfully" });
});

// User Login
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const user = await db.collection("users").findOne({ email });
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.json({ token });
});

// Protected Route (Only for Admins)
app.get("/admin", authenticateToken, authorizeRole(["admin"]), (req, res) => {
    res.json({ message: "Welcome, Admin!" });
});

// Public Route (For All)
app.get("/public", (req, res) => {
    res.json({ message: "Public Content" });
});

// Secure Profile Route (Logged-in Users)
app.get("/profile", authenticateToken, (req, res) => {
    res.json({ user: req.user });
});



function validateInput(name) { //function to validate input
    if (typeof name !== "string" || name.trim().length === 0) {
      return false;
    }
    return true;
}

// Get all items
app.get("/api/items", async (req, res) => {
  try {
    const items = await db.collection("items").find().toArray();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

// Get single item by ID
app.get("/api/items/:id", async (req, res) => {
  try {
    const item = await db.collection("items").findOne({ _id: new ObjectId(req.params.id) });
    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: "Invalid ID format" });
  }
});

// Create a new item
app.post("/api/items", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    if (!validateInput(name)) {
      return res.status(400).json({ error: "Invalid name input" });
    }
    const result = await db.collection("items").insertOne({ name });
    res.status(201).json({ _id: result.insertedId, name });
  } catch (err) {
    res.status(500).json({ error: "Failed to create item" });
  }
});

// Update an existing item
app.put("/api/items/:id", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    if (!validateInput(name)) {
      return res.status(400).json({ error: "Invalid name input" });
    }
    const result = await db.collection("items").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { name } }
    );

    if (result.matchedCount === 0) return res.status(404).json({ error: "Item not found" });
    res.json({ message: "Item updated successfully" });
  } catch (err) {
    res.status(500).json({ error: "Invalid ID format" });
  }
});

// Delete an item
app.delete("/api/items/:id", async (req, res) => {
  try {
    const result = await db.collection("items").deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) return res.status(404).json({ error: "Item not found" });

    res.json({ message: "Item deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Invalid ID format" });
  }
});

// Handle unknown routes
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});


//starting https server
http.createServer((req, res) => {
  res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` });
  res.end();
}).listen(80, () => console.log("HTTP server redirecting to HTTPS..."));


https.createServer(options, app).listen(port, () => {
  console.log(`Secure server is running on https://localhost:${port}`);
});


