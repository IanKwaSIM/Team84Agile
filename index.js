const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const session = require("express-session");
const path = require("path");
const bcrypt = require("bcrypt");

const app = express();
const db = new sqlite3.Database("./database.db");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: "secret-key", resave: false, saveUninitialized: true }));

// Set up EJS for rendering views
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

// ✅ Middleware to check authentication
function isAuthenticated(req, res, next) {
    if (!req.session.user) {
        return res.redirect("/");
    }
    next();
}

// ✅ Home/Login Page
app.get("/", (req, res) => {
    const user = req.session.user || null;
    res.render("index", { user });
});

// ✅ Register Route (Hashes password before saving)
app.post("/register", (req, res) => {
    const { username, email, password } = req.body;

    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            console.error("❌ Error hashing password:", err);
            return res.redirect("/?error=Registration failed");
        }

        db.run(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            [username, email, hashedPassword],
            function (err) {
                if (err) {
                    console.error("❌ Error inserting user:", err);
                    return res.redirect("/?error=Registration failed");
                }
                
                // ✅ Retrieve new user_id after insertion
                const userId = this.lastID; // Gets the auto-incremented ID
                
                req.session.user = { user_id: userId, username, email };
                console.log(`✅ Registered User: ${username} (User ID: ${userId})`);
                
                res.redirect("/");
            }
        );
    });
});

// ✅ Login Route (Fetches `user_id`)
app.post("/login", (req, res) => {
    const { email, password } = req.body;

    db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
        if (err) {
            console.error("❌ Database error:", err);
            return res.redirect("/");
        }

        if (!user) {
            console.log("⚠️ Invalid login attempt (User not found):", email);
            return res.redirect("/?error=Invalid credentials");
        }

        bcrypt.compare(password, user.password_hash, (err, result) => {
            if (result) {
                req.session.user = { user_id: user.user_id, username: user.username, email: user.email };
                console.log(`✅ User logged in: ${user.username} (User ID: ${user.user_id})`);
                res.redirect("/");
            } else {
                console.log("⚠️ Invalid login attempt (Wrong password):", email);
                res.redirect("/?error=Invalid credentials");
            }
        });
    });
});

// ✅ Logout Route
app.get("/logout", (req, res) => {
    console.log(`👋 User logged out: ${req.session.user?.username || "Unknown User"}`);
    req.session.destroy(() => {
        res.redirect("/");
    });
});

// ✅ Track Workout Page
app.get("/track-workout", isAuthenticated, (req, res) => {
    db.all("SELECT * FROM exercises", [], (err, rows) => {
        if (err) {
            console.error("❌ Error fetching exercises:", err);
            return res.sendStatus(500);
        }

        // Group exercises by muscle group
        const exercises = {};
        rows.forEach(ex => {
            if (!exercises[ex.muscle_group]) {
                exercises[ex.muscle_group] = [];
            }
            exercises[ex.muscle_group].push(ex);
        });

        res.render("track-workout", { user: req.session.user, exercises });
    });
});

// ✅ Get Workout Dates for Calendar (Uses `user_id`)
app.get("/workouts/dates", isAuthenticated, (req, res) => {
    const userId = req.session.user.user_id; // Fetch the logged-in user's `user_id`

    console.log(`🔍 Fetching workouts for user_id: ${userId}`);
    
    db.all("SELECT workout_date FROM workouts WHERE user_id = ?", [userId], (err, rows) => {
        if (err) {
            console.error("❌ Database error fetching workout dates:", err);
            return res.status(500).json({ error: "Database error" });
        }

        if (rows.length === 0) {
            console.log("⚠️ No workouts found in the database for user:", userId);
            return res.json([]); // No workouts yet
        }

        const workoutDates = rows.map(row => row.workout_date);
        console.log("✅ Retrieved workout dates from DB:", workoutDates); // Debugging log
        res.json(workoutDates);
    });
});

// ✅ Get Specific Workout Data
app.get("/workouts/:date", isAuthenticated, (req, res) => {
    const { date } = req.params;
    const userId = req.session.user.user_id;

    console.log(`Fetching workout for user ID: ${userId} on date: ${date}`);

    db.get("SELECT workout_id FROM workouts WHERE user_id = ? AND workout_date = ?", 
        [userId, date], 
        (err, workout) => {
            if (err) {
                console.error("Database error fetching workout ID:", err);
                return res.status(500).json({ error: "Database error" });
            }

            console.log(`Workout Query Result for ${date}:`, workout);

            if (!workout || !workout.workout_id) {
                console.log(`No workout found for ${date}`);
                return res.json([]); // No workout exists
            }

            console.log(`Workout found with ID: ${workout.workout_id}`);

            // Fetch exercises for this workout
            db.all(`
                SELECT exercises.name, exercises.muscle_group, workout_exercises.sets, workout_exercises.reps, workout_exercises.weight
                FROM workout_exercises
                JOIN exercises ON workout_exercises.exercise_id = exercises.exercise_id
                WHERE workout_exercises.workout_id = ?
            `, 
            [workout.workout_id], 
            (err, rows) => {
                if (err) {
                    console.error("Error fetching workout data:", err);
                    return res.status(500).json({ error: "Error retrieving workout data" });
                }

                console.log(`Retrieved Workout Data for ${date}:`, rows);
                res.json(rows);
            });
        }
    );
});

