-- Create Users Table
CREATE TABLE users (
    user_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    username       VARCHAR(50) UNIQUE NOT NULL,
    email          VARCHAR(100) UNIQUE NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    phone          VARCHAR(20),  -- Optional phone number
    country        VARCHAR(100), -- Optional country
    city           VARCHAR(100), -- Optional city
    address        TEXT,         -- Optional full address
    postal_code    VARCHAR(20),  -- Optional postal code
    occupation     VARCHAR(100), -- Optional occupation
    age            INT,
    height_cm      DECIMAL(5,2) CHECK (height_cm > 0),
    weight_kg      DECIMAL(5,2) CHECK (weight_kg > 0),
    bmi            DECIMAL(5,2) DEFAULT NULL,
    goals          TEXT,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Exercises Table
CREATE TABLE exercises (
    exercise_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name           VARCHAR(100) NOT NULL,
    muscle_group   VARCHAR(50),  -- E.g., Chest, Legs, Back, Cardio
    equipment      VARCHAR(50)   -- E.g., Barbell, Dumbbell, Machine
);

-- Create Workouts Table
CREATE TABLE workouts (
    workout_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INT REFERENCES users(user_id) ON DELETE CASCADE,
    workout_date DATE NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, workout_date)
);

-- Create Workout Exercises Table
CREATE TABLE workout_exercises (
    workout_exercise_id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id    INT REFERENCES workouts(workout_id) ON DELETE CASCADE,
    exercise_id   INT REFERENCES exercises(exercise_id) ON DELETE CASCADE,
    sets          INT DEFAULT 3,
    reps          INT DEFAULT 10,
    weight        DECIMAL(6,2) DEFAULT 0.00,
    notes         TEXT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Personal Records (PRs) Table
CREATE TABLE personal_records (
    pr_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INT REFERENCES users(user_id) ON DELETE CASCADE,
    exercise_id   INT REFERENCES exercises(exercise_id) ON DELETE CASCADE,
    max_weight    DECIMAL(6,2) NOT NULL,
    max_reps      INT DEFAULT 1,
    achieved_date DATE NOT NULL,
    UNIQUE(user_id, exercise_id)
);

-- Create Friends Table
CREATE TABLE friends (
    user_id         INT REFERENCES users(user_id) ON DELETE CASCADE,
    friend_id       INT REFERENCES users(user_id) ON DELETE CASCADE,
    status VARCHAR(20) CHECK (status IN ('pending', 'accepted', 'blocked')) DEFAULT 'pending',
    requested_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, friend_id),
    CHECK (user_id <> friend_id)
);

