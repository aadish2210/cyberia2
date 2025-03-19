const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const morgan = require("morgan");

const fs = require("fs");
const https = require("https"); //for ssl certification
const cors = require("cors"); //for setting origins which can access our resource
const rateLimit = require("express-rate-limit"); 

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




