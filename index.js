const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const session = require("express-session");
const path = require("path");
const bcrypt = require("bcrypt");
const axios = require("axios");
const http = require("http");
const cors = require("cors");
const schedule = require("node-schedule");

const app = express();
const db = new sqlite3.Database("./database.db");

const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: true,
}));


// Set up EJS for rendering views
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// Middleware to check authentication
function isAuthenticated(req, res, next) {
    if (!req.session.user) {
        return res.redirect("/");
    }
    next();
}

function scheduleWeeklyChallenge() {
    console.log(" Checking or setting up the weekly challenge...");

    // Get the current week’s start and end date
    const today = new Date();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay())); // Start of this week
    const endOfWeek = new Date(today.setDate(today.getDate() + 6)); // End of this week

    const startDate = startOfWeek.toISOString().split("T")[0];
    const endDate = endOfWeek.toISOString().split("T")[0];

    // Check if a challenge already exists for this week
    db.get("SELECT * FROM weekly_challenges WHERE start_date = ?", [startDate], (err, existingChallenge) => {
        if (err) {
            console.error(" Error checking weekly challenge:", err);
            return;
        }

        if (existingChallenge) {
            console.log(`Weekly challenge already exists: Exercise ID ${existingChallenge.exercise_id}`);
            return;
        }

        console.log(" Selecting a new weekly challenge...");

        // Get a random exercise from the database
        db.get("SELECT exercise_id FROM exercises ORDER BY RANDOM() LIMIT 1", [], (err, row) => {
            if (err || !row) {
                console.error(" Error selecting weekly challenge:", err);
                return;
            }

            const exerciseId = row.exercise_id;

            // Insert new weekly challenge into the database
            db.run(
                "INSERT INTO weekly_challenges (exercise_id, start_date, end_date) VALUES (?, ?, ?)",
                [exerciseId, startDate, endDate],
                (err) => {
                    if (err) {
                        console.error(" Error inserting weekly challenge:", err);
                    } else {
                        console.log(`New Weekly Challenge: Exercise ID ${exerciseId}, Start: ${startDate}, End: ${endDate}`);
                    }
                }
            );
        });
    });

    // Schedule the Weekly Challenge Selection (Runs Every Monday at Midnight)
    schedule.scheduleJob("0 0 * * 1", () => {
        console.log("Running scheduled weekly challenge update...");
        scheduleWeeklyChallenge();
    });
}



// Home Page
// app.get("/", (req, res) => {
//     const user = req.session.user || null;
//     res.render("index", { user });
// });

app.get("/", (req, res) => {
    if (!req.session.user) {
        return res.render("index", { user: null, pendingRequests: 0 });
    }

    const userId = req.session.user.user_id;

    db.get(
        "SELECT COUNT(*) AS count FROM friends WHERE friend_id = ? AND status = 'pending'",
        [userId],
        (err, row) => {
            if (err) {
                console.error("Error fetching friend requests:", err);
                return res.render("index", { user: req.session.user, pendingRequests: 0 });
            }
            const pendingRequests = row ? row.count : 0;
            res.render("index", { user: req.session.user, pendingRequests });
        }
    );
});

//  Register Route (Hashes password before saving)
app.post("/register", (req, res) => {
    const { username, email, password } = req.body;

    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            console.error(" Error hashing password:", err);
            return res.redirect("/?error=Registration failed");
        }

        db.run(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            [username, email, hashedPassword],
            function (err) {
                if (err) {
                    console.error(" Error inserting user:", err);
                    return res.redirect("/?error=Registration failed");
                }
                
                // Retrieve new user_id after insertion
                const userId = this.lastID; // Gets the auto-incremented ID
                
                req.session.user = { user_id: userId, username, email };
                console.log(`Registered User: ${username} (User ID: ${userId})`);
                
                res.redirect("/");
            }
        );
    });
});

//  Login Route 
app.post("/login", (req, res) => {
    const { email, password } = req.body;

    db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
        if (err) {
            console.error(" Database error:", err);
            return res.redirect("/");
        }

        if (!user) {
            console.log(" Invalid login attempt (User not found):", email);
            return res.redirect("/?error=Invalid credentials");
        }

        bcrypt.compare(password, user.password_hash, (err, result) => {
            if (result) {
                req.session.user = { user_id: user.user_id, username: user.username, email: user.email };
                console.log(` User logged in: ${user.username} (User ID: ${user.user_id})`);
                res.redirect("/");
            } else {
                console.log(" Invalid login attempt (Wrong password):", email);
                res.redirect("/?error=Invalid credentials");
            }
        });
    });
});