// ✅ **Save a Workout & Update PRs**
app.post("/workouts/save", isAuthenticated, (req, res) => {
    const { date, workout } = req.body;
    const userId = req.session.user.user_id;

    // Step 1: Insert workout if it does not already exist
    db.run("INSERT INTO workouts (user_id, workout_date) VALUES (?, ?) ON CONFLICT(user_id, workout_date) DO NOTHING",
        [userId, date], function (err) {
            if (err) {
                console.error("❌ Error saving workout:", err);
                return res.status(500).json({ message: "Error saving workout." });
            }

            // Step 2: Get the workout ID (fetch latest ID if already exists)
            db.get("SELECT workout_id FROM workouts WHERE user_id = ? AND workout_date = ?", 
                [userId, date], (err, row) => {
                if (err || !row) {
                    console.error("❌ Error retrieving workout ID:", err);
                    return res.status(500).json({ message: "Error retrieving workout." });
                }

                const workoutId = row.workout_id;
                console.log("✅ Workout ID:", workoutId);

                // Step 3: Insert exercises into workout_exercises
                const insertExercises = workout.map(ex => {
                    return new Promise((resolve, reject) => {
                        db.run("INSERT INTO workout_exercises (workout_id, exercise_id, sets, reps, weight) VALUES (?, ?, ?, ?, ?)",
                            [workoutId, ex.exercise_id, ex.sets, ex.reps, ex.weight],
                            err => err ? reject(err) : resolve()
                        );
                    });
                });

                Promise.all(insertExercises)
                    .then(() => {
                        console.log("✅ Workout logged successfully!");
                        
                        // Step 4: Update PRs in personal_records
                        updatePersonalRecords(userId, workout)
                            .then(() => res.json({ message: "Workout logged and PRs updated!" }))
                            .catch(err => {
                                console.error("❌ Error updating PRs:", err);
                                res.status(500).json({ message: "Workout saved, but PR update failed." });
                            });
                    })
                    .catch(err => {
                        console.error("❌ Error saving exercises:", err);
                        res.status(500).json({ message: "Error saving exercises." });
                    });
            });
        }
    );
});

// ✅ **Function to Update Personal Records (PRs)**
function updatePersonalRecords(userId, workout) {
    return new Promise((resolve, reject) => {
        let queries = [];

        workout.forEach(exercise => {
            queries.push(new Promise((resolve, reject) => {
                // Step 1: Check existing PR for this exercise
                db.get("SELECT max_weight FROM personal_records WHERE user_id = ? AND exercise_id = ?", 
                    [userId, exercise.exercise_id], (err, row) => {
                    if (err) return reject(err);

                    if (!row || parseFloat(exercise.weight) > parseFloat(row.max_weight)) {
                        // Step 2: If no record exists OR weight is higher, update PR
                        db.run("INSERT INTO personal_records (user_id, exercise_id, max_weight, max_reps, achieved_date) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, exercise_id) DO UPDATE SET max_weight = ?, max_reps = ?, achieved_date = ?",
                            [userId, exercise.exercise_id, exercise.weight, exercise.reps, new Date().toISOString().split("T")[0], 
                             exercise.weight, exercise.reps, new Date().toISOString().split("T")[0]],
                            err => err ? reject(err) : resolve()
                        );

                        console.log(`🏆 **New PR Logged for Exercise ID ${exercise.exercise_id}! Weight: ${exercise.weight}kg**`);
                    } else {
                        resolve(); // No PR update needed
                    }
                });
            }));
        });

        Promise.all(queries).then(() => resolve()).catch(err => reject(err));
    });
}

app.delete("/workouts/delete/:date", isAuthenticated, (req, res) => {
    const { date } = req.params;
    const userId = req.session.user.user_id;

    console.log(`Deleting workout for user ID: ${userId} on date: ${date}`);

    db.get("SELECT workout_id FROM workouts WHERE user_id = ? AND workout_date = ?", 
        [userId, date], 
        (err, workout) => {
            if (err) {
                console.error("Error finding workout:", err);
                return res.status(500).json({ message: "Error finding workout." });
            }

            if (!workout) {
                console.log("Workout not found.");
                return res.json({ message: "Workout not found." });
            }

            db.run("DELETE FROM workout_exercises WHERE workout_id = ?", [workout.workout_id], (err) => {
                if (err) {
                    console.error("Error deleting workout exercises:", err);
                    return res.status(500).json({ message: "Error deleting workout exercises." });
                }

                db.run("DELETE FROM workouts WHERE workout_id = ?", [workout.workout_id], (err) => {
                    if (err) {
                        console.error("Error deleting workout:", err);
                        return res.status(500).json({ message: "Error deleting workout." });
                    }

                    console.log("Workout deleted successfully.");
                    res.json({ message: "Workout deleted successfully." });
                });
            });
        }
    );
});

