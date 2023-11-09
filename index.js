const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(
  cors({
    origin: [
      // "http://localhost:5173",
      // "http://localhost:5174",
     'https://moonstar-restaurant-server.vercel.app',
      "https://moonstar-restaurant.web.app",
      "https://moonstar-restaurant.firebaseapp.com",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ijwgr8d.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// middlewares
const logger = (req, res, next) => {
  console.log("log information", req.method, req.url);
  next();
};

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  if (!token) {
    return res.status(401).send({ massage: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN, (error, decode) => {
    if (error) {
      return res.status(401).send({ massage: "unauthorized access" });
    }
    req.user = decode;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const foodCollection = client.db("moonstarDB").collection("foods");
    const userCollection = client.db("userDB").collection("users");
    const addedFoodCollection = client.db("foodDB").collection("allFoods");
    const orderCollection = client.db("OrderDB").collection("orders");

    // auth related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      console.log("user for token", user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production" ? true : false,
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    app.post("/logout", async (req, res) => {
      const user = req.body;
      console.log("Logging out", user);
      res
        .clearCookie("token", {
          maxAge: 0,
          secure: process.env.NODE_ENV === "production" ? true : false,
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // Food items
    app.get("/foods", async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const cursor = foodCollection.find();
      const result = await cursor
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    app.get("/foodCount", async (req, res) => {
      const count = await foodCollection.estimatedDocumentCount();
      res.send({ count });
    });

    app.get("/foods/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await foodCollection.findOne(query);
      res.send(result);
    });

    app.post("/foods", async (req, res) => {
      const newFoodInfo = req.body;
      const result = await foodCollection.insertOne(newFoodInfo);
      res.send(result);
    });

    // count
    app.put("/showFoods/:id", async (req, res) => {
      const body = req.body;
      const id = req.params.id;
      const Count = body.Count;
      const newCount = parseInt(Count);
      const options = { upsert: true };
      const query = { _id: new ObjectId(id) };
      const update = {
        $inc: {
          Count: 1,
        },
      };
      const result = await foodCollection.updateOne(query, update, options);
      res.send(result);
    });

    // user information
    app.post("/users", async (req, res) => {
      const userInfo = req.body;
      const result = await userCollection.insertOne(userInfo);
      res.send(result);
    });

    //Add A food item
    app.post("/newFood", async (req, res) => {
      const foodInfo = req.body;
      const result = await addedFoodCollection.insertOne(foodInfo);
      res.send(result);
    });

    app.get("/newFood", logger, verifyToken, async (req, res) => {
      console.log("token owner info", req.user);
      if (req.user.email !== req.query.email) {
        return res.status(403).send({ massage: "Forbidden access" });
      }
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const cursor = addedFoodCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // Update food information
    app.put("/newFood/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedFood = req.body;
      const products = {
        $set: {
          name: updatedFood.name,
          quantity: updatedFood.quantity,
        },
      };
      const result = await addedFoodCollection.updateOne(
        filter,
        products,
        options
      );
      res.send(result);
    });

    // Order food
    app.post("/orderFood", async (req, res) => {
      const orderInfo = req.body;
      const result = await orderCollection.insertOne(orderInfo);
      res.send(result);
    });

    app.get("/orderFood", async (req, res) => {
      const cursor = orderCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server running");
});

app.listen(port, () => {
  console.log(`Server in running in port ${port}`);
});
