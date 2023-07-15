const express = require("express");
const Redis = require("redis");
const mongoose = require("mongoose");
const app = express();
app.use(express.urlencoded({ extended: true }));
const redis = Redis.createClient({
  host: "localhost",
  port: 6379,
});

redis.on("error", (err) => console.log("Redis Client Error", err));

redis.connect().then(() => {
  console.log("Redis connected");
});

mongoose
  .connect("mongodb://127.0.0.1:27017/erp")
  .then(() => console.log("Connected to DB!"));

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    unique: true,
  },
  age: Number,
  city: String,
});

const User = mongoose.model("User", userSchema);

async function readCache(req, res, next) {
  const { username } = req.body;
  //check if user exists in the cache,if yes return
  const userData = await redis.hGetAll(username);
  if (userData) {
    return res.json({
      success: true,
      message: username + " found in cache!!",
    });
  }
  //go to the next middleware
  next();
}
async function writeToCache(req, res, next) {
  const { username, age, city } = req.body;
  //check if that key is contained in cache
  const userData = await redis.hGetAll(username);
  console.log(userData);
  if (userData) {
    //update the values
    const response = await redis.hSet(username, {
      age: age,
      city: city,
    });
  }
  next();
}

app.post("/register", writeToCache, async (req, res) => {
  const { username, age, city } = req.body;
  var newUser = new User({
    username,
    age,
    city,
  });
  //save to mongoDB
  const savedUser = await newUser.save();
  return res.json({ success: true, message: savedUser });
});

app.get("/get-user", readCache, async (req, res) => {
  //if not in cache read from mongoDB
  const { username } = req.body;
  const users = await User.find({ username });

  //set key and map in cache to ensure faster read times next time
  const response = await redis.hSet(username, {
    age: users[0].age,
    city: users[0].city,
  });
  return res.json({
    success: true,
    message: users[0] + " found in MongoDB",
  });
});

app.listen(3000, () => {
  console.log("Server listening on 3000");
});