//  Logout Route
app.get("/logout", (req, res) => {
    console.log(` User logged out: ${req.session.user?.username || "Unknown User"}`);
    req.session.destroy(() => {
        res.redirect("/");
    });
});

//  Track Workout Page
app.get("/track-workout", isAuthenticated, (req, res) => {
    db.all("SELECT * FROM exercises", [], (err, rows) => {
        if (err) {
            console.error(" Error fetching exercises:", err);
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

//  Get Workout Dates for Calendar 
app.get("/workouts/dates", isAuthenticated, (req, res) => {
    const userId = req.session.user.user_id; 

    console.log(` Fetching workouts for user_id: ${userId}`);
    
    db.all("SELECT workout_date FROM workouts WHERE user_id = ?", [userId], (err, rows) => {
        if (err) {
            console.error(" Database error fetching workout dates:", err);
            return res.status(500).json({ error: "Database error" });
        }

        if (rows.length === 0) {
            console.log(" No workouts found in the database for user:", userId);
            return res.json([]); // No workouts yet
        }

        const workoutDates = rows.map(row => row.workout_date);
        console.log(" Retrieved workout dates from DB:", workoutDates); // Debugging log
        res.json(workoutDates);
    });
});

//  Get Specific Workout Data
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

app.post("/workouts/save", isAuthenticated, (req, res) => {
    const { date, workout } = req.body;
    const userId = req.session.user.user_id;

    // Step 1: Insert Workout Session (if not exists)
    db.run(
        "INSERT INTO workouts (user_id, workout_date) VALUES (?, ?) ON CONFLICT(user_id, workout_date) DO NOTHING",
        [userId, date],
        function (err) {
            if (err) {
                console.error("Error saving workout:", err);
                return res.status(500).json({ message: "Error saving workout." });
            }

            // Get the workout_id of the session (either new or existing)
            db.get(
                "SELECT workout_id FROM workouts WHERE user_id = ? AND workout_date = ?",
                [userId, date],
                (err, workoutSession) => {
                    if (err || !workoutSession) {
                        return res.status(500).json({ message: "Error retrieving workout session." });
                    }

                    const workoutId = workoutSession.workout_id;

                    // Step 2: Insert Exercises into Workout Log
                    const insertExercises = workout.map((ex) => {
                        return new Promise((resolve, reject) => {
                            db.run(
                                "INSERT INTO workout_exercises (workout_id, exercise_id, sets, reps, weight) VALUES (?, ?, ?, ?, ?)",
                                [workoutId, ex.exercise_id, ex.sets, ex.reps, ex.weight || 0],
                                (err) => (err ? reject(err) : resolve())
                            );
                        });
                    });

                    // Step 3: Check for Weekly Challenge Participation
                    db.get(
                        `SELECT challenge_id FROM weekly_challenges
                         WHERE DATE('now') BETWEEN start_date AND end_date`,
                        [],
                        async (err, challenge) => {
                            if (err || !challenge) {
                                console.log("No active weekly challenge.");
                                return;
                            }

                            const challengeId = challenge.challenge_id;

                            // Filter only exercises that match the challenge exercise
                            const challengeExercises = workout.filter(
                                (ex) => ex.exercise_id === challenge.exercise_id
                            );

                            if (challengeExercises.length > 0) {
                                console.log(`🏆 User ${userId} participated in the weekly challenge!`);

                                // Insert Challenge Participation
                                const insertChallengeEntries = challengeExercises.map((ex) => {
                                    return new Promise((resolve, reject) => {
                                        db.run(
                                            `INSERT INTO weekly_challenge_participants 
                                             (challenge_id, user_id, sets, reps, weight)
                                             VALUES (?, ?, ?, ?, ?)`,
                                            [challengeId, userId, ex.sets, ex.reps, ex.weight || 0],
                                            (err) => (err ? reject(err) : resolve())
                                        );
                                    });
                                });

                                await Promise.all(insertChallengeEntries);
                            }
                        }
                    );

                    // Step 4: Complete the workout log insertion
                    Promise.all(insertExercises)
                        .then(() => res.json({ message: "Workout logged successfully!" }))
                        .catch((err) => {
                            console.error("Error saving exercises:", err);
                            res.status(500).json({ message: "Error saving exercises." });
                        });
                }
            );
        }
    );
});

//  Function to Update Personal Records (PRs)
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

                        console.log(` New PR Logged for Exercise ID ${exercise.exercise_id}! Weight: ${exercise.weight}kg`);
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

//  Route: User Account Page with Profile & PR Retrieval
app.get("/account", isAuthenticated, (req, res) => {
    const userId = req.session.user.user_id;

    //  Retrieve User Profile Data
    db.get(`
        SELECT username, email, phone, country, city, address, postal_code, 
               height_cm, weight_kg, bmi, age, goals, occupation
        FROM users WHERE user_id = ?`,
        [userId], (err, user) => {
            if (!user) return res.redirect("/");
            if (err) return res.send("Error retrieving user profile data.");

            //  Retrieve Personal Records (PRs)
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
                    
                    //  Group PRs by muscle group
                    let groupedPRs = {};
                    personalRecords.forEach(record => {
                        if (!groupedPRs[record.muscle_group]) {
                            groupedPRs[record.muscle_group] = [];
                        }
                        groupedPRs[record.muscle_group].push(record);
                    });

                    //  Retrieve Past Workouts (Including PRs)
                    db.all(`
                        SELECT workouts.workout_date AS date, exercises.name, exercises.muscle_group, 
                               workout_exercises.sets, workout_exercises.reps, workout_exercises.weight
                        FROM workout_exercises
                        JOIN workouts ON workouts.workout_id = workout_exercises.workout_id
                        JOIN exercises ON exercises.exercise_id = workout_exercises.exercise_id
                        WHERE workouts.user_id = ?
                        ORDER BY workouts.workout_date DESC`,
                        [userId], (err, pastWorkouts) => {
                            if (err) return res.send("Error retrieving past workouts.");
                            
                            res.render("account", { user, personalRecords: groupedPRs, pastWorkouts });
                        }
                    );
                }
            );
        }
    );
});

// API Route: Fetch User Data & Past Workouts as JSON
app.get("/account/data", isAuthenticated, (req, res) => {
    const userId = req.session.user.user_id;

    //  Retrieve User Profile Data
    db.get(`
        SELECT username, email, phone, country, city, address, postal_code, 
               height_cm, weight_kg, bmi, age, goals, occupation
        FROM users WHERE user_id = ?`,
        [userId], (err, user) => {
            if (err || !user) {
                console.error("Error fetching user profile:", err);
                return res.status(500).json({ error: "Error retrieving user data." });
            }

            //  Retrieve Personal Records (PRs)
            db.all(`
                SELECT exercises.name AS exercise_name, exercises.muscle_group, 
                       personal_records.max_weight, personal_records.max_reps, 
                       personal_records.achieved_date
                FROM personal_records
                JOIN exercises ON personal_records.exercise_id = exercises.exercise_id
                WHERE personal_records.user_id = ?
                ORDER BY exercises.muscle_group ASC, personal_records.max_weight DESC`,
                [userId], (err, personalRecords) => {
                    if (err) {
                        console.error("Error fetching PRs:", err);
                        return res.status(500).json({ error: "Error retrieving PRs." });
                    }
                    
                    //  Group PRs by muscle group
                    let groupedPRs = {};
                    personalRecords.forEach(record => {
                        if (!groupedPRs[record.muscle_group]) {
                            groupedPRs[record.muscle_group] = [];
                        }
                        groupedPRs[record.muscle_group].push(record);
                    });

                    //  Retrieve Past Workouts (Including PRs)
                    db.all(`
                        SELECT workouts.workout_date AS date, exercises.name, exercises.muscle_group, 
                               workout_exercises.sets, workout_exercises.reps, workout_exercises.weight
                        FROM workout_exercises
                        JOIN workouts ON workouts.workout_id = workout_exercises.workout_id
                        JOIN exercises ON exercises.exercise_id = workout_exercises.exercise_id
                        WHERE workouts.user_id = ?
                        ORDER BY workouts.workout_date DESC`,
                        [userId], (err, pastWorkouts) => {
                            if (err) {
                                console.error("Error fetching past workouts:", err);
                                return res.status(500).json({ error: "Error retrieving past workouts." });
                            }

                            //  Send JSON response
                            res.json({ user, personalRecords: groupedPRs, pastWorkouts });
                        }
                    );
                }
            );
        }
    );
});

app.post("/account/update", isAuthenticated, (req, res) => {
    const { phone, country, city, address, postal_code, height, weight, age, goals, occupation } = req.body;
    const userId = req.session.user.user_id;

    //  Convert height and weight to numbers for BMI Calculation
    const heightNum = parseFloat(height);
    const weightNum = parseFloat(weight);
    let bmi = null;

    //  Calculate BMI if height and weight are valid numbers
    if (!isNaN(heightNum) && heightNum > 0 && !isNaN(weightNum) && weightNum > 0) {
        bmi = (weightNum / ((heightNum / 100) * (heightNum / 100))).toFixed(2);
    }

    console.log(`Updating user ${userId} with BMI: ${bmi}`); // Debugging log

    //  Update user profile in the database, including BMI
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

            //  After updating, refresh the session with new user data
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

//  View Social Hub Page
app.get("/socials", isAuthenticated, (req, res) => {
    res.render("socials", { user: req.session.user });
});

//  Retrieve Nearby Users Using Google Maps API & Postal Code
app.get("/socials/nearby-users", isAuthenticated, async (req, res) => {
    const userId = req.session.user.user_id;
    const apiKey = "AIzaSyBXW1lY6EDrjIG3vd1L86ymIN9YKH7_ml4"; // Replace with actual API key

    db.get("SELECT postal_code, country FROM users WHERE user_id = ?", [userId], async (err, user) => {
        if (err || !user || !user.postal_code || !user.country) {
            return res.json({ message: "Please update your profile with a valid postal code and country." });
        }

        try {
            // Get user's latitude & longitude
            const userGeoResponse = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${user.postal_code},${user.country}&key=${apiKey}`);
            const userLocation = userGeoResponse.data.results[0]?.geometry.location;

            if (!userLocation) return res.json({ message: "Invalid postal code." });

            // Retrieve all other users' postal codes
            db.all("SELECT user_id, username, postal_code, country, city FROM users WHERE user_id != ?", [userId], async (err, users) => {
                if (err) return res.status(500).json({ message: "Error retrieving users." });

                const destinations = users
                    .filter(u => u.postal_code && u.country)
                    .map(u => `${u.postal_code},${u.country}`)
                    .join("|");

                if (!destinations) return res.json({ message: "No users with valid locations found." });

                // Use Google Maps Distance Matrix API to calculate distances
                const distanceResponse = await axios.get(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${user.postal_code},${user.country}&destinations=${destinations}&mode=driving&key=${apiKey}`);
                const distances = distanceResponse.data.rows[0].elements;

                // Filter users within 20km
                const nearbyUsers = users
                    .map((u, index) => ({
                        user_id: u.user_id,
                        username: u.username,
                        city: u.city,
                        country: u.country,
                        distance: distances[index].distance ? distances[index].distance.value / 1000 : null, // Convert meters to km
                    }))
                    .filter(u => u.distance !== null && u.distance <= 20) // Keep users within 20km
                    .sort((a, b) => a.distance - b.distance); // Sort nearest first

                res.json(nearbyUsers);
            });

        } catch (error) {
            console.error("Error fetching nearby users:", error);
            res.status(500).json({ message: "Error fetching nearby users." });
        }
    });
});

//  Find Users with Similar Goals
app.get("/socials/similar-goals", isAuthenticated, (req, res) => {
    const userId = req.session.user.user_id;

    db.get("SELECT goals FROM users WHERE user_id = ?", [userId], (err, user) => {
        if (!user || !user.goals) return res.json([]);

        db.all("SELECT user_id, username, goals FROM users WHERE goals = ? AND user_id != ?", 
            [user.goals, userId], (err, users) => {
            if (err) return res.status(500).json([]);
            res.json(users.length ? users : []);
        });
    });
});

//  Send Message (Chat)
app.post("/socials/send-message", isAuthenticated, (req, res) => {
    const { recipient_id, group_id, content } = req.body;
    const sender_id = req.session.user.user_id;

    db.run("INSERT INTO messages (sender_id, recipient_id, group_id, content) VALUES (?, ?, ?, ?)",
        [sender_id, recipient_id, group_id, content], (err) => {
            if (err) return res.status(500).json({ message: "Message sending failed." });
            io.emit("newMessage", { sender_id, recipient_id, group_id, content });
            res.json({ message: "Message sent!" });
        });
});
    
//  Route: Search Users (Exclude self & mark friends)
app.get("/socials/search-users", isAuthenticated, (req, res) => {
    const searchQuery = req.query.query?.trim();
    const userId = req.session.user.user_id;

    if (!searchQuery || searchQuery.length === 0) {
        return res.status(400).json({ message: "Enter a username to search." });
    }

    console.log(`Searching users with query: ${searchQuery}`);

    const query = `
        SELECT u.user_id, u.username, u.city, u.country, 
               CASE 
                   WHEN f.friend_id IS NOT NULL THEN 'friend'
                   ELSE 'not_friend'
               END AS friendship_status
        FROM users u
        LEFT JOIN friends f ON (u.user_id = f.friend_id AND f.user_id = ?) 
        WHERE u.username LIKE ? AND u.user_id != ?
        LIMIT 10
    `;

    db.all(query, [userId, `%${searchQuery}%`, userId], (err, users) => {
        if (err) {
            console.error("Error fetching users:", err);
            return res.status(500).json({ message: "Error fetching users." });
        }

        console.log("User search results:", users);

        if (users.length === 0) {
            return res.json({ message: "No users found." });
        }

        res.json(users);
    });
});

//  Send Friend Request
app.post("/socials/add-friend", isAuthenticated, (req, res) => {
    const { friend_id } = req.body;
    const userId = req.session.user.user_id;

    if (!friend_id || userId === friend_id) {
        return res.json({ message: "Invalid friend request." });
    }

    // Check if friendship already exists
    db.get("SELECT * FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)", 
        [userId, friend_id, friend_id, userId], (err, existing) => {
        
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ message: "Error sending friend request." });
        }

        if (existing) {
            return res.json({ message: "Friend request already sent or you are already friends." });
        }

        // Insert friend request
        db.run("INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, 'pending')", 
            [userId, friend_id], (err) => {
            
            if (err) {
                console.error("Error inserting friend request:", err);
                return res.status(500).json({ message: "Error sending friend request." });
            }

            res.json({ message: "Friend request sent!" });
        });
    });
});

