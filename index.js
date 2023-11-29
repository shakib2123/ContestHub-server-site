const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
    const registrationCollection = client
      .db("ContestHubDB")
      .collection("registrations");

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "100d",
      });
      res.send(token);
    });

    // middlewares
    const verifyToken = (req, res, next) => {
      console.log("inside verify token", req?.headers?.authorization);
      if (!req?.headers?.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization;
      jwt.verify(token, process?.env?.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req?.decoded?.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      console.log(user, email);
      const isAdmin = user?.role === "admin";

      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

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

    app.get("/users", verifyToken, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.get("/users/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });
    app.put("/users/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const role = req.body.role;
      const filter = { email: email };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          role: role,
        },
      };

      const result = await userCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    app.get("/contests", async (req, res) => {
      let query = {};
      let sort = {};
      const category = req.query.category;
      const email = req.query.email;
      const verification = req.query.status;
      const sortOrder = req.query.sortOrder;
      const page = Number(req.query.page) - 1;
      const limit = Number(req.query.limit);
      if (category) {
        query.contestType = category;
      }
      if (email) {
        query.creatorEmail = email;
      }
      if (verification) {
        query.status = verification;
      }
      if (sortOrder) {
        sort.attendance = sortOrder;
      }

      const contestCount = await contestCollection.countDocuments({
        status: "Accepted",
      });

      const allContest = await contestCollection
        .find(query)
        .skip(page * limit)
        .sort(sort)
        .toArray();
      res.send({ allContest, contestCount });
    });

    app.get("/contests/popular", async (req, res) => {
      let query = {};
      let sort = {};
      const attendance = req.query.attendance;
      const order = req.query.order;
      const searchValue = req.query.searchValue;
      if (attendance && order) {
        sort.attendance = order;
      }

      if (searchValue) {
        const keywords = searchValue.split(/\s+/).filter(Boolean);
        query.contestType = {
          $in: keywords.map((keyword) => new RegExp(keyword, "i")),
        };
      }
      const result = await contestCollection
        .find(query)
        .sort(sort)
        .limit(6)
        .toArray();
      res.send(result);
    });

    app.get("/contests/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await contestCollection.findOne(query);
      res.send(result);
    });

    app.put("/contests/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const updatedContest = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          contestName: updatedContest.contestName,
          image: updatedContest.image,
          description: updatedContest.description,
          price: updatedContest.price,
          prize: updatedContest.prize,
          instruction: updatedContest.instruction,
          contestType: updatedContest.contestType,
          deadline: updatedContest.deadline,
        },
      };

      const result = await contestCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });
    app.put("/contests/attendance/:id", async (req, res) => {
      const id = req.params.id;
      const updatedAttendance = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          attendance: updatedAttendance.attendance,
        },
      };

      const result = await contestCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    app.put("/contests/winner/:id", async (req, res) => {
      const id = req.params.id;
      const winnerData = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          winnerName: winnerData.winnerName,
          winnerEmail: winnerData.winnerEmail,
          winnerImage: winnerData.winnerImage,
        },
      };

      const result = await contestCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    app.patch("/contests/:id", async (req, res) => {
      const id = req.params.id;
      const updateInfo = req.body.status;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          status: updateInfo,
        },
      };
      const result = await contestCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    app.post("/contests", async (req, res) => {
      const data = req.body;
      const result = await contestCollection.insertOne(data);
      res.send(result);
    });

    app.delete("/contests/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await contestCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.get("/registrations/:email", async (req, res) => {
      const email = req.params.email;
      const query = { creatorEmail: email };
      const result = await registrationCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/registrations", async (req, res) => {
      const registerData = req.body;
      const result = await registrationCollection.insertOne(registerData);
      res.send(result);
    });
    app.put("/registrations/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const { winner } = req.body;
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          status: winner,
        },
      };
      const result = await registrationCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    app.get("/bestCreator", async (req, res) => {
      const result = await contestCollection
        .find()
        .sort({ attendance: -1 })
        .limit(3)
        .toArray();
      res.send(result);
    });

    app.get("/winners/advertise", async (req, res) => {
      const result = await contestCollection
        .find({ winnerName: { $exists: true } })
        .limit(6)
        .toArray();
      res.send(result);
    });

    app.get("/payments/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await registrationCollection.find(query).toArray();
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
