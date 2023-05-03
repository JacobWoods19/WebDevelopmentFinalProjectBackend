const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
const saltRounds = 10;
const { MongoClient, ServerApiVersion } = require('mongodb');
const crypto = require('crypto');

const jwtSecret = "secret";
const uri = "mongodb+srv://jacob45:jacob1234@cluster0.kc9hljl.mongodb.net/?retryWrites=true&w=majority";
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true,
  }
});

async function run() {
    try {
      // Connect the client to the server	(optional starting in v4.7)
      await client.connect();
      // Send a ping to confirm a successful connection
      await client.db("admin").command({ ping: 1 });
      console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
      // Ensures that the client will close when you finish/error
      await client.close();
    }
}

const app = express();

app.use(cors());
app.use(bodyParser.json());

// send hello world to the home page
app.get('/', (req, res) => {
        res.send('pong');
    }
);
app.post('/api/register', async (req, res) => {
    console.log("registering user");
    try {
        let hashed_password = await bcrypt.hash(req.body.password, saltRounds);
        const user = { user_name: req.body.user_name, password: hashed_password};
        if (user.user_name == null || user.password == null) {
            return res.status(406).send();
        }
        await client.connect();
        const result = await client.db("main").collection("users").insertOne(user);
        console.log(`A document was inserted with the _id: ${result.insertedId}`);
        res.status(201).send();
    } catch(err) {
        console.log(err);
        res.status(500).send();
    }
});

app.post('/api/login', async (req, res) => {
    console.log("logging in user");
    try {
        const user = { user_name: req.body.user_name, password: req.body.password};
        if (user.user_name == null || user.password == null) {
            return res.status(406).send();
        }
        await client.connect();
        const result = await client.db("main").collection("users").findOne({user_name: user.user_name});
        if (result == null) {
            return res.status(404).send();
        }
        if (await bcrypt.compare(user.password, result.password)) {
            //generate token, save it in db, send it to client
            const token = jwt.sign({ user_name: user.user_name, password: user.password }, jwtSecret, {
                expiresIn: '24h',
              });
            const now = new Date();
            const oneDayInMilliseconds = 24 * 60 * 60 * 1000;
            const dateIn24Hours = new Date(now.getTime() + oneDayInMilliseconds);
            const token_result = await client.db("main").collection("tokens").insertOne({token: token, expiresIn: dateIn24Hours});
            if (token_result == null) {
                return res.status(500).send();
            }
            res.status(200).send({token: token, expiresIn: dateIn24Hours});     
        } else {
            res.status(401).send();
        }
    } catch(err) {
        console.log(err);
        res.status(200).send();
    }
});
app.post('/api/add_item', async (req, res) => {
    if(req.body.token == null || req.body.title == null || req.body.description == null, req.body.date_due == null, req.body.completed == null) {
        return res.status(401).send();
    }
    try {
        const token = req.body.token;
        const decoded = jwt.verify(token, jwtSecret);
        let item_id = crypto.randomUUID();
        let now = new Date();
        const item = { user_name: decoded.user_name, title: req.body.title, description: req.body.description, date_due: req.body.date_due, completed: req.body.completed, item_id: item_id, date_created: now};
        await client.connect();
        const result = await client.db("main").collection("items").insertOne(item);
        if (result == null) {
            return res.status(500).send();
        }
        res.send({item_id: item_id});
    }
    catch(err) {
        console.log(err);
        res.status(500).send();
    }
});
app.get('/api/get_items', async (req, res) => {
    if(req.body.token == null) {
        return res.status(401).send();
    }
    try {
        const token = req.body.token;
        const decoded = jwt.verify(token, jwtSecret);
        await client.connect();
        console.log(decoded.user_name)
        const result = await client.db("main").collection("items").find({user_name: decoded.user_name}).sort({date_due: 1});
        if (result == null) {
            return res.status(500).send();
        }
        const items = await result.toArray();
        const response = {user_name : decoded.user_name, items: items};
        res.status(200).send(response);
    }
    catch(err) {
        console.log(err);
        res.status(500).send();
    }
}); 
app.delete('/api/remove_item', async (req, res) => {
    if(req.body.token == null || req.body.item_id == null) {
        return res.status(401).send();
    }
    try {
        const token = req.body.token;
        const decoded = jwt.verify(token, jwtSecret);
        await client.connect();
        const result = await client.db("main").collection("items").deleteOne({user_name: decoded.user_name, item_id: req.body.item_id});
        if (result == null) {
            return res.status(500).send();
        }
        res.status(200).send();
    }
    catch(err) {
        console.log(err);
        res.status(500).send();
    }
});
app.post('/api/update_item', async (req, res) => {
    if(req.body.token == null || req.body.item_id == null || req.body.title == null || req.body.description == null, req.body.date_due == null, req.body.completed == null) {
        return res.status(401).send();
    }
    try {
        const token = req.body.token;
        const decoded = jwt.verify(token, jwtSecret);
        await client.connect();
        const result = await client.db("main").collection("items").updateOne({user_name: decoded.user_name, item_id: req.body.item_id}, {$set: {title: req.body.title, description: req.body.description, date_due: req.body.date_due, completed: req.body.completed}});
        if (result == null) {
            return res.status(500).send();
        }
        res.status(200).send();
    }
    catch(err) {
        console.log(err);
        res.status(500).send();
    }
});
app.post('/api/complete_item', async (req, res) => {
    if(req.body.token == null || req.body.item_id == null) {
        return res.status(401).send();
    }
    try {
        const token = req.body.token;
        const decoded = jwt.verify(token, jwtSecret);
        await client.connect();
        const result = await client.db("main").collection("items").updateOne({user_name: decoded.user_name, item_id: req.body.item_id}, {$set: {completed: true}});
        if (result == null) {
            return res.status(500).send();
        }
        res.status(200).send();
    }
    catch(err) {
        console.log(err);
        res.status(500).send();
    }
});

// run a hoe 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  run().catch(console.dir);
  console.log(`Server started on port ${PORT}`);
});