app.get("/socials/friend-requests", isAuthenticated, (req, res) => {
    const userId = req.session.user.user_id;

    db.all(`
        SELECT users.user_id, users.username 
        FROM friends 
        JOIN users ON friends.user_id = users.user_id 
        WHERE friends.friend_id = ? AND friends.status = 'pending'`,
        [userId], (err, requests) => {
            if (err) {
                console.error("Error fetching friend requests:", err);
                return res.status(500).json([]);
            }
            res.json(requests.length ? requests : []);
        }
    );
});

//  Accept or Reject Friend Request
app.post("/socials/respond-friend", isAuthenticated, (req, res) => {
    const { friend_id, action } = req.body;
    const userId = req.session.user.user_id;

    if (!friend_id || !["accept", "reject"].includes(action)) {
        return res.status(400).json({ message: "Invalid friend request action." });
    }

    if (action === "accept") {
        db.run("UPDATE friends SET status = 'accepted' WHERE user_id = ? AND friend_id = ?",
            [friend_id, userId], function (err) {
                if (err) {
                    console.error("Error accepting friend request:", err);
                    return res.status(500).json({ message: "Error accepting friend request." });
                }

                //  Automatically create an empty private chat entry
                db.run("INSERT INTO private_chat (sender_id, receiver_id, message) VALUES (?, ?, ?)",
                    [userId, friend_id, ""], (err) => {
                        if (err) {
                            console.error("Error initializing private chat:", err);
                            return res.status(500).json({ message: "Friend request accepted but chat initialization failed." });
                        }
                        res.json({ message: "Friend request accepted!" });
                    }
                );
            }
        );
    } else {
        // If rejected, just remove the request
        db.run("DELETE FROM friends WHERE user_id = ? AND friend_id = ?", [friend_id, userId], (err) => {
            if (err) {
                console.error("Error rejecting friend request:", err);
                return res.status(500).json({ message: "Error rejecting friend request." });
            }
            res.json({ message: "Friend request rejected." });
        });
    }
});

