const express = require("express");
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.op9dmu8.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const userCollection = client.db("ContestHubDB").collection("users");
    const contestCollection = client.db("ContestHubDB").collection("contests");

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const isExistingUser = await userCollection.findOne(query);
      if (isExistingUser) {
        return res.send({ message: "user already in exist", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get("/contests", async (req, res) => {
      const query = {};
      const category = req.query.category;

      if (category) {
        query.contestType = category;
      }

      console.log(query);

      const result = await contestCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/contests", async (req, res) => {
      const data = req.body;
      const result = await contestCollection.insertOne(data);
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

app.use("/", async (req, res) => {
  res.send("ContestHub is running here!");
});

app.listen(port, () => {
  console.log(`server is running on port: ${port}`);
});
