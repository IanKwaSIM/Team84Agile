document.addEventListener("DOMContentLoaded", function () {
    const muscleGroups = document.querySelectorAll(".muscle-group h3");
    const pastWorkoutsSection = document.getElementById("past-workouts");
    const pastWorkoutsList = document.getElementById("past-workouts-list");

    //  **Expand/Collapse Muscle Groups**
    muscleGroups.forEach(group => {
        group.addEventListener("click", function () {
            const exerciseList = this.nextElementSibling;
            exerciseList.classList.toggle("hidden");
        });
    });
    

    //  **Fetch and Display Past Workout Records**
    // Fetch and Display Past Workout Records (from `/account/data`)
    function fetchPastWorkouts() {
        fetch("/account/data")
            .then(response => {
                if (!response.ok) throw new Error("Failed to fetch data");
                return response.json();
            })
            .then(data => {
                console.log("Fetched Past Workouts:", data.pastWorkouts); // Debugging Log

                if (!data.pastWorkouts || data.pastWorkouts.length === 0) {
                    pastWorkoutsList.innerHTML = "<p>No past workouts recorded.</p>";
                    return;
                }

                pastWorkoutsList.innerHTML = data.pastWorkouts.map(workout => `
                    <div class="workout-item">
                        <h4>${workout.date}</h4>
                        <p><strong>Exercise:</strong> ${workout.name} (${workout.muscle_group})</p>
                        <p><strong>Sets:</strong> ${workout.sets}, <strong>Reps:</strong> ${workout.reps}, <strong>Weight:</strong> ${workout.weight} kg</p>
                    </div>
                `).join("");
            })
            .catch(error => console.error("Error fetching past workouts:", error));
    }

    //  **Initialize Data Fetching**
    fetchPastWorkouts();
});