//  Get Friend List
app.get("/socials/friends", isAuthenticated, (req, res) => {
    const userId = req.session.user.user_id;

    db.all(`
        SELECT users.user_id, users.username 
        FROM friends 
        JOIN users ON friends.friend_id = users.user_id 
        WHERE friends.user_id = ? AND friends.status = 'accepted'
        UNION
        SELECT users.user_id, users.username 
        FROM friends 
        JOIN users ON friends.user_id = users.user_id 
        WHERE friends.friend_id = ? AND friends.status = 'accepted'
    `, [userId, userId], (err, friends) => {
        if (err) return res.status(500).json({ message: "Error retrieving friends." });
        res.json(friends.length ? friends : { message: "No friends yet." });
    });
});

//  Create Group and Automatically Add Creator as Member
app.post("/socials/create-group", isAuthenticated, (req, res) => {
    const { group_name } = req.body;
    const creatorId = req.session.user.user_id;

    if (!group_name.trim()) {
        return res.status(400).json({ message: "Group name cannot be empty." });
    }

    db.run("INSERT INTO groups (group_name, created_by) VALUES (?, ?)",
        [group_name, creatorId], function (err) {
            if (err) {
                console.error("Error creating group:", err);
                return res.status(500).json({ message: "Error creating group." });
            }

            const groupId = this.lastID;

            //  Add creator as a group member
            db.run("INSERT INTO group_members (group_id, user_id) VALUES (?, ?)",
                [groupId, creatorId], function (err) {
                    if (err) {
                        console.error("Error adding creator to group:", err);
                        return res.status(500).json({ message: "Group created but adding creator failed." });
                    }

                    //  Initialize an empty chat entry for the group
                    db.run("INSERT INTO group_chat (group_id, sender_id, message) VALUES (?, ?, ?)",
                        [groupId, creatorId, ""], function (err) {
                            if (err) {
                                console.error("Error initializing group chat:", err);
                                return res.status(500).json({ message: "Group created but chat initialization failed." });
                            }

                            console.log("Group successfully created:", { group_id: groupId });
                            res.json({ message: "Group created successfully!", group_id: groupId });
                        }
                    );
                }
            );
        }
    );
});