-- Populate Exercises Table
INSERT INTO exercises (name, muscle_group, equipment) VALUES
    -- Chest Exercises
    ('Bench Press', 'Chest', 'Barbell'),
    ('Incline Bench Press', 'Chest', 'Barbell'),
    ('Chest Fly', 'Chest', 'Dumbbell'),
    ('Cable Crossover', 'Chest', 'Cable Machine'),
    ('Push-up', 'Chest', 'Bodyweight'),
    ('Dips', 'Chest', 'Bodyweight'),
    ('Machine Chest Press', 'Chest', 'Machine'),
    ('Decline Bench Press', 'Chest', 'Barbell'),
    ('Dumbbell Bench Press', 'Chest', 'Dumbbell'),
    ('Pec Deck Machine', 'Chest', 'Machine'),
    
    -- Legs Exercises
    ('Squat', 'Legs', 'Barbell'),
    ('Leg Press', 'Legs', 'Machine'),
    ('Lunges', 'Legs', 'Dumbbell'),
    ('Romanian Deadlift', 'Legs', 'Barbell'),
    ('Hamstring Curl', 'Legs', 'Machine'),
    ('Leg Extension', 'Legs', 'Machine'),
    ('Step-ups', 'Legs', 'Dumbbell'),
    ('Bulgarian Split Squat', 'Legs', 'Dumbbell'),
    ('Calf Raise', 'Legs', 'Machine'),
    ('Front Squat', 'Legs', 'Barbell'),
    
    -- Back Exercises
    ('Deadlift', 'Back', 'Barbell'),
    ('Pull-up', 'Back', 'Bodyweight'),
    ('Lat Pulldown', 'Back', 'Machine'),
    ('Bent-over Row', 'Back', 'Barbell'),
    ('Seated Row', 'Back', 'Cable Machine'),
    ('T-Bar Row', 'Back', 'Barbell'),
    ('Face Pulls', 'Back', 'Cable Machine'),
    ('Single-arm Dumbbell Row', 'Back', 'Dumbbell'),
    ('Chin-up', 'Back', 'Bodyweight'),
    ('Trap Bar Deadlift', 'Back', 'Trap Bar'),
    
    -- Shoulder Exercises
    ('Overhead Press', 'Shoulders', 'Barbell'),
    ('Dumbbell Shoulder Press', 'Shoulders', 'Dumbbell'),
    ('Lateral Raise', 'Shoulders', 'Dumbbell'),
    ('Front Raise', 'Shoulders', 'Dumbbell'),
    ('Arnold Press', 'Shoulders', 'Dumbbell'),
    ('Face Pulls', 'Shoulders', 'Cable Machine'),
    ('Reverse Fly', 'Shoulders', 'Dumbbell'),
    ('Shrugs', 'Shoulders', 'Barbell'),
    ('Upright Row', 'Shoulders', 'Barbell'),
    ('Military Press', 'Shoulders', 'Barbell'),
    
    -- Arm Exercises
    ('Bicep Curl', 'Arms', 'Dumbbell'),
    ('Hammer Curl', 'Arms', 'Dumbbell'),
    ('Tricep Dips', 'Arms', 'Bodyweight'),
    ('Tricep Pushdown', 'Arms', 'Cable Machine'),
    ('Preacher Curl', 'Arms', 'Barbell'),
    ('Concentration Curl', 'Arms', 'Dumbbell'),
    ('Skull Crushers', 'Arms', 'Barbell'),
    ('Zottman Curl', 'Arms', 'Dumbbell'),
    ('Overhead Tricep Extension', 'Arms', 'Dumbbell'),
    ('Reverse Curl', 'Arms', 'Barbell'),
    
    -- Cardio Exercises
    ('Running', 'Cardio', 'Treadmill'),
    ('Cycling', 'Cardio', 'Stationary Bike'),
    ('Rowing', 'Cardio', 'Rowing Machine'),
    ('Jump Rope', 'Cardio', 'Bodyweight'),
    ('Elliptical', 'Cardio', 'Elliptical Machine'),
    ('Swimming', 'Cardio', 'Pool'),
    ('Stair Climbing', 'Cardio', 'Stair Machine'),
    ('Boxing', 'Cardio', 'Punching Bag'),
    ('High Knees', 'Cardio', 'Bodyweight'),
    ('Burpees', 'Cardio', 'Bodyweight');

-- Create Challenges Table
CREATE TABLE challenges (
    challenge_id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenge_text TEXT NOT NULL,
    start_date DATE NOT NULL,  -- The Monday of the challenge week
    end_date DATE NOT NULL     -- The Sunday of the challenge week
);

-- Populate Challenges Table
INSERT INTO challenges (challenge_text, start_date, end_date) VALUES
    ('Complete 100 push-ups every day!!! 💪', '2025-02-26', '2025-03-03'),
    ('Run 10km by the end of the week! 🏃', '2025-03-04', '2025-03-10'),
    ('Drink 3L of water daily! 💧', '2025-03-11', '2025-03-17'),
    ('Try a new yoga pose every day! 🧘', '2025-03-18', '2025-03-24');

-- Create Leaderboard Table
CREATE TABLE leaderboard (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 0
);

-- Populate Leaderboard Table with dummy data
INSERT INTO leaderboard (username, points) VALUES
    ('Alice', 1200),
    ('Bob', 950),
    ('Charlie', 800),
    ('Dave', 700),
    ('Eve', 650);