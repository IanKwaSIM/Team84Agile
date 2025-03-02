document.addEventListener("DOMContentLoaded", function () {
    // Calendar & Workout Elements
    const calendar = document.getElementById("calendar");
    const monthYearDisplay = document.getElementById("month-year");
    const prevMonthBtn = document.getElementById("prev-month");
    const nextMonthBtn = document.getElementById("next-month");
    const logWorkoutBtn = document.getElementById("log-new-workout");
    const viewWorkoutBtn = document.getElementById("view-logged-workout");
    const completeWorkoutBtn = document.getElementById("complete-workout");
    const deleteWorkoutBtn = document.getElementById("delete-workout");

    // Exercise & Workout List
    const exerciseSection = document.getElementById("exercise-section");
    const exerciseList = document.getElementById("exercise-list");
    const currentWorkout = document.getElementById("current-workout");
    const muscleGroups = document.querySelectorAll(".muscle-group h3");

    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();
    let selectedDate = null;
    let selectedDateElement = null;
    let loggedWorkouts = new Set(); // Store logged workout dates

    // Initially hide the exercise section
    exerciseSection.style.display = "none";

    //  **Expand/Collapse Muscle Groups**
    muscleGroups.forEach(group => {
        group.addEventListener("click", function () {
            this.nextElementSibling.classList.toggle("hidden");
        });
    });

    //  **Load Calendar & Highlight Logged Workouts**
    function loadCalendar(month, year) {
        fetch(`/workouts/dates`)
            .then(response => response.json())
            .then(dates => {
                console.log("Workout Dates from DB:", dates); // Debugging log
                loggedWorkouts = new Set(dates);
                monthYearDisplay.textContent = `${new Date(year, month).toLocaleString('default', { month: 'long' })} ${year}`;
                calendar.innerHTML = "";

                let firstDay = new Date(year, month, 1).getDay();
                firstDay = firstDay === 0 ? 6 : firstDay - 1;

                for (let i = 0; i < firstDay; i++) {
                    calendar.appendChild(document.createElement("div"));
                }

                let daysInMonth = new Date(year, month + 1, 0).getDate();
                for (let i = 1; i <= daysInMonth; i++) {
                    let day = document.createElement("div");
                    day.classList.add("calendar-day");
                    day.textContent = i;

                    let fullDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                    if (loggedWorkouts.has(fullDate)) {
                        day.classList.add("workout-day"); // Highlight logged workout dates
                    }

                    day.addEventListener("click", function () {
                        selectWorkoutDay(day, fullDate);
                    });

                    calendar.appendChild(day);
                }
            })
            .catch(error => console.error("Error fetching workout dates:", error));
    }

    function selectWorkoutDay(dayElement, date) {
        if (selectedDateElement) selectedDateElement.classList.remove("selected");
        selectedDateElement = dayElement;
        selectedDateElement.classList.add("selected");
        selectedDate = date;

        const hasWorkout = loggedWorkouts.has(date);
        logWorkoutBtn.classList.toggle("hidden", hasWorkout);
        viewWorkoutBtn.classList.toggle("hidden", !hasWorkout);
        deleteWorkoutBtn.classList.toggle("hidden", !hasWorkout); // Ensure delete button appears
        exerciseSection.style.display = "none";
        currentWorkout.innerHTML = "";
    }


    logWorkoutBtn.addEventListener("click", function () {
        exerciseSection.style.display = "block";
    });

    viewWorkoutBtn.addEventListener("click", function () {
        fetch(`/workouts/${selectedDate}`)
            .then(response => response.json())
            .then(data => {
                console.log(`Retrieved Workout Data for ${selectedDate}:`, data); // Debugging log
    
                if (data.length === 0) {
                    currentWorkout.innerHTML = "<p>No workout logged for this date.</p>";
                } else {
                    currentWorkout.innerHTML = data.map(ex => `
                        <div class="workout-item">
                            <h4>${ex.name} (${ex.muscle_group})</h4>
                            <label>Sets:</label> <input type="number" value="${ex.sets}" min="1" disabled>
                            <label>Reps:</label> <input type="number" value="${ex.reps}" min="1" disabled>
                            <label>Weight (kg):</label> <input type="number" value="${ex.weight}" min="0" disabled>
                        </div>
                    `).join("");
                }
            })
            .catch(error => console.error("Error retrieving workout data:", error));
    });
    

    //  **Prevent Duplicate Exercises**
    function isExerciseAdded(exerciseName) {
        return Array.from(currentWorkout.children).some(ex => 
            ex.querySelector("h4").textContent === exerciseName
        );
    }

    //  **Add Exercise to Current Workout**
    exerciseList.addEventListener("click", function (event) {
        if (event.target.tagName === "LI") {
            const exerciseName = event.target.textContent;
            if (!isExerciseAdded(exerciseName)) {
                addToWorkout(event.target.dataset.id, exerciseName);
            }
        }
    });

    function addToWorkout(id, name) {
        const newExercise = document.createElement("div");
        newExercise.classList.add("workout-item");
        newExercise.dataset.id = id;
        newExercise.innerHTML = `
            <h4>${name}</h4>
            <label>Set</label>
            <input type="number" value="4" min="1">
            <label>Reps</label>
            <input type="number" value="10" min="1">
            <label>Weight (kg)</label>
            <input type="number" value="0" min="0">
            <button class="delete-exercise"></button>
        `;

        newExercise.querySelector(".delete-exercise").addEventListener("click", function () {
            newExercise.remove();
            if (currentWorkout.children.length === 0) {
                completeWorkoutBtn.classList.add("hidden");
            }
        });

        currentWorkout.appendChild(newExercise);
        completeWorkoutBtn.classList.remove("hidden");
    }

    //  **Save Workout Data**
    completeWorkoutBtn.addEventListener("click", function () {
        if (!selectedDate) {
            alert("Please select a date first.");
            return;
        }

        const workoutData = Array.from(currentWorkout.children).map(item => ({
            exercise_id: item.dataset.id,
            sets: item.querySelector("input:nth-of-type(1)").value,
            reps: item.querySelector("input:nth-of-type(2)").value,
            weight: item.querySelector("input:nth-of-type(3)").value,
        }));

        console.log("Saving Workout Data:", { date: selectedDate, workout: workoutData }); // Debugging log

        fetch("/workouts/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date: selectedDate, workout: workoutData }),
        })
        .then(response => response.json())
        .then(data => {
            console.log("Save Response:", data); // Debugging log
            alert(data.message);
            location.reload();
        })
        .catch(err => console.error("Error saving workout:", err));
    });

    //  **Delete Workout**
    deleteWorkoutBtn.addEventListener("click", function () {
        if (!selectedDate) {
            alert("Please select a date first.");
            return;
        }

        if (!confirm("Are you sure you want to delete this workout? This action cannot be undone.")) {
            return;
        }

        fetch(`/workouts/delete/${selectedDate}`, { method: "DELETE" })
            .then(response => response.json())
            .then(data => {
                console.log("Delete Response:", data);
                alert(data.message);
                location.reload();
            })
            .catch(error => console.error("Error deleting workout:", error));
    });

    prevMonthBtn.addEventListener("click", function () {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        loadCalendar(currentMonth, currentYear);
    });

    nextMonthBtn.addEventListener("click", function () {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        loadCalendar(currentMonth, currentYear);
    });

loadCalendar(currentMonth, currentYear);
});