//  Search for Groups (Exclude Joined Groups)
app.get("/socials/search-groups", isAuthenticated, (req, res) => {
    const searchQuery = req.query.query ? `%${req.query.query}%` : "%";
    const userId = req.session.user.user_id;

    db.all(`
        SELECT g.group_id, g.group_name, g.created_by, u.username AS leader_name
        FROM groups g
        JOIN users u ON g.created_by = u.user_id
        WHERE g.group_name LIKE ?
        AND g.group_id NOT IN (SELECT group_id FROM group_members WHERE user_id = ?)`,
        [searchQuery, userId], (err, groups) => {
        if (err) {
            console.error("Error searching groups:", err);
            return res.status(500).json([]);
        }

        console.log("Available Groups (Filtered):", groups); // Debugging log

        res.json(groups.length ? groups : []);
    });
});

//  Join Group (No Role Assignment)
app.post("/socials/join-group", isAuthenticated, (req, res) => {
    const { group_id } = req.body;
    const userId = req.session.user.user_id;

    if (!group_id) return res.json({ message: "Invalid group." });

    // Check if the user is already in the group
    db.get("SELECT * FROM group_members WHERE group_id = ? AND user_id = ?", 
        [group_id, userId], (err, existing) => {
        
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ message: "Error joining group." });
        }

        if (existing) {
            return res.json({ message: "You are already a member of this group." });
        }

        //  Insert the user into `group_members` without assigning roles
        db.run("INSERT INTO group_members (group_id, user_id) VALUES (?, ?)", 
            [group_id, userId], (err) => {
            if (err) {
                console.error("Error joining group:", err);
                return res.status(500).json({ message: "Error joining group." });
            }

            res.json({ message: "Successfully joined group!" });
        });
    });
});