// ✅ Route: User Account Page with Profile & PR Retrieval
app.get("/account", isAuthenticated, (req, res) => {
    const userId = req.session.user.user_id;

    // ✅ Retrieve User Profile Data
    db.get(`
        SELECT username, email, phone, country, city, address, postal_code, 
               height_cm, weight_kg, bmi, age, goals, occupation
        FROM users WHERE user_id = ?`,
        [userId], (err, user) => {
            if (!user) return res.redirect("/");
            if (err) return res.send("Error retrieving user profile data.");

            // ✅ Retrieve Personal Records (PRs)
            db.all(`
                SELECT exercises.name AS exercise_name, exercises.muscle_group, 
                       personal_records.max_weight, personal_records.max_reps, 
                       personal_records.achieved_date
                FROM personal_records
                JOIN exercises ON personal_records.exercise_id = exercises.exercise_id
                WHERE personal_records.user_id = ?
                ORDER BY exercises.muscle_group ASC, personal_records.max_weight DESC`,
                [userId], (err, personalRecords) => {
                    if (err) return res.send("Error retrieving personal records.");
                    
                    // ✅ Group PRs by muscle group
                    let groupedPRs = {};
                    personalRecords.forEach(record => {
                        if (!groupedPRs[record.muscle_group]) {
                            groupedPRs[record.muscle_group] = [];
                        }
                        groupedPRs[record.muscle_group].push(record);
                    });

                    res.render("account", { user, personalRecords: groupedPRs });
                }
            );
        }
    );
});

app.post("/account/update", isAuthenticated, (req, res) => {
    const { phone, country, city, address, postal_code, height, weight, age, goals, occupation } = req.body;
    const userId = req.session.user.user_id;

    // ✅ Convert height and weight to numbers for BMI Calculation
    const heightNum = parseFloat(height);
    const weightNum = parseFloat(weight);
    let bmi = null;

    // ✅ Calculate BMI if height and weight are valid numbers
    if (!isNaN(heightNum) && heightNum > 0 && !isNaN(weightNum) && weightNum > 0) {
        bmi = (weightNum / ((heightNum / 100) * (heightNum / 100))).toFixed(2);
    }

    console.log(`Updating user ${userId} with BMI: ${bmi}`); // Debugging log

    // ✅ Update user profile in the database, including BMI
    db.run(`
        UPDATE users SET phone = ?, country = ?, city = ?, address = ?, postal_code = ?,
                         height_cm = ?, weight_kg = ?, bmi = ?, age = ?, goals = ?, occupation = ?
        WHERE user_id = ?`,
        [phone, country, city, address, postal_code, heightNum, weightNum, bmi, age, goals, occupation, userId],
        (err) => {
            if (err) {
                console.error("Error updating account details:", err);
                return res.status(500).json({ message: "Error updating account details" });
            }

            // ✅ After updating, refresh the session with new user data
            db.get("SELECT * FROM users WHERE user_id = ?", [userId], (err, updatedUser) => {
                if (!updatedUser) return res.redirect("/");
                req.session.user = updatedUser;
                res.redirect("/account");
            });
        }
    );
});

app.get("/gymlocator", (req, res) => {
    res.render("gymlocator", { user: req.session.user });
});

// ✅ Route to Fetch and Render Weekly Challenge
app.get("/challenges", isAuthenticated, (req, res) => {
    const today = new Date().toISOString().split("T")[0]; // Get today's date in YYYY-MM-DD format

    db.get("SELECT challenge_text FROM challenges WHERE start_date <= ? AND end_date >= ?", 
        [today, today], 
        (err, challenge) => {
            if (err) {
                console.error("❌ Database error:", err);
                return res.status(500).send("Error fetching challenge.");
            }

            res.render("challenges", { 
                user: req.session.user,
                challenges: challenge ? challenge.challenge_text : "No challenge for this week!"
            });
        }
    );
});

// Route to get the current challenge
app.get("/challenges/current", (req, res) => {
    const today = new Date().toISOString().split("T")[0];

    db.get("SELECT challenge_text FROM challenges WHERE start_date <= ? AND end_date >= ?", [today, today], (err, row) => {
        if (err) {
            console.error("❌ Error fetching current challenge:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(row || { challenge_text: "No challenge available this week!" });
    });
});

// Route to get leaderboard data
app.get("/leaderboard", (req, res) => {
    db.all(
        "SELECT username, points FROM leaderboard ORDER BY points DESC LIMIT 10",
        [],
        (err, rows) => {
            if (err) {
                console.error("Database error:", err);
                return res.status(500).json({ error: "Internal Server Error" });
            }

            res.json(rows);
        }
    );
});

// ✅ Start Server
app.listen(3000, () => console.log("🚀 Server running on port 3000"));
