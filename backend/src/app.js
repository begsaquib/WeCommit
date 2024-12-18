const express = require("express");
const { validatingSignUpData } = require("./utils/validatingSignUpdata");
const { connectDB } = require("./config/database");
const User = require("./models/User");
const Team = require("./models/Team");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { userAuth } = require("./middleware/auth");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const corsOptions = {
  origin: "http://localhost:5173",
  credentials: true,
};
const app = express();

app.use(cors(corsOptions));
app.use(cors());
app.use(express.json());
app.use(cookieParser());

//API to save a user
app.post("/signup", async (req, res) => {
  try {
    validatingSignUpData(req);
    const { firstName, lastName, userName, emailId, password } = req.body;

    const passwordHash = await bcrypt.hash(password, 10);

    const user = new User({
      firstName,
      lastName,
      userName,
      emailId,
      password: passwordHash,
    });

    await user.save();
    res.status(200).send("Data saved successfully");
  } catch (err) {
    res.status(400).send("ERR04 : " + err.message);
  }
});

//API to login
app.post("/login", async (req, res) => {
  try {
    const { userName, password } = req.body;

    const user = await User.findOne({ userName: userName });
    if (!user) {
      throw new Error("Invalid credential");
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (isPasswordValid) {
      const token = await jwt.sign({ _id: user._id }, "Saquib@123", {
        expiresIn: "1d",
      });

      res.cookie("token", token, { httpOnly: true });
      res.json({ token });
    } else {
      throw new Error("Invalid credential");
    }
  } catch (err) {
    res.status(400).send("ERR04 : " + err.message);
  }
});

// API to create a new team
app.post("/teams/create", userAuth, async (req, res) => {
  try {
    const { name } = req.body;
    const creatoruserName = req.user.userName;

    // Creating new team with the creator as the first member
    const newTeam = new Team({
      name,
      members: [creatoruserName],
      creator: creatoruserName,
    });
    await newTeam.save();

    res
      .status(201)
      .json({ message: "Team created successfully", team: newTeam });
  } catch (err) {
    res.status(500).send("ERR05: " + err.message);
  }
});

// API to get a list of all teams
app.get("/teams", userAuth, async (req, res) => {
  try {
    const teams = await Team.find().select("name"); // Only select team names
    res.status(200).json({
      message: "Teams retrieved successfully",
      teams,
    });
  } catch (err) {
    res.status(500).send("ERR06: " + err.message);
  }
});

// API to remove a member from a team
app.delete("/teams/:teamName/remove", userAuth, async (req, res) => {
  try {
    const { teamName } = req.params; // Get teamName from URL params
    const { userName } = req.body; // Get userName from the request body

    // Find the team by its name (not ID)
    const team = await Team.findOne({ name: teamName });

    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    // Check if the user is a member of the team
    if (!team.members.includes(userName)) {
      return res
        .status(400)
        .json({ message: "User is not a member of this team" });
    }

    // Remove the user from the team members array
    team.members = team.members.filter((member) => member !== userName);

    // Save the updated team
    await team.save();

    // Respond with a success message and updated team data
    res.status(200).json({ message: "Member removed successfully", team });
  } catch (err) {
    res.status(500).send("ERR08: " + err.message);
  }
});

// API to add a member to a team
app.post("/teams/:teamName/addMember", userAuth, async (req, res) => {
  try {
    const { teamName } = req.params;
    const { userName } = req.body;

    const team = await Team.findOne({ name: teamName });

    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    const user = await User.findOne({ userName: userName });

    if (!user) {
      return res.status(400).json({ message: "Not a registered user" });
    }

    if (team.members.includes(userName)) {
      return res
        .status(400)
        .json({ message: "User is already a member of this team" });
    }

    // Add the user to the team members array
    team.members.push(userName);

    // Save the updated team
    await team.save();

    // Respond with a success message and updated team data
    res.status(200).json({ message: "Member added successfully", team });
  } catch (err) {
    res.status(500).send("ERR09: " + err.message);
  }
});

//API to check if a member is part of the team or not
app.get("/:teamName/check-membership", userAuth, async (req, res) => {
  try {
    const { teamName } = req.params;
    const userName = req.user.userName;

    const team = await Team.findOne({ name: teamName });

    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    const isMember = team.members.includes(userName);

    if (isMember) {
      return res.status(200).json({ message: "User is a member of the team" });
    } else {
      return res
        .status(403)
        .json({ message: "User is not a member of the team" });
    }
  } catch (error) {
    console.error("Error checking team membership:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
});

// API to fetch team members name by team name
app.get("/team/:teamname", userAuth, async (req, res) => {
  const { teamname } = req.params;

  try {
    const team = await Team.findOne({ name: teamname })
    if (team) {
      const membersData = await User.find(
        { userName: { $in: team.members } },
        "userName emailId"
      );
      team.members = membersData;
    }
    

    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    const teamResponse = {
      id: team._id,
      name: team.name,
      members: team.members,
    };

    return res.json(teamResponse);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching team data", error: error.message });
  }
});

connectDB()
  .then(() => {
    app.listen(7777, () => {
      console.log("Server is running perfectly...");
    });
  })
  .catch((err) => {
    console.log("database connection failed");
  });