app.get("/socials/my-groups", isAuthenticated, (req, res) => {
    const userId = req.session.user.user_id;

    db.all(`
        SELECT g.group_id, g.group_name, g.created_by, u.username AS leader_name
        FROM group_members gm
        JOIN groups g ON gm.group_id = g.group_id
        JOIN users u ON g.created_by = u.user_id
        WHERE gm.user_id = ?`,
        [userId], (err, groups) => {
            if (err) {
                console.error("Error fetching user's groups:", err);
                return res.status(500).json([]);
            }

            res.json(groups.length ? groups : []);
        }
    );
});

//  Add Member to Group
app.post("/socials/add-group-member", isAuthenticated, (req, res) => {
    const { group_id, user_id } = req.body;

    db.run("INSERT INTO group_members (group_id, user_id) VALUES (?, ?)", [group_id, user_id], (err) => {
        if (err) return res.status(500).json({ message: "Error adding member to group." });
        res.json({ message: "Member added to group." });
    });
});

//  Get Groups a User is in
app.get("/socials/groups", isAuthenticated, (req, res) => {
    const userId = req.session.user.user_id;

    db.all(`
        SELECT groups.group_id, groups.group_name 
        FROM group_members 
        JOIN groups ON group_members.group_id = groups.group_id 
        WHERE group_members.user_id = ?`, 
        [userId], (err, groups) => {
            if (err) return res.status(500).json({ message: "Error retrieving groups." });

            //  Ensure response is always an array
            res.json(groups.length ? groups : []);
        }
    );
});

//  Retrieve Group Chat Messages Using group_id
app.get("/socials/group-chat", isAuthenticated, (req, res) => {
    const { group_id } = req.query;

    if (!group_id) {
        return res.status(400).json({ message: "Invalid group ID." });
    }

    db.all(`
        SELECT gc.sender_id, u.username AS sender, gc.message, gc.timestamp 
        FROM group_chat gc
        JOIN users u ON gc.sender_id = u.user_id
        WHERE gc.group_id = ? 
        ORDER BY gc.timestamp ASC`,
        [group_id], (err, messages) => {
            if (err) {
                console.error("Error fetching group chat messages:", err);
                return res.status(500).json([]);
            }
            console.log(`Fetched messages for group_id ${group_id}:`, messages); //  Debugging log
            res.json(Array.isArray(messages) ? messages : []);
        }
    );
});

//  Send Message to Group Chat (Fixed)
app.post("/socials/group-chat/send", isAuthenticated, (req, res) => {
    const { group_id, message } = req.body;
    const senderId = req.session.user.user_id;

    if (!group_id || !message.trim()) {
        return res.status(400).json({ message: "Invalid message request." });
    }

    db.run(`
        INSERT INTO group_chat (group_id, sender_id, message) 
        VALUES (?, ?, ?)`,
        [group_id, senderId, message.trim()], function (err) {
            if (err) {
                console.error("Error sending group message:", err);
                return res.status(500).json({ message: "Failed to send message." });
            }
            res.json({ message: "Message sent successfully." });
        }
    );
});

//  Retrieve Private Chat Messages Using user_id
app.get("/socials/private-chat", isAuthenticated, (req, res) => {
    const { user_id } = req.query;
    const currentUserId = req.session.user.user_id;

    if (!user_id) {
        return res.status(400).json({ message: "Invalid user ID." });
    }

    db.all(`
        SELECT pc.sender_id, u.username AS sender, pc.message, pc.timestamp 
        FROM private_chat pc
        JOIN users u ON pc.sender_id = u.user_id
        WHERE (pc.sender_id = ? AND pc.receiver_id = ?)
        OR (pc.sender_id = ? AND pc.receiver_id = ?)
        ORDER BY pc.timestamp ASC`,
        [currentUserId, user_id, user_id, currentUserId], (err, messages) => {
            if (err) {
                console.error("Error fetching private chat messages:", err);
                return res.status(500).json([]);
            }
            console.log(`Fetched messages for conversation between ${currentUserId} and ${user_id}:`, messages); //  Debugging log
            res.json(Array.isArray(messages) ? messages : []);
        }
    );
});

//  Send Private Chat Message (Ensure user_id is valid)
app.post("/socials/private-chat/send", isAuthenticated, (req, res) => {
    const { user_id, message } = req.body;
    const senderId = req.session.user.user_id;

    if (!user_id || !message.trim()) {
        console.error("Error: Missing user_id or empty message in private chat request.");
        return res.status(400).json({ message: "Invalid message request." });
    }

    db.run(`
        INSERT INTO private_chat (sender_id, receiver_id, message) 
        VALUES (?, ?, ?)`,
        [senderId, user_id, message.trim()], function (err) {
            if (err) {
                console.error("Error sending private message:", err);
                return res.status(500).json({ message: "Failed to send message." });
            }
            res.json({ message: "Message sent successfully." });
        }
    );
});

//  Delete Group (Only if the user is the creator)
app.post("/socials/delete-group", isAuthenticated, (req, res) => {
    const { group_id } = req.body;
    const userId = req.session.user.user_id;

    if (!group_id) return res.json({ message: "Invalid group." });

    // Check if the user is the group creator
    db.get("SELECT * FROM groups WHERE group_id = ? AND created_by = ?", 
        [group_id, userId], (err, group) => {
        
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ message: "Error deleting group." });
        }

        if (!group) {
            return res.json({ message: "You do not have permission to delete this group." });
        }

        //  First, delete all members from group_members
        db.run("DELETE FROM group_members WHERE group_id = ?", [group_id], (err) => {
            if (err) {
                console.error("Error deleting group members:", err);
                return res.status(500).json({ message: "Error deleting group members." });
            }

            //  Then, delete the group itself
            db.run("DELETE FROM groups WHERE group_id = ?", [group_id], (err) => {
                if (err) {
                    console.error("Error deleting group:", err);
                    return res.status(500).json({ message: "Error deleting group." });
                }

                res.json({ message: "Group deleted successfully!" });
            });
        });
    });
});

app.get("/weekly-challenge", (req, res) => {
    scheduleWeeklyChallenge(); // Run challenge selection logic

    // Fetch the current challenge
    db.get(
        `SELECT wc.exercise_id, e.name AS exercise_name, wc.start_date, wc.end_date 
         FROM weekly_challenges wc
         JOIN exercises e ON wc.exercise_id = e.exercise_id
         ORDER BY wc.start_date DESC LIMIT 1`, 
        (err, challenge) => {
            if (err) {
                console.error("Error fetching weekly challenge:", err);
                return res.status(500).send("Error retrieving challenge.");
            }

            if (!challenge) {
                console.log("No active weekly challenge found.");
            }

            const userId = req.session.user?.user_id;

            // Get the user's participation
            db.get(
                `SELECT weight, reps FROM workout_exercises we
                 JOIN workouts w ON we.workout_id = w.workout_id
                 WHERE w.user_id = ? AND we.exercise_id = ? 
                 AND w.workout_date BETWEEN ? AND ? 
                 ORDER BY (we.weight * we.reps) DESC LIMIT 1`,
                [userId, challenge?.exercise_id, challenge?.start_date, challenge?.end_date],
                (err, userChallenge) => {
                    if (err) {
                        console.error("Error fetching user challenge data:", err);
                        return res.status(500).send("Error retrieving user progress.");
                    }

                    // Retrieve leaderboard data (Keeping Only the Best Entry Per User)
                    db.all(
                        `SELECT u.username, MAX(we.weight * we.reps) AS best_score, we.weight, we.reps 
                         FROM workout_exercises we
                         JOIN workouts w ON we.workout_id = w.workout_id
                         JOIN users u ON w.user_id = u.user_id
                         WHERE we.exercise_id = ? 
                         AND w.workout_date BETWEEN ? AND ? 
                         GROUP BY u.user_id  -- Ensures only the best record per user
                         ORDER BY best_score DESC LIMIT 10`,
                        [challenge?.exercise_id, challenge?.start_date, challenge?.end_date],
                        (err, leaderboard) => {
                            if (err) {
                                console.error("Error fetching leaderboard:", err);
                                return res.status(500).send("Error retrieving leaderboard.");
                            }

                            res.render("weekly-challenge", {
                                user: req.session.user,
                                challenge,
                                userChallenge,
                                leaderboard: leaderboard || []
                            });
                        }
                    );
                }
            );
        }
    );
});

// Route: Get Current Weekly Challenge Data
app.get("/weekly-challenge/data", (req, res) => {
    const today = new Date().toISOString().split("T")[0];

    db.get(
        `SELECT wc.challenge_id, wc.exercise_id, e.name AS exercise_name, e.muscle_group, wc.start_date, wc.end_date
        FROM weekly_challenges wc
        JOIN exercises e ON wc.exercise_id = e.exercise_id
        WHERE wc.start_date <= ? AND wc.end_date >= ? 
        ORDER BY wc.start_date DESC LIMIT 1`,
        [today, today],
        (err, challenge) => {
            if (err) {
                console.error(" Error fetching weekly challenge:", err);
                return res.status(500).json({ message: "Error fetching weekly challenge." });
            }

            if (!challenge) {
                return res.json({ message: "No active weekly challenge found." });
            }

            res.json(challenge);
        }
    );
});

app.get("/weekly-challenge/rankings", isAuthenticated, (req, res) => {
    db.get(
        `SELECT challenge_id FROM weekly_challenges
         WHERE DATE('now') BETWEEN start_date AND end_date`,
        [],
        (err, challenge) => {
            if (err || !challenge) return res.json({ message: "No active challenge rankings." });

            const challengeId = challenge.challenge_id;

            db.all(
                `SELECT u.username, wcp.sets, wcp.reps, wcp.weight, wcp.distance
                 FROM weekly_challenge_participants wcp
                 JOIN users u ON wcp.user_id = u.user_id
                 WHERE wcp.challenge_id = ?
                 ORDER BY wcp.weight DESC, wcp.reps DESC, wcp.distance DESC LIMIT 10`,
                [challengeId],
                (err, rankings) => {
                    if (err) {
                        console.error("Error fetching challenge rankings:", err);
                        return res.status(500).json({ message: "Error fetching rankings." });
                    }
                    res.json(rankings);
                }
            );
        }
    );
});

//  Start Server
app.listen(3000, () => console.log(" Server running on port 3000"));
